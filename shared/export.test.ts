import { describe, it, expect } from 'vitest';
import type { Task, Stage, SubStage } from './schema';
import {
  buildExportBundle,
  exportFilename,
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

    expect(tasksFromExportPayload(bundle)).toEqual([task]);
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
