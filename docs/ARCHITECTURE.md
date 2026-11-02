# Architecture

```
React SPA (Vite)  ──HTTPS/JSON──▶  FastAPI /api/v1
                                     │  api/v1/*        routers: validation, auth deps, HTTP shape only
                                     │  services/*      business logic (goals, planning, scheduling, progress,
                                     │                   analytics, notifications)
                                     │  repositories/*  ownership-enforcing data access helpers
                                     │  models/*        SQLAlchemy 2.0 ORM ──▶ PostgreSQL (Alembic migrations)
                                     │  services/ai_client.py ──▶ Gemini REST (JSON mode)
                                     └─ workers/scheduler.py (APScheduler, idempotent notification jobs)
```

## Planning pipeline

```
POST /planning/requests ──▶ PlanningRequest(PENDING)
POST /planning/requests/{id}/generate
  1. active approved goals overlapping the week      (DB)
  2. preferences, fixed activities, budgets            (DB)
  3. free focus minutes per day                        (scheduling_service.availability)
  4. context + user prompt ──▶ Gemini (PLANNER_SYSTEM) (or rule-based fallback)
  5. AIPlanOutput Pydantic validation, goal ownership check
  6. build_schedule(): budgets → priority (importance, deadline) → place sessions in free windows
     respecting sleep, commitments, unavailable/rest days, goal ranges, daily max, breaks
  7. Timetable(DRAFT, version n+1) + TimetableTasks, warnings for anything that did not fit
HITL: validate / PUT draft (APPROVED ⇒ new version) / reschedule / regenerate / approve / reject
```

## ER diagram

```mermaid
erDiagram
    users ||--o{ refresh_tokens : has
    users ||--o{ password_reset_tokens : has
    users ||--|| user_preferences : has
    users ||--o{ user_categories : selects
    categories ||--o{ user_categories : selected_by
    users ||--o{ categories : creates_custom
    users ||--o{ category_budgets : allocates
    categories ||--o{ category_budgets : budgeted
    users ||--o{ goals : owns
    categories ||--o{ goals : groups
    goals ||--o{ goal_milestones : has
    users ||--o{ fixed_activities : has
    users ||--o{ planning_requests : makes
    planning_requests ||--o{ timetables : produces
    users ||--o{ timetables : owns
    timetables ||--o{ timetable_tasks : contains
    goals ||--o{ timetable_tasks : planned_as
    timetables ||--o{ approvals : reviewed_in
    users ||--o{ daily_progress : records
    goals ||--o{ daily_progress : tracked_by
    timetable_tasks ||--o{ daily_progress : evaluated_by
    users ||--o{ notifications : receives
    users ||--o{ audit_logs : acts

    users { uuid id PK; string email UK; string role; bool is_active }
    goals { uuid id PK; uuid user_id FK; uuid category_id FK; date start_date; date end_date; string importance; string status; string approval_status; timestamptz deleted_at }
    timetables { uuid id PK; uuid user_id FK; uuid planning_request_id FK; uuid parent_id FK; date week_start; int version; string status }
    timetable_tasks { uuid id PK; uuid timetable_id FK; uuid goal_id FK; date scheduled_date; time start_time; time end_time }
    daily_progress { uuid id PK; uuid user_id FK; uuid goal_id FK; uuid task_id FK "nullable"; date activity_date; int completion_status "1/0/NULL" }
```

Key constraints: unique `users.email`; `goals.end_date >= start_date`; unique `(user_id, category_id)` on
`user_categories` and `category_budgets`; unique `(user_id, week_start, version)` on `timetables`;
partial unique indexes on `daily_progress` — `(task_id, activity_date)` when `task_id` is set and
`(user_id, goal_id, activity_date)` when it is null — so a task/goal can never be tracked twice per day;
unique `(user_id, dedupe_key)` on `notifications` for idempotent jobs.

A **goal** may have many **timetable tasks** (planned activities); a **daily progress** row is the actual
completion of a task (or of a goal check-in) on one date. The three are separate tables by design.

## Frontend page hierarchy

```
/login
/            Dashboard (group stats, leaderboard, trends, categories, deadlines, achievements)
/u/:userId   UserWorkspace (read-only when not the current user)
   overview · categories · goals · timetable* · progress · notifications* · analytics · settings*
   (* private: hidden when viewing another user)
/admin       AdminPanel (users, categories, settings, audit logs) — admin only
/profile     Profile & password
```

## Module status

| Module | Status |
|---|---|
| Auth (JWT + rotating refresh, argon2, reset tokens) | done |
| Users / admin / audit logs / app settings | done |
| Categories (defaults, custom, select, budgets) | done |
| Goals (CRUD, milestones, history, soft delete, AI decompose + approval) | done |
| Preferences, fixed activities, availability | done |
| Gemini planner + fallback, scheduling engine, versions, HITL | done |
| Daily progress, weekly/history/streaks/analytics | done |
| Dashboard & leaderboard | done |
| Notifications + scheduler | done |

Known limitations: AI rate limiting is per-process memory; progress recorded against an approved
timetable's tasks stays attached to that version when a newer version is approved for the same week.
