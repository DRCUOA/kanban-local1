import {
  DAY_SHEET_SECTION,
  DAY_SHEET_SECTION_BY_KIND,
  DAY_SHEET_SECTION_LABEL,
  DAY_SHEET_SECTION_VALUES,
  isDaySheetSection,
  type DaySheetSectionValue,
} from './constants';
import type { Stage, SubStage, Task } from './schema';
import { stageKind } from './stage-state';
import { assignTasksToLanes } from './lanes';
import { DEFAULT_TIMEZONE, isClosedTask, isDueTodayOn, isTaskOverdueOn } from './briefing';
import { compareTasksByDueDate } from './task-sort';

/**
 * The day sheet: the tasks the board is showing, printed as one page of tick
 * lines under Do now, Next and Later.
 *
 * Which section a task prints in:
 *
 * 1. Overdue or due today, and still open: Do now, whatever its lane. A day
 *    sheet that left today's deadline under Later would be wrong on paper.
 * 2. Otherwise the section of the lane the board draws it in
 *    (`sub_stages.day_sheet_section`), found with the board's own lane split.
 * 3. A lane with no setting, a task drawn above the lanes, and a column with
 *    no lanes follow the column's kind (`DAY_SHEET_SECTION_BY_KIND`).
 *
 * Inside a section tasks run soonest due first, undated last, then by id —
 * the board's default order — so a cut drops the least pressing.
 */

export interface DaySheetSectionGroup {
  section: DaySheetSectionValue;
  label: string;
  tasks: Task[];
}

export interface BuildDaySheetInput {
  /** The board's tasks after every filter (`useFilteredTasks`). */
  tasks: readonly Task[];
  /** The columns the board draws; a task in any other column is not on it. */
  columnStages: readonly Stage[];
  /** Every stage, for the closed-task check. */
  stages: readonly Stage[];
  subStages: readonly SubStage[];
  now: Date;
  timeZone?: string;
}

/** The section a lane prints in: its own setting, else its column's kind. */
export function laneDaySheetSection(
  lane: Pick<SubStage, 'daySheetSection'>,
  stage: Stage | undefined,
): DaySheetSectionValue {
  return isDaySheetSection(lane.daySheetSection)
    ? lane.daySheetSection
    : DAY_SHEET_SECTION_BY_KIND[stageKind(stage)];
}

/** Always three groups, in print order, each possibly empty. */
export function buildDaySheet({
  tasks,
  columnStages,
  stages,
  subStages,
  now,
  timeZone = DEFAULT_TIMEZONE,
}: BuildDaySheetInput): DaySheetSectionGroup[] {
  const bySection = new Map<DaySheetSectionValue, Task[]>(
    DAY_SHEET_SECTION_VALUES.map((section) => [section, []]),
  );
  const put = (section: DaySheetSectionValue, task: Task) => bySection.get(section)?.push(task);
  const stageList = [...stages];

  for (const stage of columnStages) {
    const stageTasks = tasks.filter((t) => t.stageId === stage.id);
    if (stageTasks.length === 0) continue;

    const columnSection = DAY_SHEET_SECTION_BY_KIND[stageKind(stage)];
    const lanes = subStages
      .filter((lane) => lane.stageId === stage.id)
      .sort((a, b) => a.order - b.order);

    const sectionOf = new Map<number, DaySheetSectionValue>();
    if (lanes.length === 0) {
      for (const task of stageTasks) sectionOf.set(task.id, columnSection);
    } else {
      const { laneTasks, unlaned, catchAllIndex } = assignTasksToLanes(lanes, stageTasks);
      laneTasks.forEach((list, index) => {
        const lane = lanes[index];
        const section = lane ? laneDaySheetSection(lane, stage) : columnSection;
        for (const task of list) sectionOf.set(task.id, section);
      });
      const catchAll = catchAllIndex === -1 ? undefined : lanes[catchAllIndex];
      const unlanedSection = catchAll ? laneDaySheetSection(catchAll, stage) : columnSection;
      for (const task of unlaned) sectionOf.set(task.id, unlanedSection);
    }

    for (const task of stageTasks) {
      const dueNow =
        !isClosedTask(task, stageList) &&
        (isTaskOverdueOn(task, stageList, now, timeZone) ||
          isDueTodayOn(task.dueDate, now, timeZone));
      put(dueNow ? DAY_SHEET_SECTION.NOW : (sectionOf.get(task.id) ?? columnSection), task);
    }
  }

  return DAY_SHEET_SECTION_VALUES.map((section) => ({
    section,
    label: DAY_SHEET_SECTION_LABEL[section],
    tasks: [...(bySection.get(section) ?? [])].sort(compareTasksByDueDate),
  }));
}

// --- Fitting the page ---

/**
 * How many lines of each section fit in `budget`, given each line's measured
 * height. Everything shows when it fits. Otherwise lines come off the end of
 * the section that has the most showing, the later section on a tie, so every
 * section keeps a share and Do now is the last to lose one. A section that
 * loses lines gains a "+ N more" row of `moreRowHeight`.
 *
 * Pure arithmetic on heights measured at the smallest type size, so it can be
 * tested without a browser.
 */
export function allocateDaySheetLines(
  lineHeights: readonly (readonly number[])[],
  budget: number,
  moreRowHeight: number,
): number[] {
  const shown = lineHeights.map((lines) => lines.length);
  let total = lineHeights.flat().reduce((sum, h) => sum + h, 0);

  while (total > budget) {
    let pick = -1;
    for (let i = 0; i < shown.length; i++) {
      const count = shown[i] ?? 0;
      if (count > 0 && (pick === -1 || count >= (shown[pick] ?? 0))) pick = i;
    }
    if (pick === -1) break; // nothing left to cut

    const count = shown[pick] ?? 0;
    const lines = lineHeights[pick] ?? [];
    const wasWhole = count === lines.length;
    total -= lines[count - 1] ?? 0;
    if (wasWhole) total += moreRowHeight;
    shown[pick] = count - 1;
  }

  return shown;
}
