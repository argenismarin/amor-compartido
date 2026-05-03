# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Amor Compartido** — A couple's shared task management PWA for Jenifer and Argenis. Beyond plain tasks: projects, subtasks, recurring tasks, gamification (streaks + achievements), special-date celebrations (anniversary, birthdays, mesiversario), push notifications, offline indicator, dark mode, deep links, activity log, export/import backup, and rate-limited APIs with CSRF protection.

## Commands

```bash
npm run dev         # Dev server at http://localhost:3000
npm run build       # Production build
npm run start       # Production server
npm run lint        # ESLint with --max-warnings 0 (CI-strict)
npm run test:e2e    # Playwright E2E suite (smoke, projects, tasks, subtasks, sort, validation, a11y)
npm run test:e2e:ui # Playwright UI mode
```

## Tech Stack

- **Framework**: Next.js 16.x (App Router) with React 19
- **Styling**: Tailwind CSS 4 (PostCSS) + custom CSS variables in globals.css
- **Database**: PostgreSQL via `pg` with connection pooling (`max: 10`)
- **Validation**: zod schemas on all mutating endpoints (`src/lib/validation/schemas.js`)
- **Testing**: Playwright (E2E only, no unit tests yet)
- **Observability**: Sentry (errors + tracing + profiling, no-op without DSN)
- **Push**: web-push (VAPID); subscriptions per user
- **Deployment**: Vercel

## Architecture

### File Structure
```
src/
├── app/
│   ├── api/
│   │   ├── activity/route.js              # GET feed of audit log
│   │   ├── achievements/route.js          # gamification
│   │   ├── categories/route.js            # task categories
│   │   ├── export/route.js                # streaming JSON backup
│   │   ├── health/route.js                # /api/health for monitoring
│   │   ├── history/route.js               # completed-tasks history (clamped)
│   │   ├── import/route.js                # restore from backup JSON
│   │   ├── projects/route.js              # GET/POST
│   │   ├── projects/[id]/route.js         # PUT/DELETE (with optimistic locking)
│   │   ├── special-dates/route.js         # anniversary/birthday
│   │   ├── streaks/route.js               # gamification
│   │   ├── subscribe/route.js             # push subscription mgmt
│   │   ├── subtasks/route.js              # POST (atomic sort_order)
│   │   ├── subtasks/[id]/route.js         # PUT/DELETE
│   │   ├── tasks/route.js                 # GET/POST (rate-limited)
│   │   ├── tasks/[id]/route.js            # PUT (toggle/reaction/edit) / DELETE soft
│   │   ├── tasks/[id]/restore/route.js    # POST undo soft-delete
│   │   └── users/route.js                 # GET/PUT (zod-validated)
│   ├── project/[id]/page.js               # deep link → redirect /?project=N
│   ├── task/[id]/page.js                  # deep link → redirect /?task=N
│   ├── layout.js                          # root layout, PWA metadata
│   ├── page.js                            # main SPA (≈1300 LOC, monolithic)
│   ├── globals.css                        # all styling (3900+ lines, see TOC at top)
│   └── middleware.js                      # CSRF origin check on /api/*
├── components/
│   ├── CelebrationOverlay.jsx             # confetti, hearts, banner
│   ├── DateInputWithShortcuts.jsx         # date picker + Hoy/Mañana/etc
│   ├── InstallPromptBanner.jsx            # PWA install CTA
│   ├── OfflineBadge.jsx                   # navigator.onLine indicator
│   ├── ProjectCard.jsx                    # grid card for a project
│   ├── TaskCard.jsx                       # task with subtasks + reactions
│   ├── TaskCardSkeleton.jsx
│   └── modals/
│       ├── AchievementsModal.jsx
│       ├── ConfirmDialog.jsx
│       ├── HistoryModal.jsx
│       ├── ProjectFormModal.jsx
│       ├── SettingsModal.jsx              # notifications, special dates, theme picker, export/import
│       ├── TaskFormModal.jsx
│       └── Toast.jsx
├── hooks/
│   ├── useAchievements.js
│   ├── useFocusTrap.js                    # accessibility for modals
│   ├── useInstallPrompt.js                # PWA install detection
│   ├── useNotifications.js                # push permission + subscription
│   ├── useOnlineStatus.js                 # navigator.onLine listener
│   ├── usePolling.js                      # 5s polling, visibility-aware
│   ├── useSpecialDates.js                 # tz-safe today comparison
│   ├── useStreak.js
│   ├── useTasks.js                        # ≈600 LOC: tasks + projectTasks + looseTasks state
│   ├── useTheme.js                        # light/dark/auto (localStorage)
│   ├── useToast.js                        # pause/resume timers
│   └── useUsers.js
└── lib/
    ├── activity.js                        # logActivity (fire-and-forget)
    ├── api.js                             # fetchJson with retries + backoff
    ├── constants.js
    ├── dates.js                           # client-side TZ helpers (compensates getBogotaDate bug)
    ├── db.js                              # pool, query, withTransaction, initDatabase
    ├── push.js                            # sendPushToUser
    ├── rateLimit.js                       # in-memory per-IP rate limiter
    ├── timezone.js                        # server-side Bogotá TZ helpers
    └── validation/schemas.js              # zod schemas + validateBody helper
```

