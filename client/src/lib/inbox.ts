import type { Task } from '@shared/schema';

/**
 * The inbox at the top of the landing page: tasks mail made that nobody has
 * opened. `tasks.viewed_at` is null only for those (createEmailTasks leaves it
 * so); opening the task dialog stamps it, and the task leaves the inbox.
 */
export function isNewTask(task: Pick<Task, 'viewedAt'>): boolean {
  return task.viewedAt === null;
}

const arrived = (task: Task): number => (task.createdAt ? new Date(task.createdAt).getTime() : 0);

/** The live tasks still in the inbox, newest first. */
export function inboxTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.archived && isNewTask(t)).sort((a, b) => arrived(b) - arrived(a));
}
