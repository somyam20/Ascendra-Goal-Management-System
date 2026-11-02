import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BarChart3, Copy, KeyRound, Pencil, Plus, Power, ScrollText, Search, Settings2, Shapes, Shield, Users } from 'lucide-react';
import type { AppSettings, Category, User } from '@/types';
import { adminApi, categoriesApi, usersApi } from '@/services/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/contexts/ToastContext';
import { useDirectory } from '@/hooks/useDirectory';
import { useAuth } from '@/contexts/AuthContext';
import { SlidingTabs } from '@/components/layout/SlidingTabs';
import { Avatar, Badge, ConfirmDialog, EmptyState, ErrorState, Field, Modal, SectionHeader, Skeleton } from '@/components/common/ui';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';
import { FALLBACK_COLORS, WEEKDAYS, colorFor, fmtDateTime, titleCase } from '@/utils/format';

export default function AdminPanel() {
  const { tab = 'users' } = useParams();
  const items = [
    { key: 'users', to: '/admin', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { key: 'categories', to: '/admin/categories', label: 'Default categories', icon: <Shapes className="h-4 w-4" /> },
    { key: 'settings', to: '/admin/settings', label: 'Settings', icon: <Settings2 className="h-4 w-4" /> },
    { key: 'audit', to: '/admin/audit', label: 'Audit logs', icon: <ScrollText className="h-4 w-4" /> },
  ];
  return (
    <div className="space-y-5">
      <SectionHeader title="Admin panel" icon={<Shield className="h-5 w-5" />} subtitle="Manage members, defaults and settings. User-owned goals and timetables stay private to their owners."
        actions={<Link to="/" className="btn-outline"><BarChart3 className="h-4 w-4" />Group performance</Link>} />
      <div className="card px-2 sm:px-4"><SlidingTabs items={items} active={tab} variant="sub" /></div>
      <div key={tab} className="animate-fade-up">
        {tab === 'users' && <UsersAdmin />}
        {tab === 'categories' && <CategoriesAdmin />}
        {tab === 'settings' && <SettingsAdmin />}
        {tab === 'audit' && <AuditAdmin />}
      </div>
    </div>
  );
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(['USER', 'ADMIN']),
});
const editSchema = createSchema.omit({ password: true }).extend({ avatar_color: z.string() });

