import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronsLeft, ChevronsRight, LayoutDashboard, LogOut, Menu, Settings, Shield, UserCircle2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi, notificationsApi, usersApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { Avatar } from '@/components/common/ui';
import { AscendraLogo, AscendraMark } from '@/components/brand/AscendraLogo';
import { ModeToggle, ThemePicker } from './ThemePicker';
import { LiveBackground } from './LiveBackground';
import { DirectoryContext } from '@/hooks/useDirectory';
import { storage } from '@/utils/storage';

function SideItem({ to, icon, label, collapsed, end, extra, onNavigate }: {
  to: string; icon: ReactNode; label: ReactNode; collapsed: boolean; end?: boolean; extra?: ReactNode; onNavigate?: () => void;
}) {
  return (
    <NavLink to={to} end={end} onClick={onNavigate} title={typeof label === 'string' ? label : undefined}
      className={({ isActive }) => `side-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}>
      <span className="flex shrink-0 items-center justify-center">{icon}</span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && extra}
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const dir = useAsync(() => usersApi.directory(), [user?.id]);
  const rates = useAsync(() => dashboardApi.users({ period: 'weekly' }), [user?.id]);
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(() => storage.get('lm.sidebar') === 'collapsed');
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { storage.set('lm.sidebar', collapsed ? 'collapsed' : 'open'); }, [collapsed]);
  useEffect(() => { setDrawer(false); }, [loc.pathname]);

  useEffect(() => {
    if (user?.role !== 'USER') return;
    let alive = true;
    const load = () => notificationsApi.list({ unread_only: true, page: 1 }).then((r) => alive && setUnread(r.unread_count)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [user?.role, loc.pathname]);

  const users = dir.data ?? [];
  const rateOf = (id: string) => rates.data?.find((r) => r.user_id === id)?.completion_rate ?? null;
  const isUser = user?.role === 'USER';
  const me = users.find((u) => u.id === user?.id);
  const others = users.filter((u) => u.id !== user?.id);
  const ordered = me ? [me, ...others] : others;

  if (!user) return null;

  const sidebar = (mobile: boolean) => {
    const c = collapsed && !mobile;
    return (
      <div className="flex h-full flex-col gap-1 p-3">
        <div className={`mb-3 flex items-center ${c ? 'justify-center' : 'justify-between'} px-1 pt-1`}>
          <Link to="/" aria-label="Ascendra home">{c ? <AscendraMark size={38} /> : <AscendraLogo size={38} tagline />}</Link>
          {mobile && <button className="btn-ghost h-9 w-9 p-0" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>}
        </div>

        <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pl-2.5 pr-0.5">
          <SideItem to="/" end icon={<LayoutDashboard className="h-5 w-5" />} label="Dashboard" collapsed={c} />
          {!c && <p className="mb-1 mt-4 px-3 text-[11px] font-bold uppercase tracking-wider text-subtle">Members</p>}
          {c && <div className="my-2 border-t border-border/60" />}
          {dir.loading && !users.length && [0, 1, 2].map((i) => <div key={i} className="skeleton mx-1 h-10" />)}
          {ordered.map((u) => {
            const r = rateOf(u.id);
            return (
              <SideItem key={u.id} to={`/u/${u.id}`} collapsed={c}
                icon={<Avatar name={u.name} color={u.avatar_color} size={28} />}
                label={<span className="flex items-center gap-1.5">{u.name}{u.id === user?.id && <span className="chip bg-primary/15 px-1.5 py-0 text-[10px] text-primary">You</span>}</span>}
                extra={r !== null ? <span className="text-[11px] font-semibold tabular-nums text-subtle" title="Completion this week">{Math.round(r)}%</span> : undefined}
              />
            );
          })}
          {!dir.loading && !users.length && !c && <p className="px-3 text-xs text-subtle">No members yet.</p>}
          {user?.role === 'ADMIN' && (
            <>
              {!c && <p className="mb-1 mt-4 px-3 text-[11px] font-bold uppercase tracking-wider text-subtle">Manage</p>}
              <SideItem to="/admin" icon={<Shield className="h-5 w-5" />} label="Admin" collapsed={c} />
            </>
          )}
        </nav>

        <div className="mt-2 space-y-2 border-t border-border/60 pt-3">
          <div className={`flex items-center ${c ? 'flex-col' : ''} gap-1`}>
            <ThemePicker placement="up" />
            <ModeToggle />
            {isUser && (
              <button className="btn-ghost relative h-10 w-10 p-0" aria-label="Notifications" onClick={() => nav(`/u/${user!.id}/notifications`)}>
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
              </button>
            )}
            {!mobile && (
              <button className={`btn-ghost h-10 w-10 p-0 ${c ? '' : 'ml-auto'}`} onClick={() => setCollapsed((x) => !x)} aria-label={c ? 'Expand sidebar' : 'Collapse sidebar'} title={c ? 'Expand' : 'Collapse'}>
                {c ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
              </button>
            )}
          </div>
          <div className={`flex items-center gap-2 rounded-2xl bg-muted/60 p-2 ${c ? 'flex-col' : ''}`}>
            <Link to={isUser ? `/u/${user!.id}/settings` : '/profile'} title="Profile & settings" className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar name={user!.name} color={user!.avatar_color} size={34} ring />
              {!c && <span className="min-w-0"><span className="block truncate text-sm font-semibold">{user!.name}</span><span className="block truncate text-[11px] text-subtle">{user!.email}</span></span>}
            </Link>
            {!c && isUser && <Link to={`/u/${user!.id}`} className="btn-ghost h-8 w-8 p-0" title="My workspace" aria-label="My workspace"><UserCircle2 className="h-4 w-4" /></Link>}
            {!c && <Link to={isUser ? `/u/${user!.id}/settings` : '/profile'} className="btn-ghost h-8 w-8 p-0" title="Settings" aria-label="Settings"><Settings className="h-4 w-4" /></Link>}
            <button onClick={async () => { await logout(); nav('/login'); }} className="btn-ghost h-8 w-8 p-0 text-danger" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DirectoryContext.Provider value={{ users, loading: dir.loading, reload: () => dir.reload(true) }}>
      <LiveBackground />
      <div className="bg-blobs min-h-screen lg:flex">
        {/* desktop sidebar */}
        <aside className={`sticky top-0 z-30 hidden h-screen shrink-0 border-r border-border/60 bg-surface/60 backdrop-blur-2xl transition-[width] duration-300 lg:block ${collapsed ? 'w-[84px]' : 'w-72'}`}>
          {sidebar(false)}
        </aside>

        {/* mobile top bar + drawer */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/60 bg-bg/70 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button className="btn-ghost h-10 w-10 p-0" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <Link to="/"><AscendraLogo size={32} /></Link>
          <div className="ml-auto"><ModeToggle /></div>
        </header>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-up_.2s_ease-out]" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-[86vw] max-w-xs animate-[slide-in_.3s_cubic-bezier(.2,.8,.2,1)] border-r border-border/60 bg-surface shadow-2xl">
              {sidebar(true)}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="mx-auto max-w-7xl"><Outlet /></div>
        </main>
      </div>
    </DirectoryContext.Provider>
  );
}
