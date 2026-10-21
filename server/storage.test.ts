/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion -- MemStorage methods are synchronous but satisfy async IStorage; test assertions use ! after expect().toBeDefined() guards */
import { describe, it, expect, beforeEach } from 'vitest';
import type { IStorage } from './storage';
import type {
  Task,
  Stage,
  SubStage,
  Project,
  Owner,
  InsertTask,
  InsertStage,
  InsertSubStage,
  InsertProject,
  InsertOwner,
  TaskHistoryEntry,
  StageKind,
  TaskAttachment,
  TaskAttachmentRow,
  InsertAttachment,
} from '@shared/schema';
import type { TaskProjectFilter } from '@shared/project-scope';
import { STAGE_KIND, DEFAULT_STAGE_KIND, TASK_PRIORITY, TASK_RECURRENCE } from '@shared/constants';
import { stageKind } from '@shared/stage-state';

// ---------------------------------------------------------------------------
// In-memory IStorage implementation for contract testing
// Mirrors the semantics of DatabaseStorage without requiring a database.
// ---------------------------------------------------------------------------

function matchesProjectFilter(task: Task, filter: TaskProjectFilter | undefined): boolean {
  if (filter?.projectId === undefined) return true;
  return task.projectId === filter.projectId;
}

class MemStorage implements IStorage {
  private taskSeq = 0;
  private stageSeq = 0;
  private subStageSeq = 0;
  private projectSeq = 0;
  private ownerSeq = 0;
  private taskStore = new Map<number, Task>();
  private stageStore = new Map<number, Stage>();
  private subStageStore = new Map<number, SubStage>();
  private projectStore = new Map<number, Project>();
  private ownerStore = new Map<number, Owner>();
  private attachmentSeq = 0;
  private attachmentStore = new Map<number, TaskAttachmentRow>();

  async getTasks(filter?: TaskProjectFilter): Promise<Task[]> {
    return [...this.taskStore.values()]
      .filter((t: Task) => !t.archived && t.deletedAt === null && matchesProjectFilter(t, filter))
      .sort((a: Task, b: Task) => a.id - b.id);
  }

