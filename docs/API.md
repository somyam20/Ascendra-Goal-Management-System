# API Contract — `/api/v1`

All endpoints except `/auth/login`, `/auth/refresh`, `/auth/reset-password` need
`Authorization: Bearer <access_token>`. Errors use FastAPI's shape `{"detail": "..."}`
(validation errors: `{"detail": [ ... ]}`; scheduling conflicts: `{"detail": {"message": str, "conflicts": [str]}}`).
Dates are `YYYY-MM-DD`, times `HH:MM`, timestamps ISO-8601, IDs UUID strings.
Weekdays are integers `0=Monday … 6=Sunday`.

Paginated lists return `{items, total, page, page_size}` (query `page`, `page_size`, default 1 / 20, max 100).

### Read-only viewing of other users
Every user can *view* other users' workspaces. GET endpoints marked **[viewable]** accept an
optional `user_id` query parameter; when present and different from the caller, data for that
user is returned read-only. All writes always act on the authenticated user (identity comes from
the token, never from the request). Preferences, fixed activities, budgets, planning prompts,
draft timetables and notifications are private and never viewable.

---

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{email, password}` | `TokenPair` |
| POST | `/auth/refresh` | `{refresh_token}` | `TokenPair` (refresh token rotated) |
| POST | `/auth/logout` | `{refresh_token}` | 204 |
| GET | `/auth/me` | – | `User` |
| POST | `/auth/change-password` | `{current_password, new_password}` | 204 |
| POST | `/auth/reset-password` | `{token, new_password}` | 204 |

`TokenPair = {access_token, refresh_token, token_type: "bearer", user: User}`
`User = {id, name, email, role: "ADMIN"|"USER", is_active, avatar_color, created_at}`

## Users
| Method | Path | Notes |
|---|---|---|
| GET | `/users/directory` | any user → `[{id, name, avatar_color, role}]` of active `USER`-role accounts (drives navigation tabs) |
| GET | `/users?search=` | admin, paginated `User` |
| POST | `/users` | admin, `{name, email, password, role}` → `User` |
| GET | `/users/{id}` | admin |
| PUT | `/users/{id}` | admin, `{name?, email?, role?, avatar_color?}` |
| PATCH | `/users/{id}/status` | admin, `{is_active}` |
| POST | `/users/{id}/reset-token` | admin → `{reset_token, expires_at}` (one-time, 1h) |

## Categories
`Category = {id, name, description, icon, color, is_default, created_by, is_active, is_selected, created_at, goal_count, active_goal_count, completed_goal_count, completion_rate (0-100|null), evaluated, hours_per_week}`

`icon` is a lucide icon name (e.g. `"dumbbell"`), `color` a hex string.

| Method | Path | Notes |
|---|---|---|
| GET | `/categories?include_inactive=false` | **[viewable]** defaults + caller's custom; when viewing another user only their selected categories |
| POST | `/categories` | `{name, description?, icon?, color?}` (admin-created ⇒ default/global) |
| PUT | `/categories/{id}` | own custom only (admin: defaults) |
| DELETE | `/categories/{id}` | deactivates, 204 |
| POST | `/categories/{id}/select` | 204 |
| DELETE | `/categories/{id}/select` | 204 |

## Goals
```
Goal = {id, user_id, category_id, category_name, category_color, title, description,
  start_date, end_date, importance: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW",
  status: "DRAFT"|"ACTIVE"|"COMPLETED"|"PAUSED"|"CANCELLED",
  approval_status: "APPROVED"|"PENDING_REVIEW"|"REJECTED",
  notes, ai_generated, milestones: [Milestone],
  progress: {completed, not_completed, unmarked, completion_rate},
  is_overdue, days_remaining, created_at, updated_at}
