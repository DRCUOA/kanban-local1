import type { Stage } from '@shared/schema';
import { isDoneStageName, ROUTES } from '@shared/constants';

/** Droppable id of the Filing button itself — the "no action chosen yet" target. */
export const FILING_DROPPABLE_ID = 'filing';
/** Droppable id of the Bin button. */
export const BIN_DROPPABLE_ID = 'bin';
/** Every filing submenu row's droppable id starts with this. */
export const FILING_TARGET_PREFIX = 'filing:';

export interface FilingTarget {
  /** Droppable id; also the React key. */
  id: string;
  label: string;
  /** What dropping on this row does. */
  action: 'stage' | 'archive';
  /** Stage to move the task into — set only when `action` is 'stage'. */
  stageId: number | null;
  /** Where a plain click (no drag) on this row goes. */
  href: string;
}

/** True for any droppable id belonging to the Filing button or its submenu. */
export function isFilingId(id: string | null | undefined): boolean {
  return id === FILING_DROPPABLE_ID || (!!id && id.startsWith(FILING_TARGET_PREFIX));
}

/**
 * The rows of the Filing submenu: one per done stage, then Archive. These are
 * both the drop targets a drag can land on and the links a tap can follow, so
 * the menu reads the same whichever way it was opened.
 */
export function filingTargets(stages: Stage[]): FilingTarget[] {
  const doneStages = [...stages]
    .sort((a, b) => a.order - b.order)
    .filter((stage) => isDoneStageName(stage.name));

  return [
    ...doneStages.map((stage) => ({
      id: `${FILING_TARGET_PREFIX}stage-${stage.id}`,
      label: stage.name.trim(),
      action: 'stage' as const,
      stageId: stage.id,
      href: ROUTES.FILING,
    })),
    {
      id: `${FILING_TARGET_PREFIX}archive`,
      label: 'Archive',
      action: 'archive' as const,
      stageId: null,
      href: ROUTES.ARCHIVE,
    },
  ];
}
