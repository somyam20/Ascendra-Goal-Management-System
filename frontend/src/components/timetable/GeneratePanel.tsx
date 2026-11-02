import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BedDouble, Clock, Sparkles, Wand2 } from 'lucide-react';
import type { Timetable } from '@/types';
import { planningApi, prefsApi } from '@/services/endpoints';
import { parseApiError } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/contexts/ToastContext';
import { EmojiLoader } from '@/components/common/EmojiLoader';
import { Field, Skeleton } from '@/components/common/ui';
import { WEEKDAYS_SHORT, addDays, hours, mondayOf, today, fmtDate } from '@/utils/format';

const nextMonday = () => { const m = mondayOf(today()); return m === today() ? m : addDays(m, 7); };

export function GeneratePanel({ ownerId, onGenerated }: { ownerId: string; onGenerated: (t: Timetable) => void }) {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(nextMonday());
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; conflicts: string[] } | null>(null);
  const av = useAsync(() => prefsApi.availability(weekStart), [weekStart]);
  const prefs = useAsync(() => prefsApi.get(), []);

  const weeks = [mondayOf(today()), addDays(mondayOf(today()), 7), addDays(mondayOf(today()), 14)];

  const go = async () => {
    setBusy(true); setProblem(null);
    try {
      const req = await planningApi.createRequest(prompt.trim() || 'Plan a balanced week across my active goals.', weekStart);
      const t = await planningApi.generate(req.id);
      toast.success('Draft timetable ready', 'Review, tweak and approve it.');
      onGenerated(t);
    } catch (e) {
      const p = parseApiError(e);
      setProblem({ message: p.message, conflicts: p.conflicts });
    } finally { setBusy(false); }
  };

  const a = av.data;
  const over = a && a.budget_minutes_total > a.free_minutes_total;

  return (
    <div className="card relative overflow-hidden p-5 sm:p-6">
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-secondary/25 to-accent/20 blur-2xl" />
      <div className="relative grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-primary text-white shadow-glow"><Sparkles className="h-5 w-5" /></span>
            <div><h3 className="text-lg font-bold">Generate my timetable</h3><p className="text-xs text-subtle">AI reads your goals; a deterministic scheduler places them around sleep & commitments.</p></div>
          </div>
          {busy ? <EmojiLoader message="Gemini is planning your week…" /> : (
            <>
              <Field label="Week">
                <div className="flex flex-wrap gap-2">
                  {weeks.map((w) => (
                    <button key={w} type="button" onClick={() => setWeekStart(w)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${weekStart === w ? 'bg-primary text-white shadow-glow' : 'bg-muted text-subtle hover:text-fg'}`}>
                      {fmtDate(w)} – {fmtDate(addDays(w, 6))}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="What should the plan focus on?" hint="Optional — e.g. “Prioritise job switching but keep exercise and thesis going.”">
                <textarea className="input min-h-[100px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="I want to prioritise job switching while continuing my exercise routine and thesis work." />
              </Field>
              {problem && (
                <div role="alert" className="space-y-1 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-danger"><AlertTriangle className="h-4 w-4" />{problem.message}</p>
                  {problem.conflicts.map((c) => <p key={c} className="pl-6 text-xs">• {c}</p>)}
                  <p className="pl-6 text-xs text-subtle">Adjust weekly hours or availability in <Link className="font-semibold text-primary" to={`/u/${ownerId}/settings`}>Settings</Link>, or change goal priorities.</p>
                </div>
              )}
              <button className="btn-primary" onClick={go}><Wand2 className="h-4 w-4" />Generate draft</button>
            </>
          )}
        </div>
        <div className="space-y-3 lg:col-span-2">
          <p className="label">Your availability</p>
          {av.loading ? <Skeleton className="h-40" /> : av.error ? <p className="text-sm text-danger">{av.error}</p> : a && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-muted/70 p-3"><Clock className="mb-1 h-4 w-4 text-primary" /><p className="text-lg font-bold">{hours(a.free_minutes_total)}</p><p className="text-[11px] text-subtle">free this week</p></div>
                <div className={`rounded-2xl p-3 ${over ? 'bg-danger/10' : 'bg-muted/70'}`}><Sparkles className="mb-1 h-4 w-4 text-secondary" /><p className="text-lg font-bold">{hours(a.budget_minutes_total)}</p><p className="text-[11px] text-subtle">category budget</p></div>
              </div>
              <div className="flex items-end gap-1.5">
                {a.days.map((d) => {
                  const max = Math.max(...a.days.map((x) => x.free_minutes), 1);
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-20 w-full items-end rounded-lg bg-muted/60">
                        <div className={`w-full rounded-lg ${d.blocked ? 'bg-subtle/30' : 'bg-gradient-to-t from-primary to-secondary'}`} style={{ height: `${d.blocked ? 100 : (d.free_minutes / max) * 100}%` }} title={d.blocked ? 'Unavailable' : hours(d.free_minutes)} />
                      </div>
                      <span className="text-[10px] text-subtle">{WEEKDAYS_SHORT[d.weekday]}</span>
                    </div>
                  );
                })}
              </div>
              {a.warnings.map((w) => <p key={w} className="flex items-start gap-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>)}
            </>
          )}
          {prefs.data && !prefs.data.is_configured && (
            <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-2.5 text-xs"><BedDouble className="h-4 w-4 shrink-0 text-warning" />You haven't set your sleep and working hours yet — defaults are used. <Link to={`/u/${ownerId}/settings`} className="font-semibold text-primary">Set them</Link></p>
          )}
        </div>
      </div>
    </div>
  );
}
