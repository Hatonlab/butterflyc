import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Role = Database["public"]["Enums"]["app_role"];
export type Section = Database["public"]["Enums"]["staff_section"];

export function normalizeUsername(name: string) {
  return name.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Deterministic hidden login id from any (decorated) username. No real email is ever collected. */
export async function usernameToEmail(name: string) {
  const data = new TextEncoder().encode(normalizeUsername(name).toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
  return `u${hex}@farashat.app`;
}

export type Me = {
  profile: Profile;
  roles: Role[];
  sections: Section[];
  roomMods: string[];
  isOwner: boolean;
  isAdmin: boolean;
  isStaff: boolean;
};

export const meQueryKey = ["me"];

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const id = u.user.id;
      const [p, r, s, m] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("user_roles").select("role").eq("user_id", id),
        supabase.from("section_permissions").select("section").eq("user_id", id),
        supabase.from("room_moderators").select("room_id").eq("user_id", id),
      ]);
      if (!p.data) return null;
      const roles = (r.data ?? []).map((x) => x.role);
      const sections = (s.data ?? []).map((x) => x.section);
      const roomMods = (m.data ?? []).map((x) => x.room_id);
      const isOwner = roles.includes("owner");
      const isAdmin = isOwner || roles.includes("admin");
      return {
        profile: p.data,
        roles,
        sections,
        roomMods,
        isOwner,
        isAdmin,
        isStaff: isAdmin || roles.includes("moderator") || sections.length > 0 || roomMods.length > 0,
      };
    },
    staleTime: 30_000,
  });
}

export function roleLabel(roles: Role[]) {
  if (roles.includes("owner")) return "المالك";
  if (roles.includes("admin")) return "مدير";
  if (roles.includes("moderator")) return "مشرف";
  return null;
}

export const sectionLabels: Record<Section, string> = {
  members: "الأعضاء",
  rooms: "الغرف",
  messages: "الرسائل",
  private: "الخاص",
};
