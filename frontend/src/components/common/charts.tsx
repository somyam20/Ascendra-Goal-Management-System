import type { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

/** Shared chart styling that follows the active theme. */
export function useChartTheme() {
  const { palette } = useTheme();
  return {
    palette,
    series: [palette.primary, palette.secondary, palette.accent, palette.success, palette.warning, palette.danger],
    axis: { stroke: palette.subtle, fontSize: 11, tickLine: false, axisLine: false },
    grid: { stroke: palette.border, strokeDasharray: '4 4', vertical: false },
    tooltip: {
      contentStyle: { background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 14, boxShadow: '0 10px 30px -12px rgba(0,0,0,.3)', fontSize: 12, color: palette.fg },
      labelStyle: { color: palette.fg, fontWeight: 600 },
      itemStyle: { color: palette.fg },
      cursor: { fill: palette.muted, opacity: 0.6 },
    },
  };
}

export function ChartCard({ title, subtitle, actions, children, className = '' }: {
  title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={`card card-pad animate-fade-up ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">{title}</h3>
          {subtitle && <p className="text-xs text-subtle">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function NoChartData({ text = 'No evaluated activity in this period yet.' }: { text?: string }) {
  return <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-subtle">{text}</div>;
}

export const pctFmt = (v: unknown) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(0)}%`);
