import { describe, it, expect } from 'vitest';
import { LANE_SHADE_MAX_ALPHA, laneShadeAlpha, laneShadeStyle } from './lane-shade';

describe('laneShadeAlpha', () => {
  it('maps a 0–100 shade onto the wash alpha, up to the darkest lane', () => {
    expect(laneShadeAlpha(0)).toBe(0);
    expect(laneShadeAlpha(20)).toBe(0.12);
    expect(laneShadeAlpha(50)).toBe(0.3);
    expect(laneShadeAlpha(100)).toBe(LANE_SHADE_MAX_ALPHA);
  });

  it('clamps out-of-range values and treats an unusable one as the bare well', () => {
    expect(laneShadeAlpha(140)).toBe(LANE_SHADE_MAX_ALPHA);
    expect(laneShadeAlpha(-5)).toBe(0);
    expect(laneShadeAlpha(Number.NaN)).toBe(0);
  });
});

describe('laneShadeStyle', () => {
  it('exposes the alpha as the custom property the lane-shade class reads', () => {
    expect(laneShadeStyle(50)).toEqual({ '--lane-shade': '0.3' });
  });
});
