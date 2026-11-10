/** Pure helpers for voice calls (kept DOM-free so they can be unit tested). */

export const RING_TIMEOUT_MS = 45_000;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
};

const OPUS_PARAMS: Record<string, string> = {
  minptime: "10",
  useinbandfec: "1",
  stereo: "0",
  "sprop-stereo": "0",
  maxaveragebitrate: "64000",
  maxplaybackrate: "48000",
  cbr: "0",
  usedtx: "0",
};

/** Raise Opus to a clear, wideband voice profile with loss recovery. Idempotent. */
export function tuneOpus(sdp: string) {
  const pt = sdp.match(/a=rtpmap:(\d+) opus\/48000/i)?.[1];
  if (!pt) return sdp;
  const eol = sdp.includes("\r\n") ? "\r\n" : "\n";
  const lines = sdp.split(eol);
  const idx = lines.findIndex((l) => l.startsWith(`a=fmtp:${pt} `));
  const params = new Map<string, string>();
  if (idx >= 0) {
    for (const part of (lines[idx] ?? "").slice(`a=fmtp:${pt} `.length).split(";")) {
      const [k, v = ""] = part.trim().split("=");
      if (k) params.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(OPUS_PARAMS)) params.set(k, v);
  const line = `a=fmtp:${pt} ${[...params].map(([k, v]) => `${k}=${v}`).join(";")}`;
  if (idx >= 0) lines[idx] = line;
  else {
    const rtp = lines.findIndex((l) => l.startsWith(`a=rtpmap:${pt} `));
    lines.splice(rtp + 1, 0, line);
  }
  return lines.join(eol);
}

/** A ringing row older than the ring window is from an abandoned caller and must not ring. */
export function isRingStale(createdAt: string, now = Date.now()) {
  return now - new Date(createdAt).getTime() > RING_TIMEOUT_MS + 5_000;
}

export function formatCallTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export type CallQuality = "excellent" | "good" | "poor";
export function qualityFromStats(rttMs: number | null, lossRatio: number) {
  if (lossRatio > 0.08 || (rttMs ?? 0) > 450) return "poor" as const;
  if (lossRatio > 0.02 || (rttMs ?? 0) > 220) return "good" as const;
  return "excellent" as const;
}

export const END_REASONS: Record<string, string> = {
  declined: "تم رفض المكالمة",
  busy: "المستخدم في مكالمة أخرى",
  missed: "لم يتم الرد",
  cancelled: "تم إلغاء المكالمة",
  ended: "انتهت المكالمة",
  failed: "انقطع الاتصال",
};
