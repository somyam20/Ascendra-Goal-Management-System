import { useId, type ReactNode } from 'react';

export type LumiMood = 'wave' | 'cheer' | 'think' | 'sleep' | 'idle';

/**
 * Lumi — Ascendra's brand ambassador: a little glowing star-sprite with a scarf.
 * Hand-built SVG, animated with CSS (see .lumi-* in index.css); motion is disabled under
 * prefers-reduced-motion.
 */
export function Lumi({ size = 120, mood = 'idle', className = '' }: { size?: number; mood?: LumiMood; className?: string }) {
  const id = useId().replace(/:/g, '');
  const asleep = mood === 'sleep';
  const happy = mood === 'cheer' || mood === 'wave';
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 120 132" className={`lumi lumi-${mood} ${className}`} role="img" aria-label={`Lumi, the Ascendra mascot (${mood})`}>
      <defs>
        <radialGradient id={`lumi-body-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fffbe6" />
          <stop offset="45%" stopColor="#ffe27a" />
          <stop offset="100%" stopColor="#ffb547" />
        </radialGradient>
        <radialGradient id={`lumi-halo-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--c-accent))" stopOpacity=".55" />
          <stop offset="100%" stopColor="rgb(var(--c-accent))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`lumi-scarf-${id}`} x1="0" x2="1">
          <stop offset="0%" stopColor="rgb(var(--c-primary))" />
          <stop offset="100%" stopColor="rgb(var(--c-secondary))" />
        </linearGradient>
      </defs>

      <ellipse className="lumi-shadow" cx="60" cy="126" rx="26" ry="4" fill="currentColor" opacity=".18" />
      <g className="lumi-body">
        <circle cx="60" cy="62" r="54" fill={`url(#lumi-halo-${id})`} className="lumi-halo" />
        {/* left arm */}
        <g className={mood === 'cheer' ? 'lumi-arm-up-l' : ''}>
          <path d="M28 70 Q14 72 12 84" stroke="#ffb547" strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
        {/* right arm: waves / cheers / thinks */}
        <g className={mood === 'wave' ? 'lumi-wave' : mood === 'cheer' ? 'lumi-arm-up-r' : ''} style={{ transformOrigin: '92px 70px' }}>
          {mood === 'think'
            ? <path d="M92 72 Q96 88 74 86" stroke="#ffb547" strokeWidth="7" strokeLinecap="round" fill="none" />
            : <path d="M92 70 Q106 64 110 50" stroke="#ffb547" strokeWidth="7" strokeLinecap="round" fill="none" />}
        </g>
        {/* star body */}
        <path
          d="M60 10 C66 32 72 38 98 44 C80 56 78 64 84 92 C70 80 64 80 60 80 C56 80 50 80 36 92 C42 64 40 56 22 44 C48 38 54 32 60 10 Z"
          fill={`url(#lumi-body-${id})`} stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round"
        />
        <ellipse cx="50" cy="38" rx="8" ry="4" fill="#fff" opacity=".6" transform="rotate(-30 50 38)" />
        {/* scarf */}
        <path d="M38 70 Q60 80 82 70 L82 76 Q60 86 38 76 Z" fill={`url(#lumi-scarf-${id})`} />
        <path className="lumi-scarf-tail" d="M74 76 Q82 92 92 98 Q80 98 70 82 Z" fill={`url(#lumi-scarf-${id})`} opacity=".92" />
        {/* face */}
        {asleep ? (
          <g stroke="#4a2c0a" strokeWidth="2.6" strokeLinecap="round" fill="none">
            <path d="M46 54 Q50 58 54 54" /><path d="M66 54 Q70 58 74 54" />
          </g>
        ) : (
          <>
            <g className="lumi-eye"><ellipse cx="50" cy="53" rx="3.6" ry={happy ? 4.6 : 4.2} fill="#3b2208" /><circle cx="51.3" cy="51.3" r="1.3" fill="#fff" /></g>
            <g className="lumi-eye"><ellipse cx="70" cy="53" rx="3.6" ry={happy ? 4.6 : 4.2} fill="#3b2208" /><circle cx="71.3" cy="51.3" r="1.3" fill="#fff" /></g>
          </>
        )}
        <ellipse cx="42" cy="62" rx="4.5" ry="2.6" fill="#fb7185" opacity=".55" />
        <ellipse cx="78" cy="62" rx="4.5" ry="2.6" fill="#fb7185" opacity=".55" />
        {mood === 'cheer' ? <path d="M52 62 Q60 72 68 62 Q60 66 52 62 Z" fill="#7c2d12" stroke="#4a2c0a" strokeWidth="1.6" strokeLinejoin="round" />
          : mood === 'think' ? <path d="M55 65 Q60 63 65 65" stroke="#4a2c0a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          : asleep ? <ellipse cx="60" cy="65" rx="2.4" ry="1.8" fill="#4a2c0a" />
          : <path d="M53 62 Q60 69 67 62" stroke="#4a2c0a" strokeWidth="2.6" strokeLinecap="round" fill="none" />}
      </g>

      {/* mood extras */}
      {(mood === 'cheer' || mood === 'wave' || mood === 'idle') && (
        <g fill="rgb(var(--c-accent))">
          <path className="lumi-spark" d="M14 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
          <path className="lumi-spark lumi-spark-2" d="M104 20 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 z" fill="rgb(var(--c-secondary))" />
          <path className="lumi-spark lumi-spark-3" d="M100 100 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 z" />
        </g>
      )}
      {mood === 'think' && (
        <g fill="rgb(var(--c-subtle))" className="lumi-dots">
          <circle cx="96" cy="30" r="3" /><circle cx="104" cy="20" r="4" /><circle cx="113" cy="8" r="5" />
        </g>
      )}
      {asleep && (
        <g fill="rgb(var(--c-subtle))" fontFamily="Fraunces, serif" fontWeight="700" className="lumi-zzz">
          <text x="88" y="34" fontSize="14">z</text><text x="98" y="22" fontSize="11">z</text><text x="106" y="12" fontSize="8">z</text>
        </g>
      )}
    </svg>
  );
}

/** Lumi with a speech bubble. */
export function LumiSays({ children, mood = 'wave', size = 96, className = '' }: { children: ReactNode; mood?: LumiMood; size?: number; className?: string }) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <Lumi size={size} mood={mood} className="shrink-0" />
      <div className="relative mb-8 max-w-xs rounded-2xl rounded-bl-sm border border-border/70 bg-surface/90 px-4 py-3 text-sm shadow-soft backdrop-blur-xl animate-scale-in">
        {children}
      </div>
    </div>
  );
}
