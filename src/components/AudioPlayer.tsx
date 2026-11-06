import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function AudioPlayer({ src, mine }: { src: string; mine?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const bars = useMemo(() => {
    let seed = src.length * 7;
    return Array.from({ length: 34 }, () => {
      seed = (seed * 9301 + 49297) % 233280;
      return 0.25 + (seed / 233280) * 0.75;
    });
  }, [src]);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => {
      if (isFinite(a.duration)) setDur(a.duration);
      else {
        // webm from MediaRecorder reports Infinity until seeked
        a.currentTime = 1e9;
        a.ontimeupdate = () => {
          a.ontimeupdate = null;
          setDur(a.duration);
          a.currentTime = 0;
        };
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setT(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const a = ref.current!;
    if (playing) a.pause();
    else {
      document.querySelectorAll("audio").forEach((x) => x !== a && x.pause());
      void a.play();
    }
    setPlaying(!playing);
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const p = (r.right - e.clientX) / r.width; // RTL: progress grows from the right
    if (dur) ref.current!.currentTime = Math.min(Math.max(p, 0), 1) * dur;
  }
  function cycleRate() {
    const n = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(n);
    ref.current!.playbackRate = n;
  }
  const p = dur ? t / dur : 0;

  return (
    <div className="flex w-64 max-w-full items-center gap-2.5 py-1">
      <audio ref={ref} src={src} preload="metadata" onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <button
        onClick={toggle}
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90",
          mine ? "bg-primary-foreground text-primary" : "bg-gradient-primary text-primary-foreground shadow-glow",
        )}
        aria-label={playing ? "إيقاف" : "تشغيل"}
      >
        {playing && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-20" />}
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 -translate-x-px fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div onClick={seek} className="flex h-8 cursor-pointer items-center gap-[2px]" role="slider" aria-valuenow={Math.round(p * 100)}>
          {bars.map((h, i) => {
            const on = i / bars.length < p;
            return (
              <span
                key={i}
                className={cn(
                  "flex-1 rounded-full transition-all duration-200",
                  on ? (mine ? "bg-primary-foreground" : "bg-primary") : mine ? "bg-primary-foreground/35" : "bg-foreground/25",
                  playing && on && "animate-pulse",
                )}
                style={{ height: `${h * 100}%` }}
              />
            );
          })}
        </div>
        <div className={cn("flex justify-between text-[10px] tabular-nums", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
          <span>{fmt(playing || t ? t : dur)}</span>
          <button onClick={cycleRate} className="rounded-full bg-background/20 px-1.5 font-bold">
            {rate}x
          </button>
        </div>
      </div>
    </div>
  );
}
