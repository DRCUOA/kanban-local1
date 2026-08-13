import { describe, it, expect } from 'vitest';
import type { Task, Stage, SubStage } from './schema';
import {
  buildExportBundle,
  exportFilename,
  exportQuerySchema,
  tasksFromExportPayload,
  taskExportBundleSchema,
  EXPORT_FORMAT_VERSION,
} from './export';

const task = { id: 1, title: 'A' } as unknown as Task;
const stage = { id: 1, name: 'Backlog' } as unknown as Stage;
const subStage = { id: 1, tag: 'day-plan-am' } as unknown as SubStage;

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
    expect(bundle.counts).toEqual({ tasks: 1, stages: 1, subStages: 1, projects: 0 });
    expect(bundle.scope).toEqual({ includeArchived: true, projectIds: null });
    expect(bundle.projects).toEqual([]);
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
