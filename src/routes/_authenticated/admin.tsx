import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight, Ban, DoorOpen, Image as ImageIcon, KeyRound, Lock, MessageSquare, Mail, Plus, Search,
  ShieldCheck, Trash2, Unlock, Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { UserAvatar, RoleBadge } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sectionLabels, useMe, type Me, type Section } from "@/lib/auth";
import { usePeople, type Person } from "@/lib/people";
import { useOnline } from "@/lib/presence";
import { fileToDataUrl, timeAgo } from "@/lib/image";
import { adminDeleteUser, adminResetPassword } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "لوحة التحكم - شات فراشات العرب" }] }),
  component: AdminPage,
});

type Tab = "members" | "rooms" | "messages" | "private";
const tabIcons = { members: Users, rooms: DoorOpen, messages: MessageSquare, private: Mail };

function can(me: Me, s: Section) {
  return me.isAdmin || me.sections.includes(s);
}

function AdminPage() {
  const { data: me } = useMe();
  const online = useOnline(me?.profile.id);
  const { data: people } = usePeople();
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [m, p, r] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true }),
        supabase.from("private_messages").select("id", { count: "exact", head: true }),
        supabase.from("rooms").select("id", { count: "exact", head: true }),
      ]);
      return { msgs: m.count ?? 0, pms: p.count ?? 0, rooms: r.count ?? 0 };
    },
  });

  const allowed = useMemo(
    () => (me ? (["members", "rooms", "messages", "private"] as Tab[]).filter((t) => can(me, t) || (t === "messages" && me.isStaff)) : []),
    [me],
  );
  const [tab, setTab] = useState<Tab | null>(null);
  const current = tab ?? allowed[0];

  if (!me) return null;
  if (!me.isStaff)
    return (
      <AppShell>
        <p className="p-10 text-center text-muted-foreground">ليس لديك صلاحية الوصول للوحة التحكم</p>
      </AppShell>
    );

  return (
    <AppShell
      hideNav
      header={
        <div className="flex items-center gap-3">
          <Link to="/home" className="rounded-full p-1.5 hover:bg-secondary" aria-label="رجوع">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <ShieldCheck className="h-6 w-6 text-gold" />
          <h1 className="font-display text-lg">لوحة التحكم</h1>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            ["الأعضاء", people?.list.length ?? 0],
            ["متصل", online.size],
            ["رسائل", stats?.msgs ?? 0],
            ["خاص", stats?.pms ?? 0],
          ].map(([l, v]) => (
            <div key={l} className="glass rounded-2xl p-3 text-center">
              <div className="text-xl font-bold text-gradient">{v}</div>
              <div className="text-[11px] text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {allowed.map((t) => {
            const Icon = tabIcons[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
                  current === t ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {sectionLabels[t]}
              </button>
            );
          })}
        </div>

        {current === "members" && <MembersTab me={me} people={people?.list ?? []} online={online} />}
        {current === "rooms" && <RoomsTab />}
        {current === "messages" && <MessagesTab me={me} people={people?.byId} />}
        {current === "private" && <PrivateTab people={people?.byId} />}
      </div>
    </AppShell>
  );
}

/* ---------------- Members ---------------- */

