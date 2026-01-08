# Scripts Directory

This directory contains utility scripts for the kanban application.

## Available Scripts

### `reproduce-task-update-crash.ts`

**Purpose**: Reproduces the race condition bug in task updates that causes data corruption.

**What it does**:
- Creates a test task
- Sends multiple concurrent update requests (30 per batch × 3 batches = 90 total)
- Verifies data integrity of the task history
- Reports on success/failure rates and any data corruption

**Usage**:

```bash
# Ensure the server is running
npm run dev

# In another terminal, run the script
npx tsx scripts/reproduce-task-update-crash.ts
```

**Expected Output**:
```
======================================================================
🧪 TASK UPDATE CRASH REPRODUCTION SCRIPT
======================================================================

API Base URL: http://localhost:5000
Concurrent requests per batch: 30
Number of batches: 3
Delay between batches: 50ms

...

======================================================================
📊 RESULTS
======================================================================
Total successful requests: 94
Total failed requests: 0
Server crashed: NO ✅
```

**Configuration**:

You can modify the script parameters at the top of the file:

```typescript
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const CONCURRENT_REQUESTS = 30; // Number of simultaneous requests
const REQUEST_DELAY_MS = 50; // Delay between batches
const NUM_BATCHES = 3; // Number of batches to send
```

**What to look for**:
- ✅ No server crashes (process stays running)
- ❌ History data corruption (fewer entries than expected)
- ⚠️  HTTP request errors (500 errors, connection refused)

**Related Documentation**:
- See `INVESTIGATION-REPORT.md` for full analysis
- See `server/storage.ts` for the affected code

## Database Scripts

### `add-color-column.ts`
Adds color column to stages table.

### `add-enhanced-task-fields.ts`
Adds enhanced fields (priority, effort, etc.) to tasks table.

### `add-sub-stages-table.ts`
Creates the sub_stages table.

**Usage**:
```bash
npm run db:add-color
npm run db:enhance-tasks
npm run db:add-sub-stages
```

## Development Notes

- All scripts use TypeScript and are executed via `tsx`
- Scripts require the database to be running (via `docker compose up -d`)
- Environment variables are loaded from `.env` file
