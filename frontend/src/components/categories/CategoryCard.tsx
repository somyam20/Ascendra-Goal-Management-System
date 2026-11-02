import { ArrowUpRight, Check, Clock, Pencil, Plus, Power, Target, Trophy } from 'lucide-react';
import type { Category } from '@/types';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { ProgressRing } from '@/components/common/ui';
import { colorFor } from '@/utils/format';

export function CategoryCard({ c, i, readOnly, busy, onToggle, onEdit, onDeactivate, canEdit, onOpen }: {
  c: Category; i: number; readOnly: boolean; busy?: boolean; canEdit: boolean;
  onToggle: () => void; onEdit: () => void; onDeactivate: () => void;
  /** Opens the category's detail page (goals inside it). */
  onOpen?: () => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const color = colorFor(c.color, i);
  return (
    <div
      role={onOpen ? 'link' : undefined} tabIndex={onOpen ? 0 : undefined} aria-label={onOpen ? `Open ${c.name}` : undefined}
      onClick={onOpen} onKeyDown={(e) => { if (onOpen && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpen(); } }}
      className={`group relative animate-fade-up ${onOpen ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50' : ''} overflow-hidden rounded-3xl border bg-surface/80 shadow-soft backdrop-blur-xl transition duration-300 hover:-translate-y-1 ${c.is_selected ? 'border-transparent' : 'border-border/70 opacity-90'}`}
      style={{ animationDelay: `${i * 50}ms`, boxShadow: c.is_selected ? `0 14px 40px -18px ${color}` : undefined }}
    >
      <div className="absolute inset-0 opacity-[.13] transition group-hover:opacity-20" style={{ background: `radial-gradient(120% 80% at 100% 0%, ${color}, transparent 60%)` }} />
      {c.is_selected && <div className="absolute inset-0 rounded-3xl p-[1.5px]" style={{ background: `linear-gradient(135deg, ${color}, transparent 55%)`, WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }} />}
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg transition group-hover:rotate-6 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
            <CategoryIcon name={c.icon} className="h-6 w-6" />
          </div>
          <div className="flex items-start gap-1">
            <ProgressRing value={c.completion_rate} size={58} stroke={6} color={color} />
            {onOpen && <ArrowUpRight className="h-4 w-4 text-subtle opacity-0 transition group-hover:opacity-100" />}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-bold">{c.name}</h3>
            {c.is_default ? <span className="chip bg-muted text-[10px] text-subtle">Default</span> : <span className="chip text-[10px]" style={{ background: `${color}22`, color }}>Custom</span>}
          </div>
          <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm text-subtle">{c.description || 'No description yet.'}</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/70 py-2"><Target className="mx-auto h-3.5 w-3.5 text-subtle" /><p className="text-sm font-bold">{c.active_goal_count}</p><p className="text-[10px] text-subtle">Active</p></div>
          <div className="rounded-xl bg-muted/70 py-2"><Trophy className="mx-auto h-3.5 w-3.5 text-subtle" /><p className="text-sm font-bold">{c.completed_goal_count}</p><p className="text-[10px] text-subtle">Done</p></div>
          <div className="rounded-xl bg-muted/70 py-2"><Clock className="mx-auto h-3.5 w-3.5 text-subtle" /><p className="text-sm font-bold">{c.hours_per_week ?? 0}h</p><p className="text-[10px] text-subtle">/ week</p></div>
        </div>
        {!readOnly && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={stop(onToggle)} disabled={busy}
              className={`btn flex-1 ${c.is_selected ? 'border border-border bg-surface text-fg hover:bg-muted' : 'text-white'}`}
              style={!c.is_selected ? { background: `linear-gradient(90deg, ${color}, ${color}cc)` } : undefined}
            >
              {c.is_selected ? <><Check className="h-4 w-4" style={{ color }} />Selected</> : <><Plus className="h-4 w-4" />Select</>}
            </button>
            {canEdit && (
              <>
                <button className="btn-ghost btn-sm h-9 w-9 p-0" onClick={stop(onEdit)} aria-label={`Edit ${c.name}`} title="Edit"><Pencil className="h-4 w-4" /></button>
                <button className="btn-ghost btn-sm h-9 w-9 p-0 text-danger" onClick={stop(onDeactivate)} aria-label={`Deactivate ${c.name}`} title="Deactivate"><Power className="h-4 w-4" /></button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
