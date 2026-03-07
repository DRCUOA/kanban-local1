#!/bin/bash

set -e

echo "🚀 Starting Kanban Local Setup..."
echo ""

# Step 1: Start Docker Desktop if not running
echo "📦 Step 1: Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "   Starting Docker Desktop..."
    open -a Docker
    echo "   Waiting for Docker to be ready..."
    
    # Wait up to 60 seconds for Docker to start
    for i in {1..60}; do
        if docker info > /dev/null 2>&1; then
            echo "   ✅ Docker is ready!"
            break
        fi
        if [ $i -eq 60 ]; then
            echo "   ❌ Docker failed to start. Please start Docker Desktop manually."
            exit 1
        fi
        sleep 1
    done
else
    echo "   ✅ Docker is already running"
fi

# Step 2: Start PostgreSQL
echo ""
echo "🐘 Step 2: Starting PostgreSQL database..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "   Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec kanban-postgres pg_isready -U kanban > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠️  PostgreSQL is taking longer than expected, but continuing..."
    fi
    sleep 1
done

# Step 3: Set up database schema
echo ""
echo "🗄️  Step 3: Setting up database schema..."
npm run db:push

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application, run:"
echo "   npm run dev"
echo ""


