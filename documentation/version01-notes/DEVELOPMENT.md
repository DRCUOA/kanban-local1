# Development Guide

Complete guide for setting up, building, and developing the Kanban application.

## Prerequisites

- **Node.js**: Version 20+ (check with `node --version`)
- **Docker Desktop**: For running PostgreSQL database
- **npm**: Comes with Node.js
- **macOS**: Primary development platform (M3 Air)

## Quick Start

### Automated Setup

Run the setup script:

```bash
./setup.sh
```

This script will:
1. Check and start Docker Desktop if needed
2. Start PostgreSQL container
3. Set up database schema
4. Provide instructions to start the app

Then start the development server:

```bash
npm run dev
```

### Manual Setup

1. **Start Docker Desktop**
   ```bash
   open -a Docker
   ```

2. **Start PostgreSQL**
   ```bash
   docker-compose up -d
   ```

3. **Wait for database to be ready**
   ```bash
   docker exec kanban-postgres pg_isready -U kanban
   ```

4. **Set up database schema**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban
PORT=5000
NODE_ENV=development
```

### Required Variables

- `DATABASE_URL`: PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Default (Docker): `postgresql://kanban:kanban@localhost:5432/kanban`

### Optional Variables

- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode (`development` or `production`)

## Project Scripts

### Development

```bash
npm run dev
```

Starts the development server:
- Express server on port 5000 (or `PORT` env var)
- Vite dev server for frontend (HMR enabled)
- Hot reload for both frontend and backend changes

### Building

```bash
npm run build
```

Builds the application for production:
- Frontend: Vite builds React app to `dist/public`
- Backend: esbuild bundles server to `dist/index.cjs`

**Build Process**:
```35:67:script/build.ts
async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}
```

### Production

```bash
npm start
```

Runs the production build:
- Requires `npm run build` first
- Serves static files from Express
- Single server for both API and frontend

### Database

```bash
npm run db:push
```

Pushes schema changes to database using Drizzle Kit.

### Type Checking

```bash
npm run check
```

Runs TypeScript compiler to check for type errors (no emit).

## Development vs Production

### Development Mode

- **Frontend**: Vite dev server with HMR
- **Backend**: tsx runs TypeScript directly
- **Hot Reload**: Both frontend and backend reload on changes
- **Source Maps**: Enabled for debugging
- **Ports**: Express (5000) + Vite (5173, proxied)

**Configuration**:
```74:82:server/index.ts
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
```

### Production Mode

- **Frontend**: Static files served from `dist/public`
- **Backend**: Bundled with esbuild to `dist/index.cjs`
- **Single Port**: Only Express server (default: 5000)
- **Optimized**: Minified and optimized bundles

## Code Patterns

### Type-Safe API Calls

Use shared route definitions for type safety:

```typescript
import { api } from "@shared/routes";

// Type-safe fetch
const res = await fetch(api.tasks.list.path);
const tasks = api.tasks.list.responses[200].parse(await res.json());
```

### React Query Hooks

Create custom hooks for data operations:

```typescript
export function useTasks() {
  return useQuery({
    queryKey: [api.tasks.list.path],
    queryFn: async () => {
      const res = await fetch(api.tasks.list.path);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return api.tasks.list.responses[200].parse(await res.json());
    },
  });
}
```

### Form Validation

Use React Hook Form with Zod:

```typescript
const form = useForm<InsertTask>({
  resolver: zodResolver(insertTaskSchema),
  defaultValues: {
    title: "",
    description: "",
    stageId: 1,
  },
});
```

### Error Handling

Consistent error handling pattern:

```typescript
try {
  const data = schema.parse(input);
  // Process data
} catch (error) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: error.errors[0].message });
  } else {
    res.status(500).json({ message: "Internal Server Error" });
  }
}
```

### Toast Notifications

Use toast hook for user feedback:

```typescript
const { toast } = useToast();

toast({
  title: "Success",
  description: "Task created successfully",
});

toast({
  title: "Error",
  description: error.message,
  variant: "destructive",
});
```

## Database Management

### Schema Changes

1. Edit `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Migrations are generated automatically

### Database Access

Connect to PostgreSQL:

```bash
docker exec -it kanban-postgres psql -U kanban
```

### Reset Database

```bash
# Stop and remove container with data
docker-compose down -v

# Restart
docker-compose up -d

# Re-run schema setup
npm run db:push
```

### View Database Logs

```bash
docker logs kanban-postgres
```

## Testing

### Test Data Attributes

Components use `data-testid` attributes for testing:

- `button-add-task`: Create task button
- `input-task-title`: Task title input
- `input-task-description`: Task description input
- `button-submit-task`: Submit task button
- `button-admin`: Admin page link
- `input-search`: Search input
- `button-edit-stage-{id}`: Edit stage button
- `button-delete-stage-{id}`: Delete stage button

### Example Test Selectors

```typescript
// Find create task button
screen.getByTestId("button-add-task");

