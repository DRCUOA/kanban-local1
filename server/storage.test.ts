/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion -- MemStorage methods are synchronous but satisfy async IStorage; test assertions use ! after expect().toBeDefined() guards */
import { describe, it, expect, beforeEach } from 'vitest';
import type { IStorage } from './storage';
import type {
  Task,
  Stage,
  SubStage,
  InsertTask,
  InsertStage,
  InsertSubStage,
  TaskHistoryEntry,
  TaskStatus,
} from '@shared/schema';
import {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_RECURRENCE,
  getStatusFromStageName,
} from '@shared/constants';

// ---------------------------------------------------------------------------
// In-memory IStorage implementation for contract testing
// Mirrors the semantics of DatabaseStorage without requiring a database.
// ---------------------------------------------------------------------------

class MemStorage implements IStorage {
  private taskSeq = 0;
  private stageSeq = 0;
  private subStageSeq = 0;
  private taskStore = new Map<number, Task>();
  private stageStore = new Map<number, Stage>();
  private subStageStore = new Map<number, SubStage>();

  async getTasks(): Promise<Task[]> {
    return [...this.taskStore.values()]
      .filter((t: Task) => !t.archived)
      .sort((a: Task, b: Task) => a.id - b.id);
  }

  async getArchivedTasks(): Promise<Task[]> {
    return [...this.taskStore.values()]
      .filter((t: Task) => t.archived)
      .sort((a: Task, b: Task) => a.id - b.id);
  }

  async getTasksByStage(stageId: number): Promise<Task[]> {
    return [...this.taskStore.values()]
      .filter((t: Task) => t.stageId === stageId && !t.archived)
      .sort((a: Task, b: Task) => a.id - b.id);
  }

  async getTaskById(id: number): Promise<Task | undefined> {
    return this.taskStore.get(id);
  }

  async createTask(insert: InsertTask): Promise<Task> {
    let initialStatus: string = insert.status ?? TASK_STATUS.BACKLOG;

    if (!insert.status && insert.stageId) {
      const stage = this.stageStore.get(insert.stageId);
      if (stage) {
        initialStatus = getStatusFromStageName(stage.name);
      }
    }

    const history: TaskHistoryEntry[] = [
      { status: initialStatus as TaskStatus, timestamp: new Date().toISOString() },
    ];

    const now = new Date();
    const task: Task = {
      id: ++this.taskSeq,
      title: insert.title,
      description: insert.description ?? null,
      stageId: insert.stageId,
      archived: insert.archived ?? false,
      status: initialStatus,
      priority: insert.priority ?? TASK_PRIORITY.NORMAL,
      effort: insert.effort ?? null,
      dueDate: insert.dueDate ?? null,
      tags: insert.tags ?? null,
      parentTaskId: insert.parentTaskId ?? null,
      recurrence: insert.recurrence ?? TASK_RECURRENCE.NONE,
      history,
      updatedAt: now,
      createdAt: now,
    };

    this.taskStore.set(task.id, task);
    return task;
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const current = this.taskStore.get(id);
    if (!current) return undefined;

    const statusChanged = updates.status && updates.status !== current.status;
    let history = current.history ?? [];

    if (statusChanged) {
      const entry: TaskHistoryEntry = {
        status: updates.status!,
        timestamp: new Date().toISOString(),
      };
      history = [...history, entry];
    }

    const updated: Task = {
      ...current,
      ...updates,
      updatedAt: new Date(),
      history: history.length > 0 ? history : current.history,
    };

    this.taskStore.set(id, updated);
    return updated;
  }

  async archiveTask(id: number): Promise<Task | undefined> {
    const current = this.taskStore.get(id);
    if (!current) return undefined;

    const history = current.history ?? [];
    const entry: TaskHistoryEntry = {
      status: (current.status ?? TASK_STATUS.BACKLOG) as TaskStatus,
      timestamp: new Date().toISOString(),
      note: 'Archived',
    };

    const archived: Task = {
      ...current,
      archived: true,
      updatedAt: new Date(),
      history: [...history, entry],
    };

    this.taskStore.set(id, archived);
    return archived;
  }

  async unarchiveTask(id: number): Promise<Task | undefined> {
    const current = this.taskStore.get(id);
    if (!current) return undefined;

    const unarchived: Task = {
      ...current,
      archived: false,
      updatedAt: new Date(),
    };

    this.taskStore.set(id, unarchived);
    return unarchived;
  }

  async deleteTask(id: number): Promise<void> {
    this.taskStore.delete(id);
  }

