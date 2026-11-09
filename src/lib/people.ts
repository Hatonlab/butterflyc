import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, type Profile, type Role } from "./auth";

/** All members with role badges; small community app so a single list is fine. */
export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    staleTime: 20_000,
    queryFn: async () => {
      const [p, r, ranks, assignments] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("chat_ranks").select("*"),
        supabase.from("member_ranks").select("*"),
      ]);
      const roles = new Map<string, Role[]>();
      const rankById = new Map((ranks.data ?? []).map((rank) => [rank.id, rank]));
      const rankByUser = new Map((assignments.data ?? []).map((assignment) => [assignment.user_id, rankById.get(assignment.rank_id)]));
      (r.data ?? []).forEach((x) => roles.set(x.user_id, [...(roles.get(x.user_id) ?? []), x.role]));
      const list = (p.data ?? []).map((pr) => ({
        ...pr,
        roles: roles.get(pr.id) ?? [],
        badge: [roleLabel(roles.get(pr.id) ?? []), rankByUser.get(pr.id) ? `${rankByUser.get(pr.id)?.badge_image_path ? "" : rankByUser.get(pr.id)?.badge} ${rankByUser.get(pr.id)?.name}`.trim() : null].filter(Boolean).join(" · ") || null,
        badgeImage: rankByUser.get(pr.id)?.badge_image_path ?? null,
      }));
      const byId = new Map<string, (typeof list)[number]>(list.map((x) => [x.id, x]));
      return { list, byId };
    },
  });
}

export type Person = Profile & { roles: Role[]; badge: string | null; badgeImage?: string | null };
