import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import type { Category, Goal, GoalInput } from '@/types';
import { goalsApi } from '@/services/endpoints';
import { useToast } from '@/contexts/ToastContext';
import { Field, Modal } from '@/components/common/ui';
import { goalSchema, type GoalForm } from '@/features/goals/goalSchema';
import { addDays, today } from '@/utils/format';

export interface GoalPrefill extends Partial<GoalForm> { ai_generated?: boolean }

export function GoalFormModal({ open, onClose, editing, prefill, categories, onSaved, lockCategory = false }: {
  open: boolean; onClose: () => void; editing: Goal | null; prefill?: GoalPrefill | null; categories: Category[]; onSaved: (g: Goal) => void;
  /** Show the category as fixed (e.g. when adding from a category page). */
  lockCategory?: boolean;
}) {
  const toast = useToast();
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GoalForm>({ resolver: zodResolver(goalSchema) });
  const ms = useFieldArray({ control, name: 'milestones' });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        title: editing.title, description: editing.description ?? '', category_id: editing.category_id, start_date: editing.start_date,
        end_date: editing.end_date, importance: editing.importance, status: editing.status, notes: editing.notes ?? '',
        milestones: editing.milestones.map((m) => ({ id: m.id, title: m.title, description: m.description ?? '', due_date: m.due_date ?? '' })),
      });
    } else {
      reset({
        title: '', description: '', category_id: categories[0]?.id ?? '', start_date: today(), end_date: addDays(today(), 30),
        importance: 'MEDIUM', status: 'ACTIVE', notes: '', milestones: [], ...prefill,
      });
    }
  }, [open, editing, prefill, categories, reset]);

  const onSubmit = async (v: GoalForm) => {
    const body: GoalInput = {
      ...v,
      description: v.description || null,
      notes: v.notes || null,
      milestones: v.milestones.map((m) => ({ ...m, description: m.description || null, due_date: m.due_date || null })),
      ...(editing ? {} : { ai_generated: !!prefill?.ai_generated }),
    };
    try {
      const g = editing ? await goalsApi.update(editing.id, body) : await goalsApi.create(body);
      toast.success(editing ? 'Goal updated' : prefill?.ai_generated ? 'Saved for review' : 'Goal created', prefill?.ai_generated && !editing ? 'Approve it to make it active.' : undefined);
      onSaved(g);
      onClose();
    } catch (e) { toast.apiError(e, 'Could not save goal'); }
  };

  return (
    <Modal open={open} onClose={onClose} wide title={editing ? 'Edit goal' : prefill?.ai_generated ? 'Review AI suggestion' : 'New goal'} footer={
      <><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>{isSubmitting ? 'Saving…' : 'Save goal'}</button></>
    }>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Title" error={errors.title?.message}><input className="input" placeholder="e.g. Switch to an ML engineer role" {...register('title')} /></Field>
        <Field label="Description" error={errors.description?.message}><textarea className="input min-h-[80px]" placeholder="What does success look like?" {...register('description')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" error={errors.category_id?.message}>
            {lockCategory ? (
              <>
                <input type="hidden" {...register('category_id')} />
                <div className="input flex items-center gap-2 bg-muted/60" aria-label="Category (fixed)">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: categories[0]?.color ?? undefined }} />
                  <span className="font-semibold">{categories[0]?.name}</span>
                </div>
              </>
            ) : (
              <select className="input" {...register('category_id')}>
                <option value="">Choose…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Importance" error={errors.importance?.message}>
            <select className="input" {...register('importance')}>
              <option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
            </select>
          </Field>
          <Field label="Start date" error={errors.start_date?.message}><input type="date" className="input" {...register('start_date')} /></Field>
          <Field label="End date" error={errors.end_date?.message}><input type="date" className="input" {...register('end_date')} /></Field>
          {editing && (
            <Field label="Status">
              <select className="input" {...register('status')}>
                {['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Milestones (optional)</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => ms.append({ title: '', description: '', due_date: '' })}><Plus className="h-3.5 w-3.5" />Add</button>
          </div>
          <div className="space-y-2">
            {ms.fields.map((f, i) => (
              <div key={f.id} className="grid gap-2 rounded-2xl border border-border/70 p-3 sm:grid-cols-[1fr_150px_auto]">
                <div>
                  <input className="input" placeholder={`Milestone ${i + 1}`} {...register(`milestones.${i}.title`)} />
                  {errors.milestones?.[i]?.title && <p className="mt-1 text-xs text-danger">{errors.milestones[i]!.title!.message}</p>}
                  <input className="input mt-2" placeholder="Details (optional)" {...register(`milestones.${i}.description`)} />
                </div>
                <div>
                  <input type="date" className="input" aria-label="Milestone due date" {...register(`milestones.${i}.due_date`)} />
                  {errors.milestones?.[i]?.due_date && <p className="mt-1 text-xs text-danger">{errors.milestones[i]!.due_date!.message}</p>}
                </div>
                <button type="button" className="btn-ghost btn-sm h-9 text-danger" onClick={() => ms.remove(i)} aria-label="Remove milestone"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {!ms.fields.length && <p className="text-xs text-subtle">Break the goal into checkpoints to track it better.</p>}
          </div>
        </div>
        <Field label="Notes"><textarea className="input min-h-[60px]" {...register('notes')} /></Field>
      </form>
    </Modal>
  );
}