  async getStages(): Promise<Stage[]> {
    return [...this.stageStore.values()].sort((a: Stage, b: Stage) => a.order - b.order);
  }

  async createStage(insert: InsertStage): Promise<Stage> {
    const stage: Stage = {
      id: ++this.stageSeq,
      name: insert.name,
      order: insert.order,
      color: insert.color ?? null,
      createdAt: new Date(),
    };
    this.stageStore.set(stage.id, stage);
    return stage;
  }

  async updateStage(id: number, updates: Partial<InsertStage>): Promise<Stage | undefined> {
    const current = this.stageStore.get(id);
    if (!current) return undefined;

    const updateData: Partial<InsertStage> = { ...updates };
    if ('color' in updates) {
      updateData.color = updates.color ?? null;
    }

    const updated: Stage = { ...current, ...updateData };
    this.stageStore.set(id, updated);
    return updated;
  }

  async deleteStage(id: number): Promise<void> {
    this.stageStore.delete(id);
  }

  async getSubStages(): Promise<SubStage[]> {
    return [...this.subStageStore.values()].sort((a: SubStage, b: SubStage) => a.order - b.order);
  }

  async getSubStagesByStage(stageId: number): Promise<SubStage[]> {
    return [...this.subStageStore.values()]
      .filter((s: SubStage) => s.stageId === stageId)
      .sort((a: SubStage, b: SubStage) => a.order - b.order);
  }

  async createSubStage(insert: InsertSubStage): Promise<SubStage> {
    const subStage: SubStage = {
      id: ++this.subStageSeq,
      stageId: insert.stageId,
      name: insert.name,
      tag: insert.tag,
      bgClass: insert.bgClass,
      opacity: insert.opacity,
      order: insert.order,
      createdAt: new Date(),
    };
    this.subStageStore.set(subStage.id, subStage);
    return subStage;
  }

  async updateSubStage(
    id: number,
    updates: Partial<InsertSubStage>,
  ): Promise<SubStage | undefined> {
    const current = this.subStageStore.get(id);
    if (!current) return undefined;

    const updated: SubStage = { ...current, ...updates };
    this.subStageStore.set(id, updated);
    return updated;
  }

