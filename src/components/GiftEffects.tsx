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
  const sender = people?.byId.get(active.sender_id);
  const receiver = people?.byId.get(active.receiver_id);
  return (
    <div key={active.id} role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-4">
      <div className="gift-celebration relative flex w-full max-w-sm flex-col items-center gap-2 text-center">
        <span className="gift-halo absolute left-1/2 top-[42%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full" aria-hidden />
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="gift-spark absolute left-1/2 top-[42%] text-xl text-gold" style={{ "--a": `${i * (360 / 14)}deg`, animationDelay: `${0.25 + (i % 3) * 0.12}s` } as React.CSSProperties} aria-hidden>✦</span>
        ))}
        <div className="gift-names flex items-center gap-3"><UserAvatar src={sender?.avatar_url} name={sender?.username ?? "عضو"} className="h-11 w-11" /><span className="text-xl text-gold" aria-hidden>✦</span><UserAvatar src={receiver?.avatar_url} name={receiver?.username ?? "عضو"} className="h-11 w-11" /></div>
        <div className="gift-float relative h-56 w-56 sm:h-64 sm:w-64"><GiftArtwork gift={gift} className="gift-center h-full w-full" /></div>
        <p className="gift-caption bidi-plain max-w-full break-words text-lg font-bold text-gold">{sender?.username ?? "عضو"} أهدى {gift.name}</p>
        <p className="gift-caption bidi-plain max-w-full break-words text-base font-semibold text-foreground">إلى {receiver?.username ?? "عضو"}</p>
      </div>
    </div>
  );
}