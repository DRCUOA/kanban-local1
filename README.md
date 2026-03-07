# kanban-local1

A local-first Kanban board application for task management with drag-and-drop, stage/sub-stage organisation, archiving, task history, and an admin panel. Built as a single-process Express + Vite + React monolith backed by PostgreSQL.

**Current version:** 1.2.0  
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
| `npm run db:push` | Push Drizzle schema to database |
| `npm run db:add-color` | Migration: add color column to stages |
| `npm run db:enhance-tasks` | Migration: add enhanced task fields |
| `npm run db:add-sub-stages` | Migration: add sub_stages table |

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: `5000`) |
| `NODE_ENV` | No | `development` or `production` |

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

```
┌─────────────────────────────────────────────────────────┐
│  Browser (port 5000)                                    │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │  Dashboard    │  │  Admin      │  │  Archive      │  │
│  │  (KanbanBoard)│  │  (Stages/   │  │  (Archived    │  │
│  │              │  │   SubStages) │  │   Tasks)      │  │
│  └──────┬───────┘  └──────┬──────┘  └──────┬────────┘  │
│         └──────────────────┼───────────────┘            │
│                    React Query                          │
│                    fetch → /api/*                       │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP
┌────────────────────────────┴────────────────────────────┐
│  Express (server/index.ts)                              │
│  ├── JSON body parser                                   │
│  ├── Request logger middleware                          │
│  ├── API routes (server/routes.ts)                      │
│  │   └── Zod validation via shared/routes.ts contracts  │
│  ├── DatabaseStorage (server/storage.ts)                │
│  │   └── IStorage interface                             │
│  └── Vite middleware (dev) or static serve (prod)       │
└────────────────────────────┬────────────────────────────┘
                             │ pg
┌────────────────────────────┴────────────────────────────┐
│  PostgreSQL                                             │
│  Tables: stages, sub_stages, tasks                      │
│  Schema: shared/schema.ts (Drizzle)                     │
└─────────────────────────────────────────────────────────┘
```

### Request lifecycle

1. Client hook (e.g. `useTasks()`) calls `fetch("/api/tasks")`.
2. Express route handler receives the request in `server/routes.ts`.
3. Request body (if any) is validated against Zod schemas defined in `shared/routes.ts`.
4. `DatabaseStorage` method executes the Drizzle query against PostgreSQL.
5. Response is returned as JSON; React Query caches and re-renders.

### Path aliases (tsconfig + Vite)

| Alias | Resolves to |
|---|---|
| `@/*` | `client/src/*` |
| `@shared/*` | `shared/*` |

---

## Database Schema

Three tables defined in `shared/schema.ts`:

### stages
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | Not null |
| order | integer | Display order |
| color | text | Hex color, nullable |
| created_at | timestamp | Default now |

### sub_stages
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| stage_id | integer FK → stages | Cascade delete |
| name | text | |
| tag | text | Unique identifier, e.g. `"day-plan-am"` |
| bg_class | text | Tailwind class |
| opacity | integer | 0–100 |
| order | integer | Display order |
| created_at | timestamp | |

### tasks
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| title | text | Not null |
| description | text | Nullable |
| stage_id | integer FK → stages | |
| archived | boolean | Default false |
| status | text | `backlog` / `in_progress` / `done` / `abandoned` |
| priority | text | `low` / `normal` / `high` / `critical` |
| effort | integer | 1–5, nullable |
| due_date | timestamp | Nullable |
| tags | jsonb | `string[]` |
| parent_task_id | integer FK → tasks | Self-referential (subtasks) |
| recurrence | text | `none` / `daily` / `weekly` / `monthly` |
| history | jsonb | `TaskHistoryEntry[]` (status change log) |
| updated_at | timestamp | |
| created_at | timestamp | |

---

## API Endpoints

All routes are defined declaratively in `shared/routes.ts` and registered in `server/routes.ts`.

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

---

## Client Pages & Components

### Pages (client/src/pages/)
| Page | Route | Description |
|---|---|---|
| `Dashboard` | `/` | Main Kanban board view with drag-and-drop |
| `Admin` | `/admin` | Manage stages, sub-stages, colours |
| `Archive` | `/archive` | View and restore archived tasks |
| `not-found` | fallback | 404 page |

### Key Components (client/src/components/)
| Component | LOC | Responsibility |
|---|---|---|
| `KanbanBoard` | 394 | Board layout, drag-and-drop orchestration, column rendering |
| `EditTaskDialog` | 387 | Full task editing form in a dialog |
| `CreateTaskDialog` | 267 | New task creation form |
| `TaskCard` | 183 | Individual task card with status, priority, actions |
| `TaskCardSummary` | 179 | Compact task card variant |
| `ColorPicker` | 180 | Stage colour selection |
| `InlineTaskEditor` | 132 | Quick inline task editing |
| `TaskWarnings` | 129 | Due date and status warnings |
| `TaskHistoryModal` | 122 | Status change history viewer |
| `DayPlanSubStage` | 116 | Sub-stage rendering within columns |
| `StageHeaders` | 83 | Column headers for the board |
| `TaskColumn` | 71 | Single column container |
| `ArchiveZone` | 41 | Drag target for archiving |
| `FocusModeToggle` | 23 | Toggle for focus/distraction-free mode |

