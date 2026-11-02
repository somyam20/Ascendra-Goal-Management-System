import { useEffect, useState } from 'react';
import { Lumi } from '@/components/brand/Lumi';
import { AscendraLogo } from '@/components/brand/AscendraLogo';

/* Hand-drawn SVG emoji characters, animated with CSS keyframes in index.css. */

type FaceProps = { size?: number; delay?: number };

const Spark = ({ x, y, d = 0, c = '#fde047' }: { x: number; y: number; d?: number; c?: string }) => (
  <path className="emo-spark" style={{ animationDelay: `${d}s` }} d={`M${x} ${y - 5} L${x + 1.4} ${y - 1.4} L${x + 5} ${y} L${x + 1.4} ${y + 1.4} L${x} ${y + 5} L${x - 1.4} ${y + 1.4} L${x - 5} ${y} L${x - 1.4} ${y - 1.4} Z`} fill={c} />
);

const Shadow = ({ d = 0 }: { d?: number }) => (
  <ellipse className="emo-shadow" style={{ animationDelay: `${d}s` }} cx="40" cy="92" rx="20" ry="3.5" fill="currentColor" />
);

/** Sunny — grinning, bouncing. */
export function SunnyFace({ size = 64, delay = 0 }: FaceProps) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 80 96" className="text-fg" aria-hidden>
      <defs>
        <radialGradient id="g-sunny" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff3a8" /><stop offset="55%" stopColor="#fcd34d" /><stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <Shadow d={delay} />
      <g className="emo emo-bounce" style={{ animationDelay: `${delay}s` }}>
        <circle cx="40" cy="44" r="30" fill="url(#g-sunny)" />
        <ellipse cx="30" cy="28" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-25 30 28)" />
        <g className="emo-eye" style={{ animationDelay: `${delay + 0.3}s` }}><ellipse cx="29" cy="40" rx="3.6" ry="5" fill="#3b2a12" /><circle cx="30.3" cy="38" r="1.3" fill="#fff" /></g>
        <g className="emo-eye" style={{ animationDelay: `${delay + 0.3}s` }}><ellipse cx="51" cy="40" rx="3.6" ry="5" fill="#3b2a12" /><circle cx="52.3" cy="38" r="1.3" fill="#fff" /></g>
        <ellipse className="emo-cheek" cx="22" cy="50" rx="5" ry="3" fill="#fb7185" />
        <ellipse className="emo-cheek" cx="58" cy="50" rx="5" ry="3" fill="#fb7185" />
        <path className="emo-mouth" d="M28 52 Q40 66 52 52 Q40 58 28 52 Z" fill="#7c2d12" stroke="#3b2a12" strokeWidth="2" strokeLinejoin="round" />
      </g>
      <Spark x={70} y={14} d={delay} />
      <Spark x={10} y={22} d={delay + 0.8} c="#f9a8d4" />
    </svg>
  );
}

/** Rosie — winking & wobbling, with a little heart. */
export function RosieFace({ size = 64, delay = 0 }: FaceProps) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 80 96" className="text-fg" aria-hidden>
      <defs>
        <radialGradient id="g-rosie" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffe4f1" /><stop offset="55%" stopColor="#f9a8d4" /><stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
      </defs>
      <Shadow d={delay} />
      <g className="emo emo-wobble" style={{ animationDelay: `${delay}s` }}>
        <circle cx="40" cy="44" r="30" fill="url(#g-rosie)" />
        <ellipse cx="30" cy="28" rx="9" ry="5" fill="#fff" opacity=".5" transform="rotate(-25 30 28)" />
        <path d="M24 41 Q29 36 34 41" stroke="#4a1530" strokeWidth="3" fill="none" strokeLinecap="round" />
        <g className="emo-eye" style={{ animationDelay: `${delay + 1}s` }}><ellipse cx="51" cy="40" rx="3.6" ry="5" fill="#4a1530" /><circle cx="52.3" cy="38" r="1.3" fill="#fff" /></g>
        <ellipse className="emo-cheek" cx="22" cy="51" rx="5" ry="3" fill="#e11d48" />
        <ellipse className="emo-cheek" cx="58" cy="51" rx="5" ry="3" fill="#e11d48" />
        <path d="M32 54 Q40 61 48 54" stroke="#4a1530" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M47 57 q3 4 0 7" stroke="#f43f5e" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      <path className="emo-spark" style={{ animationDelay: `${delay + 0.4}s` }} d="M68 14 c-3 -4 -9 -1 -6 4 l6 6 l6 -6 c3 -5 -3 -8 -6 -4 Z" fill="#f43f5e" />
    </svg>
  );
}

