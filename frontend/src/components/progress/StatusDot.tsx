import { CheckCircle2, CircleDashed, CircleSlash, XCircle } from 'lucide-react';
import type { CompletionStatus } from '@/types';

/** Visual distinction: done (green), not done (red), pending (dashed), unreported past (amber). */
export function StatusDot({ status, past }: { status: CompletionStatus; past?: boolean }) {
  if (status === 1) return <span className="chip bg-success/15 text-success"><CheckCircle2 className="h-3.5 w-3.5" />Done</span>;
  if (status === 0) return <span className="chip bg-danger/10 text-danger"><XCircle className="h-3.5 w-3.5" />Not done</span>;
  if (past) return <span className="chip bg-warning/15 text-warning"><CircleSlash className="h-3.5 w-3.5" />Unreported</span>;
  return <span className="chip bg-muted text-subtle"><CircleDashed className="h-3.5 w-3.5" />Pending</span>;
}
