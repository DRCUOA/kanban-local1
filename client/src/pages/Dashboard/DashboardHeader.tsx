/* eslint-disable @typescript-eslint/no-confusing-void-expression -- R2 baseline: strict fixes deferred to follow-up tasks */
import { LayoutDashboard, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface DashboardHeaderProps {
  searchQuery: string;
  showSearch: boolean;
  onSearchChange: (query: string) => void;
  onToggleSearch: () => void;
  onClearSearch: () => void;
}

export function DashboardHeader({
  searchQuery,
  showSearch,
  onSearchChange,
  onToggleSearch,
  onClearSearch,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 neo-container rounded-none px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 neo-raised rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
              {import.meta.env.VITE_APP_NAME || 'Kanbando'}
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {import.meta.env.VITE_APP_NAME_SUBTITLE ||
                'Keep on top of the bandos who you need to do'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg h-10 w-10"
            onClick={onToggleSearch}
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {showSearch && (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder="Search tasks..."
              className="pl-10 h-11 rounded-xl"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
              }}
              autoFocus
              data-testid="input-search"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg h-10 w-10 shrink-0"
            onClick={onClearSearch}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}
    </header>
  );
}
