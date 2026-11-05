import { describe, it, expect } from 'vitest';
import type { SubStage } from '@shared/schema';
import { tagsAfterStageMove } from './stage-move';

const subStages = [
  { id: 1, stageId: 2, tag: 'Doing - Rich' },
  { id: 2, stageId: 2, tag: 'Today' },
  { id: 3, stageId: 3, tag: 'Filed' },
] as unknown as SubStage[];

describe('tagsAfterStageMove', () => {
  it('drops the lane tags of other columns and keeps topic tags', () => {
    expect(tagsAfterStageMove(['Doing - Rich', 'receipts'], 3, subStages)).toEqual(['receipts']);
  });

  it('keeps a lane tag of the column the task moves into', () => {
    expect(tagsAfterStageMove(['Today', 'Filed'], 3, subStages)).toEqual(['Filed']);
  });

  it('is null when nothing is left, as the board stores no tags', () => {
    expect(tagsAfterStageMove(['Doing - Rich', 'Today'], 3, subStages)).toBeNull();
    expect(tagsAfterStageMove(null, 3, subStages)).toBeNull();
    expect(tagsAfterStageMove([], 3, subStages)).toBeNull();
  });
});