Milestone = {id, title, description, due_date, status: "PENDING"|"COMPLETED"}
```
| Method | Path | Notes |
|---|---|---|
| GET | `/goals` | **[viewable]** paginated; filters `category_id, importance, status, start_from, end_to, search, sort` (`-created_at` default, `end_date`, `importance`, `title`) |
| POST | `/goals` | `{title, description?, category_id, start_date, end_date, importance, status?, notes?, milestones?: [{title, description?, due_date?}], ai_generated?}`; `ai_generated=true` ⇒ `approval_status=PENDING_REVIEW`, `status=DRAFT` |
| GET | `/goals/{id}` | **[viewable]** |
| PUT | `/goals/{id}` | same fields as POST; `milestones` replaces the list (items with `id` updated, new ones created, missing removed) |
| PATCH | `/goals/{id}/status` | `{status}` |
| PATCH | `/goals/{id}/milestones/{milestone_id}` | `{status}` |
| DELETE | `/goals/{id}` | soft delete, history preserved, 204 |
| GET | `/goals/{id}/history` | **[viewable]** `[{id, action, old_value, new_value, created_at}]` |
| POST | `/goals/ai-decompose` | `{title, description?, category_id?, start_date?, end_date?, prompt?}` → `{summary, suggested_title, suggested_description, milestones: [{title, description, due_date}], warnings: [str], source: "gemini"|"fallback"}` (nothing saved) |
| POST | `/goals/{id}/approve` | `{approve: bool, milestones?: [...]}` → `Goal` (approve ⇒ APPROVED + ACTIVE; reject ⇒ REJECTED) |

## Preferences & availability (private)
```
Preferences = {timezone, wake_time, sleep_time, sleep_duration_hours, feedback_style: "POSITIVE"|"STRICT"|"BALANCED",
  preferred_working_start, preferred_working_end, max_productive_hours, break_minutes,
  preferred_task_minutes, unavailable_days: [int], rest_days: [int], is_configured}
Activity = {id, title, start_time, end_time, recurrence: "DAILY"|"WEEKLY"|"ONCE", weekdays: [int], start_date, end_date}
```
| Method | Path | Notes |
|---|---|---|
| GET/PUT | `/preferences` | PUT takes any subset of fields |
| PUT | `/preferences/feedback-style` | `{feedback_style}` |
| GET/POST | `/activities` | |
| PUT/DELETE | `/activities/{id}` | |
| GET | `/category-budgets` | `[{category_id, category_name, category_color, hours_per_week}]` for selected categories |
| PUT | `/category-budgets` | `{budgets: [{category_id, hours_per_week}]}` → list |
| GET | `/planning/availability?week_start=` | `{week_start, free_minutes_total, budget_minutes_total, days: [{date, weekday, free_minutes, blocked: bool}], warnings: [str]}` |

## Planning & timetables
```
PlanningRequest = {id, user_prompt, status: "PENDING"|"GENERATED"|"FAILED"|"NEEDS_CLARIFICATION", week_start, error, timetable_id, created_at}
Timetable = {id, user_id, planning_request_id, week_start, week_end, version,
  status: "DRAFT"|"APPROVED"|"REJECTED"|"ARCHIVED", approved_at, created_at,
  planning_summary, warnings: [str], source: "gemini"|"fallback"|"manual", task_count, tasks: [Task]}
Task = {id, timetable_id, goal_id, goal_title, category_id, category_name, category_color, task_type: "AI"|"MANUAL",
  title, description, scheduled_date, start_time, end_time, importance, status: "PLANNED"|"RESCHEDULED"}
TaskInput = {id?, goal_id, title, description?, scheduled_date, start_time, end_time}
```
| Method | Path | Notes |
|---|---|---|
| POST | `/planning/requests` | `{user_prompt, week_start?}` (week_start defaults to next Monday… or this Monday if today is Monday) |
| GET | `/planning/requests/{id}` | |
| POST | `/planning/requests/{id}/generate` | → draft `Timetable`. 409 `{detail:{message, conflicts}}` when infeasible, 400 when no active goals / missing info |
| GET | `/timetables?status=` | **[viewable]** list (tasks omitted, `tasks: []`); others see APPROVED/ARCHIVED only |
| GET | `/timetables/active` | **[viewable]** current approved timetable covering today (or latest approved) or `null` |
| GET | `/timetables/{id}` | **[viewable]** |
| POST | `/timetables/{id}/validate` | `{tasks: [TaskInput]}` → `{valid, conflicts: [str]}` |
| PUT | `/timetables/{id}/draft` | `{tasks: [TaskInput]}`; DRAFT edited in place; APPROVED ⇒ new DRAFT version; 422 with conflicts |
| POST | `/timetables/{id}/regenerate` | `{user_prompt?}` → new DRAFT version |
| POST | `/timetables/{id}/approve` | `{comments?}` → previous approved for same week ⇒ ARCHIVED |
| POST | `/timetables/{id}/reject` | `{comments?}` |
| POST | `/timetables/{id}/tasks/{task_id}/reschedule` | `{scheduled_date, start_time, end_time}` → Timetable (new draft if source approved) |

## Progress
```
DailyItem = {key, kind: "TASK"|"GOAL", goal_id, goal_title, category_id, category_name, category_color,
  task_id, title, description, start_time, end_time, importance, activity_date,
  progress_id, completion_status: 1|0|null, is_past}
