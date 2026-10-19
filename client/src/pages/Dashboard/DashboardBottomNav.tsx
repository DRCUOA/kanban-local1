import { useState } from 'react';
import { Archive, CheckCircle2, FolderInput, Target, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { MenuPanel } from '@/components/MenuPanel';
import { useNavDropSlots } from '@/components/nav-drop-slots';
import { BuiltByTk } from '@/components/BuiltByTk';
import { filingTargets } from '@/lib/filing-targets';
import { ROUTES } from '@shared/constants';
import { useStages } from '@/hooks/use-stages';
import { cn } from '@/lib/utils';
import { MoreActionsMenu, type MoreActionsMenuProps } from './MoreActionsMenu';
import { NAV_BUTTON_CLASS } from './nav-button';

export interface DashboardBottomNavProps {
  /**
   * The goals view of the board's scope: one project, "No project" or every
   * project. The board always passes one, so the button is always there.
   */
  goalsHref?: string;
  /**
   * When given, More sits in this bar on a phone, between Add and Bin; from
   * the tablet breakpoint the header keeps it and the bar hides its copy.
   */
  moreActions?: MoreActionsMenuProps;
}

/**
 * The three places a task can go — Filing on the left, Add in the middle, Bin
 * on the right — and, on a phone, the two buttons that left the header so the
 * project selector could have its row: Goals between Filing and Add, More
 * between Add and Bin. The view toggles live in More; the board's done/archive
 * band is gone, and Filing is where a finished task goes, by tap or by drag.
 *
 * Each of Filing and Bin wraps an empty slot the board portals its drop target
 * into (see nav-drop-slots), which is why both buttons are positioned.
 */
export function DashboardBottomNav({ goalsHref, moreActions }: DashboardBottomNavProps) {
  const [, navigate] = useLocation();
  const { data: stages = [] } = useStages();
  const { setFiling, setBin } = useNavDropSlots();
  const [filingOpen, setFilingOpen] = useState(false);
  const targets = filingTargets(stages);

  return (
    <nav className="mobile-bottom-nav">
      {/* One row, never wrapping: the buttons are sized to fit five across a
          320px screen, and they spread evenly about the centre. */}
      <div className="flex flex-nowrap items-center justify-evenly px-2 py-2 lg:justify-around">
        <div className="relative" ref={setFiling}>
          <button
            type="button"
            className={NAV_BUTTON_CLASS}
            aria-haspopup="menu"
            aria-expanded={filingOpen}
            onClick={() => {
              setFilingOpen(!filingOpen);
            }}
            data-testid="nav-filing"
          >
            <FolderInput className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-[10px] font-medium">Filing</span>
          </button>

          {/* Centred on a phone, hung above the button from lg (see MenuPanel). */}
          <MenuPanel
            open={filingOpen}
            onClose={() => {
              setFilingOpen(false);
            }}
            anchor="above-start"
            label="Filing"
            testId="filing-menu"
          >
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              File to
            </p>
            {targets.map((target) => (
              <button
                key={target.id}
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm transition-colors active:bg-muted/50"
                onClick={() => {
                  setFilingOpen(false);
                  navigate(target.href);
                }}
              >
                {target.action === 'archive' ? (
                  <Archive className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="truncate">{target.label}</span>
              </button>
            ))}
          </MenuPanel>
        </div>

        {goalsHref !== undefined && (
          <button
            type="button"
            className={cn(NAV_BUTTON_CLASS, 'lg:hidden')}
            aria-label="Project goals"
            onClick={() => {
              navigate(goalsHref);
            }}
            data-testid="nav-goals"
          >
            <Target className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-[10px] font-medium">Goals</span>
          </button>
        )}

        <CreateTaskDialog iconOnly />

        {moreActions && (
          <div className="lg:hidden" data-testid="nav-more">
            <MoreActionsMenu {...moreActions} variant="nav" />
          </div>
        )}

        <div className="relative" ref={setBin}>
          <button
            type="button"
            className={cn(NAV_BUTTON_CLASS, 'hover:text-destructive')}
            onClick={() => {
              navigate(ROUTES.BIN);
            }}
            data-testid="nav-bin"
          >
            <Trash2 className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-[10px] font-medium">Bin</span>
          </button>
        </div>
      </div>

      {/* Under the drop targets, not among them: a credit that sat in the row
          would be one more thing to aim at during a drag. */}
      <BuiltByTk className="border-t border-border-subtle py-1 text-[9px]" />
    </nav>
  );
}
