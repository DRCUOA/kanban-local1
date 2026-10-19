/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-empty-function, @typescript-eslint/no-misused-promises -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useEffect, useMemo, useState } from 'react';
import { TASK_TYPE, projectViewPath } from '@shared/constants';
import { useTasks, useArchivedTasks } from '@/hooks/use-tasks';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { ShareDialog } from '@/components/ShareDialog';
import { TaskHistoryModal } from '@/components/TaskHistoryModal';
import { TaskWarnings } from '@/components/TaskWarnings';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useBoardLayout } from '@/hooks/use-board-layout';
import { useProjectScope } from '@/hooks/use-project-scope';
import { type Task } from '@shared/schema';
import { ROUTES } from '@shared/constants';
import { Loader2 } from 'lucide-react';
import { useStages } from '@/hooks/use-stages';
import { NavDropSlotsProvider } from '@/components/nav-drop-slots';
import { DashboardHeader } from './DashboardHeader';
import { DashboardContent } from './DashboardContent';
import { DashboardBottomNav } from './DashboardBottomNav';
import { useOwners } from '@/hooks/use-owners';
import { useFilteredTasks } from './use-filtered-tasks';
import { ActiveFilters } from './ActiveFilters';
import { describeActiveFilters } from './active-filters';
import { OWNER_FILTER_ALL, type OwnerFilter } from './owner-view';
import type { BoardWarningKind } from '@shared/board-warnings';
import { useTaskImportExport } from './use-task-import-export';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- page component; props will grow during Phase 5 decomposition
export interface DashboardProps {}

