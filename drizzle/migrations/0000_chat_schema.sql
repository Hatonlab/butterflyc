
create type public.app_role as enum ('owner','admin','moderator');
create type public.staff_section as enum ('members','rooms','messages','private');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  status text not null default '',
  gender text not null default 'ذكر',
  age int not null default 18,
  banned boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.section_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  section staff_section not null,
  unique(user_id, section)
);
grant select, insert, update, delete on public.section_permissions to authenticated;
grant all on public.section_permissions to service_role;
alter table public.section_permissions enable row level security;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_url text,
  sort int not null default 0,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;

create table public.room_moderators (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unique(room_id, user_id)
);
grant select, insert, update, delete on public.room_moderators to authenticated;
grant all on public.room_moderators to service_role;
alter table public.room_moderators enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.messages(room_id, created_at desc);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create table public.private_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.private_messages(sender_id, receiver_id, created_at desc);
grant select, insert, update, delete on public.private_messages to authenticated;
grant all on public.private_messages to service_role;
alter table public.private_messages enable row level security;

-- helper functions
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role in ('owner','admin'))
$$;

create or replace function public.has_section(_uid uuid, _section staff_section)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(_uid) or exists (select 1 from public.section_permissions where user_id = _uid and section = _section)
$$;

create or replace function public.can_moderate_room(_uid uuid, _room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_section(_uid, 'messages')
    or public.has_role(_uid, 'moderator')
    or exists (select 1 from public.room_moderators where user_id = _uid and room_id = _room)
$$;

create or replace function public.is_banned(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select banned from public.profiles where id = _uid), false)
$$;

-- profiles policies
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "update own or members staff" on public.profiles for update to authenticated
  using (auth.uid() = id or public.has_section(auth.uid(), 'members'))
  with check (auth.uid() = id or public.has_section(auth.uid(), 'members'));
create policy "members staff delete" on public.profiles for delete to authenticated using (public.has_section(auth.uid(), 'members') and not public.has_role(id, 'owner'));

-- prevent non-staff from self-unbanning
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.banned is distinct from old.banned and not public.has_section(auth.uid(), 'members') then
    new.banned := old.banned;
  end if;
  if new.banned and public.has_role(new.id, 'owner') then new.banned := false; end if;
  return new;
end $$;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();

-- roles: readable by all signed-in, only owner/admin manage; only owner manages admins; owner role untouchable
create policy "roles readable" on public.user_roles for select to authenticated using (true);
create policy "roles insert" on public.user_roles for insert to authenticated
  with check (role <> 'owner' and (public.has_role(auth.uid(),'owner') or (public.is_admin(auth.uid()) and role = 'moderator')));
create policy "roles delete" on public.user_roles for delete to authenticated
  using (role <> 'owner' and (public.has_role(auth.uid(),'owner') or (public.is_admin(auth.uid()) and role = 'moderator')));

create policy "sections readable" on public.section_permissions for select to authenticated using (true);
create policy "sections manage" on public.section_permissions for insert to authenticated with check (public.is_admin(auth.uid()));
create policy "sections delete" on public.section_permissions for delete to authenticated using (public.is_admin(auth.uid()));

-- rooms
create policy "rooms readable" on public.rooms for select to authenticated using (true);
create policy "rooms insert" on public.rooms for insert to authenticated with check (public.has_section(auth.uid(),'rooms'));
create policy "rooms update" on public.rooms for update to authenticated using (public.has_section(auth.uid(),'rooms'));
create policy "rooms delete" on public.rooms for delete to authenticated using (public.has_section(auth.uid(),'rooms'));

create policy "roommods readable" on public.room_moderators for select to authenticated using (true);
create policy "roommods insert" on public.room_moderators for insert to authenticated with check (public.has_section(auth.uid(),'rooms'));
create policy "roommods delete" on public.room_moderators for delete to authenticated using (public.has_section(auth.uid(),'rooms'));

-- messages
create policy "messages readable" on public.messages for select to authenticated using (true);
create policy "messages send" on public.messages for insert to authenticated
  with check (auth.uid() = user_id and not public.is_banned(auth.uid())
    and (not (select locked from public.rooms where id = room_id) or public.can_moderate_room(auth.uid(), room_id)));
create policy "messages delete" on public.messages for delete to authenticated
  using (auth.uid() = user_id or public.can_moderate_room(auth.uid(), room_id));

-- private
create policy "pm read" on public.private_messages for select to authenticated
  using (auth.uid() in (sender_id, receiver_id) or public.has_section(auth.uid(),'private'));
create policy "pm send" on public.private_messages for insert to authenticated
  with check (auth.uid() = sender_id and not public.is_banned(auth.uid()) and sender_id <> receiver_id);
create policy "pm mark read" on public.private_messages for update to authenticated
  using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);
create policy "pm delete" on public.private_messages for delete to authenticated
  using (auth.uid() = sender_id or public.has_section(auth.uid(),'private'));

-- signup trigger: profile + first user becomes owner
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare age_v int;
begin
  age_v := coalesce(nullif(new.raw_user_meta_data->>'age','')::int, 18);
  insert into public.profiles (id, username, status, gender, age)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'username', 'عضو'),
    coalesce(new.raw_user_meta_data->>'status', ''),
    coalesce(new.raw_user_meta_data->>'gender', 'ذكر'),
    age_v);
  perform pg_advisory_xact_lock(424242);
  if not exists (select 1 from public.user_roles where role = 'owner') then
    insert into public.user_roles (user_id, role) values (new.id, 'owner');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- seed rooms
insert into public.rooms (name, description, image_url, sort) values
 ('الغرفة العامة', 'ملتقى كل الفراشات للدردشة والتعارف', '/rooms/general.svg', 1),
 ('سهر وسمر', 'سوالف الليل والضحك والونسة', '/rooms/night.svg', 2),
 ('شعر وخواطر', 'أجمل الأبيات والكلمات الراقية', '/rooms/poetry.svg', 3),
 ('ألعاب ومسابقات', 'تحديات وألغاز وجوائز', '/rooms/games.svg', 4),
 ('طرب وأغاني', 'شاركنا ذوقك في الموسيقى', '/rooms/music.svg', 5);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.private_messages;
