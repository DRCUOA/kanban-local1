import { describe, it, expect } from 'vitest';
import {
  TASK_STATUS,
  TASK_STATUS_VALUES,
  STAGE_KIND,
  STAGE_KIND_VALUES,
  STAGE_KIND_LABEL,
  STAGE_KIND_DESCRIPTION,
  DEFAULT_STAGE_KIND,
  KEYBOARD_STAGE_KIND_MAP,
  isStageKind,
  isClosedStageKind,
  legacyStatusToStageKind,
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
  SEED_STAGE_NAMES,
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

    it('every legacy status maps to a stage kind', () => {
      // The values survive only to read files written before EPIC-03 story 2,
      // so the one thing they must still do is translate.
      for (const value of TASK_STATUS_VALUES) {
        expect(legacyStatusToStageKind(value)).not.toBe(null);
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

  describe('KEYBOARD_STAGE_KIND_MAP', () => {
    it('maps keyboard keys 1-4 to stage kinds', () => {
      expect(KEYBOARD_STAGE_KIND_MAP['1']).toBe(STAGE_KIND.BACKLOG);
      expect(KEYBOARD_STAGE_KIND_MAP['2']).toBe(STAGE_KIND.IN_PROGRESS);
      expect(KEYBOARD_STAGE_KIND_MAP['3']).toBe(STAGE_KIND.DONE);
      expect(KEYBOARD_STAGE_KIND_MAP['4']).toBe(STAGE_KIND.ABANDONED);
    });
  });

  describe('SEED_STAGE_NAMES', () => {
    it('defines seed stage display names', () => {
      expect(SEED_STAGE_NAMES.BACKLOG).toBe('Backlog');
      expect(SEED_STAGE_NAMES.IN_PROGRESS).toBe('In Progress');
      expect(SEED_STAGE_NAMES.DONE).toBe('Done');
    });
  });

  describe('stage kinds', () => {
    it('labels and describes every kind', () => {
      for (const kind of STAGE_KIND_VALUES) {
        expect(STAGE_KIND_LABEL[kind].length).toBeGreaterThan(0);
        expect(STAGE_KIND_DESCRIPTION[kind].length).toBeGreaterThan(0);
      }
    });

    it('recognises its own values and nothing else', () => {
      for (const kind of STAGE_KIND_VALUES) expect(isStageKind(kind)).toBe(true);
      // What a stage row read from an older export, or hand-edited, might hold.
      expect(isStageKind('Done')).toBe(false);
      expect(isStageKind('')).toBe(false);
      expect(isStageKind(undefined)).toBe(false);
      expect(isStageKind(null)).toBe(false);
    });

    it('counts done and abandoned as closed, and nothing else', () => {
      expect(isClosedStageKind(STAGE_KIND.DONE)).toBe(true);
      expect(isClosedStageKind(STAGE_KIND.ABANDONED)).toBe(true);
      expect(isClosedStageKind(STAGE_KIND.BACKLOG)).toBe(false);
      expect(isClosedStageKind(STAGE_KIND.IN_PROGRESS)).toBe(false);
      // Parked is not finished: a waiting card is still live work.
      expect(isClosedStageKind(STAGE_KIND.WAITING)).toBe(false);
    });

    it('defaults to a kind that is itself valid', () => {
      expect(isStageKind(DEFAULT_STAGE_KIND)).toBe(true);
    });
  });

  describe('legacyStatusToStageKind', () => {
    it('maps every value the dropped status column could hold', () => {
      expect(legacyStatusToStageKind('backlog')).toBe(STAGE_KIND.BACKLOG);
      expect(legacyStatusToStageKind('in_progress')).toBe(STAGE_KIND.IN_PROGRESS);
      expect(legacyStatusToStageKind('done')).toBe(STAGE_KIND.DONE);
      // Not `done`. The old name inference read "Abandoned" as done, because
      // the string contains "done"; the mapping does not repeat that.
      expect(legacyStatusToStageKind('abandoned')).toBe(STAGE_KIND.ABANDONED);
    });

    it('cannot produce waiting, which the old enum could not express', () => {
      for (const status of TASK_STATUS_VALUES) {
        expect(legacyStatusToStageKind(status)).not.toBe(STAGE_KIND.WAITING);
      }
    });

    it('returns null for anything it does not recognise', () => {
      expect(legacyStatusToStageKind('waiting')).toBe(null);
      expect(legacyStatusToStageKind('')).toBe(null);
      expect(legacyStatusToStageKind(undefined)).toBe(null);
    });
  });
});
