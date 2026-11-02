import { Suspense, lazy, useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { BarChart3, Bell, CalendarDays, CheckSquare, Eye, LayoutGrid, Settings, Shapes, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectory } from '@/hooks/useDirectory';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { SlidingTabs, type TabItem } from '@/components/layout/SlidingTabs';
import { Avatar, EmptyState } from '@/components/common/ui';
import { EmojiLoader } from '@/components/common/EmojiLoader';

const Overview = lazy(() => import('@/features/goals/Overview'));
const CategoriesSection = lazy(() => import('@/components/categories/CategoriesSection'));
const GoalsSection = lazy(() => import('@/components/goals/GoalsSection'));
const TimetableSection = lazy(() => import('@/components/timetable/TimetableSection'));
const ProgressSection = lazy(() => import('@/components/progress/ProgressSection'));
const NotificationsSection = lazy(() => import('@/components/notifications/NotificationsSection'));
const AnalyticsSection = lazy(() => import('@/features/analytics/AnalyticsSection'));
const SettingsSection = lazy(() => import('@/features/planning/SettingsSection'));
const CategoryDetail = lazy(() => import('@/components/categories/CategoryDetail'));

const ALL_TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid, private: false },
  { key: 'categories', label: 'My Categories', icon: Shapes, private: false },
  { key: 'goals', label: 'My Goals', icon: Target, private: false },
  { key: 'timetable', label: 'My Timetable', icon: CalendarDays, private: false },
  { key: 'progress', label: 'Daily Progress', icon: CheckSquare, private: false },
  { key: 'notifications', label: 'Notifications', icon: Bell, private: true },
  { key: 'analytics', label: 'My Analytics', icon: BarChart3, private: false },
  { key: 'settings', label: 'Settings', icon: Settings, private: true },
] as const;

export default function UserWorkspace() {
  const { userId = '', tab: tabParam, categoryId } = useParams();
  const tab = categoryId ? 'categories' : tabParam ?? 'overview';
  const { user } = useAuth();
  const { users, loading } = useDirectory();

  const owner = users.find((u) => u.id === userId) ?? (user && user.id === userId ? { id: user.id, name: user.name, avatar_color: user.avatar_color, role: user.role } : undefined);
  const readOnly = userId !== user?.id;
  const tabs = useMemo(() => ALL_TABS.filter((t) => !(readOnly && t.private)), [readOnly]);

  if (loading && !owner) return <EmojiLoader />;
  if (!owner) return <div className="card"><EmptyState title="Workspace not found" message="This user doesn't exist or is no longer active." /></div>;
  if (!tabs.some((t) => t.key === tab)) return <Navigate to={`/u/${userId}`} replace />;

  const items: TabItem[] = tabs.map((t) => {
    const I = t.icon;
    const label = readOnly ? t.label.replace('My ', '') : t.label;
    return { key: t.key, to: t.key === 'overview' ? `/u/${userId}` : `/u/${userId}/${t.key}`, label, icon: <I className="h-4 w-4" /> };
  });

  const Section = { overview: Overview, categories: CategoriesSection, goals: GoalsSection, timetable: TimetableSection, progress: ProgressSection, notifications: NotificationsSection, analytics: AnalyticsSection, settings: SettingsSection }[tab as (typeof ALL_TABS)[number]['key']];

  return (
    <WorkspaceProvider value={{ owner, readOnly, viewUserId: readOnly ? owner.id : undefined }}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-4 animate-fade-up">
          <div className="relative">
            <Avatar name={owner.name} color={owner.avatar_color} size={56} />
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-bg bg-success" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-brand text-3xl font-semibold sm:text-4xl">{readOnly ? `${owner.name}'s workspace` : 'My workspace'}</h1>
            <p className="text-sm text-subtle">{readOnly ? 'A peek at their goals, plans and progress.' : 'Goals, plans and progress — all in one place.'}</p>
          </div>
        </div>
        {readOnly && (
          <div role="note" className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm animate-fade-up">
            <Eye className="h-5 w-5 shrink-0 text-primary" />
            <p>Viewing <b>{owner.name}</b>'s workspace — <b>read-only</b>. You can explore, but only {owner.name} can make changes.</p>
          </div>
        )}
        <div className="card px-2 sm:px-4">
          <SlidingTabs items={items} active={tab} variant="sub" />
        </div>
        <Suspense fallback={<EmojiLoader />}>
          <div key={`${userId}-${tab}-${categoryId ?? ''}`} className="animate-fade-up">{categoryId ? <CategoryDetail categoryId={categoryId} /> : <Section />}</div>
        </Suspense>
      </div>
    </WorkspaceProvider>
  );
}
