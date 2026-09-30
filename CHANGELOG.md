# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Task attachments are rows, not base64 in the description (EPIC-03 story 7). A file attached to a description is uploaded on its own (`POST /api/attachments`, raw body ≤ 10 MB, type and name in headers) into a new `task_attachments` table (`task_id` FK `ON DELETE CASCADE`, `filename`, `mime_type`, `byte_size`, `data bytea`; migration 0011), and the description's chip references it by `/api/attachments/:id`. Saving a description binds the rows it references to the task and releases the ones it dropped; rows no saved description has referenced for a day are swept (at startup and hourly). A chip pasted from another task's description gets its own copy of the file, so deleting either task never breaks the other. `GET /api/attachments/:id` serves the file with `Content-Disposition` (inline for images, PDF, audio, video and plain text; always a download for anything else and for SVG), `X-Content-Type-Options: nosniff`, a `default-src 'none'` CSP (not on PDFs, whose viewers need it off) and immutable caching; `?download=1` forces a download. On first start after the upgrade every description still holding a file inline is rewritten to reference a row, without touching `updatedAt`; import files from before the change are handled the same way on save. The export lists each task's attachments (`attachments[]`, `counts.attachments`) and embeds their bytes with `?includeAttachments=true`, which the board's Export and Share use, so an import restores files by uploading them here first. Shared allow-list, size limit and chip helpers live in `shared/attachments.ts`.
- Project layer (EPIC-01): a project is a set of tasks related to a common goal, and the board can be scoped to one at a time while every stage and sub-stage stays exactly as it is. New `projects` table (`name`, optional short `key`, `color`, `archived`, `order`) and a nullable `tasks.project_id` (FK, `ON DELETE SET NULL`, indexed with `stage_id`); existing tasks need no backfill — a task with no project is simply "unassigned". Admin gains a Projects card (create, rename, recolour, archive/unarchive, delete — deleting releases the project's tasks rather than removing them). A project selector appears in the board header as soon as one project exists, offering "All projects", each active project with its live task count, and "No project"; the choice is filtered server-side (`GET /api/tasks?projectId=<id>|none`, same on `/api/tasks/archived`), applies to Filing and Archive but not Admin, persists per browser (`localStorage` key `kanban-project-scope`) and is mirrored into `?project=` so a scoped view can be shared by link. New tasks land in the project being viewed; the create and edit forms carry a Project field (hidden until a project exists). Under "All projects" detail cards, summary hover cards, Filing and Archive show a colour-dot project chip, which disappears when the header already names the project; the preview pane always names it. Imported tasks keep a `projectId` this board knows, otherwise they land in the project being viewed. New `GET/POST /api/projects`, `PATCH/DELETE /api/projects/:id` (409 on a duplicate name, case-insensitive). Shared `shared/project-scope.ts` holds the scope tokens both sides read and write.
- Search reveals its result: while a query is active the board scrolls the first matching card into view (`scrollIntoView`, nearest edge, smooth unless `prefers-reduced-motion`) — through the page in the vertical layout, or the column/strip in the horizontal one — and previews it in the pane, so a hit that sits below the fold or in a scrolled column is not missed. Fires once per query and match, never mid-drag.
- Task preview pane in the horizontal board layout (`TaskPreviewPane`): a full-height, read-only view at the end of the stage row showing the whole task — stage and lane, title, status/priority/effort/owner/recurrence, due date with overdue/today flags, the complete rich-text description, tags, created/updated/parent, and recent history — with an "Open task" button. It follows whichever card the pointer rests on (250 ms hover intent, so crossing cards on the way to the pane leaves it alone), or the last card pressed, clicked or keyboard-focused, and keeps that task until another is chosen. Never changes during a drag or marquee. Resizable against the last column; its width persists under the `preview` key in `kanban-column-weights`.
- Voice dictation on every free-text task field (title, description, owner): a mic button starts the browser's Web Speech API — Apple's recogniser under macOS Safari — shows an animated sound wave and live interim words while listening, and inserts finalised phrases at the caret (`useSpeechDictation`, `DictationButton`, `VoiceInput`, `lib/dictation.ts`). Browsers without the API fall back to focusing the field and pointing at macOS Dictation.
- "Share" in the task view copies the task to the clipboard as a formatted, paste-ready email in both plain-text and HTML flavours (`lib/task-email.ts`, `lib/clipboard.ts`). Clipboard only — no mail client is contacted and no `mailto:` link is produced.
- Resizable board columns in horizontal layout: drag (or arrow-key) the gutter between two stages to change their split, double-click a gutter to even the pair out, and "Reset widths" next to the archive strip clears every override. Widths are stored per stage as flex weights in `localStorage` (`kanban-column-weights`), so the board stays proportional at any viewport width.
- `GET /api/export` returns the board as a single JSON object (`shared/export.ts`): stages, sub-stages, projects and tasks plus `formatVersion`, `exportedAt`, `scope` and `counts`. Supports `?includeArchived=true` and `?projectId=<id>`, which scopes the exported tasks to one project (`scope.projectIds` names it; `projects` is always listed in full so a scoped file stays self-contained). A non-numeric `projectId` is a 400.

### Changed
- A sub-stage's look is set with a **Shade** slider instead of a "Background Class" box and an opacity number. The box took a raw Tailwind class, which only rendered if the same class happened to appear in the app's own source — anything else typed there silently did nothing — and the opacity number was stored but never drawn. The slider (0–100, with a live preview of the lane) paints a wash of the theme's shadow colour over the lane's well, so it reads as a shade in both light and dark mode; its value is the existing `opacity` column, so current sub-stages keep their number. `bg_class` is no longer read (new rows leave it blank) and can be dropped in a later migration.
- Phone layouts are centred and never crowd the top bar. Every page's header is a single row: back (or the logo) at the start, the title centred — on the board the project selector is the title — and at most an icon or two at the end; the icon tiles, the tagline and the Archive/Admin theme toggles are wide-screen extras (the theme is still in the board's More menu). A long project name now truncates instead of pushing More onto a second line, where its menu had opened off-screen. The More, project and Filing menus open as a centred card over the dimmed page on a phone — Escape or a tap outside closes them — and stay as dropdowns hung from their button from the tablet breakpoint (`lg`, 768px).
- On a phone the board shows only its essentials. The header is a single row — logo, project selector, a search toggle and the More menu — with the tagline gone and the app name giving its place to the selector once a project exists (it stays for screen readers). The search field opens under the row on tap, takes focus, stays open while a query is active, and closes — clearing the query — from its ✕, the toggle or a second Escape. The stage-count chips and the warning pills are hidden below the tablet breakpoint (`lg`, 768px): the column headers already carry each stage's name and count, and a card's border still flags an overdue, high-priority or stale task. From `lg` up the header, the always-visible search field, the chips and the pills are unchanged.
- A fatal startup error (a missing `DATABASE_URL`, a failed migration) is logged as its message and stack before the process exits (`server/fatal-errors.ts`). Node's default crash output opens with the whole source line of the throw site — ~100 KB in the minified bundle — and Railway truncates log entries at 64 KB, so the message never reached the log: a missing `DATABASE_URL` showed up as twenty copies of the same slab of minified code.
- Task description attachments are no longer image-only: the editor's paperclip ("Attach file") takes images, PDFs, Word/Excel/PowerPoint, OpenDocument and iWork files, plain text, Markdown, CSV, RTF, JSON, audio, video and zip archives, up to 10 MB each (was 2.5 MB). Files the browser reports with no type, a generic one or a vendor alias (e.g. `.md`, Apple's `x-iwork-*`) are typed from their extension; anything a browser would run (HTML, scripts) is refused on upload and stripped by the sanitizer, which now keeps a chip's href only when it is this server's attachment url. The preview dialog shows images, PDFs, plain text, audio and video inline and offers everything as a download that works at any size.
- Client faults reported by the body parser (an oversized body, malformed JSON) come back as the 413 or 400 they are instead of a 500.
- Summary view renders in-progress tasks as the same effort-sized, stage-tinted circles as every other stage. They used to get a full-width title row (a stray detail view in the middle of a summary board); the row variant, and the stage-name plumbing that selected it, are removed.
- The search field is always visible instead of hiding behind a toggle: on tablets and wider it sits in the header row, right-aligned beside the theme toggle, so it costs no vertical space; on phones it wraps to a full-width second row. A clear (✕) button appears inside the field while there is a query, and Escape clears it. The search-toggle icon button is gone.
- Board warnings ("Many in progress", "High-priority waiting", "Overdue", "Stale tasks") are compact pills — icon, title, count, with the full sentence as tooltip and accessible name — at the right-hand end of the stage-chip row instead of full-width banners stacked above the board. When the chips and pills no longer fit side by side the pills wrap under the chips.
- The horizontal layout's preview pane only renders from the laptop breakpoint up (`xl`, 1024px): on narrower screens the columns already scroll and there is no spare slot for it.
- Tailwind screens gain `lg` (768px), `xl` (1024px) and `2xl` (1280px); the config had only the two phone breakpoints, so no wide-screen variant existed for the horizontal layout to use.
- The board remembers its layout: the vertical/horizontal choice is stored in `localStorage` (`kanban-board-layout`, `useBoardLayout`) instead of component state, so going to Archive or Admin and back — full page navigations — no longer resets the board to vertical. Fresh browsers still start vertical.
- "Done" stages (`isDoneStageName`, the same inference as `getStatusFromStageName`) leave the column row in both layouts and render as a full-width strip directly above the archive strip, parallel to it, so the horizontal row keeps its width for the working columns and the preview pane. The strip keeps its header, count and drag/drop; detail cards tile in a responsive grid, sub-stage lanes sit side by side, and in the horizontal layout the strip caps its height (scrolling inside) and gives way before the columns above it drop below a usable height.
- Drag-and-drop collision detection clips every droppable to its scroll container before testing (`lib/clip-droppable-rects.ts`): a lane scrolled out of view inside a column no longer shadows the done strip or archive strip beneath it, which had made drops onto them land in the hidden lane instead.
- Horizontal board columns now share the full width of the viewport instead of being capped at 320px each, so wide/ultrawide screens are filled rather than leaving the right-hand side empty. Columns fall back to a 260px minimum and horizontal scrolling when there are more stages than fit.
- The archive drop zone moved from a full-height column at the end of the row to a strip underneath the board, where it no longer consumes the majority of a wide viewport.
- The dashboard is now a fixed-height app shell (`h-dvh`): the header, stage chips and bottom nav stay put and the board scrolls inside itself, which keeps the archive strip clear of the bottom nav on short viewports.
- "Export Tasks" now downloads the server-side export (so stages and sub-stages are included), falling back to an in-memory export in the same envelope shape if the API is unreachable.
- Import accepts both the new envelope and legacy bare-array export files.

### Fixed
- A database created from the migrations alone now gets `inbound_email_processing.created_task_ids` and the `ON DELETE SET NULL` foreign key. The files `0005_inbound_email_created_task_ids.sql` and `0006_fk_created_task_id_set_null.sql` were never registered in `migrations/meta/_journal.json`, so the migrator skipped them: on a fresh database "Delete forever" on a task failed with `column "created_task_ids" does not exist`. Both are folded into the idempotent `0012_inbound_email_created_task_ids.sql`, which is a no-op on a database that already got the column another way.
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


