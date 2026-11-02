import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, History, Pencil, RefreshCw, Save, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { TaskInput, Timetable } from '@/types';
import { goalsApi, timetablesApi } from '@/services/endpoints';
import { parseApiError } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { Badge, EmptyState, ErrorState, Modal, SectionHeader, Skeleton } from '@/components/common/ui';
import { EmojiLoader } from '@/components/common/EmojiLoader';
import { WeekCalendar, type CalTask } from './WeekCalendar';
import { TaskEditModal } from './TaskEditModal';
import { GeneratePanel } from './GeneratePanel';
import { STATUS_META, addDays, fmtDate, fmtDateTime, hhmm, titleCase } from '@/utils/format';

type Row = TaskInput & { _k: string };
let kseq = 0;
const toRows = (t: Timetable): Row[] => t.tasks.map((x) => ({
  _k: `r${++kseq}`, id: x.id, goal_id: x.goal_id, title: x.title, description: x.description,
  scheduled_date: x.scheduled_date, start_time: hhmm(x.start_time), end_time: hhmm(x.end_time),
}));
const strip = (rows: Row[]): TaskInput[] => rows.map(({ _k, ...r }) => { void _k; return r; });

export default function TimetableSection() {
  const { readOnly, viewUserId, owner } = useWorkspace();
  const toast = useToast();
  const list = useAsync(() => timetablesApi.list({ user_id: viewUserId }), [viewUserId]);
  const goals = useAsync(() => (readOnly ? Promise.resolve(null) : goalsApi.list({ status: 'ACTIVE' })), [readOnly]);
  const [selId, setSelId] = useState<string | null>(null);
  const [sel, setSel] = useState<Timetable | null>(null);
  const [selLoading, setSelLoading] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [editRow, setEditRow] = useState<{ row: Row; isNew: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showGen, setShowGen] = useState(false);
  const [regen, setRegen] = useState<{ open: boolean; prompt: string }>({ open: false, prompt: '' });

  const items = list.data ?? [];
  // default selection: latest draft, else the approved one covering today, else latest
  useEffect(() => {
    if (!items.length || (selId && items.some((t) => t.id === selId))) return;
    const draft = items.find((t) => t.status === 'DRAFT');
    const approved = items.find((t) => t.status === 'APPROVED');
    setSelId((draft ?? approved ?? items[0])!.id);
  }, [items, selId]);

  useEffect(() => {
    if (!selId) { setSel(null); return; }
    let alive = true;
    setSelLoading(true); setRows(null); setConflicts([]);
    timetablesApi.get(selId, viewUserId).then((t) => alive && setSel(t)).catch((e) => toast.apiError(e)).finally(() => alive && setSelLoading(false));
    return () => { alive = false; };
  }, [selId, viewUserId, toast]);

  const activeGoals = goals.data?.items ?? [];
  const goalMap = useMemo(() => new Map(activeGoals.map((g) => [g.id, g])), [activeGoals]);

  const adopt = (t: Timetable) => { setSel(t); setSelId(t.id); setRows(null); setConflicts([]); list.reload(true); };

  const calTasks: CalTask[] = rows
    ? rows.map((r) => {
      const g = goalMap.get(r.goal_id);
      const orig = sel?.tasks.find((x) => x.goal_id === r.goal_id);
      return { key: r._k, title: r.title, description: r.description, scheduled_date: r.scheduled_date, start_time: r.start_time, end_time: r.end_time, color: g?.category_color ?? orig?.category_color ?? null, sub: g?.title ?? orig?.goal_title };
    })
    : (sel?.tasks ?? []).map((t) => ({ key: t.id, title: t.title, description: t.description, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time, color: t.category_color, sub: t.goal_title }));

  const run = async (label: string, fn: () => Promise<Timetable | void>, ok: string) => {
    setBusy(label); setConflicts([]);
    try {
      const t = await fn();
      toast.success(ok);
      if (t) adopt(t); else list.reload(true);
    } catch (e) {
      const p = parseApiError(e);
      setConflicts(p.conflicts.length ? p.conflicts : []);
      toast.error(p.message, p.conflicts.length ? `${p.conflicts.length} conflict(s) — see the list above the calendar.` : undefined);
    } finally { setBusy(null); }
  };

  const validate = async () => {
    if (!sel || !rows) return;
    setBusy('validate');
    try {
      const r = await timetablesApi.validate(sel.id, strip(rows));
      setConflicts(r.conflicts);
      r.valid ? toast.success('No conflicts found') : toast.error('Conflicts found', `${r.conflicts.length} issue(s) to fix`);
    } catch (e) { toast.apiError(e); } finally { setBusy(null); }
  };

  const applyRow = (t: TaskInput) => {
    if (!editRow || !rows) return;
    const next = editRow.isNew ? [...rows, { ...t, _k: `r${++kseq}` }] : rows.map((r) => (r._k === editRow.row._k ? { ...r, ...t } : r));
    setRows(next); setEditRow(null);
  };

  if (list.loading) return <EmojiLoader />;
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;

  const editable = !readOnly && !!rows;
  const isDraft = sel?.status === 'DRAFT';

  return (
    <div className="space-y-5">
      <SectionHeader
        title={readOnly ? `${owner.name}'s timetable` : 'My timetable'} icon={<CalendarDays className="h-5 w-5" />}
        subtitle={readOnly ? 'Approved weekly plans only' : 'Optional — goals and daily tracking work without one.'}
        actions={!readOnly && items.length > 0 && !showGen && <button className="btn-primary" onClick={() => setShowGen(true)}><Sparkles className="h-4 w-4" />New plan</button>}
      />

      {!readOnly && (showGen || !items.length) && (
        <div className="space-y-2">
          {!items.length && (
            <div className="card"><EmptyState title="No timetable yet — and that's okay!" face="chill"
              message="Timetable generation is completely optional. You can create goals and track them daily without one. When you want a structured week, describe your priorities below and review the AI draft before anything is saved as active." /></div>
          )}
          <GeneratePanel ownerId={owner.id} onGenerated={(t) => { setShowGen(false); adopt(t); }} />
          {showGen && <div className="text-right"><button className="btn-ghost btn-sm" onClick={() => setShowGen(false)}>Close</button></div>}
        </div>
      )}

      {readOnly && !items.length && <div className="card"><EmptyState title="No approved timetable" message={`${owner.name} hasn't approved a weekly plan yet.`} face="chill" /></div>}

      {items.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            {selLoading || !sel ? <Skeleton className="h-96" /> : (
              <div className="card card-pad space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">Week of {fmtDate(sel.week_start)} – {fmtDate(sel.week_end)}</h3>
                      <Badge className={STATUS_META[sel.status]}>{titleCase(sel.status)}</Badge>
                      <Badge className="bg-muted text-subtle">v{sel.version}</Badge>
                      {sel.source === 'fallback' && <Badge className="bg-warning/15 text-warning">offline planner</Badge>}
                    </div>
                    {sel.planning_summary && <p className="mt-1 max-w-2xl text-sm text-subtle">{sel.planning_summary}</p>}
                  </div>
                  {!readOnly && (
                    <div className="flex flex-wrap gap-2">
                      {!rows ? (
                        <>
                          {(isDraft || sel.status === 'APPROVED') && <button className="btn-outline btn-sm" onClick={() => setRows(toRows(sel))}><Pencil className="h-3.5 w-3.5" />{isDraft ? 'Edit' : 'Modify (new draft)'}</button>}
                          {sel.status !== 'ARCHIVED' && <button className="btn-outline btn-sm" disabled={!!busy} onClick={() => setRegen({ open: true, prompt: '' })}><RefreshCw className="h-3.5 w-3.5" />Regenerate</button>}
                          {isDraft && <button className="btn-danger btn-sm" disabled={!!busy} onClick={() => run('reject', () => timetablesApi.reject(sel.id), 'Draft rejected')}><X className="h-3.5 w-3.5" />Reject</button>}
                          {isDraft && <button className="btn btn-sm bg-success text-white hover:brightness-110" disabled={!!busy} onClick={() => run('approve', () => timetablesApi.approve(sel.id), 'Timetable approved 🎉')}><Check className="h-3.5 w-3.5" />{busy === 'approve' ? 'Approving…' : 'Approve'}</button>}
                        </>
                      ) : (
                        <>
                          <button className="btn-ghost btn-sm" onClick={() => { setRows(null); setConflicts([]); }}>Discard</button>
                          <button className="btn-outline btn-sm" disabled={!!busy} onClick={validate}><ShieldCheck className="h-3.5 w-3.5" />Check conflicts</button>
                          <button className="btn-primary btn-sm" disabled={!!busy} onClick={() => run('save', () => timetablesApi.saveDraft(sel.id, strip(rows)), isDraft ? 'Draft saved' : 'Saved as a new draft version')}><Save className="h-3.5 w-3.5" />{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {sel.warnings.length > 0 && (
                  <div className="space-y-1 rounded-2xl bg-warning/10 p-3">
                    {sel.warnings.map((w) => <p key={w} className="flex items-start gap-2 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</p>)}
                  </div>
                )}
                {conflicts.length > 0 && (
                  <div role="alert" className="space-y-1 rounded-2xl border border-danger/30 bg-danger/10 p-3">
                    <p className="text-sm font-semibold text-danger">Scheduling conflicts</p>
                    {conflicts.map((c) => <p key={c} className="text-xs">• {c}</p>)}
                  </div>
                )}
                {editable && <p className="text-xs text-subtle">Click a task to edit, move it to another day or remove it. Use “Add” to create one.{sel.status === 'APPROVED' && ' Saving creates a new draft — the approved version stays unchanged.'}</p>}

                {!calTasks.length && !editable ? <EmptyState title="No tasks in this version" /> : (
                  <WeekCalendar
                    weekStart={sel.week_start} tasks={calTasks} editable={editable}
                    onTaskClick={editable ? (k) => { const r = rows!.find((x) => x._k === k); if (r) setEditRow({ row: r, isNew: false }); } : undefined}
                    onAdd={(d) => setEditRow({ isNew: true, row: { _k: '', goal_id: activeGoals[0]?.id ?? '', title: '', description: '', scheduled_date: d, start_time: '18:00', end_time: '19:00' } })}
                  />
                )}
              </div>
            )}
          </div>

          <aside className="card card-pad h-fit">
            <h4 className="mb-3 flex items-center gap-2 font-bold"><History className="h-4 w-4 text-primary" />Versions</h4>
            <ul className="space-y-1.5">
              {items.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setSelId(t.id)} className={`w-full rounded-xl border p-2.5 text-left transition ${selId === t.id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{fmtDate(t.week_start)} · v{t.version}</span>
                      <Badge className={STATUS_META[t.status]}>{titleCase(t.status)}</Badge>
                    </div>
                    <p className="text-[11px] text-subtle">{t.task_count} tasks · {fmtDateTime(t.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {sel && (
        <TaskEditModal
          open={!!editRow} task={editRow?.row ?? null} weekStart={sel.week_start}
          goals={activeGoals.filter((g) => g.start_date <= addDays(sel.week_start, 6) && g.end_date >= sel.week_start)}
          onClose={() => setEditRow(null)} onSave={applyRow}
          onDelete={editRow && !editRow.isNew ? () => { setRows(rows!.filter((r) => r._k !== editRow.row._k)); setEditRow(null); } : undefined}
        />
      )}
      <Modal open={regen.open} onClose={() => setRegen({ open: false, prompt: '' })} title="Regenerate timetable" footer={
        <>
          <button className="btn-ghost" onClick={() => setRegen({ open: false, prompt: '' })}>Cancel</button>
          <button className="btn-primary" disabled={!!busy} onClick={() => { const p = regen.prompt; setRegen({ open: false, prompt: '' }); if (sel) run('regen', () => timetablesApi.regenerate(sel.id, p || undefined), 'New draft generated'); }}>
            <RefreshCw className="h-4 w-4" />Regenerate
          </button>
        </>
      }>
        <p className="mb-3 text-sm text-subtle">A new draft version is created — existing versions (including approved ones) are kept.</p>
        <textarea className="input min-h-[90px]" placeholder="Anything to change? e.g. ‘No tasks after 9pm, more thesis time’" value={regen.prompt} onChange={(e) => setRegen({ ...regen, prompt: e.target.value })} />
      </Modal>
      {busy === 'regen' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur"><EmojiLoader message="Re-planning your week…" /></div>}
    </div>
  );
}
