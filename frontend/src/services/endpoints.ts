import { api, clean } from './api';
import type {
  Activity, Analytics, AppNotification, AppSettings, AuditLog, Availability, Budget, Category, DailyProgress,
  DashboardCategory, DashboardSummary, DashboardUser, Deadline, DecomposeResult, DirectoryUser, Achievement, Goal,
  GoalInput, GoalStatus, HistoryEntry, Leaderboard, Paginated, PendingGoals, Period, PlanningRequest, Preferences,
  Role, Streaks, TaskInput, Timetable, TokenPair, Trends, User, WeeklyProgress, DaySummary, FeedbackStyle,
  CompletionStatus,
} from '@/types';

const d = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export interface PeriodParams { period?: Period; start?: string; end?: string }

export const authApi = {
  login: (email: string, password: string) => d(api.post<TokenPair>('/auth/login', { email, password })),
  register: (name: string, email: string, password: string) =>
    d(api.post<TokenPair>('/auth/register', { name, email, password })),
  logout: (refresh_token: string) => api.post('/auth/logout', { refresh_token }),
  me: () => d(api.get<User>('/auth/me')),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
  resetPassword: (token: string, new_password: string) => api.post('/auth/reset-password', { token, new_password }),
};

export const usersApi = {
  directory: () => d(api.get<DirectoryUser[]>('/users/directory')),
  list: (params: { search?: string; page?: number; page_size?: number } = {}) =>
    d(api.get<Paginated<User>>('/users', { params: clean(params) })),
  create: (body: { name: string; email: string; password: string; role: Role }) => d(api.post<User>('/users', body)),
  update: (id: string, body: Partial<Pick<User, 'name' | 'email' | 'role' | 'avatar_color'>>) =>
    d(api.put<User>(`/users/${id}`, body)),
  setStatus: (id: string, is_active: boolean) => d(api.patch<User>(`/users/${id}/status`, { is_active })),
  resetToken: (id: string) => d(api.post<{ reset_token: string; expires_at: string }>(`/users/${id}/reset-token`)),
};

export const categoriesApi = {
  list: (params: { user_id?: string; include_inactive?: boolean } = {}) =>
    d(api.get<Category[]>('/categories', { params: clean(params) })),
  create: (body: { name: string; description?: string; icon?: string; color?: string }) =>
    d(api.post<Category>('/categories', body)),
  update: (id: string, body: { name?: string; description?: string; icon?: string; color?: string }) =>
    d(api.put<Category>(`/categories/${id}`, body)),
  deactivate: (id: string) => api.delete(`/categories/${id}`),
  select: (id: string) => api.post(`/categories/${id}/select`),
  unselect: (id: string) => api.delete(`/categories/${id}/select`),
};

export interface GoalFilters {
  user_id?: string; category_id?: string; importance?: string; status?: string;
  start_from?: string; end_to?: string; search?: string; sort?: string; page?: number; page_size?: number;
}

export const goalsApi = {
  list: (f: GoalFilters = {}) => d(api.get<Paginated<Goal>>('/goals', { params: clean({ page_size: 100, ...f }) })),
  get: (id: string, user_id?: string) => d(api.get<Goal>(`/goals/${id}`, { params: clean({ user_id }) })),
  create: (body: GoalInput) => d(api.post<Goal>('/goals', body)),
  update: (id: string, body: GoalInput) => d(api.put<Goal>(`/goals/${id}`, body)),
  setStatus: (id: string, status: GoalStatus) => d(api.patch<Goal>(`/goals/${id}/status`, { status })),
  setMilestone: (id: string, mid: string, status: 'PENDING' | 'COMPLETED') =>
    d(api.patch(`/goals/${id}/milestones/${mid}`, { status })),
  remove: (id: string) => api.delete(`/goals/${id}`),
  history: (id: string, user_id?: string) =>
    d(api.get<HistoryEntry[]>(`/goals/${id}/history`, { params: clean({ user_id }) })),
  decompose: (body: { title: string; description?: string; category_id?: string; start_date?: string; end_date?: string; prompt?: string }) =>
    d(api.post<DecomposeResult>('/goals/ai-decompose', body)),
  approve: (id: string, approve: boolean, milestones?: GoalInput['milestones']) =>
    d(api.post<Goal>(`/goals/${id}/approve`, { approve, milestones })),
};

export const prefsApi = {
  get: () => d(api.get<Preferences>('/preferences')),
  update: (body: Partial<Preferences>) => d(api.put<Preferences>('/preferences', body)),
  feedback: (feedback_style: FeedbackStyle) => d(api.put<Preferences>('/preferences/feedback-style', { feedback_style })),
  activities: () => d(api.get<Activity[]>('/activities')),
  createActivity: (b: Omit<Activity, 'id'>) => d(api.post<Activity>('/activities', b)),
  updateActivity: (id: string, b: Omit<Activity, 'id'>) => d(api.put<Activity>(`/activities/${id}`, b)),
  deleteActivity: (id: string) => api.delete(`/activities/${id}`),
  budgets: () => d(api.get<Budget[]>('/category-budgets')),
  saveBudgets: (budgets: { category_id: string; hours_per_week: number }[]) =>
    d(api.put<Budget[]>('/category-budgets', { budgets })),
  availability: (week_start?: string) =>
    d(api.get<Availability>('/planning/availability', { params: clean({ week_start }) })),
};

