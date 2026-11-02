import { useEffect, type ReactNode } from 'react';
import { Lumi } from '@/components/brand/Lumi';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { initials } from '@/utils/format';

export function Avatar({ name, color, size = 36, ring = false }: { name: string; color?: string | null; size?: number; ring?: boolean }) {
  const c = color || '#6366f1';
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ${ring ? 'ring-2 ring-surface' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${c}, ${c}aa)` }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`chip ${className}`}>{children}</span>;
}

export function ProgressRing({ value, size = 64, stroke = 7, color, label, sub }: {
  value: number | null; size?: number; stroke?: number; color?: string; label?: ReactNode; sub?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round"
          stroke={color || 'rgb(var(--c-primary))'} strokeDasharray={circ} strokeDashoffset={circ - (v / 100) * circ}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-bold" style={{ fontSize: size * 0.24 }}>{label ?? (value === null ? '—' : `${Math.round(v)}%`)}</span>
        {sub && <span className="mt-0.5 text-[10px] text-subtle">{sub}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, color }: { value: number | null; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: color || 'linear-gradient(90deg, rgb(var(--c-primary)), rgb(var(--c-secondary)))' }} />
    </div>
  );
}

export function StatCard({ icon, label, value, hint, tone = 'primary', delay = 0 }: {
  icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger'; delay?: number;
}) {
  const tones: Record<string, string> = {
    primary: 'from-primary/20 to-primary/5 text-primary', secondary: 'from-secondary/20 to-secondary/5 text-secondary',
    accent: 'from-accent/20 to-accent/5 text-accent', success: 'from-success/20 to-success/5 text-success',
    warning: 'from-warning/20 to-warning/5 text-warning', danger: 'from-danger/20 to-danger/5 text-danger',
  };
  return (
    <div className="card card-pad group relative animate-fade-up overflow-hidden transition hover:-translate-y-0.5" style={{ animationDelay: `${delay}ms` }}>
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-60 blur-xl transition group-hover:scale-125 ${tones[tone]}`} />
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone]}`}>{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-glow">{icon}</div>}
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
          {subtitle && <p className="text-sm text-subtle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, message, action, face = 'sprout' }: { title: string; message?: ReactNode; action?: ReactNode; face?: 'sprout' | 'chill' }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center animate-fade-up">
      <Lumi size={88} mood={face === 'sprout' ? 'think' : 'sleep'} />
      <h3 className="mt-2 text-lg font-bold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-subtle">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card card-pad flex flex-col items-center gap-3 text-center" role="alert">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger"><AlertTriangle /></div>
      <p className="text-sm font-medium">{message}</p>
      {onRetry && <button className="btn-outline btn-sm" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Try again</button>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Modal({ open, onClose, title, children, footer, wide = false }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-up_.2s_ease-out]" onClick={onClose} />
      <div className={`card relative flex max-h-[92vh] w-full animate-scale-in flex-col rounded-b-none sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} bg-surface`}>
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md animate-[fade-up_.25s_ease-out] flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onClose }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className={danger ? 'btn bg-danger text-white hover:brightness-110' : 'btn-primary'} disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button>
      </>
    }>
      <p className="text-sm text-subtle">{message}</p>
    </Modal>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-subtle">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`rounded-lg font-semibold transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-subtle hover:text-fg'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CardSkeletonGrid({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-32" />)}
    </div>
  );
}
