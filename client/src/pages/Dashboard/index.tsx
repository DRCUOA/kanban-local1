/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-empty-function, @typescript-eslint/no-misused-promises -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useMemo, useState } from 'react';
import { projectViewPath } from '@shared/constants';
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
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { useLocation } from 'wouter';
import { useStages } from '@/hooks/use-stages';
import { NavDropSlotsProvider } from '@/components/nav-drop-slots';
import { DashboardHeader } from './DashboardHeader';
import { DashboardContent } from './DashboardContent';
import { DashboardBottomNav } from './DashboardBottomNav';
import { useOwners } from '@/hooks/use-owners';
import { useFilteredTasks } from './use-filtered-tasks';
import { ActiveFilters } from './ActiveFilters';
import { describeActiveFilters } from './active-filters';
import { useBoardFilters, usePruneChosenGoals } from '@/hooks/use-board-filters';
import {
  FILTER_NONE,
  boardColumnStages,
  boardFiltersActive,
  goalsOnOffer,
} from '@/lib/board-filters';
import { useTaskImportExport } from './use-task-import-export';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- page component; props will grow during Phase 5 decomposition
export interface DashboardProps {}

export default function Dashboard(_props: DashboardProps) {
  // The board is scoped server-side to the project chosen on the landing page;
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
  // Whether cards are ordered by owner (EPIC-06). Whose work the board shows
  // is one of the landing page's rows: the landing page is the only place the
  // board is filtered, and the board only names what it chose.
  const [sortByOwner, setSortByOwner] = useState(false);
  const { filters: boardFilters } = useBoardFilters();
  const [, navigate] = useLocation();

  const { data: stages = [] } = useStages();
  const { data: owners = [] } = useOwners();
  const { projects, currentProject, projectById } = useProjectScope();
  // The goals the landing page could have chosen, for the chips' names. A
  // chosen goal that leaves the scope (another project chosen, archived)
  // stops filtering; one that is merely done keeps filtering until unticked.
  const goals = useMemo(
    () =>
      tasks ? goalsOnOffer(tasks, stages, boardFilters.projects, boardFilters.goals) : undefined,
    [tasks, stages, boardFilters.projects, boardFilters.goals],
  );
  usePruneChosenGoals(goals);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  const activeFilters = describeActiveFilters({
    scope,
    projectName: currentProject?.name ?? null,
    hasProjects: projects.length > 0,
    projectNames:
      boardFilters.projects.length > 1
        ? boardFilters.projects.map((id) =>
            id === FILTER_NONE ? 'No project' : (projectById(id)?.name ?? 'Unknown project'),
          )
        : undefined,
    owners,
    ownerSelection: boardFilters.owners,
    searchQuery,
    focusMode,
    goalNames: boardFilters.goals.map(
      (id) => goals?.find((g) => g.id === id)?.title ?? 'Unknown goal',
    ),
    stageNames: sortedStages
      .filter((stage) => boardFilters.stages.includes(stage.id))
      .map((stage) => stage.name.trim()),
  });

  const narrowingFilters = activeFilters.filter((f) => f.narrowing);

  const filteredTasks = useFilteredTasks({
    tasks,
    archivedTasks,
    searchQuery,
    focusMode,
    viewMode,
    stages,
    boardFilters,
  });

  // Only when the landing page chose stages; otherwise the board picks its
  // usual open columns itself.
  const columnStageIds = useMemo(
    () =>
      boardFilters.stages.length === 0
        ? undefined
        : boardColumnStages(sortedStages, boardFilters).map((s) => s.id),
    [sortedStages, boardFilters],
  );
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

  // Beside the filter chips: the chips say what narrows the board, this is
  // the way back to the landing page that chose it.
  const changeFilters = (
    <button
      type="button"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] leading-none text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground active:scale-95"
      onClick={() => {
        navigate(ROUTES.HOME);
      }}
      data-testid="button-change-filters"
    >
      <SlidersHorizontal className="h-3 w-3" aria-hidden />
      Change
    </button>
  );

  const moreActions = {
    viewMode,
    focusMode,
    boardLayout,
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
    // with the header at the top and the nav at the bottom, both in the flow,
    // so <main> is exactly the space between them and scrolls inside itself
    // instead of running under the nav.
    // NavDropSlotsProvider spans header→nav so the board can portal its Filing
    // and Bin drop targets onto the nav buttons without leaving its DndContext.
    <NavDropSlotsProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
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
            {/* Phones: a filter must never be invisible. One quiet line shows
              what the landing page chose, with the way back to it, and the
              warning icons scroll sideways in a single row instead of wrapping. */}
            <div className="space-y-1.5 px-3 pt-2 lg:hidden" data-testid="phone-filter-strip">
              {/* Both rows sit about the centre; the pills scroll from the
                  left only once they are wider than the screen. */}
              {narrowingFilters.length > 0 && (
                // Wraps rather than spill: Change drops under the chips when
                // they need the width.
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <ActiveFilters filters={narrowingFilters} className="max-w-full" />
                  {changeFilters}
                </div>
              )}
              <div className="-mx-3 overflow-x-auto px-3 pb-1">
                <TaskWarnings tasks={tasks} className="mx-auto w-max flex-nowrap" />
              </div>
            </div>

            {/* From the tablet breakpoint the filter chips and the warning
                icons share one row above the board. */}
            <div
              className="hidden items-center gap-3 px-3 pt-2 lg:flex"
              data-testid="wide-filter-strip"
            >
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <ActiveFilters filters={activeFilters} className="min-w-0 justify-start" />
                {changeFilters}
              </div>
              {/* Counted against the whole board, not what the filters leave. */}
              <TaskWarnings tasks={tasks} className="ml-auto flex-nowrap" />
            </div>
          </>
        )}

        <DashboardContent
          filteredTasks={filteredTasks}
          focusMode={focusMode}
          viewMode={viewMode}
          boardLayout={boardLayout}
          sortByOwner={sortByOwner}
          landingFiltered={boardFiltersActive(boardFilters)}
          columnStageIds={columnStageIds}
          searchQuery={searchQuery}
          onTaskClick={handleTaskClick}
        />

        {/* On a phone the nav also carries Goals and More. */}
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
