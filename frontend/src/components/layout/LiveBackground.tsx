import { useEffect, useRef } from 'react';
import { useTheme, type LiveEffect } from '@/contexts/ThemeContext';

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

type Particle = { x: number; y: number; r: number; vx: number; vy: number; a: number; p: number };

/** Canvas effects (stars, petals, fireflies). Paused while the tab is hidden. */
function CanvasEffect({ effect, colors }: { effect: 'stars' | 'petals' | 'fireflies'; colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0, h = 0, raf = 0, last = performance.now();
    let parts: Particle[] = [];
    let shooting: { x: number; y: number; life: number } | null = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const seed = () => {
      const n = effect === 'stars' ? Math.round((w * h) / 9000) : effect === 'petals' ? 34 : 46;
      parts = Array.from({ length: Math.min(n, 220) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: effect === 'stars' ? Math.random() * 1.4 + 0.3 : effect === 'petals' ? Math.random() * 5 + 5 : Math.random() * 2 + 1.5,
        vx: effect === 'petals' ? Math.random() * 0.4 + 0.2 : (Math.random() - 0.5) * 0.3,
        vy: effect === 'petals' ? Math.random() * 0.6 + 0.4 : (Math.random() - 0.5) * 0.3,
        a: Math.random() * Math.PI * 2, p: Math.random() * Math.PI * 2,
      }));
    };
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = (t: number) => {
      const dt = Math.min(t - last, 50) / 16.7;
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (const q of parts) {
        if (effect === 'stars') {
          const tw = 0.45 + 0.55 * Math.sin(t / 700 + q.p);
          ctx.globalAlpha = tw;
          ctx.fillStyle = colors[0];
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
        } else if (effect === 'petals') {
          q.x += (q.vx + Math.sin(t / 1200 + q.p) * 0.4) * dt; q.y += q.vy * dt; q.a += 0.01 * dt;
          if (q.y > h + 20) { q.y = -20; q.x = Math.random() * w; }
          if (q.x > w + 20) q.x = -20;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a);
          ctx.globalAlpha = 0.55; ctx.fillStyle = colors[parts.indexOf(q) % colors.length];
          ctx.beginPath(); ctx.ellipse(0, 0, q.r, q.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          q.x += (q.vx + Math.cos(t / 1500 + q.p) * 0.25) * dt; q.y += (q.vy + Math.sin(t / 1700 + q.p) * 0.25) * dt;
          if (q.x < -10) q.x = w + 10; if (q.x > w + 10) q.x = -10;
          if (q.y < -10) q.y = h + 10; if (q.y > h + 10) q.y = -10;
          const glow = 0.35 + 0.65 * Math.max(0, Math.sin(t / 900 + q.p));
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * 6);
          g.addColorStop(0, colors[0]); g.addColorStop(1, 'transparent');
          ctx.globalAlpha = glow; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (effect === 'stars') {
        if (!shooting && Math.random() < 0.004) shooting = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, life: 1 };
        if (shooting) {
          ctx.globalAlpha = shooting.life;
          ctx.strokeStyle = colors[1] ?? colors[0]; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(shooting.x, shooting.y); ctx.lineTo(shooting.x - 80, shooting.y - 30); ctx.stroke();
          shooting.x += 9 * dt; shooting.y += 3.4 * dt; shooting.life -= 0.02 * dt;
          if (shooting.life <= 0) shooting = null;
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(draw); }
    };
    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
    // colors is re-created each render; restart only when the actual values change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect, colors.join('|')]);

  return <canvas ref={ref} className="live-canvas" data-testid="live-canvas" />;
}

const WavePath = ({ className, fill }: { className: string; fill: string }) => (
  <svg className={className} viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden>
    <path fill={fill} d="M0 100 C 180 40 360 40 540 100 S 900 160 1080 100 S 1260 40 1440 100 C 1620 160 1800 160 1980 100 S 2340 40 2520 100 S 2700 160 2880 100 V200 H0 Z" />
  </svg>
);

export function LiveBackground() {
  const { effect, palette, mode } = useTheme();
  if (!effect || reducedMotion()) return null;
  return <div className={`live-layer live-${effect}`} data-live-effect={effect} aria-hidden>{renderEffect(effect, palette, mode)}</div>;
}

function renderEffect(effect: LiveEffect, palette: ReturnType<typeof useTheme>['palette'], mode: string) {
  switch (effect) {
    case 'aurora':
      return <><span /><span /><span /></>;
    case 'waves':
      return <><WavePath className="w3" fill={palette.accent} /><WavePath className="w1" fill={palette.primary} /><WavePath className="w2" fill={palette.secondary} /></>;
    case 'grid':
      return <><div className="sun" /><div className="plane" /></>;
    case 'stars':
      return <CanvasEffect effect="stars" colors={mode === 'dark' ? ['#ffffff', '#fde68a'] : [palette.primary, palette.secondary]} />;
    case 'petals':
      return <CanvasEffect effect="petals" colors={['#f9a8d4', '#fbcfe8', palette.primary]} />;
    case 'fireflies':
      return <CanvasEffect effect="fireflies" colors={[mode === 'dark' ? '#fde047' : '#ca8a04']} />;
  }
}
