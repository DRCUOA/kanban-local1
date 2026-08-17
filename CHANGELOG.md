# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Task preview pane in the horizontal board layout (`TaskPreviewPane`): a full-height, read-only view at the end of the stage row showing the whole task — stage and lane, title, status/priority/effort/owner/recurrence, due date with overdue/today flags, the complete rich-text description, tags, created/updated/parent, and recent history — with an "Open task" button. It follows whichever card the pointer rests on (250 ms hover intent, so crossing cards on the way to the pane leaves it alone), or the last card pressed, clicked or keyboard-focused, and keeps that task until another is chosen. Never changes during a drag or marquee. Resizable against the last column; its width persists under the `preview` key in `kanban-column-weights`.
- Voice dictation on every free-text task field (title, description, owner): a mic button starts the browser's Web Speech API — Apple's recogniser under macOS Safari — shows an animated sound wave and live interim words while listening, and inserts finalised phrases at the caret (`useSpeechDictation`, `DictationButton`, `VoiceInput`, `lib/dictation.ts`). Browsers without the API fall back to focusing the field and pointing at macOS Dictation.
- "Share" in the task view copies the task to the clipboard as a formatted, paste-ready email in both plain-text and HTML flavours (`lib/task-email.ts`, `lib/clipboard.ts`). Clipboard only — no mail client is contacted and no `mailto:` link is produced.
- Resizable board columns in horizontal layout: drag (or arrow-key) the gutter between two stages to change their split, double-click a gutter to even the pair out, and "Reset widths" next to the archive strip clears every override. Widths are stored per stage as flex weights in `localStorage` (`kanban-column-weights`), so the board stays proportional at any viewport width.
- `GET /api/export` returns the board as a single JSON object (`shared/export.ts`): stages, sub-stages and tasks plus `formatVersion`, `exportedAt`, `scope` and `counts`. Supports `?includeArchived=true`.
- Reserved `projects: []` and `scope.projectIds: null` in the envelope for the forthcoming project layer; `?projectId=` returns 400 rather than silently exporting everything.

### Changed
- Summary view renders in-progress tasks as the same effort-sized, stage-tinted circles as every other stage. They used to get a full-width title row (a stray detail view in the middle of a summary board); the row variant, and the stage-name plumbing that selected it, are removed.
- The board remembers its layout: the vertical/horizontal choice is stored in `localStorage` (`kanban-board-layout`, `useBoardLayout`) instead of component state, so going to Archive or Admin and back — full page navigations — no longer resets the board to vertical. Fresh browsers still start vertical.
- "Done" stages (`isDoneStageName`, the same inference as `getStatusFromStageName`) leave the column row in both layouts and render as a full-width strip directly above the archive strip, parallel to it, so the horizontal row keeps its width for the working columns and the preview pane. The strip keeps its header, count and drag/drop; detail cards tile in a responsive grid, sub-stage lanes sit side by side, and in the horizontal layout the strip caps its height (scrolling inside) and gives way before the columns above it drop below a usable height.
- Drag-and-drop collision detection clips every droppable to its scroll container before testing (`lib/clip-droppable-rects.ts`): a lane scrolled out of view inside a column no longer shadows the done strip or archive strip beneath it, which had made drops onto them land in the hidden lane instead.
- Horizontal board columns now share the full width of the viewport instead of being capped at 320px each, so wide/ultrawide screens are filled rather than leaving the right-hand side empty. Columns fall back to a 260px minimum and horizontal scrolling when there are more stages than fit.
- The archive drop zone moved from a full-height column at the end of the row to a strip underneath the board, where it no longer consumes the majority of a wide viewport.
- The dashboard is now a fixed-height app shell (`h-dvh`): the header, stage chips and bottom nav stay put and the board scrolls inside itself, which keeps the archive strip clear of the bottom nav on short viewports.
- "Export Tasks" now downloads the server-side export (so stages and sub-stages are included), falling back to an in-memory export in the same envelope shape if the API is unreachable.
- Import accepts both the new envelope and legacy bare-array export files.

