import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { parseApiError } from '@/services/api';
import { Lumi } from '@/components/brand/Lumi';
import { AscendraLogo } from '@/components/brand/AscendraLogo';
import { LiveBackground } from '@/components/layout/LiveBackground';
import { ModeToggle, ThemePicker } from '@/components/layout/ThemePicker';

const schema = z.object({
  name: z.string().trim().min(1, 'Your name is required').max(120),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Form = z.infer<typeof schema>;

const iconCls = 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle';

function Field({ label, icon, error, children }: { label: string; icon: JSX.Element; error?: string; children: JSX.Element }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative">{icon}{children}</div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export default function Signup() {
  const { user, register: signUp } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (v: Form) => {
    setError(null);
    try {
      const u = await signUp(v.name.trim(), v.email.trim(), v.password);
      nav(`/u/${u.id}`, { replace: true });
    } catch (e) {
      const p = parseApiError(e);
      setError(p.status === 409 ? 'An account with this email already exists. Try signing in.' : p.message);
    }
  };

  return (
    <div className="bg-blobs relative flex min-h-screen items-center justify-center p-4">
      <LiveBackground />
      <div className="absolute right-4 top-4 flex gap-1"><ThemePicker /><ModeToggle /></div>
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <div className="hidden animate-fade-up lg:block">
          <AscendraLogo size={56} tagline className="mb-10 text-3xl" />
          <h1 className="font-brand text-5xl font-semibold leading-[1.05] xl:text-6xl">Join the climb.<br /><span className="gradient-text">Rise together.</span></h1>
          <p className="mt-4 max-w-md text-lg text-subtle">Create your account and you get your own workspace, a place on the dashboard and a spot on the leaderboard.</p>
          <div className="mt-8"><Lumi size={150} mood="cheer" /></div>
        </div>
        <div className="card mx-auto w-full max-w-md animate-scale-in bg-surface/90 p-7 sm:p-9">
          <h2 className="text-2xl font-extrabold">Create your account</h2>
          <p className="mb-6 text-sm text-subtle">It takes less than a minute</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Full name" icon={<User className={iconCls} />} error={errors.name?.message}>
              <input className="input pl-9" autoComplete="name" placeholder="Your name" aria-label="Full name" {...register('name')} />
            </Field>
            <Field label="Email" icon={<Mail className={iconCls} />} error={errors.email?.message}>
              <input className="input pl-9" type="email" autoComplete="email" placeholder="you@example.com" aria-label="Email" {...register('email')} />
            </Field>
            <Field label="Password" icon={<Lock className={iconCls} />} error={errors.password?.message}>
              <input className="input pl-9" type="password" autoComplete="new-password" placeholder="At least 8 characters" aria-label="Password" {...register('password')} />
            </Field>
            <Field label="Confirm password" icon={<Lock className={iconCls} />} error={errors.confirm?.message}>
              <input className="input pl-9" type="password" autoComplete="new-password" placeholder="Repeat password" aria-label="Confirm password" {...register('confirm')} />
            </Field>
            {error && <div role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
            <button type="submit" className="btn-primary w-full py-2.5" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : <>Sign up <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-subtle">Already have an account? <Link className="font-semibold text-primary hover:underline" to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
