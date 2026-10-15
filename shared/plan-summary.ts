import { addDays, differenceInCalendarDays, format } from 'date-fns';
import type { Schedule, ScheduledItem } from './schedule';
import type { Task } from './schema';
import type { OutsideWait } from './goal-view';

/**
 * A goal's plan in words: a short write-up and a step-by-step summary, built
 * from the same schedule the critical path diagram and Gantt chart draw, so
 * the text and the pictures cannot disagree.
 */

export interface PlanStep {
  n: number;
  id: number;
  title: string;
  /** "Starts 16 Oct, takes 2 days, finishes 18 Oct." or "Done." */
  when: string;
  /** "On the critical path." or "Can slip 4 days." */
  slack: string;
  critical: boolean;
  done: boolean;
  /** Plain-language notes: what it waits for, outside waits, a missed due date. */
  notes: string[];
}

export interface PlanSummary {
  /** Paragraphs of the write-up, each one or more full sentences. */
  paragraphs: string[];
  steps: PlanStep[];
}

const days = (n: number): string => `${n} day${n === 1 ? '' : 's'}`;
const fmt = (d: Date): string => format(d, 'EEE d MMM');

/** "A", "A and B", "A, B and C". */
export function listInWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

export function summarisePlan(input: {
  schedule: Schedule;
  tasks: Task[];
  anchor: Date;
  waits?: Map<number, OutsideWait[]>;
  /** 'critical': steps on the path first; 'gantt': steps in date order. */
  order: 'critical' | 'gantt';
}): PlanSummary {
  const { schedule, tasks, anchor, waits } = input;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const title = (id: number) => byId.get(id)?.title ?? `#${id}`;
  const items = schedule.order;
  const done = items.filter((i) => i.duration === 0);
  const open = items.filter((i) => i.duration > 0);
  const paragraphs: string[] = [];

  if (items.length === 0)
    return { paragraphs: ['This goal has no building-blocks yet.'], steps: [] };

  // 1. The headline.
  if (open.length === 0) {
    paragraphs.push(
      items.length === 1
        ? 'Its one building-block is done, so there is nothing left to schedule.'
        : `All ${items.length} building-blocks are done, so there is nothing left to schedule.`,
    );
  } else {
    const finish = addDays(anchor, schedule.length);
    paragraphs.push(
      `This goal has ${items.length} building-block${items.length === 1 ? '' : 's'}` +
        `${done.length ? `, ${done.length} of them done` : ''}. ` +
        `The work still to do takes ${days(schedule.length)} end to end if it starts today, ` +
        `which finishes around ${format(finish, 'EEEE d MMMM')}.`,
    );
  }

  // 2. The critical path.
  const path = schedule.criticalPath;
  if (path.length > 0) {
    const chain = listInWords(path.map((i) => title(i.id)));
    paragraphs.push(
      path.length === 1
        ? `${title(path[0]?.id ?? 0)} sets that date on its own: every day it slips, the goal slips.`
        : `The date is set by one chain of work: ${chain}, each starting when the one before it ends. A day lost anywhere on that chain is a day lost on the goal.`,
    );
  }

  // 3. Room to move, and work side by side.
  const slack = open.filter((i) => !i.critical).sort((a, b) => b.slack - a.slack);
  if (slack.length > 0) {
    const named = slack.slice(0, 3).map((i) => `${title(i.id)} (${days(i.slack)})`);
    paragraphs.push(
      `${slack.length === 1 ? 'One task has' : `${slack.length} tasks have`} room to move without changing the finish: ${listInWords(named)}${slack.length > 3 ? ', among others' : ''}.`,
    );
  }
  const startsTogether = new Map<number, ScheduledItem[]>();
  for (const i of open) startsTogether.set(i.start, [...(startsTogether.get(i.start) ?? []), i]);
  const firstParallel = [...startsTogether.entries()].find(([, group]) => group.length > 1);
  if (firstParallel) {
    const [day, group] = firstParallel;
    paragraphs.push(
      `Some of it can run side by side: ${listInWords(group.map((i) => title(i.id)))} can all start ${day === 0 ? 'today' : `on ${fmt(addDays(anchor, day))}`}.`,
    );
  }

  // 4. Risks: due dates the plan misses, and waits outside the goal.
  const late = open.filter((i) => {
    const due = byId.get(i.id)?.dueDate;
    return due ? i.finish > differenceInCalendarDays(new Date(due), anchor) : false;
  });
  if (late.length > 0) {
    paragraphs.push(
      `${listInWords(late.map((i) => title(i.id)))} ${late.length === 1 ? 'is' : 'are'} scheduled to finish after ${late.length === 1 ? 'its' : 'their'} due date. Start sooner, cut the work down, or move the date.`,
    );
  }
  const outside = [...(waits?.entries() ?? [])].filter(([, ws]) => ws.some((w) => !w.done));
  if (outside.length > 0) {
    const names = outside.map(([id]) => title(id));
    paragraphs.push(
      `${listInWords(names)} also ${outside.length === 1 ? 'waits' : 'wait'} for work outside this goal that is not finished yet. These dates do not include that wait, so treat them as the earliest possible.`,
    );
  }

  // The steps.
  const ordered =
    input.order === 'critical'
      ? [...path, ...items.filter((i) => !path.includes(i))]
      : [...items].sort((a, b) => a.start - b.start || a.finish - b.finish);
  const steps = ordered.map((i, k): PlanStep => {
    const task = byId.get(i.id);
    const isDone = i.duration === 0;
    const notes: string[] = [];
    if (i.predecessors.length > 0) {
      notes.push(`Waits for ${listInWords(i.predecessors.map(title))}.`);
    }
    for (const w of waits?.get(i.id) ?? []) {
      notes.push(
        `Starts after ${w.task.title}${w.goal ? ` in “${w.goal.title}”` : ''}, outside this goal${w.done ? ' (done)' : ' (not done yet)'}.`,
      );
    }
    if (task?.dueDate && !isDone) {
      const dueDay = differenceInCalendarDays(new Date(task.dueDate), anchor);
      if (i.finish > dueDay)
        notes.push(`Due ${fmt(new Date(task.dueDate))}, which this plan misses.`);
    }
    return {
      n: k + 1,
      id: i.id,
      title: title(i.id),
      when: isDone
        ? 'Done.'
        : `Starts ${i.start === 0 ? 'today' : fmt(addDays(anchor, i.start))}, takes ${days(i.duration)}, finishes ${fmt(addDays(anchor, i.finish))}.`,
      slack: isDone ? '' : i.critical ? 'On the critical path.' : `Can slip ${days(i.slack)}.`,
      critical: i.critical && !isDone,
      done: isDone,
      notes,
    };
  });

  return { paragraphs, steps };
}
