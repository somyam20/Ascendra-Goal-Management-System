import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CheckCircle2, Percent, Target, XCircle } from 'lucide-react';
import { progressApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { CardSkeletonGrid, ErrorState, ProgressBar, SectionHeader, Segmented, Skeleton, StatCard } from '@/components/common/ui';
import { ChartCard, NoChartData, useChartTheme, pctFmt } from '@/components/common/charts';
import { addDays, colorFor, fmtDate, pct, titleCase, today } from '@/utils/format';

const RANGES = { '7': 7, '30': 30, '90': 90 } as const;

export default function AnalyticsSection() {
  const { viewUserId, readOnly, owner } = useWorkspace();
  const t = useChartTheme();
  const [range, setRange] = useState<keyof typeof RANGES>('30');
  const p = useMemo(() => ({ start: addDays(today(), -(RANGES[range] - 1)), end: today(), user_id: viewUserId }), [range, viewUserId]);
  const { data, loading, error, reload } = useAsync(() => progressApi.analytics(p), [p]);
  const streaks = useAsync(() => progressApi.streaks(viewUserId), [viewUserId]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = data?.summary;
  const daily = (data?.daily ?? []).map((d) => ({ day: fmtDate(d.date), rate: d.completion_rate, Done: d.completed }));
  const weekly = (data?.weekly ?? []).map((w) => ({ week: fmtDate(w.week_start), rate: w.completion_rate }));
  const cats = (data?.categories ?? []).map((c, i) => ({ name: c.name, rate: c.completion_rate ?? 0, evaluated: c.completed + c.not_completed, color: colorFor(c.color, i) }));
  const statusColors: Record<string, string> = { ACTIVE: t.palette.primary, COMPLETED: t.palette.success, PAUSED: t.palette.warning, CANCELLED: t.palette.danger, DRAFT: t.palette.subtle };
  const statuses = Object.entries(data?.goal_status_counts ?? {}).filter(([, n]) => n > 0).map(([k, n]) => ({ name: titleCase(k), value: n, color: statusColors[k] ?? t.palette.accent }));

  return (
    <div className="space-y-5">
      <SectionHeader title={readOnly ? `${owner.name}'s analytics` : 'My analytics'} icon={<BarChart3 className="h-5 w-5" />}
        actions={<Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />} />

      {loading ? <CardSkeletonGrid n={4} /> : s && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={<Percent className="h-5 w-5" />} label="Completion" value={pct(s.completion_rate)} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Done" value={s.completed} tone="success" delay={60} />
          <StatCard icon={<XCircle className="h-5 w-5" />} label="Not done" value={s.not_completed} tone="danger" delay={120} hint={`${s.unmarked} unmarked`} />
          <StatCard icon={<Target className="h-5 w-5" />} label="Consistency (30d)" value={pct(streaks.data?.consistency_rate)} tone="warning" delay={180} hint={`${streaks.data?.current_streak ?? 0}-day streak`} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Daily trend" subtitle="Completion rate per day">
          {loading ? <Skeleton className="h-60" /> : !daily.some((d) => d.rate !== null) ? <NoChartData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={daily} margin={{ left: -18, right: 6 }}>
                <defs><linearGradient id="an-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.palette.primary} stopOpacity={0.45} /><stop offset="100%" stopColor={t.palette.primary} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid {...t.grid} />
                <XAxis dataKey="day" {...t.axis} minTickGap={16} />
                <YAxis domain={[0, 100]} unit="%" {...t.axis} />
                <Tooltip {...t.tooltip} formatter={pctFmt} />
                <Area type="monotone" dataKey="rate" name="Completion" stroke={t.palette.primary} strokeWidth={2.5} fill="url(#an-d)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Weekly trend" subtitle="Completion rate per week">
          {loading ? <Skeleton className="h-60" /> : !weekly.some((w) => w.rate !== null) ? <NoChartData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weekly} margin={{ left: -18, right: 6 }}>
                <CartesianGrid {...t.grid} />
                <XAxis dataKey="week" {...t.axis} />
                <YAxis domain={[0, 100]} unit="%" {...t.axis} />
                <Tooltip {...t.tooltip} formatter={pctFmt} />
                <Line type="monotone" dataKey="rate" name="Completion" stroke={t.palette.secondary} strokeWidth={3} dot={{ r: 4, fill: t.palette.secondary }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Category performance">
          {loading ? <Skeleton className="h-60" /> : !cats.some((c) => c.evaluated) ? <NoChartData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cats} margin={{ left: -18, right: 6 }}>
                <CartesianGrid {...t.grid} />
                <XAxis dataKey="name" {...t.axis} />
                <YAxis domain={[0, 100]} unit="%" {...t.axis} />
                <Tooltip {...t.tooltip} formatter={pctFmt} />
                <Bar dataKey="rate" name="Completion" radius={[8, 8, 0, 0]} barSize={34}>{cats.map((c) => <Cell key={c.name} fill={c.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Goal status" subtitle="All goals">
          {loading ? <Skeleton className="h-60" /> : !statuses.length ? <NoChartData text="No goals yet." /> : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statuses} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} cornerRadius={6} stroke="none">
                    {statuses.map((x) => <Cell key={x.name} fill={x.color} />)}
                  </Pie>
                  <Tooltip {...t.tooltip} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="w-full space-y-1.5 sm:w-48">
                {statuses.map((x) => <li key={x.name} className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full" style={{ background: x.color }} /><span className="flex-1">{x.name}</span><b>{x.value}</b></li>)}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="card card-pad">
        <h3 className="mb-3 font-bold">Goal progress</h3>
        {loading ? <Skeleton className="h-32" /> : !data?.goals.length ? <p className="text-sm text-subtle">No goal activity in this range.</p> : (
          <ul className="space-y-3">
            {data.goals.map((g) => (
              <li key={g.goal_id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm"><span className="truncate font-medium">{g.title}</span><span className="text-subtle">{g.completed}/{g.completed + g.not_completed} · <b className="text-fg">{pct(g.completion_rate)}</b></span></div>
                <ProgressBar value={g.completion_rate} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