function MembersTab({ me, people, online }: { me: Me; people: Person[]; online: Set<string> }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Person | null>(null);
  const list = people.filter((p) => p.username.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} />
      {list.map((p) => (
        <button key={p.id} onClick={() => setSel(p)} className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-right">
          <UserAvatar src={p.avatar_url} name={p.username} online={online.has(p.id)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="bidi-plain truncate font-semibold">{p.username}</span>
              <RoleBadge label={p.badge} />
              {p.banned && <span className="rounded-full bg-destructive/20 px-2 text-[10px] text-destructive">محظور</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              {p.gender} · {p.age} · انضم {new Date(p.created_at).toLocaleDateString("ar")}
            </p>
          </div>
        </button>
      ))}
      {sel && <MemberDialog me={me} person={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function MemberDialog({ me, person, onClose }: { me: Me; person: Person; onClose: () => void }) {
  const qc = useQueryClient();
  const del = useServerFn(adminDeleteUser);
  const reset = useServerFn(adminResetPassword);
  const [pw, setPw] = useState("");
  const isOwnerTarget = person.roles.includes("owner");
  const { data: extra, refetch } = useQuery({
    queryKey: ["member-extra", person.id],
    queryFn: async () => {
      const [s, rm, rooms, roles] = await Promise.all([
        supabase.from("section_permissions").select("section").eq("user_id", person.id),
        supabase.from("room_moderators").select("room_id").eq("user_id", person.id),
        supabase.from("rooms").select("id,name").order("sort"),
        supabase.from("user_roles").select("role").eq("user_id", person.id),
      ]);
      return {
        sections: (s.data ?? []).map((x) => x.section),
        roomMods: (rm.data ?? []).map((x) => x.room_id),
        rooms: rooms.data ?? [],
        roles: (roles.data ?? []).map((x) => x.role),
      };
    },
  });
  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["people"] });
  };
  const run = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) toast.error("تعذر تنفيذ العملية");
    else toast.success(ok);
    refresh();
  };

  const toggleRole = (role: "admin" | "moderator") =>
    extra?.roles.includes(role)
      ? run(supabase.from("user_roles").delete().eq("user_id", person.id).eq("role", role), "تم سحب الصلاحية")
      : run(supabase.from("user_roles").insert({ user_id: person.id, role }), "تم التعيين");
  const toggleSection = (section: Section) =>
    extra?.sections.includes(section)
      ? run(supabase.from("section_permissions").delete().eq("user_id", person.id).eq("section", section), "تم السحب")
      : run(supabase.from("section_permissions").insert({ user_id: person.id, section }), "تم التعيين");
  const toggleRoom = (room_id: string) =>
    extra?.roomMods.includes(room_id)
      ? run(supabase.from("room_moderators").delete().eq("user_id", person.id).eq("room_id", room_id), "تم السحب")
      : run(supabase.from("room_moderators").insert({ user_id: person.id, room_id }), "تم تعيين مشرف الغرفة");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserAvatar src={person.avatar_url} name={person.username} />
            <span className="bidi-plain">{person.username}</span>
          </DialogTitle>
        </DialogHeader>
        {isOwnerTarget ? (
          <p className="text-sm text-muted-foreground">هذا حساب مالك التطبيق ولديه جميع الصلاحيات.</p>
        ) : (
          <div className="space-y-5 text-sm">
            {can(me, "members") && (
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn
                  icon={person.banned ? Unlock : Ban}
                  danger={!person.banned}
                  onClick={() =>
                    run(
                      supabase.from("profiles").update({ banned: !person.banned }).eq("id", person.id),
                      person.banned ? "تم فك الحظر" : "تم الحظر",
                    ).then(onClose)
                  }
                >
                  {person.banned ? "فك الحظر" : "حظر العضو"}
                </ActionBtn>
                <ActionBtn
                  icon={Trash2}
                  danger
                  onClick={() => run(supabase.from("messages").delete().eq("user_id", person.id), "تم حذف رسائله")}
                >
                  حذف رسائله
                </ActionBtn>
              </div>
            )}

            {me.isAdmin && (
              <Group title="الرتبة العامة">
                {me.isOwner && (
                  <Chip active={!!extra?.roles.includes("admin")} onClick={() => toggleRole("admin")}>
                    مدير التطبيق (كل الصلاحيات)
                  </Chip>
                )}
                <Chip active={!!extra?.roles.includes("moderator")} onClick={() => toggleRole("moderator")}>
                  مشرف عام لكل الغرف
                </Chip>
              </Group>
            )}

            {me.isAdmin && (
              <Group title="مشرف قسم محدد في لوحة التحكم">
                {(Object.keys(sectionLabels) as Section[]).map((s) => (
                  <Chip key={s} active={!!extra?.sections.includes(s)} onClick={() => toggleSection(s)}>
                    {sectionLabels[s]}
                  </Chip>
                ))}
              </Group>
            )}

            {can(me, "rooms") && (
              <Group title="مشرف غرفة">
                {extra?.rooms.map((r) => (
                  <Chip key={r.id} active={extra.roomMods.includes(r.id)} onClick={() => toggleRoom(r.id)}>
                    {r.name}
                  </Chip>
                ))}
              </Group>
            )}

            {can(me, "members") && (
              <>
                <Group title="تعيين كلمة سر جديدة">
                  <div className="flex w-full gap-2">
                    <input
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder="كلمة السر الجديدة"
                      className="h-10 flex-1 rounded-lg border border-input bg-secondary px-3 outline-none"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await reset({ data: { userId: person.id, password: pw } });
                          toast.success("تم تغيير كلمة السر");
                          setPw("");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg bg-secondary px-3"
                    >
                      <KeyRound className="h-4 w-4" /> حفظ
                    </button>
                  </div>
                </Group>
                <ActionBtn
                  icon={Trash2}
                  danger
                  onClick={async () => {
                    if (!confirm("حذف الحساب نهائياً؟")) return;
                    try {
                      await del({ data: { userId: person.id } });
                      toast.success("تم حذف الحساب");
                      qc.invalidateQueries({ queryKey: ["people"] });
                      onClose();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  حذف الحساب نهائياً
                </ActionBtn>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Rooms ---------------- */

function RoomsTab() {
  const qc = useQueryClient();
  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await supabase.from("rooms").select("*").order("sort")).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["rooms"] });
  return (
    <div className="space-y-3">
      <button
        onClick={async () => {
          const { error } = await supabase
            .from("rooms")
            .insert({ name: "غرفة جديدة", description: "وصف الغرفة", image_url: "/rooms/general.svg", sort: rooms.length + 1 });
          if (error) toast.error("تعذر الإضافة");
          refresh();
        }}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 text-primary"
      >
        <Plus className="h-4 w-4" /> إضافة غرفة
      </button>
      {rooms.map((r) => (
        <RoomEditor key={r.id} room={r} onChange={refresh} />
      ))}
    </div>
  );
}

function RoomEditor({
  room,
  onChange,
}: {
  room: { id: string; name: string; description: string; image_url: string | null; locked: boolean; sort: number };
  onChange: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [desc, setDesc] = useState(room.description);
  const fileRef = useRef<HTMLInputElement>(null);
  const update = async (patch: Record<string, unknown>, ok = "تم الحفظ") => {
    const { error } = await supabase.from("rooms").update(patch).eq("id", room.id);
    if (error) toast.error("تعذر الحفظ");
    else toast.success(ok);
    onChange();
  };
  return (
    <div className="glass space-y-3 rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <button onClick={() => fileRef.current?.click()} className="relative shrink-0">
          <img src={room.image_url || "/rooms/general.svg"} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <ImageIcon className="absolute bottom-0 left-0 h-5 w-5 rounded bg-background/80 p-0.5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) update({ image_url: await fileToDataUrl(f, 200) }, "تم تغيير الصورة");
          }}
        />
        <div className="flex-1 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="bidi-plain h-9 w-full rounded-lg bg-secondary px-3 outline-none" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} className="bidi-plain h-9 w-full rounded-lg bg-secondary px-3 text-sm outline-none" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button onClick={() => update({ name, description: desc })} className="rounded-lg bg-gradient-primary px-3 py-2 font-semibold text-primary-foreground">
          حفظ
        </button>
        <button onClick={() => update({ locked: !room.locked }, room.locked ? "تم فتح الغرفة" : "تم قفل الغرفة")} className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2">
          {room.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {room.locked ? "فتح الغرفة" : "قفل الغرفة"}
        </button>
        <button
          onClick={async () => {
            await supabase.from("messages").delete().eq("room_id", room.id);
            toast.success("تم مسح رسائل الغرفة");
          }}
          className="rounded-lg bg-secondary px-3 py-2"
        >
          مسح الرسائل
        </button>
        <button
          onClick={async () => {
            if (!confirm("حذف الغرفة نهائياً؟")) return;
            await supabase.from("rooms").delete().eq("id", room.id);
            onChange();
          }}
          className="rounded-lg bg-destructive/15 px-3 py-2 text-destructive"
        >
          حذف الغرفة
        </button>
      </div>
    </div>
  );
}

/* ---------------- Messages ---------------- */

function MessagesTab({ me, people }: { me: Me; people?: Map<string, Person> }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-msgs"],
    queryFn: async () => {
      const [m, r] = await Promise.all([
        supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("rooms").select("id,name"),
      ]);
      return { msgs: m.data ?? [], rooms: new Map((r.data ?? []).map((x) => [x.id, x.name])) };
    },
  });
  const canAll = can(me, "messages") || me.roles.includes("moderator");
  const msgs = (data?.msgs ?? [])
    .filter((m) => canAll || me.roomMods.includes(m.room_id))
    .filter((m) => !q || m.content.includes(q) || people?.get(m.user_id)?.username.includes(q));
  return (
    <div className="space-y-2">
      <SearchBox value={q} onChange={setQ} />
      {msgs.map((m) => (
        <MsgRow
          key={m.id}
          who={people?.get(m.user_id)}
          meta={`${data?.rooms.get(m.room_id) ?? ""} · ${timeAgo(m.created_at)}`}
          content={m.content}
          onDelete={async () => {
            await supabase.from("messages").delete().eq("id", m.id);
            qc.invalidateQueries({ queryKey: ["admin-msgs"] });
          }}
        />
      ))}
    </div>
  );
}

function PrivateTab({ people }: { people?: Map<string, Person> }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["admin-pms"],
    queryFn: async () =>
      (await supabase.from("private_messages").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });
  const list = data.filter(
    (m) =>
      !q ||
      m.content.includes(q) ||
      people?.get(m.sender_id)?.username.includes(q) ||
      people?.get(m.receiver_id)?.username.includes(q),
  );
  return (
    <div className="space-y-2">
      <SearchBox value={q} onChange={setQ} />
      {list.map((m) => (
        <MsgRow
          key={m.id}
          who={people?.get(m.sender_id)}
          meta={`إلى ${people?.get(m.receiver_id)?.username ?? "؟"} · ${timeAgo(m.created_at)}`}
          content={m.content}
          onDelete={async () => {
            await supabase.from("private_messages").delete().eq("id", m.id);
            qc.invalidateQueries({ queryKey: ["admin-pms"] });
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- UI bits ---------------- */

function MsgRow({ who, meta, content, onDelete }: { who?: Person; meta: string; content: string; onDelete: () => void }) {
  return (
    <div className="glass flex items-start gap-3 rounded-2xl p-3">
      <UserAvatar src={who?.avatar_url} name={who?.username ?? "?"} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs">
          <span className="bidi-plain font-semibold">{who?.username ?? "محذوف"}</span>
          <span className="bidi-plain text-muted-foreground">{meta}</span>
        </div>
        <p className="bidi-plain mt-1 break-words text-sm">{content}</p>
      </div>
      <button onClick={onDelete} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label="حذف">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="بحث"
        className="h-11 w-full rounded-xl border border-input bg-secondary pr-10 pl-4 outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{title}</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs transition",
        active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
      )}
    >
      {active ? "✓ " : ""}
      {children}
    </button>
  );
}

function ActionBtn({
  icon: Icon,
  danger,
  onClick,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold",
        danger ? "bg-destructive/15 text-destructive" : "bg-secondary",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
