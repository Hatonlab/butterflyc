import { cn } from "@/lib/utils";
import { levelFromXp } from "@/lib/gifts";

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

export function RoleBadge({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">{label}</span>
  );
}
