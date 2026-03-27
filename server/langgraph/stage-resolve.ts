import type { Stage } from '@shared/schema';
import { SEED_STAGE_NAMES } from '@shared/constants';

function normalizeStageName(name: string): string {
  return name.trim().normalize('NFKC').toLowerCase();
}

/** Deterministic: NFKC + trim + case-insensitive exact match; else Backlog. */
export function resolveStageId(
  stages: Stage[],
  suggestedName: string | undefined | null,
): { stageId: number; usedFallback: boolean } {
  const backlog = stages.find(
    (s) => normalizeStageName(s.name) === normalizeStageName(SEED_STAGE_NAMES.BACKLOG),
  );
  const fallbackId = backlog?.id;
  if (!fallbackId) {
    const first = stages[0];
    if (!first) throw new Error('No stages in database');
    return { stageId: first.id, usedFallback: true };
  }
  if (!suggestedName?.trim()) {
    return { stageId: fallbackId, usedFallback: true };
  }
  const want = normalizeStageName(suggestedName);
  const match = stages.find((s) => normalizeStageName(s.name) === want);
  if (match) return { stageId: match.id, usedFallback: false };
  return { stageId: fallbackId, usedFallback: true };
}