function UsersAdmin() {
  const toast = useToast();
  const { user: me } = useAuth();
  const dir = useDirectory();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const list = useAsync(() => usersApi.list({ search, page, page_size: 20 }), [search, page]);
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [token, setToken] = useState<{ user: User; token: string; expires: string } | null>(null);
  const [toggle, setToggle] = useState<User | null>(null);

  const refresh = () => { list.reload(true); dir.reload(); };
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1;

  return (
    <div className="card card-pad space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input className="input pl-9" placeholder="Search name or email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn-primary" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Add user</button>
      </div>
      {list.loading ? <Skeleton className="h-48" /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data?.items.length ? <EmptyState title="No users found" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-subtle"><th className="pb-2">User</th><th className="pb-2">Role</th><th className="pb-2">Status</th><th className="pb-2">Joined</th><th className="pb-2 text-right">Actions</th></tr></thead>
            <tbody>
              {list.data.items.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="py-3"><div className="flex items-center gap-3"><Avatar name={u.name} color={u.avatar_color} size={34} /><div><p className="font-semibold">{u.name}</p><p className="text-xs text-subtle">{u.email}</p></div></div></td>
                  <td><Badge className={u.role === 'ADMIN' ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary'}>{u.role}</Badge></td>
                  <td><Badge className={u.is_active ? 'bg-success/15 text-success' : 'bg-danger/10 text-danger'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="text-xs text-subtle">{fmtDateTime(u.created_at)}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-1">
                      <button className="btn-ghost btn-sm h-8 w-8 p-0" onClick={() => setEdit(u)} title="Edit" aria-label={`Edit ${u.name}`}><Pencil className="h-4 w-4" /></button>
                      <button className="btn-ghost btn-sm h-8 w-8 p-0" title="Generate reset code" aria-label={`Reset password for ${u.name}`}
                        onClick={async () => { try { const r = await usersApi.resetToken(u.id); setToken({ user: u, token: r.reset_token, expires: r.expires_at }); } catch (e) { toast.apiError(e); } }}><KeyRound className="h-4 w-4" /></button>
                      <button className={`btn-ghost btn-sm h-8 w-8 p-0 ${u.is_active ? 'text-danger' : 'text-success'}`} disabled={u.id === me?.id} title={u.is_active ? 'Deactivate' : 'Activate'} aria-label={`${u.is_active ? 'Deactivate' : 'Activate'} ${u.name}`} onClick={() => setToggle(u)}><Power className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button><span className="text-subtle">{page}/{pages}</span>
          <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <CreateUserModal open={create} onClose={() => setCreate(false)} onSaved={refresh} />
      <EditUserModal user={edit} onClose={() => setEdit(null)} onSaved={refresh} />
      <ConfirmDialog open={!!toggle} danger={toggle?.is_active} title={toggle?.is_active ? 'Deactivate user?' : 'Activate user?'} confirmLabel={toggle?.is_active ? 'Deactivate' : 'Activate'}
        message={toggle?.is_active ? `${toggle?.name} won't be able to sign in. Their data and history are preserved.` : `${toggle?.name} will be able to sign in again.`}
        onClose={() => setToggle(null)} onConfirm={async () => { const u = toggle!; setToggle(null); try { await usersApi.setStatus(u.id, !u.is_active); toast.success('Status updated'); refresh(); } catch (e) { toast.apiError(e); } }} />
      <Modal open={!!token} onClose={() => setToken(null)} title="One-time reset code" footer={<button className="btn-primary" onClick={() => setToken(null)}>Done</button>}>
        {token && (
          <div className="space-y-3 text-sm">
            <p>Share this code privately with <b>{token.user.name}</b>. It works once and expires {fmtDateTime(token.expires)}.</p>
            <div className="flex items-center gap-2 rounded-xl bg-muted p-3 font-mono text-xs break-all">
              <span className="flex-1">{token.token}</span>
              <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(token.token).then(() => toast.success('Copied')).catch(() => {}); }} aria-label="Copy"><Copy className="h-4 w-4" /></button>
            </div>
            <p className="text-subtle">They can use it at <code>/reset-password</code>.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CreateUserModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema), defaultValues: { role: 'USER' } });
  useEffect(() => { if (open) reset({ name: '', email: '', password: '', role: 'USER' }); }, [open, reset]);
  const submit = async (v: z.infer<typeof createSchema>) => {
    try { await usersApi.create(v); toast.success('User created', `${v.name} now has a workspace tab.`); onSaved(); onClose(); } catch (e) { toast.apiError(e, 'Could not create user'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add user" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting} onClick={handleSubmit(submit)}>Create</button></>}>
      <form className="space-y-3" onSubmit={handleSubmit(submit)}>
        <Field label="Name" error={errors.name?.message}><input className="input" {...register('name')} /></Field>
        <Field label="Email" error={errors.email?.message}><input className="input" type="email" {...register('email')} /></Field>
        <Field label="Initial password" error={errors.password?.message}><input className="input" type="password" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Role"><select className="input" {...register('role')}><option value="USER">User</option><option value="ADMIN">Admin</option></select></Field>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) });
  useEffect(() => { if (user) reset({ name: user.name, email: user.email, role: user.role, avatar_color: user.avatar_color }); }, [user, reset]);
  const submit = async (v: z.infer<typeof editSchema>) => {
    try { await usersApi.update(user!.id, v); toast.success('User updated'); onSaved(); onClose(); } catch (e) { toast.apiError(e); }
  };
  const color = watch('avatar_color');
  return (
    <Modal open={!!user} onClose={onClose} title="Edit user" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting} onClick={handleSubmit(submit)}>Save</button></>}>
      <form className="space-y-3" onSubmit={handleSubmit(submit)}>
        <Field label="Name" error={errors.name?.message}><input className="input" {...register('name')} /></Field>
        <Field label="Email" error={errors.email?.message}><input className="input" type="email" {...register('email')} /></Field>
        <Field label="Role"><select className="input" {...register('role')}><option value="USER">User</option><option value="ADMIN">Admin</option></select></Field>
        <div><span className="label">Avatar color</span>
          <div className="flex flex-wrap gap-2">{FALLBACK_COLORS.map((c) => <button type="button" key={c} onClick={() => setValue('avatar_color', c)} aria-label={c} className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : ''}`} style={{ background: c }} />)}</div>
        </div>
      </form>
    </Modal>
  );
}

function CategoriesAdmin() {
  const toast = useToast();
  const list = useAsync(() => categoriesApi.list({ include_inactive: true }), []);
  const [form, setForm] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null });
  const defaults = (list.data ?? []).filter((c) => c.is_default);
  return (
    <div className="card card-pad space-y-4">
      <div className="flex items-center justify-between"><p className="text-sm text-subtle">Default categories are available to every user.</p>
        <button className="btn-primary" onClick={() => setForm({ open: true, editing: null })}><Plus className="h-4 w-4" />Add default</button></div>
      {list.loading ? <Skeleton className="h-40" /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {defaults.map((c, i) => (
            <li key={c.id} className={`flex items-center gap-3 rounded-2xl border border-border/60 p-3 ${!c.is_active ? 'opacity-50' : ''}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: colorFor(c.color, i) }}><CategoryIcon name={c.icon} /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.name}</p><p className="text-xs text-subtle">{c.is_active ? 'Active' : 'Inactive'}</p></div>
              <button className="btn-ghost btn-sm h-8 w-8 p-0" onClick={() => setForm({ open: true, editing: c })} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
              {c.is_active && <button className="btn-ghost btn-sm h-8 w-8 p-0 text-danger" aria-label={`Deactivate ${c.name}`} onClick={async () => { try { await categoriesApi.deactivate(c.id); toast.success('Deactivated'); list.reload(true); } catch (e) { toast.apiError(e); } }}><Power className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
      )}
      <CategoryFormModal open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} onSaved={() => list.reload(true)} />
    </div>
  );
}

