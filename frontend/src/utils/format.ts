import type { Importance } from '@/types';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-date ISO (YYYY-MM-DD) — avoid toISOString's UTC shift. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => toISODate(new Date());

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Monday of the week containing iso. */
export function mondayOf(iso: string): string {
  const d = parseISODate(iso);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return toISODate(d);
}

export function weekdayIndex(iso: string): number {
  return (parseISODate(iso).getDay() + 6) % 7;
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  if (!iso) return '—';
  const d = iso.length <= 10 ? parseISODate(iso) : new Date(iso);
  return d.toLocaleDateString(undefined, opts);
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '—' : `${v.toFixed(digits)}%`);

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHHMM(m: number): string {
  const c = Math.max(0, Math.min(24 * 60 - 1, m));
  return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`;
}

export const hours = (minutes: number) => `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)}h`;

export const IMPORTANCE_META: Record<Importance, { label: string; cls: string; weight: number }> = {
  CRITICAL: { label: 'Critical', cls: 'bg-danger/15 text-danger', weight: 4 },
  HIGH: { label: 'High', cls: 'bg-warning/15 text-warning', weight: 3 },
  MEDIUM: { label: 'Medium', cls: 'bg-primary/15 text-primary', weight: 2 },
  LOW: { label: 'Low', cls: 'bg-subtle/15 text-subtle', weight: 1 },
};

export const STATUS_META: Record<string, string> = {
  DRAFT: 'bg-subtle/15 text-subtle',
  ACTIVE: 'bg-primary/15 text-primary',
  COMPLETED: 'bg-success/15 text-success',
  PAUSED: 'bg-warning/15 text-warning',
  CANCELLED: 'bg-danger/10 text-danger',
  APPROVED: 'bg-success/15 text-success',
  REJECTED: 'bg-danger/10 text-danger',
  ARCHIVED: 'bg-subtle/15 text-subtle',
  PENDING_REVIEW: 'bg-warning/15 text-warning',
};

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

export const FALLBACK_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#0ea5e9', '#22c55e', '#ef4444'];
export const colorFor = (c: string | null | undefined, i = 0) => c || FALLBACK_COLORS[i % FALLBACK_COLORS.length]!;

export const BROWSER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
})();
