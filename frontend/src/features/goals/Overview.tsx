import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { CalendarCheck, Clock, Flame, ListTodo, Percent, Target } from 'lucide-react';
import { goalsApi, progressApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Badge, CardSkeletonGrid, EmptyState, ErrorState, ProgressBar, Skeleton, StatCard } from '@/components/common/ui';
import { ChartCard, NoChartData, useChartTheme, pctFmt } from '@/components/common/charts';
import { IMPORTANCE_META, WEEKDAYS_SHORT, colorFor, fmtDate, hhmm, pct, weekdayIndex } from '@/utils/format';
import { StatusDot } from '@/components/progress/StatusDot';

export default function Overview() {
  const { viewUserId, owner, readOnly } = useWorkspace();
  const t = useChartTheme();
  const daily = useAsync(() => progressApi.daily(undefined, viewUserId), [viewUserId]);
  const weekly = useAsync(() => progressApi.weekly(undefined, viewUserId), [viewUserId]);
  const goals = useAsync(() => goalsApi.list({ user_id: viewUserId, status: 'ACTIVE', sort: 'end_date' }), [viewUserId]);
  const streaks = useAsync(() => progressApi.streaks(viewUserId), [viewUserId]);

  const base = `/u/${owner.id}`;
  const d = daily.data;
  const tasks = d?.items ?? [];
  const pending = tasks.filter((i) => i.completion_status === null);
  const weekRows = (weekly.data?.days ?? []).map((x) => ({ day: WEEKDAYS_SHORT[weekdayIndex(x.date)], rate: x.completion_rate }));
  const upcoming = (goals.data?.items ?? []).filter((g) => g.days_remaining >= 0).slice(0, 5);

  return (
    <div className="space-y-6">
      {daily.loading ? <CardSkeletonGrid n={4} /> : daily.error ? <ErrorState message={daily.error} onRetry={daily.reload} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={<Target className="h-5 w-5" />} label="Active goals" value={goals.data?.total ?? '—'} />
          <StatCard icon={<ListTodo className="h-5 w-5" />} label="Today's items" value={d?.summary.total ?? 0} hint={`${pending.length} pending`} tone="accent" delay={60} />
          <StatCard icon={<Percent className="h-5 w-5" />} label="Today's completion" value={pct(d?.summary.completion_rate)} tone="success" delay={120} />
          <StatCard icon={<Flame className="h-5 w-5" />} label="Current streak" value={`${streaks.data?.current_streak ?? 0}d`} hint={`Best ${streaks.data?.longest_streak ?? 0}d`} tone="warning" delay={180} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card card-pad lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold"><CalendarCheck className="h-5 w-5 text-primary" />Today</h3>
            <Link to={`${base}/progress`} className="text-sm font-semibold text-primary hover:underline">{readOnly ? 'View progress' : 'Check in →'}</Link>
          </div>
          {daily.loading ? <Skeleton className="h-40" /> : !tasks.length ? (
            <EmptyState title="Nothing for today" message={readOnly ? 'No active goals or scheduled tasks today.' : 'Create a goal to start tracking — no timetable needed.'}
              action={!readOnly && <Link className="btn-primary" to={`${base}/goals`}>Create a goal</Link>} />
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 7).map((i) => (
                <li key={i.key} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                  <span className="h-9 w-1.5 rounded-full" style={{ background: colorFor(i.category_color) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.title}</p>
                    <p className="text-xs text-subtle">{i.kind === 'TASK' ? `${hhmm(i.start_time)}–${hhmm(i.end_time)} · ` : 'Daily check-in · '}{i.category_name}</p>
                  </div>
                  <StatusDot status={i.completion_status} past={i.is_past} />
                </li>
              ))}
              {tasks.length > 7 && <p className="text-center text-xs text-subtle">+{tasks.length - 7} more</p>}
            </ul>
          )}
        </div>

        <ChartCard title="This week" subtitle={weekly.data ? `${pct(weekly.data.summary.completion_rate)} overall` : undefined}>
          {weekly.loading ? <Skeleton className="h-40" /> : !weekRows.some((r) => r.rate !== null) ? <NoChartData text="No check-ins this week yet." /> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weekRows} margin={{ left: 0, right: 0, top: 10 }}>
                <defs>
                  <linearGradient id="ov" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.palette.secondary} stopOpacity={0.5} /><stop offset="100%" stopColor={t.palette.secondary} stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="day" {...t.axis} />
                <Tooltip {...t.tooltip} formatter={pctFmt} />
                <Area type="monotone" dataKey="rate" name="Completion" stroke={t.palette.secondary} strokeWidth={3} fill="url(#ov)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold"><Clock className="h-5 w-5 text-warning" />Upcoming deadlines</h3>
          <Link to={`${base}/goals`} className="text-sm font-semibold text-primary hover:underline">All goals →</Link>
        </div>
        {goals.loading ? <Skeleton className="h-24" /> : !upcoming.length ? <p className="py-4 text-center text-sm text-subtle">No upcoming deadlines.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((g) => (
              <div key={g.id} className="rounded-2xl border border-border/60 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge className={IMPORTANCE_META[g.importance].cls}>{IMPORTANCE_META[g.importance].label}</Badge>
                  <span className={`text-xs font-semibold ${g.days_remaining <= 3 ? 'text-danger' : 'text-subtle'}`}>{g.days_remaining === 0 ? 'Due today' : `${g.days_remaining}d left`}</span>
                </div>
                <p className="truncate font-semibold">{g.title}</p>
                <p className="mb-2 text-xs text-subtle">{g.category_name} · ends {fmtDate(g.end_date)}</p>
                <ProgressBar value={g.progress.completion_rate} color={colorFor(g.category_color)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
