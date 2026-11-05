import { DEFAULT_PROJECT_COLOR } from '@shared/constants';
import { cn } from '@/lib/utils';

export interface ZenProjectIconProps {
  /** The project's colour; the sun is drawn in it. */
  color?: string | null;
  className?: string;
}

/**
 * The Everyday project's mark: one day as a loop. The sun rides the top of it,
 * the day is the solid arc that turns down at the right, the night is the
 * dotted half underneath that brings it back round, and the tick in the middle
 * is the chore done. Drawn on a 32-unit grid with 2-unit strokes so it sits
 * beside the 24-unit lucide icons at the same weight.
 *
 * The arc stops short of the sun rather than running behind it, so the gap
 * stays a gap on any ground, hover tint included.
 */
export function EverydayIcon({ color, className }: ZenProjectIconProps) {
  const sun = color ?? DEFAULT_PROJECT_COLOR;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-7 w-7', className)}
      aria-hidden
      focusable="false"
      data-testid="everyday-icon"
    >
      {/* Day: up from the left, over the top, round to the right. */}
      <path d="M6 18A10 10 0 0 1 11.62 9.01" stroke="currentColor" strokeWidth={2} />
      <path d="M20.38 9.01A10 10 0 0 1 26 18" stroke="currentColor" strokeWidth={2} />
      <path d="M23.5 15.7 26 18.2l2.5-2.5" stroke="currentColor" strokeWidth={2} />
      {/* Night: the dotted half that brings the day back round. The offset
          starts the dots just past the arrow's tip rather than on it. */}
      <path
        d="M26 18A10 10 0 0 1 6 18"
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="0 3.45"
        strokeDashoffset={1.25}
        opacity={0.55}
      />
      {/* The sun, in the project's colour. */}
      <circle cx={16} cy={8} r={3.2} fill={sun} />
      <path
        d="M16 3.4V1.8M19.25 4.75l1.13-1.13M12.75 4.75l-1.13-1.13"
        stroke={sun}
        strokeWidth={1.6}
      />
      {/* Done. */}
      <path d="m11.8 18.6 3.1 3.1 5.5-6.1" stroke="currentColor" strokeWidth={2.2} />
    </svg>
  );
}
