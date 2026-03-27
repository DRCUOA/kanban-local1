import { describe, expect, it } from 'vitest';
import { SEED_STAGE_NAMES } from '@shared/constants';
import { resolveStageId } from './stage-resolve';

describe('resolveStageId', () => {
  const stages = [
    { id: 1, name: SEED_STAGE_NAMES.BACKLOG, order: 1, color: null, createdAt: null },
    { id: 2, name: SEED_STAGE_NAMES.IN_PROGRESS, order: 2, color: null, createdAt: null },
  ];

  it('matches exact normalized stage name', () => {
    const r = resolveStageId(stages, '  in progress  ');
    expect(r.stageId).toBe(2);
    expect(r.usedFallback).toBe(false);
  });

  it('falls back to Backlog for unknown stage', () => {
    const r = resolveStageId(stages, 'Unknown Board');
    expect(r.stageId).toBe(1);
    expect(r.usedFallback).toBe(true);
  });
});
