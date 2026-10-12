import { describe, it, expect } from 'vitest';
import { OWNER_FILTER_ALL, OWNER_FILTER_NONE, ownerFilterMatches } from './owner-view';

describe('ownerFilterMatches', () => {
  it('passes everything under "everyone"', () => {
    expect(ownerFilterMatches(1, OWNER_FILTER_ALL)).toBe(true);
    expect(ownerFilterMatches(null, OWNER_FILTER_ALL)).toBe(true);
  });

  it('passes only unassigned work under "unassigned"', () => {
    expect(ownerFilterMatches(null, OWNER_FILTER_NONE)).toBe(true);
    expect(ownerFilterMatches(undefined, OWNER_FILTER_NONE)).toBe(true);
    expect(ownerFilterMatches(1, OWNER_FILTER_NONE)).toBe(false);
  });

  it('passes only that owner under an owner id', () => {
    expect(ownerFilterMatches(1, 1)).toBe(true);
    expect(ownerFilterMatches(2, 1)).toBe(false);
    expect(ownerFilterMatches(null, 1)).toBe(false);
  });
});