/** Chill — cool shades, floating. */
export function ChillFace({ size = 64, delay = 0 }: FaceProps) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 80 96" className="text-fg" aria-hidden>
      <defs>
        <radialGradient id="g-chill" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#d6f6ff" /><stop offset="55%" stopColor="#7dd3fc" /><stop offset="100%" stopColor="#3b82f6" />
        </radialGradient>
        <linearGradient id="g-shades" x1="0" x2="1"><stop offset="0%" stopColor="#1e1b4b" /><stop offset="100%" stopColor="#4c1d95" /></linearGradient>
      </defs>
      <Shadow d={delay} />
      <g className="emo emo-float" style={{ animationDelay: `${delay}s` }}>
        <circle cx="40" cy="44" r="30" fill="url(#g-chill)" />
        <ellipse cx="30" cy="28" rx="9" ry="5" fill="#fff" opacity=".5" transform="rotate(-25 30 28)" />
        <path d="M17 37 H63 V40 Q62 50 52 50 Q44 50 42 41 H38 Q36 50 28 50 Q18 50 17 40 Z" fill="url(#g-shades)" />
        <path d="M23 40 L30 40" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
        <path d="M46 40 L53 40" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
        <path className="emo-mouth" d="M31 58 Q42 64 50 55" stroke="#172554" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      <Spark x={68} y={18} d={delay + 0.5} c="#67e8f9" />
      <Spark x={12} y={14} d={delay + 1.1} c="#c4b5fd" />
    </svg>
  );
}

/** Sprout — focused little green buddy with a leaf. */
export function SproutFace({ size = 64, delay = 0 }: FaceProps) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 80 96" className="text-fg" aria-hidden>
      <defs>
        <radialGradient id="g-sprout" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#e3ffe9" /><stop offset="55%" stopColor="#86efac" /><stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
      </defs>
      <Shadow d={delay} />
      <g className="emo emo-bounce" style={{ animationDelay: `${delay}s` }}>
        <path d="M40 15 Q40 6 48 4 Q50 12 40 15 Z" fill="#22c55e" />
        <path d="M40 15 Q38 8 31 7 Q31 14 40 15 Z" fill="#4ade80" />
        <circle cx="40" cy="45" r="30" fill="url(#g-sprout)" />
        <ellipse cx="30" cy="29" rx="9" ry="5" fill="#fff" opacity=".5" transform="rotate(-25 30 29)" />
        <g className="emo-eye" style={{ animationDelay: `${delay + 0.6}s` }}><circle cx="30" cy="42" r="5" fill="#fff" /><circle cx="31" cy="43" r="3" fill="#14532d" /></g>
        <g className="emo-eye" style={{ animationDelay: `${delay + 0.6}s` }}><circle cx="50" cy="42" r="5" fill="#fff" /><circle cx="51" cy="43" r="3" fill="#14532d" /></g>
        <ellipse className="emo-cheek" cx="22" cy="53" rx="4.5" ry="2.6" fill="#f472b6" />
        <ellipse className="emo-cheek" cx="58" cy="53" rx="4.5" ry="2.6" fill="#f472b6" />
        <ellipse className="emo-mouth" cx="40" cy="57" rx="4" ry="3.2" fill="#14532d" />
      </g>
      <Spark x={70} y={26} d={delay + 0.2} c="#fde047" />
    </svg>
  );
}

const MESSAGES = ['Warming up your goals…', 'Lining up the week…', 'Counting little wins…', 'Polishing the progress bars…', 'Waking up the planner…'];

export function EmojiLoader({ message, compact = false }: { message?: string; compact?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (message) return;
    const t = setInterval(() => setI((x) => (x + 1) % MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, [message]);
  const size = compact ? 40 : 58;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10" role="status" aria-label="Loading">
      <div className="flex items-end gap-1 sm:gap-3">
        {!compact && <Lumi size={84} mood="wave" />}
        <SunnyFace size={size} delay={0} />
        <RosieFace size={size} delay={0.2} />
        <ChillFace size={size} delay={0.4} />
        {!compact && <SproutFace size={size} delay={0.6} />}
      </div>
      <p key={message ?? i} className="animate-fade-up text-sm font-medium text-subtle">{message ?? MESSAGES[i]}</p>
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="bg-blobs flex min-h-screen flex-col items-center justify-center">
      <AscendraLogo size={52} tagline className="mb-4 text-2xl" />
      <EmojiLoader />
    </div>
  );
}
