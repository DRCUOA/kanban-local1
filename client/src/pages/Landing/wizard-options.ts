import type { Project, Stage, Task } from '@shared/schema';
import { EFFORT_MIN, TASK_TYPE } from '@shared/constants';
import { isClosedTaskByStage } from '@shared/stage-state';
import {
  FILTER_NONE,
  goalsOnOffer,
  tasksOnOffer,
  type BoardFilters,
  type FilterId,
} from '@/lib/board-filters';

/** The wizard's three stages, in order: projects, then goals, then tasks. */
export type WizardStage = 'projects' | 'goals' | 'tasks';
export const WIZARD_STAGES: readonly WizardStage[] = ['projects', 'goals', 'tasks'];

export const STAGE_NAME: Record<WizardStage, string> = {
  projects: 'Projects',
  goals: 'Goals',
  tasks: 'Tasks',
};

/** The stage GO moves to; null on the last, where GO opens the board. */
export function nextStage(stage: WizardStage): WizardStage | null {
  return WIZARD_STAGES[WIZARD_STAGES.indexOf(stage) + 1] ?? null;
}

/**
 * The two stages not on screen, which flank GO in the nav: the earlier one on
 * the left, the later one on the right.
 */
export function otherStages(stage: WizardStage): [WizardStage, WizardStage] {
  const [left = 'projects', right = 'tasks'] = WIZARD_STAGES.filter((s) => s !== stage);
  return [left, right];
}

export interface ProjectStone {
  id: FilterId;
  name: string;
  key: string | null;
  color: string | null;
  /** Open goals in it. */
  goals: number;
  /** Open tasks in it, goals not counted. */
  tasks: number;
}

export interface GoalStone {
  id: number;
  title: string;
  projectId: number | null;
  /** Open tasks working towards it. */
  tasks: number;
}

export interface TaskStone {
  id: number;
  title: string;
  projectId: number | null;
  goalId: number | null;
  effort: number;
}

export interface WizardOptions {
  projects: ProjectStone[];
  /** Inside the chosen projects. */
  goals: GoalStone[];
  /** Inside the chosen projects and under the chosen goals. */
  tasks: TaskStone[];
}

export interface WizardOptionsInput {
  /** Every live task, all projects. */
  tasks: Task[];
  stages: Stage[];
  projects: Pick<Project, 'id' | 'name' | 'key' | 'color' | 'archived'>[];
  filters: Pick<BoardFilters, 'projects' | 'goals' | 'tasks'>;
}

function bump<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * The stones each stage of the wizard lays out. Each stage offers only what
 * the stages before it leave: goals inside the chosen projects, tasks under
 * the chosen goals. A stage with nothing chosen leaves everything, so jumping
 * past one counts it as "All".
 *
 * The counts on a stone are open work (not done, abandoned or archived), and
 * a project's goals and tasks are counted apart, so the two badges never
 * count the same card twice. An archived project is left out unless it is
 * still chosen; "No project" is offered only when it holds open work.
 */
export function wizardOptions(input: WizardOptionsInput): WizardOptions {
  const { tasks, stages, filters } = input;
  const openGoals = new Map<FilterId, number>();
  const openTasks = new Map<FilterId, number>();
  const underGoal = new Map<number, number>();
  for (const t of tasks) {
    if (t.archived || isClosedTaskByStage(t, stages)) continue;
    const project = t.projectId ?? FILTER_NONE;
    if (t.type === TASK_TYPE.GOAL) {
      bump(openGoals, project);
    } else {
      bump(openTasks, project);
      if (t.goalTaskId != null) bump(underGoal, t.goalTaskId);
    }
  }

  const projects: ProjectStone[] = input.projects
    .filter((p) => !p.archived || filters.projects.includes(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      color: p.color,
      goals: openGoals.get(p.id) ?? 0,
      tasks: openTasks.get(p.id) ?? 0,
    }));
  const loose = { goals: openGoals.get(FILTER_NONE) ?? 0, tasks: openTasks.get(FILTER_NONE) ?? 0 };
  if (loose.goals + loose.tasks > 0 || filters.projects.includes(FILTER_NONE)) {
    projects.push({ id: FILTER_NONE, name: 'No project', key: null, color: null, ...loose });
  }

  const goals = goalsOnOffer(tasks, stages, filters.projects, filters.goals).map((g) => ({
    id: g.id,
    title: g.title,
    projectId: g.projectId,
    tasks: underGoal.get(g.id) ?? 0,
  }));

  const offered = tasksOnOffer(tasks, stages, filters.projects, filters.goals, filters.tasks).map(
    (t) => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      goalId: t.goalTaskId,
      effort: t.effort ?? EFFORT_MIN,
    }),
  );

  return { projects, goals, tasks: offered };
}
