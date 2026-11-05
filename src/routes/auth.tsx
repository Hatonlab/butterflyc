import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeUsername, usernameToEmail } from "@/lib/auth";
import { fileToDataUrl } from "@/lib/image";
import { ButterflyMark } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "الدخول والتسجيل - شات فراشات العرب" },
      { name: "description", content: "سجّل باسمك وكلمة السر فقط وادخل غرف شات فراشات العرب." },
      { property: "og:title", content: "الدخول - شات فراشات العرب" },
      { property: "og:description", content: "تسجيل سريع بالاسم وكلمة السر فقط" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const field =
  "h-12 w-full rounded-xl border border-input bg-secondary/70 px-4 text-[15px] outline-none transition focus:ring-2 focus:ring-ring";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("");
  const [gender, setGender] = useState("ذكر");
  const [age, setAge] = useState("20");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = normalizeUsername(username);
    if (Array.from(name).length < 2) return toast.error("الاسم قصير جداً");
    if (password.length < 6) return toast.error("كلمة السر 6 أحرف على الأقل");
    setBusy(true);
    try {
      const email = await usernameToEmail(name);
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("الاسم أو كلمة السر غير صحيحة");
      } else {
        const ageN = parseInt(age, 10);
        if (!avatar) throw new Error("اختر صورة المستخدم");
        if (!(ageN >= 10 && ageN <= 99)) throw new Error("العمر غير صالح");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: name, status: status.trim(), gender, age: ageN } },
        });
        if (error) {
          if (/registered|exists/i.test(error.message)) throw new Error("هذا الاسم مستخدم، اختر اسماً آخر");
          if (/duplicate|unique|Database error/i.test(error.message)) throw new Error("هذا الاسم مستخدم، اختر اسماً آخر");
          throw new Error("تعذر إنشاء الحساب، حاول مجدداً");
        }
        if (data.user) await supabase.from("profiles").update({ avatar_url: avatar }).eq("id", data.user.id);
      }
      navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <ButterflyMark className="h-24 w-24 animate-floaty" animated />
          <h1 className="mt-3 font-display text-4xl text-gradient">شات فراشات العرب</h1>
          <p className="mt-2 text-sm text-muted-foreground">دردشة عربية راقية تجمع الفراشات من كل مكان</p>
        </div>

        <div className="glass rounded-3xl p-5 shadow-glow">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-secondary p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-lg py-2 text-sm font-semibold transition",
                  mode === m ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {m === "login" ? "دخول" : "تسجيل جديد"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div className="flex justify-center pb-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed border-primary/60 bg-secondary"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Camera className="h-6 w-6 text-primary" />
                      صورتك
                    </span>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setAvatar(await fileToDataUrl(f).catch(() => null));
                  }}
                />
              </div>
            )}
            <input
              className={cn(field, "bidi-plain")}
              placeholder="اسم المستخدم (يدعم الزخرفة ✿)"
              value={username}
              maxLength={40}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <div className="relative">
              <input
                className={field}
                type={show ? "text" : "password"}
                placeholder="كلمة السر"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {mode === "signup" && (
              <>
                <input
                  className={cn(field, "bidi-plain")}
                  placeholder="الحالة (مثال: ﮩ٨ـﮩﮩ٨ـ مـزاجـي رايـق)"
                  value={status}
                  maxLength={120}
                  onChange={(e) => setStatus(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid grid-cols-2 rounded-xl bg-secondary p-1">
                    {["ذكر", "أنثى"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={cn(
                          "rounded-lg py-2 text-sm transition",
                          gender === g ? "bg-accent text-foreground ring-1 ring-primary" : "text-muted-foreground",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <input
                    className={field}
                    type="number"
                    min={10}
                    max={99}
                    placeholder="العمر"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
              </>
            )}
            <button
              disabled={busy}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-primary font-semibold text-primary-foreground shadow-glow transition active:scale-[.98] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "login" ? "دخول" : "إنشاء الحساب"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">لا نطلب بريداً إلكترونياً أو رقم هاتف أبداً 🦋</p>
      </div>
    </div>
  );
}
