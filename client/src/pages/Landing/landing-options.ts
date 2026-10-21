import type { Owner, Project, Stage, Task } from '@shared/schema';
import { TASK_TYPE } from '@shared/constants';
import { FILTER_NONE, isNewTask, type FilterId } from '@/lib/board-filters';

export interface FilterOption<T> {
  id: T;
  label: string;
  /** Live tasks it holds, counted across the whole board. */
  count: number;
  /** The dot the header selector and the chips draw beside it. */
  color?: string | null;
}

export interface LandingOptions {
  projects: FilterOption<FilterId>[];
  goals: FilterOption<number>[];
  owners: FilterOption<FilterId>[];
  stages: FilterOption<number>[];
  /** Live tasks nobody has opened since mail made them. */
  newCount: number;
  /** Every live task: the "of M" in "Showing N of M". */
  total: number;
}

export interface LandingOptionsInput {
  /** Every live task, all projects. */
  tasks: Task[];
  projects: Pick<Project, 'id' | 'name' | 'color' | 'archived'>[];
  owners: Pick<Owner, 'id' | 'name' | 'color' | 'archived'>[];
  stages: Stage[];
  /** The project row's choice, so the goal row offers only goals inside it. */
  projectSelection: FilterId[];
  /** Kept on offer while chosen, even if archived, so they can be unticked. */
  selected: { projects: FilterId[]; owners: FilterId[] };
}

function countBy<K>(tasks: Task[], key: (task: Task) => K): Map<K, number> {
  const counts = new Map<K, number>();
  for (const task of tasks) counts.set(key(task), (counts.get(key(task)) ?? 0) + 1);
  return counts;
}

/**
 * The choices each row of the landing page offers, with their counts. The
 * counts are of the whole board, not of what the other rows leave, so a
 * number does not move under the box being ticked; the "Showing N" line is
 * where the rows meet.
 *
 * Archived projects and owners are left out, as they are from the header
 * selector and the More menu, unless one is still chosen. "No project" and
 * "Unassigned" close their rows, the way the selector and the menu end.
 */
export function landingOptions(input: LandingOptionsInput): LandingOptions {
  const { tasks } = input;
  const byProject = countBy(tasks, (t) => t.projectId ?? FILTER_NONE);
  const byOwner = countBy(tasks, (t) => t.ownerId ?? FILTER_NONE);
  const byStage = countBy(tasks, (t) => t.stageId);

  const projects: FilterOption<FilterId>[] = [
    ...input.projects
      .filter((p) => !p.archived || input.selected.projects.includes(p.id))
      .map((p) => ({ id: p.id, label: p.name, count: byProject.get(p.id) ?? 0, color: p.color })),
    { id: FILTER_NONE, label: 'No project', count: byProject.get(FILTER_NONE) ?? 0 },
  ];

  const owners: FilterOption<FilterId>[] = [
    ...input.owners
      .filter((o) => !o.archived || input.selected.owners.includes(o.id))
      .map((o) => ({ id: o.id, label: o.name, count: byOwner.get(o.id) ?? 0, color: o.color })),
    { id: FILTER_NONE, label: 'Unassigned', count: byOwner.get(FILTER_NONE) ?? 0 },
  ];

  const goals = goalsInProjects(tasks, input.projectSelection).map((goal) => ({
    id: goal.id,
    label: goal.title,
    count: tasks.filter((t) => t.id === goal.id || t.goalTaskId === goal.id).length,
  }));

  const stages = [...input.stages]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, label: s.name.trim(), count: byStage.get(s.id) ?? 0 }));

  return {
    projects,
    goals,
    owners,
    stages,
    newCount: tasks.filter(isNewTask).length,
    total: tasks.length,
  };
}

/** Live goals inside the chosen projects (every project when none is chosen), by title. */
export function goalsInProjects(tasks: Task[], projectSelection: FilterId[]): Task[] {
  return tasks
    .filter(
      (t) =>
        t.type === TASK_TYPE.GOAL &&
        !t.archived &&
        (projectSelection.length === 0 || projectSelection.includes(t.projectId ?? FILTER_NONE)),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
}