### Database Schema

Tables prefixed with `AppChecklist_` (lowercase in PostgreSQL):

- **users**: `id, name, avatar_emoji, created_at`
- **tasks**: `id, title, description, assigned_to/by FK, is_completed, completed_at, due_date, priority, reaction, category_id FK, project_id FK (ON DELETE SET NULL), recurrence, recurrence_days, is_shared, deleted_at (soft delete), timestamps`
- **subtasks**: `id, task_id FK (ON DELETE CASCADE), title, is_completed, sort_order, timestamps`
- **projects**: `id, name, description, emoji, color, due_date, is_archived, total_tasks (denormalized via trigger), completed_tasks (denormalized), timestamps`
- **categories**: `id, name, emoji, color, created_at` (6 defaults seeded)
- **streaks**: `user_id UNIQUE, current_streak, best_streak, last_activity, updated_at`
- **achievements** + **user_achievements**: gamification (19 achievements pre-seeded)
- **special_dates**: `type, date, user_id, label` — UNIQUE(type, user_id) for upsert
- **push_subscriptions**: VAPID endpoint per user
- **app_usage**: tracks first_use for `app_months` achievement
- **activity**: `actor_id, action, target_type, target_id, meta JSONB, created_at` — audit log

`initDatabase()` runs all `CREATE TABLE IF NOT EXISTS` + migrations C4-C6 idempotently. C5 normalizes legacy SMALLINT to BOOLEAN. C4 adds explicit FKs. C6 adds denormalized counters + trigger `trg_tasks_project_counters_iud`.

`ensureDatabase()` is called from each API route, idempotent via `isInitialized` flag. Failure is captured in `getInitError()` and exposed via `/api/health` (503 when degraded).

### Frontend Architecture

Monolithic SPA in `page.js` (≈1300 LOC) with all top-level state. Most logic lives in custom hooks that receive callbacks (`showToast`, `triggerFloatingHearts`, etc.) as deps.

- **User context**: persisted in `localStorage('currentUserId')`, switched via header buttons
- **Tabs**: `myTasks` | `assignedToOther` | `projects`. Projects tab has nested view: list grid → detail per `selectedProject`
- **Modals**: Task form, Project form, Achievements, History, Settings, Confirm
- **Polling**: 5s, visibility-aware (`hidden` tab pauses), only refreshes projects when on that tab
- **Deep links**: `/task/[id]` and `/project/[id]` redirect to `/?task=N` or `/?project=N`; main page detects query param and opens the item

### Theming System

Two layers:
1. **Per-user**: `data-user` attribute on root (`jenifer` = pink, `argenis` = burgundy). Hardcoded for the couple.
2. **Light/dark**: `data-theme` attribute on `<html>` set by `useTheme` hook. Three preferences: `light`, `dark`, `auto`. `auto` (default) follows `prefers-color-scheme`.

Task cards color-coded by assigner via `.from-jenifer` / `.from-argenis` classes.

