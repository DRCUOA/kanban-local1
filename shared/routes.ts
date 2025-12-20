import { z } from "zod";
import { insertTaskSchema, insertStageSchema, tasks, stages } from "./schema";

export const api = {
  tasks: {
    list: {
      method: "GET" as const,
      path: "/api/tasks",
      responses: {
        200: z.array(z.custom<typeof tasks.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/tasks",
      input: insertTaskSchema,
      responses: {
        201: z.custom<typeof tasks.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/tasks/:id",
      input: insertTaskSchema.partial(),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/tasks/:id",
      responses: {
        204: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
  },
  stages: {
    list: {
      method: "GET" as const,
      path: "/api/stages",
      responses: {
        200: z.array(z.custom<typeof stages.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/stages",
      input: insertStageSchema,
      responses: {
        201: z.custom<typeof stages.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/stages/:id",
      input: insertStageSchema.partial(),
      responses: {
        200: z.custom<typeof stages.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/stages/:id",
      responses: {
        204: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
  },
};
