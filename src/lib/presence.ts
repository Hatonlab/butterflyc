import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let channel: RealtimeChannel | null = null;
let joinedAs: string | null = null;
let online = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function joinPresence(userId: string) {
  if (joinedAs === userId && channel) return;
  if (channel) supabase.removeChannel(channel);
  joinedAs = userId;
  channel = supabase.channel("online-users", { config: { presence: { key: userId } } });
  channel
    .on("presence", { event: "sync" }, () => {
      online = new Set(Object.keys(channel!.presenceState()));
      emit();
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel!.track({ at: Date.now() });
    });
  supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId).then();
}

export function leavePresence() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  joinedAs = null;
  online = new Set();
  emit();
}

export function useOnline(userId?: string) {
  useEffect(() => {
    if (userId) joinPresence(userId);
  }, [userId]);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => online,
    () => online,
  );
}
