import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Task } from '@shared/schema';
import { DEFAULT_OWNER_COLOR, DEFAULT_PROJECT_COLOR } from '@shared/constants';
import { useTasks } from '@/hooks/use-tasks';
import { useStages } from '@/hooks/use-stages';
import { useOwners } from '@/hooks/use-owners';
import { useProjectScope } from '@/hooks/use-project-scope';
import { useBoardFilters, usePruneChosenGoals } from '@/hooks/use-board-filters';
import {
  FILTER_NONE,
  boardFiltersActive,
  goalsOnOffer,
  tasksOnBoard,
  toggleInList,
  type FilterId,
} from '@/lib/board-filters';
import { inboxTasks } from '@/lib/inbox';
import { Button } from '@/components/ui/button';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { TaskHistoryModal } from '@/components/TaskHistoryModal';
import { FilterOption, FilterRow } from './FilterRow';
import { LandingBottomNav, LandingHeader } from './LandingChrome';
import { LandingInbox } from './LandingInbox';
import { landingOptions } from './landing-options';

type RowKey = 'project' | 'goal' | 'owner' | 'stage';

/**
 * The landing page: the inbox, then what the board shows, then GO. The inbox
 * is the mail that became tasks and has not been opened; a row opens its task
 * here. Below it, four rows choose the board, each a multi-choice read from
 * the board's own data; nothing ticked in a row means the row shows
 * everything. A tick applies at once (the choice is the board's, kept with
 * its project scope), so the count at the foot is always what GO will open.
 * This is the only place the board is filtered.
 */
