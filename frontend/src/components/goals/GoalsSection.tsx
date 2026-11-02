import { useMemo, useState } from 'react';
import { Filter, Plus, Search, Sparkles, Target } from 'lucide-react';
import type { Goal, GoalStatus } from '@/types';
import { categoriesApi, goalsApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmDialog, Drawer, EmptyState, ErrorState, SectionHeader, Skeleton } from '@/components/common/ui';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { EmojiLoader } from '@/components/common/EmojiLoader';
import { GoalCard } from './GoalCard';
import { GoalFormModal, type GoalPrefill } from './GoalFormModal';
import { DecomposeModal } from './DecomposeModal';
import { colorFor, fmtDateTime, titleCase } from '@/utils/format';

export default function GoalsSection() {
  const { readOnly, viewUserId, owner } = useWorkspace();
  const toast = useToast();
  const [f, setF] = useState({ category_id: '', importance: '', status: '', start_from: '', end_to: '', search: '', sort: '-created_at' });
  const goals = useAsync(() => goalsApi.list({ user_id: viewUserId, ...f }), [viewUserId, f]);
  const cats = useAsync(() => categoriesApi.list({ user_id: viewUserId }), [viewUserId]);
  const [form, setForm] = useState<{ open: boolean; editing: Goal | null; prefill: GoalPrefill | null }>({ open: false, editing: null, prefill: null });
  const [ai, setAi] = useState(false);
  const [del, setDel] = useState<Goal | null>(null);
  const [hist, setHist] = useState<Goal | null>(null);

  const formCats = useMemo(() => {
    const all = (cats.data ?? []).filter((c) => c.is_active);
    const sel = all.filter((c) => c.is_selected);
    return sel.length ? sel : all;
  }, [cats.data]);

  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; icon: string | null; goals: Goal[] }>();
    (goals.data?.items ?? []).forEach((g) => {
      const c = cats.data?.find((x) => x.id === g.category_id);
      if (!m.has(g.category_id)) m.set(g.category_id, { name: g.category_name, color: g.category_color, icon: c?.icon ?? null, goals: [] });
      m.get(g.category_id)!.goals.push(g);
    });
    return [...m.entries()];
  }, [goals.data, cats.data]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); goals.reload(true); } catch (e) { toast.apiError(e); }
  };

  const filtersActive = Object.entries(f).some(([k, v]) => k !== 'sort' && v);

  return (
    <div className="space-y-5">
      <SectionHeader
        title={readOnly ? `${owner.name}'s goals` : 'My goals'} icon={<Target className="h-5 w-5" />}
        subtitle={`${goals.data?.total ?? 0} goals · tracked daily, with or without a timetable`}
        actions={!readOnly && (
          <>
            <button className="btn-outline" onClick={() => setAi(true)}><Sparkles className="h-4 w-4 text-secondary" />AI breakdown</button>
            <button className="btn-primary" onClick={() => setForm({ open: true, editing: null, prefill: null })} disabled={!formCats.length} title={!formCats.length ? 'Select a category first' : undefined}><Plus className="h-4 w-4" />New goal</button>
          </>
        )}
      />

      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input className="input pl-9" placeholder="Search goals…" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
          </div>
          <select className="input w-auto" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })} aria-label="Category filter">
            <option value="">All categories</option>{(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input w-auto" value={f.importance} onChange={(e) => setF({ ...f, importance: e.target.value })} aria-label="Importance filter">
            <option value="">Any importance</option>{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select className="input w-auto" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status filter">
            <option value="">Any status</option>{['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <input type="date" className="input w-auto" value={f.start_from} onChange={(e) => setF({ ...f, start_from: e.target.value })} aria-label="Starts from" title="Starts on/after" />
          <input type="date" className="input w-auto" value={f.end_to} onChange={(e) => setF({ ...f, end_to: e.target.value })} aria-label="Ends by" title="Ends on/before" />
          <select className="input w-auto" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} aria-label="Sort">
            <option value="-created_at">Newest</option><option value="end_date">Deadline</option><option value="importance">Importance</option><option value="title">Title</option>
          </select>
          {filtersActive && <button className="btn-ghost btn-sm" onClick={() => setF({ category_id: '', importance: '', status: '', start_from: '', end_to: '', search: '', sort: f.sort })}><Filter className="h-3.5 w-3.5" />Clear</button>}
        </div>
      </div>

      {goals.loading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        : goals.error ? <ErrorState message={goals.error} onRetry={goals.reload} />
        : !grouped.length ? (
          <div className="card"><EmptyState
            title={filtersActive ? 'No goals match these filters' : 'No goals yet'}
            message={readOnly ? `${owner.name} hasn't added goals yet.` : filtersActive ? 'Try clearing a filter.' : !formCats.length ? 'Select a category in My Categories, then add your first goal.' : 'Add a goal manually or let AI break a big ambition into milestones.'}
            action={!readOnly && !filtersActive && formCats.length > 0 && <button className="btn-primary" onClick={() => setForm({ open: true, editing: null, prefill: null })}><Plus className="h-4 w-4" />Create your first goal</button>}
          /></div>
        ) : grouped.map(([cid, grp], gi) => (
          <section key={cid} className="animate-fade-up" style={{ animationDelay: `${gi * 60}ms` }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: colorFor(grp.color, gi) }}><CategoryIcon name={grp.icon} className="h-4 w-4" /></span>
              <h3 className="font-bold">{grp.name}</h3>
              <span className="chip bg-muted text-subtle">{grp.goals.length}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {grp.goals.map((g) => (
                <GoalCard key={g.id} g={g} readOnly={readOnly}
                  onEdit={() => setForm({ open: true, editing: g, prefill: null })}
                  onDelete={() => setDel(g)}
                  onHistory={() => setHist(g)}
                  onStatus={(s: GoalStatus) => act(() => goalsApi.setStatus(g.id, s), `Marked ${titleCase(s)}`)}
                  onMilestone={(mid, done) => act(() => goalsApi.setMilestone(g.id, mid, done ? 'COMPLETED' : 'PENDING'), done ? 'Milestone completed 🎉' : 'Milestone reopened')}
                  onApprove={(ok) => act(() => goalsApi.approve(g.id, ok), ok ? 'Goal approved and active' : 'Suggestion rejected')}
                />
              ))}
            </div>
          </section>
        ))}

      <GoalFormModal open={form.open} editing={form.editing} prefill={form.prefill} categories={form.editing ? (cats.data ?? []) : formCats}
        onClose={() => setForm({ open: false, editing: null, prefill: null })} onSaved={() => goals.reload(true)} />
      <DecomposeModal open={ai} onClose={() => setAi(false)} categories={formCats} onUse={(p) => setForm({ open: true, editing: null, prefill: p })} />
      <ConfirmDialog open={!!del} danger title="Delete goal?" confirmLabel="Delete"
        message={`"${del?.title}" will be removed from your lists. Its historical progress is preserved for analytics.`}
        onClose={() => setDel(null)} onConfirm={() => { const g = del!; setDel(null); act(() => goalsApi.remove(g.id), 'Goal deleted'); }} />
      <Drawer open={!!hist} onClose={() => setHist(null)} title="Goal history">
        {hist && <HistoryList goalId={hist.id} userId={viewUserId} />}
      </Drawer>
    </div>
  );
}

export function HistoryList({ goalId, userId }: { goalId: string; userId?: string }) {
  const { data, loading, error, reload } = useAsync(() => goalsApi.history(goalId, userId), [goalId, userId]);
  if (loading) return <EmojiLoader compact />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.length) return <p className="text-sm text-subtle">No history yet.</p>;
  const show = (v: unknown) => {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object') return String(v);
    return Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x !== 'object' || x === null).map(([k, x]) => `${k}: ${x ?? '—'}`).join(' · ');
  };
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-5">
      {data.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-gradient-to-br from-primary to-secondary ring-4 ring-surface" />
          <p className="text-sm font-semibold">{titleCase(h.action)}</p>
          <p className="text-xs text-subtle">{fmtDateTime(h.created_at)}</p>
          {show(h.new_value) && <p className="mt-1 break-words rounded-lg bg-muted/70 p-2 text-xs">{show(h.new_value)}</p>}
        </li>
      ))}
    </ol>
  );
}
