import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar, RoleBadge, LevelBadge } from "./UserAvatar";
import { GIFTS, levelFromXp, type Gift } from "@/lib/gifts";
import { useMe, meQueryKey } from "@/lib/auth";
import type { Person } from "@/lib/people";
import { cn } from "@/lib/utils";

export function GiftDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [sel, setSel] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState<Gift | null>(null);
  const coins = me?.profile.coins ?? 0;
  const lv = levelFromXp(person.xp ?? 0);
  const self = me?.profile.id === person.id;

  async function send() {
    if (!sel) return;
    setBusy(true);
    const { error } = await supabase.rpc("send_gift", { _receiver: person.id, _gift: sel.key });
    setBusy(false);
    if (error) return toast.error(error.message.includes("غير كاف") ? "رصيد الكونزات غير كافٍ" : "تعذر إرسال الهدية");
    setBurst(sel);
    qc.invalidateQueries({ queryKey: meQueryKey });
    qc.invalidateQueries({ queryKey: ["people"] });
    toast.success(`أرسلت ${sel.name} ${sel.emoji} إلى ${person.username}`);
    setTimeout(onClose, 1600);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="glass overflow-hidden border-primary/20 sm:max-w-md">
        {burst && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
            <span className="animate-gift-burst text-8xl drop-shadow-2xl">{burst.emoji}</span>
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="animate-spark absolute text-2xl"
                style={{ "--a": `${i * 30}deg` } as React.CSSProperties}
              >
                ✨
              </span>
            ))}
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="sr-only">ملف {person.username}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="relative">
            <span className="absolute -inset-2 animate-spin-slow rounded-full bg-[conic-gradient(var(--primary),var(--gold),var(--primary-glow),var(--primary))] opacity-80 blur-[2px]" />
            <UserAvatar src={person.avatar_url} name={person.username} className="relative h-24 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="bidi-plain text-xl font-bold">{person.username}</h3>
            <RoleBadge label={person.badge} />
          </div>
          {person.status && <p className="bidi-plain text-sm text-muted-foreground">{person.status}</p>}
          <div className="w-full max-w-60">
            <div className="mb-1 flex justify-between text-xs">
              <LevelBadge xp={person.xp ?? 0} />
              <span className="text-muted-foreground">{person.xp} / {lv.next} XP</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${lv.progress * 100}%` }} />
            </div>
          </div>
          {!self && (
            <Link
              to="/private/$userId"
              params={{ userId: person.id }}
              onClick={onClose}
              className="mt-1 flex items-center gap-1.5 rounded-full bg-secondary px-4 py-1.5 text-sm transition hover:bg-accent"
            >
              <MessageCircle className="h-4 w-4" /> رسالة خاصة
            </Link>
          )}
        </div>

        {!self && (
          <>
            <div className="mt-2 flex items-center justify-between">
              <h4 className="font-display">أرسل هدية</h4>
              <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold">
                <Coins className="h-3.5 w-3.5" /> {coins}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {GIFTS.map((g, i) => {
                const afford = coins >= g.cost;
                return (
                  <button
                    key={g.key}
                    onClick={() => setSel(g)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={cn(
                      "animate-pop-in flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-secondary/60 p-2 transition hover:-translate-y-0.5",
                      sel?.key === g.key && "border-primary bg-primary/15 shadow-glow",
                      !afford && "opacity-45",
                    )}
                  >
                    <span className={cn("text-3xl transition", sel?.key === g.key && "scale-125 animate-floaty")}>{g.emoji}</span>
                    <span className="text-[11px]">{g.name}</span>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-gold">
                      <Coins className="h-3 w-3" />
                      {g.cost}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              disabled={!sel || busy || coins < (sel?.cost ?? 0)}
              onClick={send}
              className="h-11 rounded-full bg-gradient-primary font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-40"
            >
              {sel && coins < sel.cost ? "رصيدك لا يكفي" : sel ? `إرسال ${sel.name} ${sel.emoji}` : "اختر هدية"}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">تحصل على 2 كونز كل 10 دقائق تفاعل</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
