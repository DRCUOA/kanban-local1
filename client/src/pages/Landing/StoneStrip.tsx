import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { smoothPath, type Point } from './glyphs';

/** A stone's footprint and the gap between stones, in px (w-[9.5rem] / h-36 / gap-3). */
const STONE_W = 152;
const STONE_H = 144;
const GAP = 12;
/** How far the wave carries a column down at its deepest. */
const SWELL = 36;

/**
 * Pebble-cut corners, four of them in turn, so a row of stones reads as
 * stones laid by hand rather than a grid of cards.
 */
const PEBBLES = [
  '34px 20px 30px 22px / 26px 32px 22px 34px',
  '22px 34px 20px 30px / 32px 22px 34px 20px',
  '30px 24px 34px 18px / 20px 34px 26px 30px',
  '20px 30px 24px 34px / 34px 20px 30px 24px',
];

/** The wave: each column sits a little lower or higher than the last. */
function swell(column: number): number {
  return Math.round(((1 - Math.cos((column * Math.PI) / 2)) / 2) * SWELL);
}

/**
 * The route between the stones: a dashed line through the gap between each
 * column's two stones, following the wave, so the strip reads as a path. It
 * runs in from the left edge and out past the last stone.
 */
function routePath(columns: number): string {
  const points = Array.from(
    { length: columns },
    (_, i): Point => [i * (STONE_W + GAP) + STONE_W / 2, swell(i) + STONE_H + GAP / 2],
  );
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return smoothPath(
    [[-GAP * 2, first[1]], ...points, [last[0] + STONE_W / 2 + GAP * 2, last[1]]],
    false,
  );
}

/**
 * One stage's choices as stepping stones: two to a column, columns rising and
 * falling along the route, the strip scrolling sideways. Stones fill a column
 * top then bottom, so tab order runs along the path.
 */
export function StoneStrip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode[];
  className?: string;
}) {
  const columns: ReactNode[][] = [];
  children.forEach((child, i) => {
    if (i % 2 === 0) columns.push([child]);
    else columns[columns.length - 1]?.push(child);
  });
  const width = columns.length * (STONE_W + GAP) - GAP;
  const height = SWELL + STONE_H * 2 + GAP;

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('-mx-4 snap-x snap-mandatory overflow-x-auto scroll-px-4', className)}
      data-testid="stone-strip"
    >
      <div className="relative w-max px-4 pb-3 pt-1">
        <svg
          className="pointer-events-none absolute left-4 top-1 overflow-visible text-border-strong"
          width={width}
          height={height}
          aria-hidden="true"
        >
          <path
            d={routePath(columns.length)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeDasharray="1 7"
            strokeLinecap="round"
          />
        </svg>
        <div className="relative flex gap-3">
          {columns.map((column, i) => (
            <div key={i} className="flex snap-start flex-col gap-3" style={{ marginTop: swell(i) }}>
              {column}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface StoneProps {
  index: number;
  selected: boolean;
  onToggle: () => void;
  /** The level's shape: an island, a pin, a circle. */
  mark: ReactNode;
  /** Counts, top right. */
  badges?: ReactNode;
  title: string;
  /** A muted line under the title: where it sits. */
  meta?: string;
  /** Read out after the title: the counts the badges draw. */
  description?: string;
  testId: string;
}

/**
 * A choice in the strip. A real toggle button (aria-pressed), so it keeps
 * keyboard and screen-reader behaviour; picked, it fills with the board's
 * selected tint, takes a teal edge and a tick on its mark.
 */
export function Stone({
  index,
  selected,
  onToggle,
  mark,
  badges,
  title,
  meta,
  description,
  testId,
}: StoneProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      // Inline, so the focus ring's radius rule never squares the pebble off.
      style={{ borderRadius: PEBBLES[index % PEBBLES.length] }}
      className={cn(
        'group relative flex h-36 w-[9.5rem] flex-col justify-between border bg-card p-3.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 active:scale-[0.97]',
        selected
          ? 'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary))]'
          : 'border-border-subtle hover:border-border-strong',
      )}
      data-testid={`stone-${testId}`}
      data-selected={selected}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="relative flex h-14 min-w-[3.5rem] items-center justify-start">
          {mark}
          {selected && (
            <span
              className="absolute -bottom-1 left-9 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card"
              aria-hidden
            >
              <Check className="h-3 w-3" strokeWidth={3.5} />
            </span>
          )}
        </span>
        {badges && <span className="flex flex-col items-end gap-1">{badges}</span>}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'line-clamp-2 text-[13px] leading-snug text-foreground',
            selected ? 'font-semibold' : 'font-medium',
          )}
        >
          {title}
        </span>
        {meta && (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{meta}</span>
        )}
        {description && <span className="sr-only">, {description}</span>}
      </span>
    </button>
  );
}

/** A count on a stone: the shape of what it counts, and how many. */
export function Badge({ glyph, count }: { glyph: ReactNode; count: number }) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1 rounded-full border border-border-subtle bg-background pl-1 pr-2 text-[11px] font-semibold tabular-nums text-fg-secondary"
      aria-hidden
    >
      {glyph}
      {count}
    </span>
  );
}
