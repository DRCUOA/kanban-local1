/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- test assertions access untyped JSON response bodies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Task, Stage, SubStage } from '@shared/schema';

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
}));

vi.mock('./storage', () => ({ storage: mockStorage }));

import { createApp } from './app';
import { api } from '@shared/routes';
import {
  EXPORT_FORMAT_VERSION,
  EXPORT_GENERATOR,
  PROJECT_SCOPE_UNSUPPORTED,
  taskExportBundleSchema,
} from '@shared/export';

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
    expect(res.body.counts).toEqual({ tasks: 1, stages: 1, subStages: 1, projects: 0 });
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

  // Forward-compat guard: see docs/epics/EPIC-01-project-layer.md. Until tasks
  // carry a project, a projectId filter must fail rather than quietly return
  // the whole board.
  it('returns 400 when asked for a project-scoped export', async () => {
    stubBoard();

    const res = await request(app).get(`${api.export.get.path}?projectId=1`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(PROJECT_SCOPE_UNSUPPORTED);
  });

  it('returns a JSON 500 when a query fails, rather than hanging', async () => {
    mockStorage.getTasks.mockRejectedValue(new Error('relation "tasks" does not exist'));
    mockStorage.getStages.mockResolvedValue([]);
    mockStorage.getSubStages.mockResolvedValue([]);

    const res = await request(app).get(api.export.get.path);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('status', 500);
  });

  it('reserves an empty projects section and an unscoped projectIds', async () => {
    stubBoard();

    const res = await request(app).get(api.export.get.path);

    expect(res.body.projects).toEqual([]);
    expect(res.body.scope.projectIds).toBeNull();
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
