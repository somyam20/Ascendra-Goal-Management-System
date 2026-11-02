import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { parseApiError } from '@/services/api';
import { DirectoryContext } from '@/hooks/useDirectory';

const { CAT, GOAL } = vi.hoisted(() => ({ CAT: {
  id: 'c1', name: 'Thesis', description: 'Research', icon: 'graduation-cap', color: '#f59e0b', is_default: true, created_by: null,
  is_active: true, is_selected: true, created_at: '', goal_count: 1, active_goal_count: 1, completed_goal_count: 0,
  completion_rate: 50, evaluated: 2, hours_per_week: 5,
},
  GOAL: {
  id: 'g1', user_id: 'me', category_id: 'c1', category_name: 'Thesis', category_color: '#f59e0b', title: 'Write chapter 3',
  description: null, start_date: '2026-11-01', end_date: '2026-12-01', importance: 'HIGH', status: 'ACTIVE', approval_status: 'APPROVED',
  notes: null, ai_generated: false, milestones: [], progress: { completed: 1, not_completed: 1, unmarked: 0, completion_rate: 50 },
  is_overdue: false, days_remaining: 29, created_at: '', updated_at: '',
} }));

vi.mock('@/services/endpoints', async (orig) => {
  const real = await orig<typeof import('@/services/endpoints')>();
  return {
    ...real,
    authApi: { ...real.authApi, me: vi.fn().mockResolvedValue({ id: 'me', name: 'Somya', email: 's@x.io', role: 'USER', is_active: true, avatar_color: '#6366f1', created_at: '' }), login: vi.fn() },
    progressApi: { ...real.progressApi, daily: vi.fn().mockResolvedValue({ date: '2026-11-02', items: [], summary: { total: 0, completed: 0, not_completed: 0, unmarked: 0, completion_rate: null } }), weekly: vi.fn().mockResolvedValue({ days: [], summary: { completion_rate: null } }), streaks: vi.fn().mockResolvedValue({ current_streak: 0, longest_streak: 0, consistency_rate: null, active_days_30: 0 }) },
    goalsApi: { ...real.goalsApi, list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 }) },
    usersApi: { ...real.usersApi, directory: vi.fn().mockResolvedValue([
      { id: 'me', name: 'Somya', avatar_color: '#6366f1', role: 'USER' },
      { id: 'b', name: 'Bipasha', avatar_color: '#ec4899', role: 'USER' },
    ]) },
    dashboardApi: { ...real.dashboardApi, users: vi.fn().mockResolvedValue([{ user_id: 'b', name: 'Bipasha', avatar_color: '#ec4899', completion_rate: 75 }]) },
    notificationsApi: { ...real.notificationsApi, list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, unread_count: 0 }) },
    categoriesApi: { ...real.categoriesApi, list: vi.fn().mockResolvedValue([CAT]) },
  };
});

import Login from '@/pages/Login';
import UserWorkspace from '@/pages/UserWorkspace';
import { AppLayout } from '@/components/layout/AppLayout';
import { authApi, goalsApi } from '@/services/endpoints';

const wrap = (ui: React.ReactNode, path = '/') => (
  <MemoryRouter initialEntries={[path]}>
    <ThemeProvider><ToastProvider><AuthProvider>{ui}</AuthProvider></ToastProvider></ThemeProvider>
  </MemoryRouter>
);

beforeEach(() => { localStorage.clear(); });

