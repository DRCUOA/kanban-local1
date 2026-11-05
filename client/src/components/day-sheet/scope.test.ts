import { describe, it, expect } from 'vitest';
import { describeDaySheetScope } from './scope';
import type { ActiveFilter } from '@/pages/Dashboard/active-filters';

const f = (key: ActiveFilter['key'], label: string, value: string, narrowing = true) => ({
  key,
  label,
  value,
  narrowing,
});

describe('describeDaySheetScope', () => {
  it('is null when nothing narrows the board', () => {
    expect(
      describeDaySheetScope([
        f('project', 'Project', 'All projects', false),
        f('owner', 'Owner', 'Everyone', false),
      ]),
    ).toBeNull();
  });

  it('names each narrowing filter, separated so a value can hold a comma', () => {
    expect(
      describeDaySheetScope([
        f('project', 'Project', 'Business Setup'),
        f('owner', 'Owners', 'Rich, Moi'),
        f('owner', 'Owner', 'Everyone', false),
        f('search', 'Search', '“invoice”'),
        f('focus', 'Focus', 'On'),
      ]),
    ).toBe('project Business Setup; owners Rich, Moi; search “invoice”; focus mode on');
  });

  it('drops decorative emoji from stage names', () => {
    expect(describeDaySheetScope([f('stage', 'Stage', 'Waiting ✋️ ')])).toBe('stage Waiting');
  });
});
