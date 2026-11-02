import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface TabItem { key: string; to: string; label: ReactNode; icon?: ReactNode }

/** Tabs with an animated gradient pill that slides to the active tab. */
export function SlidingTabs({ items, active, variant = 'primary' }: { items: TabItem[]; active: string; variant?: 'primary' | 'sub' }) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const el = refs.current[active];
      if (!el) { setInd(null); return; }
      setInd({ left: el.offsetLeft, width: el.offsetWidth });
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active, items.length]);

  const isPrimary = variant === 'primary';
  return (
    <div ref={wrap} className={`no-scrollbar relative flex overflow-x-auto ${isPrimary ? 'gap-1 rounded-2xl bg-muted/70 p-1.5' : 'gap-1 border-b border-border/70'}`} role="tablist">
      {ind && (
        <span
          aria-hidden
          className={`absolute transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${isPrimary
            ? 'top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r from-primary to-secondary shadow-glow'
            : 'bottom-0 h-[3px] rounded-full bg-gradient-to-r from-primary via-secondary to-accent'}`}
          style={{ left: ind.left, width: ind.width }}
        />
      )}
      {items.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key} to={t.to} role="tab" aria-selected={on}
            ref={(el) => { refs.current[t.key] = el; }}
            className={`relative z-10 flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors ${isPrimary
              ? `rounded-xl px-3.5 py-2 ${on ? 'text-white' : 'text-subtle hover:text-fg'}`
              : `px-3 py-3 ${on ? 'text-fg' : 'text-subtle hover:text-fg'}`}`}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