  async deleteSubStage(id: number): Promise<void> {
    this.subStageStore.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStageInput(overrides: Partial<InsertStage> = {}): InsertStage {
  return { name: 'Backlog', order: 0, ...overrides };
}

function makeSubStageInput(
  stageId: number,
  overrides: Partial<InsertSubStage> = {},
): InsertSubStage {
  return {
    stageId,
    name: 'Morning',
    tag: 'morning',
    bgClass: 'bg-blue-500/20',
    opacity: 20,
    order: 0,
    ...overrides,
  };
}

function makeTaskInput(stageId: number, overrides: Partial<InsertTask> = {}): InsertTask {
  return { title: 'Test task', stageId, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IStorage contract', () => {
  let storage: IStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  // ===== Stage CRUD =====

  describe('Stage CRUD', () => {
    it('creates a stage and returns it with an id', async () => {
      const stage = await storage.createStage(makeStageInput({ name: 'Backlog', order: 1 }));

      expect(stage.id).toBeGreaterThan(0);
      expect(stage.name).toBe('Backlog');
      expect(stage.order).toBe(1);
      expect(stage.createdAt).toBeInstanceOf(Date);
    });

    it('preserves color when provided', async () => {
      const stage = await storage.createStage(makeStageInput({ color: '#3B82F6' }));

      expect(stage.color).toBe('#3B82F6');
    });

    it('defaults color to null when not provided', async () => {
      const stage = await storage.createStage(makeStageInput());

      expect(stage.color).toBeNull();
    });

    it('returns stages ordered by order field', async () => {
      await storage.createStage(makeStageInput({ name: 'Done', order: 3 }));
      await storage.createStage(makeStageInput({ name: 'Backlog', order: 1 }));
      await storage.createStage(makeStageInput({ name: 'In Progress', order: 2 }));

      const stages = await storage.getStages();

      expect(stages.map((s) => s.name)).toEqual(['Backlog', 'In Progress', 'Done']);
    });

    it('updates a stage and returns the updated record', async () => {
      const stage = await storage.createStage(makeStageInput({ name: 'Draft', order: 0 }));

      const updated = await storage.updateStage(stage.id, { name: 'Final' });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Final');
      expect(updated!.order).toBe(0);
    });

    it('returns undefined when updating a non-existent stage', async () => {
      const result = await storage.updateStage(999, { name: 'Nope' });

      expect(result).toBeUndefined();
    });

    it('deletes a stage', async () => {
      const stage = await storage.createStage(makeStageInput());
      await storage.deleteStage(stage.id);

      const stages = await storage.getStages();
      expect(stages).toHaveLength(0);
    });

    it('does not throw when deleting a non-existent stage', async () => {
      await expect(storage.deleteStage(999)).resolves.toBeUndefined();
    });
  });

  // ===== SubStage CRUD =====

  describe('SubStage CRUD', () => {
    let parentStageId: number;

    beforeEach(async () => {
      const stage = await storage.createStage(makeStageInput());
      parentStageId = stage.id;
    });

    it('creates a sub-stage and returns it with an id', async () => {
      const sub = await storage.createSubStage(
        makeSubStageInput(parentStageId, { name: 'AM Block', tag: 'am', order: 1 }),
      );

      expect(sub.id).toBeGreaterThan(0);
      expect(sub.stageId).toBe(parentStageId);
      expect(sub.name).toBe('AM Block');
      expect(sub.tag).toBe('am');
      expect(sub.bgClass).toBe('bg-blue-500/20');
      expect(sub.opacity).toBe(20);
      expect(sub.createdAt).toBeInstanceOf(Date);
    });

    it('returns all sub-stages ordered by order', async () => {
      await storage.createSubStage(makeSubStageInput(parentStageId, { name: 'C', order: 3 }));
      await storage.createSubStage(makeSubStageInput(parentStageId, { name: 'A', order: 1 }));
      await storage.createSubStage(makeSubStageInput(parentStageId, { name: 'B', order: 2 }));

      const subs = await storage.getSubStages();

      expect(subs.map((s) => s.name)).toEqual(['A', 'B', 'C']);
    });

    it('filters sub-stages by stageId', async () => {
      const stage2 = await storage.createStage(makeStageInput({ name: 'Other', order: 2 }));
      await storage.createSubStage(makeSubStageInput(parentStageId, { name: 'S1-sub', order: 0 }));
      await storage.createSubStage(makeSubStageInput(stage2.id, { name: 'S2-sub', order: 0 }));

      const s1Subs = await storage.getSubStagesByStage(parentStageId);

      expect(s1Subs).toHaveLength(1);
      expect(s1Subs[0].name).toBe('S1-sub');
    });

    it('returns an empty array for a stageId with no sub-stages', async () => {
      const subs = await storage.getSubStagesByStage(999);

      expect(subs).toEqual([]);
    });

    it('updates a sub-stage and returns the updated record', async () => {
      const sub = await storage.createSubStage(makeSubStageInput(parentStageId));

      const updated = await storage.updateSubStage(sub.id, { name: 'Afternoon', opacity: 50 });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Afternoon');
      expect(updated!.opacity).toBe(50);
    });

    it('returns undefined when updating a non-existent sub-stage', async () => {
      const result = await storage.updateSubStage(999, { name: 'Nope' });

      expect(result).toBeUndefined();
    });

    it('deletes a sub-stage', async () => {
      const sub = await storage.createSubStage(makeSubStageInput(parentStageId));
      await storage.deleteSubStage(sub.id);

      const subs = await storage.getSubStages();
      expect(subs).toHaveLength(0);
    });

    it('does not throw when deleting a non-existent sub-stage', async () => {
      await expect(storage.deleteSubStage(999)).resolves.toBeUndefined();
    });
  });

  // ===== Task CRUD =====

  describe('Task CRUD', () => {
    let stageId: number;

    beforeEach(async () => {
      const stage = await storage.createStage(makeStageInput({ name: 'Backlog', order: 0 }));
      stageId = stage.id;
    });

    it('creates a task and returns it with an id and timestamps', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      expect(task.id).toBeGreaterThan(0);
      expect(task.title).toBe('Test task');
      expect(task.stageId).toBe(stageId);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults priority to normal and recurrence to none', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      expect(task.priority).toBe(TASK_PRIORITY.NORMAL);
      expect(task.recurrence).toBe(TASK_RECURRENCE.NONE);
    });

    it('respects explicit priority and recurrence', async () => {
      const task = await storage.createTask(
        makeTaskInput(stageId, {
          priority: TASK_PRIORITY.HIGH,
          recurrence: TASK_RECURRENCE.WEEKLY,
        }),
      );

      expect(task.priority).toBe(TASK_PRIORITY.HIGH);
      expect(task.recurrence).toBe(TASK_RECURRENCE.WEEKLY);
    });

    it('defaults archived to false', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      expect(task.archived).toBe(false);
    });

    it('initializes history with the initial status', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      expect(task.history).toHaveLength(1);
      expect(task.history![0].status).toBe(TASK_STATUS.BACKLOG);
      expect(task.history![0].timestamp).toBeTruthy();
    });

    it('infers status from stage name when not explicitly set', async () => {
      const doneStage = await storage.createStage(makeStageInput({ name: 'Done', order: 2 }));
      const task = await storage.createTask(makeTaskInput(doneStage.id));

      expect(task.status).toBe(TASK_STATUS.DONE);
      expect(task.history![0].status).toBe(TASK_STATUS.DONE);
    });

    it('uses explicit status over inferred stage status', async () => {
      const doneStage = await storage.createStage(makeStageInput({ name: 'Done', order: 2 }));
      const task = await storage.createTask(
        makeTaskInput(doneStage.id, { status: TASK_STATUS.IN_PROGRESS }),
      );

      expect(task.status).toBe(TASK_STATUS.IN_PROGRESS);
    });

    it('returns non-archived tasks from getTasks()', async () => {
      await storage.createTask(makeTaskInput(stageId, { title: 'Active' }));
      const archived = await storage.createTask(makeTaskInput(stageId, { title: 'Old' }));
      await storage.archiveTask(archived.id);

      const tasks = await storage.getTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Active');
    });

    it('returns archived tasks from getArchivedTasks()', async () => {
      await storage.createTask(makeTaskInput(stageId, { title: 'Active' }));
      const toArchive = await storage.createTask(makeTaskInput(stageId, { title: 'Old' }));
      await storage.archiveTask(toArchive.id);

      const archived = await storage.getArchivedTasks();

      expect(archived).toHaveLength(1);
      expect(archived[0].title).toBe('Old');
    });

    it('returns tasks ordered by id', async () => {
      await storage.createTask(makeTaskInput(stageId, { title: 'First' }));
      await storage.createTask(makeTaskInput(stageId, { title: 'Second' }));

      const tasks = await storage.getTasks();

      expect(tasks[0].title).toBe('First');
      expect(tasks[1].title).toBe('Second');
    });

    it('filters tasks by stageId', async () => {
      const stage2 = await storage.createStage(makeStageInput({ name: 'In Progress', order: 1 }));
      await storage.createTask(makeTaskInput(stageId, { title: 'S1' }));
      await storage.createTask(makeTaskInput(stage2.id, { title: 'S2' }));

      const s1Tasks = await storage.getTasksByStage(stageId);

      expect(s1Tasks).toHaveLength(1);
      expect(s1Tasks[0].title).toBe('S1');
    });

    it('getTasksByStage excludes archived tasks', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));
      await storage.archiveTask(task.id);

      const tasks = await storage.getTasksByStage(stageId);

      expect(tasks).toHaveLength(0);
    });

    it('returns a task by id', async () => {
      const created = await storage.createTask(makeTaskInput(stageId));

      const found = await storage.getTaskById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('returns undefined for a non-existent task id', async () => {
      const result = await storage.getTaskById(999);

      expect(result).toBeUndefined();
    });
  });

  // ===== Task Update =====

  describe('Task update', () => {
    let stageId: number;

    beforeEach(async () => {
      const stage = await storage.createStage(makeStageInput({ name: 'Backlog', order: 0 }));
      stageId = stage.id;
    });

    it('updates fields and returns the updated task', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      const updated = await storage.updateTask(task.id, { title: 'Renamed' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Renamed');
    });

    it('preserves fields not included in the update', async () => {
      const task = await storage.createTask(
        makeTaskInput(stageId, { title: 'Original', priority: TASK_PRIORITY.HIGH }),
      );

      const updated = await storage.updateTask(task.id, { title: 'Changed' });

      expect(updated!.priority).toBe(TASK_PRIORITY.HIGH);
    });

    it('records status change in history', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));
      expect(task.history).toHaveLength(1);

      const updated = await storage.updateTask(task.id, { status: TASK_STATUS.IN_PROGRESS });

      expect(updated!.history).toHaveLength(2);
      expect(updated!.history![1].status).toBe(TASK_STATUS.IN_PROGRESS);
    });

    it('does not append history when status is unchanged', async () => {
      const task = await storage.createTask(
        makeTaskInput(stageId, { status: TASK_STATUS.BACKLOG }),
      );

      const updated = await storage.updateTask(task.id, { status: TASK_STATUS.BACKLOG });

      expect(updated!.history).toHaveLength(1);
    });

    it('updates updatedAt on every update', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));
      const originalUpdatedAt = task.updatedAt;

      // Small delay so timestamps differ
      await new Promise((r) => setTimeout(r, 5));
      const updated = await storage.updateTask(task.id, { title: 'Later' });

      expect(updated!.updatedAt!.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt!.getTime());
    });

    it('returns undefined when updating a non-existent task', async () => {
      const result = await storage.updateTask(999, { title: 'Nope' });

      expect(result).toBeUndefined();
    });
  });

  // ===== Task Archive / Unarchive =====

  describe('Task archive and unarchive', () => {
    let stageId: number;

    beforeEach(async () => {
      const stage = await storage.createStage(makeStageInput({ name: 'Backlog', order: 0 }));
      stageId = stage.id;
    });

    it('archives a task and sets archived flag', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      const archived = await storage.archiveTask(task.id);

      expect(archived).toBeDefined();
      expect(archived!.archived).toBe(true);
    });

    it('adds an "Archived" history entry on archive', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      const archived = await storage.archiveTask(task.id);

      const lastEntry = archived!.history![archived!.history!.length - 1];
      expect(lastEntry.note).toBe('Archived');
    });

    it('returns undefined when archiving a non-existent task', async () => {
      const result = await storage.archiveTask(999);

      expect(result).toBeUndefined();
    });

    it('unarchives a task and clears archived flag', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));
      await storage.archiveTask(task.id);

      const unarchived = await storage.unarchiveTask(task.id);

      expect(unarchived).toBeDefined();
      expect(unarchived!.archived).toBe(false);
    });

    it('returns undefined when unarchiving a non-existent task', async () => {
      const result = await storage.unarchiveTask(999);

      expect(result).toBeUndefined();
    });
  });

  // ===== Task Delete =====

  describe('Task delete', () => {
    let stageId: number;

    beforeEach(async () => {
      const stage = await storage.createStage(makeStageInput({ name: 'Backlog', order: 0 }));
      stageId = stage.id;
    });

    it('removes the task so it is no longer retrievable', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));
      await storage.deleteTask(task.id);

      const found = await storage.getTaskById(task.id);
      expect(found).toBeUndefined();

      const tasks = await storage.getTasks();
      expect(tasks).toHaveLength(0);
    });

    it('does not throw when deleting a non-existent task', async () => {
      await expect(storage.deleteTask(999)).resolves.toBeUndefined();
    });
  });

  // ===== Cross-entity queries =====

  describe('Cross-entity queries', () => {
    it('getTasksByStage returns empty for a stageId with no tasks', async () => {
      const stage = await storage.createStage(makeStageInput());

      const tasks = await storage.getTasksByStage(stage.id);

      expect(tasks).toEqual([]);
    });

    it('getTasksByStage returns empty for a non-existent stageId', async () => {
      const tasks = await storage.getTasksByStage(999);

      expect(tasks).toEqual([]);
    });

    it('getTasks returns empty when no tasks exist', async () => {
      const tasks = await storage.getTasks();

      expect(tasks).toEqual([]);
    });

    it('getArchivedTasks returns empty when no archived tasks exist', async () => {
      const stage = await storage.createStage(makeStageInput());
      await storage.createTask(makeTaskInput(stage.id));

      const archived = await storage.getArchivedTasks();

      expect(archived).toEqual([]);
    });
  });

  // ===== Task optional fields =====

  describe('Task optional fields', () => {
    let stageId: number;

    beforeEach(async () => {
      const stage = await storage.createStage(makeStageInput());
      stageId = stage.id;
    });

    it('stores and retrieves description', async () => {
      const task = await storage.createTask(
        makeTaskInput(stageId, { description: 'A detailed description' }),
      );

      expect(task.description).toBe('A detailed description');
    });

    it('defaults description to null', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      expect(task.description).toBeNull();
    });

    it('stores and retrieves effort', async () => {
      const task = await storage.createTask(makeTaskInput(stageId, { effort: 3 }));

      expect(task.effort).toBe(3);
    });

    it('stores and retrieves tags', async () => {
      const task = await storage.createTask(makeTaskInput(stageId, { tags: ['bug', 'urgent'] }));

      expect(task.tags).toEqual(['bug', 'urgent']);
    });

    it('stores and retrieves dueDate', async () => {
      const due = new Date('2026-06-01');
      const task = await storage.createTask(makeTaskInput(stageId, { dueDate: due }));

      expect(task.dueDate).toEqual(due);
    });

    it('stores and retrieves parentTaskId', async () => {
      const parent = await storage.createTask(makeTaskInput(stageId, { title: 'Parent' }));
      const child = await storage.createTask(
        makeTaskInput(stageId, { title: 'Child', parentTaskId: parent.id }),
      );

      expect(child.parentTaskId).toBe(parent.id);
    });
  });
});
