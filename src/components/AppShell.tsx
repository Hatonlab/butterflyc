import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Users, MessageCircle, UserRound, ShieldCheck, Ban, Coins } from "lucide-react";
import { useActivityCoins } from "@/lib/coins";
import { LevelBadge } from "./UserAvatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { useOnline } from "@/lib/presence";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "الرئيسية", icon: Home },
  { to: "/online", label: "المتصلين", icon: Users },
  { to: "/private", label: "الخاص", icon: MessageCircle },
  { to: "/profile", label: "ملفي", icon: UserRound },
] as const;

export function AppShell({
  children,
  header,
  hideNav,
}: {
  children: ReactNode;
  header?: ReactNode;
  hideNav?: boolean;
}) {
  const { data: me } = useMe();
  useOnline(me?.profile.id);
  useActivityCoins(me?.profile.id);
  const loc = useLocation();
  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", me?.profile.id],
    enabled: !!me,
    refetchInterval: 15000,
    queryFn: async () => {
      const { count } = await supabase
        .from("private_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", me!.profile.id)
        .eq("read", false);
      return count ?? 0;
    },
  });

  if (me?.profile.banned) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <Ban className="h-16 w-16 text-destructive" />
        <h1 className="font-display text-2xl">تم حظر حسابك</h1>
        <p className="text-muted-foreground">تواصل مع إدارة التطبيق لمزيد من المعلومات.</p>
        <button className="text-primary underline" onClick={() => supabase.auth.signOut()}>
          تسجيل الخروج
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col">
      <header className="glass animate-slide-down sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-4">
        {header ?? <Logo />}
        {!header && me && (
          <div className="flex items-center gap-1.5">
            <LevelBadge xp={me.profile.xp} />
            <span key={me.profile.coins} className="animate-pop-in flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold">
              <Coins className="h-3.5 w-3.5" /> {me.profile.coins}
            </span>
          </div>
        )}
        {!header && me?.isStaff && (
          <Link
            to="/admin"
            className="flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold"
          >
            <ShieldCheck className="h-4 w-4" /> لوحة التحكم
          </Link>
        )}
      </header>
      <main key={loc.pathname} className="animate-page-in min-h-0 flex-1 overflow-y-auto">{children}</main>
      {!hideNav && (
        <nav className="glass grid shrink-0 grid-cols-4 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-gradient-primary shadow-glow" />}
                <Icon className={cn("h-5 w-5 transition-transform duration-300", active && "-translate-y-0.5 scale-115 drop-shadow-[0_0_8px_var(--primary)]")} />
                {t.label}
                {t.to === "/private" && unread > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-18px)] min-w-4 rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
