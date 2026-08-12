# kanban-local1

A local-first Kanban board application for task management with drag-and-drop, stage/sub-stage organisation, archiving, task history, and an admin panel. Built as a single-process Express + Vite + React monolith backed by PostgreSQL.

**Current version:** 1.2.1  
**Target version:** 2.0.0 (R2 Refactor — see [Refactor Context](#r2-refactor-context) below)

---

## Quick Start

```bash
# 1. Start Postgres (via Docker or use an existing instance)
docker compose up -d

# 2. Set environment variable
export DATABASE_URL="postgresql://kanban:kanban@localhost:5432/kanban"

# 3. Install dependencies
npm install

# 4. Push schema to database
npm run db:push

# 5. Start dev server (Express + Vite HMR on port 5000)
npm run dev
```

The app serves both API and client on **port 5000** (`http://localhost:5000`).

### Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with Vite HMR |
| `npm run build` | Production build (client → `dist/public/`, server → `dist/index.cjs`) |
| `npm start` | Run production build |
| `npm run check` | TypeScript type-check (`tsc --noEmit`) |
| `npm run db:push` | Push Drizzle schema to database (handy for local dev) |
| `npm run db:migrate` | Apply versioned SQL migrations (`migrations/`) — use for production and CI |
| `npm run db:add-color` | Migration: add color column to stages |
| `npm run db:enhance-tasks` | Migration: add enhanced task fields |
| `npm run db:add-sub-stages` | Migration: add sub_stages table |

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: `5000`) |
| `NODE_ENV` | No | `development` or `production` |
| `GMAIL_INBOUND_WORKER_DISABLED` | No | Set to `true` in production if you are not using the Gmail inbound pipeline (avoids background polling) |
| `GMAIL_INBOUND_TRACE` | No | Set to `true` temporarily to emit stage-by-stage Gmail inbound trace logs in production |
| Gmail / Pub/Sub / OpenAI | No | Plain steps: [GMAIL_SETUP_SIMPLE.md](GMAIL_SETUP_SIMPLE.md); technical detail: [GMAIL_PUBSUB_SETUP.md](GMAIL_PUBSUB_SETUP.md) |

### Production on Railway

The repo includes [`railway.json`](railway.json) (Dockerfile builder, health check on `/api/health`). Provision a **PostgreSQL** plugin in the same Railway project and set **`DATABASE_URL`** from the database service (reference the variable Railway provides). Set **`NODE_ENV=production`**. Railway injects **`PORT`** automatically; the server reads it.

On **deploy**, the production server runs SQL migrations from `migrations/` before starting (using Drizzle’s migrator). You can also run `npm run db:migrate` locally or in CI when `DATABASE_URL` points at your database (uses `drizzle-kit migrate`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js (ESM) via `tsx` |
| **Server** | Express 4 |
| **Client** | React 18 + Vite 7 |
| **Routing (client)** | Wouter |
| **State / data fetching** | TanStack React Query v5 |
| **Drag & drop** | @dnd-kit/core + @dnd-kit/sortable |
| **Forms** | react-hook-form + @hookform/resolvers (Zod) |
| **UI primitives** | shadcn/ui (Radix + Tailwind + CVA) |
| **Animation** | Framer Motion |
| **Styling** | Tailwind CSS 3 + tailwindcss-animate |
| **Database** | PostgreSQL 16 |
| **ORM** | Drizzle ORM + drizzle-zod |
| **Validation** | Zod |
| **Build** | esbuild (server bundle), Vite (client bundle) |

---

## Architecture

Three source directories — `client/src/`, `server/`, and `shared/` — with path aliases `@/*` and `@shared/*`. The shared module owns all types, constants, API contracts, and the structured logger. The client uses `apiRequest<T>` for all API calls and React Query for caching. The server uses centralised error handling (`AppError` + `errorHandler` middleware) and `parseIdParam` for route validation.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system diagram, request lifecycle, module tables, database schema, error handling flow, and directory tree.

---

## API Endpoints

All routes are defined declaratively in `shared/routes.ts` and registered in `server/routes.ts`.

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check (`{ "ok": true }`) — used by Railway and load balancers |

### Tasks
| Method | Path | Description |
|---|---|---|
| GET | `/api/tasks` | List active (non-archived) tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/tasks/archived` | List archived tasks |
| POST | `/api/tasks/:id/archive` | Archive a task |
| POST | `/api/tasks/:id/unarchive` | Unarchive a task |
| GET | `/api/tasks/:id/history` | Get task status history |

### Stages
| Method | Path | Description |
|---|---|---|
| GET | `/api/stages` | List all stages |
| POST | `/api/stages` | Create stage |
| PATCH | `/api/stages/:id` | Update stage |
| DELETE | `/api/stages/:id` | Delete stage |

### Sub-stages
| Method | Path | Description |
|---|---|---|
| GET | `/api/sub-stages` | List all sub-stages |
| GET | `/api/stages/:stageId/sub-stages` | List sub-stages for a stage |
| POST | `/api/sub-stages` | Create sub-stage |
| PATCH | `/api/sub-stages/:id` | Update sub-stage |
| DELETE | `/api/sub-stages/:id` | Delete sub-stage |

### Export
| Method | Path | Description |
|---|---|---|
| GET | `/api/export` | Self-contained JSON bundle: tasks, stages, sub-stages. Accepts `?includeArchived=true` |

Alongside the stored data the bundle carries two derived, read-only views, built in `shared/briefing.ts` for the scheduled briefing agent:

- **`tasks[].urgency`** — `isOverdue`, `daysOverdue`, `dueBucket`, `briefingRank`, `mustSurface`
- **`briefing`** — `overdue` / `dueToday` / `inProgress` / `blocked`, pre-sorted most-urgent-first, with the reference instant, timezone, and overdue rule declared inline

Both are cut against `exportedAt`, and the overdue rule matches the board's own highlight, so export and UI always agree. Stored task fields are unmodified, so the file round-trips through import unchanged.

---

## Client Pages & Components

Four routes: Dashboard (`/`), Admin (`/admin`), Archive (`/archive`), and a 404 fallback. Dashboard and Admin are decomposed into co-located subcomponents (e.g. `DashboardHeader`, `StageSection`). 19 feature components in `components/`, 7 shared hooks in `hooks/`, and 3 API layer modules in `lib/`.

See [COMPONENT_INDEX.md](COMPONENT_INDEX.md) for the full breakdown of every component, hook, utility, shared module, and server module with exports and responsibilities.

### Voice dictation

Every free-text field on the create/edit task forms — title, description, owner — carries a mic button (`DictationButton`). Clicking it starts the browser's Web Speech API (`useSpeechDictation`); on macOS Safari that is Apple's own recogniser, the same engine behind System Settings → Keyboard → Dictation, and the browser prompts for microphone access the first time. The icon becomes an animated sound wave while listening, interim words appear under the field as feedback, and only finalised phrases are written in — spaced and sentence-capitalised by `lib/dictation.ts`.

Browsers without the API (Firefox) still show the button: it focuses the field and points at macOS Dictation (Fn Fn), which types into the focused field directly.

### Share a task as an email

The task view has a **Share** button that copies the task to the clipboard as a ready-to-paste email — subject line, detail block (stage, status, priority, owner, effort, due date, tags, dates) and description. `lib/task-email.ts` builds both a plain-text and an HTML flavour and `lib/clipboard.ts` puts both on the clipboard, so a rich compose window keeps the layout and a plain one still reads well.

This is clipboard-only by design: no mail client is launched, no `mailto:` link is produced, and nothing is sent. The user pastes it wherever they like.

---

## R2 Refactor Context

> **Epic:** `development/01-R2-REFACTOR/CNE (EPICS)/r2-codebase-refactor.json`
>
> R2 is a **structural-only** refactor. No new features, no schema changes, no framework migrations, no visual changes. The goal is to transform the MVP codebase into a clean, typed, tested, pattern-driven foundation for all future work.

### Why R2 exists

The V1 codebase was built incrementally by humans and AI assistants during MVP development. The result works but has significant technical debt:

- **Weak typing** — `any` annotations throughout (`updateData: any`, `catch(err: any)`, `Record<string, any>`)
- **DRY violations** — inline `useQuery` calls duplicated 7+ times for stages/sub-stages; `parseInt(req.params.id)` + `isNaN` pattern repeated 11+ times in routes
- **Oversized components** — Admin.tsx (595 LOC), Dashboard.tsx (473 LOC), KanbanBoard.tsx (394 LOC), EditTaskDialog.tsx (387 LOC)
- **No tests** — zero automated test coverage
- **No linting/formatting** — no ESLint, no Prettier, no pre-commit hooks
- **Debug logging in production** — 15+ `console.log` statements in `storage.ts` alone (e.g. `[DAO] [CREATE_STAGE]`)
- **Broken error handler** — `server/index.ts` line 71 does `throw err` after `res.status(status).json()`, which crashes the process on any error
- **Unused dependencies** — `passport`, `passport-local`, `express-session`, `connect-pg-simple`, `ws` are installed but never imported in application code
- **Replit coupling** — `@replit/vite-plugin-*` packages are loaded unconditionally (only partially gated by `REPL_ID`)
- **No shared fetch layer** — every mutation in `use-tasks.ts` duplicates the same fetch/error-handling/network-check pattern (~15 lines each)

### R2 Phases (7 phases, 28 child issues)

| Phase | Focus | Key deliverables |
|---|---|---|
| **P1** | Tooling & guardrails | ESLint (strict TS), Prettier, Husky + lint-staged, Vitest + coverage |
| **P2** | Type safety & contracts | Remove all `any`, define interfaces for all entities/props/storage/API shapes |
| **P3** | DRY extraction | `useStages` + `useSubStages` hooks, `apiRequest<T>` wrapper, constants module, `parseIdParam` helper |
| **P4** | Component decomposition | Split Admin → 3 modules, Dashboard → 3, KanbanBoard → 3, EditTaskDialog → subcomponents (all ≤200 LOC) |
| **P5** | Error handling & logging | Express error middleware, React ErrorBoundary, structured logger, fix rethrow bug |
| **P6** | Test coverage | Unit/integration/component/API tests, ≥70% line coverage |
| **P7** | Cleanup & docs | Remove unused deps, gate Replit plugins, update docs, tag v2.0.0 |

### Acceptance Criteria (must all pass)

- Zero `any` types (`tsc --strict --noImplicitAny`)
- ESLint zero errors (`npm run lint`)
- Prettier zero violations (`npm run format --check`)
- Vitest ≥70% line coverage (`npm run test`)
- No component file >200 LOC (excluding `components/ui/`)
- All stage/sub-stage fetching via shared hooks (no inline `useQuery`)
- All API calls via `apiRequest<T>` wrapper
- Zero `console.log`/`console.error` outside logger module
- Server errors return `{ error, message, status }` JSON shape
- React ErrorBoundary at app root
- Docs updated, repo tagged v2.0.0

### Known Bugs & Gotchas

| Issue | Location | Status |
|---|---|---|
| Archive DnD bug | `bugs/archive-drag-drop-not-working.json` | Open — tracked bug with drag-to-archive |

Previous V1 issues (rethrow after response, debug logging in prod, `any` types, request logger leaking bodies, seed data in routes, unconditional Replit plugins) have been resolved by R2.

### Agent Guidelines

When working on R2 child issues:

1. **Read the epic first** — `development/01-R2-REFACTOR/CNE (EPICS)/r2-codebase-refactor.json` is the source of truth for scope and acceptance.
2. **Respect phase boundaries** — P1 must land before P2 (linting catches regressions), P2 before P3 (types guide extraction), etc.
3. **Do not add features** — R2 is structural only. If you spot a feature gap, note it for a future epic.
4. **Do not change the database schema** — tables, columns, and migrations are frozen for R2.
5. **Preserve all existing behaviour** — every user-facing flow must work identically after refactoring.
6. **`components/ui/` is off-limits** — these are vendored shadcn/ui primitives; do not refactor or lint-fix them.
7. **Use the shared module** — `shared/schema.ts` owns all types; `shared/routes.ts` owns all API contracts. Import from there, don't redefine.
8. **Test against the IStorage interface** — `server/storage.ts` exports `IStorage`; integration tests should target the contract, not the implementation.
9. **Check LOC after decomposition** — run `wc -l` on any component you refactor; the ceiling is 200 lines.
10. **Run `npm run check` before committing** — type errors must not be introduced.
