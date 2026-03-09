import { describe, it, expect } from 'vitest';
import {
  TASK_STATUS,
  TASK_STATUS_VALUES,
  TASK_STATUS_LABEL,
  TASK_PRIORITY,
  TASK_PRIORITY_VALUES,
  TASK_PRIORITY_LABEL,
  PRIORITY_SORT_ORDER,
  TASK_RECURRENCE,
  TASK_RECURRENCE_VALUES,
  EFFORT_MIN,
  EFFORT_MAX,
  ROUTES,
  DEFAULT_STAGE_COLORS,
  KEYBOARD_STATUS_MAP,
  SEED_STAGE_NAMES,
  getStatusFromStageName,
  isInProgressStageName,
} from './constants';

describe('constants', () => {
  describe('TASK_STATUS', () => {
    it('contains expected status values', () => {
      expect(TASK_STATUS.BACKLOG).toBe('backlog');
      expect(TASK_STATUS.IN_PROGRESS).toBe('in_progress');
      expect(TASK_STATUS.DONE).toBe('done');
      expect(TASK_STATUS.ABANDONED).toBe('abandoned');
    });

    it('TASK_STATUS_VALUES matches all TASK_STATUS entries', () => {
      const valuesFromObject = Object.values(TASK_STATUS);
      expect(TASK_STATUS_VALUES).toEqual(expect.arrayContaining(valuesFromObject));
      expect(TASK_STATUS_VALUES).toHaveLength(valuesFromObject.length);
    });

    it('TASK_STATUS_LABEL has a label for every status', () => {
      for (const value of TASK_STATUS_VALUES) {
        expect(typeof TASK_STATUS_LABEL[value]).toBe('string');
        expect(TASK_STATUS_LABEL[value].length).toBeGreaterThan(0);
      }
    });
  });

  describe('TASK_PRIORITY', () => {
    it('contains expected priority values', () => {
      expect(TASK_PRIORITY.LOW).toBe('low');
      expect(TASK_PRIORITY.NORMAL).toBe('normal');
      expect(TASK_PRIORITY.HIGH).toBe('high');
      expect(TASK_PRIORITY.CRITICAL).toBe('critical');
    });

    it('TASK_PRIORITY_VALUES matches all TASK_PRIORITY entries', () => {
      const valuesFromObject = Object.values(TASK_PRIORITY);
      expect(TASK_PRIORITY_VALUES).toEqual(expect.arrayContaining(valuesFromObject));
      expect(TASK_PRIORITY_VALUES).toHaveLength(valuesFromObject.length);
    });

    it('TASK_PRIORITY_LABEL has a label for every priority', () => {
      for (const value of TASK_PRIORITY_VALUES) {
        expect(typeof TASK_PRIORITY_LABEL[value]).toBe('string');
        expect(TASK_PRIORITY_LABEL[value].length).toBeGreaterThan(0);
      }
    });

    it('PRIORITY_SORT_ORDER assigns ascending values from low to critical', () => {
      expect(PRIORITY_SORT_ORDER[TASK_PRIORITY.LOW]).toBeLessThan(
        PRIORITY_SORT_ORDER[TASK_PRIORITY.NORMAL],
      );
      expect(PRIORITY_SORT_ORDER[TASK_PRIORITY.NORMAL]).toBeLessThan(
        PRIORITY_SORT_ORDER[TASK_PRIORITY.HIGH],
      );
      expect(PRIORITY_SORT_ORDER[TASK_PRIORITY.HIGH]).toBeLessThan(
        PRIORITY_SORT_ORDER[TASK_PRIORITY.CRITICAL],
      );
    });
  });

  describe('TASK_RECURRENCE', () => {
    it('contains expected recurrence values', () => {
      expect(TASK_RECURRENCE.NONE).toBe('none');
      expect(TASK_RECURRENCE.DAILY).toBe('daily');
      expect(TASK_RECURRENCE.WEEKLY).toBe('weekly');
      expect(TASK_RECURRENCE.MONTHLY).toBe('monthly');
    });

    it('TASK_RECURRENCE_VALUES matches all entries', () => {
      const valuesFromObject = Object.values(TASK_RECURRENCE);
      expect(TASK_RECURRENCE_VALUES).toEqual(expect.arrayContaining(valuesFromObject));
      expect(TASK_RECURRENCE_VALUES).toHaveLength(valuesFromObject.length);
    });
  });

  describe('EFFORT_MIN / EFFORT_MAX', () => {
    it('defines valid effort range', () => {
      expect(EFFORT_MIN).toBe(1);
      expect(EFFORT_MAX).toBe(5);
      expect(EFFORT_MIN).toBeLessThan(EFFORT_MAX);
    });
  });

  describe('ROUTES', () => {
    it('defines client-side route paths', () => {
      expect(ROUTES.DASHBOARD).toBe('/');
      expect(ROUTES.ADMIN).toBe('/admin');
      expect(ROUTES.ARCHIVE).toBe('/archive');
    });
  });

  describe('DEFAULT_STAGE_COLORS', () => {
    it('contains hex colour strings', () => {
      expect(DEFAULT_STAGE_COLORS.length).toBeGreaterThan(0);
      for (const colour of DEFAULT_STAGE_COLORS) {
        expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('KEYBOARD_STATUS_MAP', () => {
    it('maps keyboard keys 1-4 to task statuses', () => {
      expect(KEYBOARD_STATUS_MAP['1']).toBe(TASK_STATUS.BACKLOG);
      expect(KEYBOARD_STATUS_MAP['2']).toBe(TASK_STATUS.IN_PROGRESS);
      expect(KEYBOARD_STATUS_MAP['3']).toBe(TASK_STATUS.DONE);
      expect(KEYBOARD_STATUS_MAP['4']).toBe(TASK_STATUS.ABANDONED);
    });
  });

  describe('SEED_STAGE_NAMES', () => {
    it('defines seed stage display names', () => {
      expect(SEED_STAGE_NAMES.BACKLOG).toBe('Backlog');
      expect(SEED_STAGE_NAMES.IN_PROGRESS).toBe('In Progress');
      expect(SEED_STAGE_NAMES.DONE).toBe('Done');
    });
  });

  describe('getStatusFromStageName', () => {
    it('returns IN_PROGRESS for names containing progress/doing/active', () => {
      expect(getStatusFromStageName('In Progress')).toBe(TASK_STATUS.IN_PROGRESS);
      expect(getStatusFromStageName('Doing')).toBe(TASK_STATUS.IN_PROGRESS);
      expect(getStatusFromStageName('Active Tasks')).toBe(TASK_STATUS.IN_PROGRESS);
    });

    it('returns DONE for names containing done/complete/finished', () => {
      expect(getStatusFromStageName('Done')).toBe(TASK_STATUS.DONE);
      expect(getStatusFromStageName('Completed')).toBe(TASK_STATUS.DONE);
      expect(getStatusFromStageName('Finished')).toBe(TASK_STATUS.DONE);
    });

    it('returns ABANDONED for names containing abandon/cancel', () => {
      expect(getStatusFromStageName('Abandon Pile')).toBe(TASK_STATUS.ABANDONED);
      expect(getStatusFromStageName('Cancelled')).toBe(TASK_STATUS.ABANDONED);
    });

    it('matches "done" substring before "abandon" (Abandoned contains "done")', () => {
      expect(getStatusFromStageName('Abandoned')).toBe(TASK_STATUS.DONE);
    });

    it('defaults to BACKLOG for unrecognised names', () => {
      expect(getStatusFromStageName('Random')).toBe(TASK_STATUS.BACKLOG);
      expect(getStatusFromStageName('Backlog')).toBe(TASK_STATUS.BACKLOG);
      expect(getStatusFromStageName('To Do')).toBe(TASK_STATUS.BACKLOG);
    });
  });

  describe('isInProgressStageName', () => {
    it('returns true for in-progress stage names', () => {
      expect(isInProgressStageName('In Progress')).toBe(true);
      expect(isInProgressStageName('Doing')).toBe(true);
      expect(isInProgressStageName('Active')).toBe(true);
    });

    it('returns false for non-in-progress stage names', () => {
      expect(isInProgressStageName('Done')).toBe(false);
      expect(isInProgressStageName('Backlog')).toBe(false);
      expect(isInProgressStageName('Abandoned')).toBe(false);
    });
  });
});
