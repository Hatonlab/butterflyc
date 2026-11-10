import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { CallScreen } from "@/components/CallScreen";
import { END_REASONS, ICE_SERVERS, MIC_CONSTRAINTS, RING_TIMEOUT_MS, isRingStale, qualityFromStats, tuneOpus, type CallQuality } from "./call-audio";
import { createRingtone, playCue } from "./ringtone";

export type CallPhase = "outgoing" | "incoming" | "connecting" | "active" | "ended";
export type CallUi = {
  id: string | null;
  peerId: string;
  phase: CallPhase;
  muted: boolean;
  startedAt: number | null;
  reason?: string;
  quality: CallQuality | null;
  reconnecting: boolean;
};

type CallRow = { id: string; caller_id: string; callee_id: string; status: string; offer: string; answer: string | null; created_at: string };

type Ctx = {
  call: CallUi | null;
  remoteStream: MediaStream | null;
  startCall: (peerId: string) => void;
  answer: () => void;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
};

const CallContext = createContext<Ctx | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

function waitForIce(pc: RTCPeerConnection, ms = 2500) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(t);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    const t = setTimeout(done, ms);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

async function tuneSender(pc: RTCPeerConnection) {
  for (const s of pc.getSenders()) {
    if (s.track?.kind !== "audio") continue;
    try {
      const p = s.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = 64_000;
      (p.encodings[0] as RTCRtpEncodingParameters & { priority?: string; networkPriority?: string }).priority = "high";
      (p.encodings[0] as RTCRtpEncodingParameters & { networkPriority?: string }).networkPriority = "high";
      await s.setParameters(p);
    } catch {
      /* Browser keeps its defaults. */
    }
  }
}