`globals.css` has a navigable TOC at the top with line numbers — use ctrl+F to jump to sections.

### API Patterns

- **Validation**: every mutating endpoint uses `validateBody(schema, body)` from `schemas.js`, returns 400 with human-readable error
- **Rate limiting**: `enforceRateLimit(request, endpoint, maxPerMin)` from `lib/rateLimit.js` on POST/PUT/DELETE — 20-120 req/min depending on endpoint
- **CSRF**: `src/middleware.js` blocks cross-origin POST/PUT/PATCH/DELETE to `/api/*` (Origin/Referer must match host)
- **Optimistic locking**: tasks and projects accept `expected_updated_at`; if it doesn't match current row, returns 409 with the current state in the body
- **Soft delete**: tasks have `deleted_at`, restored via `/api/tasks/[id]/restore` within undo window; projects use `is_archived` boolean
- **Push notifications**: fire-and-forget (no `await`) so they don't block the response
- **Activity log**: `logActivity({...})` fire-and-forget on every meaningful mutation
- **Sort**: tasks ordered `is_completed ASC, priority DESC, created_at DESC`

GET `/api/tasks` accepts: `userId`, `filter` (`myTasks` | `assignedByOther` | `assignedToOther`), `categoryId`, `projectId` (`'null'` for tasks without project, or numeric ID), `excludeProjectTasks`.

### Timezone Handling

App is hardcoded to **America/Bogota** (UTC-5). Server uses `getBogotaDate()`, `getTodayBogota()`, `getYesterdayBogota()` from `src/lib/timezone.js`. Client uses string slicing on `YYYY-MM-DD` to avoid TZ shifts. There's a known compensatory fix in `src/lib/dates.js` for a `getBogotaDate()` quirk; planned migration to TIMESTAMPTZ + `NOW() AT TIME ZONE` will remove it.

### fetchJson Wrapper

`src/lib/api.js` exports `fetchJson(url, init)` used by all client GETs. Features:
- Throws `Error` with `.status` property on `!res.ok`
- Auto-retries network errors and `408/429/500/502/503/504` up to 2 times with exponential backoff (400ms, 800ms) + jitter
- Pass `{ retries: 0 }` to disable retries on non-idempotent mutations

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=postgresql://user:password@host:5432/database
```

Optional:
```
SENTRY_DSN=https://...                    # server-side error tracking
NEXT_PUBLIC_SENTRY_DSN=https://...        # client-side error tracking + Web Vitals
VAPID_PUBLIC_KEY=...                      # push notifications (run scripts/generate-vapid-keys.mjs)
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

## Path Aliases

`@/*` maps to `./src/*` (configured in `jsconfig.json`).

## Key Conventions

- **Language**: all UI text in Spanish
- **Design**: mobile-first (max-width 500px on mobile, 600px tablet, 680px desktop)
- **Auth**: none — simple user switching from header (2-user app, no need for JWT etc.)
- **Dates**: client formatting uses `'es'` locale; server stores as DATE/TIMESTAMP in Bogotá TZ
- **Commits**: conventional-style `fix(area): description`, `feat(area): ...`, `perf(area): ...`, `chore(...)`. Co-authored by Claude when AI-assisted.
- **Lint**: `--max-warnings 0` enforced. `no-undef` and `react/jsx-no-undef` are errors (catch the kind of incident where `openNewProject` was referenced but undefined).
- **CI**: GitHub Actions runs `npm run build` + `npm run test:e2e` on every push.

## When Adding a New API Endpoint

1. Add zod schema in `src/lib/validation/schemas.js`
2. Use `validateBody(schema, body)` and return 400 on error
3. Wrap multi-statement mutations in `withTransaction` (`src/lib/db.js`)
4. For mutating endpoints: `enforceRateLimit(request, '<METHOD> /api/<path>', N, 60_000)`
5. Call `logActivity({...})` fire-and-forget after the mutation
6. If creating a new resource: add Playwright mock in `tests/e2e/helpers/mockApi.js`
7. If user-facing: add E2E test in `tests/e2e/<area>.spec.js`
