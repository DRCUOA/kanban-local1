import type { ReactNode } from 'react';
import { DEFAULT_PROJECT_COLOR, EFFORT_MAX, EFFORT_MIN } from '@shared/constants';
import { cn } from '@/lib/utils';
import type { WizardStage } from './wizard-options';

/**
 * The wizard's shape language, drawn as a journey on a map: a project is an
 * island, a goal is a pin dropped on it, a task is a stepping stone, the
 * board's own circle. The same three shapes mark the stones, the badges, the
 * route at the top and the jumps in the nav, so a shape always means a level.
 */

/** A small seeded random stream (mulberry32): the same seed, the same island. */
function seeded(seed: number): () => number {
  let a = (seed * 9973 + 17) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (n: number) => n.toFixed(2);

export type Point = readonly [number, number];

/**
 * A smooth curve through `points` (Catmull-Rom, as cubic Béziers): closed
 * into a loop, or open with its ends held. Used for the islands' coasts and
 * for the route between the stones.
 */
export function smoothPath(points: readonly Point[], closed: boolean): string {
  const n = points.length;
  const first = points[0];
  if (!first) return '';
  const at = (i: number): Point =>
    (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]) ?? first;
  let d = `M${fmt(first[0])} ${fmt(first[1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/**
 * A closed, smooth coastline inside a `size` square: a ring of ten points
 * pushed in and out at random, every other one drawn further in so the coast
 * has bays. Each project gets its own from its id, so its island is its mark;
 * the middle stays clear for its letters.
 */
export function islandPath(seed: number, size = 24): string {
  const lobes = 10;
  const rand = seeded(seed);
  const c = size / 2;
  const points = Array.from({ length: lobes }, (_, i): Point => {
    const angle = (i / lobes) * Math.PI * 2 + rand() * 0.3;
    const bay = i % 2 ? 0.78 + rand() * 0.12 : 1;
    const r = c * (0.74 + rand() * 0.2) * bay;
    return [c + Math.cos(angle) * r, c + Math.sin(angle) * r];
  });
  return smoothPath(points, true);
}

/**
 * The generic island, drawn by hand rather than generated: at 20px it needs
 * a deeper bay and a headland than a random coast reliably gives.
 */
const ISLAND =
  'M5.2 7.6C6.6 3.9 11.4 2.6 14.6 4.1C16.4 5 16.2 7.2 18 7.9C20.6 8.9 21.6 12.2 20 14.6' +
  'C18.9 16.3 16.4 15.6 15.3 17.2C13.9 19.3 14.6 21.4 11.6 21.3C8.9 21.2 8.4 18.6 6.2 18.1' +
  'C3.4 17.4 2 14.6 3.1 12C3.8 10.3 4.5 9.4 5.2 7.6Z';

/** How a glyph's shape is painted: filled, or stroked as an outline. */
interface Paint {
  fill: string;
  fillRule?: 'evenodd';
  stroke?: string;
  strokeWidth?: number;
}

/** A map pin, with the hole punched through it. */
const PIN =
  'M12 22.4C9.8 19.6 4.8 14.6 4.8 9.6a7.2 7.2 0 0 1 14.4 0c0 5-5 10-7.2 12.8z' +
  'M12 6.9a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 1 0 0-5.4z';

export interface GlyphProps {
  /** Filled, or drawn as an outline (a stage not reached yet). */
  variant?: 'fill' | 'outline';
  className?: string;
  /** A fill other than currentColor (a project's colour). */
  color?: string;
  /** Placed inside another SVG: where, and how big, in its units. */
  at?: { x: number; y: number; size: number };
}

function Glyph({
  variant = 'fill',
  className,
  color,
  at,
  children,
}: GlyphProps & { children: (paint: Paint) => ReactNode }) {
  // A project's colour can be as dark as the page, so a coloured fill gets a
  // faint edge in the ink colour.
  const paint: Paint =
    variant === 'outline'
      ? { fill: 'none', stroke: color ?? 'currentColor', strokeWidth: 1.75 }
      : color
        ? {
            fill: color,
            fillRule: 'evenodd',
            stroke: 'hsl(var(--foreground) / 0.25)',
            strokeWidth: 0.75,
          }
        : { fill: 'currentColor', fillRule: 'evenodd' };
  if (at) {
    return (
      <svg
        viewBox="0 0 24 24"
        x={at.x}
        y={at.y}
        width={at.size}
        height={at.size}
        className={className}
        aria-hidden="true"
      >
        {children(paint)}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5 shrink-0', className)} aria-hidden="true">
      {children(paint)}
    </svg>
  );
}

export function IslandGlyph(props: GlyphProps) {
  return <Glyph {...props}>{(paint) => <path d={ISLAND} {...paint} />}</Glyph>;
}

export function PinGlyph(props: GlyphProps) {
  return <Glyph {...props}>{(paint) => <path d={PIN} {...paint} />}</Glyph>;
}

export function DotGlyph(props: GlyphProps) {
  return <Glyph {...props}>{(paint) => <circle cx={12} cy={12} r={7.5} {...paint} />}</Glyph>;
}

/** The glyph for a stage of the wizard. */
export function StageGlyph({ stage, ...props }: GlyphProps & { stage: WizardStage }) {
  if (stage === 'projects') return <IslandGlyph {...props} />;
  if (stage === 'goals') return <PinGlyph {...props} />;
  return <DotGlyph {...props} />;
}

/** Up to three letters: the project's key when it has one, else its initials. */
export function monogram(name: string, key: string | null): string {
  const short = key?.trim();
  if (short) return short.slice(0, 3).toUpperCase();
  const words = name.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const [first = '?', second] = words;
  return (second ? `${first[0] ?? ''}${second[0] ?? ''}` : first.slice(0, 2)).toUpperCase();
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * White or ink, whichever reads better on `hex`: a project's colour is the
 * user's choice, so the letters on its island cannot assume a dark fill.
 */
export function inkOn(hex: string): string {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return '#ffffff';
  const full = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const lum = 0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);
  const onWhite = 1.05 / (lum + 0.05);
  const onInk = (lum + 0.05) / 0.0588;
  return onWhite >= onInk ? '#ffffff' : '#14181f';
}

/**
 * A project's island: its own outline, its colour, its letters. "No project"
 * is a dashed outline with nothing on it.
 */
export function ProjectIsland({
  id,
  name,
  projectKey,
  color,
  className,
}: {
  /** A number seeds the outline; "No project" passes null. */
  id: number | null;
  name: string;
  projectKey: string | null;
  color: string | null;
  className?: string;
}) {
  const path = islandPath(id ?? 0, 56);
  if (id === null) {
    return (
      <svg viewBox="0 0 56 56" className={cn('h-14 w-14', className)} aria-hidden="true">
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeDasharray="3 4"
          className="text-muted-foreground"
        />
      </svg>
    );
  }
  const fill = color ?? DEFAULT_PROJECT_COLOR;
  const letters = monogram(name, projectKey);
  return (
    <svg viewBox="0 0 56 56" className={cn('h-14 w-14', className)} aria-hidden="true">
      {/* A faint edge, so an island as dark as the page still has a shore. */}
      <path
        d={path}
        fill={fill}
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1.5}
        className="text-foreground"
      />
      <text
        x={28}
        y={29}
        textAnchor="middle"
        dominantBaseline="central"
        fill={inkOn(fill)}
        fontSize={letters.length > 2 ? 13 : 17}
        fontWeight={600}
      >
        {letters}
      </text>
    </svg>
  );
}

/** A task's stone mark: the board's circle, sized by effort as the summary board sizes it. */
export function EffortDot({ effort, color }: { effort: number; color: string }) {
  const clamped = Math.min(EFFORT_MAX, Math.max(EFFORT_MIN, effort));
  const size = 18 + clamped * 7;
  return (
    <span
      className="block shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15"
      style={{ width: size, height: size, backgroundColor: color }}
      aria-hidden
    />
  );
}
