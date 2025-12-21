# CLI Installation Instructions

## Quick Setup (Automated)

Run the setup script:

```bash
./setup.sh
```

Then start the app:

```bash
npm run dev
```

---

## Manual CLI Setup (Step by Step)

### Step 1: Start Docker Desktop
```bash
open -a Docker
```

Wait for Docker to be ready (check with):
```bash
docker info
```

### Step 2: Start PostgreSQL Database
```bash
docker-compose up -d
```

Verify it's running:
```bash
docker ps | grep kanban-postgres
```

### Step 3: Wait for Database to be Ready
```bash
# Check if PostgreSQL is ready (repeat until it succeeds)
docker exec kanban-postgres pg_isready -U kanban
```

### Step 4: Set Up Database Schema
```bash
npm run db:push
```

### Step 5: Start the Application
```bash
npm run dev
```

---

## All Commands in One Go

```bash
# Start Docker (if not running)
open -a Docker && sleep 10

# Start database
docker-compose up -d

# Wait for database (optional check)
sleep 5

# Set up schema
npm run db:push

# Start app
npm run dev
```

---

## Useful Commands

### Check Docker status
```bash
docker info
```

### Check database container
```bash
docker ps | grep kanban-postgres
```

### View database logs
```bash
docker logs kanban-postgres
```

### Stop database
```bash
docker-compose down
```

### Stop and remove database (including data)
```bash
docker-compose down -v
```

### Restart database
```bash
docker-compose restart
```

---

## Troubleshooting

### Docker not starting
```bash
# Check if Docker is installed
which docker

# Try starting manually
open -a Docker

# Wait and check
sleep 15 && docker info
```

### Database connection issues
```bash
# Check if container is running
docker ps

# Check database logs
docker logs kanban-postgres

# Verify connection string in .env
cat .env | grep DATABASE_URL
```

### Reset everything
```bash
# Stop and remove containers and volumes
docker-compose down -v

# Restart
docker-compose up -d

# Re-run schema setup
npm run db:push
```

