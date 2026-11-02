import { useEffect, useState } from 'react';
import { BedDouble, Briefcase, CalendarOff, Clock, Heart, MessageSquareHeart, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import type { Activity, Budget, FeedbackStyle, Preferences } from '@/types';
import { prefsApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmDialog, ErrorState, Field, Modal, SectionHeader, Skeleton } from '@/components/common/ui';
import { ChangePasswordCard } from '@/components/common/ChangePasswordCard';
import { BROWSER_TZ, WEEKDAYS_SHORT, colorFor, hhmm } from '@/utils/format';

const TIMEZONES = (() => {
  try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone'); } catch { return [BROWSER_TZ, 'UTC', 'Asia/Kolkata', 'Europe/London', 'America/New_York']; }
})();

function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS_SHORT.map((d, i) => {
        const on = value.includes(i);
        return (
          <button key={d} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort())}
            className={`h-9 w-11 rounded-xl text-xs font-bold transition ${on ? 'bg-primary text-white shadow-glow' : 'bg-muted text-subtle hover:text-fg'}`}>{d}</button>
        );
      })}
    </div>
  );
}

const FEEDBACK: { v: FeedbackStyle; title: string; ex: string; icon: string }[] = [
  { v: 'POSITIVE', title: 'Positive', ex: '“80% done this week — excellent! Keep the momentum.”', icon: '🌟' },
  { v: 'BALANCED', title: 'Balanced', ex: '“Steady progress. Two important tasks still need you.”', icon: '⚖️' },
  { v: 'STRICT', title: 'Strict', ex: '“Three planned tasks missed. Review priorities and make time.”', icon: '🎯' },
];

