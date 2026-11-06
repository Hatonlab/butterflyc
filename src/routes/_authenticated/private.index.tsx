import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { useMe } from "@/lib/auth";
import { usePeople } from "@/lib/people";
import { useOnline } from "@/lib/presence";
import { timeAgo } from "@/lib/image";

export const Route = createFileRoute("/_authenticated/private/")({
  head: () => ({ meta: [{ title: "الخاص - شات فراشات العرب" }] }),
  component: PrivateList,
});

function PrivateList() {
  const { data: me } = useMe();
  const online = useOnline(me?.profile.id);
  const { data: people } = usePeople();
  const myId = me?.profile.id;
  const { data: convos = [] } = useQuery({
    queryKey: ["convos", myId],
    enabled: !!myId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("private_messages")
        .select("*")
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order("created_at", { ascending: false })
        .limit(500);
      const map = new Map<string, { other: string; last: NonNullable<typeof data>[number]; unread: number }>();
      (data ?? []).forEach((m) => {
        const other = m.sender_id === myId ? m.receiver_id : m.sender_id;
        const c = map.get(other) ?? { other, last: m, unread: 0 };
        if (m.receiver_id === myId && !m.read) c.unread++;
        map.set(other, c);
      });
      return [...map.values()];
    },
  });

  return (
    <AppShell>
      <div className="space-y-2 p-4">
        <h2 className="mb-3 font-display text-lg">المحادثات الخاصة</h2>
        {convos.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 text-primary/60" />
            <p className="text-sm">لا توجد محادثات بعد. افتح قائمة المتصلين وابدأ محادثة.</p>
            <Link to="/online" className="text-sm text-primary underline">
              المتصلين
            </Link>
          </div>
        )}
        {convos.map((c) => {
          const p = people?.byId.get(c.other);
          return (
            <Link
              key={c.other}
              to="/private/$userId"
              params={{ userId: c.other }}
              className="glass flex items-center gap-3 rounded-2xl p-3"
            >
              <UserAvatar src={p?.avatar_url} name={p?.username ?? "?"} online={online.has(c.other)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="bidi-plain truncate font-semibold">{p?.username ?? "عضو"}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.last.created_at)}</span>
                </div>
                <p className="bidi-plain truncate text-sm text-muted-foreground">{c.last.content || (c.last.media_type === "image" ? "📷 صورة" : c.last.media_type === "video" ? "🎬 فيديو" : "🎤 رسالة صوتية")}</p>
              </div>
              {c.unread > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{c.unread}</span>
              )}
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
