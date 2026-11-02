import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Goal, TaskInput } from '@/types';
import { Field, Modal } from '@/components/common/ui';
import { WEEKDAYS, addDays, fmtDate } from '@/utils/format';

export function TaskEditModal({ open, task, weekStart, goals, onClose, onSave, onDelete }: {
  open: boolean; task: TaskInput | null; weekStart: string; goals: Goal[];
  onClose: () => void; onSave: (t: TaskInput) => void; onDelete?: () => void;
}) {
  const [v, setV] = useState<TaskInput | null>(task);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setV(task); setErr(null); }, [task, open]);
  if (!v) return null;

  const save = () => {
    if (!v.goal_id) return setErr('Choose a goal');
    if (!v.title.trim()) return setErr('Title is required');
    if (v.end_time <= v.start_time) return setErr('End time must be after start time');
    const g = goals.find((x) => x.id === v.goal_id);
    if (g && (v.scheduled_date < g.start_date || v.scheduled_date > g.end_date)) return setErr(`"${g.title}" is only active ${fmtDate(g.start_date)} – ${fmtDate(g.end_date)}`);
    onSave({ ...v, title: v.title.trim() });
  };

  return (
    <Modal open={open} onClose={onClose} title={v.id || task?.title ? 'Edit task' : 'Add task'} footer={
      <>
        {onDelete && <button className="btn-danger mr-auto" onClick={onDelete}><Trash2 className="h-4 w-4" />Remove</button>}
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}>Apply</button>
      </>
    }>
      <div className="space-y-4">
        <Field label="Goal">
          <select className="input" value={v.goal_id} onChange={(e) => setV({ ...v, goal_id: e.target.value })}>
            <option value="">Choose…</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title} · {g.category_name}</option>)}
          </select>
        </Field>
        <Field label="Task"><input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input min-h-[60px]" value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Day">
            <select className="input" value={v.scheduled_date} onChange={(e) => setV({ ...v, scheduled_date: e.target.value })}>
              {WEEKDAYS.map((w, i) => { const d = addDays(weekStart, i); return <option key={d} value={d}>{w} {fmtDate(d)}</option>; })}
            </select>
          </Field>
          <Field label="Start"><input type="time" className="input" value={v.start_time} onChange={(e) => setV({ ...v, start_time: e.target.value })} /></Field>
          <Field label="End"><input type="time" className="input" value={v.end_time} onChange={(e) => setV({ ...v, end_time: e.target.value })} /></Field>
        </div>
        {err && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}
