# Component Index

Index of all components, hooks, utilities, and shared modules in the R2-refactored codebase.

---

## Pages

### Dashboard (`pages/Dashboard/`)

Main Kanban board view with drag-and-drop task management.

| File | Component / Export | Responsibility |
|---|---|---|
| `index.tsx` | `Dashboard` | Page shell — wires together header, content, bottom nav, and task dialogs |
| `DashboardHeader.tsx` | `DashboardHeader` | Search input, focus mode toggle, more-actions menu |
| `DashboardContent.tsx` | `DashboardContent` | Kanban board rendering with filtered tasks |
| `DashboardBottomNav.tsx` | `DashboardBottomNav` | Bottom navigation bar |
| `MoreActionsMenu.tsx` | `MoreActionsMenu` | Dropdown for import/export and bulk actions |
| `use-filtered-tasks.ts` | `useFilteredTasks` | Memoised task filtering by search text, focus mode, and stages |
| `use-task-import-export.ts` | `useTaskImportExport` | Export/import tasks as JSON files |

Route: `/`

### Admin (`pages/Admin/`)

Stage and sub-stage management interface.

| File | Component / Export | Responsibility |
|---|---|---|
| `index.tsx` | `Admin` | Page shell — combines header with stage and sub-stage sections |
| `AdminHeader.tsx` | `AdminHeader` | Page header with back navigation |
| `StageSection.tsx` | `StageSection` | Stage CRUD — list, create, edit, delete, reorder, colour |
| `SubStageSection.tsx` | `SubStageSection` | Sub-stage CRUD — list, create, edit, delete |

Route: `/admin`

### Archive (`pages/Archive.tsx`)

View and restore archived tasks. Single-file component.

Route: `/archive`

### NotFound (`pages/not-found.tsx`)

404 fallback page.

---

## Kanban Components (`components/`)

### Board

| Component | File | Responsibility |
|---|---|---|
| `KanbanBoard` | `KanbanBoard.tsx` | Board layout, DnD context (`@dnd-kit/core`), column rendering, drag handling via `useKanbanDragDrop` |
| `KanbanColumnContent` | `KanbanColumnContent.tsx` | Content area of a single board column — renders task cards and sub-stages within a stage |
| `KanbanDragOverlay` | `KanbanDragOverlay.tsx` | Drag preview overlay shown while dragging a task |
| `StageHeaders` | `StageHeaders.tsx` | Column headers for the board — stage name, colour indicator, task count |
| `TaskColumn` | `TaskColumn.tsx` | Single column container — drop zone via `@dnd-kit` `useDroppable` |
| `DayPlanSubStage` | `DayPlanSubStage.tsx` | Sub-stage rendering within a column (day-plan AM/PM slots) |
| `ArchiveZone` | `ArchiveZone.tsx` | Drag target for archiving tasks via drag-and-drop |
| `FocusModeToggle` | `FocusModeToggle.tsx` | Toggle switch for focus/distraction-free mode |

### Task Cards

| Component | File | Responsibility |
|---|---|---|
| `TaskCard` | `TaskCard.tsx` | Full task card — title, status badge, priority, effort, due date, drag handle |
| `TaskCardSummary` | `TaskCardSummary.tsx` | Compact task card variant for dense views |
| `TaskWarnings` | `TaskWarnings.tsx` | Due-date and status warnings displayed on task cards |

### Task Editing

| Component | File | Responsibility |
|---|---|---|
| `CreateTaskDialog` | `CreateTaskDialog.tsx` | Dialog for creating new tasks — title, stage, description, status, priority, effort, due date, tags |
| `EditTaskDialog` | `EditTaskDialog.tsx` | Dialog for editing existing tasks — uses `useEditTaskForm` hook for state |
| `EditTaskFormFields` | `EditTaskFormFields.tsx` | Form field rendering for the edit dialog — extracted to keep `EditTaskDialog` under 200 LOC |
| `EditTaskDialogActions` | `EditTaskDialogActions.tsx` | Action buttons for the edit dialog — save, delete (with confirmation), archive |
| `InlineTaskEditor` | `InlineTaskEditor.tsx` | Quick inline task editing directly on the board |
| `TaskHistoryModal` | `TaskHistoryModal.tsx` | Modal showing the status-change history timeline for a task |

### Other

| Component | File | Responsibility |
|---|---|---|
| `ColorPicker` | `ColorPicker.tsx` | Colour picker for stage colours, using `DEFAULT_STAGE_COLORS` from shared constants |
| `ErrorBoundary` | `ErrorBoundary.tsx` | React class component — catches uncaught render errors, logs via `logger`, shows fallback UI with Dismiss/Reload |

### UI Primitives (`components/ui/`)

45 shadcn/ui components (Radix + Tailwind + CVA). These are vendored library code — do not modify.

Includes: `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip`.

---

## Hooks (`hooks/`)

### Shared Hooks

