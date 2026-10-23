import { describe, expect, it } from 'vitest';
import { inkOn, islandPath, monogram } from './glyphs';

describe('the project island', () => {
  it('is the same island for the same project, and another for another', () => {
    expect(islandPath(4, 56)).toBe(islandPath(4, 56));
    expect(islandPath(4, 56)).not.toBe(islandPath(5, 56));
    expect(islandPath(4, 56)).toMatch(/^M[\d. ]+(C[\d. ]+){10}Z$/);
  });

  it('carries the key when there is one, else the initials', () => {
    expect(monogram('Kanbando', 'kan')).toBe('KAN');
    expect(monogram('Kanbando', 'ALPHA')).toBe('ALP');
    expect(monogram('Suss & Grace', null)).toBe('SG');
    expect(monogram('Floorplanner', '  ')).toBe('FL');
  });

  it('letters it in white or ink, whichever reads on its colour', () => {
    expect(inkOn('#14181f')).toBe('#ffffff');
    expect(inkOn('#8A2F4B')).toBe('#ffffff');
    expect(inkOn('#C9A227')).toBe('#14181f');
    expect(inkOn('#fff')).toBe('#14181f');
    expect(inkOn('not a colour')).toBe('#ffffff');
  });
});
