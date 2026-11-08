import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { UserAvatar, RoleBadge } from "@/components/UserAvatar";
import { meQueryKey, roleLabel, useMe } from "@/lib/auth";
import { fileToDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import { usePeople } from "@/lib/people";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "ملفي الشخصي - شات فراشات العرب" }, { name: "description", content: "صورتك وحالتك وإعدادات حسابك في شات فراشات العرب." }, { property: "og:title", content: "ملفي الشخصي - شات فراشات العرب" }, { property: "og:description", content: "الملف الشخصي وإعدادات حسابك." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ProfilePage,
});

const field =
  "h-12 w-full rounded-xl border border-input bg-secondary/70 px-4 outline-none focus:ring-2 focus:ring-ring";

function ProfilePage() {
  const { data: me } = useMe();
  const { data: people } = usePeople();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [gender, setGender] = useState("ذكر");
  const [age, setAge] = useState("18");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [oldPw, setOldPw] = useState("");

  useEffect(() => {
    if (!me) return;
    setStatus(me.profile.status);
    setGender(me.profile.gender);
    setAge(String(me.profile.age));
    setAvatar(me.profile.avatar_url);
  }, [me]);

  if (!me) return <AppShell>{null}</AppShell>;

  async function save(): Promise<void> {
    if (!me) return;
    const { error } = await supabase
      .from("profiles")
      .update({ status: status.trim(), gender, age: parseInt(age, 10) || 18, avatar_url: avatar })
      .eq("id", me.profile.id);
    if (error) { toast.error("تعذر الحفظ"); return; }
    toast.success("تم حفظ الملف الشخصي");
    qc.invalidateQueries({ queryKey: meQueryKey });
    qc.invalidateQueries({ queryKey: ["people"] });
  }

  async function changePw(): Promise<unknown> {
    if (pw.length < 6) return toast.error("كلمة السر 6 أحرف على الأقل");
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: oldPw } as never);
    if (error) return toast.error("تعذر تغيير كلمة السر، تأكد من كلمة السر الحالية");
    setPw("");
    setOldPw("");
    return toast.success("تم تغيير كلمة السر");
  }

  return (
    <AppShell>
      <div className="space-y-5 p-4">
        <div className="glass flex flex-col items-center rounded-3xl p-6 text-center">
          <button onClick={() => fileRef.current?.click()} className="relative">
            <UserAvatar src={avatar} name={me.profile.username} className="h-28 w-28" />
            <span className="absolute bottom-1 left-1 rounded-full bg-gradient-primary p-2 text-primary-foreground shadow-glow">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setAvatar(await fileToDataUrl(f));
            }}
          />
          <h2 className="bidi-plain mt-3 font-display text-2xl">{me.profile.username}</h2>
          <div className="mt-1">
            <RoleBadge label={people?.byId.get(me.profile.id)?.badge ?? roleLabel(me.roles)} />
          </div>
        </div>

        <div className="glass space-y-3 rounded-3xl p-4">
          <label className="text-sm text-muted-foreground">الحالة</label>
          <input className={cn(field, "bidi-plain")} value={status} maxLength={120} onChange={(e) => setStatus(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div className="grid grid-cols-2 rounded-xl bg-secondary p-1">
              {["ذكر", "أنثى"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={cn("rounded-lg py-2 text-sm", gender === g ? "bg-accent ring-1 ring-primary" : "text-muted-foreground")}
                >
                  {g}
                </button>
              ))}
            </div>
            <input className={field} type="number" min={10} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <button
            onClick={save}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary font-semibold text-primary-foreground shadow-glow"
          >
            <Save className="h-4 w-4" /> حفظ
          </button>
        </div>

        <div className="glass space-y-3 rounded-3xl p-4">
          <h3 className="font-semibold">تغيير كلمة السر</h3>
          <input className={field} type="password" placeholder="كلمة السر الحالية" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
          <input className={field} type="password" placeholder="كلمة السر الجديدة" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button onClick={changePw} className="h-11 w-full rounded-xl bg-secondary font-semibold">
            تغيير
          </button>
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 text-destructive"
        >
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>
    </AppShell>
  );
}