function SettingsAdmin() {
  const toast = useToast();
  const s = useAsync(() => adminApi.settings(), []);
  const [v, setV] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (s.data) setV(s.data); }, [s.data]);
  if (s.loading) return <Skeleton className="h-48" />;
  if (s.error || !v) return <ErrorState message={s.error ?? 'No settings'} onRetry={s.reload} />;
  return (
    <div className="card card-pad max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Leaderboard min evaluated tasks" hint="Users below this are listed but not ranked"><input type="number" min={0} className="input" value={v.leaderboard_min_evaluated} onChange={(e) => setV({ ...v, leaderboard_min_evaluated: Number(e.target.value) })} /></Field>
        <Field label="AI features"><select className="input" value={v.ai_enabled ? '1' : '0'} onChange={(e) => setV({ ...v, ai_enabled: e.target.value === '1' })}><option value="1">Enabled</option><option value="0">Disabled</option></select></Field>
        <Field label="Public sign-up" hint="Let new people create their own account"><select className="input" value={v.signup_enabled ? "1" : "0"} onChange={(e) => setV({ ...v, signup_enabled: e.target.value === "1" })}><option value="1">Open</option><option value="0">Closed (admin adds users)</option></select></Field>
        <Field label="Morning reminder hour (local)"><input type="number" min={0} max={23} className="input" value={v.morning_hour} onChange={(e) => setV({ ...v, morning_hour: Number(e.target.value) })} /></Field>
        <Field label="Evening summary hour (local)"><input type="number" min={0} max={23} className="input" value={v.evening_hour} onChange={(e) => setV({ ...v, evening_hour: Number(e.target.value) })} /></Field>
        <Field label="Weekly review day"><select className="input" value={v.weekly_review_day} onChange={(e) => setV({ ...v, weekly_review_day: Number(e.target.value) })}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
      </div>
      <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { setV(await adminApi.saveSettings(v)); toast.success('Settings saved'); } catch (e) { toast.apiError(e); } finally { setBusy(false); } }}>Save settings</button>
    </div>
  );
}

function AuditAdmin() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const list = useAsync(() => adminApi.audit({ entity_type: entity, page }), [entity, page]);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1;
  const short = (x: unknown) => (x === null || x === undefined ? '' : typeof x === 'object' ? JSON.stringify(x).slice(0, 140) : String(x));
  return (
    <div className="card card-pad space-y-3">
      <select className="input w-auto" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Entity type">
        <option value="">All entities</option>{['user', 'goal', 'category', 'timetable', 'progress', 'preferences', 'settings'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}
      </select>
      {list.loading ? <Skeleton className="h-48" /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data?.items.length ? <EmptyState title="No audit entries" /> : (
        <ul className="divide-y divide-border/60">
          {list.data.items.map((a) => (
            <li key={a.id} className="py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-muted text-subtle">{a.entity_type}</Badge><b>{titleCase(a.action)}</b>
                <span className="text-subtle">by {a.user_name ?? 'system'}</span>
                <span className="ml-auto text-xs text-subtle">{fmtDateTime(a.created_at)}</span>
              </div>
              {!!a.new_value && <p className="mt-1 break-all font-mono text-[11px] text-subtle">{short(a.new_value)}</p>}
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && <div className="flex items-center justify-center gap-2 text-sm"><button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button><span className="text-subtle">{page}/{pages}</span><button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}
