import { useState } from 'react';
import { Bot, CalendarRange, CheckCircle2, ChevronDown, Circle, History, Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import type { Goal, GoalStatus } from '@/types';
import { Badge, ProgressBar } from '@/components/common/ui';
import { IMPORTANCE_META, STATUS_META, colorFor, fmtDate, pct, titleCase } from '@/utils/format';

export function GoalCard({ g, readOnly, onEdit, onDelete, onStatus, onHistory, onMilestone, onApprove }: {
  g: Goal; readOnly: boolean; onEdit: () => void; onDelete: () => void; onStatus: (s: GoalStatus) => void;
  onHistory: () => void; onMilestone: (mid: string, done: boolean) => void; onApprove: (approve: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const color = colorFor(g.category_color);
  const msDone = g.milestones.filter((m) => m.status === 'COMPLETED').length;
  const pending = g.approval_status === 'PENDING_REVIEW';

  return (
    <div className={`card relative overflow-hidden transition hover:shadow-glow ${g.status === 'COMPLETED' ? 'opacity-90' : ''}`}>
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge className={IMPORTANCE_META[g.importance].cls}>{IMPORTANCE_META[g.importance].label}</Badge>
              <Badge className={STATUS_META[g.status]}>{titleCase(g.status)}</Badge>
              {pending && <Badge className={STATUS_META.PENDING_REVIEW}>Needs review</Badge>}
              {g.ai_generated && <Badge className="bg-secondary/15 text-secondary"><Bot className="h-3 w-3" />AI</Badge>}
              {g.is_overdue && g.status !== 'COMPLETED' && <Badge className="bg-danger/10 text-danger">Overdue</Badge>}
            </div>
            <h4 className={`text-base font-bold ${g.status === 'COMPLETED' ? 'line-through decoration-success/60' : ''}`}>{g.title}</h4>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-subtle"><CalendarRange className="h-3.5 w-3.5" />{fmtDate(g.start_date)} → {fmtDate(g.end_date, { month: 'short', day: 'numeric', year: 'numeric' })}
              {g.status === 'ACTIVE' && !g.is_overdue && <span> · {g.days_remaining}d left</span>}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-extrabold" style={{ color }}>{pct(g.progress.completion_rate)}</p>
            <p className="text-[10px] text-subtle">{g.progress.completed}/{g.progress.completed + g.progress.not_completed} check-ins</p>
          </div>
        </div>
        <div className="mt-3"><ProgressBar value={g.progress.completion_rate} color={color} /></div>

        {pending && !readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-warning/10 p-3 text-sm">
            <span className="flex-1">AI-suggested goal — approve to activate it.</span>
            <button className="btn-sm btn bg-success text-white" onClick={() => onApprove(true)}><ThumbsUp className="h-3.5 w-3.5" />Approve</button>
            <button className="btn-sm btn-danger" onClick={() => onApprove(false)}><ThumbsDown className="h-3.5 w-3.5" />Reject</button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />Details{g.milestones.length > 0 && ` · ${msDone}/${g.milestones.length} milestones`}
          </button>
          <button className="btn-ghost btn-sm" onClick={onHistory}><History className="h-3.5 w-3.5" />History</button>
          {!readOnly && (
            <div className="ml-auto flex items-center gap-1">
              <select className="input w-auto py-1 text-xs" value={g.status} onChange={(e) => onStatus(e.target.value as GoalStatus)} aria-label="Change status" disabled={pending}>
                {['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
              <button className="btn-ghost btn-sm h-8 w-8 p-0" onClick={onEdit} aria-label="Edit goal"><Pencil className="h-4 w-4" /></button>
              <button className="btn-ghost btn-sm h-8 w-8 p-0 text-danger" onClick={onDelete} aria-label="Delete goal"><Trash2 className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {open && (
          <div className="mt-3 space-y-3 border-t border-border/60 pt-3 animate-fade-up">
            {g.description && <p className="whitespace-pre-line text-sm">{g.description}</p>}
            {g.milestones.length > 0 && (
              <ul className="space-y-1.5">
                {g.milestones.map((m) => {
                  const done = m.status === 'COMPLETED';
                  return (
                    <li key={m.id}>
                      <button disabled={readOnly} onClick={() => onMilestone(m.id, !done)} className="flex w-full items-start gap-2 rounded-xl p-1.5 text-left text-sm hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent">
                        {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}
                        <span className="flex-1"><span className={done ? 'line-through text-subtle' : ''}>{m.title}</span>{m.description && <span className="block text-xs text-subtle">{m.description}</span>}</span>
                        {m.due_date && <span className="text-xs text-subtle">{fmtDate(m.due_date)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {g.notes && <p className="rounded-xl bg-muted/70 p-2.5 text-xs text-subtle">📝 {g.notes}</p>}
            {!g.description && !g.milestones.length && !g.notes && <p className="text-xs text-subtle">No extra details.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
