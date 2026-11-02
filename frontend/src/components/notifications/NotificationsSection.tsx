import { useState } from 'react';
import { AlarmClock, Bell, BellRing, CalendarCheck, CheckCheck, Moon, Sun, TriangleAlert } from 'lucide-react';
import type { GoalBrief } from '@/types';
import { notificationsApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/contexts/ToastContext';
import { EmptyState, ErrorState, SectionHeader, Segmented, Skeleton } from '@/components/common/ui';
import { colorFor, fmtDate, timeAgo, titleCase } from '@/utils/format';

export default function NotificationsSection() {
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const list = useAsync(() => notificationsApi.list({ unread_only: filter === 'unread', page }), [filter, page]);
  const pending = useAsync(() => notificationsApi.pending(), []);
  const [gen, setGen] = useState<string | null>(null);

  const read = async (id: string) => {
    list.setData((d) => d && { ...d, items: d.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)), unread_count: Math.max(0, d.unread_count - 1) });
    try { await notificationsApi.read(id); } catch (e) { toast.apiError(e); list.reload(true); }
  };

  const generate = async (kind: 'DAILY' | 'EVENING' | 'WEEKLY') => {
    setGen(kind);
    try {
      const r = await notificationsApi.generate(kind);
      r.length ? toast.success(`${r.length} new notification${r.length > 1 ? 's' : ''}`) : toast.info('You are all caught up', 'This summary was already generated.');
      setPage(1); list.reload(true); pending.reload(true);
    } catch (e) { toast.apiError(e); } finally { setGen(null); }
  };

  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const p = pending.data;

  const Group = ({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: GoalBrief[]; tone: string }) => (
    <div>
      <p className={`mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase ${tone}`}>{icon}{title} <span className="text-subtle">({items.length})</span></p>
      {!items.length ? <p className="text-xs text-subtle">None 🎉</p> : (
        <ul className="space-y-1.5">
          {items.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-xl bg-muted/60 p-2 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ background: colorFor(g.category_color) }} />
              <span className="flex-1 truncate">{g.title}</span>
              <span className="text-[11px] text-subtle">{fmtDate(g.end_date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionHeader title="Notifications" icon={<Bell className="h-5 w-5" />} subtitle={data ? `${data.unread_count} unread` : undefined}
        actions={
          <>
            <button className="btn-outline btn-sm" disabled={!!gen} onClick={() => generate('DAILY')}><Sun className="h-3.5 w-3.5" />{gen === 'DAILY' ? '…' : 'Morning brief'}</button>
            <button className="btn-outline btn-sm" disabled={!!gen} onClick={() => generate('EVENING')}><Moon className="h-3.5 w-3.5" />{gen === 'EVENING' ? '…' : 'Evening summary'}</button>
            <button className="btn-outline btn-sm" disabled={!!gen} onClick={() => generate('WEEKLY')}><CalendarCheck className="h-3.5 w-3.5" />{gen === 'WEEKLY' ? '…' : 'Weekly review'}</button>
          </>
        } />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card card-pad">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented size="sm" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} />
            <button className="btn-ghost btn-sm" disabled={!data?.unread_count} onClick={async () => { try { await notificationsApi.readAll(); toast.success('All marked as read'); list.reload(true); } catch (e) { toast.apiError(e); } }}>
              <CheckCheck className="h-3.5 w-3.5" />Mark all read
            </button>
          </div>
          {list.loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            : list.error ? <ErrorState message={list.error} onRetry={list.reload} />
            : !data?.items.length ? <EmptyState title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} message="Reminders and summaries arrive automatically each morning, evening and week — or generate one now." face="chill" />
            : (
              <>
                <ul className="space-y-2">
                  {data.items.map((n) => (
                    <li key={n.id}>
                      <button onClick={() => !n.is_read && read(n.id)} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${n.is_read ? 'hover:bg-muted/50' : 'bg-primary/5 ring-1 ring-primary/20 hover:bg-primary/10'}`}>
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.is_read ? 'bg-muted text-subtle' : 'bg-gradient-to-br from-primary to-secondary text-white'}`}><BellRing className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{n.title}</p>
                            <span className="shrink-0 text-[11px] text-subtle">{timeAgo(n.created_at)}</span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-line text-sm text-subtle">{n.message}</p>
                          <span className="chip mt-1 bg-muted text-[10px] text-subtle">{titleCase(n.notification_type)}</span>
                        </div>
                        {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                      </button>
                    </li>
                  ))}
                </ul>
                {pages > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                    <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
                    <span className="text-subtle">{page} / {pages}</span>
                    <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
                  </div>
                )}
              </>
            )}
        </div>

        <div className="card card-pad h-fit space-y-4">
          <h3 className="flex items-center gap-2 font-bold"><AlarmClock className="h-4 w-4 text-warning" />Needs attention</h3>
          {pending.loading ? <Skeleton className="h-48" /> : pending.error ? <ErrorState message={pending.error} onRetry={pending.reload} /> : p && (
            <>
              <Group title="Overdue" icon={<TriangleAlert className="h-3.5 w-3.5" />} items={p.overdue} tone="text-danger" />
              <Group title="Due today" icon={<AlarmClock className="h-3.5 w-3.5" />} items={p.due_today} tone="text-warning" />
              <Group title="At risk" icon={<TriangleAlert className="h-3.5 w-3.5" />} items={p.at_risk} tone="text-secondary" />
              <Group title="Approaching" icon={<CalendarCheck className="h-3.5 w-3.5" />} items={p.approaching} tone="text-primary" />
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase text-subtle">Pending today ({p.pending_tasks_today.length})</p>
                {p.pending_tasks_today.slice(0, 6).map((i) => <p key={i.key} className="truncate text-sm">• {i.title}</p>)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
