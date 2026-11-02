import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import { authApi } from '@/services/endpoints';
import { useToast } from '@/contexts/ToastContext';
import { Field } from './ui';

const schema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Form = z.infer<typeof schema>;

export function ChangePasswordCard() {
  const toast = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  const onSubmit = async (v: Form) => {
    try {
      await authApi.changePassword(v.current_password, v.new_password);
      toast.success('Password changed');
      reset({ current_password: '', new_password: '', confirm: '' });
    } catch (e) { toast.apiError(e, 'Could not change password'); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card card-pad space-y-4">
      <h3 className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4 text-primary" />Change password</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Current" error={errors.current_password?.message}><input type="password" className="input" {...register('current_password')} /></Field>
        <Field label="New" error={errors.new_password?.message}><input type="password" className="input" {...register('new_password')} /></Field>
        <Field label="Confirm" error={errors.confirm?.message}><input type="password" className="input" {...register('confirm')} /></Field>
      </div>
      <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Update password'}</button>
    </form>
  );
}
