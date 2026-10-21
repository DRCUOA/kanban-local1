/* eslint-disable @typescript-eslint/no-confusing-void-expression -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState } from 'react';
import {
  Archive,
  CircleDot,
  Columns,
  Download,
  Focus,
  List,
  Rows,
  Settings,
  Share2,
  Upload,
} from 'lucide-react';
import { User, ArrowDownAZ, Target } from 'lucide-react';
import type { Task } from '@shared/schema';
import { MenuPanel } from '@/components/MenuPanel';
import { BuiltByTk } from '@/components/BuiltByTk';
import type { OwnerSummary } from '@shared/schema';
import { DEFAULT_OWNER_COLOR } from '@shared/constants';
import { FILTER_NONE, type FilterId } from '@/lib/board-filters';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { NAV_BUTTON_CLASS } from './nav-button';

export interface MoreActionsMenuProps {
  /**
   * How the trigger renders: a bare icon in the header (`icon`, the default),
   * or icon-over-label like its neighbours in the bottom nav (`nav`).
   */
  variant?: 'icon' | 'nav';
  viewMode: 'detail' | 'summary';
  /**
   * Whose work the board shows (EPIC-06 OWN-R32); empty is everyone. The
   * landing page can choose several; a row here picks just that one. Optional
   * so a caller that does not own this state still gets a working menu: the
   * defaults are the unfiltered, due-date-ordered board.
   */
  ownerSelection?: FilterId[];
  onSetOwnerSelection?: (next: FilterId[]) => void;
  /** Order cards by owner name rather than by due date (OWN-R33). */
  sortByOwner?: boolean;
  onToggleSortByOwner?: () => void;
  /** The owners to offer. Absent means the menu shows no owner rows. */
  owners?: OwnerSummary[];
  focusMode: boolean;
  boardLayout: 'vertical' | 'horizontal';
  onSetViewMode: (mode: 'detail' | 'summary') => void;
  onToggleFocusMode: () => void;
  onToggleBoardLayout: () => void;
  onArchive: () => void;
  onAdmin: () => void;
  onShareBoard: () => void;
  onExport: () => void;
  onImport: () => void;
  /**
   * Goals in scope and the ones the board is narrowed to. The header shows a
   * goal picker from the tablet breakpoint; on a phone this menu is where the
   * goal filter lives.
   */
  goals?: Task[];
  goalSelection?: number[];
  onGoalSelectionChange?: (next: number[]) => void;
}

/**
 * Everything that changes how the board is *viewed*, plus the board-level
 * actions. From the tablet breakpoint it lives in the header; on a phone it
 * sits in the bottom nav, so the header row is the project selector's. The
 * panel opens centred on a phone and hangs from the button from the tablet
 * breakpoint (see MenuPanel).
 */
