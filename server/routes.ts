import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed data
  const existingTasks = await storage.getTasks();
  if (existingTasks.length === 0) {
    await storage.createTask({
      title: "Research competitors",
      description: "Look at Trello, Jira, Asana",
      status: "backlog",
    });
    await storage.createTask({
      title: "Set up project repo",
      description: "Initialize Git and basic structure",
      status: "in-progress",
    });
    await storage.createTask({
      title: "Ideation phase",
      description: "Brainstorm core features",
      status: "done",
    });
    console.log("Seeded database with initial tasks");
  }

  app.get(api.tasks.list.path, async (_req, res) => {
    const tasks = await storage.getTasks();
    res.json(tasks);
  });

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

  app.delete(api.tasks.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    await storage.deleteTask(id);
    res.status(204).send();
  });

  return httpServer;
}
