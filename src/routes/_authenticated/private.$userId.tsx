import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/components/ChatView";
import { UserAvatar } from "@/components/UserAvatar";
import { useMe } from "@/lib/auth";
import { usePeople } from "@/lib/people";
import { useOnline } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/private/$userId")({
  head: () => ({ meta: [{ title: "محادثة خاصة - شات فراشات العرب" }] }),
  component: PrivateChat,
});

function PrivateChat() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const online = useOnline(me?.profile.id);
  const { data: people } = usePeople();
  const other = people?.byId.get(userId);
  const myId = me?.profile.id;
  const key = ["pm", myId, userId];

  const { data: msgs = [] } = useQuery({
    queryKey: key,
    enabled: !!myId,
    queryFn: async () => {
      const { data } = await supabase
        .from("private_messages")
        .select("*")
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${myId})`)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []).reverse();
    },
  });

  useEffect(() => {
    if (!myId) return;
    if (msgs.some((m) => m.receiver_id === myId && !m.read)) {
      supabase
        .from("private_messages")
        .update({ read: true })
        .eq("receiver_id", myId)
        .eq("sender_id", userId)
        .eq("read", false)
        .then(() => qc.invalidateQueries({ queryKey: ["unread"] }));
    }
  }, [msgs, myId, userId, qc]);

  useEffect(() => {
    if (!myId) return;
    const ch = supabase
      .channel(`pm-${myId}-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages" }, () =>
        qc.invalidateQueries({ queryKey: ["pm", myId, userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [myId, userId, qc]);

  if (!me) return null;

  return (
    <AppShell
      hideNav
      header={
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/private" className="rounded-full p-1.5 hover:bg-secondary" aria-label="رجوع">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <UserAvatar src={other?.avatar_url} name={other?.username ?? "?"} online={online.has(userId)} className="h-10 w-10" />
          <div className="min-w-0">
            <h1 className="bidi-plain truncate font-semibold">{other?.username}</h1>
            <p className="text-xs text-muted-foreground">{online.has(userId) ? "متصل الآن" : "غير متصل"}</p>
          </div>
        </div>
      }
    >
      <ChatView
        showAuthors={false}
        messages={msgs.map((m) => ({ ...m, user_id: m.sender_id }))}
        meId={me.profile.id}
        disabled={userId === me.profile.id}
        disabledText="لا يمكنك مراسلة نفسك"
        canDelete={(m) => m.user_id === me.profile.id || me.isAdmin || me.sections.includes("private")}
        onDelete={async (m) => {
          await supabase.from("private_messages").delete().eq("id", m.id);
          qc.invalidateQueries({ queryKey: key });
        }}
        onSend={async (payload) => {
          const { error } = await supabase
            .from("private_messages")
            .insert({ sender_id: me.profile.id, receiver_id: userId, ...payload });
          if (error) {
            toast.error("تعذر الإرسال");
            throw error;
          }
          qc.invalidateQueries({ queryKey: key });
        }}
      />
    </AppShell>
  );
}
