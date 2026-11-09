import { cn } from "@/lib/utils";
import { levelFromXp } from "@/lib/gifts";
import { Crown, ShieldCheck, Sparkles } from "lucide-react";
import { RankImage } from "./RankImage";

export function UserAvatar({
  src,
  name,
  online,
  className = "h-11 w-11",
}: {
  src?: string | null | undefined;
  name: string;
  online?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      {src ? (
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover ring-2 ring-border" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-primary font-bold text-primary-foreground">
          {Array.from(name)[0] ?? "؟"}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 left-0 h-3 w-3 rounded-full ring-2 ring-background",
            online ? "bg-online" : "bg-muted-foreground",
          )}
        />
      )}
    </div>
  );
}

export function LevelBadge({ xp }: { xp: number }) {
  const { level } = levelFromXp(xp);
  return (
    <span className="rounded-full bg-gradient-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
      Lv.{level}
    </span>
  );
}

export function RoleBadge({ label, badgeImage }: { label: string | null; badgeImage?: string | null | undefined }) {
  if (!label && !badgeImage) return null;
  const text = label ?? "شارة الرتبة";
  const Icon = text.includes("المالك") ? Crown : text.includes("مدير") || text.includes("مشرف") ? ShieldCheck : Sparkles;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[11px] font-semibold text-gold">{badgeImage ? <RankImage path={badgeImage} name={text} /> : <Icon className="h-3 w-3 shrink-0" />}<span className="break-words [overflow-wrap:anywhere]">{label}</span></span>
  );
}
