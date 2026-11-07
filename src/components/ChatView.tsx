import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Paperclip, SendHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar, RoleBadge, LevelBadge } from "./UserAvatar";
import { AudioPlayer } from "./AudioPlayer";
import { timeAgo } from "@/lib/image";
import { uploadMedia, useMediaUrl, type MediaType } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ChatMsg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  author?: { username: string; avatar_url: string | null; badge?: string | null; xp?: number };
};

export type SendPayload = { content: string; media_url?: string | null; media_type?: string | null };

function MediaBlock({ m, mine }: { m: ChatMsg; mine: boolean }) {
  const { data: url, isError, refetch } = useMediaUrl(m.media_url);
  if (!m.media_url) return null;
  if (isError) return <Button type="button" variant="ghost" onClick={() => void refetch()} className="h-auto whitespace-normal text-xs">تعذر تحميل المرفق · إعادة المحاولة</Button>;
  if (!url)
    return <div className="flex h-40 w-56 max-w-full animate-pulse items-center justify-center rounded-xl bg-background/30"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (m.media_type === "image")
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="صورة مرفقة" loading="lazy" className="max-h-72 w-auto max-w-full rounded-xl object-contain" />
      </a>
    );
  if (m.media_type === "video")
    return <video src={url} controls playsInline preload="metadata" className="max-h-72 max-w-full rounded-xl" />;
  return <AudioPlayer src={url} mine={mine} />;
}

