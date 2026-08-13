# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Voice dictation on every free-text task field (title, description, owner): a mic button starts the browser's Web Speech API — Apple's recogniser under macOS Safari — shows an animated sound wave and live interim words while listening, and inserts finalised phrases at the caret (`useSpeechDictation`, `DictationButton`, `VoiceInput`, `lib/dictation.ts`). Browsers without the API fall back to focusing the field and pointing at macOS Dictation.
- "Share" in the task view copies the task to the clipboard as a formatted, paste-ready email in both plain-text and HTML flavours (`lib/task-email.ts`, `lib/clipboard.ts`). Clipboard only — no mail client is contacted and no `mailto:` link is produced.
- Resizable board columns in horizontal layout: drag (or arrow-key) the gutter between two stages to change their split, double-click a gutter to even the pair out, and "Reset widths" next to the archive strip clears every override. Widths are stored per stage as flex weights in `localStorage` (`kanban-column-weights`), so the board stays proportional at any viewport width.
- `GET /api/export` returns the board as a single JSON object (`shared/export.ts`): stages, sub-stages and tasks plus `formatVersion`, `exportedAt`, `scope` and `counts`. Supports `?includeArchived=true`.
- Reserved `projects: []` and `scope.projectIds: null` in the envelope for the forthcoming project layer; `?projectId=` returns 400 rather than silently exporting everything.

### Changed
- Horizontal board columns now share the full width of the viewport instead of being capped at 320px each, so wide/ultrawide screens are filled rather than leaving the right-hand side empty. Columns fall back to a 260px minimum and horizontal scrolling when there are more stages than fit.
- The archive drop zone moved from a full-height column at the end of the row to a strip underneath the board, where it no longer consumes the majority of a wide viewport.
- The dashboard is now a fixed-height app shell (`h-dvh`): the header, stage chips and bottom nav stay put and the board scrolls inside itself, which keeps the archive strip clear of the bottom nav on short viewports.
- "Export Tasks" now downloads the server-side export (so stages and sub-stages are included), falling back to an in-memory export in the same envelope shape if the API is unreachable.
- Import accepts both the new envelope and legacy bare-array export files.

### Fixed
- `GET /api/export` no longer serves a cached snapshot: every response sends `Cache-Control: no-store, no-cache, must-revalidate` and `CDN-Cache-Control: no-store`, so two fetches of the same URL return different `exportedAt` values. A briefing agent polling the identical URL had been replayed the same 12-hour-old body until a junk query parameter forced a rebuild. (BUG-003)
- Export day boundaries are cut in `Pacific/Auckland` rather than the server's UTC, so `generatedFor`, `daysOverdue`, `dueBucket` and the overdue/dueToday buckets are right during NZ mornings, when UTC is still on the previous date. `?tz=` accepts any IANA zone, defaulting to `Pacific/Auckland`; an unknown zone is a 400, and `overdueRule` names the zone actually used. (BUG-003)

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


