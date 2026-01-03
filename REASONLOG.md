# Reason Log

This document explains the reasoning behind significant changes and decisions made in this project.

## [1.1.0] - 2024-12-21

### Docker Compose Integration
**Reason**: Simplified local development setup by containerizing PostgreSQL database. This eliminates the need for manual PostgreSQL installation and configuration, making the project more accessible to new developers and ensuring consistent database environments across different machines.

### Automated Setup Script
**Reason**: Reduced onboarding friction by automating the multi-step setup process. The script handles Docker startup, database initialization, and schema setup, reducing the chance of configuration errors and saving developer time.

### Environment Variable Management
**Reason**: Improved security and flexibility by moving database credentials and configuration to environment variables. This follows best practices for configuration management and allows different settings for development, staging, and production environments without code changes.

### LAN Accessibility Configuration
**Reason**: Enabled local network access to support development workflows where multiple devices need to access the application. The configuration ensures the server binds to all interfaces while maintaining security through firewall settings and router configuration guidance.

### Documentation Improvements
**Reason**: Comprehensive documentation addresses common setup questions and reduces support burden. Separate guides for CLI setup and LAN configuration provide targeted information for different use cases, improving developer experience and project maintainability.

## [1.2.0] - 2025-01-02

### Enhanced Task Model
**Reason**: Expanded task schema to support richer metadata (priority, effort, due dates, tags, status, history) transforms the system from a simple Kanban board into a sophisticated productivity tool. This enables better task organization, prioritization, and tracking while maintaining backward compatibility through sensible defaults and status inference.

### Inline Editing and Keyboard Shortcuts
**Reason**: Reduced friction in task management by enabling quick edits without opening dialogs. Keyboard shortcuts follow common productivity app patterns, making the system faster to use for power users while remaining discoverable for casual users.

### Focus Mode
**Reason**: Addresses cognitive overload by filtering to only active work and the next suggested task. This supports deep work sessions where visual noise from backlog and completed items can be distracting, aligning with the goal of creating a psychologically friendly productivity tool.

### Task Warnings and Intelligence
**Reason**: Provides gentle, contextual guidance without being intrusive. Warnings help users recognize patterns (too many in-progress tasks, high-priority items stuck in backlog) that reduce productivity, encouraging better workflow management without feeling like a corporate project manager.

### Import/Export Functionality
**Reason**: Enables data portability and backup for personal use. Users can export their tasks for backup or migration, and import tasks from other systems or previous exports, ensuring data ownership and continuity.

### Status and Stage Synchronization
**Reason**: Maintains consistency between the traditional stage-based workflow and the new status field. Status inference from stage names ensures backward compatibility while enabling new features that rely on status values, creating a smooth migration path for existing data.


