import type { SubStage } from '@shared/schema';

/**
 * The tags a task keeps when it moves to another stage: everything except the
 * lane tags of other stages, so the card does not drag a lane it has left
 * behind into its new column. Topic tags and the new stage's own lane tags
 * survive. Null when nothing is left, which is how the board stores no tags.
 */
export function tagsAfterStageMove(
  tags: readonly string[] | null | undefined,
  stageId: number,
  subStages: readonly SubStage[],
): string[] | null {
  const targetTags = subStages.filter((ss) => ss.stageId === stageId).map((ss) => ss.tag);
  const otherTags = subStages.filter((ss) => ss.stageId !== stageId).map((ss) => ss.tag);
  const kept = (tags ?? []).filter((tag) => !otherTags.includes(tag) || targetTags.includes(tag));
  return kept.length > 0 ? kept : null;
}
