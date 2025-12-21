# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