export default function Dashboard(_props: DashboardProps) {
  // The board is scoped server-side to the selected project (header selector);
  // stages, sub-stages and every control stay exactly as they are unscoped.
  const { scope } = useProjectScope();
  const { data: tasks, isLoading, error } = useTasks(scope);
  // Only used by the search-by-ID path, so a slow/failed fetch never blocks the board.
  const { data: archivedTasks } = useArchivedTasks(scope);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'detail' | 'summary'>('summary');
  const [focusMode, setFocusMode] = useState(false);
  // Persisted: Archive/Admin are full navigations, so plain state would reset
  // the layout on every return to the board.
  const { boardLayout, toggleBoardLayout } = useBoardLayout();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isShareBoardOpen, setIsShareBoardOpen] = useState(false);
  // Whose work the board shows, and whether it is ordered by owner (EPIC-06).
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>(OWNER_FILTER_ALL);
  const [sortByOwner, setSortByOwner] = useState(false);
  // Which header warning pill is filtering the board, if any.
  const [warningFilter, setWarningFilter] = useState<BoardWarningKind | null>(null);
  // Which goal the board is narrowed to (the goal and its building-blocks), if any.
  const [goalFilter, setGoalFilter] = useState<number | null>(null);

  const { data: stages = [] } = useStages();
  const { data: owners = [] } = useOwners();
  const { projects, currentProject } = useProjectScope();
  // Goals in the current project scope, for the goal filter.
  const goals = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.type === TASK_TYPE.GOAL && !t.archived)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [tasks],
  );
  // A goal that leaves the scope (another project chosen, archived) stops filtering.
  useEffect(() => {
    if (goalFilter !== null && tasks && !goals.some((g) => g.id === goalFilter))
      setGoalFilter(null);
  }, [goalFilter, goals, tasks]);
  const activeFilters = describeActiveFilters({
    scope,
    projectName: currentProject?.name ?? null,
    hasProjects: projects.length > 0,
    owners,
    ownerFilter,
    warningFilter,
    searchQuery,
    focusMode,
    goalName: goals.find((g) => g.id === goalFilter)?.title ?? null,
  });

  const filteredTasks = useFilteredTasks({
    tasks,
    archivedTasks,
    searchQuery,
    focusMode,
    viewMode,
    stages,
    ownerFilter,
    warningFilter,
    goalFilter,
  });
  const { handleExport, handleImport } = useTaskImportExport({ tasks, stages });

  useKeyboardShortcuts({
    onNewTask: () => {
      setCreateDialogOpen(true);
    },
    onSave: () => {},
    onCancel: () => {
      setIsEditDialogOpen(false);
      setIsHistoryModalOpen(false);
    },
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium text-sm">Loading your board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-4 w-full">
          <div className="text-destructive font-bold text-lg">Error loading tasks</div>
          <p className="text-muted-foreground text-sm">{error.message}</p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="text-primary font-medium text-sm py-3 px-6 neo-raised rounded-md active:scale-95 transition-transform"
          >
            Try Refreshing
          </button>
        </div>
      </div>
    );
  }

  // The goals view of whatever the board is scoped to — one project, "No
  // project" or every project — so the button is always there. The header
  // offers it from lg, the bottom nav on a phone.
  const goalsHref = projectViewPath(scope);

  const moreActions = {
    goals,
    goalFilter,
    onGoalFilterChange: setGoalFilter,
    viewMode,
    focusMode,
    boardLayout,
    owners,
    ownerFilter,
    onSetOwnerFilter: setOwnerFilter,
    sortByOwner,
    onToggleSortByOwner: () => {
      setSortByOwner(!sortByOwner);
    },
    onSetViewMode: setViewMode,
    onToggleFocusMode: () => {
      setFocusMode(!focusMode);
    },
    onToggleBoardLayout: toggleBoardLayout,
    onArchive: () => (window.location.href = ROUTES.ARCHIVE),
    onAdmin: () => (window.location.href = ROUTES.ADMIN),
    onShareBoard: () => {
      setIsShareBoardOpen(true);
    },
    onExport: handleExport,
    onImport: handleImport,
  };

  return (
    // App shell: pin to the viewport (dvh keeps mobile browser chrome honest)
    // so the board owns the space between header and bottom nav and scrolls
    // inside <main> instead of running under the nav.
    // NavDropSlotsProvider spans header→nav so the board can portal its Filing
    // and Bin drop targets onto the nav buttons without leaving its DndContext.
    <NavDropSlotsProvider>
      <div className="h-dvh overflow-hidden bg-background flex flex-col pb-bottom-nav">
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => {
            setSearchQuery('');
          }}
          goalsHref={goalsHref}
          {...moreActions}
        />

        {tasks && tasks.length > 0 && (
          <>
            {/* Phones: the stage chips are left out (the column headers already
              name each stage with its count), but a filter must never be
              invisible. One quiet line shows what narrows the board, and the
              warning pills scroll sideways in a single row instead of wrapping. */}
            <div className="space-y-1.5 px-3 pt-2 lg:hidden" data-testid="phone-filter-strip">
              {/* Both rows sit about the centre; the pills scroll from the
                  left only once they are wider than the screen. */}
              <ActiveFilters filters={activeFilters.filter((f) => f.narrowing)} />
              <div className="-mx-3 overflow-x-auto px-3 pb-1">
                <TaskWarnings
                  tasks={tasks}
                  activeKind={warningFilter}
                  className="mx-auto w-max flex-nowrap"
                  onToggleKind={(kind) => {
                    setWarningFilter((current) => (current === kind ? null : kind));
                  }}
                />
              </div>
            </div>

            {/* From the tablet breakpoint the filters and the warning icons
                share one row above the board. The stage-count chips that used
                to lead it are gone: each column names its stage and count. */}
            <div
              className="hidden items-center gap-3 px-3 pt-2 lg:flex"
              data-testid="wide-filter-strip"
            >
              <ActiveFilters filters={activeFilters} className="min-w-0 flex-1 justify-start" />
              {/* Counted against the whole board, so a count does not change
                  under the filter it is applying. */}
              <TaskWarnings
                tasks={tasks}
                activeKind={warningFilter}
                className="ml-auto flex-nowrap"
                onToggleKind={(kind) => {
                  setWarningFilter((current) => (current === kind ? null : kind));
                }}
              />
            </div>
          </>
        )}

        <DashboardContent
          filteredTasks={filteredTasks}
          focusMode={focusMode}
          viewMode={viewMode}
          boardLayout={boardLayout}
          sortByOwner={sortByOwner}
          isFiltered={
            warningFilter !== null || ownerFilter !== OWNER_FILTER_ALL || goalFilter !== null
          }
          searchQuery={searchQuery}
          onTaskClick={handleTaskClick}
        />

        {/* On a phone the nav also carries Goals and More, which left the
            header so the project selector could have its row. */}
        <DashboardBottomNav goalsHref={goalsHref} moreActions={moreActions} />

        <ShareDialog
          source={{ type: 'board', tasks, stages }}
          open={isShareBoardOpen}
          onOpenChange={setIsShareBoardOpen}
        />

        <EditTaskDialog
          task={selectedTask}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onViewHistory={() => {
            setIsEditDialogOpen(false);
            setIsHistoryModalOpen(true);
          }}
        />

        <TaskHistoryModal
          task={selectedTask}
          open={isHistoryModalOpen}
          onOpenChange={setIsHistoryModalOpen}
        />
      </div>
    </NavDropSlotsProvider>
  );
}
