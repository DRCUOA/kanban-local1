import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { AppLogo } from '@/components/AppLogo';
import { BuiltByTk } from '@/components/BuiltByTk';

/**
 * The landing page's header: the board's own, less the controls. On a phone
 * the mark and the name sit centred with the inbox at the far end; from lg
 * the name has its tagline and credit beside the raised tile, the page is
 * named, and today's date and the size of the board sit at the far end.
 */
export function LandingHeader({ total, inbox }: { total: number; inbox?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 neo-container rounded-none px-3 py-2 lg:px-4 lg:py-3">
      <div className="relative flex min-h-[2.75rem] items-center justify-center gap-2 lg:justify-start lg:gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center lg:neo-raised lg:rounded-lg">
          <AppLogo className="h-7 w-7 lg:h-6 lg:w-6" />
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

        {inbox && <div className="absolute right-0 lg:static">{inbox}</div>}
      </div>
    </header>
  );
}
