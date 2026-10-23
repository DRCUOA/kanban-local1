import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Search, Target, X } from 'lucide-react';
import { ROUTES } from '@shared/constants';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/AppLogo';
import { cn } from '@/lib/utils';
import { BuiltByTk } from '@/components/BuiltByTk';
import { MoreActionsMenu, type MoreActionsMenuProps } from './MoreActionsMenu';

export interface DashboardHeaderProps extends MoreActionsMenuProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  /** The goals view of the board's scope: one project, "No project" or every project. */
  goalsHref?: string;
}

/**
 * App header. It carries no filters: what the board shows is chosen on the
 * landing page, which the logo leads back to, and the strip under the header
 * names it. On a phone it is one row: the logo, the app name filling the bar,
 * and the search toggle at the end. Goals and More are not here on a phone:
 * they sit in the bottom nav. The row never wraps. The search field opens
 * under the row on demand and stays open while a query is active, so a
 * search is never hidden.
 *
 * From the tablet breakpoint (`lg`) there is room for everything at once:
 * title and tagline beside the logo, the always-visible search field
 * right-aligned in the title row, then Goals and More.
 */
export function DashboardHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  goalsHref,
  ...moreActions
}: DashboardHeaderProps) {
  const [, navigate] = useLocation();
  const hasQuery = searchQuery.length > 0;
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // A live query keeps the field on screen: the board is filtered by it, so
  // it has to stay visible and clearable.
  const searchVisible = searchOpen || hasQuery;

  const openSearch = () => {
    // The field is display:none until the state lands, and iOS only raises
    // the keyboard for a focus() made inside the tap itself — so flush the
    // render synchronously and focus before the handler returns.
    flushSync(() => {
      setSearchOpen(true);
    });
    searchInputRef.current?.focus();
  };

  const closeSearch = () => {
    setSearchOpen(false);
    if (hasQuery) onClearSearch();
  };

  return (
    <header className="sticky top-0 z-50 neo-container rounded-none px-3 py-2 lg:px-4 lg:py-3">
      {/* Wraps only on a phone, and only for the search field's own row. From
          lg it is one line at any width: the search field flexes, and the
          title, project and goal labels truncate before anything is pushed
          to a second line. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap">
        {/* The bar. On a phone it is one non-wrapping line: the logo, the
            app name taking all the width between, and the search toggle. From
            lg the wrapper dissolves (`contents`) and its children join the
            outer row, where the order classes put the title beside the logo
            and Goals and More at the end. */}
        <div
          className="flex min-w-0 basis-full items-center gap-2 lg:contents"
          data-testid="app-bar"
        >
          <div className="flex flex-none items-center lg:order-1">
            {/* A bare mark on a phone; the raised tile from lg. It leads back
                to the landing page, where the board's filters are chosen. */}
            <button
              type="button"
              aria-label="Choose what the board shows"
              title="Choose what the board shows"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md transition-all active:scale-90 lg:neo-raised lg:rounded-lg"
              onClick={() => {
                navigate(ROUTES.HOME);
              }}
              data-testid="button-landing"
            >
              <AppLogo className="h-7 w-7 lg:h-6 lg:w-6" />
            </button>
          </div>

          <div className="min-w-0 flex-1 text-center lg:order-2 lg:flex-initial lg:text-left">
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-foreground">
              {import.meta.env.VITE_APP_NAME || 'Kanbando'}
            </h1>
            <p className="hidden truncate text-[10px] leading-tight text-muted-foreground lg:block">
              {import.meta.env.VITE_APP_NAME_SUBTITLE ||
                'Keep on top of the bandos who you need to do'}
            </p>
            {/* Wide screens only: the phone bar is a single non-wrapping row
                with no space for a third line. */}
            <BuiltByTk align="start" className="hidden px-0 py-0 leading-tight lg:flex" />
          </div>

          <div
            className="flex flex-none items-center gap-1 lg:order-5"
            data-testid="app-bar-actions"
          >
            <button
              type="button"
              aria-label="Search tasks"
              aria-expanded={searchVisible}
              aria-controls="dashboard-search"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-all active:scale-90 lg:hidden"
              onClick={searchVisible ? closeSearch : openSearch}
              data-testid="button-search-toggle"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
            {/* On a phone these two live in the bottom nav instead. */}
            <div className="hidden items-center gap-1 lg:flex" data-testid="app-bar-wide-actions">
              {goalsHref !== undefined && (
                <button
                  type="button"
                  aria-label="Project goals"
                  title="Project goals"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-all active:scale-90"
                  onClick={() => {
                    navigate(goalsHref);
                  }}
                  data-testid="button-project-goals"
                >
                  <Target className="h-5 w-5" aria-hidden />
                </button>
              )}
              <MoreActionsMenu {...moreActions} />
            </div>
          </div>
        </div>

        <div
          id="dashboard-search"
          role="search"
          className={cn(
            'relative basis-full',
            searchVisible ? 'block' : 'hidden lg:block',
            // Flexes between a usable floor and its full width so the row
            // never has to wrap.
            'lg:order-3 lg:ml-auto lg:flex-1 lg:basis-0 lg:min-w-[8rem] lg:max-w-[26rem]',
          )}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search tasks or enter a task ID..."
            aria-label="Search tasks or enter a task ID"
            className={cn('h-10 rounded-md pl-10', searchVisible && 'pr-10')}
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              // First Escape clears the query, a second one closes the field
              // (which only a phone can see closed).
              if (hasQuery) {
                e.preventDefault();
                onClearSearch();
              } else if (searchOpen) {
                e.preventDefault();
                setSearchOpen(false);
              }
            }}
            data-testid="input-search"
          />
          {/* Clears the query; on a phone it closes the field too, so it is
              also the way out of an empty open field. */}
          {searchVisible && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={hasQuery ? 'Clear search' : 'Close search'}
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg"
              onClick={closeSearch}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
