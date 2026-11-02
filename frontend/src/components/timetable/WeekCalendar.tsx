import { Plus } from 'lucide-react';
import { WEEKDAYS_SHORT, addDays, colorFor, fmtDate, hhmm, minutesOf, today } from '@/utils/format';

export interface CalTask {
  key: string;
  title: string;
  description?: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  color: string | null;
  sub?: string;
}

/** Monday→Sunday calendar. Columns on desktop, stacked day cards on mobile. */
export function WeekCalendar({ weekStart, tasks, editable, onTaskClick, onAdd }: {
  weekStart: string; tasks: CalTask[]; editable: boolean; onTaskClick?: (key: string) => void; onAdd?: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const t0 = today();
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d, i) => {
        const list = tasks.filter((t) => t.scheduled_date === d).sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
        const mins = list.reduce((s, t) => s + (minutesOf(t.end_time) - minutesOf(t.start_time)), 0);
        const isToday = d === t0;
        return (
          <div key={d} className={`flex min-h-[140px] flex-col rounded-2xl border p-2 transition ${isToday ? 'border-primary/60 bg-primary/5' : 'border-border/60 bg-surface/60'}`}>
            <div className="mb-2 flex items-center justify-between px-1">
              <div>
                <p className={`text-xs font-bold uppercase ${isToday ? 'text-primary' : 'text-subtle'}`}>{WEEKDAYS_SHORT[i]}</p>
                <p className="text-sm font-semibold">{fmtDate(d)}</p>
              </div>
              {mins > 0 && <span className="chip bg-muted text-[10px] text-subtle">{(mins / 60).toFixed(1)}h</span>}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {list.map((t) => {
                const c = colorFor(t.color);
                return (
                  <button
                    key={t.key} type="button" disabled={!editable && !onTaskClick} onClick={() => onTaskClick?.(t.key)}
                    className="group rounded-xl p-2 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default"
                    style={{ background: `${c}1f`, borderLeft: `3px solid ${c}` }}
                    title={t.description ?? t.title}
                  >
                    <p className="font-semibold" style={{ color: c }}>{hhmm(t.start_time)}–{hhmm(t.end_time)}</p>
                    <p className="line-clamp-2 font-medium text-fg">{t.title}</p>
                    {t.sub && <p className="truncate text-[10px] text-subtle">{t.sub}</p>}
                  </button>
                );
              })}
              {!list.length && <p className="py-3 text-center text-[11px] text-subtle">Free</p>}
            </div>
            {editable && onAdd && (
              <button type="button" onClick={() => onAdd(d)} className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-dashed border-border py-1.5 text-[11px] font-semibold text-subtle hover:border-primary hover:text-primary">
                <Plus className="h-3 w-3" />Add
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
