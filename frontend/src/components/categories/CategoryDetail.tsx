import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Clock, Plus, Target, Trophy } from 'lucide-react';
import type { Goal, GoalStatus } from '@/types';
import { categoriesApi, goalsApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmDialog, Drawer, EmptyState, ErrorState, ProgressRing, Skeleton } from '@/components/common/ui';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { ChartCard, NoChartData, pctFmt, useChartTheme } from '@/components/common/charts';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalFormModal } from '@/components/goals/GoalFormModal';
import { HistoryList } from '@/components/goals/GoalsSection';
import { Lumi } from '@/components/brand/Lumi';
import { colorFor, titleCase } from '@/utils/format';

const STATUS_COLORS: Record<string, string> = { ACTIVE: '#6366f1', COMPLETED: '#10b981', PAUSED: '#f59e0b', DRAFT: '#94a3b8', CANCELLED: '#ef4444' };

/** Drill-down for one category: header, charts and the goals inside it. */
export default function CategoryDetail({ categoryId }: { categoryId: string }) {
  const { readOnly, viewUserId, owner } = useWorkspace();
  const toast = useToast();
  const t = useChartTheme();
  const cats = useAsync(() => categoriesApi.list({ user_id: viewUserId }), [viewUserId]);
  const goals = useAsync(() => goalsApi.list({ user_id: viewUserId, category_id: categoryId, sort: 'end_date' }), [viewUserId, categoryId]);
  const [form, setForm] = useState<{ open: boolean; editing: Goal | null }>({ open: false, editing: null });
  const [del, setDel] = useState<Goal | null>(null);
  const [hist, setHist] = useState<Goal | null>(null);

  const cat = cats.data?.find((c) => c.id === categoryId);
  const color = colorFor(cat?.color, cats.data?.indexOf(cat!) ?? 0);
  const items = goals.data?.items ?? [];
  // stable references: GoalFormModal resets its form whenever these change
  const lockedCats = useMemo(() => (cat ? [cat] : []), [cat]);
  const prefill = useMemo(() => (cat ? { category_id: cat.id } : null), [cat]);
  const base = `/u/${owner.id}/categories`;

  const statusData = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((g) => m.set(g.status, (m.get(g.status) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name: titleCase(name), value, color: STATUS_COLORS[name] ?? color }));
  }, [items, color]);
  const rateData = items.filter((g) => g.progress.completion_rate !== null)
    .map((g) => ({ name: g.title.length > 14 ? `${g.title.slice(0, 13)}…` : g.title, value: g.progress.completion_rate ?? 0 }));

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); goals.reload(true); cats.reload(true); } catch (e) { toast.apiError(e); }
  };

  if (cats.loading) return <div className="space-y-4"><Skeleton className="h-44" /><Skeleton className="h-64" /></div>;
  if (cats.error) return <ErrorState message={cats.error} onRetry={cats.reload} />;
  if (!cat) return <div className="card"><EmptyState title="Category not found" message="It may have been deactivated." action={<Link className="btn-outline" to={base}><ArrowLeft className="h-4 w-4" />Back to categories</Link>} /></div>;

  const canAdd = !readOnly && cat.is_active;

  return (
    <div className="space-y-6">
      <Link to={base} className="btn-ghost btn-sm -ml-2 w-fit"><ArrowLeft className="h-4 w-4" />All categories</Link>

      {/* hero */}
      <div className="card relative overflow-hidden animate-fade-up">
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(90% 120% at 100% 0%, ${color}, transparent 60%)` }} />
        <div className="relative flex flex-wrap items-center gap-5 p-6 sm:p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}>
            <CategoryIcon name={cat.icon} className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-subtle">{readOnly ? `${owner.name}'s category` : 'Category'}</p>
            <h2 className="font-brand text-3xl font-semibold sm:text-4xl">{cat.name}</h2>
            <p className="mt-1 max-w-xl text-sm text-subtle">{cat.description || 'No description yet.'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip bg-muted text-fg"><Target className="h-3.5 w-3.5" />{cat.active_goal_count} active</span>
              <span className="chip bg-muted text-fg"><Trophy className="h-3.5 w-3.5" />{cat.completed_goal_count} completed</span>
              <span className="chip bg-muted text-fg"><Clock className="h-3.5 w-3.5" />{cat.hours_per_week ?? 0}h / week</span>
            </div>
          </div>
          <ProgressRing value={cat.completion_rate} size={110} stroke={10} color={color} sub="completion" />
          {canAdd && (
            <button className="btn-primary w-full sm:w-auto" onClick={() => setForm({ open: true, editing: null })}>
              <Plus className="h-4 w-4" />Add goal to {cat.name}
            </button>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <ChartCard title="Goals by status" subtitle={`${items.length} goals in ${cat.name}`}>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={4} cornerRadius={8} stroke="none">
                  {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip {...t.tooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3">
              {statusData.map((d) => <span key={d.name} className="flex items-center gap-1 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name} · {d.value}</span>)}
            </div>
          </ChartCard>
          <ChartCard title="Completion per goal" subtitle="Done ÷ evaluated check-ins">
            {!rateData.length ? <NoChartData text="No evaluated check-ins yet." /> : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={rateData} margin={{ left: -20, right: 4 }}>
                  <XAxis dataKey="name" {...t.axis} interval={0} tick={{ fontSize: 10, fill: t.palette.subtle }} />
                  <YAxis domain={[0, 100]} {...t.axis} />
                  <Tooltip {...t.tooltip} formatter={pctFmt} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill={color} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      <section>
        <h3 className="mb-3 font-bold">Goals in {cat.name}</h3>
        {goals.loading ? <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          : goals.error ? <ErrorState message={goals.error} onRetry={goals.reload} />
          : !items.length ? (
            <div className="card flex flex-col items-center px-4 py-10 text-center">
              <Lumi size={96} mood="think" />
              <h4 className="mt-2 text-lg font-bold">No goals here yet</h4>
              <p className="mt-1 max-w-sm text-sm text-subtle">{readOnly ? `${owner.name} hasn't added goals to ${cat.name}.` : `What would you like to achieve in ${cat.name}?`}</p>
              {canAdd && <button className="btn-primary mt-4" onClick={() => setForm({ open: true, editing: null })}><Plus className="h-4 w-4" />Add the first goal</button>}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((g) => (
                <GoalCard key={g.id} g={g} readOnly={readOnly}
                  onEdit={() => setForm({ open: true, editing: g })}
                  onDelete={() => setDel(g)}
                  onHistory={() => setHist(g)}
                  onStatus={(s: GoalStatus) => act(() => goalsApi.setStatus(g.id, s), `Marked ${titleCase(s)}`)}
                  onMilestone={(mid, done) => act(() => goalsApi.setMilestone(g.id, mid, done ? 'COMPLETED' : 'PENDING'), done ? 'Milestone completed 🎉' : 'Milestone reopened')}
                  onApprove={(ok) => act(() => goalsApi.approve(g.id, ok), ok ? 'Goal approved and active' : 'Suggestion rejected')}
                />
              ))}
            </div>
          )}
      </section>

      {!readOnly && (
        <GoalFormModal open={form.open} editing={form.editing} categories={form.editing ? (cats.data ?? []) : lockedCats}
          prefill={form.editing ? null : prefill} lockCategory={!form.editing}
          onClose={() => setForm({ open: false, editing: null })} onSaved={() => { goals.reload(true); cats.reload(true); }} />
      )}
      <ConfirmDialog open={!!del} danger title="Delete goal?" confirmLabel="Delete"
        message={`"${del?.title}" will be removed from your lists. Its historical progress is preserved for analytics.`}
        onClose={() => setDel(null)} onConfirm={() => { const g = del!; setDel(null); act(() => goalsApi.remove(g.id), 'Goal deleted'); }} />
      <Drawer open={!!hist} onClose={() => setHist(null)} title="Goal history">
        {hist && <HistoryList goalId={hist.id} userId={viewUserId} />}
      </Drawer>
    </div>
  );
}
