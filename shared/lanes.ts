import type { Task } from './schema';

/** What a lane is matched by: its owner (a person's lane) or its tag. */
export interface LaneKey {
  ownerId: number | null;
  tag: string;
}

export interface LaneAssignment<T> {
  /** One list per lane, in the order the lanes were given. */
  laneTasks: T[][];
  /** Tasks no lane claims. */
  unlaned: T[];
  /**
   * The lane unlaned tasks are drawn in: the first lane that is not somebody's.
   * -1 when every lane in the stage belongs to someone, and the board draws
   * them above the lanes instead.
   */
  catchAllIndex: number;
}

/**
 * Splits one stage's tasks across its lanes, the way the board draws them.
 * The board and the day sheet both read this, so a task prints under the lane
 * it is seen in.
 *
 * A person's lane contains exactly the tasks in this stage that owner owns,
 * by foreign key — its tag is not read (EPIC-06 OWN-R11, OWN-R16). Every
 * other lane still matches tags: a task may carry more than one (stale tags
 * from earlier moves, shared tag strings), and the last matching one wins
 * because drag/drop appends the newest assignment at the end. Order within
 * each list is the order the tasks arrived in.
 */
export function assignTasksToLanes<T extends Pick<Task, 'ownerId' | 'tags'>>(
  lanes: readonly LaneKey[],
  tasks: readonly T[],
): LaneAssignment<T> {
  const tagLaneTags = lanes.filter((lane) => lane.ownerId == null).map((lane) => lane.tag);
  const laneTasks: T[][] = lanes.map(() => []);
  const unlaned: T[] = [];

  for (const task of tasks) {
    const ownLaneIndex =
      task.ownerId == null ? -1 : lanes.findIndex((lane) => lane.ownerId === task.ownerId);
    if (ownLaneIndex !== -1) {
      laneTasks[ownLaneIndex]?.push(task);
      continue;
    }

    const tags = Array.isArray(task.tags) ? task.tags : [];
    const assignedTag = [...tags].reverse().find((tag) => tagLaneTags.includes(tag));
    if (assignedTag === undefined) {
      unlaned.push(task);
      continue;
    }
    const laneIndex = lanes.findIndex((lane) => lane.ownerId == null && lane.tag === assignedTag);
    laneTasks[laneIndex]?.push(task);
  }

  // Putting unlaned tasks in a person's lane would claim they belong to that
  // person, so they fall into the first lane that is nobody's.
  const catchAllIndex = lanes.findIndex((lane) => lane.ownerId == null);

  return { laneTasks, unlaned, catchAllIndex };
}
