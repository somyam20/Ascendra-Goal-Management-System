import { useId } from 'react';

/** Ascendra mark: a luminous star rising through a sunrise arc, tinted with the active theme. */
export function AscendraMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`ascendra-mark ${className}`} aria-hidden>
      <defs>
        <linearGradient id={`lm-bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--c-primary))" />
          <stop offset="55%" stopColor="rgb(var(--c-secondary))" />
          <stop offset="100%" stopColor="rgb(var(--c-accent))" />
        </linearGradient>
        <radialGradient id={`lm-glow-${id}`} cx="50%" cy="42%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity=".95" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#lm-bg-${id})`} />
      <circle cx="32" cy="27" r="16" fill={`url(#lm-glow-${id})`} opacity=".55" />
      {/* horizon arcs */}
      <path d="M12 46 Q32 30 52 46" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M18 52 Q32 42 46 52" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.6" strokeLinecap="round" />
      {/* rising four-point star */}
      <path className="ascendra-star" d="M32 10 C33.4 20 35 22.6 44 24 C35 25.4 33.4 28 32 38 C30.6 28 29 25.4 20 24 C29 22.6 30.6 20 32 10 Z" fill="#fff" />
      <circle cx="46.5" cy="13.5" r="1.8" fill="#fff" opacity=".85" />
      <circle cx="17" cy="15" r="1.2" fill="#fff" opacity=".7" />
    </svg>
  );
}

export function AscendraLogo({ size = 40, tagline = false, className = '' }: { size?: number; tagline?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <AscendraMark size={size} />
      <span className="leading-none">
        <span className="font-brand text-[1.45em] font-semibold tracking-tight">Lum<span className="gradient-text">ora</span></span>
        {tagline && <span className="mt-1 block text-[0.62em] font-medium uppercase tracking-[.22em] text-subtle">Always ascending.</span>}
      </span>
    </span>
  );
}