function micError(e: unknown) {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "يرجى السماح بالوصول إلى الميكروفون لإجراء المكالمة";
  if (name === "NotFoundError") return "لم يتم العثور على ميكروفون في جهازك";
  if (name === "NotReadableError") return "الميكروفون مستخدم في تطبيق آخر";
  return "تعذر تشغيل الميكروفون";
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const myId = me?.profile.id;
  const [call, setCallState] = useState<CallUi | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const callRef = useRef<CallUi | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const ringRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  const offerRef = useRef<string | null>(null);
  const answeredHereRef = useRef<string | null>(null);
  const timersRef = useRef<{ ring?: number; drop?: number; stats?: number; clear?: number }>({});
  const statsPrev = useRef({ lost: 0, recv: 0 });

  const setCall = useCallback((next: CallUi | null | ((c: CallUi | null) => CallUi | null)) => {
    const value = typeof next === "function" ? next(callRef.current) : next;
    callRef.current = value;
    setCallState(value);
  }, []);

  const stopRing = useCallback(() => {
    ringRef.current?.stop();
    ringRef.current = null;
  }, []);

  const ring = useCallback((kind: "incoming" | "outgoing") => {
    stopRing();
    ringRef.current = createRingtone(kind);
    ringRef.current.start();
  }, [stopRing]);

  const teardown = useCallback(() => {
    stopRing();
    const t = timersRef.current;
    clearTimeout(t.ring);
    clearTimeout(t.drop);
    clearInterval(t.stats);
    timersRef.current = { clear: t.clear };
    localRef.current?.getTracks().forEach((tr) => tr.stop());
    localRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    offerRef.current = null;
    setRemoteStream(null);
  }, [stopRing]);

  /** End the current call locally; optionally record the final status for the other side. */
  const finish = useCallback(
    (reason: keyof typeof END_REASONS | "elsewhere", status?: "declined" | "busy" | "missed" | "cancelled" | "ended") => {
      const c = callRef.current;
      if (!c || c.phase === "ended") return;
      if (status && c.id) void supabase.from("calls").update({ status }).eq("id", c.id).then(() => undefined);
      const hadAudio = !!pcRef.current;
      teardown();
      if (hadAudio || c.phase === "active") playCue("end");
      setCall({ ...c, phase: "ended", reconnecting: false, reason: reason === "elsewhere" ? "تم الرد من جهاز آخر" : END_REASONS[reason] });
      clearTimeout(timersRef.current.clear);
      timersRef.current.clear = window.setTimeout(() => {
        if (callRef.current?.phase === "ended") setCall(null);
      }, 2200);
    },
    [setCall, teardown],
  );

  const startStats = useCallback(() => {
    clearInterval(timersRef.current.stats);
    statsPrev.current = { lost: 0, recv: 0 };
    timersRef.current.stats = window.setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rtt: number | null = null;
        let lost = 0;
        let recv = 0;
        stats.forEach((r) => {
          if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded" && typeof r.currentRoundTripTime === "number") rtt = r.currentRoundTripTime * 1000;
          if (r.type === "inbound-rtp" && r.kind === "audio") {
            lost = r.packetsLost ?? 0;
            recv = r.packetsReceived ?? 0;
          }
        });
        const dl = lost - statsPrev.current.lost;
        const dr = recv - statsPrev.current.recv;
        statsPrev.current = { lost, recv };
        const q = qualityFromStats(rtt, dl + dr > 0 ? dl / (dl + dr) : 0);
        setCall((c) => (c && c.quality !== q ? { ...c, quality: q } : c));
      } catch {
        /* ignore */
      }
    }, 2000);
  }, [setCall]);

  const createPc = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });
    pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      const st = pc.connectionState;
      if (st === "connected") {
        clearTimeout(timersRef.current.drop);
        const c = callRef.current;
        if (c && c.phase !== "active") playCue("connect");
        setCall((x) => (x ? { ...x, phase: "active", reconnecting: false, startedAt: x.startedAt ?? Date.now() } : x));
        startStats();
      } else if (st === "disconnected") {
        setCall((x) => (x ? { ...x, reconnecting: true } : x));
        clearTimeout(timersRef.current.drop);
        timersRef.current.drop = window.setTimeout(() => finish("failed", "ended"), 12_000);
      } else if (st === "failed") {
        finish("failed", "ended");
      }
    };
    pcRef.current = pc;
    return pc;
  }, [finish, setCall, startStats]);

  const getMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS, video: false });
    stream.getAudioTracks().forEach((t) => {
      try { t.contentHint = "speech"; } catch { /* optional */ }
    });
    localRef.current = stream;
    return stream;
  }, []);

  const startCall = useCallback(
    async (peerId: string) => {
      if (!myId || peerId === myId) return;
      if (callRef.current && callRef.current.phase !== "ended") {
        toast.error("أنت في مكالمة بالفعل");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        toast.error("متصفحك لا يدعم المكالمات الصوتية");
        return;
      }
      teardown();
      clearTimeout(timersRef.current.clear);
      const draft: CallUi = { id: null, peerId, phase: "outgoing", muted: false, startedAt: null, quality: null, reconnecting: false };
      setCall(draft);
      ring("outgoing");
      const stillMine = () => callRef.current?.peerId === peerId && callRef.current.phase === "outgoing";
      try {
        const stream = await getMic();
        if (!stillMine()) return teardown();
        const pc = createPc();
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription({ type: "offer", sdp: tuneOpus(offer.sdp ?? "") });
        await waitForIce(pc);
        if (!stillMine()) return teardown();
        const { data, error } = await supabase
          .from("calls")
          .insert({ caller_id: myId, callee_id: peerId, offer: pc.localDescription?.sdp ?? "" })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("insert failed");
        if (!stillMine()) {
          void supabase.from("calls").update({ status: "cancelled" }).eq("id", data.id).then(() => undefined);
          return;
        }
        setCall((c) => (c ? { ...c, id: data.id } : c));
        timersRef.current.ring = window.setTimeout(() => finish("missed", "missed"), RING_TIMEOUT_MS);
      } catch (e) {
        const isMic = (e as { name?: string })?.name?.endsWith("Error") && !(e as { code?: string })?.code;
        toast.error(isMic ? micError(e) : "تعذر بدء المكالمة، حاول مجدداً");
        finish("failed");
      }
    },
    [createPc, finish, getMic, myId, ring, setCall, teardown],
  );

  const answer = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.phase !== "incoming" || !c.id || !offerRef.current) return;
    stopRing();
    clearTimeout(timersRef.current.ring);
    answeredHereRef.current = c.id;
    const offer = offerRef.current;
    setCall({ ...c, phase: "connecting" });
    try {
      const stream = await getMic();
      const pc = createPc();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription({ type: "offer", sdp: tuneOpus(offer) });
      const ans = await pc.createAnswer();
      await pc.setLocalDescription({ type: "answer", sdp: tuneOpus(ans.sdp ?? "") });
      await waitForIce(pc);
      if (callRef.current?.id !== c.id || callRef.current.phase === "ended") return;
      const { data } = await supabase
        .from("calls")
        .update({ status: "accepted", answer: pc.localDescription?.sdp ?? "" })
        .eq("id", c.id)
        .eq("status", "ringing")
        .select("id");
      if (!data?.length) return finish("cancelled");
      void tuneSender(pc);
    } catch (e) {
      toast.error(micError(e));
      finish("failed", "declined");
    }
  }, [createPc, finish, getMic, setCall, stopRing]);

  const decline = useCallback(() => finish("declined", "declined"), [finish]);

  const hangup = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.phase === "ended") return setCall(null);
    if (c.phase === "incoming") return decline();
    if (c.phase === "outgoing") return finish("cancelled", c.id ? "cancelled" : undefined);
    finish("ended", "ended");
  }, [decline, finish, setCall]);

  const toggleMute = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    const muted = !c.muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    setCall({ ...c, muted });
  }, [setCall]);

  // Signaling: one channel per signed-in member, RLS limits rows to their own calls.
  useEffect(() => {
    if (!myId) return;

    const onIncoming = (row: CallRow) => {
      if (row.status !== "ringing" || isRingStale(row.created_at)) return;
      const cur = callRef.current;
      if (cur && cur.id === row.id) return;
      if (cur && cur.phase !== "ended") {
        void supabase.from("calls").update({ status: "busy" }).eq("id", row.id).then(() => undefined);
        return;
      }
      teardown();
      clearTimeout(timersRef.current.clear);
      offerRef.current = row.offer;
      answeredHereRef.current = null;
      setCall({ id: row.id, peerId: row.caller_id, phase: "incoming", muted: false, startedAt: null, quality: null, reconnecting: false });
      ring("incoming");
      const remaining = RING_TIMEOUT_MS + 5_000 - (Date.now() - new Date(row.created_at).getTime());
      timersRef.current.ring = window.setTimeout(() => finish("missed"), Math.max(3_000, remaining));
    };

    const onUpdate = async (row: CallRow) => {
      const c = callRef.current;
      if (!c || c.id !== row.id || c.phase === "ended") return;
      if (row.status === "accepted") {
        if (row.caller_id === myId && c.phase === "outgoing" && row.answer && pcRef.current) {
          clearTimeout(timersRef.current.ring);
          stopRing();
          setCall({ ...c, phase: "connecting" });
          try {
            await pcRef.current.setRemoteDescription({ type: "answer", sdp: tuneOpus(row.answer) });
            void tuneSender(pcRef.current);
          } catch {
            finish("failed", "ended");
          }
        } else if (row.callee_id === myId && answeredHereRef.current !== row.id) {
          finish("elsewhere");
        }
        return;
      }
      if (["declined", "busy", "missed", "cancelled", "ended"].includes(row.status)) finish(row.status as keyof typeof END_REASONS);
    };

    const ch = supabase
      .channel(`calls-${myId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${myId}` }, (p) => onIncoming(p.new as CallRow))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `callee_id=eq.${myId}` }, (p) => void onUpdate(p.new as CallRow))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `caller_id=eq.${myId}` }, (p) => void onUpdate(p.new as CallRow))
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Pick up a call that started ringing before this page loaded.
        void supabase
          .from("calls")
          .select("id, caller_id, callee_id, status, offer, answer, created_at")
          .eq("callee_id", myId)
          .eq("status", "ringing")
          .gte("created_at", new Date(Date.now() - RING_TIMEOUT_MS).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .then(({ data }) => data?.[0] && onIncoming(data[0]));
      });

    const onLeave = () => {
      const c = callRef.current;
      if (!c?.id || c.phase === "ended") return;
      const status = c.phase === "outgoing" ? "cancelled" : c.phase === "incoming" ? "declined" : "ended";
      void supabase.from("calls").update({ status }).eq("id", c.id).then(() => undefined);
    };
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.removeEventListener("pagehide", onLeave);
      supabase.removeChannel(ch);
    };
  }, [finish, myId, ring, setCall, stopRing, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  const value = useMemo<Ctx>(
    () => ({ call, remoteStream, startCall: (id) => void startCall(id), answer: () => void answer(), decline, hangup, toggleMute }),
    [answer, call, decline, hangup, remoteStream, startCall, toggleMute],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      {call && <CallScreen />}
    </CallContext.Provider>
  );
}
