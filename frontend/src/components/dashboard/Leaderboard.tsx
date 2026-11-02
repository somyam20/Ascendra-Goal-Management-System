import { useState } from 'react';
import { Crown, Medal, Trophy } from 'lucide-react';
import { dashboardApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { Avatar, ErrorState, ProgressBar, Segmented, Skeleton } from '@/components/common/ui';
import { fmtDate, pct } from '@/utils/format';

const podium = ['from-yellow-300 to-amber-500', 'from-slate-200 to-slate-400', 'from-orange-300 to-amber-700'];

export function Leaderboard() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const { data, loading, error, reload } = useAsync(() => dashboardApi.leaderboard(period), [period]);

  return (
    <div className="card card-pad animate-fade-up">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 to-amber-500 text-white"><Trophy className="h-5 w-5" /></span>
          <div>
            <h3 className="font-bold">Leaderboard</h3>
            {data && <p className="text-xs text-subtle">{fmtDate(data.start)} – {fmtDate(data.end)} · min {data.min_evaluated} evaluated tasks</p>}
          </div>
        </div>
        <Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
      </div>
      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        : error ? <ErrorState message={error} onRetry={reload} />
        : !data?.entries.length ? <p className="py-6 text-center text-sm text-subtle">No users yet.</p>
        : (
          <ol className="space-y-2">
            {data.entries.map((e, i) => (
              <li key={e.user_id} className={`flex items-center gap-3 rounded-2xl p-3 transition hover:bg-muted/60 animate-fade-up ${!e.eligible ? 'opacity-60' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${e.rank && e.rank <= 3 ? `bg-gradient-to-br text-white ${podium[e.rank - 1]}` : 'bg-muted text-subtle'}`}>
                  {e.rank === 1 ? <Crown className="h-4 w-4" /> : e.rank && e.rank <= 3 ? <Medal className="h-4 w-4" /> : e.rank ?? '–'}
                </span>
                <Avatar name={e.name} color={e.avatar_color} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{e.name}</p>
                    <p className="font-display text-lg font-extrabold">{pct(e.completion_rate)}</p>
                  </div>
                  <ProgressBar value={e.completion_rate} color={e.avatar_color} />
                  <p className="mt-1 text-[11px] text-subtle">
                    {e.completed}/{e.evaluated} evaluated tasks done{!e.eligible && ' · not enough activity to rank'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
}
