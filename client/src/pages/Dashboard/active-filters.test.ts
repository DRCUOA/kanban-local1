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
    expect(by({ ownerSelection: [4] }).owner).toMatchObject({ value: 'Rich', narrowing: true });
    expect(by({ ownerSelection: ['none'] }).owner).toMatchObject({ value: 'Unassigned' });
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

  it('adds stage, due by and new only while they narrow', () => {
    const f = by({
      stageNames: ['Backlog'],
      due: { mode: 'open', date: '2026-10-31' },
      onlyNew: true,
    });
    expect(f.stage?.value).toBe('Backlog');
    expect(f.due?.value).toBe('Oct 31, not done');
    expect(f.new?.value).toBe('New only');
    expect(by({ due: { mode: 'archived', date: '2026-10-31' } }).due?.value).toBe(
      'Oct 31, archived',
    );
    expect(Object.keys(by({ due: { mode: 'open', date: '' } }))).toEqual(['project', 'owner']);
  });
});
