import type { CSSProperties } from 'react';

/**
 * A sub-stage lane's shade. The Admin "Shade" slider stores 0–100 in
 * `subStage.opacity`; the lane paints a wash of the theme's shadow colour over
 * its sunken well at that strength (the `lane-shade` class in index.css reads
 * the `--lane-shade` custom property this module sets). 0 is the bare well,
 * 100 the darkest lane — dark enough to read as a different lane, light enough
 * to leave the cards on it legible.
 */
export const LANE_SHADE_MAX_ALPHA = 0.6;

/** The wash alpha (0–1) for a shade of 0–100; anything unusable is the bare well. */
export function laneShadeAlpha(shade: number): number {
  const clamped = Number.isFinite(shade) ? Math.min(100, Math.max(0, shade)) : 0;
  return Math.round((clamped / 100) * LANE_SHADE_MAX_ALPHA * 1000) / 1000;
}

/** Inline style for an element carrying the `lane-shade` class. */
export function laneShadeStyle(shade: number): CSSProperties {
  return { '--lane-shade': String(laneShadeAlpha(shade)) } as CSSProperties;
}
