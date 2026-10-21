/* eslint-disable @typescript-eslint/no-unnecessary-condition -- R2 baseline: strict fixes deferred to follow-up tasks */
import { type Task } from '@shared/schema';
import { KanbanBoard } from '@/components/KanbanBoard';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { LayoutDashboard, SlidersHorizontal } from 'lucide-react';
import { useLocation } from 'wouter';
import { ROUTES } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DashboardContentProps {
  filteredTasks: Task[];
  focusMode: boolean;
  viewMode: 'detail' | 'summary';
  boardLayout: 'vertical' | 'horizontal';
  searchQuery: string;
  /** Order cards by owner name instead of by due date (EPIC-06 OWN-R33). */
  sortByOwner?: boolean;
  /** True while a warning pill is narrowing the board. */
  isFiltered?: boolean;
  /** True while a landing page row is narrowing the board. */
  landingFiltered?: boolean;
  /** The columns the landing page chose; absent is every open column. */
  columnStageIds?: number[];
  onTaskClick: (task: Task) => void;
}

export function DashboardContent({
  filteredTasks,
  focusMode,
  viewMode,
  boardLayout,
  searchQuery,
  sortByOwner = false,
  isFiltered = false,
  landingFiltered = false,
  columnStageIds,
  onTaskClick,
}: DashboardContentProps) {
  const [, navigate] = useLocation();
  return (
    // Vertical is a page that scrolls: a long run-off at its end lets the last
    // card clear the selection toolbar and toasts that float above the nav.
    // Horizontal fills the viewport and scrolls inside its columns, so they
    // run down to the nav with only the gutter the sides have.
    <main
      className={cn(
        'flex flex-1 flex-col overflow-y-auto',
        boardLayout === 'horizontal' ? 'pb-3' : 'pb-28',
      )}
      data-testid="board-main"
    >
      <div className="flex-1 flex flex-col min-h-0 px-3 pt-2">
        {focusMode && (
          <div className="mb-3 p-3 neo-container rounded-md border-l-4 border-l-primary flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
              <p className="text-xs font-medium">Focus Mode Active</p>
            </div>
          </div>
        )}

        {filteredTasks && filteredTasks.length > 0 ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <KanbanBoard
              tasks={filteredTasks}
              onTaskClick={onTaskClick}
              viewMode={viewMode}
              focusMode={focusMode}
              boardLayout={boardLayout}
              searchQuery={searchQuery}
              sortByOwner={sortByOwner}
              columnStageIds={columnStageIds}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 neo-container rounded-lg mx-2 my-4">
            <div className="h-16 w-16 neo-pressed rounded-full flex items-center justify-center mb-4">
              <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-foreground">No tasks found</h3>
            <p className="text-muted-foreground text-sm mb-6">
              {searchQuery && isFiltered
                ? 'No tasks match your search within the current filter.'
                : searchQuery
                  ? 'No tasks match your search.'
                  : landingFiltered
                    ? 'No task matches the filters on the board.'
                    : isFiltered
                      ? 'Nothing is left once the filter is applied. Press the pill again to show every task.'
                      : 'Create your first task to get started.'}
            </p>
            {landingFiltered && !searchQuery && (
              <Button
                variant="outline"
                className="gap-2 rounded-md"
                onClick={() => {
                  navigate(ROUTES.HOME);
                }}
                data-testid="button-change-filters-empty"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Change filters
              </Button>
            )}
            {!searchQuery && !isFiltered && !landingFiltered && <CreateTaskDialog />}
          </div>
        )}
      </div>
    </main>
  );
}