export const planningApi = {
  createRequest: (user_prompt: string, week_start?: string) =>
    d(api.post<PlanningRequest>('/planning/requests', clean({ user_prompt, week_start }))),
  getRequest: (id: string) => d(api.get<PlanningRequest>(`/planning/requests/${id}`)),
  generate: (id: string) => d(api.post<Timetable>(`/planning/requests/${id}/generate`)),
};

export const timetablesApi = {
  list: (params: { user_id?: string; status?: string } = {}) =>
    d(api.get<Timetable[]>('/timetables', { params: clean(params) })),
  active: (user_id?: string) => d(api.get<Timetable | null>('/timetables/active', { params: clean({ user_id }) })),
  get: (id: string, user_id?: string) => d(api.get<Timetable>(`/timetables/${id}`, { params: clean({ user_id }) })),
  validate: (id: string, tasks: TaskInput[]) =>
    d(api.post<{ valid: boolean; conflicts: string[] }>(`/timetables/${id}/validate`, { tasks })),
  saveDraft: (id: string, tasks: TaskInput[]) => d(api.put<Timetable>(`/timetables/${id}/draft`, { tasks })),
  regenerate: (id: string, user_prompt?: string) =>
    d(api.post<Timetable>(`/timetables/${id}/regenerate`, clean({ user_prompt }))),
  approve: (id: string, comments?: string) => d(api.post<Timetable>(`/timetables/${id}/approve`, clean({ comments }))),
  reject: (id: string, comments?: string) => d(api.post<Timetable>(`/timetables/${id}/reject`, clean({ comments }))),
  reschedule: (id: string, taskId: string, b: { scheduled_date: string; start_time: string; end_time: string }) =>
    d(api.post<Timetable>(`/timetables/${id}/tasks/${taskId}/reschedule`, b)),
};

export const progressApi = {
  daily: (date?: string, user_id?: string) =>
    d(api.get<DailyProgress>('/progress/daily', { params: clean({ date, user_id }) })),
  mark: (b: { goal_id: string; task_id?: string | null; activity_date: string; completion_status: CompletionStatus }) =>
    d(api.post('/progress', b)),
  update: (id: string, completion_status: CompletionStatus) => d(api.put(`/progress/${id}`, { completion_status })),
  weekly: (week_start?: string, user_id?: string) =>
    d(api.get<WeeklyProgress>('/progress/weekly', { params: clean({ week_start, user_id }) })),
  history: (start: string, end: string, user_id?: string) =>
    d(api.get<{ days: DaySummary[] }>('/progress/history', { params: clean({ start, end, user_id }) })),
  streaks: (user_id?: string) => d(api.get<Streaks>('/progress/streaks', { params: clean({ user_id }) })),
  analytics: (p: { start?: string; end?: string; user_id?: string }) =>
    d(api.get<Analytics>('/progress/analytics', { params: clean(p) })),
};

export const dashboardApi = {
  summary: (p: PeriodParams) => d(api.get<DashboardSummary>('/dashboard/summary', { params: clean({ ...p }) })),
  users: (p: PeriodParams) => d(api.get<DashboardUser[]>('/dashboard/users', { params: clean({ ...p }) })),
  leaderboard: (period: 'weekly' | 'monthly') =>
    d(api.get<Leaderboard>('/dashboard/leaderboard', { params: { period } })),
  trends: (p: { granularity: 'daily' | 'weekly' | 'monthly'; start?: string; end?: string }) =>
    d(api.get<Trends>('/dashboard/trends', { params: clean({ ...p }) })),
  categories: (p: PeriodParams) => d(api.get<DashboardCategory[]>('/dashboard/categories', { params: clean({ ...p }) })),
  deadlines: (days = 14) => d(api.get<Deadline[]>('/dashboard/upcoming-deadlines', { params: { days } })),
  achievements: () => d(api.get<Achievement[]>('/dashboard/achievements')),
};

export const notificationsApi = {
  list: (p: { unread_only?: boolean; page?: number } = {}) =>
    d(api.get<Paginated<AppNotification> & { unread_count: number }>('/notifications', { params: clean({ ...p }) })),
  read: (id: string) => d(api.patch<AppNotification>(`/notifications/${id}/read`)),
  readAll: () => api.post('/notifications/read-all'),
  pending: () => d(api.get<PendingGoals>('/notifications/pending-goals')),
  generate: (kind: 'DAILY' | 'EVENING' | 'WEEKLY') => d(api.post<AppNotification[]>('/notifications/generate', { kind })),
};

export const adminApi = {
  audit: (p: { entity_type?: string; page?: number } = {}) =>
    d(api.get<Paginated<AuditLog>>('/admin/audit-logs', { params: clean({ ...p }) })),
  settings: () => d(api.get<AppSettings>('/admin/settings')),
  saveSettings: (b: Partial<AppSettings>) => d(api.put<AppSettings>('/admin/settings', b)),
};
