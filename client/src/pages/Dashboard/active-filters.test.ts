import { describe, expect, it } from 'vitest';
import { describeActiveFilters, type ActiveFilterInput } from './active-filters';

const base: ActiveFilterInput = {
  scope: 'all',
  projectName: null,
  hasProjects: true,
  owners: [
    { id: 4, name: 'Rich' },
    { id: 5, name: 'Moi' },
    { id: 6, name: 'Team' },
  ],
  ownerSelection: [],
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
    expect(by({ ownerSelection: [4] }).owner).toMatchObject({ value: 'Rich', narrowing: true });
    expect(by({ ownerSelection: ['none'] }).owner).toMatchObject({ value: 'Unassigned' });
  });
  it('adds search and focus only while on, and hides project with no projects', () => {
    const f = by({
      searchQuery: ' paint ',
      focusMode: true,
      hasProjects: false,
    });
    expect(Object.keys(f)).toEqual(['owner', 'search', 'focus']);
    expect(f.search?.value).toBe('“paint”');
  });
});

describe('goal filter', () => {
  it('names the goal the board is narrowed to', () => {
    const f = describeActiveFilters({ ...base, goalNames: ['Build a shed'] });
    expect(f.find((x) => x.key === 'goal')).toMatchObject({
      label: 'Goal',
      value: 'Build a shed',
      narrowing: true,
    });
  });
});

describe('the landing page rows', () => {
  it('names two choices in full and shortens more', () => {
    expect(by({ ownerSelection: [4, 5] }).owner).toMatchObject({
      label: 'Owners',
      value: 'Rich, Moi',
    });
    expect(by({ ownerSelection: [4, 5, 6] }).owner?.value).toBe('Rich +2');
    expect(by({ projectNames: ['Shed', 'House'] }).project).toMatchObject({
      label: 'Projects',
      value: 'Shed, House',
      narrowing: true,
    });
  });

  it('adds stage only while it narrows', () => {
    expect(by({ stageNames: ['Backlog', 'Waiting'] }).stage).toMatchObject({
      label: 'Stages',
      value: 'Backlog, Waiting',
    });
    expect(Object.keys(by({ stageNames: [] }))).toEqual(['project', 'owner']);
  });
});