  async getArchivedTasks(filter?: TaskProjectFilter): Promise<Task[]> {
    return [...this.taskStore.values()]
      .filter((t: Task) => t.archived && matchesProjectFilter(t, filter))
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

  /** The kind of a stage, as the real storage layer reads it. */
  private kindOfStage(stageId: number | null | undefined): StageKind {
    if (stageId == null) return DEFAULT_STAGE_KIND;
    return stageKind(this.stageStore.get(stageId));
  }

  async getTaskDependencies(): Promise<never[]> {
    return [];
  }

  async setTaskDependencies(): Promise<void> {
    await Promise.resolve();
  }

  async applyGoalPlan(): Promise<{ created: Record<string, number> }> {
    return Promise.resolve({ created: {} });
  }

  async bulkUpdateTasks(): Promise<number> {
    return Promise.resolve(0);
  }

  async clearTaskDependencySides(): Promise<void> {
    await Promise.resolve();
  }

  async createTask(insert: InsertTask): Promise<Task> {
    const initialKind = this.kindOfStage(insert.stageId);

    const history: TaskHistoryEntry[] = [
      { status: initialKind, timestamp: new Date().toISOString() },
    ];

    const now = new Date();
    const task: Task = {
      id: ++this.taskSeq,
      title: insert.title,
      description: insert.description ?? null,
      stageId: insert.stageId,
      projectId: insert.projectId ?? null,
      archived: insert.archived ?? false,
      priority: insert.priority ?? TASK_PRIORITY.NORMAL,
      type: insert.type ?? null,
      goalTaskId: insert.goalTaskId ?? null,
      effort: insert.effort ?? null,
      dueDate: insert.dueDate ?? null,
      tags: insert.tags ?? null,
      parentTaskId: insert.parentTaskId ?? null,
      recurrence: insert.recurrence ?? TASK_RECURRENCE.NONE,
      history,
      updatedAt: now,
      createdAt: now,
      ownerId: insert.ownerId ?? null,
      // The real schema keeps `owner` in step with the owner's name through a
      // trigger; mirror that here so the double behaves like the database.
      owner: this.ownerNameFor(insert.ownerId ?? null),
      deletedAt: null,
      viewedAt: now,
    };

    this.taskStore.set(task.id, task);
    return task;
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const current = this.taskStore.get(id);
    if (!current) return undefined;

    // A move to another column is the state change, as in the real layer.
    const movedStage = updates.stageId !== undefined && updates.stageId !== current.stageId;
    let history = current.history ?? [];

    if (movedStage) {
      const entry: TaskHistoryEntry = {
        status: this.kindOfStage(updates.stageId),
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
      status: this.kindOfStage(current.stageId),
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

  async markTaskViewed(id: number): Promise<Task | undefined> {
    const current = this.taskStore.get(id);
    if (!current) return undefined;

    const viewed: Task = { ...current, viewedAt: current.viewedAt ?? new Date() };
    this.taskStore.set(id, viewed);
    return viewed;
  }

  async getDeletedTasks(): Promise<Task[]> {
    return [...this.taskStore.values()].filter((t) => t.deletedAt !== null);
  }

  async binTask(id: number): Promise<Task | undefined> {
    const current = this.taskStore.get(id);
    if (!current) return undefined;

    const binned: Task = { ...current, deletedAt: new Date(), updatedAt: new Date() };
    this.taskStore.set(id, binned);
    return binned;
  }

  async restoreTask(id: number): Promise<Task | undefined> {
    const current = this.taskStore.get(id);
    if (!current) return undefined;

    const restored: Task = { ...current, deletedAt: null, updatedAt: new Date() };
    this.taskStore.set(id, restored);
    return restored;
  }

  async deleteTask(id: number): Promise<void> {
    this.taskStore.delete(id);
  }

  private ownerNameFor(id: number | null): string | null {
    return id === null ? null : (this.ownerStore.get(id)?.name ?? null);
  }

  async getDistinctOwners(): Promise<string[]> {
    const owners = await this.getOwners();
    return owners.map((owner) => owner.name);
  }

  async getOwners(): Promise<Owner[]> {
    return [...this.ownerStore.values()].sort(
      (a, b) =>
        Number(a.archived) - Number(b.archived) ||
        a.order - b.order ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  async getOwnerById(id: number): Promise<Owner | undefined> {
    return this.ownerStore.get(id);
  }

  async createOwner(insert: InsertOwner): Promise<Owner> {
    const owner: Owner = {
      id: ++this.ownerSeq,
      name: insert.name,
      key: insert.key ?? null,
      color: insert.color ?? null,
      archived: insert.archived ?? false,
      order: insert.order ?? 0,
      createdAt: new Date(),
    };
    this.ownerStore.set(owner.id, owner);
    return owner;
  }

  async updateOwner(id: number, updates: Partial<InsertOwner>): Promise<Owner | undefined> {
    const current = this.ownerStore.get(id);
    if (!current) return undefined;
    const updated: Owner = {
      ...current,
      name: updates.name ?? current.name,
      key: updates.key === undefined ? current.key : updates.key,
      color: updates.color === undefined ? current.color : updates.color,
      archived: updates.archived ?? current.archived,
      order: updates.order ?? current.order,
    };
    this.ownerStore.set(id, updated);
    // A rename reaches every task through the mirror, as the trigger does.
    if (updated.name !== current.name) {
      for (const task of this.taskStore.values()) {
        if (task.ownerId === id) {
          this.taskStore.set(task.id, { ...task, owner: updated.name });
        }
      }
    }
    return updated;
  }

  async deleteOwner(id: number): Promise<boolean> {
    if (!this.ownerStore.has(id)) return false;
    for (const task of this.taskStore.values()) {
      if (task.ownerId === id) {
        this.taskStore.set(task.id, { ...task, ownerId: null, owner: null });
      }
    }
    for (const lane of this.subStageStore.values()) {
      if (lane.ownerId === id) {
        this.subStageStore.set(lane.id, { ...lane, ownerId: null });
      }
    }
    this.ownerStore.delete(id);
    return true;
  }

  async getOwnerTaskCounts(): Promise<Record<number, number>> {
    const counts: Record<number, number> = {};
    for (const task of this.taskStore.values()) {
      if (task.ownerId == null || task.archived || task.deletedAt !== null) continue;
      counts[task.ownerId] = (counts[task.ownerId] ?? 0) + 1;
    }
    return counts;
  }

  async getStages(): Promise<Stage[]> {
    return [...this.stageStore.values()].sort((a: Stage, b: Stage) => a.order - b.order);
  }

  async createStage(insert: InsertStage): Promise<Stage> {
    const stage: Stage = {
      id: ++this.stageSeq,
      name: insert.name,
      order: insert.order,
      // Defaulted in the database, never inferred from `name`.
      kind: insert.kind ?? DEFAULT_STAGE_KIND,
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
      // A lane bound to an owner is that owner's lane (EPIC-06).
      ownerId: insert.ownerId ?? null,
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

  async getProjects(): Promise<Project[]> {
    return [...this.projectStore.values()].sort(
      (a, b) =>
        Number(a.archived) - Number(b.archived) ||
        a.order - b.order ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  async getProjectById(id: number): Promise<Project | undefined> {
    return this.projectStore.get(id);
  }

  async createProject(insert: InsertProject): Promise<Project> {
    const project: Project = {
      id: ++this.projectSeq,
      name: insert.name,
      key: insert.key ?? null,
      color: insert.color ?? null,
      archived: insert.archived ?? false,
      order: insert.order ?? 0,
      createdAt: new Date(),
    };
    this.projectStore.set(project.id, project);
    return project;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const current = this.projectStore.get(id);
    if (!current) return undefined;
    const updated: Project = { ...current };
    if (updates.name !== undefined) updated.name = updates.name;
    if (updates.key !== undefined) updated.key = updates.key;
    if (updates.color !== undefined) updated.color = updates.color;
    if (updates.archived !== undefined) updated.archived = updates.archived;
    if (updates.order !== undefined) updated.order = updates.order;
    this.projectStore.set(id, updated);
    return updated;
  }

  async deleteProject(id: number): Promise<boolean> {
    if (!this.projectStore.has(id)) return false;
    for (const [taskId, task] of this.taskStore) {
      if (task.projectId === id) this.taskStore.set(taskId, { ...task, projectId: null });
    }
    this.projectStore.delete(id);
    return true;
  }

  async getProjectTaskCounts(): Promise<Record<number, number>> {
    const counts: Record<number, number> = {};
    for (const task of this.taskStore.values()) {
      if (task.projectId === null || task.archived || task.deletedAt !== null) continue;
      counts[task.projectId] = (counts[task.projectId] ?? 0) + 1;
    }
    return counts;
  }

  // ===== Attachments =====

  private attachmentMeta(row: TaskAttachmentRow): TaskAttachment {
    return {
      id: row.id,
      taskId: row.taskId,
      filename: row.filename,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      createdAt: row.createdAt,
    };
  }

  async createAttachment(attachment: InsertAttachment): Promise<TaskAttachment> {
    const row: TaskAttachmentRow = {
      id: ++this.attachmentSeq,
      taskId: attachment.taskId,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      byteSize: attachment.data.length,
      data: attachment.data,
      createdAt: new Date(),
    };
    this.attachmentStore.set(row.id, row);
    return this.attachmentMeta(row);
  }

  async getAttachment(id: number): Promise<TaskAttachmentRow | undefined> {
    return this.attachmentStore.get(id);
  }

  async getAttachmentsMeta(ids: number[]): Promise<TaskAttachment[]> {
    return ids.flatMap((id) => {
      const row = this.attachmentStore.get(id);
      return row ? [this.attachmentMeta(row)] : [];
    });
  }

  async getAttachmentsByTasks(
    taskIds: number[],
    { withData = false }: { withData?: boolean } = {},
  ): Promise<(TaskAttachment & { data?: Buffer })[]> {
    const wanted = new Set(taskIds);
    return [...this.attachmentStore.values()]
      .filter((row) => row.taskId !== null && wanted.has(row.taskId))
      .sort((a, b) => a.id - b.id)
      .map((row) => (withData ? { ...row } : this.attachmentMeta(row)));
  }

  async bindAttachments(taskId: number, ids: number[]): Promise<number[]> {
    const bound: number[] = [];
    for (const id of ids) {
      const row = this.attachmentStore.get(id);
      if (row && (row.taskId === null || row.taskId === taskId)) {
        row.taskId = taskId;
        bound.push(id);
      }
    }
    return bound;
  }

  async copyAttachment(id: number): Promise<TaskAttachment | undefined> {
    const row = this.attachmentStore.get(id);
    if (!row) return undefined;
    return this.createAttachment({
      taskId: null,
      filename: row.filename,
      mimeType: row.mimeType,
      data: row.data,
    });
  }

  async releaseAttachments(taskId: number, keepIds: number[]): Promise<void> {
    const keep = new Set(keepIds);
    for (const row of this.attachmentStore.values()) {
      if (row.taskId === taskId && !keep.has(row.id)) row.taskId = null;
    }
  }

  async deleteOrphanAttachments(olderThan: Date): Promise<number> {
    let deleted = 0;
    for (const [id, row] of this.attachmentStore) {
      if (row.taskId === null && row.createdAt < olderThan) {
        this.attachmentStore.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async getTaskIdsWithInlineAttachments(): Promise<number[]> {
    return [...this.taskStore.values()]
      .filter(
        (task) =>
          task.description?.includes('data-file-chip') && task.description.includes('data:'),
      )
      .map((task) => task.id)
      .sort((a, b) => a - b);
  }

  async setTaskDescription(id: number, description: string): Promise<void> {
    const task = this.taskStore.get(id);
    if (task) task.description = description;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStageInput(overrides: Partial<InsertStage> = {}): InsertStage {
  return { name: 'Backlog', order: 0, kind: STAGE_KIND.BACKLOG, ...overrides };
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
    ownerId: null,
    opacity: 20,
    order: 0,
    ...overrides,
  };
}

function makeTaskInput(stageId: number, overrides: Partial<InsertTask> = {}): InsertTask {
  return { title: 'Test task', stageId, ...overrides };
}

function makeProjectInput(overrides: Partial<InsertProject> = {}): InsertProject {
  return { name: 'Alpha', ...overrides };
}

function makeOwnerInput(overrides: Partial<InsertOwner> = {}): InsertOwner {
  return { name: 'Rich', ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IStorage contract', () => {
  let storage: IStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  // ===== Projects =====

  describe('Project CRUD', () => {
    it('creates a project with an id and safe defaults', async () => {
      const project = await storage.createProject(makeProjectInput({ name: 'Alpha' }));

      expect(project.id).toBeGreaterThan(0);
      expect(project.name).toBe('Alpha');
      expect(project.key).toBeNull();
      expect(project.color).toBeNull();
      expect(project.archived).toBe(false);
      expect(project.order).toBe(0);
      expect(project.createdAt).toBeInstanceOf(Date);
    });

    it('keeps the key and colour it is given', async () => {
      const project = await storage.createProject(
        makeProjectInput({ key: 'ALP', color: '#6366F1' }),
      );

      expect(project.key).toBe('ALP');
      expect(project.color).toBe('#6366F1');
    });

    it('lists active projects before archived ones, then by order and name', async () => {
      await storage.createProject(makeProjectInput({ name: 'Zulu', order: 0 }));
      await storage.createProject(makeProjectInput({ name: 'Old', archived: true }));
      await storage.createProject(makeProjectInput({ name: 'Bravo', order: 1 }));
      await storage.createProject(makeProjectInput({ name: 'alpha', order: 0 }));

      const names = (await storage.getProjects()).map((p) => p.name);

      expect(names).toEqual(['alpha', 'Zulu', 'Bravo', 'Old']);
    });

    it('renames, recolours and archives a project in place', async () => {
      const project = await storage.createProject(makeProjectInput());

      const updated = await storage.updateProject(project.id, {
        name: 'Alpha 2',
        color: '#EF4444',
        archived: true,
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Alpha 2');
      expect(updated!.color).toBe('#EF4444');
      expect(updated!.archived).toBe(true);
      expect(await storage.getProjectById(project.id)).toEqual(updated);
    });

    it('returns undefined when updating a missing project', async () => {
      expect(await storage.updateProject(999, { name: 'Ghost' })).toBeUndefined();
    });

    it('deletes a project and releases its tasks instead of taking them with it', async () => {
      const stage = await storage.createStage(makeStageInput());
      const project = await storage.createProject(makeProjectInput());
      const inProject = await storage.createTask(
        makeTaskInput(stage.id, { projectId: project.id }),
      );
      const elsewhere = await storage.createTask(makeTaskInput(stage.id));

      expect(await storage.deleteProject(project.id)).toBe(true);

      expect(await storage.getProjectById(project.id)).toBeUndefined();
      expect((await storage.getTaskById(inProject.id))!.projectId).toBeNull();
      expect((await storage.getTaskById(elsewhere.id))!.projectId).toBeNull();
      expect(await storage.getTasks()).toHaveLength(2);
    });

    it('reports false when deleting a project that does not exist', async () => {
      expect(await storage.deleteProject(999)).toBe(false);
    });

    it('counts only live tasks per project', async () => {
      const stage = await storage.createStage(makeStageInput());
      const alpha = await storage.createProject(makeProjectInput({ name: 'Alpha' }));
      const beta = await storage.createProject(makeProjectInput({ name: 'Beta' }));
      await storage.createTask(makeTaskInput(stage.id, { projectId: alpha.id }));
      await storage.createTask(makeTaskInput(stage.id, { projectId: alpha.id }));
      const archived = await storage.createTask(makeTaskInput(stage.id, { projectId: alpha.id }));
      await storage.archiveTask(archived.id);
      const binned = await storage.createTask(makeTaskInput(stage.id, { projectId: alpha.id }));
      await storage.binTask(binned.id);
      await storage.createTask(makeTaskInput(stage.id));

      const counts = await storage.getProjectTaskCounts();

      expect(counts[alpha.id]).toBe(2);
      expect(counts[beta.id]).toBeUndefined();
    });
  });

  // ===== Owners (EPIC-06) =====

  describe('Owner CRUD', () => {
    it('creates an owner with an id and safe defaults', async () => {
      const owner = await storage.createOwner(makeOwnerInput({ name: 'Rich' }));

      expect(owner.id).toBeGreaterThan(0);
      expect(owner.name).toBe('Rich');
      expect(owner.key).toBeNull();
      expect(owner.color).toBeNull();
      expect(owner.archived).toBe(false);
      expect(owner.order).toBe(0);
      expect(owner.createdAt).toBeInstanceOf(Date);
    });

    it('keeps an owner who has no tasks at all', async () => {
      // The defect EPIC-06 fixes: the list used to be a DISTINCT over tasks,
      // so a person stopped existing when their last task was binned.
      const owner = await storage.createOwner(makeOwnerInput({ name: 'Moi' }));

      expect(await storage.getOwners()).toHaveLength(1);
      expect(await storage.getDistinctOwners()).toEqual(['Moi']);
      expect((await storage.getOwnerTaskCounts())[owner.id]).toBeUndefined();
    });

    it('lists active owners before archived ones, then by order and name', async () => {
      await storage.createOwner(makeOwnerInput({ name: 'Zulu', order: 0 }));
      await storage.createOwner(makeOwnerInput({ name: 'Gone', archived: true }));
      await storage.createOwner(makeOwnerInput({ name: 'Bravo', order: 1 }));

      expect((await storage.getOwners()).map((o) => o.name)).toEqual(['Zulu', 'Bravo', 'Gone']);
    });

    it('renames an owner once, and every task follows', async () => {
      const stage = await storage.createStage(makeStageInput());
      const owner = await storage.createOwner(makeOwnerInput({ name: 'Rich' }));
      const first = await storage.createTask(makeTaskInput(stage.id, { ownerId: owner.id }));
      const second = await storage.createTask(makeTaskInput(stage.id, { ownerId: owner.id }));

      await storage.updateOwner(owner.id, { name: 'Richard' });

      expect((await storage.getTaskById(first.id))?.owner).toBe('Richard');
      expect((await storage.getTaskById(second.id))?.owner).toBe('Richard');
      expect((await storage.getTaskById(first.id))?.ownerId).toBe(owner.id);
    });

    it('leaves the other fields alone on a partial update', async () => {
      const owner = await storage.createOwner(makeOwnerInput({ key: 'RC', color: '#0EA5E9' }));

      const updated = await storage.updateOwner(owner.id, { archived: true });

      expect(updated?.key).toBe('RC');
      expect(updated?.color).toBe('#0EA5E9');
      expect(updated?.name).toBe('Rich');
      expect(updated?.archived).toBe(true);
    });

    it('releases the tasks and unbinds the lanes when an owner is deleted', async () => {
      const stage = await storage.createStage(makeStageInput());
      const owner = await storage.createOwner(makeOwnerInput());
      const lane = await storage.createSubStage(makeSubStageInput(stage.id, { ownerId: owner.id }));
      const task = await storage.createTask(makeTaskInput(stage.id, { ownerId: owner.id }));

      expect(await storage.deleteOwner(owner.id)).toBe(true);

      const released = await storage.getTaskById(task.id);
      expect(released?.ownerId).toBeNull();
      expect(released?.owner).toBeNull();
      expect(released?.archived).toBe(false);
      expect((await storage.getSubStages()).find((l) => l.id === lane.id)?.ownerId).toBeNull();
    });

    it('reports no such owner on a delete that matches nothing', async () => {
      expect(await storage.deleteOwner(999)).toBe(false);
    });

    it('counts only live tasks per owner', async () => {
      const stage = await storage.createStage(makeStageInput());
      const owner = await storage.createOwner(makeOwnerInput());
      await storage.createTask(makeTaskInput(stage.id, { ownerId: owner.id }));
      const archived = await storage.createTask(makeTaskInput(stage.id, { ownerId: owner.id }));
      const binned = await storage.createTask(makeTaskInput(stage.id, { ownerId: owner.id }));
      await storage.archiveTask(archived.id);
      await storage.binTask(binned.id);

      expect((await storage.getOwnerTaskCounts())[owner.id]).toBe(1);
    });

    it('mirrors the owner name onto a task as it is created', async () => {
      const stage = await storage.createStage(makeStageInput());
      const owner = await storage.createOwner(makeOwnerInput({ name: 'Moi' }));

      const task = await storage.createTask(makeTaskInput(stage.id, { ownerId: owner.id }));

      expect(task.ownerId).toBe(owner.id);
      expect(task.owner).toBe('Moi');
    });
  });

  describe('Task project scoping', () => {
    it('stores a task with no project by default', async () => {
      const stage = await storage.createStage(makeStageInput());
      const task = await storage.createTask(makeTaskInput(stage.id));

      expect(task.projectId).toBeNull();
    });

    it('filters live tasks to one project, to unassigned only, or not at all', async () => {
      const stage = await storage.createStage(makeStageInput());
      const alpha = await storage.createProject(makeProjectInput({ name: 'Alpha' }));
      const beta = await storage.createProject(makeProjectInput({ name: 'Beta' }));
      const a = await storage.createTask(makeTaskInput(stage.id, { projectId: alpha.id }));
      const b = await storage.createTask(makeTaskInput(stage.id, { projectId: beta.id }));
      const loose = await storage.createTask(makeTaskInput(stage.id));

      expect((await storage.getTasks()).map((t) => t.id)).toEqual([a.id, b.id, loose.id]);
      expect((await storage.getTasks({})).map((t) => t.id)).toEqual([a.id, b.id, loose.id]);
      expect((await storage.getTasks({ projectId: alpha.id })).map((t) => t.id)).toEqual([a.id]);
      expect((await storage.getTasks({ projectId: null })).map((t) => t.id)).toEqual([loose.id]);
    });

    it('applies the same filter to archived tasks', async () => {
      const stage = await storage.createStage(makeStageInput());
      const alpha = await storage.createProject(makeProjectInput({ name: 'Alpha' }));
      const a = await storage.createTask(makeTaskInput(stage.id, { projectId: alpha.id }));
      const loose = await storage.createTask(makeTaskInput(stage.id));
      await storage.archiveTask(a.id);
      await storage.archiveTask(loose.id);

      expect((await storage.getArchivedTasks({ projectId: alpha.id })).map((t) => t.id)).toEqual([
        a.id,
      ]);
      expect((await storage.getArchivedTasks({ projectId: null })).map((t) => t.id)).toEqual([
        loose.id,
      ]);
    });

    it('moves a task between projects and back to none', async () => {
      const stage = await storage.createStage(makeStageInput());
      const alpha = await storage.createProject(makeProjectInput({ name: 'Alpha' }));
      const task = await storage.createTask(makeTaskInput(stage.id));

      const moved = await storage.updateTask(task.id, { projectId: alpha.id });
      expect(moved!.projectId).toBe(alpha.id);

      const released = await storage.updateTask(task.id, { projectId: null });
      expect(released!.projectId).toBeNull();
    });
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
      expect(s1Subs[0]!.name).toBe('S1-sub');
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

    it('opens the history with the kind of the column it was created in', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      expect(task.history).toHaveLength(1);
      expect(task.history![0]!.status).toBe(STAGE_KIND.BACKLOG);
      expect(task.history![0]!.timestamp).toBeTruthy();
    });

    it("takes its state from the column, not from the column's name", async () => {
      // The name says nothing a reader should trust: the kind decides. This
      // stage is called "Parked" and is a done column.
      const doneStage = await storage.createStage(
        makeStageInput({ name: 'Parked', order: 2, kind: STAGE_KIND.DONE }),
      );
      const task = await storage.createTask(makeTaskInput(doneStage.id));

      expect(task.history![0]!.status).toBe(STAGE_KIND.DONE);
    });

    it('creates a task in a done column as done, with no status to override it', async () => {
      // Pre-EPIC-03 this was the bug the other way round: a caller's status
      // default won over the column it asked for.
      const doneStage = await storage.createStage(
        makeStageInput({ name: 'Done', order: 2, kind: STAGE_KIND.DONE }),
      );
      const task = await storage.createTask(makeTaskInput(doneStage.id));

      expect(task.stageId).toBe(doneStage.id);
      expect(task.history![0]!.status).toBe(STAGE_KIND.DONE);
    });

    it('returns non-archived tasks from getTasks()', async () => {
      await storage.createTask(makeTaskInput(stageId, { title: 'Active' }));
      const archived = await storage.createTask(makeTaskInput(stageId, { title: 'Old' }));
      await storage.archiveTask(archived.id);

      const tasks = await storage.getTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.title).toBe('Active');
    });

    it('returns archived tasks from getArchivedTasks()', async () => {
      await storage.createTask(makeTaskInput(stageId, { title: 'Active' }));
      const toArchive = await storage.createTask(makeTaskInput(stageId, { title: 'Old' }));
      await storage.archiveTask(toArchive.id);

      const archived = await storage.getArchivedTasks();

      expect(archived).toHaveLength(1);
      expect(archived[0]!.title).toBe('Old');
    });

    it('returns tasks ordered by id', async () => {
      await storage.createTask(makeTaskInput(stageId, { title: 'First' }));
      await storage.createTask(makeTaskInput(stageId, { title: 'Second' }));

      const tasks = await storage.getTasks();

      expect(tasks[0]!.title).toBe('First');
      expect(tasks[1]!.title).toBe('Second');
    });

    it('filters tasks by stageId', async () => {
      const stage2 = await storage.createStage(makeStageInput({ name: 'In Progress', order: 1 }));
      await storage.createTask(makeTaskInput(stageId, { title: 'S1' }));
      await storage.createTask(makeTaskInput(stage2.id, { title: 'S2' }));

      const s1Tasks = await storage.getTasksByStage(stageId);

      expect(s1Tasks).toHaveLength(1);
      expect(s1Tasks[0]!.title).toBe('S1');
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

    it('records a move to another column in history', async () => {
      const inProgress = await storage.createStage(
        makeStageInput({ name: 'In Progress', order: 2, kind: STAGE_KIND.IN_PROGRESS }),
      );
      const task = await storage.createTask(makeTaskInput(stageId));
      expect(task.history).toHaveLength(1);

      const updated = await storage.updateTask(task.id, { stageId: inProgress.id });

      expect(updated!.history).toHaveLength(2);
      expect(updated!.history![1]!.status).toBe(STAGE_KIND.IN_PROGRESS);
    });

    it('does not append history when the task stays in its column', async () => {
      const task = await storage.createTask(makeTaskInput(stageId));

      const updated = await storage.updateTask(task.id, { stageId, title: 'Renamed' });

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

      const lastEntry = archived!.history!.at(-1);
      expect(lastEntry!.note).toBe('Archived');
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

describe('IStorage contract: attachments', () => {
  let storage: IStorage;
  const png = Buffer.from([1, 2, 3]);
  const upload = (filename = 'shot.png', taskId: number | null = null): InsertAttachment => ({
    taskId,
    filename,
    mimeType: 'image/png',
    data: png,
  });

  beforeEach(() => {
    storage = new MemStorage();
  });

  it('stores an upload unbound and reads it back with and without its bytes', async () => {
    const meta = await storage.createAttachment(upload());
    expect(meta).toMatchObject({ taskId: null, filename: 'shot.png', byteSize: 3 });
    expect(meta).not.toHaveProperty('data');

    const row = await storage.getAttachment(meta.id);
    expect(row?.data.equals(png)).toBe(true);
    expect(await storage.getAttachmentsMeta([meta.id, 999])).toEqual([meta]);
    expect(await storage.getAttachment(999)).toBeUndefined();
  });

  it('binds only rows that are unbound or already the task’s own', async () => {
    const stage = await storage.createStage(makeStageInput());
    const a = await storage.createTask(makeTaskInput(stage.id));
    const b = await storage.createTask(makeTaskInput(stage.id));
    const free = await storage.createAttachment(upload());
    const owned = await storage.createAttachment(upload('b.png', b.id));

    expect(await storage.bindAttachments(a.id, [free.id, owned.id, 999])).toEqual([free.id]);
    expect(await storage.bindAttachments(b.id, [owned.id])).toEqual([owned.id]);
    expect((await storage.getAttachmentsByTasks([a.id])).map((r) => r.id)).toEqual([free.id]);
    const withData = await storage.getAttachmentsByTasks([a.id, b.id], { withData: true });
    expect(withData.map((r) => r.data?.equals(png))).toEqual([true, true]);
  });

  it('copies a row as a new unbound row with the same bytes', async () => {
    const stage = await storage.createStage(makeStageInput());
    const task = await storage.createTask(makeTaskInput(stage.id));
    const original = await storage.createAttachment(upload('shot.png', task.id));

    const copy = await storage.copyAttachment(original.id);

    expect(copy).toMatchObject({ taskId: null, filename: 'shot.png', byteSize: 3 });
    expect(copy!.id).not.toBe(original.id);
    expect((await storage.getAttachment(copy!.id))?.data.equals(png)).toBe(true);
    expect(await storage.copyAttachment(999)).toBeUndefined();
  });

  it('releases all but the kept rows and sweeps released rows by age', async () => {
    const stage = await storage.createStage(makeStageInput());
    const task = await storage.createTask(makeTaskInput(stage.id));
    const kept = await storage.createAttachment(upload('a.png', task.id));
    const dropped = await storage.createAttachment(upload('b.png', task.id));

    await storage.releaseAttachments(task.id, [kept.id]);
    expect((await storage.getAttachmentsMeta([dropped.id]))[0]?.taskId).toBeNull();
    expect((await storage.getAttachmentsMeta([kept.id]))[0]?.taskId).toBe(task.id);

    expect(await storage.deleteOrphanAttachments(new Date(Date.now() - 60_000))).toBe(0);
    expect(await storage.deleteOrphanAttachments(new Date(Date.now() + 60_000))).toBe(1);
    expect(await storage.getAttachmentsMeta([dropped.id])).toEqual([]);
    expect(await storage.getAttachmentsMeta([kept.id])).toHaveLength(1);
  });

  it('finds descriptions still holding a file inline and rewrites them in place', async () => {
    const stage = await storage.createStage(makeStageInput());
    const legacy = await storage.createTask(
      makeTaskInput(stage.id, {
        description: '<p><a data-file-chip="" href="data:image/png;base64,AAAA">f</a></p>',
      }),
    );
    await storage.createTask(makeTaskInput(stage.id, { description: '<p>plain</p>' }));

    expect(await storage.getTaskIdsWithInlineAttachments()).toEqual([legacy.id]);

    await storage.setTaskDescription(
      legacy.id,
      '<p><a data-file-chip="" href="/api/attachments/1">f</a></p>',
    );
    const after = await storage.getTaskById(legacy.id);
    expect(after?.description).toContain('/api/attachments/1');
    expect(after?.updatedAt).toEqual(legacy.updatedAt);
    expect(await storage.getTaskIdsWithInlineAttachments()).toEqual([]);
  });
});
