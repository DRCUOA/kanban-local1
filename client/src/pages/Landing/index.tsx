import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Loader2 } from 'lucide-react';
import { DEFAULT_OWNER_COLOR, DEFAULT_PROJECT_COLOR } from '@shared/constants';
import { useTasks, useArchivedTasks } from '@/hooks/use-tasks';
import { useStages } from '@/hooks/use-stages';
import { useOwners } from '@/hooks/use-owners';
import { useProjectScope } from '@/hooks/use-project-scope';
import { useBoardFilters } from '@/hooks/use-board-filters';
import {
  DUE_MODE,
  FILTER_NONE,
  boardFiltersActive,
  endOfDueDay,
  tasksOnBoard,
  toggleInList,
  type DueMode,
  type FilterId,
} from '@/lib/board-filters';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FilterOption, FilterRow } from './FilterRow';
import { LandingBottomNav, LandingHeader } from './LandingChrome';
import { goalsInProjects, landingOptions } from './landing-options';
import 'react-day-picker/dist/style.css';

type RowKey = 'project' | 'goal' | 'owner' | 'due' | 'stage' | 'new';

const DUE_CHOICES: { mode: DueMode; label: string }[] = [
  { mode: DUE_MODE.ANY, label: 'Any date' },
  { mode: DUE_MODE.OPEN, label: 'Not done before' },
  { mode: DUE_MODE.ARCHIVED, label: 'Archived before' },
];

/**
 * The landing page: choose what the board shows, then GO. Each row is a
 * multi-choice read from the board's own data; nothing chosen in a row means
 * the row does not filter. A tick applies at once (the choice is the board's,
 * kept with its project scope), so the count at the foot is always what GO
 * will open.
 */
export default function Landing() {
  // The whole board, whatever the header is scoped to: the counts and the
  // project row are about everything there is to choose from.
  const { data: liveTasks = [], isLoading, error } = useTasks('all');
  const { data: archivedTasks = [] } = useArchivedTasks('all');
  const { data: stages = [] } = useStages();
  const { data: owners = [] } = useOwners();
  const { projects } = useProjectScope();
  const { filters, setProjects, update, clear } = useBoardFilters();
  const [openRows, setOpenRows] = useState<Set<RowKey>>(() => new Set(['project']));
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const options = useMemo(
    () =>
      landingOptions({
        tasks: liveTasks,
        projects,
        owners,
        stages,
        projectSelection: filters.projects,
        selected: { projects: filters.projects, owners: filters.owners },
      }),
    [liveTasks, projects, owners, stages, filters.projects, filters.owners],
  );
  const showing = useMemo(
    () => tasksOnBoard(liveTasks, archivedTasks, filters, { stages }).length,
    [liveTasks, archivedTasks, filters, stages],
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
  // it is let go with the project, as the board does when its scope moves.
  const toggleProject = (id: FilterId) => () => {
    const next = toggleInList(filters.projects, id);
    setProjects(next);
    const offered = new Set(goalsInProjects(liveTasks, next).map((g) => g.id));
    const kept = filters.goals.filter((g) => offered.has(g));
    if (kept.length !== filters.goals.length) update({ goals: kept });
  };

  const chooseDue = (mode: DueMode) => () => {
    // A date mode needs a date: start from today until one is picked.
    const dueDate =
      mode !== DUE_MODE.ANY && !endOfDueDay(filters.dueDate)
        ? format(new Date(), 'yyyy-MM-dd')
        : filters.dueDate;
    update({ due: mode, dueDate });
  };

  const dueEnd = endOfDueDay(filters.dueDate);
  const namesOf = <T,>(list: { id: T; label: string }[], chosen: T[]) =>
    list.filter((o) => chosen.includes(o.id)).map((o) => o.label);
  const dueSummary =
    filters.due === DUE_MODE.ANY || !dueEnd
      ? []
      : [
          `${filters.due === DUE_MODE.ARCHIVED ? 'Archived' : 'Not done'}, ${format(dueEnd, 'MMM d')}`,
        ];

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
        <div className="mx-auto w-full max-w-6xl px-3 pb-8 pt-4 lg:px-8 lg:pt-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight text-foreground lg:text-2xl">
                Choose what the board shows
              </h1>
              <p className="mt-1 text-xs text-muted-foreground lg:mt-2 lg:text-sm">
                Pick any mix below. Nothing selected in a row means the row doesn&rsquo;t filter.
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

          <div className="mt-4 space-y-3 lg:mt-8 lg:space-y-0 lg:border-b lg:border-border-subtle">
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
              label="Due by"
              testId="due"
              summary={dueSummary}
              open={openRows.has('due')}
              onToggle={toggleRow('due')}
            >
              {DUE_CHOICES.map((choice) => (
                <FilterOption
                  key={choice.mode}
                  type="radio"
                  name="landing-due"
                  label={choice.label}
                  checked={filters.due === choice.mode}
                  onChange={chooseDue(choice.mode)}
                  testId={`due-${choice.mode}`}
                />
              ))}
              <div className="px-4 pb-2 pt-1 lg:p-0">
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={filters.due === DUE_MODE.ANY}
                      aria-label={
                        dueEnd ? `Due by ${format(dueEnd, 'MMM d, yyyy')}` : 'Pick a due-by date'
                      }
                      className={cn(
                        'h-11 w-full justify-start gap-2 rounded-md font-normal lg:w-52',
                        !dueEnd && 'text-muted-foreground',
                      )}
                      data-testid="button-due-date"
                    >
                      <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                      {dueEnd ? format(dueEnd, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueEnd ?? undefined}
                      onSelect={(date: Date | undefined) => {
                        if (date) update({ dueDate: format(date, 'yyyy-MM-dd') });
                        setDueDateOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
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

            <FilterRow
              label="New tasks"
              testId="new"
              summary={filters.onlyNew ? ['Only new'] : []}
              open={openRows.has('new')}
              onToggle={toggleRow('new')}
              hint="Emailed in and not yet opened."
            >
              <FilterOption
                label="Only new"
                checked={filters.onlyNew}
                onChange={() => {
                  update({ onlyNew: !filters.onlyNew });
                }}
                badge={
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                      options.newCount > 0
                        ? 'bg-warning text-warning-foreground'
                        : 'bg-secondary text-muted-foreground',
                    )}
                    aria-label={`${options.newCount} new`}
                    data-testid="new-count"
                  >
                    {options.newCount}
                  </span>
                }
                testId="new"
              />
            </FilterRow>
          </div>

          <p
            role="status"
            className="mt-6 text-sm text-muted-foreground lg:mt-10"
            data-testid="landing-showing"
          >
            Showing <strong className="font-semibold text-foreground">{showing}</strong> of{' '}
            {options.total} tasks with these filters
            {filters.due === DUE_MODE.ARCHIVED && dueEnd ? ', from the archive' : ''}
          </p>
        </div>
      </main>

      <LandingBottomNav showing={showing} />
    </div>
  );
}
