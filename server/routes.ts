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

  // Task endpoints
  app.get(api.tasks.list.path, async (_req, res) => {
    const allTasks = await storage.getTasks();
    res.json(allTasks);
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

  // Stage endpoints
  app.get(api.stages.list.path, async (_req, res) => {
    const allStages = await storage.getStages();
    res.json(allStages);
  });

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

  app.delete(api.stages.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    await storage.deleteStage(id);
    res.status(204).send();
  });

  // Task history endpoint
  app.get(api.tasks.history.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    const task = await storage.getTaskById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(task.history || []);
  });

  // Sub-stage endpoints
  app.get(api.subStages.list.path, async (_req, res) => {
    const allSubStages = await storage.getSubStages();
    res.json(allSubStages);
  });

  app.get(api.subStages.listByStage.path, async (req, res) => {
    const stageId = parseInt(req.params.stageId);
    if (isNaN(stageId)) {
      return res.status(400).json({ message: "Invalid stage ID" });
    }
    const subStages = await storage.getSubStagesByStage(stageId);
    res.json(subStages);
  });

  app.post(api.subStages.create.path, async (req, res) => {
    try {
      const validated = api.subStages.create.input.parse(req.body);
      const subStage = await storage.createSubStage(validated);
      res.status(201).json(subStage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.patch(api.subStages.update.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    try {
      const validated = api.subStages.update.input.parse(req.body);
      const subStage = await storage.updateSubStage(id, validated);
      if (!subStage) {
        return res.status(404).json({ message: "Sub-stage not found" });
      }
      res.json(subStage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.delete(api.subStages.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    await storage.deleteSubStage(id);
    res.status(204).send();
  });

  return httpServer;
}