### Hooks (client/src/hooks/)
| Hook | Purpose |
|---|---|
| `use-tasks.ts` | All task CRUD mutations + queries (7 exported hooks) |
| `use-keyboard-shortcuts.ts` | Global keyboard shortcut bindings |
| `use-mobile.tsx` | Mobile viewport detection |
| `use-toast.ts` | Toast notification state |

### UI Primitives (client/src/components/ui/)
45 shadcn/ui components — these are vendored Radix wrappers and are **out of scope** for refactoring (treat as a library).

---

## Directory Structure

```
kanban-local1/
├── .devlaunch                    # Dev launcher config
├── .env                          # Environment variables (not committed)
├── components.json               # shadcn/ui configuration
├── docker-compose.yml            # PostgreSQL 16 service
├── drizzle.config.ts             # Drizzle Kit config
├── package.json                  # Dependencies & scripts
├── postcss.config.js             # PostCSS config
├── tailwind.config.ts            # Tailwind config
├── tsconfig.json                 # TypeScript config (strict, bundler resolution)
├── vite.config.ts                # Vite config (React, path aliases, Replit plugins)
│
├── client/                       # React frontend
│   ├── index.html                # HTML entry point
│   └── src/
│       ├── App.tsx               # Root: QueryClientProvider + Router
│       ├── main.tsx              # ReactDOM render entry
│       ├── index.css             # Global styles + Tailwind directives
│       ├── components/           # Feature components (see table above)
│       │   └── ui/               # shadcn/ui primitives (45 files, treat as library)
│       ├── hooks/                # Custom React hooks
│       ├── lib/                  # queryClient config, cn() utility
│       └── pages/                # Route-level page components
│
├── server/                       # Express backend
│   ├── index.ts                  # App bootstrap, middleware, error handler, listen
│   ├── routes.ts                 # API route registration + seed data
│   ├── storage.ts                # IStorage interface + DatabaseStorage class
│   ├── db.ts                     # pg Pool + Drizzle instance
│   ├── vite.ts                   # Vite dev middleware setup
│   └── static.ts                 # Production static file serving
│
├── shared/                       # Code shared between client and server
│   ├── schema.ts                 # Drizzle table definitions, Zod schemas, TS types
│   └── routes.ts                 # Declarative API route contracts (paths, methods, schemas)
│
├── migrations/                   # Drizzle SQL migrations
│   ├── 0000_hot_firebrand.sql
│   ├── 0001_add_color_to_stages.sql
│   └── meta/
│
├── scripts/                      # One-off migration & debug scripts
│   ├── add-color-column.ts
│   ├── add-enhanced-task-fields.ts
│   ├── add-sub-stages-table.ts
│   └── reproduce-task-update-crash.ts
│
├── script/
│   └── build.ts                  # Production build script (esbuild + Vite)
│
├── development/                  # Planning & task tracking
│   ├── 00-UIX/                   # UI/UX epics & atomics (empty — future)
│   ├── 01-R2-REFACTOR/           # R2 refactor epics & atomics
│   │   ├── CNE (EPICS)/
│   │   │   └── r2-codebase-refactor.json   ← THE ACTIVE EPIC
│   │   └── CNI (ATOMICS)/
│   └── templates/                # JSON templates for CNE/CNI work items
│
├── bugs/                         # Bug reports (JSON)
│   └── archive-drag-drop-not-working.json
│
└── documentation/
    └── version01-notes/          # V1 reference documentation
```

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

| Issue | Location | Detail |
|---|---|---|
| Rethrow after response | `server/index.ts:71` | `throw err` after `res.status().json()` crashes the process |
| Debug logging in prod | `server/storage.ts` | 15+ `console.log` with `[DAO]` prefix left from debugging |
| `any` in updateStage | `server/storage.ts:187` | `const updateData: any = { ...updates }` |
| Request logger leaks body | `server/index.ts:45` | Full JSON response bodies logged on every API call |
| Seed data in routes | `server/routes.ts:12-43` | Database seeding mixed into route registration |
| Replit plugins in prod | `vite.config.ts:10-19` | `@replit/vite-plugin-runtime-error-modal` loaded unconditionally |
| Archive DnD bug | `bugs/archive-drag-drop-not-working.json` | Tracked bug with drag-to-archive |

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
