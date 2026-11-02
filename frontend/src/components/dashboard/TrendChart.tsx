import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { ChartCard, NoChartData, useChartTheme, pctFmt } from '@/components/common/charts';
import { ErrorState, Segmented, Skeleton } from '@/components/common/ui';

export function TrendChart({ start, end }: { start?: string; end?: string }) {
  const [g, setG] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const t = useChartTheme();
  const { data, loading, error, reload } = useAsync(() => dashboardApi.trends({ granularity: g, start, end }), [g, start, end]);

  const rows = (data?.series ?? []).map((s) => ({ label: s.label, Group: s.group_rate, ...Object.fromEntries((data?.users ?? []).map((u) => [u.name, s.users[u.user_id] ?? null])) }));
  const hasData = rows.some((r) => r.Group !== null);

  return (
    <ChartCard
      title="Completion trend" subtitle="Group vs individual completion rate"
      actions={<Segmented size="sm" value={g} onChange={setG} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />}
    >
      {loading ? <Skeleton className="h-72" /> : error ? <ErrorState message={error} onRetry={reload} /> : !hasData ? <NoChartData /> : (
        <ResponsiveContainer width="100%" height={290}>
          <AreaChart data={rows} margin={{ left: -18, right: 8, top: 6 }}>
            <defs>
              <linearGradient id="grp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.palette.primary} stopOpacity={0.45} />
                <stop offset="100%" stopColor={t.palette.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...t.grid} />
            <XAxis dataKey="label" {...t.axis} />
            <YAxis domain={[0, 100]} unit="%" {...t.axis} />
            <Tooltip {...t.tooltip} formatter={pctFmt} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Group" stroke={t.palette.primary} strokeWidth={3} fill="url(#grp)" connectNulls />
            {(data?.users ?? []).map((u) => (
              <Line key={u.user_id} type="monotone" dataKey={u.name} stroke={u.avatar_color} strokeWidth={2} dot={false} connectNulls />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
