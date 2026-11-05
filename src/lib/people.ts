import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, type Profile, type Role } from "./auth";

/** All members with role badges; small community app so a single list is fine. */
export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    staleTime: 20_000,
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roles = new Map<string, Role[]>();
      (r.data ?? []).forEach((x) => roles.set(x.user_id, [...(roles.get(x.user_id) ?? []), x.role]));
      const list = (p.data ?? []).map((pr) => ({
        ...pr,
        roles: roles.get(pr.id) ?? [],
        badge: roleLabel(roles.get(pr.id) ?? []),
      }));
      const byId = new Map<string, (typeof list)[number]>(list.map((x) => [x.id, x]));
      return { list, byId };
    },
  });
}

export type Person = Profile & { roles: Role[]; badge: string | null };
