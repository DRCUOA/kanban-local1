# API Reference

Complete reference for all REST API endpoints in the Kanban application.

## Base URL

- Development: `http://localhost:5000` (or configured `PORT`)
- Production: Same as development (single server)

## Authentication

Currently, no authentication is required. All endpoints are publicly accessible.

## Response Format

All responses are JSON. Error responses follow this format:

```json
{
  "message": "Error description"
}
```

## Task Endpoints

### List Tasks

Retrieve all tasks.

**Endpoint**: `GET /api/tasks`

**Request**: No body

**Response**: `200 OK`

```json
[
  {
    "id": 1,
    "title": "Research competitors",
    "description": "Look at Trello, Jira, Asana",
    "stageId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Schema**: Array of `Task` objects

**Implementation**:
```46:49:server/routes.ts
  app.get(api.tasks.list.path, async (_req, res) => {
    const allTasks = await storage.getTasks();
    res.json(allTasks);
  });
```

**Route Definition**:
```6:12:shared/routes.ts
    list: {
      method: "GET" as const,
      path: "/api/tasks",
      responses: {
        200: z.array(z.custom<typeof tasks.$inferSelect>()),
      },
    },
```

---

### Create Task

Create a new task.

**Endpoint**: `POST /api/tasks`

**Request Body**:

```json
{
  "title": "New task",
  "description": "Task description (optional)",
  "stageId": 1
}
```

**Validation**:
- `title`: Required, string
- `description`: Optional, string
- `stageId`: Required, integer (must reference existing stage)

**Response**: `201 Created`

```json
{
  "id": 2,
  "title": "New task",
  "description": "Task description",
  "stageId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Validation error
  ```json
  {
    "message": "Validation error message"
  }
  ```
- `500 Internal Server Error`: Server error

**Implementation**:
```51:63:server/routes.ts
  app.post(api.tasks.create.path, async (req, res) => {
    try {
      const taskData = api.tasks.create.input.parse(req.body);
      const task = await storage.createTask(taskData);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });
```

**Route Definition**:
```13:21:shared/routes.ts
    create: {
      method: "POST" as const,
      path: "/api/tasks",
      input: insertTaskSchema,
      responses: {
        201: z.custom<typeof tasks.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
```

**Input Schema**:
```37:40:shared/schema.ts
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});
```

---

### Update Task

Update an existing task.

**Endpoint**: `PATCH /api/tasks/:id`

**URL Parameters**:
- `id`: Task ID (integer)

**Request Body** (all fields optional):

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "stageId": 2
}
```

**Response**: `200 OK`

```json
{
  "id": 1,
  "title": "Updated title",
  "description": "Updated description",
  "stageId": 2,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid ID or validation error
- `404 Not Found`: Task not found
- `500 Internal Server Error`: Server error

**Implementation**:
```65:84:server/routes.ts
  app.patch(api.tasks.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const updates = api.tasks.update.input.parse(req.body);
      const updatedTask = await storage.updateTask(id, updates);
      if (!updatedTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(updatedTask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });
```

**Route Definition**:
```22:30:shared/routes.ts
    update: {
      method: "PATCH" as const,
      path: "/api/tasks/:id",
      input: insertTaskSchema.partial(),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
```

---

### Delete Task

Delete a task.

**Endpoint**: `DELETE /api/tasks/:id`

**URL Parameters**:
- `id`: Task ID (integer)

**Request**: No body

**Response**: `204 No Content`

**Error Responses**:
- `400 Bad Request`: Invalid ID

**Implementation**:
```86:93:server/routes.ts
  app.delete(api.tasks.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    await storage.deleteTask(id);
    res.status(204).send();
  });
```

**Route Definition**:
```31:38:shared/routes.ts
    delete: {
      method: "DELETE" as const,
      path: "/api/tasks/:id",
      responses: {
        204: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
```

---

## Stage Endpoints

### List Stages

Retrieve all stages ordered by `order` field.

**Endpoint**: `GET /api/stages`

**Request**: No body

**Response**: `200 OK`

```json
[
  {
    "id": 1,
    "name": "Backlog",
    "order": 1,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "name": "In Progress",
    "order": 2,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Schema**: Array of `Stage` objects, sorted by `order`

**Implementation**:
```96:99:server/routes.ts
  app.get(api.stages.list.path, async (_req, res) => {
    const allStages = await storage.getStages();
    res.json(allStages);
  });
```

**Route Definition**:
```40:47:shared/routes.ts
    list: {
      method: "GET" as const,
      path: "/api/stages",
      responses: {
        200: z.array(z.custom<typeof stages.$inferSelect>()),
      },
    },
```

---

### Create Stage

Create a new stage.

**Endpoint**: `POST /api/stages`

**Request Body**:

```json
{
  "name": "Review",
  "order": 3
}
```

**Validation**:
- `name`: Required, string
- `order`: Required, integer

**Response**: `201 Created`

```json
{
  "id": 4,
  "name": "Review",
  "order": 3,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Validation error
- `500 Internal Server Error`: Server error

**Implementation**:
```101:113:server/routes.ts
  app.post(api.stages.create.path, async (req, res) => {
    try {
      const stageData = api.stages.create.input.parse(req.body);
      const stage = await storage.createStage(stageData);
      res.status(201).json(stage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });
```

**Route Definition**:
```48:56:shared/routes.ts
    create: {
      method: "POST" as const,
      path: "/api/stages",
      input: insertStageSchema,
      responses: {
        201: z.custom<typeof stages.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
```

**Input Schema**:
```32:35:shared/schema.ts
export const insertStageSchema = createInsertSchema(stages).omit({
  id: true,
  createdAt: true,
});
```

---

### Update Stage

Update an existing stage.

**Endpoint**: `PATCH /api/stages/:id`

**URL Parameters**:
- `id`: Stage ID (integer)

**Request Body** (all fields optional):

```json
{
  "name": "Updated name",
  "order": 4
}
```

**Response**: `200 OK`

```json
{
  "id": 1,
  "name": "Updated name",
  "order": 4,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid ID or validation error
- `404 Not Found`: Stage not found
- `500 Internal Server Error`: Server error

**Implementation**:
```115:134:server/routes.ts
  app.patch(api.stages.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const updates = api.stages.update.input.parse(req.body);
      const updatedStage = await storage.updateStage(id, updates);
      if (!updatedStage) {
        return res.status(404).json({ message: "Stage not found" });
      }
      res.json(updatedStage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });
```

**Route Definition**:
```57:65:shared/routes.ts
    update: {
      method: "PATCH" as const,
      path: "/api/stages/:id",
      input: insertStageSchema.partial(),
      responses: {
        200: z.custom<typeof stages.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
```

---

### Delete Stage

Delete a stage.

**Endpoint**: `DELETE /api/stages/:id`

**URL Parameters**:
- `id`: Stage ID (integer)

**Request**: No body

**Response**: `204 No Content`

**Error Responses**:
- `400 Bad Request`: Invalid ID

**Note**: Deleting a stage does not automatically delete associated tasks. Tasks with references to deleted stages may cause issues.

**Implementation**:
```136:143:server/routes.ts
  app.delete(api.stages.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    await storage.deleteStage(id);
    res.status(204).send();
  });
```

**Route Definition**:
```66:74:shared/routes.ts
    delete: {
      method: "DELETE" as const,
      path: "/api/stages/:id",
      responses: {
        204: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
```

---

## Data Types

### Task

```typescript
{
  id: number;
  title: string;
  description: string | null;
  stageId: number;
  createdAt: Date | string;
}
```

**Schema Definition**:
```13:19:shared/schema.ts
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  stageId: integer("stage_id").notNull().references(() => stages.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Stage

```typescript
{
  id: number;
  name: string;
  order: number;
  createdAt: Date | string;
}
```

**Schema Definition**:
```6:11:shared/schema.ts
export const stages = pgTable("stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

## Error Handling

All endpoints use consistent error handling:

1. **Validation Errors** (400): Zod schema validation failures
   - Returns first validation error message
   - Format: `{ "message": "Error description" }`

2. **Not Found** (404): Resource doesn't exist
   - Format: `{ "message": "Resource not found" }`

3. **Server Errors** (500): Unexpected server errors
   - Format: `{ "message": "Internal Server Error" }`

4. **Invalid ID** (400): Non-numeric or invalid ID parameter
   - Format: `{ "message": "Invalid ID" }`

## Database Seeding

On server startup, if no stages exist, the system automatically seeds:

- **Backlog** (order: 1)
- **In Progress** (order: 2)
- **Done** (order: 3)

And creates three sample tasks:

```12:42:server/routes.ts
  // Seed data
  const existingStages = await storage.getStages();
  if (existingStages.length === 0) {
    const backlogStage = await storage.createStage({
      name: "Backlog",
      order: 1,
    });
    const inProgressStage = await storage.createStage({
      name: "In Progress",
      order: 2,
    });
    const doneStage = await storage.createStage({
      name: "Done",
      order: 3,
    });

    await storage.createTask({
      title: "Research competitors",
      description: "Look at Trello, Jira, Asana",
      stageId: backlogStage.id,
    });
    await storage.createTask({
      title: "Set up project repo",
      description: "Initialize Git and basic structure",
      stageId: inProgressStage.id,
    });
    await storage.createTask({
      title: "Ideation phase",
      description: "Brainstorm core features",
      stageId: doneStage.id,
    });
    console.log("Seeded database with initial stages and tasks");
  }
```

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System architecture overview
- [Component Index](COMPONENT_INDEX.md) - Component documentation
- [Data Flow](DATA_FLOW.md) - Data flow and state management
