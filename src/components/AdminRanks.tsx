import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2, Award } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { canAssignRank } from "@/lib/chat-presentation";
import type { Me } from "@/lib/auth";
import type { Person } from "@/lib/people";
import type { Database } from "@/integrations/supabase/types";

type Rank = Database["public"]["Tables"]["chat_ranks"]["Row"];

function useRanks() {
  return useQuery({ queryKey: ["chat-ranks"], queryFn: async () => {
    const { data, error } = await supabase.from("chat_ranks").select("*").order("position");
    if (error) throw error;
    return data;
  } });
}

export function RankManager() {
  const { data: ranks = [] } = useRanks();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    const { error } = await supabase.from("chat_ranks").insert({ name: "رتبة جديدة", badge: "⭐", position: (ranks.at(-1)?.position ?? 0) + 1 });
    setBusy(false);
    if (error) toast.error("تعذر إضافة الرتبة");
    else void qc.invalidateQueries({ queryKey: ["chat-ranks"] });
  }
  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-display text-lg"><Award className="h-5 w-5 text-gold" />الرتب والشارات</h2><Button variant="secondary" size="sm" onClick={() => void add()} disabled={busy}><Plus className="h-4 w-4" />إضافة</Button></div>
    {ranks.map((rank) => <RankEditor key={rank.id} rank={rank} />)}
  </section>;
}

function RankEditor({ rank }: { rank: Rank }) {
  const qc = useQueryClient();
  const [name, setName] = useState(rank.name);
  const [badge, setBadge] = useState(rank.badge);
  const [position, setPosition] = useState(rank.position);
  const [busy, setBusy] = useState(false);
  async function save(remove = false) {
    if (remove && !window.confirm(`حذف رتبة ${rank.name} وشاراتها من الأعضاء؟`)) return;
    setBusy(true);
    const { error } = await (remove ? supabase.from("chat_ranks").delete().eq("id", rank.id) : supabase.from("chat_ranks").update({ name: name.trim(), badge: badge.trim(), position }).eq("id", rank.id));
    setBusy(false);
    if (error) toast.error("تعذر حفظ الرتبة");
    else { toast.success(remove ? "تم حذف الرتبة" : "تم حفظ الرتبة"); void qc.invalidateQueries({ queryKey: ["chat-ranks"] }); void qc.invalidateQueries({ queryKey: ["people"] }); }
  }
  return <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2 rounded-lg border border-border bg-card p-3">
    <input aria-label="شارة الرتبة" value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={16} className="h-11 min-w-0 rounded-lg bg-secondary text-center text-xl" />
    <input aria-label="اسم الرتبة" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11 min-w-0 rounded-lg bg-secondary px-3" />
    <input aria-label="مستوى الرتبة" type="number" min={1} value={position} onChange={(e) => setPosition(Math.max(1, Number(e.target.value) || 1))} className="h-11 min-w-0 rounded-lg bg-secondary text-center" />
    <div className="col-span-3 flex justify-end gap-2"><Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(true)} aria-label="حذف الرتبة" title="حذف الرتبة"><Trash2 className="h-4 w-4 text-destructive" /></Button><Button size="sm" variant="secondary" disabled={busy || !name.trim() || !badge.trim()} onClick={() => void save()}><Save className="h-4 w-4" />حفظ</Button></div>
  </div>;
}

export function MemberRankPicker({ me, person }: { me: Me; person: Person }) {
  const { data: ranks = [] } = useRanks();
  const qc = useQueryClient();
  const key = ["member-rank", person.id];
  const { data: assignment } = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await supabase.from("member_ranks").select("rank_id").eq("user_id", person.id).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const [busy, setBusy] = useState(false);
  const allowed = canAssignRank(me.isAdmin, me.isOwner, person.roles.includes("owner"));
  async function assign(rankId: string) {
    if (!allowed) return;
    setBusy(true);
    const { error } = await (rankId ? supabase.from("member_ranks").upsert({ user_id: person.id, rank_id: rankId }) : supabase.from("member_ranks").delete().eq("user_id", person.id));
    setBusy(false);
    if (error) toast.error("تعذر تغيير الرتبة");
    else { toast.success("تم تحديث الرتبة"); void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ["people"] }); }
  }
  if (!allowed) return null;
  return <div className="space-y-2"><label htmlFor="member-rank" className="text-sm font-semibold">الرتبة والشارة</label><select id="member-rank" aria-label="الرتبة والشارة" disabled={busy} value={assignment?.rank_id ?? ""} onChange={(e) => void assign(e.target.value)} className="h-12 w-full rounded-lg border border-input bg-secondary px-3"><option value="">بدون رتبة إضافية</option>{ranks.map((rank) => <option key={rank.id} value={rank.id}>{rank.badge} {rank.name} · {rank.position}</option>)}</select></div>;
}