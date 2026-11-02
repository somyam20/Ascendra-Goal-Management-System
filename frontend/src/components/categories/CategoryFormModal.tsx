import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Category } from '@/types';
import { categoriesApi } from '@/services/endpoints';
import { useToast } from '@/contexts/ToastContext';
import { Field, Modal } from '@/components/common/ui';
import { CategoryIcon, ICON_NAMES } from '@/components/common/CategoryIcon';
import { FALLBACK_COLORS } from '@/utils/format';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().max(500).optional(),
  icon: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color'),
});
type Form = z.infer<typeof schema>;

export function CategoryFormModal({ open, onClose, editing, onSaved }: { open: boolean; onClose: () => void; editing: Category | null; onSaved: () => void }) {
  const toast = useToast();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ name: editing?.name ?? '', description: editing?.description ?? '', icon: editing?.icon ?? 'target', color: editing?.color ?? FALLBACK_COLORS[0] });
  }, [open, editing, reset]);

  const icon = watch('icon');
  const color = watch('color');

  const onSubmit = async (v: Form) => {
    try {
      if (editing) await categoriesApi.update(editing.id, v);
      else await categoriesApi.create(v);
      toast.success(editing ? 'Category updated' : 'Category created');
      onSaved();
      onClose();
    } catch (e) { toast.apiError(e, 'Could not save category'); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit category' : 'New category'} footer={
      <><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>{isSubmitting ? 'Saving…' : 'Save'}</button></>
    }>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: `${color}18` }}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: color }}><CategoryIcon name={icon} className="h-6 w-6" /></span>
          <p className="font-bold">{watch('name') || 'Category preview'}</p>
        </div>
        <Field label="Name" error={errors.name?.message}><input className="input" placeholder="e.g. Reading" {...register('name')} /></Field>
        <Field label="Description" error={errors.description?.message}><textarea className="input min-h-[70px]" {...register('description')} /></Field>
        <div>
          <span className="label">Icon</span>
          <div className="grid grid-cols-10 gap-1.5">
            {ICON_NAMES.map((n) => (
              <button type="button" key={n} onClick={() => setValue('icon', n)} aria-label={n}
                className={`flex aspect-square items-center justify-center rounded-xl transition ${icon === n ? 'text-white' : 'bg-muted text-subtle hover:text-fg'}`}
                style={icon === n ? { background: color } : undefined}>
                <CategoryIcon name={n} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Color</span>
          <div className="flex flex-wrap items-center gap-2">
            {FALLBACK_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setValue('color', c)} aria-label={c}
                className={`h-8 w-8 rounded-full transition ${color === c ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : ''}`} style={{ background: c }} />
            ))}
            <input type="color" className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-transparent" value={color || '#6366f1'} onChange={(e) => setValue('color', e.target.value)} aria-label="Custom color" />
          </div>
          {errors.color && <p className="mt-1 text-xs text-danger">{errors.color.message}</p>}
        </div>
      </form>
    </Modal>
  );
}
