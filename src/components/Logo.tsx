export function ButterflyMark({ className = "h-10 w-10", animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="bw1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary-glow)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
        <linearGradient id="bw2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <g className={animated ? "animate-flutter" : undefined} style={{ transformBox: "fill-box" }}>
        <path d="M32 30C26 14 10 6 6 14s4 20 26 18Z" fill="url(#bw1)" />
        <path d="M32 30C38 14 54 6 58 14s-4 20-26 18Z" fill="url(#bw2)" />
        <path d="M32 33C22 34 12 42 16 50s14 0 16-15Z" fill="url(#bw2)" opacity=".9" />
        <path d="M32 33c10 1 20 9 16 17s-14 0-16-15Z" fill="url(#bw1)" opacity=".9" />
        <circle cx="18" cy="17" r="2.5" fill="var(--background)" opacity=".35" />
        <circle cx="46" cy="17" r="2.5" fill="var(--background)" opacity=".35" />
      </g>
      <rect x="30.5" y="22" width="3" height="28" rx="1.5" fill="var(--foreground)" />
      <path d="M31 23c-2-5-5-7-8-8M33 23c2-5 5-7 8-8" stroke="var(--foreground)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <ButterflyMark className="h-9 w-9" />
      <span className="font-display text-xl text-gradient">شات فراشات العرب</span>
    </div>
  );
}
