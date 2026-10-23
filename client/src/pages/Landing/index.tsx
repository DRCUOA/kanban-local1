import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Check, Inbox, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import type { Task } from '@shared/schema';
import { DEFAULT_PROJECT_COLOR, ROUTES, TASK_TYPE } from '@shared/constants';
import { useTasks } from '@/hooks/use-tasks';
import { useStages } from '@/hooks/use-stages';
import { useProjectScope } from '@/hooks/use-project-scope';
import {
  useBoardFilters,
  usePruneChosenGoals,
  usePruneChosenTasks,
} from '@/hooks/use-board-filters';
import {
  FILTER_NONE,
  goalsOnOffer,
  tasksOnBoard,
  tasksOnOffer,
  toggleInList,
  type FilterId,
} from '@/lib/board-filters';
import { inboxTasks } from '@/lib/inbox';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { TaskHistoryModal } from '@/components/TaskHistoryModal';
import { DotGlyph, EffortDot, IslandGlyph, PinGlyph, ProjectIsland } from './glyphs';
import { LandingHeader } from './LandingChrome';
import { LandingInbox } from './LandingInbox';
import { NextList } from './NextList';
import { StageRoute } from './StageRoute';
import { Badge, Stone, StoneStrip } from './StoneStrip';
import { WizardNav } from './WizardNav';
import { STAGE_NAME, WIZARD_STAGES, wizardOptions, type WizardStage } from './wizard-options';

/** One or two names in full; past that the first and how many more. */
function nameList(names: string[]): string {
  if (names.length <= 2) return names.join(', ');
  return `${names[0]} +${names.length - 1}`;
}

/**
 * Picks everything at a stage: pressed while nothing there is picked, since
 * a stage with nothing picked lets everything through.
 */
function AllToggle({
  stage,
  pressed,
  onPress,
}: {
  stage: WizardStage;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={cn(
        'flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-[color,background-color,border-color,transform] active:scale-95',
        pressed
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border-strong text-fg-secondary hover:border-foreground/40 hover:text-foreground',
      )}
      data-testid={`wizard-all-${stage}`}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border',
          pressed
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border-strong bg-background',
        )}
        aria-hidden
      >
        {pressed && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
      </span>
      All {STAGE_NAME[stage].toLowerCase()}
    </button>
  );
}

/**
 * The landing page: a three-stage wizard that chooses what the board shows.
 * Projects first, then the goals inside them, then the tasks under those;
 * each stage lays its choices out as stones along a route, and GO moves on,
 * offering only what the stages before it left. The last GO opens the board.
 *
 * A pick applies at once (the choice is the board's, kept with its project
 * scope), so the count at the foot is always what the board will open with.
 * A stage with nothing picked lets everything through, which is what its
 * "All" button says. This is the only place the board is filtered. The inbox
 * of mail-made tasks waits behind the button in the header.
 */
