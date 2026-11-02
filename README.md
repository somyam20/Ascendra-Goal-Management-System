# Goal Management Platform

AI-powered personal goal management, timetable generation and performance analytics for a small group
(initially Bipasha, Pallavi and Somya) with unlimited users added from the admin panel.

- **backend/** — FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · JWT (argon2) · Gemini · APScheduler
- **frontend/** — React 18 · TypeScript · Vite · Tailwind · Recharts · React Router · React Hook Form + Zod
- **docs/** — [API contract](docs/API.md), [architecture & ER diagram](docs/ARCHITECTURE.md)

Deployment is intentionally out of scope; both apps run locally with the commands below.

---

## 1. Prerequisites

- Python 3.11+
- Node.js 20+ (tested with Node 24)
- PostgreSQL 14+ running locally (create a database, e.g. `goals`)

```sql
CREATE USER goals WITH PASSWORD 'goals';
CREATE DATABASE goals OWNER goals;
```

## 2. Backend

```bash
cd backend
python -m venv .venv
```

Activate it (`.venv\Scripts\activate` on Windows, `source .venv/bin/activate` elsewhere), then:

```bash
pip install -r requirements.txt
```

```bash
cp .env.example .env
```

Edit `.env` — at minimum `DATABASE_URL`, `JWT_SECRET` and (optionally) `GEMINI_API_KEY`.

```bash
alembic upgrade head
```

```bash
python -m app.seed --demo-users
```

`app.seed` creates the four default categories and the initial admin (from `ADMIN_EMAIL` /
`ADMIN_PASSWORD`). `--demo-users` additionally creates `bipasha@goals.local`, `pallavi@goals.local` and
`somya@goals.local` with password `Welcome@123` (override with `--password`). You can skip the flag and
create the users from the Admin panel instead — nothing about these names is hardcoded.

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/api/docs

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy URL (`postgresql+psycopg://user:pass@host:5432/db`) | local postgres |
| `JWT_SECRET` | HMAC secret for access tokens — **set a long random value** | placeholder |
| `ACCESS_TOKEN_MINUTES` / `REFRESH_TOKEN_DAYS` | token lifetimes | 30 / 14 |
| `CORS_ORIGINS` | comma-separated allowed frontend origins | `http://localhost:5173,...` |
| `GEMINI_API_KEY` | Google Gemini key; empty ⇒ rule-based planner fallback | empty |
| `GEMINI_MODEL` | Gemini model id | `gemini-2.5-flash` |
| `AI_RATE_LIMIT_PER_HOUR` | per-user limit on AI endpoints | 20 |
| `ENABLE_SCHEDULER` | run notification jobs inside the API process | `true` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | initial admin (created only if no admin exists) | see `.env.example` |

### Tests

```bash
cd backend
python -m pytest -q
```

Tests run against a temporary SQLite database (the models use portable types; production uses PostgreSQL)
and mock Gemini, so no external services are needed.

## 3. Frontend

```bash
cd frontend
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The API base URL defaults to `http://localhost:8000/api/v1`; override it with
`VITE_API_URL` in `frontend/.env`.

```bash
npm run build
```

```bash
npx vitest run
```

## 4. Using the app

1. Log in as the admin, open **Admin**, create users (or use the seeded demo users).
2. Each user logs in and lands on the shared **Dashboard**; the top tabs list every user (generated from
   the database). Your own tab is fully editable; other users' tabs are **read-only**.
3. In your workspace: pick categories, add goals (optionally with *AI decompose* → review → approve), and
   track them in **Daily Progress** — no timetable required.
4. Optionally, in **Settings** enter sleep schedule, fixed activities and weekly hours per category, then
   **My Timetable → Generate**. Review the draft in the weekly calendar, edit/move/add tasks, then approve
   or reject. Approved versions are immutable; any change creates a new draft version.
5. Pick a feedback style (Positive / Strict / Balanced); daily, evening and weekly notifications are
   generated automatically in each user's timezone, or on demand from the Notifications tab.

## 5. Key design decisions & assumptions

- **Read-only cross-user viewing.** Every authenticated user may view other users' goals, categories,
  approved timetables, progress and analytics via `?user_id=`. Writes always use the identity in the JWT,
  so changing IDs in a request can never modify someone else's data. Preferences, fixed activities,
  budgets, planning prompts, draft timetables and notifications are never exposed.
- **AI split of responsibilities.** Gemini decides *what* to do and *how much* (tasks, session length,
  sessions/week). The deterministic engine (`scheduling_service.py`) decides *when* and validates every
  constraint (sleep, fixed activities, unavailable/rest days, goal date ranges, overlaps, daily max,
  category budgets). Gemini output is validated with Pydantic and every `goal_id` is checked against the
  user's own active goals before anything is saved.
- **Infeasible plans.** If nothing fits, generation returns HTTP 409 with explanations. If only part fits,
  a valid draft is created and every unscheduled session is listed as a warning — never silently dropped.
  Category budgets are respected by trimming sessions, with an explicit warning.
- **Gemini fallback.** Without an API key (or when Gemini fails / returns invalid JSON) a rule-based planner
  and template milestone breakdown are used, clearly labelled `source: "fallback"`, so the HITL workflow
  always works.
- **Completion semantics.** `daily_progress.completion_status` is `1` / `0` / `NULL`. Unmarked never counts
  as failure; completion % = completed / (completed + not completed). Future dates cannot be evaluated.
- **Daily items.** A day shows tasks from the approved timetable for that week plus one check-in per
  active goal, so tracking works with or without a timetable. Records from superseded timetable versions or
  deleted goals stay visible on the days they were tracked.
- **Leaderboard.** Ranked by completion % over the same period for everyone (this week / this month);
  users below the admin-configurable minimum of evaluated tasks are shown but unranked; ties share a rank.
- **Soft deletes.** Goals are soft-deleted; progress history and timetable versions are preserved.
- **Scheduler.** APScheduler runs every 15 minutes inside the API process and generates notifications
  when a user's *local* hour matches the configured morning/evening hour. Dedupe keys make jobs idempotent.
  With multiple API replicas set `ENABLE_SCHEDULER=false` and run `python -m app.workers.scheduler` once.
- **Rate limiting** of AI endpoints is in-memory per process (adequate for a single instance).
