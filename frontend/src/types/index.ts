export type Role = 'ADMIN' | 'USER';
export type Importance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type GoalStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
export type ApprovalStatus = 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED';
export type FeedbackStyle = 'POSITIVE' | 'STRICT' | 'BALANCED';
export type TimetableStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type CompletionStatus = 1 | 0 | null;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  avatar_color: string;
  created_at: string;
}

export interface DirectoryUser {
  id: string;
  name: string;
  avatar_color: string;
  role: Role;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  created_by: string | null;
  is_active: boolean;
  is_selected: boolean;
  created_at: string;
  goal_count: number;
  active_goal_count: number;
  completed_goal_count: number;
  completion_rate: number | null;
  evaluated: number;
  hours_per_week: number | null;
}

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'PENDING' | 'COMPLETED';
}

export interface ProgressSummary {
  completed: number;
  not_completed: number;
  unmarked: number;
  completion_rate: number | null;
}

export interface Goal {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  category_color: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  importance: Importance;
  status: GoalStatus;
  approval_status: ApprovalStatus;
  notes: string | null;
  ai_generated: boolean;
  milestones: Milestone[];
  progress: ProgressSummary;
  is_overdue: boolean;
  days_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface MilestoneInput {
  id?: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
}

export interface GoalInput {
  title: string;
  description?: string | null;
  category_id: string;
  start_date: string;
  end_date: string;
  importance: Importance;
  status?: GoalStatus;
  notes?: string | null;
  milestones?: MilestoneInput[];
  ai_generated?: boolean;
}

export interface HistoryEntry {
  id: string;
  action: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

export interface DecomposeResult {
  summary: string;
  suggested_title: string;
  suggested_description: string;
  milestones: { title: string; description: string; due_date: string | null }[];
  warnings: string[];
  source: 'gemini' | 'fallback';
}

export interface Preferences {
  timezone: string;
  wake_time: string;
  sleep_time: string;
  sleep_duration_hours: number | null;
  feedback_style: FeedbackStyle;
  preferred_working_start: string;
  preferred_working_end: string;
  max_productive_hours: number;
  break_minutes: number;
  preferred_task_minutes: number;
  unavailable_days: number[];
  rest_days: number[];
  is_configured: boolean;
}

export interface Activity {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  recurrence: 'DAILY' | 'WEEKLY' | 'ONCE';
  weekdays: number[];
  start_date: string | null;
  end_date: string | null;
}

export interface Budget {
  category_id: string;
  category_name: string;
  category_color: string | null;
  hours_per_week: number;
}

export interface Availability {
  week_start: string;
  free_minutes_total: number;
  budget_minutes_total: number;
  days: { date: string; weekday: number; free_minutes: number; blocked: boolean }[];
  warnings: string[];
}

export interface PlanningRequest {
  id: string;
  user_prompt: string;
  status: 'PENDING' | 'GENERATED' | 'FAILED' | 'NEEDS_CLARIFICATION';
  week_start: string;
  error: string | null;
  timetable_id: string | null;
  created_at: string;
}

export interface TimetableTask {
  id: string;
  timetable_id: string;
  goal_id: string;
  goal_title: string;
  category_id: string;
  category_name: string;
  category_color: string | null;
  task_type: 'AI' | 'MANUAL';
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  importance: Importance;
  status: 'PLANNED' | 'RESCHEDULED';
}

export interface TaskInput {
  id?: string;
  goal_id: string;
  title: string;
  description?: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
}

export interface Timetable {
  id: string;
  user_id: string;
  planning_request_id: string | null;
  week_start: string;
  week_end: string;
  version: number;
  status: TimetableStatus;
  approved_at: string | null;
  created_at: string;
  planning_summary: string | null;
  warnings: string[];
  source: 'gemini' | 'fallback' | 'manual';
  task_count: number;
  tasks: TimetableTask[];
}

export interface DailyItem {
  key: string;
  kind: 'TASK' | 'GOAL';
  goal_id: string;
  goal_title: string;
  category_id: string;
  category_name: string;
  category_color: string | null;
  task_id: string | null;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  importance: Importance;
  activity_date: string;
  progress_id: string | null;
  completion_status: CompletionStatus;
  is_past: boolean;
}

export interface Summary {
  total: number;
  completed: number;
  not_completed: number;
  unmarked: number;
  completion_rate: number | null;
}

export interface DaySummary extends Summary {
  date: string;
}

export interface CategoryProgress {
  category_id: string;
  name: string;
  color: string | null;
  completed: number;
  not_completed: number;
  completion_rate: number | null;
}

export interface GoalProgress {
  goal_id: string;
  title: string;
  completed: number;
  not_completed: number;
  completion_rate: number | null;
}

export interface DailyProgress {
  date: string;
  items: DailyItem[];
  summary: Summary;
}

export interface WeeklyProgress {
  week_start: string;
  week_end: string;
  days: DaySummary[];
  summary: Summary;
  categories: CategoryProgress[];
  goals: GoalProgress[];
}

export interface Streaks {
  current_streak: number;
  longest_streak: number;
  consistency_rate: number | null;
  active_days_30: number;
}

export interface Analytics {
  summary: Summary;
  categories: CategoryProgress[];
  daily: DaySummary[];
  weekly: { week_start: string; completed: number; not_completed: number; completion_rate: number | null }[];
  goal_status_counts: Record<string, number>;
  goals: GoalProgress[];
}

export interface DashboardSummary {
  start: string;
  end: string;
  total_users: number;
  total_active_goals: number;
  total_completed_goals: number;
  total_evaluated_tasks: number;
  total_completed_tasks: number;
  group_completion_rate: number | null;
  weekly_completion_rate: number | null;
  monthly_completion_rate: number | null;
}

export interface DashboardUser {
  user_id: string;
  name: string;
  avatar_color: string;
  completed: number;
  not_completed: number;
  evaluated: number;
  completion_rate: number | null;
  active_goals: number;
  completed_goals: number;
  consistency_rate: number | null;
  categories: { name: string; color: string | null; completion_rate: number | null; evaluated: number }[];
}

export interface LeaderboardEntry {
  rank: number | null;
  user_id: string;
  name: string;
  avatar_color: string;
  completion_rate: number | null;
  evaluated: number;
  completed: number;
  eligible: boolean;
}

export interface Leaderboard {
  start: string;
  end: string;
  min_evaluated: number;
  entries: LeaderboardEntry[];
}

export interface Trends {
  granularity: 'daily' | 'weekly' | 'monthly';
  users: { user_id: string; name: string; avatar_color: string }[];
  series: { bucket: string; label: string; group_rate: number | null; users: Record<string, number | null> }[];
}

export interface DashboardCategory {
  category_name: string;
  color: string | null;
  completed: number;
  not_completed: number;
  completion_rate: number | null;
  active_goals: number;
}

export interface Deadline {
  goal_id: string;
  title: string;
  user_id: string;
  user_name: string;
  avatar_color: string;
  category_name: string;
  category_color: string | null;
  end_date: string;
  days_remaining: number;
  importance: Importance;
}

export interface Achievement {
  user_name: string;
  avatar_color: string;
  title: string;
  kind: 'GOAL_COMPLETED' | 'MILESTONE_COMPLETED';
  completed_at: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface GoalBrief {
  id: string;
  title: string;
  end_date: string;
  category_name: string;
  category_color: string | null;
  importance: Importance;
  days_remaining: number;
  completion_rate: number | null;
}

export interface PendingGoals {
  due_today: GoalBrief[];
  overdue: GoalBrief[];
  approaching: GoalBrief[];
  at_risk: GoalBrief[];
  pending_tasks_today: DailyItem[];
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

export interface AppSettings {
  leaderboard_min_evaluated: number;
  ai_enabled: boolean;
  morning_hour: number;
  evening_hour: number;
  weekly_review_day: number;
}

export type Period = 'daily' | 'weekly' | 'monthly' | 'custom';