export default function Landing() {
  // The whole board, whatever the header is scoped to: the counts and the
  // project row are about everything there is to choose from.
  const { data: taskData, isLoading, error } = useTasks('all');
  const liveTasks = useMemo(() => taskData ?? [], [taskData]);
  const { data: stages = [] } = useStages();
  const { data: owners = [] } = useOwners();
  const { projects } = useProjectScope();
  const { filters, setProjects, update, clear } = useBoardFilters();
  const [openRows, setOpenRows] = useState<Set<RowKey>>(() => new Set(['project']));
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const inbox = useMemo(() => inboxTasks(liveTasks), [liveTasks]);
  // A chosen goal archived since (from Admin, say) leaves the Goal row, so it
  // has to stop filtering too: nothing would be left to untick it.
  const offeredGoals = useMemo(
    () => (taskData ? goalsOnOffer(taskData, stages, filters.projects, filters.goals) : undefined),
    [taskData, stages, filters.projects, filters.goals],
  );
  usePruneChosenGoals(offeredGoals);
  const options = useMemo(
    () =>
      landingOptions({
        tasks: liveTasks,
        projects,
        owners,
        stages,
        projectSelection: filters.projects,
        selected: { projects: filters.projects, owners: filters.owners, goals: filters.goals },
      }),
    [liveTasks, projects, owners, stages, filters.projects, filters.owners, filters.goals],
  );
  const showing = useMemo(
    () => tasksOnBoard(liveTasks, filters, stages).length,
    [liveTasks, filters, stages],
  );

  const toggleRow = (key: RowKey) => () => {
    setOpenRows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // A goal outside the projects now chosen would leave the board empty, so
  // it is let go with the project.
  const toggleProject = (id: FilterId) => () => {
    const next = toggleInList(filters.projects, id);
    setProjects(next);
    const offered = new Set(goalsOnOffer(liveTasks, stages, next, filters.goals).map((g) => g.id));
    const kept = filters.goals.filter((g) => offered.has(g));
    if (kept.length !== filters.goals.length) update({ goals: kept });
  };

  const namesOf = <T,>(list: { id: T; label: string }[], chosen: T[]) =>
    list.filter((o) => chosen.includes(o.id)).map((o) => o.label);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex animate-pulse flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading your board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-6">
        <div className="w-full space-y-4 text-center">
          <div className="text-lg font-bold text-destructive">Error loading tasks</div>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="neo-raised rounded-md px-6 py-3 text-sm font-medium text-primary transition-transform active:scale-95"
          >
            Try Refreshing
          </button>
        </div>
      </div>
    );
  }

  return (
    // The board's shell: header and nav in the flow, the page scrolling
    // between them.
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <LandingHeader total={options.total} />

      <main className="flex-1 overflow-y-auto" data-testid="landing-main">
        <div className="mx-auto w-full max-w-6xl px-3 pb-8 pt-4 lg:px-8 lg:pt-8">
          <LandingInbox
            tasks={inbox}
            onOpen={(task) => {
              setOpenTask(task);
              setIsEditOpen(true);
            }}
          />

          <div className="mt-6 flex items-start justify-between gap-4 lg:mt-10">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight text-foreground lg:text-2xl">
                Choose what the board shows
              </h1>
              <p className="mt-1 text-xs text-muted-foreground lg:mt-2 lg:text-sm">
                Tick what you want to see. A row with nothing ticked shows everything.
              </p>
            </div>
            <Button
              variant="outline"
              className="h-10 shrink-0 rounded-md"
              disabled={!boardFiltersActive(filters)}
              onClick={clear}
              data-testid="button-clear-filters"
            >
              Clear all
            </Button>
          </div>

          <div className="mt-4 space-y-3 lg:mt-6 lg:space-y-0 lg:border-b lg:border-border-subtle">
            {projects.length > 0 && (
              <FilterRow
                label="Project"
                testId="project"
                summary={namesOf(options.projects, filters.projects)}
                open={openRows.has('project')}
                onToggle={toggleRow('project')}
              >
                {options.projects.map((o) => (
                  <FilterOption
                    key={o.id}
                    label={o.label}
                    count={o.count}
                    color={o.id === FILTER_NONE ? null : (o.color ?? DEFAULT_PROJECT_COLOR)}
                    checked={filters.projects.includes(o.id)}
                    onChange={toggleProject(o.id)}
                    testId={`project-${o.id}`}
                  />
                ))}
              </FilterRow>
            )}

            {options.goals.length > 0 && (
              <FilterRow
                label="Goal"
                testId="goal"
                summary={namesOf(options.goals, filters.goals)}
                open={openRows.has('goal')}
                onToggle={toggleRow('goal')}
              >
                {options.goals.map((o) => (
                  <FilterOption
                    key={o.id}
                    label={o.label}
                    count={o.count}
                    checked={filters.goals.includes(o.id)}
                    onChange={() => {
                      update({ goals: toggleInList(filters.goals, o.id) });
                    }}
                    testId={`goal-${o.id}`}
                  />
                ))}
              </FilterRow>
            )}

            <FilterRow
              label="Owner"
              testId="owner"
              summary={namesOf(options.owners, filters.owners)}
              open={openRows.has('owner')}
              onToggle={toggleRow('owner')}
            >
              {options.owners.map((o) => (
                <FilterOption
                  key={o.id}
                  label={o.label}
                  count={o.count}
                  color={o.id === FILTER_NONE ? null : (o.color ?? DEFAULT_OWNER_COLOR)}
                  checked={filters.owners.includes(o.id)}
                  onChange={() => {
                    update({ owners: toggleInList(filters.owners, o.id) });
                  }}
                  testId={`owner-${o.id}`}
                />
              ))}
            </FilterRow>

            <FilterRow
              label="Stage"
              testId="stage"
              summary={namesOf(options.stages, filters.stages)}
              open={openRows.has('stage')}
              onToggle={toggleRow('stage')}
            >
              {options.stages.map((o) => (
                <FilterOption
                  key={o.id}
                  label={o.label}
                  count={o.count}
                  checked={filters.stages.includes(o.id)}
                  onChange={() => {
                    update({ stages: toggleInList(filters.stages, o.id) });
                  }}
                  testId={`stage-${o.id}`}
                />
              ))}
            </FilterRow>
          </div>

          <p
            role="status"
            className="mt-6 text-sm text-muted-foreground lg:mt-10"
            data-testid="landing-showing"
          >
            Showing <strong className="font-semibold text-foreground">{showing}</strong> of{' '}
            {options.total} tasks with these filters
          </p>
        </div>
      </main>

      <LandingBottomNav showing={showing} />

      <EditTaskDialog
        task={openTask}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onViewHistory={() => {
          setIsEditOpen(false);
          setIsHistoryOpen(true);
        }}
      />
      <TaskHistoryModal task={openTask} open={isHistoryOpen} onOpenChange={setIsHistoryOpen} />
    </div>
  );
}
