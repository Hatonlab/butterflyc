import { useState } from "react";
import { useMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function RankImage({ path, name, className }: { path: string; name: string; className?: string }) {
  const { data: url } = useMediaUrl(path);
  const [failed, setFailed] = useState(false);
  return <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden", className)}>
    {url && !failed ? <img key={url} src={url} alt={name} onError={() => setFailed(true)} className="h-full w-full object-contain" /> : <span aria-label={name}>⭐</span>}
  </span>;
}