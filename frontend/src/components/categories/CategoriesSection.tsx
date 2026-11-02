import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Shapes } from 'lucide-react';
import type { Category } from '@/types';
import { categoriesApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmDialog, EmptyState, ErrorState, SectionHeader, Skeleton } from '@/components/common/ui';
import { ChartCard, NoChartData, useChartTheme, pctFmt } from '@/components/common/charts';
import { CategoryCard } from './CategoryCard';
import { CategoryFormModal } from './CategoryFormModal';
import { colorFor } from '@/utils/format';

export default function CategoriesSection() {
  const { readOnly, viewUserId, owner } = useWorkspace();
  const { user } = useAuth();
  const toast = useToast();
  const t = useChartTheme();
  const nav = useNavigate();
  const open = (c: Category) => nav(`/u/${owner.id}/categories/${c.id}`);
  const { data, loading, error, reload } = useAsync(() => categoriesApi.list({ user_id: viewUserId }), [viewUserId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null });
  const [confirm, setConfirm] = useState<Category | null>(null);

  const all = data ?? [];
  const selected = all.filter((c) => c.is_selected);
  const others = all.filter((c) => !c.is_selected);
  const indexOf = (c: Category) => all.indexOf(c);

  const toggle = async (c: Category) => {
    setBusy(c.id);
    try {
      if (c.is_selected) await categoriesApi.unselect(c.id); else await categoriesApi.select(c.id);
      toast.success(c.is_selected ? `Removed ${c.name}` : `Added ${c.name}`);
      await reload(true);
    } catch (e) { toast.apiError(e); } finally { setBusy(null); }
  };

  const deactivate = async () => {
    if (!confirm) return;
    try { await categoriesApi.deactivate(confirm.id); toast.success('Category deactivated', 'Existing goals are kept.'); setConfirm(null); reload(true); }
    catch (e) { toast.apiError(e); }
  };

  const canEdit = (c: Category) => !c.is_default && c.created_by === user?.id;

  const hoursData = selected.filter((c) => (c.hours_per_week ?? 0) > 0).map((c) => ({ name: c.name, value: c.hours_per_week ?? 0, color: colorFor(c.color, indexOf(c)) }));
  const totalHours = hoursData.reduce((s, x) => s + x.value, 0);
  const radial = selected.filter((c) => c.completion_rate !== null).map((c) => ({ name: c.name, value: c.completion_rate ?? 0, fill: colorFor(c.color, indexOf(c)) }));
  const goalBars = selected.map((c) => ({ name: c.name, Active: c.active_goal_count, Done: c.completed_goal_count, color: colorFor(c.color, indexOf(c)) }));

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}</div>;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={readOnly ? `${owner.name}'s categories` : 'My categories'}
        subtitle={readOnly ? 'Focus areas they are working on. Click a card to see its goals.' : 'Click a card to see and add its goals. Selecting a category never creates a timetable on its own.'}
        icon={<Shapes className="h-5 w-5" />}
        actions={!readOnly && <button className="btn-primary" onClick={() => setForm({ open: true, editing: null })}><Plus className="h-4 w-4" />Custom category</button>}
      />

      {selected.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard title="Weekly hours" subtitle={`${totalHours}h allocated per week`}>
            {!hoursData.length ? <NoChartData text={readOnly ? 'No weekly hours set.' : 'Set weekly hours in Settings → Category time.'} /> : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={hoursData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85} paddingAngle={4} cornerRadius={8} stroke="none">
                      {hoursData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip {...t.tooltip} formatter={(v: number) => `${v}h / week`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-2xl font-extrabold">{totalHours}h</span>
                  <span className="text-[10px] uppercase text-subtle">per week</span>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {hoursData.map((d) => <span key={d.name} className="flex items-center gap-1 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span>)}
                </div>
              </div>
            )}
          </ChartCard>
          <ChartCard title="Completion by category" subtitle="Done ÷ evaluated check-ins">
            {!radial.length ? <NoChartData text="No evaluated check-ins yet." /> : (
              <ResponsiveContainer width="100%" height={230}>
                <RadialBarChart data={radial} innerRadius="25%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={12}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={10} background={{ fill: t.palette.muted }} />
                  <Tooltip {...t.tooltip} formatter={pctFmt} />
                </RadialBarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
          <ChartCard title="Goals per category" subtitle="Active vs completed">
            {!goalBars.some((g) => g.Active + g.Done > 0) ? <NoChartData text="No goals yet." /> : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={goalBars} margin={{ left: -24, right: 4 }}>
                  <XAxis dataKey="name" {...t.axis} interval={0} tick={{ fontSize: 10, fill: t.palette.subtle }} />
                  <YAxis allowDecimals={false} {...t.axis} />
                  <Tooltip {...t.tooltip} />
                  <Bar dataKey="Active" stackId="g" radius={[0, 0, 6, 6]}>{goalBars.map((g) => <Cell key={g.name} fill={g.color} />)}</Bar>
                  <Bar dataKey="Done" stackId="g" radius={[6, 6, 0, 0]}>{goalBars.map((g) => <Cell key={g.name} fill={g.color} fillOpacity={0.45} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      <section>
        <h3 className="mb-3 font-bold">{readOnly ? 'Selected categories' : `Selected (${selected.length})`}</h3>
        {!selected.length ? (
          <div className="card"><EmptyState title="No categories selected" message={readOnly ? `${owner.name} hasn't picked any categories yet.` : 'Select a category below to start organising your goals.'} /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selected.map((c) => (
              <CategoryCard key={c.id} c={c} i={indexOf(c)} readOnly={readOnly} busy={busy === c.id} canEdit={canEdit(c)} onOpen={() => open(c)}
                onToggle={() => toggle(c)} onEdit={() => setForm({ open: true, editing: c })} onDeactivate={() => setConfirm(c)} />
            ))}
          </div>
        )}
      </section>

      {!readOnly && others.length > 0 && (
        <section>
          <h3 className="mb-3 font-bold">Discover more</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((c) => (
              <CategoryCard key={c.id} c={c} i={indexOf(c)} readOnly={readOnly} busy={busy === c.id} canEdit={canEdit(c)}
                onToggle={() => toggle(c)} onEdit={() => setForm({ open: true, editing: c })} onDeactivate={() => setConfirm(c)} />
            ))}
          </div>
        </section>
      )}

      <CategoryFormModal open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} onSaved={() => reload(true)} />
      <ConfirmDialog open={!!confirm} title="Deactivate category?" danger confirmLabel="Deactivate"
        message={`"${confirm?.name}" will be hidden. Goals already in it and their history are preserved.`}
        onConfirm={deactivate} onClose={() => setConfirm(null)} />
    </div>
  );
}
