import { describe, it, expect } from 'vitest';
import type { Stage, SubStage, Task } from './schema';
import { allocateDaySheetLines, buildDaySheet, laneDaySheetSection } from './day-sheet';
import { assignTasksToLanes } from './lanes';

// 2 pm on Friday 6 Nov 2026 in Auckland (NZDT, UTC+13). A due date is stored
// as the labelled day's local midnight, so "6 Nov" is 5 Nov 11:00 UTC.
const NOW = new Date('2026-11-06T01:00:00.000Z');
const DUE_5_NOV = new Date('2026-11-04T11:00:00.000Z');
const DUE_6_NOV = new Date('2026-11-05T11:00:00.000Z');
const DUE_7_NOV = new Date('2026-11-06T11:00:00.000Z');
const DUE_20_NOV = new Date('2026-11-19T11:00:00.000Z');

const stage = (id: number, kind: string, order = id): Stage => ({
  id,
  name: kind,
  order,
  kind,
  color: null,
  createdAt: null,
});

const BACKLOG = stage(1, 'backlog');
const DOING = stage(2, 'in_progress');
const WAITING = stage(3, 'waiting');
const DONE = stage(4, 'done');
const STAGES = [BACKLOG, DOING, WAITING, DONE];
const OPEN_COLUMNS = [BACKLOG, DOING, WAITING];

const lane = (
  overrides: Partial<SubStage> & Pick<SubStage, 'id' | 'stageId' | 'tag'>,
): SubStage => ({
  name: overrides.tag,
  bgClass: '',
  opacity: 0,
  order: overrides.id,
  ownerId: null,
  daySheetSection: null,
  createdAt: null,
  ...overrides,
});

const task = (overrides: Partial<Task> & Pick<Task, 'id'>): Task =>
  ({
    title: `Task ${overrides.id}`,
    stageId: BACKLOG.id,
    archived: false,
    deletedAt: null,
    priority: 'normal',
    dueDate: null,
    tags: null,
    owner: null,
    ownerId: null,
    projectId: null,
    ...overrides,
  }) as Task;

const ids = (groups: ReturnType<typeof buildDaySheet>) =>
  Object.fromEntries(groups.map((g) => [g.section, g.tasks.map((t) => t.id)]));

describe('buildDaySheet', () => {
  it('always returns Do now, Next and Later in that order', () => {
    const groups = buildDaySheet({
      tasks: [],
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages: [],
      now: NOW,
    });
    expect(groups.map((g) => [g.section, g.label])).toEqual([
      ['now', 'Do now'],
      ['next', 'Next'],
      ['later', 'Later'],
    ]);
  });

  it('follows the column kind where a column has no lanes', () => {
    const groups = buildDaySheet({
      tasks: [
        task({ id: 1, stageId: BACKLOG.id }),
        task({ id: 2, stageId: DOING.id }),
        task({ id: 3, stageId: WAITING.id }),
      ],
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages: [],
      now: NOW,
    });
    expect(ids(groups)).toEqual({ now: [2], next: [1], later: [3] });
  });

  it("uses a lane's own setting, and the column kind when it has none", () => {
    const subStages = [
      lane({ id: 10, stageId: BACKLOG.id, tag: 'next', daySheetSection: null }),
      lane({ id: 11, stageId: BACKLOG.id, tag: 'later', daySheetSection: 'later' }),
      lane({ id: 12, stageId: BACKLOG.id, tag: 'today', daySheetSection: 'now' }),
    ];
    const groups = buildDaySheet({
      tasks: [
        task({ id: 1, tags: ['next'] }),
        task({ id: 2, tags: ['later'] }),
        task({ id: 3, tags: ['today'] }),
      ],
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages,
      now: NOW,
    });
    expect(ids(groups)).toEqual({ now: [3], next: [1], later: [2] });
  });

  it('prints a task under the lane the board draws it in', () => {
    // Last matching tag wins, an owner lane beats tags, an untagged task falls
    // into the first lane that is nobody's.
    const subStages = [
      lane({ id: 10, stageId: BACKLOG.id, tag: 'inbox', daySheetSection: 'now' }),
      lane({ id: 11, stageId: BACKLOG.id, tag: 'later', daySheetSection: 'later' }),
      lane({ id: 12, stageId: BACKLOG.id, tag: 'rich', ownerId: 7, daySheetSection: 'next' }),
    ];
    const groups = buildDaySheet({
      tasks: [
        task({ id: 1, tags: ['later', 'inbox'] }),
        task({ id: 2, tags: ['inbox', 'later'] }),
        task({ id: 3, tags: ['later'], ownerId: 7 }),
        task({ id: 4 }),
      ],
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages,
      now: NOW,
    });
    expect(ids(groups)).toEqual({ now: [1, 4], next: [3], later: [2] });
  });

  it('uses the column kind for tasks drawn above lanes that all belong to someone', () => {
    const subStages = [
      lane({ id: 10, stageId: DOING.id, tag: 'rich', ownerId: 7, daySheetSection: 'later' }),
    ];
    const groups = buildDaySheet({
      tasks: [task({ id: 1, stageId: DOING.id }), task({ id: 2, stageId: DOING.id, ownerId: 7 })],
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages,
      now: NOW,
    });
    expect(ids(groups)).toEqual({ now: [1], next: [], later: [2] });
  });

  it('puts overdue and due-today work under Do now whatever its lane says', () => {
    const subStages = [
      lane({ id: 11, stageId: BACKLOG.id, tag: 'later', daySheetSection: 'later' }),
    ];
    const groups = buildDaySheet({
      tasks: [
        task({ id: 1, tags: ['later'], dueDate: DUE_5_NOV }),
        task({ id: 2, tags: ['later'], dueDate: DUE_6_NOV }),
        task({ id: 3, tags: ['later'], dueDate: DUE_7_NOV }),
      ],
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages,
      now: NOW,
    });
    expect(ids(groups)).toEqual({ now: [1, 2], next: [], later: [3] });
  });

  it('does not lift a closed task that is past due', () => {
    const groups = buildDaySheet({
      tasks: [task({ id: 1, stageId: DONE.id, dueDate: DUE_5_NOV })],
      columnStages: [...OPEN_COLUMNS, DONE],
      stages: STAGES,
      subStages: [],
      now: NOW,
    });
    expect(ids(groups)).toEqual({ now: [], next: [], later: [1] });
  });

  it('leaves out tasks in columns the board does not draw', () => {
    const groups = buildDaySheet({
      tasks: [task({ id: 1, stageId: DONE.id }), task({ id: 2 })],
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages: [],
      now: NOW,
    });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([2]);
  });

  it('orders each section soonest due first, undated last, then by id', () => {
    const groups = buildDaySheet({
      tasks: [
        task({ id: 5 }),
        task({ id: 4, dueDate: DUE_20_NOV }),
        task({ id: 3 }),
        task({ id: 2, dueDate: DUE_7_NOV }),
      ],
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages: [],
      now: NOW,
    });
    expect(ids(groups).next).toEqual([2, 4, 3, 5]);
  });

  it('prints each task exactly once', () => {
    const subStages = [
      lane({ id: 10, stageId: BACKLOG.id, tag: 'a' }),
      lane({ id: 11, stageId: DOING.id, tag: 'b', ownerId: 9 }),
    ];
    const tasks = Array.from({ length: 30 }, (_, i) =>
      task({
        id: i + 1,
        stageId: [BACKLOG.id, DOING.id, WAITING.id][i % 3],
        tags: i % 2 ? ['a', 'b'] : null,
        ownerId: i % 4 === 0 ? 9 : null,
        dueDate: i % 5 === 0 ? DUE_6_NOV : null,
      }),
    );
    const groups = buildDaySheet({
      tasks,
      columnStages: OPEN_COLUMNS,
      stages: STAGES,
      subStages,
      now: NOW,
    });
    const printed = groups.flatMap((g) => g.tasks.map((t) => t.id)).sort((a, b) => a - b);
    expect(printed).toEqual(tasks.map((t) => t.id));
  });
});