export default function Landing() {
  // The whole board, whatever the header is scoped to: the counts and the
  // stones are about everything there is to choose from.
  const { data: taskData, isLoading, error } = useTasks('all');
  const liveTasks = useMemo(() => taskData ?? [], [taskData]);
  const { data: stages = [] } = useStages();
  const { projects, projectById } = useProjectScope();
  const { filters, setProjects, update } = useBoardFilters();
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<WizardStage>('projects');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [inboxOpen, setInboxOpen] = useState(false);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStage = useRef(stage);

  const inbox = useMemo(() => inboxTasks(liveTasks), [liveTasks]);

  // A chosen goal or task archived since (from Admin, say) leaves its stage,
  // so it has to stop filtering too: nothing would be left to untick it.
  const offeredGoals = useMemo(
    () => (taskData ? goalsOnOffer(taskData, stages, filters.projects, filters.goals) : undefined),
    [taskData, stages, filters.projects, filters.goals],
  );
  usePruneChosenGoals(offeredGoals);
  const offeredTasks = useMemo(
    () =>
      taskData
        ? tasksOnOffer(taskData, stages, filters.projects, filters.goals, filters.tasks)
        : undefined,
    [taskData, stages, filters.projects, filters.goals, filters.tasks],
  );
  usePruneChosenTasks(offeredTasks);

  // The owner and stage rows went with the old filter view. One left in
  // storage would narrow the board from somewhere nobody can reach, so it is
  // let go here.
  useEffect(() => {
    if (filters.owners.length > 0 || filters.stages.length > 0) update({ owners: [], stages: [] });
  }, [filters.owners.length, filters.stages.length, update]);

  const options = useMemo(
    () => wizardOptions({ tasks: liveTasks, stages, projects, filters }),
    [liveTasks, stages, projects, filters],
  );
  const onBoard = useMemo(
    () => tasksOnBoard(liveTasks, filters, stages),
    [liveTasks, filters, stages],
  );

  // On a new stage its heading takes focus, so reading starts there.
  useEffect(() => {
    if (shownStage.current === stage) return;
    shownStage.current = stage;
    headingRef.current?.focus();
  }, [stage]);

  const goTo = (target: WizardStage) => {
    setDirection(WIZARD_STAGES.indexOf(target) > WIZARD_STAGES.indexOf(stage) ? 'forward' : 'back');
    setStage(target);
  };

  const projectColor = (id: number | null) =>
    (id == null ? null : projectById(id)?.color) ?? DEFAULT_PROJECT_COLOR;
  const projectName = (id: FilterId | null) =>
    id == null || id === FILTER_NONE ? 'No project' : (projectById(id)?.name ?? 'Unknown project');
  const titleOf = (id: number | null) =>
    id == null ? null : (liveTasks.find((t) => t.id === id)?.title ?? null);
  const showProjects = projects.length > 0;

  // A goal or task outside what is now chosen would leave the board empty,
  // so it is let go with the choice that held it.
  const letGoOutside = (projectSel: FilterId[], goalSel: number[]) => {
    const goalsLeft = new Set(
      goalsOnOffer(liveTasks, stages, projectSel, goalSel).map((g) => g.id),
    );
    const goals = goalSel.filter((id) => goalsLeft.has(id));
    const tasksLeft = new Set(
      tasksOnOffer(liveTasks, stages, projectSel, goals, filters.tasks).map((t) => t.id),
    );
    const tasks = filters.tasks.filter((id) => tasksLeft.has(id));
    if (goals.length !== filters.goals.length || tasks.length !== filters.tasks.length) {
      update({ goals, tasks });
    }
  };

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

  const picked = (n: number) => (n === 0 ? 'All' : `${n} picked`);
  const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
  // In the order the stones lie, not the order they were picked.
  const pickedProjects = options.projects
    .filter((p) => filters.projects.includes(p.id))
    .map((p) => p.name);
  const pickedGoals = filters.goals.map((id) => titleOf(id) ?? 'Unknown goal');
  const smallGlyph = 'h-3.5 w-3.5';

  const stageView: Record<
    WizardStage,
    {
      heading: string;
      /** What the stage's things are, in a plain line, so a project and a goal never read alike. */
      hint: string;
      sub: string;
      pressed: boolean;
      onAll: () => void;
      stones: ReactElement[];
      /** Said in place of the strip when a stage has nothing to offer. */
      empty: string;
      /** Under the strip: what GO leads to. */
      next: ReactElement;
    }
  > = {
    projects: {
      heading: 'Pick projects',
      hint: 'A body of work, like a client or a job',
      sub: [
        filters.projects.length ? `${filters.projects.length} picked` : null,
        count(options.goals.length, 'goal'),
        count(options.tasks.length, 'task'),
      ]
        .filter(Boolean)
        .join(' · '),
      pressed: filters.projects.length === 0,
      onAll: () => {
        setProjects([]);
      },
      stones: options.projects.map((p, i) => (
        <Stone
          key={p.id}
          index={i}
          selected={filters.projects.includes(p.id)}
          onToggle={() => {
            const next = toggleInList(filters.projects, p.id);
            setProjects(next);
            letGoOutside(next, filters.goals);
          }}
          mark={
            <ProjectIsland
              id={p.id === FILTER_NONE ? null : p.id}
              name={p.name}
              projectKey={p.key}
              color={p.color}
            />
          }
          badges={
            <>
              <Badge glyph={<PinGlyph className={smallGlyph} />} count={p.goals} />
              <Badge glyph={<DotGlyph className={smallGlyph} />} count={p.tasks} />
            </>
          }
          title={p.name}
          description={`${count(p.goals, 'open goal')}, ${count(p.tasks, 'open task')}`}
          testId={`project-${p.id}`}
        />
      )),
      empty: 'No projects yet, and no open work outside one. Admin is where projects are made.',
      next: (
        <NextList
          title="Goals you'll see next"
          count={String(options.goals.length)}
          testId="next-goals"
          empty="No open goals in these projects. GO still moves on: Tasks offers every task in them."
          rows={options.goals.map((g) => ({
            key: g.id,
            glyph: <PinGlyph className="h-5 w-5" color={projectColor(g.projectId)} />,
            title: g.title,
            meta: showProjects ? projectName(g.projectId) : undefined,
            trailing: (
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-fg-secondary">
                <DotGlyph className="h-3 w-3" />
                <span className="sr-only">Open tasks:</span>
                {g.tasks}
              </span>
            ),
          }))}
        />
      ),
    },
    goals: {
      heading: 'Pick goals',
      hint: pickedProjects.length
        ? 'Outcomes in the projects you picked, with the tasks that lead to them'
        : 'An outcome, with the tasks that lead to it',
      sub: [
        `In ${pickedProjects.length ? nameList(pickedProjects) : 'every project'}`,
        filters.goals.length ? `${filters.goals.length} picked` : null,
        count(options.tasks.length, 'task'),
      ]
        .filter(Boolean)
        .join(' · '),
      pressed: filters.goals.length === 0,
      onAll: () => {
        update({ goals: [] });
      },
      stones: options.goals.map((g, i) => (
        <Stone
          key={g.id}
          index={i}
          selected={filters.goals.includes(g.id)}
          onToggle={() => {
            const goals = toggleInList(filters.goals, g.id);
            const left = new Set(
              tasksOnOffer(liveTasks, stages, filters.projects, goals, filters.tasks).map(
                (t) => t.id,
              ),
            );
            update({ goals, tasks: filters.tasks.filter((id) => left.has(id)) });
          }}
          mark={<PinGlyph className="h-12 w-12" color={projectColor(g.projectId)} />}
          badges={<Badge glyph={<DotGlyph className={smallGlyph} />} count={g.tasks} />}
          title={g.title}
          meta={showProjects ? projectName(g.projectId) : undefined}
          description={count(g.tasks, 'open task')}
          testId={`goal-${g.id}`}
        />
      )),
      empty: 'No open goals here. GO on to Tasks to pick from every task in these projects.',
      next: (
        <NextList
          title="Tasks you'll see next"
          count={String(options.tasks.length)}
          testId="next-tasks"
          empty="Nothing open under these goals."
          rows={options.tasks.map((t) => ({
            key: t.id,
            glyph: <DotGlyph className="h-4 w-4" color={projectColor(t.projectId)} />,
            title: t.title,
            meta: [showProjects ? projectName(t.projectId) : null, titleOf(t.goalId)]
              .filter(Boolean)
              .join(' · '),
          }))}
        />
      ),
    },
    tasks: {
      heading: 'Pick tasks',
      hint: 'The work itself, each one a card on the board',
      sub: [
        pickedGoals.length
          ? `Under ${nameList(pickedGoals)}`
          : pickedProjects.length
            ? `In ${nameList(pickedProjects)}`
            : 'Every open task',
        filters.tasks.length
          ? `${filters.tasks.length} of ${options.tasks.length} picked`
          : `All ${options.tasks.length}`,
      ].join(' · '),
      pressed: filters.tasks.length === 0,
      onAll: () => {
        update({ tasks: [] });
      },
      stones: options.tasks.map((t, i) => (
        <Stone
          key={t.id}
          index={i}
          selected={filters.tasks.includes(t.id)}
          onToggle={() => {
            update({ tasks: toggleInList(filters.tasks, t.id) });
          }}
          mark={<EffortDot effort={t.effort} color={projectColor(t.projectId)} />}
          title={t.title}
          meta={titleOf(t.goalId) ?? (showProjects ? projectName(t.projectId) : undefined)}
          testId={`task-${t.id}`}
        />
      )),
      empty: 'Nothing open here. Pick wider at Projects or Goals.',
      next: (
        <>
          <NextList
            title="GO opens the board with"
            count={count(onBoard.length, 'task')}
            testId="next-board"
            empty="Nothing: these picks leave the board empty."
            rows={onBoard.map((t) => ({
              key: t.id,
              glyph:
                t.type === TASK_TYPE.GOAL ? (
                  <PinGlyph className="h-5 w-5" color={projectColor(t.projectId)} />
                ) : (
                  <DotGlyph className="h-4 w-4" color={projectColor(t.projectId)} />
                ),
              title: t.title,
              meta: [showProjects ? projectName(t.projectId) : null, titleOf(t.goalTaskId)]
                .filter(Boolean)
                .join(' · '),
            }))}
          />
          <section aria-label="Carried in" className="mt-6" data-testid="carried-in">
            <h2 className="label-caps border-b border-border-strong/70 pb-1.5">Carried in</h2>
            <dl className="divide-y divide-border-subtle text-sm">
              {(
                [
                  ['projects', <IslandGlyph key="i" className="h-4 w-4" />, pickedProjects],
                  ['goals', <PinGlyph key="p" className="h-4 w-4" />, pickedGoals],
                  [
                    'tasks',
                    <DotGlyph key="d" className="h-4 w-4" />,
                    filters.tasks.length ? [`${filters.tasks.length} picked`] : [],
                  ],
                ] as const
              ).map(([s, glyph, names]) => (
                <div key={s} className="flex min-h-[2.5rem] items-center gap-3 py-1.5">
                  <span className="flex w-6 shrink-0 justify-center text-fg-secondary">
                    {glyph}
                  </span>
                  <dt className="w-16 shrink-0 font-semibold text-foreground">{STAGE_NAME[s]}</dt>
                  <dd className="min-w-0 truncate text-fg-secondary">
                    {names.length ? names.join(', ') : 'All'}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      ),
    },
  };

  const view = stageView[stage];

  return (
    // The board's shell: header and nav in the flow, the page scrolling
    // between them.
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <LandingHeader
        total={liveTasks.length}
        inbox={
          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-md text-fg-secondary transition-colors hover:text-foreground"
            aria-label={`Inbox, ${count(inbox.length, 'new task')}`}
            aria-haspopup="dialog"
            onClick={() => {
              setInboxOpen(true);
            }}
            data-testid="button-inbox"
          >
            <Inbox className="h-5 w-5" aria-hidden />
            {inbox.length > 0 && (
              <span
                className="absolute right-0.5 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-warning-foreground"
                aria-hidden
                data-testid="inbox-badge"
              >
                {inbox.length}
              </span>
            )}
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto" data-testid="landing-main">
        <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-4 lg:pt-8">
          <StageRoute
            stage={stage}
            picked={{
              projects: picked(filters.projects.length),
              goals: picked(filters.goals.length),
              tasks: picked(filters.tasks.length),
            }}
          />

          <div
            key={stage}
            className={cn(
              'duration-300 animate-in fade-in',
              direction === 'forward' ? 'slide-in-from-right-6' : 'slide-in-from-left-6',
            )}
            data-testid={`wizard-stage-${stage}`}
          >
            <div className="mt-5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-lg font-semibold leading-tight text-foreground focus:outline-none lg:text-2xl"
                >
                  {view.heading}
                </h1>
                <p className="mt-1 text-sm text-fg-secondary" data-testid={`wizard-hint-${stage}`}>
                  {view.hint}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground lg:text-sm">
                  {view.sub}
                </p>
              </div>
              <AllToggle stage={stage} pressed={view.pressed} onPress={view.onAll} />
            </div>

            {view.stones.length > 0 ? (
              <StoneStrip label={STAGE_NAME[stage]} description={view.hint} className="mt-4">
                {view.stones}
              </StoneStrip>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-border-strong px-4 py-6 text-sm text-muted-foreground">
                {view.empty}
              </p>
            )}

            <div className="mt-4">{view.next}</div>
          </div>

          <p
            role="status"
            className="mt-6 text-sm text-muted-foreground"
            data-testid="landing-showing"
          >
            Showing <strong className="font-semibold text-foreground">{onBoard.length}</strong> of{' '}
            {liveTasks.length} tasks with these picks
          </p>
        </div>
      </main>

      <WizardNav
        stage={stage}
        showing={onBoard.length}
        onStage={goTo}
        onBoard={() => {
          navigate(ROUTES.DASHBOARD);
        }}
      />

      <Dialog open={inboxOpen} onOpenChange={setInboxOpen}>
        <DialogContent className="max-h-[85dvh] gap-0 overflow-y-auto p-0">
          <DialogTitle className="sr-only">Inbox</DialogTitle>
          <DialogDescription className="sr-only">
            Tasks emailed in and not yet opened. A row opens its task.
          </DialogDescription>
          <LandingInbox
            className="rounded-none border-0 [&>div:first-child]:pr-14"
            tasks={inbox}
            onOpen={(task) => {
              setInboxOpen(false);
              setOpenTask(task);
              setIsEditOpen(true);
            }}
          />
        </DialogContent>
      </Dialog>

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
