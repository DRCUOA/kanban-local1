import { describe, it, expect } from 'vitest';
import {
  parseProjectScope,
  projectScopeToFilter,
  serializeProjectScope,
  taskListQuerySchema,
  withProjectScopeParam,
  INVALID_PROJECT_SCOPE_MESSAGE,
} from './project-scope';

describe('parseProjectScope', () => {
  it('reads the two keyword scopes, whatever their case or padding', () => {
    expect(parseProjectScope('all')).toBe('all');
    expect(parseProjectScope(' ALL ')).toBe('all');
    expect(parseProjectScope('none')).toBe('none');
    expect(parseProjectScope('None')).toBe('none');
  });

  it('reads a positive integer id from a string or a number', () => {
    expect(parseProjectScope('7')).toBe(7);
    expect(parseProjectScope(7)).toBe(7);
  });

  it('rejects anything that is not a scope', () => {
    expect(parseProjectScope('0')).toBeNull();
    expect(parseProjectScope('-3')).toBeNull();
    expect(parseProjectScope('3.5')).toBeNull();
    expect(parseProjectScope('alpha')).toBeNull();
    expect(parseProjectScope('')).toBeNull();
    expect(parseProjectScope(undefined)).toBeNull();
    expect(parseProjectScope(null)).toBeNull();
    expect(parseProjectScope(['1'])).toBeNull();
    expect(parseProjectScope(Number.NaN)).toBeNull();
  });

  it('round-trips through serializeProjectScope', () => {
    for (const scope of ['all', 'none', 42] as const) {
      expect(parseProjectScope(serializeProjectScope(scope))).toBe(scope);
    }
  });
});

describe('projectScopeToFilter', () => {
  it('maps all to no filter, none to the null project, and an id to itself', () => {
    expect(projectScopeToFilter('all')).toEqual({});
    expect(projectScopeToFilter('none')).toEqual({ projectId: null });
    expect(projectScopeToFilter(9)).toEqual({ projectId: 9 });
  });
});

describe('withProjectScopeParam', () => {
  it('leaves the URL alone for the all scope', () => {
    expect(withProjectScopeParam('/api/tasks', 'all')).toBe('/api/tasks');
  });

  it('appends projectId for a project or the none scope', () => {
    expect(withProjectScopeParam('/api/tasks', 3)).toBe('/api/tasks?projectId=3');
    expect(withProjectScopeParam('/api/tasks', 'none')).toBe('/api/tasks?projectId=none');
    expect(withProjectScopeParam('/api/tasks?x=1', 3)).toBe('/api/tasks?x=1&projectId=3');
  });
});

describe('taskListQuerySchema', () => {
  it('defaults to the all scope when projectId is absent', () => {
    expect(taskListQuerySchema.parse({})).toEqual({ projectId: 'all' });
  });

  it('parses a project id and the none keyword', () => {
    expect(taskListQuerySchema.parse({ projectId: '12' })).toEqual({ projectId: 12 });
    expect(taskListQuerySchema.parse({ projectId: 'none' })).toEqual({ projectId: 'none' });
  });

  it('rejects an unreadable projectId with a named message', () => {
    const result = taskListQuerySchema.safeParse({ projectId: 'alpha' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe(INVALID_PROJECT_SCOPE_MESSAGE);
    }
  });

  it('rejects a repeated projectId (an array) rather than guessing', () => {
    expect(taskListQuerySchema.safeParse({ projectId: ['1', '2'] }).success).toBe(false);
  });
});