describe('laneDaySheetSection', () => {
  it('ignores a stored value it does not know', () => {
    expect(laneDaySheetSection({ daySheetSection: 'someday' }, WAITING)).toBe('later');
    expect(laneDaySheetSection({ daySheetSection: null }, DOING)).toBe('now');
    expect(laneDaySheetSection({ daySheetSection: 'next' }, DOING)).toBe('next');
  });
});

describe('assignTasksToLanes', () => {
  it('reports no catch-all lane when every lane is a person', () => {
    const result = assignTasksToLanes(
      [
        { ownerId: 1, tag: 'a' },
        { ownerId: 2, tag: 'b' },
      ],
      [task({ id: 1, ownerId: 2 }), task({ id: 2, tags: ['a'] })],
    );
    expect(result.catchAllIndex).toBe(-1);
    expect(result.laneTasks.map((l) => l.map((t) => t.id))).toEqual([[], [1]]);
    expect(result.unlaned.map((t) => t.id)).toEqual([2]);
  });
});

describe('allocateDaySheetLines', () => {
  it('shows everything when it fits', () => {
    expect(allocateDaySheetLines([[10, 10], [10], [10, 10, 10]], 60, 8)).toEqual([2, 1, 3]);
  });

  it('cuts from the fullest section first, the later one on a tie', () => {
    // 6 lines of 10 = 60. A first cut saves 10 and adds an 8 row: 58.
    expect(
      allocateDaySheetLines(
        [
          [10, 10],
          [10, 10],
          [10, 10],
        ],
        58,
        8,
      ),
    ).toEqual([2, 2, 1]);
    // Then Do now and Next tie on 2, and Next is the later: 56.
    expect(
      allocateDaySheetLines(
        [
          [10, 10],
          [10, 10],
          [10, 10],
        ],
        56,
        8,
      ),
    ).toEqual([2, 1, 1]);
    // Down to one each, and Later goes first: 44.
    expect(
      allocateDaySheetLines(
        [
          [10, 10],
          [10, 10],
          [10, 10],
        ],
        45,
        8,
      ),
    ).toEqual([1, 1, 0]);
  });

  it('counts the "+ N more" row once per cut section', () => {
    const shown = allocateDaySheetLines([[10, 10, 10, 10], [10], []], 38, 8);
    // 4 + 1 lines = 50. Cutting Do now twice: 50 - 20 + 8 = 38.
    expect(shown).toEqual([2, 1, 0]);
  });

  it('respects measured line heights, so a two-line title costs more', () => {
    expect(allocateDaySheetLines([[10], [10, 25]], 30, 4)).toEqual([1, 1]);
  });

  it('stops at zero rather than looping when nothing fits', () => {
    expect(allocateDaySheetLines([[10], [10]], 0, 8)).toEqual([0, 0]);
  });
});
