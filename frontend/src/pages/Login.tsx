import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { parseApiError } from '@/services/api';
import { Lumi } from '@/components/brand/Lumi';
import { AscendraLogo } from '@/components/brand/AscendraLogo';
import { LiveBackground } from '@/components/layout/LiveBackground';
import { ModeToggle, ThemePicker } from '@/components/layout/ThemePicker';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (v: Form) => {
    setError(null);
    try {
      await login(v.email.trim(), v.password);
      nav((loc.state as { from?: string } | null)?.from || '/', { replace: true });
    } catch (e) {
      const p = parseApiError(e);
      setError(p.status === 401 ? 'Incorrect email or password.' : p.message);
    }
  };

  return (
    <div className="bg-blobs relative flex min-h-screen items-center justify-center p-4">
      <LiveBackground />
      <div className="absolute right-4 top-4 flex gap-1"><ThemePicker /><ModeToggle /></div>
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <div className="hidden animate-fade-up lg:block">
          <AscendraLogo size={56} tagline className="mb-10 text-3xl" />
          <h1 className="font-brand text-5xl font-semibold leading-[1.05] xl:text-6xl">Small steps.<br /><span className="gradient-text">Bright rise.</span></h1>
          <p className="mt-4 max-w-md text-lg text-subtle">Goals, AI-assisted weekly plans, daily check-ins and a friendly leaderboard — for you and your circle.</p>
          <div className="mt-8 flex items-end gap-3">
            <Lumi size={150} mood="wave" />
            <div className="relative mb-16 max-w-[15rem] rounded-2xl rounded-bl-sm border border-border/70 bg-surface/90 px-4 py-3 text-sm shadow-soft backdrop-blur-xl animate-scale-in">
              <p className="font-semibold">Hi, I'm Lumi!</p>
              <p className="text-subtle">Sign in and let's make today count. ✨</p>
            </div>
          </div>
        </div>
        <div className="card mx-auto w-full max-w-md animate-scale-in bg-surface/90 p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-3">
            <div className="lg:hidden"><Lumi size={64} mood="wave" /></div>
            <div>
              <p className="font-brand text-lg font-semibold lg:hidden">Ascendra</p>
              <h2 className="text-2xl font-extrabold">Welcome back</h2>
              <p className="text-sm text-subtle">Sign in to your workspace</p>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <label className="block">
              <span className="label">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input className="input pl-9" type="email" autoComplete="email" placeholder="you@example.com" aria-label="Email" {...register('email')} />
              </div>
              {errors.email && <span className="mt-1 block text-xs text-danger">{errors.email.message}</span>}
            </label>
            <label className="block">
              <span className="label">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input className="input pl-9" type="password" autoComplete="current-password" placeholder="••••••••" aria-label="Password" {...register('password')} />
              </div>
              {errors.password && <span className="mt-1 block text-xs text-danger">{errors.password.message}</span>}
            </label>
            {error && <div role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
            <button type="submit" className="btn-primary w-full py-2.5" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-subtle">New here? <Link className="font-semibold text-primary hover:underline" to="/signup">Create your account</Link></p>
          <p className="mt-2 text-center text-xs text-subtle">Got a reset code from your admin? <a className="font-semibold text-primary hover:underline" href="/reset-password">Reset password</a></p>
        </div>
      </div>
    </div>
  );
}
