# Architecture

## System Overview

kanban-local1 is a local-first Kanban board application built as a single-process Express + Vite + React monolith backed by PostgreSQL. It serves both API and client on a single port (default 5000).

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
│               apiRequest → /api/*                       │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP
┌────────────────────────────┴────────────────────────────┐
│  Express (server/index.ts)                              │
│  ├── JSON body parser                                   │
│  ├── Request logger middleware                          │
│  ├── API routes (server/routes.ts)                      │
│  │   ├── Zod validation via shared/routes.ts contracts  │
│  │   └── parseIdParam for route param validation        │
│  ├── Error-handling middleware (server/errors.ts)        │
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

---

## Module Structure

The codebase is organised into three top-level source directories plus a shared module that is imported by both client and server.

```
kanban-local1/
├── client/src/          # React frontend (Vite)
├── server/              # Express API server
└── shared/              # Code shared between client and server
```

### Path Aliases (tsconfig + Vite)

| Alias | Resolves to |
|---|---|
| `@/*` | `client/src/*` |
| `@shared/*` | `shared/*` |

---

## Shared Modules (`shared/`)

Shared modules are the single source of truth for types, constants, API contracts, and logging. Both client and server import from here — nothing is redefined on either side. Five modules: `schema.ts` (Drizzle tables, Zod schemas, TS types), `routes.ts` (declarative API contracts), `constants.ts` (enums, labels, helpers), `api-types.ts` (error/response types), and `logger.ts` (log-level-gated logger — all application logging routes through this, no direct `console.log`).

See [COMPONENT_INDEX.md — Shared Modules](COMPONENT_INDEX.md#shared-modules-shared) for the full export listing.

---

## Client Architecture (`client/src/`)

### Component Tree

```
App
├── QueryClientProvider
│   └── ErrorBoundary
│       └── TooltipProvider
│           ├── Toaster
│           └── Router (wouter)
│               ├── Dashboard (/)
│               │   ├── DashboardHeader
│               │   │   ├── FocusModeToggle
│               │   │   └── MoreActionsMenu
│               │   ├── DashboardContent
│               │   │   └── KanbanBoard
│               │   │       ├── StageHeaders
│               │   │       ├── KanbanColumnContent
│               │   │       │   ├── TaskColumn
│               │   │       │   │   ├── TaskCard / TaskCardSummary
│               │   │       │   │   └── DayPlanSubStage
│               │   │       │   └── ArchiveZone
│               │   │       └── KanbanDragOverlay
│               │   ├── DashboardBottomNav
│               │   ├── CreateTaskDialog
│               │   └── EditTaskDialog
│               │       ├── EditTaskFormFields
│               │       └── EditTaskDialogActions
│               ├── Admin (/admin)
│               │   ├── AdminHeader
│               │   ├── StageSection
│               │   └── SubStageSection
│               ├── Archive (/archive)
│               └── NotFound (fallback)
```

All API calls go through the `apiRequest<T>` typed fetch wrapper in `lib/api.ts`. 7 shared hooks in `hooks/` plus 2 page-local hooks co-located with Dashboard. 45 vendored shadcn/ui primitives in `components/ui/` (treated as library code).

See [COMPONENT_INDEX.md](COMPONENT_INDEX.md) for the full breakdown of every component, hook, API layer module, and page with exports and responsibilities.

---

## Server Architecture (`server/`)

10 modules: `index.ts` (bootstrap), `app.ts` (`createApp()` for tests), `routes.ts` (API handlers with Zod validation), `errors.ts` (centralised error handling — see [Error Handling](#error-handling) below), `utils.ts` (`parseIdParam`), `storage.ts` (`IStorage` interface + `DatabaseStorage`), `db.ts` (pg pool + Drizzle), `seed.ts`, `static.ts` (production serving), `vite.ts` (dev HMR).

See [COMPONENT_INDEX.md — Server Modules](COMPONENT_INDEX.md#server-modules-server) for the full export listing.

### Request Lifecycle

1. Client hook (e.g. `useTasks()`) calls `apiGet("/api/tasks")`.
2. Express route handler in `server/routes.ts` receives the request.
3. Route params are validated via `parseIdParam`. Request bodies are validated against Zod schemas from `shared/routes.ts`.
4. `DatabaseStorage` method executes the Drizzle query against PostgreSQL.
5. Response is returned as JSON. On error, the `errorHandler` middleware catches it and returns a consistent `{ error, status, details? }` shape.
6. React Query caches the response and re-renders the component.

---

## Error Handling

Error handling is centralised on both client and server.

### Server

| Component | Location | Role |
|---|---|---|
| `AppError` | `server/errors.ts` | Custom error class carrying `statusCode`, `message`, and optional `details`. Throw from any route handler to produce a structured error response |
| `errorHandler` | `server/errors.ts` | Express error-handling middleware (4-param signature). Catches all errors that reach the middleware stack. `AppError` instances produce their status code; other errors produce 500. Stack traces are only included in non-production |
| `asyncHandler` | `server/errors.ts` | Wraps async route handlers so rejected promises are forwarded to `errorHandler` via `next()` (Express 4 does not catch async rejections automatically) |
| `parseIdParam` | `server/utils.ts` | Validates numeric route params. Returns the parsed number or sends a 400 JSON error and returns `null` |
| Registration | `server/app.ts`, `server/index.ts` | `errorHandler` is registered after all routes via `app.use(errorHandler)` |

**Server error response shape** (defined in `shared/api-types.ts`):

```typescript
interface ApiErrorResponse {
  error: string;
  status: number;
  details?: unknown;
}
```

### Client

| Component | Location | Role |
|---|---|---|
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | React class component wrapping the entire app (below `QueryClientProvider`, above `TooltipProvider`). Catches uncaught render errors, logs via `logger`, and shows a fallback UI with Dismiss and Reload actions |
| `ApiError` | `lib/api.ts` | Error class thrown by `apiRequest` on non-OK HTTP responses. Carries `status`, `statusText`, and parsed error `body` |
| Network errors | `lib/api.ts` | `apiRequest` detects `TypeError` from `fetch` failures and throws a descriptive network error message |

**Error flow:**

- **Render errors** → `ErrorBoundary` → fallback UI
- **API errors** → `apiRequest` throws `ApiError` → React Query's `onError` / component error states
- **Route handler errors** → per-handler try/catch or bubbles to `errorHandler` middleware → consistent JSON response

---

## Development vs Production

| Concern | Development | Production |
|---|---|---|
| Client serving | Vite dev server with HMR (middleware mode) | Static files from `dist/public/` with SPA fallback |
| Bundling | None (Vite transforms on the fly) | Client: Vite build. Server: esbuild → `dist/index.cjs` |
| Logging | `logger.debug` enabled | `logger.debug` suppressed (min level: `info`) |
| Error details | Stack traces included in error responses | Stack traces omitted; generic "Internal Server Error" message |
| Server start | `tsx server/index.ts` | `node dist/index.cjs` |

---

## Database Schema

Three tables defined in `shared/schema.ts`:

### stages

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | Not null |
| order | integer | Display order |
| color | text | Hex colour, nullable |
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

## Directory Structure

```
kanban-local1/
├── client/                       # React frontend
│   ├── index.html
│   └── src/
│       ├── App.tsx               # Root: QueryClientProvider → ErrorBoundary → Router
│       ├── main.tsx              # ReactDOM render entry
│       ├── index.css             # Global styles + Tailwind directives
│       ├── components/           # Feature components
│       │   ├── ErrorBoundary.tsx
│       │   ├── KanbanBoard.tsx
│       │   ├── KanbanColumnContent.tsx
│       │   ├── KanbanDragOverlay.tsx
│       │   ├── StageHeaders.tsx
│       │   ├── TaskCard.tsx
│       │   ├── TaskCardSummary.tsx
│       │   ├── TaskColumn.tsx
│       │   ├── CreateTaskDialog.tsx
│       │   ├── EditTaskDialog.tsx
│       │   ├── EditTaskDialogActions.tsx
│       │   ├── EditTaskFormFields.tsx
│       │   ├── InlineTaskEditor.tsx
│       │   ├── ArchiveZone.tsx
│       │   ├── ColorPicker.tsx
│       │   ├── DayPlanSubStage.tsx
│       │   ├── FocusModeToggle.tsx
│       │   ├── TaskHistoryModal.tsx
│       │   ├── TaskWarnings.tsx
│       │   └── ui/               # shadcn/ui primitives (45 files, vendored)
│       ├── hooks/                # Shared React hooks
│       │   ├── use-stages.ts
│       │   ├── use-tasks.ts
│       │   ├── use-edit-task-form.ts
│       │   ├── use-kanban-drag-drop.ts
│       │   ├── use-keyboard-shortcuts.ts
│       │   ├── use-mobile.tsx
│       │   └── use-toast.ts
│       ├── lib/                  # API layer and utilities
│       │   ├── api.ts
│       │   ├── queryClient.ts
│       │   └── utils.ts
│       └── pages/                # Route-level page components
│           ├── not-found.tsx
│           ├── Archive.tsx
│           ├── Admin/
│           │   ├── index.tsx
│           │   ├── AdminHeader.tsx
│           │   ├── StageSection.tsx
│           │   └── SubStageSection.tsx
│           └── Dashboard/
│               ├── index.tsx
│               ├── DashboardHeader.tsx
│               ├── DashboardContent.tsx
│               ├── DashboardBottomNav.tsx
│               ├── MoreActionsMenu.tsx
│               ├── use-filtered-tasks.ts
│               └── use-task-import-export.ts
│
├── server/                       # Express backend
│   ├── index.ts                  # Bootstrap, middleware, listen
│   ├── app.ts                    # createApp() for tests
│   ├── routes.ts                 # API route handlers
│   ├── errors.ts                 # AppError, errorHandler, asyncHandler
│   ├── utils.ts                  # parseIdParam
│   ├── storage.ts                # IStorage interface + DatabaseStorage
│   ├── db.ts                     # pg Pool + Drizzle instance
│   ├── seed.ts                   # Database seeding
│   ├── static.ts                 # Production static file serving
│   └── vite.ts                   # Vite dev middleware
│
├── shared/                       # Shared between client and server
│   ├── schema.ts                 # Drizzle tables, Zod schemas, TS types
│   ├── routes.ts                 # Declarative API route contracts
│   ├── constants.ts              # Enums, labels, routes, colours
│   ├── api-types.ts              # API response/error types
│   └── logger.ts                 # Structured logger
│
├── migrations/                   # Drizzle SQL migrations
├── tests/                        # Smoke tests
├── script/
│   └── build.ts                  # Production build (esbuild + Vite)
├── docker-compose.yml            # PostgreSQL 16 service
├── eslint.config.js              # ESLint (strict TypeScript)
├── tailwind.config.ts
├── vite.config.ts
├── vitest.config.ts
├── components.json               # shadcn/ui config
└── package.json
```
