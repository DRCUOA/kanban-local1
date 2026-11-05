import { describe, it, expect } from 'vitest';
import type { Task, Stage, SubStage, Project } from './schema';
import {
  buildExportBundle,
  buildTaskTransferBundle,
  exportFilename,
  exportQuerySchema,
  tasksFromExportPayload,
  taskExportBundleSchema,
  EXPORT_FORMAT_VERSION,
} from './export';

const task = { id: 1, title: 'A' } as unknown as Task;
const stage = { id: 1, name: 'Backlog' } as unknown as Stage;
const subStage = { id: 1, tag: 'day-plan-am' } as unknown as SubStage;
const project = { id: 3, name: 'Alpha', key: 'ALP' } as unknown as Project;

describe('buildExportBundle', () => {
  it('produces a valid envelope with counts derived from the payload', () => {
    const bundle = buildExportBundle({
      tasks: [task],
      stages: [stage],
      subStages: [subStage],
      includeArchived: true,
      exportedAt: '2026-08-11T09:00:00.000Z',
    });

    expect(taskExportBundleSchema.safeParse(bundle).success).toBe(true);
    expect(bundle.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(bundle.counts).toEqual({
      tasks: 1,
      stages: 1,
      subStages: 1,
      projects: 0,
      attachments: 0,
    });
    expect(bundle.scope).toEqual({
      includeArchived: true,
      projectIds: null,
      includeAttachments: false,
    });
    expect(bundle.projects).toEqual([]);
  });

  it('carries every project and names the project ids a scoped export was cut to', () => {
    const bundle = buildExportBundle({
      tasks: [{ ...task, projectId: 3 } as unknown as Task],
      stages: [stage],
      subStages: [subStage],
      projects: [project],
      includeArchived: false,
      projectIds: [3],
      exportedAt: '2026-08-11T09:00:00.000Z',
    });

    expect(taskExportBundleSchema.safeParse(bundle).success).toBe(true);
    expect(bundle.projects).toEqual([project]);
    expect(bundle.counts.projects).toBe(1);
    expect(bundle.scope.projectIds).toEqual([3]);
  });

  it('annotates every task with urgency and attaches a briefing digest', () => {
    const overdue = {
      id: 142,
      title: 'Check remaining gas',
      stageId: 2,
      archived: false,
      status: 'in_progress',
      priority: 'normal',
      // As production stores it: the picked day at NZ local midnight, i.e. the
      // day *before* the label in UTC. See `duePicked` in briefing.test.ts.
      dueDate: new Date('2026-08-09T00:00:00+12:00'),
      tags: ['Rich'],
      owner: 'Moi',
    } as unknown as Task;
    const inProgressStage = { id: 2, name: 'In Progress' } as unknown as Stage;

    const bundle = buildExportBundle({
      tasks: [overdue],
      stages: [inProgressStage],
      subStages: [{ id: 7, stageId: 2, name: 'Rich', tag: 'Rich' } as unknown as SubStage],
      includeArchived: false,
      exportedAt: new Date('2026-08-11T19:46:00+12:00').toISOString(),
      timezone: 'Pacific/Auckland',
    });

    const [annotated] = bundle.tasks;
    expect(annotated?.urgency).toMatchObject({
      isOverdue: true,
      mustSurface: true,
      // The labeled day, not the 2026-08-08 date part of the stored instant.
      dueDay: '2026-08-09',
    });
    expect(bundle.briefing.overdue.map((e) => e.dueDay)).toEqual(['2026-08-09']);
    expect(bundle.briefing.overdue.map((e) => e.id)).toEqual([142]);
    expect(bundle.briefing.timezone).toBe('Pacific/Auckland');
    expect(taskExportBundleSchema.safeParse(bundle).success).toBe(true);
  });

  it('cuts urgency against exportedAt so the envelope cannot disagree with itself', () => {
    const bundle = buildExportBundle({
      tasks: [task],
      stages: [stage],
      subStages: [subStage],
      includeArchived: false,
      exportedAt: '2026-08-11T09:00:00.000Z',
    });

    expect(bundle.briefing.now).toBe(bundle.exportedAt);
  });

  it('cuts the day in New Zealand when no zone is named', () => {
    // 07:00 NZT on 13 Aug; the host zone (and the server's UTC) is still 12 Aug.
    const bundle = buildExportBundle({
      tasks: [task],
      stages: [stage],
      subStages: [subStage],
      includeArchived: false,
      exportedAt: new Date('2026-08-13T07:00:00+12:00').toISOString(),
    });

    expect(bundle.briefing.timezone).toBe('Pacific/Auckland');
    expect(bundle.briefing.generatedFor).toBe('2026-08-13');
    expect(bundle.briefing.overdueRule).toContain('Pacific/Auckland');
  });

  it('lets a caller cut the day in another zone', () => {
    const bundle = buildExportBundle({
      tasks: [task],
      stages: [stage],
      subStages: [subStage],
      includeArchived: false,
      exportedAt: new Date('2026-08-13T07:00:00+12:00').toISOString(),
      timezone: 'UTC',
    });

    expect(bundle.briefing.timezone).toBe('UTC');
    expect(bundle.briefing.generatedFor).toBe('2026-08-12');
  });

  it('gives the client fallback and the route the same bundle', () => {
    // The fallback in use-task-import-export.ts passes no timezone; the route
    // passes the query default. If those ever diverge, the same board exports
    // as two different files depending on which path produced it.
    const input = {
      tasks: [task],
      stages: [stage],
      subStages: [subStage],
      includeArchived: false,
      exportedAt: '2026-08-12T19:00:00.000Z',
    };

    const fallback = buildExportBundle(input);
    const route = buildExportBundle({ ...input, timezone: exportQuerySchema.parse({}).tz });

    expect(JSON.stringify(fallback)).toBe(JSON.stringify(route));
  });
});

describe('exportQuerySchema', () => {
  it('defaults the zone to New Zealand', () => {
    expect(exportQuerySchema.parse({}).tz).toBe('Pacific/Auckland');
  });

  it('accepts an IANA zone', () => {
    expect(exportQuerySchema.parse({ tz: 'Europe/London' }).tz).toBe('Europe/London');
  });

  it('rejects a zone the runtime does not know', () => {
    // Better a 400 than a silent fallback: a briefing cut in the wrong zone
    // looks correct and is a day out.
    expect(exportQuerySchema.safeParse({ tz: 'Middle/Earth' }).success).toBe(false);
  });

  it('reads projectId as a positive integer and leaves it undefined when absent', () => {
    expect(exportQuerySchema.parse({}).projectId).toBeUndefined();
    expect(exportQuerySchema.parse({ projectId: '12' }).projectId).toBe(12);
  });

  it('rejects a projectId that is not a numeric id', () => {
    expect(exportQuerySchema.safeParse({ projectId: 'none' }).success).toBe(false);
    expect(exportQuerySchema.safeParse({ projectId: '0' }).success).toBe(false);
    expect(exportQuerySchema.safeParse({ projectId: 'alpha' }).success).toBe(false);
  });
});

describe('tasksFromExportPayload', () => {
  it('reads tasks out of an export envelope', () => {
    const bundle = buildExportBundle({
      tasks: [task],
      stages: [],
      subStages: [],
      includeArchived: false,
      exportedAt: '2026-08-11T09:00:00.000Z',
    });

    // Exported tasks carry a derived `urgency` block; every stored field is
    // still present and unmodified, which is all an importer reads.
    expect(tasksFromExportPayload(bundle)).toMatchObject([task]);
  });

  it('accepts legacy bare-array export files', () => {
    expect(tasksFromExportPayload([task])).toEqual([task]);
  });

  it('accepts an envelope with no tasks', () => {
    expect(tasksFromExportPayload({ tasks: [] })).toEqual([]);
  });

  it('rejects payloads that carry no task list', () => {
    expect(tasksFromExportPayload({ stages: [stage] })).toBeNull();
    expect(tasksFromExportPayload({ tasks: 'nope' })).toBeNull();
    expect(tasksFromExportPayload('nope')).toBeNull();
    expect(tasksFromExportPayload(null)).toBeNull();
  });
});

describe('exportFilename', () => {
  it('names the file after the export date', () => {
    expect(exportFilename('2026-08-11T09:00:00.000Z')).toBe('taskflow-export-2026-08-11.json');
  });
});

describe('buildTaskTransferBundle', () => {
  const stages = [
    { id: 1, name: 'Backlog', kind: 'backlog' },
    { id: 2, name: 'In Progress', kind: 'in_progress' },
  ] as unknown as Stage[];
  const subStages = [
    { id: 7, stageId: 1, name: 'Later', tag: 'Later' },
    { id: 8, stageId: 2, name: 'Doing', tag: 'TK' },
  ] as unknown as SubStage[];
  const projects = [
    { id: 3, name: 'StageBoard', key: 'S&G-SB', taskCount: 12 },
    { id: 4, name: 'Business Setup', key: 'TK', taskCount: 5 },
  ] as unknown as (Project & { taskCount: number })[];
  const transferred = {
    id: 392,
    title: 'Set up change management',
    description: '<p>Customer is <strong>now</strong> using the system</p>',
    stageId: 2,
    projectId: 3,
    archived: false,
    priority: 'critical',
    type: null,
    goalTaskId: null,
    effort: 4,
    dueDate: new Date('2026-11-06T00:00:00+13:00'),
    tags: ['TK', 'change-control'],
    parentTaskId: null,
    recurrence: 'none',
    history: [{ status: 'backlog', timestamp: '2026-11-01T00:00:00.000Z' }],
    ownerId: 20,
    owner: 'TK Workflow IT',
    deletedAt: null,
    viewedAt: null,
  } as unknown as Task;

  const build = (task: Task = transferred) =>
    buildTaskTransferBundle({
      task,
      stages,
      subStages,
      projects,
      exportedAt: '2026-11-05T09:00:00.000Z',
    });

  it('writes the envelope the addtask skill names, with no briefing', () => {
    const bundle = build();

    expect(taskExportBundleSchema.safeParse(bundle).success).toBe(true);
    expect(bundle.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(bundle.generator).toBe('kanban-local');
    expect(bundle.exportedAt).toBe('2026-11-05T09:00:00.000Z');
    expect(bundle.scope).toEqual({
      includeArchived: false,
      projectIds: null,
      includeAttachments: false,
    });
    expect(bundle.counts).toEqual({
      tasks: 1,
      stages: 2,
      subStages: 2,
      projects: 1,
      attachments: 0,
    });
    expect(bundle.dependencies).toEqual([]);
    expect(bundle.attachments).toEqual([]);
    expect(bundle).not.toHaveProperty('briefing');
  });

  it('carries every stage and sub-stage, but only the project the task uses', () => {
    const bundle = build();

    expect(bundle.stages).toEqual(stages);
    expect(bundle.subStages).toEqual(subStages);
    // The summary's live count is not a project field the format carries.
    expect(bundle.projects).toEqual([{ id: 3, name: 'StageBoard', key: 'S&G-SB' }]);
  });

  it('has no project for a task without one', () => {
    const bundle = build({ ...transferred, projectId: null });

    expect(bundle.projects).toEqual([]);
    expect(bundle.counts.projects).toBe(0);
  });

  it('keeps every stored task field and adds the urgency block', () => {
    const [task] = build().tasks;

    expect(task).toMatchObject(transferred);
    expect(task?.urgency.dueDay).toBe('2026-11-06');
    expect(typeof task?.urgency.dueBucket).toBe('string');
    expect(typeof task?.urgency.briefingRank).toBe('number');
    expect(typeof task?.urgency.mustSurface).toBe('boolean');
  });

  it('survives the clipboard and reads back as the one task the importer takes', () => {
    const payload: unknown = JSON.parse(JSON.stringify(build()));
    const imported = tasksFromExportPayload(payload) as Record<string, unknown>[];

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      title: 'Set up change management',
      stageId: 2,
      projectId: 3,
      owner: 'TK Workflow IT',
    });
    expect(imported[0]?.dueDate).toBe('2026-11-05T11:00:00.000Z');
  });
});
