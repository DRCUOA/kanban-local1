import { format } from 'date-fns';
import type { Project, Stage } from '@shared/schema';
import { STAGE_KIND } from '@shared/constants';
import { stagesOfKind } from '@shared/stage-state';
import { toRichHtml } from '@/lib/rich-text';

/**
 * Zen doing mode: a full-screen, read-only view of one task's description with
 * two quiet ways out, Mark done and Cancel doing. It is offered only on tasks
 * in a project that has a Zen icon, which for now is the one project named
 * "Everyday", the home of the routine chores.
 */

/** Projects that open Zen doing mode, matched by name with case and spacing ignored. */
const ZEN_PROJECT_NAMES = ['everyday'] as const;

export type ZenProjectName = (typeof ZEN_PROJECT_NAMES)[number];

/** Which Zen project this is, or null when the project does not offer Zen doing mode. */
export function zenProjectName(
  project: Pick<Project, 'name'> | null | undefined,
): ZenProjectName | null {
  if (!project) return null;
  const name = project.name.trim().replace(/\s+/g, ' ').toLowerCase();
  return ZEN_PROJECT_NAMES.find((n) => n === name) ?? null;
}

/** Where Mark done puts the task: the first Done column in board order, if the board has one. */
export function zenDoneStage(stages: readonly Stage[]): Stage | null {
  return stagesOfKind([...stages], STAGE_KIND.DONE)[0] ?? null;
}

/**
 * The line Mark done writes, a date and time stamp and then Rich's words:
 * "Nov 6, 2026 3:42 PM: marked done via Zen doing mode on Friday the 11-26, go you!"
 * The stamp uses the same `PP p` format as the rest of the task views.
 */
export function zenDoneLine(now: Date): string {
  return `${format(now, 'PP p')}: marked done via Zen doing mode on ${format(now, 'EEEE')} the ${format(now, 'MM-yy')}, go you!`;
}

/**
 * The description with the Mark done line added as its last paragraph, the
 * stamp in bold. A plain-text description is converted first, the same way the
 * editor would convert it on save.
 */
export function appendZenDoneLine(description: string | null | undefined, now: Date): string {
  const line = zenDoneLine(now);
  const stamp = format(now, 'PP p');
  const words = line.slice(stamp.length);
  return `${toRichHtml(description)}<p><strong>${stamp}</strong>${words}</p>`;
}
