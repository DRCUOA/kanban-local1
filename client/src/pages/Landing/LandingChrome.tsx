import { format } from 'date-fns';
import { FolderInput, Settings } from 'lucide-react';
import { useLocation } from 'wouter';
import { ROUTES } from '@shared/constants';
import { AppLogo } from '@/components/AppLogo';
import { BuiltByTk } from '@/components/BuiltByTk';
import { NAV_BUTTON_CLASS } from '@/pages/Dashboard/nav-button';

/**
 * The landing page's header: the board's own, less the controls. On a phone
 * the mark and the name sit centred; from lg the name has its tagline and
 * credit beside the raised tile, the page is named, and today's date and the
 * size of the board sit at the far end.
 */
export function LandingHeader({ total }: { total: number }) {
  return (
    <header className="sticky top-0 z-50 neo-container rounded-none px-3 py-2 lg:px-4 lg:py-3">
      <div className="flex min-h-[2.75rem] items-center justify-center gap-2 lg:justify-start lg:gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center lg:neo-raised lg:rounded-lg">
          <AppLogo className="h-7 w-7 text-primary lg:h-6 lg:w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight tracking-tight text-foreground">
            {import.meta.env.VITE_APP_NAME || 'Kanbando'}
          </p>
          <p className="hidden truncate text-[10px] leading-tight text-muted-foreground lg:block">
            {import.meta.env.VITE_APP_NAME_SUBTITLE ||
              'Keep on top of the bandos who you need to do'}
          </p>
          <BuiltByTk align="start" className="hidden px-0 py-0 leading-tight lg:flex" />
        </div>
        <span className="hidden h-8 border-l border-border-subtle lg:block" aria-hidden />
        <span className="label-caps hidden lg:block">Filter</span>

        <p className="ml-auto hidden items-center gap-3 text-sm text-muted-foreground lg:flex">
          <span>{format(new Date(), 'EEE d MMM yyyy')}</span>
          <span className="h-4 border-l border-border-subtle" aria-hidden />
          <span data-testid="landing-total">
            {total} {total === 1 ? 'task' : 'tasks'} on the board
          </span>
        </p>
      </div>
    </header>
  );
}

/**
 * The landing page's nav, in the board's bar: Filing on the left, GO in the
 * middle where the board has Add, and Admin on the right. GO is the way onto
 * the board; the filters are already applied as they are ticked.
 */
export function LandingBottomNav({ showing }: { showing: number }) {
  const [, navigate] = useLocation();
  return (
    <nav className="mobile-bottom-nav">
      <div className="flex flex-nowrap items-center justify-evenly px-2 py-2 lg:justify-around">
        <button
          type="button"
          className={NAV_BUTTON_CLASS}
          onClick={() => {
            navigate(ROUTES.FILING);
          }}
          data-testid="landing-nav-filing"
        >
          <FolderInput className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium">Filing</span>
        </button>

        <button
          type="button"
          className="relative -mt-4 flex flex-col items-center gap-1"
          aria-label={`Go to the board, showing ${showing} ${showing === 1 ? 'task' : 'tasks'}`}
          onClick={() => {
            navigate(ROUTES.DASHBOARD);
          }}
          data-testid="button-go"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg transition-transform active:scale-90">
            GO
          </span>
          <span className="text-[10px] font-medium">Board</span>
        </button>

        <button
          type="button"
          className={NAV_BUTTON_CLASS}
          onClick={() => {
            navigate(ROUTES.ADMIN);
          }}
          data-testid="landing-nav-admin"
        >
          <Settings className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium">Admin</span>
        </button>
      </div>

      <BuiltByTk className="border-t border-border-subtle py-1 text-[9px]" />
    </nav>
  );
}