export function MoreActionsMenu({
  variant = 'icon',
  viewMode,
  ownerSelection = [],
  onSetOwnerSelection,
  sortByOwner = false,
  onToggleSortByOwner,
  owners = [],
  focusMode,
  boardLayout,
  onSetViewMode,
  onToggleFocusMode,
  onToggleBoardLayout,
  onArchive,
  onAdmin,
  onShareBoard,
  onExport,
  onImport,
  goals = [],
  goalSelection = [],
  onGoalSelectionChange,
}: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const activeOwners = owners.filter(
    (owner) => !owner.archived || ownerSelection.includes(owner.id),
  );

  const row = 'w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-colors';
  const toggleRow = (active: boolean) =>
    cn(row, active ? 'bg-primary/10 font-semibold text-primary' : 'active:bg-muted/50');
  const actionRow = cn(row, 'active:bg-muted/50');

  // Actions close the menu; view toggles keep it open so several can be tried
  // in a row without reopening it each time.
  const runAndClose = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
        className={
          variant === 'nav'
            ? NAV_BUTTON_CLASS
            : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-all active:scale-90'
        }
        onClick={() => {
          setOpen(!open);
        }}
        data-testid="button-more-options"
      >
        <Settings className="h-5 w-5 shrink-0" />
        <span className={variant === 'nav' ? 'text-[10px] font-medium' : 'sr-only'}>More</span>
      </button>

      <MenuPanel
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        anchor="below-end"
        label="Board and view options"
        testId="more-actions-menu"
        footer={
          <div className="border-t border-border-subtle pt-1">
            <BuiltByTk />
          </div>
        }
      >
        <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          View
        </p>
        <button
          className={toggleRow(viewMode === 'detail')}
          aria-pressed={viewMode === 'detail'}
          onClick={() => {
            onSetViewMode('detail');
          }}
        >
          <List className="h-4 w-4" />
          Detail
        </button>
        <button
          className={toggleRow(viewMode === 'summary')}
          aria-pressed={viewMode === 'summary'}
          onClick={() => {
            onSetViewMode('summary');
          }}
        >
          <CircleDot className="h-4 w-4" />
          Summary
        </button>
        <button
          className={toggleRow(focusMode)}
          aria-pressed={focusMode}
          onClick={onToggleFocusMode}
        >
          <Focus className="h-4 w-4" />
          Focus
        </button>
        <button className={toggleRow(false)} onClick={onToggleBoardLayout}>
          {boardLayout === 'vertical' ? (
            <Columns className="h-4 w-4" />
          ) : (
            <Rows className="h-4 w-4" />
          )}
          {boardLayout === 'vertical' ? 'Horiz' : 'Vert'}
        </button>

        {onGoalSelectionChange && (goals.length > 0 || goalSelection.length > 0) && (
          <div className="lg:hidden" data-testid="more-goal-filter">
            <div className="my-1 border-t border-border-subtle" />
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Goal
            </p>
            <button
              className={toggleRow(goalSelection.length === 0)}
              aria-pressed={goalSelection.length === 0}
              onClick={() => {
                onGoalSelectionChange([]);
              }}
            >
              <Target className="h-4 w-4" />
              All goals
            </button>
            {goals.map((goal) => (
              <button
                key={goal.id}
                className={toggleRow(goalSelection.includes(goal.id))}
                aria-pressed={goalSelection.includes(goal.id)}
                onClick={() => {
                  onGoalSelectionChange([goal.id]);
                }}
                data-testid={`goal-filter-option-${goal.id}`}
              >
                <Target className="h-4 w-4 opacity-40" />
                <span className="truncate">{goal.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="my-1 border-t border-border-subtle" />

        {/* Whose work the board shows, and whether cards are ordered by owner
            instead of by due date (EPIC-06 OWN-R32, OWN-R33). */}
        <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Owner
        </p>
        <button
          className={toggleRow(ownerSelection.length === 0)}
          aria-pressed={ownerSelection.length === 0}
          onClick={() => {
            onSetOwnerSelection?.([]);
          }}
          data-testid="owner-filter-all"
        >
          <User className="h-4 w-4" />
          Everyone
        </button>
        {activeOwners.map((owner) => (
          <button
            key={owner.id}
            className={toggleRow(ownerSelection.includes(owner.id))}
            aria-pressed={ownerSelection.includes(owner.id)}
            onClick={() => {
              onSetOwnerSelection?.([owner.id]);
            }}
            data-testid={`owner-filter-${owner.id}`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: owner.color ?? DEFAULT_OWNER_COLOR }}
              aria-hidden
            />
            <span className="truncate">{owner.name}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{owner.taskCount}</span>
          </button>
        ))}
        <button
          className={toggleRow(ownerSelection.includes(FILTER_NONE))}
          aria-pressed={ownerSelection.includes(FILTER_NONE)}
          onClick={() => {
            onSetOwnerSelection?.([FILTER_NONE]);
          }}
          data-testid="owner-filter-none"
        >
          <User className="h-4 w-4 opacity-40" />
          Unassigned
        </button>
        <button
          className={toggleRow(sortByOwner)}
          aria-pressed={sortByOwner}
          onClick={() => onToggleSortByOwner?.()}
          data-testid="owner-sort-toggle"
        >
          <ArrowDownAZ className="h-4 w-4" />
          Sort by owner
        </button>

        <div className="my-1 border-t border-border-subtle" />

        <ThemeToggle variant="row" />
        <button className={actionRow} onClick={runAndClose(onArchive)}>
          <Archive className="h-4 w-4" />
          Archive
        </button>
        <button className={actionRow} onClick={runAndClose(onAdmin)}>
          <Settings className="h-4 w-4" />
          Admin
        </button>
        <button className={actionRow} onClick={runAndClose(onShareBoard)}>
          <Share2 className="h-4 w-4" />
          Share Board
        </button>
        <button className={actionRow} onClick={runAndClose(onExport)}>
          <Download className="h-4 w-4" />
          Export Tasks
        </button>
        <button className={actionRow} onClick={runAndClose(onImport)}>
          <Upload className="h-4 w-4" />
          Import Tasks
        </button>
      </MenuPanel>
    </div>
  );
}
