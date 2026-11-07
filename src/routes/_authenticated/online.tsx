import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { UserAvatar, RoleBadge } from "@/components/UserAvatar";
import { useMe } from "@/lib/auth";
import { useOnline } from "@/lib/presence";
import { usePeople } from "@/lib/people";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/online")({
  head: () => ({ meta: [{ title: "المتصلين - شات فراشات العرب" }, { name: "description", content: "قائمة الأعضاء والمتصلين الآن في شات فراشات العرب." }, { property: "og:title", content: "المتصلين - شات فراشات العرب" }, { property: "og:description", content: "ابحث عن الأعضاء والمتصلين الآن." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: OnlinePage,
});

function OnlinePage() {
  const { data: me } = useMe();
  const online = useOnline(me?.profile.id);
  const { data: people } = usePeople();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"online" | "all">("online");

  const list = useMemo(() => {
    let l = people?.list ?? [];
    if (tab === "online") l = l.filter((p) => online.has(p.id));
    if (q.trim()) l = l.filter((p) => p.username.toLowerCase().includes(q.trim().toLowerCase()));
    return [...l].sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)));
  }, [people, online, tab, q]);

  return (
    <AppShell>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 rounded-xl bg-secondary p-1">
          {(["online", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg py-2 text-sm font-semibold transition",
                tab === t ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t === "online" ? `المتصلين (${online.size})` : `كل الأعضاء (${people?.list.length ?? 0})`}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن عضو"
            className="h-11 w-full rounded-xl border border-input bg-secondary pr-10 pl-4 outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-2">
          {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">لا يوجد أعضاء</p>}
          {list.map((p) => (
            <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <UserAvatar src={p.avatar_url} name={p.username} online={online.has(p.id)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="bidi-plain truncate font-semibold">{p.username}</span>
                  <RoleBadge label={p.badge} />
                </div>
                <p className="bidi-plain truncate text-xs text-muted-foreground">
                  {p.gender} · {p.age} سنة {p.status && `· ${p.status}`}
                </p>
              </div>
              {p.id !== me?.profile.id && (
                <Link
                  to="/private/$userId"
                  params={{ userId: p.id }}
                  className="shrink-0 rounded-full bg-primary/15 p-2.5 text-primary"
                  aria-label="مراسلة"
                >
                  <MessageCircle className="h-5 w-5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
