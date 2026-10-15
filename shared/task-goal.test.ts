import { describe, expect, it } from 'vitest';
import { goalLinkError, normaliseGoalLink } from './task-goal';

describe('normaliseGoalLink', () => {
  it('keeps the goal on a building-block', () => {
    expect(normaliseGoalLink({ type: 'building-block', goalTaskId: 3 }).goalTaskId).toBe(3);
  });
  it.each(['goal', null, undefined])('clears the goal when type is %s', (type) => {
    expect(normaliseGoalLink({ type, goalTaskId: 3 }).goalTaskId).toBeNull();
  });
});

describe('goalLinkError', () => {
  it('accepts no goal', () => {
    expect(goalLinkError(null, undefined)).toBeNull();
  });
  it('accepts a goal task', () => {
    expect(goalLinkError(3, { type: 'goal', goalTaskId: null })).toBeNull();
  });
  it('rejects a missing target, a non-goal target and self', () => {
    expect(goalLinkError(3, undefined)).toMatch(/Unknown goal/);
    expect(goalLinkError(3, { type: 'building-block', goalTaskId: null })).toMatch(/not a goal/);
    expect(goalLinkError(3, { type: 'goal', goalTaskId: null }, 3)).toMatch(/own goal/);
  });
});
