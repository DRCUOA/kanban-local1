# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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


