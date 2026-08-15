// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { Task, Stage } from '@shared/schema';
import { buildExportBundle } from '@shared/export';
import { buildShareContent, describeShareScope, shareFilename } from './task-share';

const NOW = new Date(2026, 7, 15, 12, 0, 0);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 42,
    title: 'Design homepage',
    description: '<p>Wireframe the <strong>hero</strong> section.</p>',
    stageId: 2,
    archived: false,
    status: 'in_progress',
    priority: 'high',
    effort: 3,
    dueDate: new Date(2026, 7, 20),
    updatedAt: new Date(2026, 7, 12),
    createdAt: new Date(2026, 7, 10),
    tags: ['design'],
    parentTaskId: null,
    recurrence: 'none',
    history: null,
    owner: 'Rich',
    ...overrides,
  } as Task;
}

const stages: Stage[] = [
  { id: 1, name: 'To Do', order: 1, color: null, createdAt: new Date() },
  { id: 2, name: 'In Progress', order: 2, color: null, createdAt: new Date() },
] as Stage[];

function tasksScope(tasks: Task[]) {
  return { type: 'tasks', tasks, stages } as const;
}

function boardScope() {
  const bundle = buildExportBundle({
    tasks: [makeTask({ id: 1, title: 'One', stageId: 1 }), makeTask({ id: 2, title: 'Two' })],
    stages,
    subStages: [],
    includeArchived: false,
    exportedAt: '2026-08-15T00:00:00.000Z',
  });
  return { scope: { type: 'board', bundle } as const, bundle };
}

describe('buildShareContent — tasks scope', () => {
  it('renders a single task as the email-style plain text with its stage name', () => {
    const content = buildShareContent(tasksScope([makeTask()]), 'text', NOW);

    expect(content.mimeType).toBe('text/plain');
    expect(content.text).toContain('Subject: Task: Design homepage');
    expect(content.text).toContain('Here is a task from my board:');
    expect(content.text).toContain('In Progress');
    expect(content.html).toBeDefined();
  });

  it('renders several tasks as clearly separated plain-text entries', () => {
    const tasks = [
      makeTask({ id: 1, title: 'First task', stageId: 1 }),
      makeTask({ id: 2, title: 'Second task' }),
      makeTask({ id: 3, title: 'Third task' }),
    ];
    const content = buildShareContent(tasksScope(tasks), 'text', NOW);

    expect(content.text).toContain('Here are 3 tasks from my board:');
    expect(content.text).toContain('First task');
    expect(content.text).toContain('Second task');
    expect(content.text).toContain('Third task');
    // Entries are separated by a horizontal rule: one between each pair.
    expect(content.text.match(/^-{40}$/gm)).toHaveLength(2);
    expect(content.text).toContain('3 tasks (#1, #2, #3)');
  });

  it('renders tasks as a parseable JSON array preserving ids and titles', () => {
    const tasks = [makeTask({ id: 1, title: 'First' }), makeTask({ id: 2, title: 'Second' })];
    const content = buildShareContent(tasksScope(tasks), 'json', NOW);

    expect(content.mimeType).toBe('application/json');
    expect(content.html).toBeUndefined();
    const parsed = JSON.parse(content.text) as { id: number; title: string }[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.map((t) => t.id)).toEqual([1, 2]);
    expect(parsed[0]?.title).toBe('First');
  });

  it('exports a single task as a one-element JSON array', () => {
    const content = buildShareContent(tasksScope([makeTask()]), 'json', NOW);
    const parsed = JSON.parse(content.text) as unknown[];
    expect(parsed).toHaveLength(1);
  });
});

describe('buildShareContent — board scope', () => {
  it('emits the exact export bundle as JSON', () => {
    const { scope, bundle } = boardScope();
    const content = buildShareContent(scope, 'json', NOW);

    expect(content.text).toBe(JSON.stringify(bundle, null, 2));
    expect(content.filename).toBe('taskflow-export-2026-08-15.json');
  });

  it('groups the plain-text board export by stage', () => {
    const { scope } = boardScope();
    const content = buildShareContent(scope, 'text', NOW);

    expect(content.text).toContain('Kanban board export');
    expect(content.text).toContain('== To Do (1) ==');
    expect(content.text).toContain('== In Progress (1) ==');
    expect(content.text.indexOf('One')).toBeLessThan(content.text.indexOf('Two'));
    expect(content.filename).toBe('taskflow-export-2026-08-15.txt');
  });

  it('keeps tasks whose stage is missing under a "No stage" heading', () => {
    const { scope } = boardScope();
    const orphaned = {
      ...scope,
      bundle: {
        ...scope.bundle,
        tasks: [...scope.bundle.tasks, makeTask({ id: 9, title: 'Orphan', stageId: 99 })],
      },
    };
    const content = buildShareContent(orphaned, 'text', NOW);
    expect(content.text).toContain('== No stage (1) ==');
    expect(content.text).toContain('Orphan');
  });
});

describe('shareFilename', () => {
  it('names a single-task file after the task id and slug', () => {
    expect(shareFilename(tasksScope([makeTask()]), 'text', NOW)).toBe(
      'taskflow-task-42-design-homepage.txt',
    );
    expect(shareFilename(tasksScope([makeTask()]), 'json', NOW)).toBe(
      'taskflow-task-42-design-homepage.json',
    );
  });

  it('handles titles that slugify to nothing', () => {
    expect(shareFilename(tasksScope([makeTask({ title: '!!!' })]), 'json', NOW)).toBe(
      'taskflow-task-42.json',
    );
  });

  it('names a multi-task file with count and date', () => {
    const two = tasksScope([makeTask({ id: 1 }), makeTask({ id: 2 })]);
    expect(shareFilename(two, 'text', NOW)).toBe('taskflow-tasks-2-2026-08-15.txt');
  });
});

describe('describeShareScope', () => {
  it('describes each scope for toasts', () => {
    expect(describeShareScope(tasksScope([makeTask()]))).toBe('task #42');
    expect(describeShareScope(tasksScope([makeTask({ id: 1 }), makeTask({ id: 2 })]))).toBe(
      '2 tasks',
    );
    expect(describeShareScope(boardScope().scope)).toBe('the board export');
  });
});