export function ChatView({
  messages,
  meId,
  onSend,
  canDelete,
  onDelete,
  onAvatarClick,
  disabled,
  disabledText,
  showAuthors = true,
  readOnly,
}: {
  messages: ChatMsg[];
  meId: string;
  onSend: (p: SendPayload) => Promise<void>;
  canDelete: (m: ChatMsg) => boolean;
  onDelete: (m: ChatMsg) => void;
  onAvatarClick?: (userId: string) => void;
  disabled?: boolean;
  disabledText?: string;
  showAuthors?: boolean;
  readOnly?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<{ mr: MediaRecorder; chunks: Blob[]; cancel: boolean; timer: number } | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  useEffect(() => () => {
    const state = recRef.current;
    if (state) {
      state.cancel = true;
      clearInterval(state.timer);
      if (state.mr.state !== "inactive") state.mr.stop();
    }
  }, []);

  async function send(p: SendPayload) {
    setSending(true);
    try {
      await onSend(p);
    } finally {
      setSending(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    try {
      await send({ content: t });
      setText("");
    } catch { /* The sending page displays the error; keep the draft. */ }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || sending || disabled || recording) return;
    const type: MediaType | null = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : null;
    if (!type) { toast.error("يمكن مشاركة الصور والفيديو فقط"); return; }
    if (f.size > 50 * 1024 * 1024) { toast.error("الحد الأقصى 50 ميغابايت"); return; }
    setSending(true);
    try {
      const ext = f.name.split(".").pop() || (type === "image" ? "jpg" : "mp4");
      const media = await uploadMedia(meId, f, type, ext);
      await onSend({ content: text.trim(), ...media });
      setText("");
    } catch {
      toast.error("تعذر رفع الملف");
    } finally {
      setSending(false);
    }
  }

  async function startRec() {
    if (sending || disabled || recRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      const state = { mr, chunks: [] as Blob[], cancel: false, timer: 0 };
      mr.ondataavailable = (ev) => ev.data.size && state.chunks.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(state.timer);
        setRecording(false);
        if (state.cancel || !state.chunks.length) return;
        const blob = new Blob(state.chunks, { type: mime });
        if (blob.size < 1500) return;
        setSending(true);
        try {
          const media = await uploadMedia(meId, blob, "audio", mime === "audio/webm" ? "webm" : "m4a");
          await onSend({ content: "", ...media });
        } catch {
          toast.error("تعذر إرسال التسجيل");
        } finally {
          setSending(false);
        }
      };
      mr.start();
      setRecTime(0);
      state.timer = window.setInterval(() => setRecTime((s) => s + 1), 1000);
      recRef.current = state;
      setRecording(true);
    } catch {
      toast.error("يرجى السماح بالوصول إلى الميكروفون");
    }
  }
  function stopRec(cancel: boolean) {
    const r = recRef.current;
    if (!r) return;
    r.cancel = cancel;
    if (r.mr.state !== "inactive") r.mr.stop();
    recRef.current = null;
  }

  const hasText = text.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
            <span className="animate-floaty text-5xl">🦋</span>
            لا توجد رسائل بعد، كن أول من يكتب ✨
          </div>
        )}
        {messages.map((m) => {
          const mine = m.user_id === meId;
          const onlyMedia = !!m.media_url && !m.content;
          return (
            <div
              key={m.id}
              className={cn("animate-msg-in group flex items-end gap-2", mine ? "flex-row-reverse origin-bottom-left" : "origin-bottom-right")}
            >
              {showAuthors && !mine && (
                <Button variant="ghost" size="icon" onClick={() => onAvatarClick?.(m.user_id)} aria-label="الملف والهدايا" className="h-9 w-9 shrink-0 rounded-full p-0">
                  <UserAvatar src={m.author?.avatar_url} name={m.author?.username ?? "?"} className="h-9 w-9" />
                </Button>
              )}
              <div className={cn("min-w-0 max-w-[calc(100%-3rem)] sm:max-w-[78%]", mine && "items-end")}>
                {showAuthors && !mine && (
                  <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5 px-1 text-xs text-muted-foreground">
                    <span className="bidi-plain min-w-0 break-all font-semibold text-foreground/85">{m.author?.username}</span>
                    {m.author?.xp !== undefined && <LevelBadge xp={m.author.xp} />}
                    <RoleBadge label={m.author?.badge ?? null} />
                  </div>
                )}
                <div
                  className={cn(
                    "bidi-plain min-w-0 space-y-1.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl text-[15px] leading-relaxed",
                    onlyMedia && m.media_type !== "audio" ? "p-1" : "px-3.5 py-2",
                    mine
                      ? "rounded-bl-md bg-gradient-primary text-primary-foreground shadow-glow"
                      : "rounded-br-md border border-border bg-bubble-other",
                  )}
                >
                  <MediaBlock m={m} mine={mine} />
                  {m.content && <div>{m.content}</div>}
                </div>
                <div className={cn("mt-0.5 flex items-center gap-2 px-1 text-[10px] text-muted-foreground", mine && "flex-row-reverse")}>
                  {timeAgo(m.created_at)}
                  {canDelete(m) && (
                    <Button variant="ghost" size="icon"
                      onClick={() => onDelete(m)}
                      className="h-6 w-6 p-0 opacity-0 transition group-hover:opacity-60 hover:text-destructive hover:!opacity-100 max-md:opacity-60"
                      aria-label="حذف"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {!readOnly && (
      <form onSubmit={submit} className="glass relative grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-x-0 border-b-0 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={onFile} />
        {recording ? (
          <div className="flex h-11 min-w-0 items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3">
            <span className="relative flex h-3 w-3">
              <span className="relative h-3 w-3 rounded-full bg-destructive" />
            </span>
            <span className="tabular-nums text-sm">
              {Math.floor(recTime / 60)}:{String(recTime % 60).padStart(2, "0")}
            </span>
            <div className="flex h-5 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
              {Array.from({ length: 18 }).map((_, i) => (
                <span key={i} className="animate-eq w-1 rounded-full bg-destructive/70" style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
            <Button variant="ghost" size="icon" type="button" onClick={() => stopRec(true)} aria-label="إلغاء" className="h-8 w-8 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            <Button variant="secondary" size="icon"
              type="button"
              disabled={disabled || sending}
              onClick={() => fileRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition hover:text-primary active:scale-90 disabled:opacity-40"
              aria-label="إرفاق صورة أو فيديو"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
               disabled={disabled || sending}
              maxLength={2000}
              placeholder={disabled ? disabledText : "اكتب رسالتك... تدعم الزخرفة 🦋"}
              className="h-11 min-w-0 flex-1 rounded-full border border-input bg-secondary px-4 text-[15px] outline-none transition focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        <Button size="icon"
          type={!recording && hasText ? "submit" : "button"}
          disabled={disabled || sending}
          onClick={recording ? () => stopRec(false) : hasText ? undefined : () => void startRec()}
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-40",
          )}
          aria-label={hasText || recording ? "إرسال" : "تسجيل صوت"}
        >
          <span className="flex items-center justify-center">
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : hasText || recording ? (
              <SendHorizontal className="h-5 w-5 rotate-180" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </span>
        </Button>
      </form>
      )}
    </div>
  );
}
