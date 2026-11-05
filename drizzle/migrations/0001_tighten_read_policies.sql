DROP POLICY IF EXISTS "profiles readable" ON public.profiles;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR NOT public.is_banned(auth.uid()));

DROP POLICY IF EXISTS "rooms readable" ON public.rooms;
CREATE POLICY "rooms readable" ON public.rooms FOR SELECT TO authenticated
USING (NOT public.is_banned(auth.uid()) OR public.has_section(auth.uid(), 'rooms'));

DROP POLICY IF EXISTS "messages readable" ON public.messages;
CREATE POLICY "messages readable" ON public.messages FOR SELECT TO authenticated
USING (auth.uid() = user_id OR NOT public.is_banned(auth.uid()));

DROP POLICY IF EXISTS "roles readable" ON public.user_roles;
CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR NOT public.is_banned(auth.uid()));

DROP POLICY IF EXISTS "sections readable" ON public.section_permissions;
CREATE POLICY "sections readable" ON public.section_permissions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()) OR public.has_section(auth.uid(), 'members'));

DROP POLICY IF EXISTS "roommods readable" ON public.room_moderators;
CREATE POLICY "roommods readable" ON public.room_moderators FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()) OR public.has_section(auth.uid(), 'rooms') OR public.has_section(auth.uid(), 'members'));