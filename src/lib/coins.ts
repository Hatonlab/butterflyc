import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQueryKey } from "./auth";

/** Rewards active members: the database grants 2 coins once 10 minutes of activity have passed. */
export function useActivityCoins(userId: string | undefined) {
  const qc = useQueryClient();
  const lastAct = useRef(Date.now());
  useEffect(() => {
    if (!userId) return;
    void supabase.rpc("touch_coin_clock");
    const mark = () => (lastAct.current = Date.now());
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const id = setInterval(async () => {
      const active = document.visibilityState === "visible" && Date.now() - lastAct.current < 5 * 60_000;
      if (!active) return;
      const { data } = await supabase.rpc("claim_activity_coins");
      if (data && data > 0) {
        toast.success(`+${data} كونز 🪙 مكافأة التفاعل`);
        qc.invalidateQueries({ queryKey: meQueryKey });
      }
    }, 60_000);
    return () => {
      clearInterval(id);
      evs.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [userId, qc]);
}
