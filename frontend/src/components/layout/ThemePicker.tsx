import { useEffect, useRef, useState } from 'react';
import { Check, Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { THEMES, useTheme } from '@/contexts/ThemeContext';

export function ModeToggle() {
  const { mode, toggleMode } = useTheme();
  return (
    <button onClick={toggleMode} className="btn-ghost relative h-10 w-10 overflow-hidden p-0" aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} title="Toggle light / dark">
      <Sun className={`absolute h-5 w-5 transition-all duration-500 ${mode === 'dark' ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'} text-warning`} />
      <Moon className={`absolute h-5 w-5 transition-all duration-500 ${mode === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'} text-primary`} />
    </button>
  );
}

/** Mini preview tile: swatch gradient + an animated hint for live themes. */
function ThemeTile({ t, active, onPick }: { t: (typeof THEMES)[number]; active: boolean; onPick: () => void }) {
  const [a, b, c] = t.swatch;
  return (
    <button
      onClick={onPick} aria-pressed={active} title={t.name}
      className={`group relative overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${active ? 'border-primary ring-2 ring-primary/40' : 'border-border/70'}`}
    >
      <div className="relative h-14 w-full" style={{ background: `linear-gradient(135deg, ${a}, ${b} 60%, ${c})` }}>
        {t.kind === 'live' && (
          <>
            <span className="absolute left-3 top-3 h-1.5 w-1.5 animate-ping rounded-full bg-white/90" />
            <span className="absolute right-5 top-6 h-1 w-1 animate-ping rounded-full bg-white/80 [animation-delay:.5s]" />
            <span className="absolute bottom-2 left-8 h-1 w-1 animate-ping rounded-full bg-white/70 [animation-delay:1s]" />
          </>
        )}
        {active && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary shadow"><Check className="h-3.5 w-3.5" /></span>}
      </div>
      <span className="block truncate px-2 py-1.5 text-xs font-semibold">{t.name}</span>
    </button>
  );
}

export function ThemeGallery({ onPicked }: { onPicked?: () => void }) {
  const { theme, setTheme } = useTheme();
  const group = (kind: 'static' | 'live') => THEMES.filter((t) => t.kind === kind);
  return (
    <div className="space-y-3">
      {(['static', 'live'] as const).map((k) => (
        <div key={k}>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-subtle">
            {k === 'live' ? <><Sparkles className="h-3.5 w-3.5 text-secondary" />Live themes</> : 'Static themes'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {group(k).map((t) => <ThemeTile key={t.id} t={t} active={theme === t.id} onPick={() => { setTheme(t.id); onPicked?.(); }} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Button that opens the theme gallery. `placement` controls where the popover opens. */
export function ThemePicker({ placement = 'down', label = false }: { placement?: 'down' | 'up'; label?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={`btn-ghost h-10 ${label ? 'px-3' : 'w-10 p-0'}`} aria-label="Choose theme" aria-expanded={open} title="Themes">
        <Palette className="h-5 w-5" />{label && <span>Themes</span>}
      </button>
      {open && (
        <div className={`card absolute z-50 w-[19rem] animate-scale-in bg-surface p-3 ${placement === 'up' ? 'bottom-12 left-0' : 'right-0 top-12'}`}>
          <ThemeGallery />
        </div>
      )}
    </div>
  );
}
