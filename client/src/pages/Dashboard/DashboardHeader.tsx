import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppLogo } from '@/components/AppLogo';
import { cn } from '@/lib/utils';

export interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
}

/**
 * App header with an always-visible search field. On wide viewports the field
 * sits in the title row, right-aligned beside the theme toggle, so it costs no
 * vertical space; on narrow viewports it wraps to a full-width second row.
 */
export function DashboardHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
}: DashboardHeaderProps) {
  const hasQuery = searchQuery.length > 0;

  return (
    <header className="sticky top-0 z-50 neo-container rounded-none px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 neo-raised rounded-lg flex flex-shrink-0 items-center justify-center">
            <AppLogo className="text-primary h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
              {import.meta.env.VITE_APP_NAME || 'Kanbando'}
            </h1>
            <p className="truncate text-[10px] text-muted-foreground leading-tight">
              {import.meta.env.VITE_APP_NAME_SUBTITLE ||
                'Keep on top of the bandos who you need to do'}
            </p>
          </div>
        </div>

        {/* Order flips at the tablet breakpoint: narrow = title, toggle, then
            the search on its own row; wide = title, search (pushed right), toggle. */}
        <div
          role="search"
          className={cn(
            'relative order-3 basis-full',
            'lg:order-2 lg:ml-auto lg:basis-auto lg:w-[26rem] lg:max-w-[40vw]',
          )}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="text"
            placeholder="Search tasks or enter a task ID..."
            aria-label="Search tasks or enter a task ID"
            className={cn('h-10 rounded-xl pl-10', hasQuery && 'pr-10')}
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && hasQuery) {
                e.preventDefault();
                onClearSearch();
              }
            }}
            data-testid="input-search"
          />
          {hasQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg"
              onClick={onClearSearch}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="order-2 ml-auto flex items-center gap-2 lg:order-3 lg:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
