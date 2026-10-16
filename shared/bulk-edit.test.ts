import { describe, expect, it } from 'vitest';
import { bulkChange, bulkUpdateRequestSchema } from './bulk-edit';

describe('bulkChange', () => {
  it('accepts a valid value for each kind of field, including clearing', () => {
    expect(bulkChange('priority', 'high')).toEqual({ priority: 'high' });
    expect(bulkChange('effort', 3)).toEqual({ effort: 3 });
    expect(bulkChange('ownerId', null)).toEqual({ ownerId: null });
    expect(bulkChange('dueDate', '2026-10-20T00:00:00.000Z')).toEqual({
      dueDate: new Date('2026-10-20T00:00:00.000Z'),
    });
    expect(bulkChange('type', 'goal')).toEqual({ type: 'goal' });
  });
  it('rejects a value the task form would reject', () => {
    expect(() => bulkChange('priority', 'urgent')).toThrow();
    expect(() => bulkChange('effort', 9)).toThrow();
    expect(() => bulkChange('stageId', undefined)).toThrow();
  });
});

describe('bulkUpdateRequestSchema', () => {
  it('needs at least one id and a known field', () => {
    expect(
      bulkUpdateRequestSchema.safeParse({ ids: [], field: 'priority', value: 'high' }).success,
    ).toBe(false);
    expect(
      bulkUpdateRequestSchema.safeParse({ ids: [1], field: 'title', value: 'x' }).success,
    ).toBe(false);
    expect(
      bulkUpdateRequestSchema.safeParse({ ids: [1, 2], field: 'priority', value: 'high' }).success,
    ).toBe(true);
  });
});
