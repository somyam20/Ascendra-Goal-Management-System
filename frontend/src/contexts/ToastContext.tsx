import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { parseApiError } from '@/services/api';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; title: string; body?: string }

interface ToastCtx {
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
  apiError: (err: unknown, title?: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Kind, title: string, body?: string) => {
    const id = ++seq;
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6500 : 3800);
  }, [dismiss]);

  const value = useMemo<ToastCtx>(() => ({
    success: (t, b) => push('success', t, b),
    error: (t, b) => push('error', t, b),
    info: (t, b) => push('info', t, b),
    apiError: (err, title = 'Something went wrong') => {
      const p = parseApiError(err);
      push('error', title, [p.message, ...p.conflicts].join(' • '));
    },
  }), [push]);

  const icon = { success: <CheckCircle2 className="h-5 w-5 text-success" />, error: <XCircle className="h-5 w-5 text-danger" />, info: <Info className="h-5 w-5 text-primary" /> };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="card pointer-events-auto flex animate-fade-up items-start gap-3 p-4">
            {icon[t.kind]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 break-words text-xs text-subtle">{t.body}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-subtle hover:text-fg" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used within ToastProvider');
  return c;
}
