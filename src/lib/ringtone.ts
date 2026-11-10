/** Synthesized ring tones (no audio files): a bright two-note ring for incoming, a soft ringback for outgoing. */
export function createRingtone(kind: "incoming" | "outgoing") {
  let ctx: AudioContext | null = null;
  let timer = 0;
  let stopped = false;

  function beep(at: number, freqs: number[], dur: number, vol: number) {
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.02);
    gain.gain.setValueAtTime(vol, at + dur - 0.05);
    gain.gain.linearRampToValueAtTime(0, at + dur);
    gain.connect(ctx.destination);
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(gain);
      o.start(at);
      o.stop(at + dur);
    }
  }

  function cycle() {
    if (!ctx || stopped) return;
    const t = ctx.currentTime + 0.05;
    if (kind === "incoming") {
      beep(t, [880, 1320], 0.18, 0.16);
      beep(t + 0.24, [988, 1480], 0.18, 0.16);
      beep(t + 0.6, [880, 1320], 0.18, 0.16);
      beep(t + 0.84, [988, 1480], 0.18, 0.16);
      navigator.vibrate?.([300, 150, 300]);
    } else {
      beep(t, [440, 480], 1.2, 0.07);
    }
  }

  return {
    start() {
      try {
        ctx = new AudioContext();
        void ctx.resume();
        cycle();
        timer = window.setInterval(cycle, kind === "incoming" ? 2200 : 3500);
      } catch {
        /* Audio unavailable; the call screen still shows. */
      }
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      navigator.vibrate?.(0);
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}

/** Short tone played when a call connects or ends. */
export function playCue(kind: "connect" | "end") {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime + 0.02;
    const notes = kind === "connect" ? [660, 990] : [520, 390];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.12);
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.12 + 0.02);
      g.gain.linearRampToValueAtTime(0, t + i * 0.12 + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 0.14);
    });
    setTimeout(() => void ctx.close().catch(() => undefined), 600);
  } catch {
    /* ignore */
  }
}
