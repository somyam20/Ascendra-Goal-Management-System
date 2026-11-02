import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Award, CalendarClock, CheckCircle2, Flag, PartyPopper, Percent, Target, Users } from 'lucide-react';
import { dashboardApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import type { Period } from '@/types';
import { Avatar, Badge, CardSkeletonGrid, EmptyState, ErrorState, Segmented, Skeleton, StatCard } from '@/components/common/ui';
import { ChartCard, NoChartData, useChartTheme, pctFmt } from '@/components/common/charts';
import { Leaderboard } from '@/components/dashboard/Leaderboard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { UserPerformanceCard } from '@/components/dashboard/UserPerformanceCard';
import { Lumi } from '@/components/brand/Lumi';
import { IMPORTANCE_META, colorFor, fmtDate, pct, timeAgo, today, addDays } from '@/utils/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const { user } = useAuth();
  const t = useChartTheme();
  const [period, setPeriod] = useState<Period>('weekly');
  const [custom, setCustom] = useState({ start: addDays(today(), -13), end: today() });
  const pp = useMemo(() => (period === 'custom' ? { period, ...custom } : { period }), [period, custom]);

  const summary = useAsync(() => dashboardApi.summary(pp), [pp]);
  const users = useAsync(() => dashboardApi.users(pp), [pp]);
  const cats = useAsync(() => dashboardApi.categories(pp), [pp]);
  const deadlines = useAsync(() => dashboardApi.deadlines(14), []);
  const ach = useAsync(() => dashboardApi.achievements(), []);

  const s = summary.data;
  const userBars = (users.data ?? []).map((u) => ({ name: u.name, Completed: u.completed, 'Not done': u.not_completed, rate: u.completion_rate, color: u.avatar_color }));
  const catBars = (cats.data ?? []).map((c, i) => ({ name: c.category_name, rate: c.completion_rate ?? 0, evaluated: c.completed + c.not_completed, color: colorFor(c.color, i) }));

  return (
    <div className="space-y-6">
      <div className="card relative overflow-hidden p-6 sm:p-8 animate-fade-up">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-primary/30 to-secondary/20 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-gradient-to-tr from-accent/25 to-transparent blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <Lumi size={96} mood={(s?.group_completion_rate ?? 0) >= 80 ? 'cheer' : 'wave'} className="hidden shrink-0 sm:block" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-primary">{greeting()}</p>
              <h1 className="font-brand text-4xl font-semibold sm:text-5xl">{user?.name}</h1>
              <p className="mt-1 text-subtle">Here's how the whole group is rising{s ? ` · ${fmtDate(s.start)} – ${fmtDate(s.end)}` : ''}.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={period} onChange={setPeriod} options={[
              { value: 'daily', label: 'Today' }, { value: 'weekly', label: 'Week' }, { value: 'monthly', label: 'Month' }, { value: 'custom', label: 'Custom' },
            ]} />
            {period === 'custom' && (
              <div className="flex items-center gap-1">
                <input type="date" className="input w-auto py-1.5" value={custom.start} max={custom.end} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} aria-label="Start date" />
                <span className="text-subtle">–</span>
                <input type="date" className="input w-auto py-1.5" value={custom.end} min={custom.start} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} aria-label="End date" />
              </div>
            )}
          </div>
        </div>
      </div>

      {summary.loading ? <CardSkeletonGrid n={4} /> : summary.error ? <ErrorState message={summary.error} onRetry={summary.reload} /> : s && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={<Users className="h-5 w-5" />} label="Members" value={s.total_users} hint={`${s.total_active_goals} active goals`} />
          <StatCard icon={<Flag className="h-5 w-5" />} label="Goals completed" value={s.total_completed_goals} tone="success" delay={60} />
          <StatCard icon={<Activity className="h-5 w-5" />} label="Evaluated tasks" value={s.total_evaluated_tasks} hint={`${s.total_completed_tasks} done`} tone="accent" delay={120} />
          <StatCard icon={<Percent className="h-5 w-5" />} label="Group completion" value={pct(s.group_completion_rate)} hint={`Week ${pct(s.weekly_completion_rate)} · Month ${pct(s.monthly_completion_rate)}`} tone="secondary" delay={180} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><TrendChart start={period === 'custom' ? custom.start : undefined} end={period === 'custom' ? custom.end : undefined} /></div>
        <Leaderboard />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Individual performance</h2>
        {users.loading ? <CardSkeletonGrid n={3} /> : users.error ? <ErrorState message={users.error} onRetry={users.reload} />
          : !users.data?.length ? <div className="card"><EmptyState title="No members yet" message="An admin can add users from the Admin panel." /></div>
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{users.data.map((u, i) => <UserPerformanceCard key={u.user_id} u={u} i={i} />)}</div>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Group performance" subtitle="Completed vs not done per member">
          {users.loading ? <Skeleton className="h-64" /> : !userBars.some((b) => b.Completed + b['Not done'] > 0) ? <NoChartData /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={userBars} margin={{ left: -18, right: 8 }}>
                <CartesianGrid {...t.grid} />
                <XAxis dataKey="name" {...t.axis} />
                <YAxis allowDecimals={false} {...t.axis} />
                <Tooltip {...t.tooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Completed" stackId="a" fill={t.palette.success} radius={[0, 0, 6, 6]} />
                <Bar dataKey="Not done" stackId="a" fill={t.palette.danger} radius={[6, 6, 0, 0]} fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Category comparison" subtitle="Completion rate across all members">
          {cats.loading ? <Skeleton className="h-64" /> : !catBars.some((c) => c.evaluated > 0) ? <NoChartData /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={catBars} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid {...t.grid} horizontal={false} vertical />
                <XAxis type="number" domain={[0, 100]} unit="%" {...t.axis} />
                <YAxis type="category" dataKey="name" width={90} {...t.axis} />
                <Tooltip {...t.tooltip} formatter={pctFmt} />
                <Bar dataKey="rate" name="Completion" radius={[0, 8, 8, 0]} barSize={18}>
                  {catBars.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Upcoming deadlines" subtitle="Next 14 days, everyone">
          {deadlines.loading ? <Skeleton className="h-48" /> : deadlines.error ? <ErrorState message={deadlines.error} onRetry={deadlines.reload} />
            : !deadlines.data?.length ? <EmptyState title="No deadlines soon" message="Nothing due in the next two weeks." face="chill" /> : (
              <ul className="space-y-2">
                {deadlines.data.map((d) => (
                  <li key={d.goal_id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white" style={{ background: colorFor(d.category_color) }}>
                      <span className="text-lg font-extrabold leading-none">{d.days_remaining}</span>
                      <span className="text-[9px] uppercase">days</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{d.title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-subtle"><Avatar name={d.user_name} color={d.avatar_color} size={16} />{d.user_name} · {d.category_name} · {fmtDate(d.end_date)}</p>
                    </div>
                    <Badge className={IMPORTANCE_META[d.importance].cls}>{IMPORTANCE_META[d.importance].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
        </ChartCard>
        <ChartCard title="Recent achievements" subtitle="Celebrate the group's wins">
          {ach.loading ? <Skeleton className="h-48" /> : ach.error ? <ErrorState message={ach.error} onRetry={ach.reload} />
            : !ach.data?.length ? <EmptyState title="No achievements yet" message="Completed goals and milestones will show up here." /> : (
              <ul className="space-y-2">
                {ach.data.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-muted/60">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.kind === 'GOAL_COMPLETED' ? 'bg-success/15 text-success' : 'bg-secondary/15 text-secondary'}`}>
                      {a.kind === 'GOAL_COMPLETED' ? <Award className="h-5 w-5" /> : <PartyPopper className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm"><b>{a.user_name}</b> {a.kind === 'GOAL_COMPLETED' ? 'completed goal' : 'hit milestone'} <b>{a.title}</b></p>
                      <p className="text-xs text-subtle">{timeAgo(a.completed_at)}</p>
                    </div>
                    <Avatar name={a.user_name} color={a.avatar_color} size={26} />
                  </li>
                ))}
              </ul>
            )}
        </ChartCard>
      </div>
      <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-subtle">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completion = done ÷ (done + not done). Unmarked tasks never count against anyone. <CalendarClock className="h-3.5 w-3.5" /> <Target className="h-3.5 w-3.5" />
      </p>
    </div>
  );
}
