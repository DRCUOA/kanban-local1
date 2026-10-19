import type { Task } from '@shared/schema';
import {
  BOARD_WARNING_KINDS,
  countBoardWarnings,
  STALE_AFTER_DAYS,
  type BoardWarningKind,
} from '@shared/board-warnings';
import { Clock, Hourglass, Layers, TriangleAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStages } from '@/hooks/use-stages';

interface TaskWarningsProps {
  tasks: Task[];
  /** The warning the board is currently filtered to, if any. */
  activeKind?: BoardWarningKind | null;
  /** Called with the pill pressed; the same pill again means "stop filtering". */
  onToggleKind?: (kind: BoardWarningKind) => void;
  className?: string;
}

type WarningTone = 'info' | 'warning' | 'destructive';

interface WarningPill {
  tone: WarningTone;
  /** Each kind has its own glyph: as icons alone they must tell apart. */
  icon: typeof Clock;
  title: string;
  /** Full sentence, with the count — the hover text and accessible name. */
  message: (count: number) => string;
}

const PILLS: Record<BoardWarningKind, WarningPill> = {
  'in-progress': {
    tone: 'info',
    icon: Layers,
    title: 'Many in progress',
    message: (count) => `${count} tasks in progress. Focus on fewer.`,
  },
  'high-priority': {
    tone: 'warning',
    icon: TriangleAlert,
    title: 'High-priority waiting',
    message: (count) => `${count} high-priority in backlog.`,
  },
  overdue: {
    tone: 'destructive',
    icon: Clock,
    title: 'Overdue',
    message: (count) => `${count} task${count > 1 ? 's' : ''} overdue.`,
  },
  stale: {
    tone: 'info',
    icon: Hourglass,
    title: 'Stale tasks',
    message: (count) => `${count} not updated in ${STALE_AFTER_DAYS}+ days.`,
  },
};

const TONE_CLASS: Record<WarningTone, string> = {
  destructive: 'text-danger',
  warning: 'text-warning',
  info: 'text-primary',
};

/**
 * The pressed pill. The tone's own colour washes the pill and rings it, so the
 * one that is filtering reads as switched on at a glance rather than by its
 * text alone — and `aria-pressed` says the same thing to a screen reader.
 * Written out per tone because Tailwind only keeps class names it can see.
 */
const TONE_ACTIVE_CLASS: Record<WarningTone, string> = {
  destructive: 'neo-pressed bg-danger/15 ring-1 ring-danger/50',
  warning: 'neo-pressed bg-warning/15 ring-1 ring-warning/50',
  info: 'neo-pressed bg-primary/15 ring-1 ring-primary/50',
};

/**
 * Board-level warnings as icons, in the tone the matching card borders use
 * (overdue red, high-priority gold, info blue). The name, the count and the
 * full sentence are the icon's hover text and its accessible name.
 *
 * An icon is also the filter for what it counts: pressing it shows only those
 * tasks, pressing it again shows everything. The pressed icon opens to name
 * what it is filtering — which is also how a phone, with no hover, gets the
 * text. Counts are taken from the whole board, not from what is currently
 * shown, so they stay put while filtering and you can move from one to the
 * next.
 */
export function TaskWarnings({
  tasks,
  activeKind = null,
  onToggleKind,
  className,
}: TaskWarningsProps) {
  const { data: stages = [] } = useStages();

  const counts = countBoardWarnings(tasks, stages, new Date());
  const kinds = BOARD_WARNING_KINDS.filter((kind) => counts[kind] !== undefined);

  if (kinds.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <ul
        aria-label="Board warnings"
        data-testid="task-warnings"
        className={cn('flex flex-wrap items-center gap-1.5 lg:justify-end', className)}
      >
        {kinds.map((kind) => {
          const pill = PILLS[kind];
          const count = counts[kind] ?? 0;
          const Icon = pill.icon;
          const isActive = activeKind === kind;
          const label = `${pill.title}: ${pill.message(count)}`;

          return (
            <li key={kind} className="flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    aria-label={`${label} ${
                      isActive
                        ? 'Showing only these. Press to show every task.'
                        : 'Press to show only these.'
                    }`}
                    onClick={() => onToggleKind?.(kind)}
                    data-testid={`task-warning-${kind}`}
                    className={cn(
                      // A round icon until pressed; then it widens to carry
                      // its name and count.
                      'flex h-11 items-center justify-center gap-1.5 rounded-full transition-all active:scale-95 lg:h-9',
                      isActive
                        ? cn('px-3', TONE_ACTIVE_CLASS[pill.tone])
                        : 'w-11 neo-raised lg:w-9',
                      TONE_CLASS[pill.tone],
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {isActive && (
                      <span
                        className="whitespace-nowrap font-display text-[11px] font-bold uppercase tracking-wider"
                        data-testid={`task-warning-${kind}-label`}
                      >
                        {pill.title}
                        <span className="ml-1.5 font-mono font-semibold opacity-80">{count}</span>
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="px-3 py-1.5 text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}
