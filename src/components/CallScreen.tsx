import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Signal } from "lucide-react";
import { useCall } from "@/lib/call";
import { usePeople } from "@/lib/people";
import { formatCallTime } from "@/lib/call-audio";
import { UserAvatar } from "./UserAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const qualityLabel = { excellent: "جودة ممتازة", good: "جودة جيدة", poor: "اتصال ضعيف" } as const;

export function CallScreen() {
  const { call, remoteStream, answer, decline, hangup, toggleMute } = useCall();
  const { data: people } = usePeople();
  const audioRef = useRef<HTMLAudioElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.srcObject = remoteStream;
    if (remoteStream) void a.play().catch(() => undefined);
  }, [remoteStream]);

  useEffect(() => {
    if (call?.phase !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [call?.phase]);

  // Voice-reactive glow around the avatar.
  useEffect(() => {
    if (!remoteStream || !ringsRef.current) return;
    let raf = 0;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaStreamSource(remoteStream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(buf);
        let sum = 0;
        for (const v of buf) sum += v;
        ringsRef.current?.style.setProperty("--lvl", String(Math.min(1, sum / buf.length / 90)));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* visual only */
    }
    return () => {
      cancelAnimationFrame(raf);
      void ctx?.close().catch(() => undefined);
    };
  }, [remoteStream]);

  if (!call) return null;
  const peer = people?.byId.get(call.peerId);
  const name = peer?.username ?? "عضو";
  const status =
    call.phase === "incoming" ? "مكالمة صوتية واردة"
    : call.phase === "outgoing" ? (call.id ? "جاري الرنين..." : "جاري الاتصال...")
    : call.phase === "connecting" ? "جاري توصيل الصوت..."
    : call.phase === "ended" ? call.reason ?? "انتهت المكالمة"
    : call.reconnecting ? "جاري إعادة الاتصال..."
    : formatCallTime((now - (call.startedAt ?? now)) / 1000);

  return (
    <div role="dialog" aria-modal="true" aria-label={`مكالمة مع ${name}`} className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-background/95 px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl animate-page-in">
      <audio ref={audioRef} autoPlay playsInline />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="text-sm text-muted-foreground">🦋 شات فراشات العرب</span>
        {call.phase === "active" && call.quality && (
          <span className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs", call.quality === "poor" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>
            <Signal className="h-3.5 w-3.5" /> {qualityLabel[call.quality]}
          </span>
        )}
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <div ref={ringsRef} className="relative flex h-52 w-52 items-center justify-center" style={{ ["--lvl" as string]: 0 }}>
          {(call.phase === "incoming" || call.phase === "outgoing") && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2s]" />
              <span className="absolute inset-6 animate-ping rounded-full bg-primary/25 [animation-duration:2s] [animation-delay:.5s]" />
            </>
          )}
          {call.phase === "active" && (
            <span className="absolute inset-4 rounded-full bg-primary/30 blur-md transition-transform duration-75" style={{ transform: "scale(calc(1 + var(--lvl) * 0.35))" }} />
          )}
          <UserAvatar src={peer?.avatar_url} name={name} className="relative h-36 w-36 ring-4 ring-primary/50 shadow-glow rounded-full" />
        </div>
        <div className="text-center">
          <h2 className="bidi-plain max-w-[80vw] truncate font-display text-3xl font-bold">{name}</h2>
          <p className={cn("mt-2 text-base tabular-nums", call.phase === "ended" ? "text-destructive" : "text-muted-foreground")} aria-live="polite">{status}</p>
        </div>
      </div>

      <div className="relative flex w-full max-w-xs items-center justify-around">
        {call.phase === "incoming" ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <Button size="icon" onClick={decline} aria-label="رفض" className="h-20 w-20 rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90">
                <PhoneOff className="h-8 w-8" />
              </Button>
              <span className="text-sm">رفض</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button size="icon" onClick={answer} aria-label="رد" className="h-20 w-20 animate-bounce rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
                <Phone className="h-8 w-8" />
              </Button>
              <span className="text-sm">رد</span>
            </div>
          </>
        ) : call.phase === "ended" ? (
          <Button variant="secondary" onClick={hangup} className="h-12 rounded-full px-8">إغلاق</Button>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <Button size="icon" variant="secondary" onClick={toggleMute} aria-label={call.muted ? "إلغاء الكتم" : "كتم"} disabled={call.phase === "outgoing" && !call.id} className={cn("h-16 w-16 rounded-full", call.muted && "bg-foreground text-background")}>
                {call.muted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
              </Button>
              <span className="text-sm">{call.muted ? "مكتوم" : "كتم"}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button size="icon" onClick={hangup} aria-label="إنهاء المكالمة" className="h-20 w-20 rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90">
                <PhoneOff className="h-8 w-8" />
              </Button>
              <span className="text-sm">إنهاء</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
