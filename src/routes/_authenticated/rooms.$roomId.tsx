import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { GiftDialog } from "@/components/GiftDialog";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ChatView, type ChatMsg } from "@/components/ChatView";
import { useMe } from "@/lib/auth";
import { usePeople } from "@/lib/people";

export const Route = createFileRoute("/_authenticated/rooms/$roomId")({
  head: () => ({ meta: [{ title: "غرفة دردشة - شات فراشات العرب" }] }),
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: people } = usePeople();
  const [giftTo, setGiftTo] = useState<string | null>(null);
  const { data: room } = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => (await supabase.from("rooms").select("*").eq("id", roomId).single()).data,
  });
  const key = ["room-msgs", roomId];
  const { data: msgs = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(150);
      return (data ?? []).reverse();
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, () => {
        qc.invalidateQueries({ queryKey: key });
        qc.invalidateQueries({ queryKey: ["people"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (!me) return null;
  const canMod =
    me.isAdmin || me.sections.includes("messages") || me.roles.includes("moderator") || me.roomMods.includes(roomId);

  const list: ChatMsg[] = msgs.map((m) => {
    const p = people?.byId.get(m.user_id);
    const isRoomMod = false;
    return {
      ...m,
      author: { username: p?.username ?? "عضو", avatar_url: p?.avatar_url ?? null, badge: p?.badge ?? (isRoomMod ? "مشرف" : null), xp: p?.xp ?? 0 },
    };
  });

  return (
    <AppShell
      hideNav
      header={
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/home" className="rounded-full p-1.5 hover:bg-secondary" aria-label="رجوع">
            <ArrowRight className="h-5 w-5" />
          </Link>
          {room && <img src={room.image_url || "/rooms/general.svg"} alt="" className="h-10 w-10 rounded-xl" />}
          <div className="min-w-0">
            <h1 className="bidi-plain truncate font-semibold">{room?.name}</h1>
            <p className="bidi-plain truncate text-xs text-muted-foreground">{room?.description}</p>
          </div>
        </div>
      }
    >
      <ChatView
        messages={list}
        meId={me.profile.id}
        disabled={!!room?.locked && !canMod}
        disabledText="الغرفة مقفلة من الإدارة"
        canDelete={(m) => m.user_id === me.profile.id || canMod}
        onDelete={async (m) => {
          const { error } = await supabase.from("messages").delete().eq("id", m.id);
          if (error) toast.error("تعذر الحذف");
          qc.invalidateQueries({ queryKey: key });
        }}
        onAvatarClick={setGiftTo}
        onSend={async (payload) => {
          const { error } = await supabase.from("messages").insert({ room_id: roomId, user_id: me.profile.id, ...payload });
          if (error) {
            toast.error("تعذر إرسال الرسالة");
            throw error;
          }
          qc.invalidateQueries({ queryKey: key });
        }}
      />
      {giftTo && people?.byId.get(giftTo) && <GiftDialog person={people.byId.get(giftTo)!} onClose={() => setGiftTo(null)} />}
    </AppShell>
  );
}
