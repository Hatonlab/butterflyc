import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useMe } from "@/lib/auth";
import { useOnline } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "الغرف - شات فراشات العرب" }] }),
  component: Home,
});

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("*").order("sort");
      if (error) throw error;
      return data;
    },
  });
}

function Home() {
  const { data: me } = useMe();
  const online = useOnline(me?.profile.id);
  const { data: rooms = [], isLoading } = useRooms();

  return (
    <AppShell>
      <div className="space-y-5 p-4">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow">
          <svg viewBox="0 0 200 120" className="absolute -left-6 -top-4 h-36 opacity-20" aria-hidden>
            <path d="M100 60C80 10 20 0 10 30s20 50 90 30Zm0 0c20-50 80-60 90-30s-20 50-90 30Z" fill="currentColor" />
          </svg>
          <p className="text-sm opacity-80">أهلاً بك</p>
          <h2 className="bidi-plain mt-1 font-display text-2xl">{me?.profile.username}</h2>
          <p className="mt-2 text-sm opacity-90">
            <span className="font-bold">{online.size}</span> متصل الآن · اختر غرفتك وابدأ الدردشة
          </p>
        </section>

        <h3 className="font-display text-lg">غرف الدردشة</h3>
        <div className="space-y-3">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />)}
          {rooms.map((r) => (
            <Link
              key={r.id}
              to="/rooms/$roomId"
              params={{ roomId: r.id }}
              className="glass group flex items-center gap-4 rounded-2xl p-3 transition hover:border-primary/40 active:scale-[.99]"
            >
              <img
                src={r.image_url || "/rooms/general.svg"}
                alt={r.name}
                className="h-16 w-16 rounded-2xl object-cover shadow-glow"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="bidi-plain truncate font-semibold">{r.name}</h4>
                  {r.locked && <Lock className="h-3.5 w-3.5 text-gold" />}
                </div>
                <p className="bidi-plain mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
              </div>
              <ChevronLeft className="h-5 w-5 text-muted-foreground transition group-hover:-translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
