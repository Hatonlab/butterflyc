import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { UserAvatar, RoleBadge } from "./UserAvatar";
import { timeAgo } from "@/lib/image";
import { cn } from "@/lib/utils";

export type ChatMsg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: { username: string; avatar_url: string | null; badge?: string | null };
};

export function ChatView({
  messages,
  meId,
  onSend,
  canDelete,
  onDelete,
  disabled,
  disabledText,
  showAuthors = true,
}: {
  messages: ChatMsg[];
  meId: string;
  onSend: (text: string) => Promise<void>;
  canDelete: (m: ChatMsg) => boolean;
  onDelete: (m: ChatMsg) => void;
  disabled?: boolean;
  disabledText?: string;
  showAuthors?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onSend(t);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">لا توجد رسائل بعد، كن أول من يكتب ✨</p>
        )}
        {messages.map((m) => {
          const mine = m.user_id === meId;
          return (
            <div key={m.id} className={cn("group flex items-end gap-2", mine && "flex-row-reverse")}>
              {showAuthors && !mine && (
                <Link to="/private/$userId" params={{ userId: m.user_id }}>
                  <UserAvatar src={m.author?.avatar_url} name={m.author?.username ?? "?"} className="h-8 w-8" />
                </Link>
              )}
              <div className={cn("max-w-[78%]", mine && "items-end")}>
                {showAuthors && !mine && (
                  <div className="mb-1 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                    <span className="bidi-plain font-semibold text-foreground/85">{m.author?.username}</span>
                    <RoleBadge label={m.author?.badge ?? null} />
                  </div>
                )}
                <div
                  className={cn(
                    "bidi-plain whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
                    mine
                      ? "rounded-bl-md bg-gradient-primary text-primary-foreground shadow-glow"
                      : "rounded-br-md bg-bubble-other",
                  )}
                >
                  {m.content}
                </div>
                <div className={cn("mt-0.5 flex items-center gap-2 px-1 text-[10px] text-muted-foreground", mine && "flex-row-reverse")}>
                  {timeAgo(m.created_at)}
                  {canDelete(m) && (
                    <button
                      onClick={() => onDelete(m)}
                      className="opacity-60 transition hover:text-destructive hover:opacity-100"
                      aria-label="حذف"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="glass flex shrink-0 items-center gap-2 border-x-0 border-b-0 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={2000}
          placeholder={disabled ? disabledText : "اكتب رسالتك... تدعم الزخرفة 🦋"}
          className="h-11 flex-1 rounded-full border border-input bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          disabled={disabled || sending || !text.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition disabled:opacity-40"
          aria-label="إرسال"
        >
          <SendHorizontal className="h-5 w-5 rotate-180" />
        </button>
      </form>
    </div>
  );
}