### Fixed
- `GET /api/export` no longer serves a cached snapshot: every response sends `Cache-Control: no-store, no-cache, must-revalidate` and `CDN-Cache-Control: no-store`, so two fetches of the same URL return different `exportedAt` values. A briefing agent polling the identical URL had been replayed the same 12-hour-old body until a junk query parameter forced a rebuild. (BUG-003)
- Export day boundaries are cut in `Pacific/Auckland` rather than the server's UTC, so `generatedFor`, `daysOverdue`, `dueBucket` and the overdue/dueToday buckets are right during NZ mornings, when UTC is still on the previous date. `?tz=` accepts any IANA zone, defaulting to `Pacific/Auckland`; an unknown zone is a 400, and `overdueRule` names the zone actually used. (BUG-003)
- Export entries carry `dueDay`, the card's labeled calendar date (YYYY-MM-DD), on both `tasks[].urgency` and every `briefing` entry. The date picker stores a due date as the chosen day at local midnight, so the `dueDate` instant's UTC date part is a day earlier than the label — a consumer reading a date out of that instant saw every card a day early. `overdueRule` now names `dueDay` as the field to compare. (BUG-004)

### Changed
- The board's overdue highlight, the card's printed due date and the export's `overdue` list all derive from one helper (`dueDayFor` / `isOverdueOn` in `shared/briefing.ts`) instead of browser-local `isPast`/`isToday`, so board and export cannot disagree. A card's day is now the board's zone rather than the viewer's, so due dates no longer shift when the board is opened from another timezone. (BUG-004)

## [1.2.1] - 2026-03-24

### Added
- Shared `getTaskWarningHighlight` / `resolveTaskStatusForWarnings` (`shared/task-warning-highlight.ts`) so dashboard warnings and task styling use the same rules.

### Changed
- Task card and summary borders use the stage color by default again.
- When a task matches a dashboard warning (overdue, high/critical priority in backlog, or stale for 14+ days), its border uses the same accent as the corresponding warning banner (red, gold, or blue). Precedence: overdue, then high-priority backlog, then stale.
- Warning banner left accents and task borders share CSS variables (`--warning-accent`, `--toast-overdue-accent`, `--toast-info-accent`) for consistent colors.

## [1.2.0] - 2025-01-02

### Added
- Enhanced task schema with priority, effort, dueDate, tags, status, recurrence, parentTaskId, and history tracking
- Inline editing for task title and description (click to edit)
- Keyboard shortcuts (N=new task, Enter=save, Esc=cancel, 1-4=move status, Cmd/Ctrl+↑↓=priority)
- Focus Mode toggle to show only in-progress tasks and next suggested task
- Task warnings for overdue tasks, high-priority backlog items, and stale tasks
- Task History modal showing status transitions and timeline
- Import/Export functionality for task backup and portability
- Visual priority indicators (border thickness, badges)
- Overdue task indicators with subtle visual cues
- Database migration script for enhanced task fields
- Status inference from stage names for backward compatibility

### Changed
- Task cards now display priority, effort, due date, and tags
- Drag-and-drop updates both stageId and status fields
- Task creation automatically infers status from selected stage
- Enhanced Edit Task dialog with status, priority, effort, and due date fields
- Enhanced Create Task dialog with priority and effort fields

### Fixed
- Import functionality now properly creates tasks in database instead of only localStorage
- Status and stageId synchronization when dragging tasks between columns
- Focus mode filtering handles tasks without status field
- Inline editor no longer interferes with drag-and-drop operations
- Task warnings correctly infer status from stages when status field missing
- Calendar component date picker in Edit Task dialog

## [1.1.0] - 2024-12-21

### Added
- Docker Compose configuration for PostgreSQL database setup
- Automated setup script (`setup.sh`) for streamlined local development environment
- Comprehensive setup documentation (`README-SETUP.md`) with CLI installation instructions
- Local LAN setup guide (`README-LAN-SETUP.md`) for network accessibility configuration
- Environment variable example file (`.env.example`) for database configuration
- Dotenv integration for environment variable management

### Changed
- Updated `drizzle.config.ts` to import dotenv for environment variable loading
- Updated `server/db.ts` to import dotenv for database connection configuration
- Updated `server/index.ts` to import dotenv and simplified HTTP server listen configuration
- Updated `vite.config.ts` to bind to all interfaces (`host: true`) for LAN access
- Updated `.gitignore` to exclude `.env` files

### Fixed
- Server binding configuration to ensure proper LAN accessibility
- Database connection setup to use environment variables consistently