// Find task title input
screen.getByTestId("input-task-title");

// Find edit stage button
screen.getByTestId("button-edit-stage-1");
```

## Project Structure Conventions

### File Naming

- **Components**: PascalCase (e.g., `TaskCard.tsx`)
- **Hooks**: camelCase with `use-` prefix (e.g., `use-tasks.ts`)
- **Utilities**: camelCase (e.g., `queryClient.ts`)
- **Types**: PascalCase (e.g., `Task`, `Stage`)

### Import Paths

Use path aliases:

```typescript
// Client code
import { Button } from "@/components/ui/button";

// Shared code
import { Task } from "@shared/schema";
import { api } from "@shared/routes";
```

**Alias Configuration**:
```22:27:vite.config.ts
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
```

### Component Organization

```
client/src/
├── components/        # Reusable components
│   ├── ui/          # shadcn/ui primitives
│   └── ...          # Feature components
├── pages/           # Page-level components
├── hooks/           # Custom React hooks
└── lib/             # Utilities and configs
```

## Common Development Tasks

### Adding a New API Endpoint

1. **Define route in `shared/routes.ts`**:
   ```typescript
   export const api = {
     // ... existing routes
     newResource: {
       list: {
         method: "GET" as const,
         path: "/api/new-resource",
         responses: {
           200: z.array(z.custom<typeof newResource.$inferSelect>()),
         },
       },
     },
   };
   ```

2. **Add handler in `server/routes.ts`**:
   ```typescript
   app.get(api.newResource.list.path, async (_req, res) => {
     const items = await storage.getNewResources();
     res.json(items);
   });
   ```

3. **Add storage method in `server/storage.ts`**:
   ```typescript
   async getNewResources(): Promise<NewResource[]> {
     return await db.select().from(newResources);
   }
   ```

4. **Create React hook in `client/src/hooks/`**:
   ```typescript
   export function useNewResources() {
     return useQuery({
       queryKey: [api.newResource.list.path],
       queryFn: async () => {
         const res = await fetch(api.newResource.list.path);
         return api.newResource.list.responses[200].parse(await res.json());
       },
     });
   }
   ```

### Adding a New Component

1. Create component file in appropriate directory
2. Export component
3. Import and use in parent component
4. Add `data-testid` attributes for testing

### Modifying Database Schema

1. Edit `shared/schema.ts`
2. Run `npm run db:push`
3. Update TypeScript types if needed
4. Update API routes and components

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3000 npm run dev
```

### Database Connection Issues

1. **Check Docker is running**:
   ```bash
   docker info
   ```

2. **Check container is running**:
   ```bash
   docker ps | grep kanban-postgres
   ```

3. **Check database logs**:
   ```bash
   docker logs kanban-postgres
   ```

4. **Verify connection string**:
   ```bash
   echo $DATABASE_URL
   # Should be: postgresql://kanban:kanban@localhost:5432/kanban
   ```

### Build Errors

1. **Clear node_modules and reinstall**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Clear build cache**:
   ```bash
   rm -rf dist
   npm run build
   ```

### TypeScript Errors

1. **Check TypeScript version**:
   ```bash
   npx tsc --version
   ```

2. **Run type check**:
   ```bash
   npm run check
   ```

3. **Restart TypeScript server** (in IDE)

### Vite HMR Not Working

1. Check Vite dev server is running
2. Clear browser cache
3. Restart dev server
4. Check browser console for errors

### React Query Cache Issues

Clear cache by invalidating queries:

```typescript
queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
```

Or reset entire cache:

```typescript
queryClient.reset();
```

## Performance Considerations

### React Query Configuration

Default configuration optimizes for this app:

```44:57:client/src/lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
```

- `staleTime: Infinity`: Data never considered stale
- `refetchOnWindowFocus: false`: No refetch on focus
- `retry: false`: No automatic retries

### Database Queries

- Use Drizzle ORM for type-safe queries
- Queries are simple and efficient
- Consider indexing if performance becomes an issue

### Bundle Size

- Production build uses esbuild for minification
- External dependencies not bundled (reduces bundle size)
- Tree-shaking enabled in Vite

## LAN Access Configuration

For accessing the app from other devices on your local network, see [README-LAN-SETUP.md](README-LAN-SETUP.md).

Key points:
- Server binds to `0.0.0.0` (all interfaces)
- Default port: 5000
- Access from other devices: `http://YOUR_LAN_IP:5000`

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System architecture overview
- [Component Index](COMPONENT_INDEX.md) - Component documentation
- [API Reference](API_REFERENCE.md) - REST API endpoints
- [Data Flow](DATA_FLOW.md) - Data flow and state management
- [README-SETUP.md](README-SETUP.md) - Detailed setup instructions
- [README-LAN-SETUP.md](README-LAN-SETUP.md) - LAN configuration guide
