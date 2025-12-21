# Release Draft - Version 1.1.0

## Summary

This release introduces significant improvements to the development setup and configuration management for the Kanban application. The primary focus is on streamlining local development workflows and enhancing project accessibility.

**Key Additions:**
- Docker Compose configuration for PostgreSQL database, eliminating manual installation requirements
- Automated setup script (`setup.sh`) that handles Docker startup, database initialization, and schema setup
- Comprehensive documentation including CLI setup instructions and LAN accessibility guides
- Environment variable management through dotenv integration for secure configuration handling

**Configuration Updates:**
- Server and database modules now consistently use environment variables for configuration
- Vite dev server configured for LAN access to support multi-device development workflows
- Added `.env.example` template to guide proper environment setup

**Impact:**
These changes significantly reduce onboarding time for new developers and provide clear guidance for both local and network-based development scenarios. The automated setup process minimizes configuration errors while the enhanced documentation addresses common setup questions.

