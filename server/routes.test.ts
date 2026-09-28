/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- test assertions access untyped JSON response bodies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Task, Stage, SubStage, Project } from '@shared/schema';

// ---------------------------------------------------------------------------
// Mock the storage module so route handlers use vi.fn() stubs instead of the
// real DatabaseStorage (which requires a live PostgreSQL connection).
// vi.hoisted ensures the object is available to the vi.mock factory.
// ---------------------------------------------------------------------------

const mockStorage = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getArchivedTasks: vi.fn(),
  getTaskById: vi.fn(),
  getTasksByStage: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  archiveTask: vi.fn(),
  unarchiveTask: vi.fn(),
  deleteTask: vi.fn(),
  getStages: vi.fn(),
  createStage: vi.fn(),
  updateStage: vi.fn(),
  deleteStage: vi.fn(),
  getSubStages: vi.fn(),
  getSubStagesByStage: vi.fn(),
  createSubStage: vi.fn(),
  updateSubStage: vi.fn(),
  deleteSubStage: vi.fn(),
  getProjects: vi.fn(),
  getProjectById: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjectTaskCounts: vi.fn(),
  createAttachment: vi.fn(),
  getAttachment: vi.fn(),
  getAttachmentsMeta: vi.fn(),
  getAttachmentsByTasks: vi.fn(),
  bindAttachments: vi.fn(),
  copyAttachment: vi.fn(),
  releaseAttachments: vi.fn(),
  deleteOrphanAttachments: vi.fn(),
  getTaskIdsWithInlineAttachments: vi.fn(),
  setTaskDescription: vi.fn(),
}));

vi.mock('./storage', () => ({ storage: mockStorage }));

import { createApp } from './app';
import { api } from '@shared/routes';
import { EXPORT_FORMAT_VERSION, EXPORT_GENERATOR, taskExportBundleSchema } from '@shared/export';
import { ATTACHMENT_MAX_BYTES } from '@shared/attachments';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-09T12:00:00Z');

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Test task',
    description: null,
    stageId: 1,
    archived: false,
    deletedAt: null,
    status: 'backlog',
    priority: 'normal',
    effort: null,
    dueDate: null,
    updatedAt: NOW,
    createdAt: NOW,
    tags: null,
    parentTaskId: null,
    recurrence: 'none',
    history: [{ status: 'backlog', timestamp: NOW.toISOString() }],
    owner: null,
    projectId: null,
    ...overrides,
  };
}

function fakeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'Alpha',
    key: 'ALP',
    color: '#6366F1',
    archived: false,
    order: 0,
    createdAt: NOW,
    ...overrides,
  };
}

function fakeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 1,
    name: 'Backlog',
    order: 0,
    color: null,
    createdAt: NOW,
    ...overrides,
  };
}

