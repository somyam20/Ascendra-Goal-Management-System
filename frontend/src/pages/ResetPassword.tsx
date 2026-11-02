import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import { authApi } from '@/services/endpoints';
import { parseApiError } from '@/services/api';
import { Field } from '@/components/common/ui';
import { SproutFace } from '@/components/common/EmojiLoader';

const schema = z.object({
  token: z.string().min(1, 'Reset code is required'),
  new_password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Form = z.infer<typeof schema>;

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { token: sp.get('token') ?? '' } });

  const onSubmit = async (v: Form) => {
    setError(null);
    try { await authApi.resetPassword(v.token.trim(), v.new_password); setDone(true); } catch (e) { setError(parseApiError(e).message); }
  };

  return (
    <div className="bg-blobs flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md animate-scale-in bg-surface p-8">
        {done ? (
          <div className="text-center">
            <SproutFace size={80} />
            <h2 className="mt-2 text-2xl font-bold">Password updated</h2>
            <p className="mt-1 text-sm text-subtle">You can now sign in with your new password.</p>
            <Link to="/login" className="btn-primary mt-5">Go to sign in</Link>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white"><KeyRound /></span>
              <div><h2 className="text-xl font-bold">Reset password</h2><p className="text-sm text-subtle">Use the one-time code from your admin.</p></div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Field label="Reset code" error={errors.token?.message}><input className="input" {...register('token')} /></Field>
              <Field label="New password" error={errors.new_password?.message}><input type="password" className="input" {...register('new_password')} /></Field>
              <Field label="Confirm password" error={errors.confirm?.message}><input type="password" className="input" {...register('confirm')} /></Field>
              {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Set new password'}</button>
              <Link to="/login" className="block text-center text-xs text-subtle hover:text-fg">Back to sign in</Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
