import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { giftByKey } from "@/lib/gifts";
import { usePeople } from "@/lib/people";
import type { Database } from "@/integrations/supabase/types";
import { GiftArtwork } from "./GiftArtwork";
import { UserAvatar } from "./UserAvatar";

type GiftEvent = Database["public"]["Tables"]["gifts"]["Row"];

export function GiftEffects({ userId }: { userId?: string | undefined }) {
  const [queue, setQueue] = useState<GiftEvent[]>([]);
  const { data: people } = usePeople();
  const qc = useQueryClient();
  const active = queue[0];
  useEffect(() => {
    if (!userId) return;
    const seen = new Set<string>();
    const channel = supabase.channel(`shared-gifts-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gifts" }, ({ new: row }) => {
        const gift = row as GiftEvent;
        if (seen.has(gift.id) || !giftByKey.has(gift.gift_key)) return;
        seen.add(gift.id);
        setQueue((items) => [...items, gift]);
        void qc.invalidateQueries({ queryKey: ["people"] });
        void qc.invalidateQueries({ queryKey: ["me"] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setQueue((items) => items.slice(1)), 3500);
    return () => window.clearTimeout(timer);
  }, [active]);
  const gift = active && giftByKey.get(active.gift_key);
  if (!active || !gift) return null;
  return (
    <div key={active.id} role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-4">
      <div className="gift-celebration relative flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-gold/40 bg-card/95 px-5 py-6 text-center shadow-glow">
        <div className="flex items-center gap-4"><UserAvatar src={people?.byId.get(active.sender_id)?.avatar_url} name={people?.byId.get(active.sender_id)?.username ?? "عضو"} className="h-12 w-12" /><span className="text-xl text-gold" aria-hidden>✦</span><UserAvatar src={people?.byId.get(active.receiver_id)?.avatar_url} name={people?.byId.get(active.receiver_id)?.username ?? "عضو"} className="h-12 w-12" /></div>
        <GiftArtwork gift={gift} className="gift-center h-48 w-48" />
        <p className="bidi-plain max-w-full break-words text-lg font-bold text-gold">{people?.byId.get(active.sender_id)?.username ?? "عضو"} أهدى {gift.name}</p>
        <p className="bidi-plain max-w-full break-words text-base">إلى {people?.byId.get(active.receiver_id)?.username ?? "عضو"}</p>
        <span className="gift-ribbon h-0.5 w-24 rounded-full bg-gradient-primary" aria-hidden />
      </div>
    </div>
  );
}