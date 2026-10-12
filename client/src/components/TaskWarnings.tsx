import type { Task } from '@shared/schema';
import {
  BOARD_WARNING_KINDS,
  countBoardWarnings,
  STALE_AFTER_DAYS,
  type BoardWarningKind,
} from '@shared/board-warnings';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock } from 'lucide-react';
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
  icon: typeof AlertCircle;
  title: string;
  /** Full sentence — the pill shows only title + count, this is its tooltip. */
  message: (count: number) => string;
}

const PILLS: Record<BoardWarningKind, WarningPill> = {
  'in-progress': {
    tone: 'info',
    icon: AlertCircle,
    title: 'Many in progress',
    message: (count) => `${count} tasks in progress. Focus on fewer.`,
  },
  'high-priority': {
    tone: 'warning',
    icon: AlertCircle,
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
    icon: AlertCircle,
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
 * Board-level warnings as compact pills — icon, title, count — meant to sit in
 * the stage-chip row so they cost no vertical space on a wide viewport. The
 * full sentence is the pill's tooltip and accessible name. Colours match the
 * task-border accents these warnings share (overdue red, high-priority gold,
 * info blue).
 *
 * A pill is also the filter for what it counts: pressing it shows only those
 * tasks, pressing it again shows everything. Counts are taken from the whole
 * board, not from what is currently shown, so they stay put while filtering
 * and you can move from one pill to the next.
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
    <ul
      aria-label="Board warnings"
      data-testid="task-warnings"
      // Right-aligned at the end of the chip row; when the pills have wrapped
      // under the chips on a narrow viewport they read better as a left-aligned
      // list than as ragged right-aligned rows.
      className={cn('flex flex-wrap items-center gap-1.5 lg:justify-end', className)}
    >
      {kinds.map((kind) => {
        const pill = PILLS[kind];
        const count = counts[kind] ?? 0;
        const Icon = pill.icon;
        const isActive = activeKind === kind;
        const message = pill.message(count);

        return (
          <li key={kind} className="flex-shrink-0">
            <button
              type="button"
              title={message}
              aria-pressed={isActive}
              aria-label={`${pill.title}: ${message} ${
                isActive
                  ? 'Showing only these. Press to show every task.'
                  : 'Press to show only these.'
              }`}
              onClick={() => onToggleKind?.(kind)}
              data-testid={`task-warning-${kind}`}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all active:scale-95',
                isActive ? TONE_ACTIVE_CLASS[pill.tone] : 'neo-raised',
                TONE_CLASS[pill.tone],
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="whitespace-nowrap font-display text-[11px] font-bold uppercase tracking-wider">
                {pill.title}
              </span>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] neo-pressed rounded-md px-1.5 py-0 min-h-0 min-w-0 h-5"
              >
                {count}
              </Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