function fakeSubStage(overrides: Partial<SubStage> = {}): SubStage {
  return {
    id: 1,
    stageId: 1,
    name: 'Morning',
    tag: 'morning',
    bgClass: 'bg-blue-500/20',
    opacity: 20,
    order: 0,
    createdAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup: build a fresh Express app before each test so routes bind to the
// current mock state and no cross-test pollution occurs.
// ---------------------------------------------------------------------------

let app: Express;

beforeEach(async () => {
  vi.resetAllMocks();
  // Every export lists attachments; most tests have none.
  mockStorage.getAttachmentsByTasks.mockResolvedValue([]);
  const result = await createApp();
  app = result.app;
});

// ===========================================================================
// Health
// ===========================================================================

describe('GET /api/health', () => {
  it('returns 200 with ok: true', async () => {
    const res = await request(app).get(api.health.path);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// ===========================================================================
// Task routes
// ===========================================================================

describe('Task routes', () => {
  // ---- GET /api/tasks ----

  describe('GET /api/tasks', () => {
    it('returns 200 with a list of tasks', async () => {
      const tasks = [fakeTask(), fakeTask({ id: 2, title: 'Second' })];
      mockStorage.getTasks.mockResolvedValue(tasks);

      const res = await request(app).get('/api/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Test task');
      expect(res.body[1].title).toBe('Second');
    });

    it('returns 200 with an empty array when no tasks exist', async () => {
      mockStorage.getTasks.mockResolvedValue([]);

      const res = await request(app).get('/api/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('asks storage for every task when no project scope is given', async () => {
      mockStorage.getTasks.mockResolvedValue([]);

      await request(app).get('/api/tasks');

      expect(mockStorage.getTasks).toHaveBeenCalledWith({});
    });

    it('scopes the list to one project server-side via ?projectId=', async () => {
      mockStorage.getTasks.mockResolvedValue([fakeTask({ projectId: 3 })]);

      const res = await request(app).get('/api/tasks?projectId=3');

      expect(res.status).toBe(200);
      expect(mockStorage.getTasks).toHaveBeenCalledWith({ projectId: 3 });
      expect(res.body[0].projectId).toBe(3);
    });

    it('scopes the list to unassigned tasks via ?projectId=none', async () => {
      mockStorage.getTasks.mockResolvedValue([]);

      await request(app).get('/api/tasks?projectId=none');

      expect(mockStorage.getTasks).toHaveBeenCalledWith({ projectId: null });
    });

    it('returns 400 for a projectId that is neither an id nor "none"', async () => {
      const res = await request(app).get('/api/tasks?projectId=alpha');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('status', 400);
      expect(mockStorage.getTasks).not.toHaveBeenCalled();
    });
  });

  // ---- POST /api/tasks ----

  describe('POST /api/tasks', () => {
    it('returns 201 with the created task', async () => {
      const created = fakeTask();
      mockStorage.createTask.mockResolvedValue(created);

      const res = await request(app).post('/api/tasks').send({ title: 'Test task', stageId: 1 });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(1);
      expect(res.body.title).toBe('Test task');
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app).post('/api/tasks').send({ stageId: 1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });

    it('returns 400 when stageId is missing', async () => {
      const res = await request(app).post('/api/tasks').send({ title: 'No stage' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });

    it('returns 400 when title is empty string', async () => {
      const res = await request(app).post('/api/tasks').send({ title: '', stageId: 1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });

  // ---- PATCH /api/tasks/:id ----

  describe('PATCH /api/tasks/:id', () => {
    it('returns 200 with the updated task', async () => {
      const updated = fakeTask({ title: 'Updated' });
      mockStorage.updateTask.mockResolvedValue(updated);

      const res = await request(app).patch('/api/tasks/1').send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).patch('/api/tasks/abc').send({ title: 'Updated' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });

    it('returns 404 when the task does not exist', async () => {
      mockStorage.updateTask.mockResolvedValue(undefined);

      const res = await request(app).patch('/api/tasks/999').send({ title: 'Nope' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Task not found');
      expect(res.body).toHaveProperty('status', 404);
    });
  });

  // ---- DELETE /api/tasks/:id ----

  describe('DELETE /api/tasks/:id', () => {
    it('returns 204 on success', async () => {
      mockStorage.deleteTask.mockResolvedValue(undefined);

      const res = await request(app).delete('/api/tasks/1');

      expect(res.status).toBe(204);
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).delete('/api/tasks/abc');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });

  // ---- GET /api/tasks/archived ----

  describe('GET /api/tasks/archived', () => {
    it('returns 200 with archived tasks', async () => {
      const archived = [fakeTask({ id: 5, archived: true })];
      mockStorage.getArchivedTasks.mockResolvedValue(archived);

      const res = await request(app).get('/api/tasks/archived');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].archived).toBe(true);
    });

    it('returns 200 with an empty array when no archived tasks exist', async () => {
      mockStorage.getArchivedTasks.mockResolvedValue([]);

      const res = await request(app).get('/api/tasks/archived');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('applies the same project scope as the live list', async () => {
      mockStorage.getArchivedTasks.mockResolvedValue([]);

      await request(app).get('/api/tasks/archived?projectId=2');
      expect(mockStorage.getArchivedTasks).toHaveBeenCalledWith({ projectId: 2 });

      const res = await request(app).get('/api/tasks/archived?projectId=nope');
      expect(res.status).toBe(400);
    });
  });

  // ---- POST /api/tasks/:id/archive ----

  describe('POST /api/tasks/:id/archive', () => {
    it('returns 200 with the archived task', async () => {
      const archived = fakeTask({ archived: true });
      mockStorage.archiveTask.mockResolvedValue(archived);

      const res = await request(app).post('/api/tasks/1/archive');

      expect(res.status).toBe(200);
      expect(res.body.archived).toBe(true);
    });

    it('returns 404 when the task does not exist', async () => {
      mockStorage.archiveTask.mockResolvedValue(undefined);

      const res = await request(app).post('/api/tasks/999/archive');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Task not found');
      expect(res.body).toHaveProperty('status', 404);
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).post('/api/tasks/abc/archive');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });

  // ---- POST /api/tasks/:id/unarchive ----

  describe('POST /api/tasks/:id/unarchive', () => {
    it('returns 200 with the unarchived task', async () => {
      const unarchived = fakeTask({ archived: false });
      mockStorage.unarchiveTask.mockResolvedValue(unarchived);

      const res = await request(app).post('/api/tasks/1/unarchive');

      expect(res.status).toBe(200);
      expect(res.body.archived).toBe(false);
    });

    it('returns 404 when the task does not exist', async () => {
      mockStorage.unarchiveTask.mockResolvedValue(undefined);

      const res = await request(app).post('/api/tasks/999/unarchive');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Task not found');
      expect(res.body).toHaveProperty('status', 404);
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).post('/api/tasks/abc/unarchive');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });

  // ---- GET /api/tasks/:id/history ----

  describe('GET /api/tasks/:id/history', () => {
    it('returns 200 with task history entries', async () => {
      const task = fakeTask({
        history: [
          { status: 'backlog', timestamp: NOW.toISOString() },
          { status: 'in_progress', timestamp: NOW.toISOString() },
        ],
      });
      mockStorage.getTaskById.mockResolvedValue(task);

      const res = await request(app).get('/api/tasks/1/history');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].status).toBe('backlog');
      expect(res.body[1].status).toBe('in_progress');
    });

    it('returns 200 with an empty array when history is null', async () => {
      const task = fakeTask({ history: null });
      mockStorage.getTaskById.mockResolvedValue(task);

      const res = await request(app).get('/api/tasks/1/history');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 404 when the task does not exist', async () => {
      mockStorage.getTaskById.mockResolvedValue(undefined);

      const res = await request(app).get('/api/tasks/999/history');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Task not found');
      expect(res.body).toHaveProperty('status', 404);
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).get('/api/tasks/abc/history');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });
});

// ===========================================================================
// Export route
// ===========================================================================

describe('GET /api/export', () => {
  function stubBoard() {
    mockStorage.getTasks.mockResolvedValue([fakeTask()]);
    mockStorage.getArchivedTasks.mockResolvedValue([fakeTask({ id: 9, archived: true })]);
    mockStorage.getStages.mockResolvedValue([fakeStage()]);
    mockStorage.getSubStages.mockResolvedValue([fakeSubStage()]);
    mockStorage.getProjects.mockResolvedValue([]);
  }

  it('returns 200 with a JSON object envelope, not a bare array', async () => {
    stubBoard();

    const res = await request(app).get(api.export.get.path);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(false);
    expect(res.body.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(res.body.generator).toBe(EXPORT_GENERATOR);
    expect(typeof res.body.exportedAt).toBe('string');
    expect(taskExportBundleSchema.safeParse(res.body).success).toBe(true);
  });

  it('includes stages and sub-stages so the export is self-contained', async () => {
    stubBoard();

    const res = await request(app).get(api.export.get.path);

    expect(res.body.stages).toHaveLength(1);
    expect(res.body.subStages).toHaveLength(1);
    expect(res.body.counts).toEqual({
      tasks: 1,
      stages: 1,
      subStages: 1,
      projects: 0,
      attachments: 0,
    });
  });

  it('excludes archived tasks by default', async () => {
    stubBoard();

    const res = await request(app).get(api.export.get.path);

    expect(mockStorage.getArchivedTasks).not.toHaveBeenCalled();
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.scope.includeArchived).toBe(false);
  });

  it('includes archived tasks when includeArchived=true', async () => {
    stubBoard();

    const res = await request(app).get(`${api.export.get.path}?includeArchived=true`);

    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.scope.includeArchived).toBe(true);
  });

  it('returns only the digest for view=briefing', async () => {
    stubBoard();

    const res = await request(app).get(`${api.export.get.path}?view=briefing`);

    expect(res.status).toBe(200);
    expect(res.body.briefing).toBeDefined();
    expect(res.body.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    // The whole point of the view: no bulk arrays for a truncating fetcher to
    // choke on before it reaches the digest.
    expect(res.body.tasks).toBeUndefined();
    expect(res.body.stages).toBeUndefined();
    expect(res.body.subStages).toBeUndefined();
  });

  it('serializes briefing before tasks in the full view', async () => {
    // Consumers with truncating fetch tools read the response as a prefix.
    // If `tasks` (which can carry ~540 KB of embedded images) serialized
    // first, a cut-off read would look like a missing digest.
    stubBoard();

    const res = await request(app).get(api.export.get.path);
    const text = JSON.stringify(res.body);

    // '"tasks":[' targets the array; bare '"tasks"' would match the count in
    // `counts` first.
    expect(text.indexOf('"briefing"')).toBeGreaterThan(-1);
    expect(text.indexOf('"tasks":[')).toBeGreaterThan(-1);
    expect(text.indexOf('"briefing"')).toBeLessThan(text.indexOf('"tasks":['));
  });

  // A briefing agent polling the identical URL was served the same 12-hour-old
  // body until a junk query param forced a rebuild. Nothing in front of this
  // route may hold a snapshot of a board that changes all day.
  it('forbids caching the response', async () => {
    stubBoard();

    const res = await request(app).get(`${api.export.get.path}?view=briefing`);

    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
    expect(res.headers['cdn-cache-control']).toBe('no-store');
    expect(res.headers.pragma).toBe('no-cache');
  });

  it('forbids caching error responses too', async () => {
    stubBoard();

    const res = await request(app).get(`${api.export.get.path}?view=summary`);

    expect(res.status).toBe(400);
    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
  });

  it('rebuilds the payload on every request to the same URL', async () => {
    stubBoard();
    const url = `${api.export.get.path}?view=briefing`;
    // Only Date is faked — the real timers stay live so supertest still works.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-13T07:00:00+12:00'));
      const earlier = await request(app).get(url);
      vi.setSystemTime(new Date('2026-08-13T07:00:05+12:00'));
      const later = await request(app).get(url);

      expect(earlier.body.exportedAt).toBe('2026-08-12T19:00:00.000Z');
      expect(later.body.exportedAt).toBe('2026-08-12T19:00:05.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('cuts the day in New Zealand, not the UTC the server runs in', async () => {
    stubBoard();
    // 07:00 NZT on 13 Aug — the briefing slot. In UTC it is still 12 Aug.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-13T07:00:00+12:00'));
      const res = await request(app).get(`${api.export.get.path}?view=briefing`);

      expect(res.body.briefing.timezone).toBe('Pacific/Auckland');
      expect(res.body.briefing.generatedFor).toBe('2026-08-13');
      expect(res.body.briefing.overdueRule).toContain('Pacific/Auckland');
    } finally {
      vi.useRealTimers();
    }
  });

  it('honours an explicit tz', async () => {
    stubBoard();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-13T07:00:00+12:00'));
      const res = await request(app).get(`${api.export.get.path}?view=briefing&tz=UTC`);

      expect(res.body.briefing.timezone).toBe('UTC');
      expect(res.body.briefing.generatedFor).toBe('2026-08-12');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns 400 for a tz that is not an IANA zone', async () => {
    stubBoard();

    const res = await request(app).get(`${api.export.get.path}?view=briefing&tz=Middle/Earth`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('status', 400);
  });

  it('returns 400 for an unrecognised view value', async () => {
    stubBoard();

    const res = await request(app).get(`${api.export.get.path}?view=summary`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('status', 400);
  });

  it('returns 400 for an unrecognised includeArchived value', async () => {
    stubBoard();

    const res = await request(app).get(`${api.export.get.path}?includeArchived=yes`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('status', 400);
  });

  it('scopes the tasks to one project via ?projectId= and says so in scope', async () => {
    stubBoard();
    mockStorage.getProjects.mockResolvedValue([fakeProject({ id: 1 }), fakeProject({ id: 2 })]);
    mockStorage.getTasks.mockResolvedValue([fakeTask({ projectId: 1 })]);

    const res = await request(app).get(`${api.export.get.path}?projectId=1&includeArchived=true`);

    expect(res.status).toBe(200);
    expect(mockStorage.getTasks).toHaveBeenCalledWith({ projectId: 1 });
    expect(mockStorage.getArchivedTasks).toHaveBeenCalledWith({ projectId: 1 });
    expect(res.body.scope.projectIds).toEqual([1]);
    // Every project still ships, so a scoped file resolves any projectId.
    expect(res.body.projects).toHaveLength(2);
    expect(res.body.counts.projects).toBe(2);
    expect(taskExportBundleSchema.safeParse(res.body).success).toBe(true);
  });

  it('returns 400 for a projectId that is not a numeric id', async () => {
    stubBoard();

    for (const value of ['none', 'alpha', '0']) {
      const res = await request(app).get(`${api.export.get.path}?projectId=${value}`);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('status', 400);
    }
    expect(mockStorage.getTasks).not.toHaveBeenCalled();
  });

  it('returns a JSON 500 when a query fails, rather than hanging', async () => {
    mockStorage.getTasks.mockRejectedValue(new Error('relation "tasks" does not exist'));
    mockStorage.getStages.mockResolvedValue([]);
    mockStorage.getSubStages.mockResolvedValue([]);
    mockStorage.getProjects.mockResolvedValue([]);

    const res = await request(app).get(api.export.get.path);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('status', 500);
  });

  it('lists every project and leaves projectIds null for an unscoped export', async () => {
    stubBoard();
    mockStorage.getProjects.mockResolvedValue([fakeProject()]);

    const res = await request(app).get(api.export.get.path);

    expect(mockStorage.getTasks).toHaveBeenCalledWith({});
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe('Alpha');
    expect(res.body.scope.projectIds).toBeNull();
  });
});

// ===========================================================================
// Project routes
// ===========================================================================

describe('Project routes', () => {
  describe('GET /api/projects', () => {
    it('returns every project with its live task count', async () => {
      mockStorage.getProjects.mockResolvedValue([
        fakeProject({ id: 1, name: 'Alpha' }),
        fakeProject({ id: 2, name: 'Beta' }),
      ]);
      mockStorage.getProjectTaskCounts.mockResolvedValue({ 1: 4 });

      const res = await request(app).get(api.projects.list.path);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({ id: 1, name: 'Alpha', taskCount: 4 });
      expect(res.body[1]).toMatchObject({ id: 2, name: 'Beta', taskCount: 0 });
    });

    it('returns an empty array when there are no projects', async () => {
      mockStorage.getProjects.mockResolvedValue([]);
      mockStorage.getProjectTaskCounts.mockResolvedValue({});

      const res = await request(app).get(api.projects.list.path);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/projects', () => {
    it('returns 201 with the created project', async () => {
      mockStorage.getProjects.mockResolvedValue([]);
      mockStorage.createProject.mockResolvedValue(fakeProject({ name: 'Alpha', key: 'ALP' }));

      const res = await request(app)
        .post(api.projects.list.path)
        .send({ name: 'Alpha', key: 'alp', color: '#6366F1' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Alpha');
      // The key is normalised to upper case before it reaches storage.
      expect(mockStorage.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alpha', key: 'ALP', color: '#6366F1' }),
      );
    });

    it('returns 400 when the name is missing or blank', async () => {
      mockStorage.getProjects.mockResolvedValue([]);

      const missing = await request(app).post(api.projects.list.path).send({});
      expect(missing.status).toBe(400);
      expect(missing.body).toHaveProperty('status', 400);

      const blank = await request(app).post(api.projects.list.path).send({ name: '   ' });
      expect(blank.status).toBe(400);
      expect(mockStorage.createProject).not.toHaveBeenCalled();
    });

    it('returns 400 for a colour that is not a hex code', async () => {
      mockStorage.getProjects.mockResolvedValue([]);

      const res = await request(app)
        .post(api.projects.list.path)
        .send({ name: 'Alpha', color: 'blue' });

      expect(res.status).toBe(400);
    });

    it('returns 409 when a project with that name already exists, ignoring case', async () => {
      mockStorage.getProjects.mockResolvedValue([fakeProject({ id: 7, name: 'Alpha' })]);

      const res = await request(app).post(api.projects.list.path).send({ name: 'alpha ' });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('status', 409);
      expect(mockStorage.createProject).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('returns 200 with the updated project', async () => {
      mockStorage.getProjects.mockResolvedValue([fakeProject({ id: 1, name: 'Alpha' })]);
      mockStorage.updateProject.mockResolvedValue(fakeProject({ id: 1, name: 'Alpha 2' }));

      const res = await request(app).patch('/api/projects/1').send({ name: 'Alpha 2' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Alpha 2');
      expect(mockStorage.updateProject).toHaveBeenCalledWith(1, { name: 'Alpha 2' });
    });

    it('lets a project keep its own name on a rename that only changes case', async () => {
      mockStorage.getProjects.mockResolvedValue([fakeProject({ id: 1, name: 'alpha' })]);
      mockStorage.updateProject.mockResolvedValue(fakeProject({ id: 1, name: 'Alpha' }));

      const res = await request(app).patch('/api/projects/1').send({ name: 'Alpha' });

      expect(res.status).toBe(200);
    });

    it('archives a project without touching its name', async () => {
      mockStorage.updateProject.mockResolvedValue(fakeProject({ id: 1, archived: true }));

      const res = await request(app).patch('/api/projects/1').send({ archived: true });

      expect(res.status).toBe(200);
      expect(res.body.archived).toBe(true);
      expect(mockStorage.getProjects).not.toHaveBeenCalled();
    });

    it('returns 409 when renaming onto another project', async () => {
      mockStorage.getProjects.mockResolvedValue([
        fakeProject({ id: 1, name: 'Alpha' }),
        fakeProject({ id: 2, name: 'Beta' }),
      ]);

      const res = await request(app).patch('/api/projects/1').send({ name: 'BETA' });

      expect(res.status).toBe(409);
      expect(mockStorage.updateProject).not.toHaveBeenCalled();
    });

    it('returns 404 when the project does not exist', async () => {
      mockStorage.updateProject.mockResolvedValue(undefined);

      const res = await request(app).patch('/api/projects/999').send({ color: '#EF4444' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Project not found');
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).patch('/api/projects/abc').send({ name: 'X' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('returns 204 on success', async () => {
      mockStorage.deleteProject.mockResolvedValue(true);

      const res = await request(app).delete('/api/projects/1');

      expect(res.status).toBe(204);
      expect(mockStorage.deleteProject).toHaveBeenCalledWith(1);
    });

    it('returns 404 when the project does not exist', async () => {
      mockStorage.deleteProject.mockResolvedValue(false);

      const res = await request(app).delete('/api/projects/999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Project not found');
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).delete('/api/projects/abc');

      expect(res.status).toBe(400);
    });
  });
});

// ===========================================================================
// Stage routes
// ===========================================================================

describe('Stage routes', () => {
  // ---- GET /api/stages ----

  describe('GET /api/stages', () => {
    it('returns 200 with a list of stages', async () => {
      const stages = [fakeStage(), fakeStage({ id: 2, name: 'Done', order: 1 })];
      mockStorage.getStages.mockResolvedValue(stages);

      const res = await request(app).get('/api/stages');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Backlog');
      expect(res.body[1].name).toBe('Done');
    });

    it('returns 200 with an empty array when no stages exist', async () => {
      mockStorage.getStages.mockResolvedValue([]);

      const res = await request(app).get('/api/stages');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ---- POST /api/stages ----

  describe('POST /api/stages', () => {
    it('returns 201 with the created stage', async () => {
      const created = fakeStage();
      mockStorage.createStage.mockResolvedValue(created);

      const res = await request(app).post('/api/stages').send({ name: 'Backlog', order: 0 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Backlog');
      expect(res.body.id).toBe(1);
    });

    it('accepts an optional valid hex color', async () => {
      const created = fakeStage({ color: '#3B82F6' });
      mockStorage.createStage.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/stages')
        .send({ name: 'Backlog', order: 0, color: '#3B82F6' });

      expect(res.status).toBe(201);
      expect(res.body.color).toBe('#3B82F6');
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app).post('/api/stages').send({ order: 0 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });

    it('returns 400 for an invalid color format', async () => {
      const res = await request(app)
        .post('/api/stages')
        .send({ name: 'Backlog', order: 0, color: 'not-a-hex' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });

  // ---- PATCH /api/stages/:id ----

  describe('PATCH /api/stages/:id', () => {
    it('returns 200 with the updated stage', async () => {
      const updated = fakeStage({ name: 'Renamed' });
      mockStorage.updateStage.mockResolvedValue(updated);

      const res = await request(app).patch('/api/stages/1').send({ name: 'Renamed' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed');
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).patch('/api/stages/abc').send({ name: 'Renamed' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });

    it('returns 404 when the stage does not exist', async () => {
      mockStorage.updateStage.mockResolvedValue(undefined);

      const res = await request(app).patch('/api/stages/999').send({ name: 'Nope' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Stage not found');
      expect(res.body).toHaveProperty('status', 404);
    });

    it('returns 400 for an invalid color in update', async () => {
      const res = await request(app).patch('/api/stages/1').send({ color: 'red' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });

  // ---- DELETE /api/stages/:id ----

  describe('DELETE /api/stages/:id', () => {
    it('returns 204 on success', async () => {
      mockStorage.deleteStage.mockResolvedValue(undefined);

      const res = await request(app).delete('/api/stages/1');

      expect(res.status).toBe(204);
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).delete('/api/stages/abc');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });
});

// ===========================================================================
// Sub-stage routes
// ===========================================================================

describe('Sub-stage routes', () => {
  // ---- GET /api/sub-stages ----

  describe('GET /api/sub-stages', () => {
    it('returns 200 with all sub-stages', async () => {
      const subs = [fakeSubStage(), fakeSubStage({ id: 2, name: 'Afternoon', order: 1 })];
      mockStorage.getSubStages.mockResolvedValue(subs);

      const res = await request(app).get('/api/sub-stages');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Morning');
      expect(res.body[1].name).toBe('Afternoon');
    });

    it('returns 200 with an empty array when none exist', async () => {
      mockStorage.getSubStages.mockResolvedValue([]);

      const res = await request(app).get('/api/sub-stages');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ---- GET /api/stages/:stageId/sub-stages ----

  describe('GET /api/stages/:stageId/sub-stages', () => {
    it('returns 200 with sub-stages for the given stage', async () => {
      const subs = [fakeSubStage()];
      mockStorage.getSubStagesByStage.mockResolvedValue(subs);

      const res = await request(app).get('/api/stages/1/sub-stages');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].stageId).toBe(1);
    });

    it('returns 200 with an empty array for a stage with no sub-stages', async () => {
      mockStorage.getSubStagesByStage.mockResolvedValue([]);

      const res = await request(app).get('/api/stages/42/sub-stages');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 400 for a non-numeric stageId', async () => {
      const res = await request(app).get('/api/stages/abc/sub-stages');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });

  // ---- POST /api/sub-stages ----

  describe('POST /api/sub-stages', () => {
    const validSubStageBody = {
      stageId: 1,
      name: 'Morning',
      tag: 'morning',
      bgClass: 'bg-blue-500/20',
      opacity: 20,
      order: 0,
    };

    it('returns 201 with the created sub-stage', async () => {
      const created = fakeSubStage();
      mockStorage.createSubStage.mockResolvedValue(created);

      const res = await request(app).post('/api/sub-stages').send(validSubStageBody);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Morning');
      expect(res.body.id).toBe(1);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/sub-stages').send({ stageId: 1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });

    it('returns 400 when opacity is out of range', async () => {
      const res = await request(app)
        .post('/api/sub-stages')
        .send({ ...validSubStageBody, opacity: 200 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });

  // ---- PATCH /api/sub-stages/:id ----

  describe('PATCH /api/sub-stages/:id', () => {
    it('returns 200 with the updated sub-stage', async () => {
      const updated = fakeSubStage({ name: 'Afternoon' });
      mockStorage.updateSubStage.mockResolvedValue(updated);

      const res = await request(app).patch('/api/sub-stages/1').send({ name: 'Afternoon' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Afternoon');
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).patch('/api/sub-stages/abc').send({ name: 'Afternoon' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });

    it('returns 404 when the sub-stage does not exist', async () => {
      mockStorage.updateSubStage.mockResolvedValue(undefined);

      const res = await request(app).patch('/api/sub-stages/999').send({ name: 'Nope' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Sub-stage not found');
      expect(res.body).toHaveProperty('status', 404);
    });
  });

  // ---- DELETE /api/sub-stages/:id ----

  describe('DELETE /api/sub-stages/:id', () => {
    it('returns 204 on success', async () => {
      mockStorage.deleteSubStage.mockResolvedValue(undefined);

      const res = await request(app).delete('/api/sub-stages/1');

      expect(res.status).toBe(204);
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).delete('/api/sub-stages/abc');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('status', 400);
    });
  });
});

// ===========================================================================
// Attachment routes
// ===========================================================================

describe('Attachment routes', () => {
  const PNG = Buffer.from([1, 2, 3]);
  const stored = {
    id: 7,
    taskId: null,
    filename: 'shot.png',
    mimeType: 'image/png',
    byteSize: PNG.length,
    createdAt: NOW,
  };

  const upload = (type: string, name: string, body: Buffer) =>
    request(app)
      .post(api.attachments.upload.path)
      .set('Content-Type', 'application/octet-stream')
      .set('x-attachment-type', type)
      .set('x-attachment-name', encodeURIComponent(name))
      .send(body);

  describe('POST /api/attachments', () => {
    it('stores a raw upload under its declared type and name', async () => {
      mockStorage.createAttachment.mockResolvedValue(stored);

      const res = await upload('image/png', 'shot.png', PNG);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 7,
        filename: 'shot.png',
        mimeType: 'image/png',
        url: '/api/attachments/7',
      });
      expect(mockStorage.createAttachment).toHaveBeenCalledWith({
        taskId: null,
        filename: 'shot.png',
        mimeType: 'image/png',
        data: PNG,
      });
    });

    it('types a file by its extension when the declared type is generic, and cleans the name', async () => {
      mockStorage.createAttachment.mockResolvedValue({
        ...stored,
        filename: '.._notes.md',
        mimeType: 'text/markdown',
      });

      const res = await upload('application/octet-stream', '../notes.md', PNG);

      expect(res.status).toBe(201);
      expect(mockStorage.createAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ filename: '.._notes.md', mimeType: 'text/markdown' }),
      );
    });

    it('refuses a type that cannot be attached with 415', async () => {
      const res = await upload('text/html', 'page.html', PNG);
      expect(res.status).toBe(415);
      expect(res.body).toHaveProperty('status', 415);
      expect(mockStorage.createAttachment).not.toHaveBeenCalled();
    });

    it('refuses an empty body with 400', async () => {
      const res = await request(app)
        .post(api.attachments.upload.path)
        .set('Content-Type', 'application/octet-stream')
        .set('x-attachment-type', 'image/png');
      expect(res.status).toBe(400);
      expect(mockStorage.createAttachment).not.toHaveBeenCalled();
    });

    it('refuses a body over the size limit with 413', async () => {
      const res = await upload('image/png', 'big.png', Buffer.alloc(ATTACHMENT_MAX_BYTES + 1));
      expect(res.status).toBe(413);
      expect(res.body).toHaveProperty('status', 413);
      expect(mockStorage.createAttachment).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/attachments/:id', () => {
    it('serves an image inline, cached for good, with a locked-down CSP', async () => {
      mockStorage.getAttachment.mockResolvedValue({ ...stored, data: PNG });

      const res = await request(app).get('/api/attachments/7');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['content-length']).toBe(String(PNG.length));
      expect(res.headers['content-disposition']).toBe(
        `inline; filename="shot.png"; filename*=UTF-8''shot.png`,
      );
      expect(res.headers['cache-control']).toBe('private, max-age=31536000, immutable');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe("default-src 'none'");
      expect(Buffer.from(res.body as Buffer).equals(PNG)).toBe(true);
    });

    it('downloads on request', async () => {
      mockStorage.getAttachment.mockResolvedValue({ ...stored, data: PNG });
      const res = await request(app).get('/api/attachments/7?download=1');
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="shot.png"/);
    });

    it('always downloads types a browser cannot show, and SVG', async () => {
      mockStorage.getAttachment.mockResolvedValue({
        ...stored,
        filename: 'plan.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: PNG,
      });
      const docx = await request(app).get('/api/attachments/7');
      expect(docx.headers['content-disposition']).toMatch(/^attachment; filename="plan.docx"/);

      mockStorage.getAttachment.mockResolvedValue({
        ...stored,
        filename: 'logo.svg',
        mimeType: 'image/svg+xml',
        data: PNG,
      });
      const svg = await request(app).get('/api/attachments/7');
      expect(svg.headers['content-disposition']).toMatch(/^attachment; filename="logo.svg"/);
    });

    it('leaves the CSP off a PDF so the viewer can render it', async () => {
      mockStorage.getAttachment.mockResolvedValue({
        ...stored,
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        data: PNG,
      });
      const res = await request(app).get('/api/attachments/7');
      expect(res.headers['content-disposition']).toMatch(/^inline; filename="report.pdf"/);
      expect(res.headers['content-security-policy']).toBeUndefined();
    });

    it('returns 404 for a missing attachment and 400 for a bad id', async () => {
      mockStorage.getAttachment.mockResolvedValue(undefined);
      const missing = await request(app).get('/api/attachments/99');
      expect(missing.status).toBe(404);
      expect(missing.body).toHaveProperty('status', 404);

      const bad = await request(app).get('/api/attachments/abc');
      expect(bad.status).toBe(400);
    });
  });
});

describe('Task routes keep attachments in step with the description', () => {
  const PNG = Buffer.from([1, 2, 3]);
  const stored = {
    id: 5,
    taskId: null,
    filename: 'shot.png',
    mimeType: 'image/png',
    byteSize: PNG.length,
    createdAt: NOW,
  };
  const chip = (href: string) =>
    `<a data-file-chip="" data-file-name="shot.png" data-file-type="image/png" href="${href}" class="file-chip">shot.png</a>`;

  it('binds the attachments a new task description references', async () => {
    mockStorage.getAttachmentsMeta.mockResolvedValue([stored]);
    mockStorage.createTask.mockResolvedValue(fakeTask({ id: 42 }));
    mockStorage.bindAttachments.mockResolvedValue([5]);

    const res = await request(app)
      .post(api.tasks.create.path)
      .send({ title: 'T', stageId: 1, description: `<p>${chip('/api/attachments/5')}</p>` });

    expect(res.status).toBe(201);
    expect(mockStorage.bindAttachments).toHaveBeenCalledWith(42, [5]);
    expect(mockStorage.releaseAttachments).not.toHaveBeenCalled();
  });

  it('moves a file a new task description still holds inline into a row', async () => {
    mockStorage.getAttachmentsMeta.mockResolvedValue([]);
    mockStorage.createAttachment.mockResolvedValue({ ...stored, id: 9 });
    mockStorage.createTask.mockResolvedValue(fakeTask({ id: 42 }));
    mockStorage.bindAttachments.mockResolvedValue([9]);

    const res = await request(app)
      .post(api.tasks.create.path)
      .send({
        title: 'T',
        stageId: 1,
        description: `<p>${chip(`data:image/png;base64,${PNG.toString('base64')}`)}</p>`,
      });

    expect(res.status).toBe(201);
    expect(mockStorage.createAttachment).toHaveBeenCalledWith({
      taskId: null,
      filename: 'shot.png',
      mimeType: 'image/png',
      data: PNG,
    });
    expect(mockStorage.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ description: `<p>${chip('/api/attachments/9')}</p>` }),
    );
    expect(mockStorage.bindAttachments).toHaveBeenCalledWith(42, [9]);
  });

  it('re-syncs attachments when a task description is updated', async () => {
    mockStorage.getAttachmentsMeta.mockResolvedValue([{ ...stored, taskId: 1 }]);
    mockStorage.updateTask.mockResolvedValue(fakeTask());
    mockStorage.bindAttachments.mockResolvedValue([5]);

    const res = await request(app)
      .patch('/api/tasks/1')
      .send({ description: `<p>${chip('/api/attachments/5')}</p>` });

    expect(res.status).toBe(200);
    expect(mockStorage.bindAttachments).toHaveBeenCalledWith(1, [5]);
    expect(mockStorage.releaseAttachments).toHaveBeenCalledWith(1, [5]);
  });

  it("gives an update that references another task's attachment a copy of its own", async () => {
    mockStorage.getAttachmentsMeta.mockResolvedValue([{ ...stored, taskId: 2 }]);
    mockStorage.copyAttachment.mockResolvedValue({ ...stored, id: 8 });
    mockStorage.updateTask.mockResolvedValue(fakeTask());
    mockStorage.bindAttachments.mockResolvedValue([8]);

    const res = await request(app)
      .patch('/api/tasks/1')
      .send({ description: chip('/api/attachments/5') });

    expect(res.status).toBe(200);
    expect(mockStorage.copyAttachment).toHaveBeenCalledWith(5);
    expect(mockStorage.updateTask).toHaveBeenCalledWith(1, {
      description: chip('/api/attachments/8'),
    });
    expect(mockStorage.bindAttachments).toHaveBeenCalledWith(1, [8]);
  });

  it('releases every attachment when the description is cleared', async () => {
    mockStorage.updateTask.mockResolvedValue(fakeTask());
    const res = await request(app).patch('/api/tasks/1').send({ description: null });
    expect(res.status).toBe(200);
    expect(mockStorage.bindAttachments).not.toHaveBeenCalled();
    expect(mockStorage.releaseAttachments).toHaveBeenCalledWith(1, []);
  });

  it('leaves attachments alone when the update carries no description', async () => {
    mockStorage.updateTask.mockResolvedValue(fakeTask());
    const res = await request(app).patch('/api/tasks/1').send({ title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(mockStorage.bindAttachments).not.toHaveBeenCalled();
    expect(mockStorage.releaseAttachments).not.toHaveBeenCalled();
  });
});

describe('GET /api/export lists attachments', () => {
  const PNG = Buffer.from([1, 2, 3]);
  const stored = {
    id: 7,
    taskId: 1,
    filename: 'shot.png',
    mimeType: 'image/png',
    byteSize: PNG.length,
    createdAt: NOW,
  };

  beforeEach(() => {
    mockStorage.getTasks.mockResolvedValue([fakeTask({ id: 1 })]);
    mockStorage.getArchivedTasks.mockResolvedValue([]);
    mockStorage.getStages.mockResolvedValue([fakeStage()]);
    mockStorage.getSubStages.mockResolvedValue([]);
    mockStorage.getProjects.mockResolvedValue([]);
  });

  it("lists each task's attachments by url, without their bytes", async () => {
    mockStorage.getAttachmentsByTasks.mockResolvedValue([stored]);

    const res = await request(app).get(api.export.get.path);

    expect(res.status).toBe(200);
    expect(mockStorage.getAttachmentsByTasks).toHaveBeenCalledWith([1], { withData: false });
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0]).toMatchObject({ id: 7, taskId: 1, url: '/api/attachments/7' });
    expect(res.body.attachments[0]).not.toHaveProperty('data');
    expect(res.body.counts.attachments).toBe(1);
    expect(res.body.scope.includeAttachments).toBe(false);
  });

  it('embeds the bytes when asked to', async () => {
    mockStorage.getAttachmentsByTasks.mockResolvedValue([{ ...stored, data: PNG }]);

    const res = await request(app).get(`${api.export.get.path}?includeAttachments=true`);

    expect(res.status).toBe(200);
    expect(mockStorage.getAttachmentsByTasks).toHaveBeenCalledWith([1], { withData: true });
    expect(res.body.attachments[0].data).toBe(PNG.toString('base64'));
    expect(res.body.scope.includeAttachments).toBe(true);
  });
});