| Hook | File | Exports | Purpose |
|---|---|---|---|
| `useStages` | `use-stages.ts` | `useStages`, `useSubStages` | React Query hooks for stages and sub-stages. All stage/sub-stage fetching uses these — no inline `useQuery` |
| `useTasks` | `use-tasks.ts` | `useTasks`, `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useArchiveTask`, `useUnarchiveTask`, `useArchivedTasks`, `useTaskHistory` | React Query hooks for all task operations |
| `useEditTaskForm` | `use-edit-task-form.ts` | `useEditTaskForm` | Form state, validation, and submit handler for the edit-task dialog |
| `useKanbanDragDrop` | `use-kanban-drag-drop.ts` | `useKanbanDragDrop` | DnD-Kit sensors, `onDragStart`, `onDragOver`, `onDragEnd` handlers |
| `useKeyboardShortcuts` | `use-keyboard-shortcuts.ts` | `useKeyboardShortcuts` | Keyboard shortcuts for task status (1–4), priority, save (Cmd+S), cancel (Esc) |
| `useIsMobile` | `use-mobile.tsx` | `useIsMobile` | Mobile viewport detection |
| `useToast` | `use-toast.ts` | `useToast` | Toast notification state and dispatch |

### Page-Local Hooks

| Hook | File | Exports | Purpose |
|---|---|---|---|
| `useFilteredTasks` | `pages/Dashboard/use-filtered-tasks.ts` | `useFilteredTasks` | Memoised filtering of tasks by search, focus mode, stages |
| `useTaskImportExport` | `pages/Dashboard/use-task-import-export.ts` | `useTaskImportExport` | JSON export/import of tasks |

---

## API Layer (`lib/`)

| Module | Exports | Purpose |
|---|---|---|
| `api.ts` | `apiRequest<T>`, `apiGet`, `apiPost`, `apiPatch`, `apiDelete`, `ApiError` | Typed fetch wrapper — centralises headers, JSON serialisation, error handling. All API calls go through `apiRequest` |
| `queryClient.ts` | `queryClient`, `getQueryFn`, re-exports from `api.ts` | TanStack Query client with `staleTime: Infinity`, no auto-refetch, 401-aware default query function |
| `utils.ts` | `cn` | Tailwind class merger (clsx + tailwind-merge) |

---

## Shared Modules (`shared/`)

| Module | Key Exports | Purpose |
|---|---|---|
| `schema.ts` | `stages`, `subStages`, `tasks` (Drizzle tables); `insertStageSchema`, `insertSubStageSchema`, `insertTaskSchema` (Zod); `Stage`, `SubStage`, `Task`, `InsertStage`, `InsertSubStage`, `InsertTask`, `TaskHistoryEntry` (types) | Single source of truth for database schema, validation, and TypeScript types |
| `routes.ts` | `api` object (`api.tasks.*`, `api.stages.*`, `api.subStages.*`) | Declarative API route contracts — paths, HTTP methods, Zod input/response schemas. Used by both client hooks and server route registration |
| `constants.ts` | `TASK_STATUS`, `TASK_PRIORITY`, `TASK_RECURRENCE`, `TASK_STATUS_VALUES`, `TASK_PRIORITY_VALUES`, `TASK_STATUS_LABEL`, `TASK_PRIORITY_LABEL`, `PRIORITY_SORT_ORDER`, `EFFORT_MIN`, `EFFORT_MAX`, `ROUTES`, `DEFAULT_STAGE_COLORS`, `KEYBOARD_STATUS_MAP`, `SEED_STAGE_NAMES`, `getStatusFromStageName`, `isInProgressStageName` | Enums, labels, display values, and helpers used across client and server |
| `api-types.ts` | `ApiErrorResponse`, `IdParams`, `StageIdParams`, `TaskListResponse`, `TaskResponse`, `TaskHistoryResponse`, `StageListResponse`, `StageResponse`, `SubStageListResponse`, `SubStageResponse` | Shared API types for request params and response shapes |
| `logger.ts` | `logger` (`debug`, `info`, `warn`, `error`) | Log-level-gated logger. Respects `LOG_LEVEL` env var (server) and `NODE_ENV`. All application logging uses this — no direct `console.log` in application code |

---

## Server Modules (`server/`)

| Module | Key Exports | Purpose |
|---|---|---|
| `index.ts` | — | Application entry point — Express setup, JSON parser, request logger, route registration, error handler, Vite (dev) / static (prod) serving, `listen()` |
| `app.ts` | `createApp()` | Assembles Express app with routes + error handler without `listen()`. Used by integration tests via supertest |
| `routes.ts` | `registerRoutes` | API route handlers for tasks, stages, and sub-stages. Uses Zod validation and `parseIdParam`. Delegates data access to `DatabaseStorage` |
| `errors.ts` | `AppError`, `errorHandler`, `asyncHandler` | Centralised error handling — `AppError` for structured HTTP errors, `errorHandler` middleware for consistent JSON error responses, `asyncHandler` to catch async rejections in Express 4 |
| `utils.ts` | `parseIdParam` | Parses numeric ID from Express route params. Returns parsed number on success, or sends a 400 JSON error and returns `null` |
| `storage.ts` | `IStorage`, `DatabaseStorage` | Data access layer — `IStorage` interface defines the contract; `DatabaseStorage` implements it with Drizzle queries |
| `db.ts` | `pool`, `db` | PostgreSQL connection pool and Drizzle ORM instance |
| `seed.ts` | — | Database seeding logic (initial stages) |
| `static.ts` | `serveStatic` | Production static file serving from `dist/public/` with SPA fallback to `index.html` |
| `vite.ts` | `setupVite` | Vite dev middleware setup (HMR, imported dynamically in development only) |

---

## Error Handling

See [ARCHITECTURE.md — Error Handling](ARCHITECTURE.md#error-handling) for the full error handling architecture (server-side `AppError` + `errorHandler` middleware, client-side `ErrorBoundary` + `ApiError`, and the consistent `ApiErrorResponse` shape).
