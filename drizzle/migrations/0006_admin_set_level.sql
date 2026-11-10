CREATE OR REPLACE FUNCTION public.admin_set_level(_user uuid, _level integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r int;
begin
  if not public.is_admin(auth.uid()) then raise exception 'غير مصرح'; end if;
  if _level is null or _level < 1 or _level > 1000 then raise exception 'مستوى غير صالح'; end if;
  perform set_config('app.coin_ok', '1', true);
  update public.profiles set xp = 50 * (_level - 1) * (_level - 1) where id = _user returning xp into r;
  if r is null then raise exception 'العضو غير موجود'; end if;
  return _level;
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_level(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_level(uuid, integer) TO authenticated;