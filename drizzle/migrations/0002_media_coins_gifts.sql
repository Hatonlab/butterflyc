ALTER TABLE public.messages ADD COLUMN media_url text, ADD COLUMN media_type text;
ALTER TABLE public.private_messages ADD COLUMN media_url text, ADD COLUMN media_type text;
ALTER TABLE public.profiles ADD COLUMN coins integer NOT NULL DEFAULT 0, ADD COLUMN xp integer NOT NULL DEFAULT 0, ADD COLUMN last_coin_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.protect_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.banned is distinct from old.banned and not public.has_section(auth.uid(), 'members') then
    new.banned := old.banned;
  end if;
  if new.banned and public.has_role(new.id, 'owner') then new.banned := false; end if;
  if coalesce(current_setting('app.coin_ok', true), '') <> '1' then
    new.coins := old.coins; new.xp := old.xp; new.last_coin_at := old.last_coin_at;
  end if;
  return new;
end $$;

CREATE TABLE public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_key text NOT NULL,
  cost integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gifts TO authenticated;
GRANT ALL ON public.gifts TO service_role;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts readable" ON public.gifts FOR SELECT TO authenticated USING (NOT public.is_banned(auth.uid()) OR auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE OR REPLACE FUNCTION public.gift_cost(_key text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  select case _key when 'rose' then 8 when 'heart' then 15 when 'butterfly' then 25 when 'cake' then 40
    when 'crown' then 80 when 'diamond' then 150 when 'castle' then 300 when 'rocket' then 500 else null end
$$;

CREATE OR REPLACE FUNCTION public.claim_activity_coins() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p public.profiles; n int;
begin
  if auth.uid() is null or public.is_banned(auth.uid()) then return 0; end if;
  select * into p from public.profiles where id = auth.uid() for update;
  if p.id is null then return 0; end if;
  n := floor(extract(epoch from (now() - p.last_coin_at)) / 600)::int;
  if n <= 0 then return 0; end if;
  n := least(n, 1); -- active sessions only: one reward per 10 minutes
  perform set_config('app.coin_ok', '1', true);
  update public.profiles set coins = coins + 2 * n, xp = xp + 10 * n, last_coin_at = now() where id = p.id;
  return 2 * n;
end $$;

CREATE OR REPLACE FUNCTION public.touch_coin_clock() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null then return; end if;
  perform set_config('app.coin_ok', '1', true);
  update public.profiles set last_coin_at = now() where id = auth.uid() and last_coin_at < now() - interval '20 minutes';
end $$;

CREATE OR REPLACE FUNCTION public.send_gift(_receiver uuid, _gift text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c int; bal int;
begin
  c := public.gift_cost(_gift);
  if c is null then raise exception 'هدية غير معروفة'; end if;
  if auth.uid() is null or public.is_banned(auth.uid()) then raise exception 'غير مصرح'; end if;
  if _receiver = auth.uid() then raise exception 'لا يمكنك إهداء نفسك'; end if;
  select coins into bal from public.profiles where id = auth.uid() for update;
  if bal is null or bal < c then raise exception 'رصيد الكونزات غير كافٍ'; end if;
  perform set_config('app.coin_ok', '1', true);
  update public.profiles set coins = coins - c, xp = xp + c where id = auth.uid();
  update public.profiles set xp = xp + c / 2 where id = _receiver;
  insert into public.gifts(sender_id, receiver_id, gift_key, cost) values (auth.uid(), _receiver, _gift, c);
  return bal - c;
end $$;

CREATE OR REPLACE FUNCTION public.admin_grant_coins(_user uuid, _amount integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r int;
begin
  if not public.is_admin(auth.uid()) then raise exception 'غير مصرح'; end if;
  perform set_config('app.coin_ok', '1', true);
  update public.profiles set coins = greatest(0, coins + _amount) where id = _user returning coins into r;
  return r;
end $$;

REVOKE EXECUTE ON FUNCTION public.claim_activity_coins(), public.touch_coin_clock(), public.send_gift(uuid,text), public.admin_grant_coins(uuid,integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_activity_coins(), public.touch_coin_clock(), public.send_gift(uuid,text), public.admin_grant_coins(uuid,integer) TO authenticated;

CREATE POLICY "media read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-media');
CREATE POLICY "media upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text AND NOT public.is_banned(auth.uid()));