Summary = {total, completed, not_completed, unmarked, completion_rate (0-100|null)}
```
| Method | Path | Notes |
|---|---|---|
| GET | `/progress/daily?date=` | **[viewable]** `{date, items: [DailyItem], summary}` — today's approved-timetable tasks plus a check-in item for every active goal |
| POST | `/progress` | `{goal_id, task_id?, activity_date, completion_status: 1|0|null}` upsert → `{id, goal_id, task_id, activity_date, completion_status, updated_at}` |
| PUT | `/progress/{id}` | `{completion_status}` |
| GET | `/progress/weekly?week_start=` | **[viewable]** `{week_start, week_end, days: [{date, ...Summary}], summary, categories: [{category_id, name, color, completed, not_completed, completion_rate}], goals: [{goal_id, title, completed, not_completed, completion_rate}]}` |
| GET | `/progress/history?start=&end=` | **[viewable]** `{days: [{date, ...Summary}]}` |
| GET | `/progress/streaks` | **[viewable]** `{current_streak, longest_streak, consistency_rate, active_days_30}` |
| GET | `/progress/analytics?start=&end=` | **[viewable]** `{summary, categories: [...], daily: [{date, ...Summary}], weekly: [{week_start, completed, not_completed, completion_rate}], goal_status_counts: {STATUS: n}, goals: [{goal_id, title, completed, not_completed, completion_rate}]}` |

Completion rate = completed / (completed + not_completed). Unmarked (NULL) never counts as failure.

## Dashboard (group-level, any authenticated user)
Common query: `period=daily|weekly|monthly|custom`, `start`, `end` (custom).
| Path | Returns |
|---|---|
| `/dashboard/summary` | `{start, end, total_users, total_active_goals, total_completed_goals, total_evaluated_tasks, total_completed_tasks, group_completion_rate, weekly_completion_rate, monthly_completion_rate}` |
| `/dashboard/users` | `[{user_id, name, avatar_color, completed, not_completed, evaluated, completion_rate, active_goals, completed_goals, consistency_rate, categories: [{name, color, completion_rate, evaluated}]}]` |
| `/dashboard/leaderboard?period=weekly|monthly` | `{start, end, min_evaluated, entries: [{rank, user_id, name, avatar_color, completion_rate, evaluated, completed, eligible}]}` (ineligible ⇒ `rank: null`, listed last) |
| `/dashboard/trends?granularity=daily|weekly|monthly&start=&end=` | `{granularity, users: [{user_id, name, avatar_color}], series: [{bucket, label, group_rate, users: {user_id: rate|null}}]}` |
| `/dashboard/categories` | `[{category_name, color, completed, not_completed, completion_rate, active_goals}]` |
| `/dashboard/upcoming-deadlines?days=14` | `[{goal_id, title, user_id, user_name, avatar_color, category_name, category_color, end_date, days_remaining, importance}]` |
| `/dashboard/achievements` | `[{user_name, avatar_color, title, kind: "GOAL_COMPLETED"|"MILESTONE_COMPLETED", completed_at}]` |

## Notifications (private)
`Notification = {id, title, message, notification_type, is_read, created_at}`
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?unread_only=` | paginated + `unread_count` |
| PATCH | `/notifications/{id}/read` | → Notification |
| POST | `/notifications/read-all` | 204 |
| GET | `/notifications/pending-goals` | `{due_today, overdue, approaching, at_risk: [GoalBrief], pending_tasks_today: [DailyItem]}`; `GoalBrief = {id, title, end_date, category_name, category_color, importance, days_remaining, completion_rate}` |
| POST | `/notifications/generate` | `{kind: "DAILY"|"EVENING"|"WEEKLY"}` → `[Notification]` (idempotent per day/week) |

## Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/audit-logs?entity_type=` | paginated `{id, user_id, user_name, entity_type, entity_id, action, old_value, new_value, created_at}` |
| GET/PUT | `/admin/settings` | `{leaderboard_min_evaluated, ai_enabled, morning_hour, evening_hour, weekly_review_day}` |
