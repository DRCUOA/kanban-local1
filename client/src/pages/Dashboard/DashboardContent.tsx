/* eslint-disable @typescript-eslint/no-unnecessary-condition -- R2 baseline: strict fixes deferred to follow-up tasks */
import { type Task } from '@shared/schema';
import { KanbanBoard } from '@/components/KanbanBoard';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { LayoutDashboard } from 'lucide-react';

export interface DashboardContentProps {
  filteredTasks: Task[];
  focusMode: boolean;
  viewMode: 'detail' | 'summary';
  boardLayout: 'vertical' | 'horizontal';
  searchQuery: string;
  /** Order cards by owner name instead of by due date (EPIC-06 OWN-R33). */
  sortByOwner?: boolean;
  /** True while a warning pill or an owner is narrowing the board. */
  isFiltered?: boolean;
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
  onTaskClick,
}: DashboardContentProps) {
  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 px-3 pt-2">
        {focusMode && (
          <div className="mb-3 p-3 neo-container rounded-xl border-l-4 border-l-primary flex-shrink-0">
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
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 neo-container rounded-2xl mx-2 my-4">
            <div className="h-16 w-16 neo-pressed rounded-full flex items-center justify-center mb-4">
              <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-foreground">No tasks found</h3>
            <p className="text-muted-foreground text-sm mb-6">
              {searchQuery && isFiltered
                ? 'No tasks match your search within the current filter.'
                : searchQuery
                  ? 'No tasks match your search.'
                  : isFiltered
                    ? 'Nothing is left once the filter is applied. Press the pill again to show every task.'
                    : 'Create your first task to get started.'}
            </p>
            {!searchQuery && !isFiltered && <CreateTaskDialog />}
          </div>
        )}
      </div>
    </main>
  );
}