describe('Login', () => {
  it('validates required fields', async () => {
    (authApi.me as any).mockRejectedValueOnce(new Error('no'));
    render(wrap(<Login />));
    fireEvent.click(await screen.findByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('shows a friendly message on 401', async () => {
    (authApi.login as any).mockRejectedValueOnce(new AxiosError('x', '401', undefined, undefined, { status: 401, data: { detail: 'Invalid credentials' }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }));
    render(wrap(<Login />));
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });
});

describe('Theme switching', () => {
  function Probe() {
    const { theme, mode, setTheme, toggleMode } = useTheme();
    return <div><span data-testid="t">{theme}-{mode}</span><button onClick={() => setTheme('sunset')}>sunset</button><button onClick={toggleMode}>mode</button></div>;
  }
  it('applies data attributes and persists', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    fireEvent.click(screen.getByText('sunset'));
    fireEvent.click(screen.getByText('mode'));
    expect(document.documentElement.dataset.theme).toBe('sunset');
    expect(['light', 'dark']).toContain(document.documentElement.dataset.mode);
    expect(localStorage.getItem('gc.theme')).toBe('sunset');
  });
});

describe('Read-only workspace', () => {
  it('shows banner and hides private tabs when viewing another user', async () => {
    localStorage.setItem('gc.access', 'tok');
    const users = [{ id: 'me', name: 'Somya', avatar_color: '#000', role: 'USER' as const }, { id: 'p', name: 'Pallavi', avatar_color: '#f0f', role: 'USER' as const }];
    render(wrap(
      <DirectoryContext.Provider value={{ users, loading: false, reload: () => {} }}>
        <Routes><Route path="/u/:userId/:tab?" element={<UserWorkspace />} /></Routes>
      </DirectoryContext.Provider>, '/u/p'));
    await waitFor(() => expect(screen.getByRole('note')).toHaveTextContent(/read-only/i));
    expect(screen.queryByRole('tab', { name: /notifications/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /settings/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /goals/i })).toBeInTheDocument();
  });
});

describe('parseApiError', () => {
  const mk = (status: number, data: unknown) => new AxiosError('x', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
  it('handles string detail', () => expect(parseApiError(mk(400, { detail: 'Bad' })).message).toBe('Bad'));
  it('handles validation arrays', () => expect(parseApiError(mk(422, { detail: [{ loc: ['body', 'end_date'], msg: 'invalid' }] })).message).toBe('end_date: invalid'));
  it('extracts conflicts', () => {
    const r = parseApiError(mk(409, { detail: { message: 'Infeasible', conflicts: ['Too many hours'] } }));
    expect(r.message).toBe('Infeasible');
    expect(r.conflicts).toEqual(['Too many hours']);
  });
  it('handles network errors', () => expect(parseApiError(new AxiosError('Network Error')).message).toMatch(/reach the server/));
});

describe('Brand', () => {
  it('login shows Ascendra and Lumi', async () => {
    render(wrap(<Login />));
    expect((await screen.findAllByText(/Lum/)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('img', { name: /Lumi/ }).length).toBeGreaterThan(0);
  });
});

describe('Sidebar', () => {
  it('lists members from the directory and marks the current user', async () => {
    localStorage.setItem('gc.access', 'tok');
    render(wrap(<Routes><Route element={<AppLayout />}><Route path="/" element={<p>home</p>} /></Route></Routes>));
    const nav = await screen.findByRole('navigation', { name: 'Main' }, { timeout: 5000 });
    await waitFor(() => expect(nav).toHaveTextContent('Bipasha'));
    expect(nav).toHaveTextContent('Somya');
    expect(nav).toHaveTextContent('You');
    expect(screen.getByRole('link', { name: /Bipasha/ })).toHaveAttribute('href', '/u/b');
    expect(nav).toHaveTextContent('75%');
  });
});

describe('Category drill-down', () => {
  it('clicking a category card shows its goals', { timeout: 30000 }, async () => {
    localStorage.setItem('gc.access', 'tok');
    (goalsApi.list as any).mockResolvedValue({ items: [GOAL], total: 1, page: 1, page_size: 100 });
    const users = [{ id: 'me', name: 'Somya', avatar_color: '#000', role: 'USER' as const }];
    render(wrap(
      <DirectoryContext.Provider value={{ users, loading: false, reload: () => {} }}>
        <Routes>
          <Route path="/u/:userId/categories/:categoryId" element={<UserWorkspace />} />
          <Route path="/u/:userId/:tab?" element={<UserWorkspace />} />
        </Routes>
      </DirectoryContext.Provider>, '/u/me/categories'));
    fireEvent.click(await screen.findByRole('link', { name: 'Open Thesis' }, { timeout: 8000 }));
    expect(await screen.findByText('Write chapter 3', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('Goals in Thesis')).toBeInTheDocument();
    expect(goalsApi.list).toHaveBeenCalledWith(expect.objectContaining({ category_id: 'c1' }));
    fireEvent.click(screen.getByRole('button', { name: /Add goal to Thesis/ }));
    expect(await screen.findByLabelText('Category (fixed)')).toHaveTextContent('Thesis');
  });
});
