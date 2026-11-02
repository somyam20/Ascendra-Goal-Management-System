import { Lumi } from '@/components/brand/Lumi';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, Check, CheckSquare, ChevronLeft, ChevronRight, Flame, RotateCcw, Trophy, X } from 'lucide-react';
import type { CompletionStatus, DailyItem } from '@/types';
import { progressApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { Badge, EmptyState, ErrorState, ProgressRing, SectionHeader, Skeleton } from '@/components/common/ui';
import { ChartCard, NoChartData, useChartTheme } from '@/components/common/charts';
import { StatusDot } from './StatusDot';
import { IMPORTANCE_META, addDays, colorFor, fmtDate, hhmm, pct, today } from '@/utils/format';

export default function ProgressSection() {
  const { readOnly, viewUserId, owner } = useWorkspace();
  const toast = useToast();
  const t = useChartTheme();
  const [date, setDate] = useState(today());
  const daily = useAsync(() => progressApi.daily(date, viewUserId), [date, viewUserId]);
  const hist = useAsync(() => progressApi.history(addDays(today(), -13), today(), viewUserId), [viewUserId]);
  const streaks = useAsync(() => progressApi.streaks(viewUserId), [viewUserId]);
  const [pending, setPending] = useState<string | null>(null);

  const mark = async (it: DailyItem, status: CompletionStatus) => {
    setPending(it.key);
    // optimistic update
    daily.setData((d) => d && { ...d, items: d.items.map((x) => (x.key === it.key ? { ...x, completion_status: status } : x)) });
    try {
      if (it.progress_id) await progressApi.update(it.progress_id, status);
      else await progressApi.mark({ goal_id: it.goal_id, task_id: it.task_id, activity_date: it.activity_date, completion_status: status });
      if (status === 1) toast.success('Nice work! ✅', it.title);
      await Promise.all([daily.reload(true), hist.reload(true), streaks.reload(true)]);
    } catch (e) {
      toast.apiError(e, 'Could not save');
      daily.reload(true);
    } finally { setPending(null); }
  };

  const d = daily.data;
  const isFuture = date > today();
  const tasks = d?.items.filter((i) => i.kind === 'TASK') ?? [];
  const goalItems = d?.items.filter((i) => i.kind === 'GOAL') ?? [];
  const chart = (hist.data?.days ?? []).map((x) => ({ day: fmtDate(x.date, { weekday: 'short', day: 'numeric' }), Done: x.completed, 'Not done': x.not_completed, Unmarked: x.unmarked }));

  const renderItem = (it: DailyItem) => {
    const c = colorFor(it.category_color);
    const s = it.completion_status;
    return (
      <li key={it.key} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition ${s === 1 ? 'border-success/30 bg-success/5' : s === 0 ? 'border-danger/25 bg-danger/5' : 'border-border/60'}`}>
        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${s === 1 ? 'line-through decoration-success/60' : ''}`}>{it.title}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-subtle">
            {it.kind === 'TASK' && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{hhmm(it.start_time)}–{hhmm(it.end_time)}</span>}
            <span style={{ color: c }}>{it.category_name}</span>
            {it.kind === 'TASK' && <span>· {it.goal_title}</span>}
            <Badge className={`${IMPORTANCE_META[it.importance].cls} text-[10px]`}>{IMPORTANCE_META[it.importance].label}</Badge>
          </p>
        </div>
        {readOnly || isFuture ? <StatusDot status={s} past={it.is_past} /> : (
          <div className="flex items-center gap-1.5">
            <button disabled={pending === it.key} onClick={() => mark(it, s === 1 ? null : 1)} aria-pressed={s === 1} aria-label={`Mark ${it.title} done`}
              className={`btn btn-sm ${s === 1 ? 'bg-success text-white shadow-md' : 'bg-success/10 text-success hover:bg-success/20'}`}><Check className="h-3.5 w-3.5" />Done</button>
            <button disabled={pending === it.key} onClick={() => mark(it, s === 0 ? null : 0)} aria-pressed={s === 0} aria-label={`Mark ${it.title} not done`}
              className={`btn btn-sm ${s === 0 ? 'bg-danger text-white shadow-md' : 'bg-danger/10 text-danger hover:bg-danger/20'}`}><X className="h-3.5 w-3.5" />Not done</button>
            {s !== null && <button disabled={pending === it.key} onClick={() => mark(it, null)} className="btn-ghost btn-sm h-8 w-8 p-0" title="Clear (unmarked)" aria-label="Clear status"><RotateCcw className="h-3.5 w-3.5" /></button>}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <SectionHeader title={readOnly ? `${owner.name}'s daily progress` : 'Daily progress'} icon={<CheckSquare className="h-5 w-5" />}
        subtitle="Unmarked items are never counted as failures."
        actions={
          <div className="flex items-center gap-1">
            <button className="btn-outline btn-sm h-9 w-9 p-0" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
            <input type="date" className="input w-auto py-1.5" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
            <button className="btn-outline btn-sm h-9 w-9 p-0" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
            {date !== today() && <button className="btn-ghost btn-sm" onClick={() => setDate(today())}>Today</button>}
          </div>
        } />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="card card-pad">
          <h3 className="mb-3 font-bold">{date === today() ? 'Today' : fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          {daily.loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            : daily.error ? <ErrorState message={daily.error} onRetry={daily.reload} />
            : !d?.items.length ? <EmptyState title="Nothing to track on this day" message={readOnly ? 'No active goals or scheduled tasks.' : 'Active goals appear here as daily check-ins, plus tasks from your approved timetable.'} />
            : (
              <div className="space-y-5">
                {isFuture && <p className="rounded-xl bg-muted p-2.5 text-xs text-subtle">This day is in the future — you can mark it once it arrives.</p>}
                {tasks.length > 0 && <div><p className="label">Scheduled tasks</p><ul className="space-y-2">{tasks.map(renderItem)}</ul></div>}
                {goalItems.length > 0 && <div><p className="label">Goal check-ins</p><ul className="space-y-2">{goalItems.map(renderItem)}</ul></div>}
              </div>
            )}
        </div>

        <div className="space-y-5">
          <div className="card card-pad flex flex-col items-center text-center">
            {(d?.summary.completion_rate ?? 0) >= 80 && (d?.summary.completed ?? 0) > 0 ? (
              <div className="mb-2 flex flex-col items-center animate-scale-in" data-testid="lumi-celebration">
                <Lumi size={84} mood="cheer" />
                <p className="text-sm font-semibold text-success">Brilliant day — Lumi is cheering!</p>
              </div>
            ) : null}
            <ProgressRing value={d?.summary.completion_rate ?? null} size={130} stroke={12} sub="completion" />
            <div className="mt-4 grid w-full grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-success/10 p-2"><p className="font-bold text-success">{d?.summary.completed ?? 0}</p><p className="text-[10px] text-subtle">Done</p></div>
              <div className="rounded-xl bg-danger/10 p-2"><p className="font-bold text-danger">{d?.summary.not_completed ?? 0}</p><p className="text-[10px] text-subtle">Not done</p></div>
              <div className="rounded-xl bg-muted p-2"><p className="font-bold">{d?.summary.unmarked ?? 0}</p><p className="text-[10px] text-subtle">Unmarked</p></div>
            </div>
          </div>
          <div className="card card-pad grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-warning/20 to-transparent p-3"><Flame className="h-5 w-5 text-warning" /><p className="mt-1 text-2xl font-extrabold">{streaks.data?.current_streak ?? 0}d</p><p className="text-[11px] text-subtle">current streak</p></div>
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-transparent p-3"><Trophy className="h-5 w-5 text-primary" /><p className="mt-1 text-2xl font-extrabold">{streaks.data?.longest_streak ?? 0}d</p><p className="text-[11px] text-subtle">longest streak</p></div>
            <p className="col-span-2 text-center text-xs text-subtle">Consistency (30d): <b>{pct(streaks.data?.consistency_rate)}</b> · {streaks.data?.active_days_30 ?? 0} active days</p>
          </div>
        </div>
      </div>

      <ChartCard title="Last 14 days" subtitle="Progress history">
        {hist.loading ? <Skeleton className="h-60" /> : !chart.some((c) => c.Done + c['Not done'] + c.Unmarked > 0) ? <NoChartData text="No history yet." /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart} margin={{ left: -20, right: 6 }}>
              <CartesianGrid {...t.grid} />
              <XAxis dataKey="day" {...t.axis} />
              <YAxis allowDecimals={false} {...t.axis} />
              <Tooltip {...t.tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Done" stackId="s" fill={t.palette.success} />
              <Bar dataKey="Not done" stackId="s" fill={t.palette.danger} fillOpacity={0.75} />
              <Bar dataKey="Unmarked" stackId="s" fill={t.palette.border} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
