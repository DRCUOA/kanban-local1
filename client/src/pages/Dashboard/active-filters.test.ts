import { describe, expect, it } from 'vitest';
import { describeActiveFilters, type ActiveFilterInput } from './active-filters';

const base: ActiveFilterInput = {
  scope: 'all',
  projectName: null,
  hasProjects: true,
  owners: [{ id: 4, name: 'Rich' }],
  ownerFilter: 'all',
  warningFilter: null,
  searchQuery: '',
  focusMode: false,
};
const by = (input: Partial<ActiveFilterInput>) =>
  Object.fromEntries(describeActiveFilters({ ...base, ...input }).map((f) => [f.key, f]));

describe('describeActiveFilters', () => {
  it('states the defaults: all projects, everyone, nothing narrowing', () => {
    const f = by({});
    expect(f.project).toMatchObject({ value: 'All projects', narrowing: false });
    expect(f.owner).toMatchObject({ value: 'Everyone', narrowing: false });
    expect(Object.keys(f)).toEqual(['project', 'owner']);
  });
  it('names a project, an owner, the unassigned lane and "no project"', () => {
    expect(by({ scope: 3, projectName: 'Shed' }).project).toMatchObject({
      value: 'Shed',
      narrowing: true,
    });
    expect(by({ scope: 'none' }).project).toMatchObject({ value: 'No project', narrowing: true });
    expect(by({ ownerFilter: 4 }).owner).toMatchObject({ value: 'Rich', narrowing: true });
    expect(by({ ownerFilter: 'none' }).owner).toMatchObject({ value: 'Unassigned' });
  });
  it('adds warning, search and focus only while on, and hides project with no projects', () => {
    const f = by({
      warningFilter: 'overdue',
      searchQuery: ' paint ',
      focusMode: true,
      hasProjects: false,
    });
    expect(Object.keys(f)).toEqual(['owner', 'warning', 'search', 'focus']);
    expect(f.warning?.value).toBe('Overdue');
    expect(f.search?.value).toBe('“paint”');
  });
});
