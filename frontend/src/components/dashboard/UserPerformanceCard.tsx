import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Flame, Target } from 'lucide-react';
import type { DashboardUser } from '@/types';
import { Avatar, ProgressRing } from '@/components/common/ui';
import { colorFor, pct } from '@/utils/format';

export function UserPerformanceCard({ u, i }: { u: DashboardUser; i: number }) {
  return (
    <Link to={`/u/${u.user_id}`} className="card card-pad group relative block animate-fade-up overflow-hidden transition hover:-translate-y-1 hover:shadow-glow" style={{ animationDelay: `${i * 70}ms` }}>
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${u.avatar_color}, ${u.avatar_color}55)` }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={u.name} color={u.avatar_color} size={44} />
          <div>
            <p className="font-bold">{u.name}</p>
            <p className="text-xs text-subtle">{u.evaluated} evaluated tasks</p>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-subtle transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <ProgressRing value={u.completion_rate} size={78} color={u.avatar_color} sub="done" />
        <div className="grid flex-1 grid-cols-1 gap-1.5 text-sm">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{u.completed} completed</span>
          <span className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" />{u.active_goals} active · {u.completed_goals} done goals</span>
          <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-warning" />{pct(u.consistency_rate)} consistency</span>
        </div>
      </div>
      {u.categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {u.categories.slice(0, 4).map((c, j) => (
            <span key={c.name} className="chip" style={{ background: `${colorFor(c.color, j)}22`, color: colorFor(c.color, j) }}>
              {c.name} {pct(c.completion_rate)}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