export default function SettingsSection() {
  const toast = useToast();
  const prefs = useAsync(() => prefsApi.get(), []);
  const acts = useAsync(() => prefsApi.activities(), []);
  const budgets = useAsync(() => prefsApi.budgets(), []);
  const [p, setP] = useState<Preferences | null>(null);
  const [b, setB] = useState<Budget[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [actForm, setActForm] = useState<{ open: boolean; editing: Activity | null }>({ open: false, editing: null });
  const [delAct, setDelAct] = useState<Activity | null>(null);

  useEffect(() => { if (prefs.data) setP({ ...prefs.data, wake_time: hhmm(prefs.data.wake_time), sleep_time: hhmm(prefs.data.sleep_time), preferred_working_start: hhmm(prefs.data.preferred_working_start), preferred_working_end: hhmm(prefs.data.preferred_working_end) }); }, [prefs.data]);
  useEffect(() => { if (budgets.data) setB(budgets.data); }, [budgets.data]);

  if (prefs.loading) return <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>;
  if (prefs.error) return <ErrorState message={prefs.error} onRetry={prefs.reload} />;
  if (!p) return null;

  const savePrefs = async (fields: (keyof Preferences)[], label: string) => {
    setSaving(label);
    try {
      const body = Object.fromEntries(fields.map((f) => [f, p[f]])) as Partial<Preferences>;
      const r = await prefsApi.update(body);
      prefs.setData(r);
      toast.success(`${label} saved`);
    } catch (e) { toast.apiError(e, `Could not save ${label.toLowerCase()}`); } finally { setSaving(null); }
  };

  const setFeedback = async (v: FeedbackStyle) => {
    setP({ ...p, feedback_style: v });
    try { const r = await prefsApi.feedback(v); prefs.setData(r); toast.success('Feedback style updated'); } catch (e) { toast.apiError(e); }
  };

  const saveBudgets = async () => {
    if (b.some((x) => x.hours_per_week < 0 || x.hours_per_week > 112)) { toast.error('Hours must be between 0 and 112'); return; }
    setSaving('budgets');
    try { const r = await prefsApi.saveBudgets(b.map((x) => ({ category_id: x.category_id, hours_per_week: Number(x.hours_per_week) }))); budgets.setData(r); toast.success('Weekly hours saved'); }
    catch (e) { toast.apiError(e); } finally { setSaving(null); }
  };

  const totalBudget = b.reduce((s, x) => s + Number(x.hours_per_week || 0), 0);

  return (
    <div className="space-y-5">
      <SectionHeader title="Settings" icon={<Settings className="h-5 w-5" />} subtitle="Saved once, reused for every plan. Update anytime." />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card card-pad space-y-4">
          <h3 className="flex items-center gap-2 font-bold"><BedDouble className="h-5 w-5 text-primary" />Sleep schedule</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sleep time"><input type="time" className="input" value={p.sleep_time} onChange={(e) => setP({ ...p, sleep_time: e.target.value })} /></Field>
            <Field label="Wake-up time"><input type="time" className="input" value={p.wake_time} onChange={(e) => setP({ ...p, wake_time: e.target.value })} /></Field>
          </div>
          <p className="text-sm text-subtle">Total sleep: <b className="text-fg">{(() => { const [sh, sm] = p.sleep_time.split(':').map(Number); const [wh, wm] = p.wake_time.split(':').map(Number); let m = wh! * 60 + wm! - (sh! * 60 + sm!); if (m <= 0) m += 1440; return (m / 60).toFixed(1); })()}h</b></p>
          <Field label="Timezone">
            <select className="input" value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })}>
              {!TIMEZONES.includes(p.timezone) && <option value={p.timezone}>{p.timezone}</option>}
              {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          <button className="btn-primary" disabled={saving === 'Sleep schedule'} onClick={() => savePrefs(['sleep_time', 'wake_time', 'timezone'], 'Sleep schedule')}>Save</button>
        </div>

        <div className="card card-pad space-y-4">
          <h3 className="flex items-center gap-2 font-bold"><Briefcase className="h-5 w-5 text-secondary" />Working preferences</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preferred start"><input type="time" className="input" value={p.preferred_working_start} onChange={(e) => setP({ ...p, preferred_working_start: e.target.value })} /></Field>
            <Field label="Preferred end"><input type="time" className="input" value={p.preferred_working_end} onChange={(e) => setP({ ...p, preferred_working_end: e.target.value })} /></Field>
            <Field label="Max productive h/day"><input type="number" min={1} max={16} step={0.5} className="input" value={p.max_productive_hours} onChange={(e) => setP({ ...p, max_productive_hours: Number(e.target.value) })} /></Field>
            <Field label="Break (min)"><input type="number" min={0} max={120} className="input" value={p.break_minutes} onChange={(e) => setP({ ...p, break_minutes: Number(e.target.value) })} /></Field>
            <Field label="Preferred task length (min)"><input type="number" min={15} max={240} step={5} className="input" value={p.preferred_task_minutes} onChange={(e) => setP({ ...p, preferred_task_minutes: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Unavailable days"><DayPicker value={p.unavailable_days} onChange={(v) => setP({ ...p, unavailable_days: v })} /></Field>
          <Field label="Weekly rest days"><DayPicker value={p.rest_days} onChange={(v) => setP({ ...p, rest_days: v })} /></Field>
          <button className="btn-primary" disabled={saving === 'Working preferences'} onClick={() => savePrefs(['preferred_working_start', 'preferred_working_end', 'max_productive_hours', 'break_minutes', 'preferred_task_minutes', 'unavailable_days', 'rest_days'], 'Working preferences')}>Save</button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold"><CalendarOff className="h-5 w-5 text-accent" />Fixed daily activities</h3>
          <button className="btn-outline btn-sm" onClick={() => setActForm({ open: true, editing: null })}><Plus className="h-3.5 w-3.5" />Add activity</button>
        </div>
        {acts.loading ? <Skeleton className="h-20" /> : acts.error ? <ErrorState message={acts.error} onRetry={acts.reload} /> : !acts.data?.length ? (
          <p className="text-sm text-subtle">Add office hours, college, meals, commute… so plans never clash with them.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {acts.data.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                <Clock className="h-4 w-4 text-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.title}</p>
                  <p className="text-xs text-subtle">{hhmm(a.start_time)}–{hhmm(a.end_time)} · {a.recurrence === 'DAILY' ? 'Every day' : a.recurrence === 'ONCE' ? `Once ${a.start_date ?? ''}` : a.weekdays.map((w) => WEEKDAYS_SHORT[w]).join(', ')}</p>
                </div>
                <button className="btn-ghost btn-sm h-8 w-8 p-0" onClick={() => setActForm({ open: true, editing: a })} aria-label={`Edit ${a.title}`}><Pencil className="h-4 w-4" /></button>
                <button className="btn-ghost btn-sm h-8 w-8 p-0 text-danger" onClick={() => setDelAct(a)} aria-label={`Delete ${a.title}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-bold"><Clock className="h-5 w-5 text-primary" />Category time allocation</h3>
          <span className="chip bg-muted text-subtle">{totalBudget}h / week total</span>
        </div>
        {budgets.loading ? <Skeleton className="h-20" /> : !b.length ? <p className="text-sm text-subtle">Select categories first (My Categories) to allocate weekly hours.</p> : (
          <>
            <p className="mb-3 text-sm text-subtle">How many hours per week can you dedicate to each category?</p>
            <div className="space-y-3">
              {b.map((x, i) => (
                <div key={x.category_id} className="grid items-center gap-3 sm:grid-cols-[160px_1fr_90px]">
                  <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: colorFor(x.category_color, i) }} />{x.category_name}</span>
                  <input type="range" min={0} max={40} step={0.5} value={x.hours_per_week} onChange={(e) => setB(b.map((y) => (y.category_id === x.category_id ? { ...y, hours_per_week: Number(e.target.value) } : y)))} style={{ accentColor: colorFor(x.category_color, i) }} aria-label={`${x.category_name} hours`} />
                  <input type="number" min={0} max={112} step={0.5} className="input py-1.5" value={x.hours_per_week} onChange={(e) => setB(b.map((y) => (y.category_id === x.category_id ? { ...y, hours_per_week: Number(e.target.value) } : y)))} aria-label={`${x.category_name} hours number`} />
                </div>
              ))}
            </div>
            <button className="btn-primary mt-4" disabled={saving === 'budgets'} onClick={saveBudgets}>Save hours</button>
          </>
        )}
      </div>

      <div className="card card-pad">
        <h3 className="mb-3 flex items-center gap-2 font-bold"><MessageSquareHeart className="h-5 w-5 text-secondary" />Feedback style</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {FEEDBACK.map((f) => (
            <button key={f.v} onClick={() => setFeedback(f.v)} aria-pressed={p.feedback_style === f.v}
              className={`rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 ${p.feedback_style === f.v ? 'border-primary bg-primary/10 shadow-glow' : 'border-border/60 hover:border-primary/40'}`}>
              <span className="text-2xl">{f.icon}</span>
              <p className="mt-1 font-bold">{f.title}</p>
              <p className="mt-1 text-xs text-subtle">{f.ex}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1 text-xs text-subtle"><Heart className="h-3 w-3" />Always respectful — never shaming.</p>
      </div>

      <ChangePasswordCard />

      <ActivityModal open={actForm.open} editing={actForm.editing} onClose={() => setActForm({ open: false, editing: null })} onSaved={() => acts.reload(true)} />
      <ConfirmDialog open={!!delAct} danger title="Delete activity?" confirmLabel="Delete" message={`Remove "${delAct?.title}" from your fixed schedule?`}
        onClose={() => setDelAct(null)} onConfirm={async () => { try { await prefsApi.deleteActivity(delAct!.id); toast.success('Activity deleted'); acts.reload(true); } catch (e) { toast.apiError(e); } setDelAct(null); }} />
    </div>
  );
}

function ActivityModal({ open, editing, onClose, onSaved }: { open: boolean; editing: Activity | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const blank: Omit<Activity, 'id'> = { title: '', start_time: '09:00', end_time: '17:00', recurrence: 'WEEKLY', weekdays: [0, 1, 2, 3, 4], start_date: null, end_date: null };
  const [v, setV] = useState(blank);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setV(editing ? { title: editing.title, start_time: hhmm(editing.start_time), end_time: hhmm(editing.end_time), recurrence: editing.recurrence, weekdays: editing.weekdays, start_date: editing.start_date, end_date: editing.end_date } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const save = async () => {
    if (!v.title.trim()) return setErr('Name is required');
    if (v.start_time === v.end_time) return setErr('Start and end time cannot be equal');
    if (v.recurrence === 'WEEKLY' && !v.weekdays.length) return setErr('Pick at least one weekday');
    if (v.recurrence === 'ONCE' && !v.start_date) return setErr('Pick the date');
    if (v.start_date && v.end_date && v.end_date < v.start_date) return setErr('End date cannot be before start date');
    setBusy(true);
    try {
      const body = { ...v, title: v.title.trim(), start_date: v.start_date || null, end_date: v.end_date || null };
      if (editing) await prefsApi.updateActivity(editing.id, body); else await prefsApi.createActivity(body);
      toast.success('Activity saved'); onSaved(); onClose();
    } catch (e) { toast.apiError(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit activity' : 'New fixed activity'} footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>Save</button></>}>
      <div className="space-y-4">
        <Field label="Activity"><input className="input" placeholder="Office hours, Commute, Dinner…" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="time" className="input" value={v.start_time} onChange={(e) => setV({ ...v, start_time: e.target.value })} /></Field>
          <Field label="End" hint="Earlier than start = crosses midnight"><input type="time" className="input" value={v.end_time} onChange={(e) => setV({ ...v, end_time: e.target.value })} /></Field>
        </div>
        <Field label="Recurrence">
          <select className="input" value={v.recurrence} onChange={(e) => setV({ ...v, recurrence: e.target.value as Activity['recurrence'] })}>
            <option value="DAILY">Every day</option><option value="WEEKLY">Specific weekdays</option><option value="ONCE">One time</option>
          </select>
        </Field>
        {v.recurrence === 'WEEKLY' && <Field label="Weekdays"><DayPicker value={v.weekdays} onChange={(w) => setV({ ...v, weekdays: w })} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={v.recurrence === 'ONCE' ? 'Date' : 'From (optional)'}><input type="date" className="input" value={v.start_date ?? ''} onChange={(e) => setV({ ...v, start_date: e.target.value || null })} /></Field>
          {v.recurrence !== 'ONCE' && <Field label="Until (optional)"><input type="date" className="input" value={v.end_date ?? ''} onChange={(e) => setV({ ...v, end_date: e.target.value || null })} /></Field>}
        </div>
        {err && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}
