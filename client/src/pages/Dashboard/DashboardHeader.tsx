import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/AppLogo';
import { ProjectSelector } from '@/components/ProjectSelector';
import { useProjectScope } from '@/hooks/use-project-scope';
import { cn } from '@/lib/utils';
import { MoreActionsMenu, type MoreActionsMenuProps } from './MoreActionsMenu';

export interface DashboardHeaderProps extends MoreActionsMenuProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
}

/**
 * App header. On a phone it is the same one-row bar as every other page: the
 * logo at the start, the title centred — the project selector once a project
 * exists, the app name until then — and the search toggle and More at the
 * end. The row never wraps; a long project name truncates instead. The search
 * field opens under the row on demand and stays open while a query is active,
 * so a filter is never hidden.
 *
 * From the tablet breakpoint (`lg`) there is room for everything at once:
 * title and tagline beside the logo, the always-visible search field
 * right-aligned in the title row, then the selector and More.
 */
export function DashboardHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  ...moreActions
}: DashboardHeaderProps) {
  const { projects } = useProjectScope();
  const hasProjects = projects.length > 0;
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* The bar. On a phone it is one non-wrapping line whose leading and
            trailing groups share the leftover width equally, centring the
            title between them. From lg the wrapper dissolves (`contents`) and
            its children join the outer row, where the order classes put the
            title beside the logo and the selector beside More. */}
        <div
          className="flex min-w-0 basis-full items-center gap-2 lg:contents"
          data-testid="app-bar"
        >
          <div className="flex min-w-0 flex-1 basis-0 items-center lg:order-1 lg:flex-none">
            {/* A bare mark on a phone; the raised tile from lg. */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center lg:neo-raised lg:rounded-lg">
              <AppLogo className="h-7 w-7 text-primary lg:h-6 lg:w-6" />
            </div>
          </div>

          {/* Once a project exists the selector names the board on a phone;
              the app name stays for screen readers and comes back at lg. */}
          <div
            className={cn(
              'min-w-0 text-center lg:order-2 lg:text-left',
              hasProjects && 'sr-only lg:not-sr-only',
            )}
          >
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-foreground">
              {import.meta.env.VITE_APP_NAME || 'Kanbando'}
            </h1>
            <p className="hidden truncate text-[10px] leading-tight text-muted-foreground lg:block">
              {import.meta.env.VITE_APP_NAME_SUBTITLE ||
                'Keep on top of the bandos who you need to do'}
            </p>
          </div>

          {/* Hidden until a project exists. */}
          <ProjectSelector className="min-w-0 lg:order-4" />

          <div
            className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-1 lg:order-5 lg:flex-none"
            data-testid="app-bar-actions"
          >
            <button
              type="button"
              aria-label="Search tasks"
              aria-expanded={searchVisible}
              aria-controls="dashboard-search"
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90 lg:hidden"
              onClick={searchVisible ? closeSearch : openSearch}
              data-testid="button-search-toggle"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
            <MoreActionsMenu {...moreActions} />
          </div>
        </div>

        <div
          id="dashboard-search"
          role="search"
          className={cn(
            'relative basis-full',
            searchVisible ? 'block' : 'hidden lg:block',
            'lg:order-3 lg:ml-auto lg:basis-auto lg:w-[26rem] lg:max-w-[40vw]',
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
            className={cn('h-10 rounded-xl pl-10', searchVisible && 'pr-10')}
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
