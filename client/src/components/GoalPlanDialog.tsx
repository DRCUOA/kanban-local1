import { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { EFFORT_MAX, EFFORT_MIN } from '@shared/constants';
import {
  contactsToMarkdown,
  type ApplyGoalPlan,
  type GoalPlanContact,
  type GoalPlanOptions,
  type GoalPlanSuggestion,
} from '@shared/goal-plan';
import { blocksOfGoal } from '@shared/goal-view';
import type { Task } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTasks } from '@/hooks/use-tasks';
import { useApplyGoalPlan, useSuggestGoalPlan } from '@/hooks/use-goal-plan';
import { cn } from '@/lib/utils';

interface Row {
  key: string;
  title: string;
  description: string;
  effort: number;
  /** Keys of other rows, or "#id" of existing building-blocks. */
  dependsOn: string[];
  selected: boolean;
  /** Who and where, from web search; saved into the description. */
  contacts: GoalPlanContact[];
  /** Set once saved: the new task's id. */
  savedId?: number;
}

interface GoalDraft {
  title: string;
  description: string;
  apply: boolean;
  applied: boolean;
}

const toRows = (plan: GoalPlanSuggestion): Row[] =>
  plan.subtasks.map((s) => ({ ...s, selected: true }));

/**
 * The AI's suggested building-blocks for a goal, all editable before anything
 * is stored: title, description, effort and what each waits for. Save one row,
 * the ticked rows, or all of them; each save is one transaction, and saved
 * rows become real building-blocks that later rows can still wait for. The
 * suggested goal wording is applied only if ticked.
 */
export function GoalPlanDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const suggest = useSuggestGoalPlan();
  const apply = useApplyGoalPlan();
  const { data: tasks = [] } = useTasks();
  const [rows, setRows] = useState<Row[]>([]);
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);

  const [options, setOptions] = useState<GoalPlanOptions>({ how: false, whoWhere: false });

  const run = () => {
    setRows([]);
    setGoalDraft(null);
    suggest.mutate(
      { goalId: goal.id, options },
      {
        onSuccess: (plan) => {
          setRows(toRows(plan));
          setGoalDraft({ ...plan.goal, apply: false, applied: false });
        },
      },
    );
  };

  // Each opening starts clean: nothing is asked until "Plan this goal".
  useEffect(() => {
    if (!open) return;
    setRows([]);
    setGoalDraft(null);
    setOptions({ how: false, whoWhere: false });
    suggest.reset();
  }, [open, goal.id]);

  const patch = (key: string, change: Partial<Row>) => {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...change } : r)));
  };

  const label = (dep: string): string => {
    if (dep.startsWith('#')) {
      const t = tasks.find((x) => `#${x.id}` === dep);
      return t ? `${dep} ${t.title}` : dep;
    }
    const i = rows.findIndex((r) => r.key === dep);
    const r = rows[i];
    return r ? `${i + 1}. ${r.title}` : dep;
  };

  /** Saves `keys` (unsaved rows only), plus the goal wording if ticked and not yet applied. */
  const save = (keys: string[]) => {
    const chosen = rows.filter((r) => keys.includes(r.key) && r.savedId === undefined);
    const chosenKeys = new Set(chosen.map((r) => r.key));
    const savedIdOf = new Map(
      rows.filter((r) => r.savedId !== undefined).map((r) => [r.key, r.savedId]),
    );
    let dropped = 0;
    const plan: ApplyGoalPlan = {
      goal:
        goalDraft?.apply && !goalDraft.applied && goalDraft.title.trim()
          ? { title: goalDraft.title.trim(), description: goalDraft.description }
          : undefined,
      subtasks: chosen.map((r) => ({
        key: r.key,
        title: r.title.trim(),
        // Contacts found by web search travel in the description, as Markdown.
        description: [r.description.trim(), contactsToMarkdown(r.contacts)]
          .filter(Boolean)
          .join('\n\n'),
        effort: r.effort,
        // A dependency on a row saved earlier becomes a link to that task; one
        // on a row that is not being saved now cannot be kept.
        dependsOn: r.dependsOn.flatMap((d) => {
          if (d.startsWith('#') || chosenKeys.has(d)) return [d];
          const id = savedIdOf.get(d);
          if (id !== undefined) return [`#${id}`];
          dropped += 1;
          return [];
        }),
      })),
    };
    if (plan.subtasks.some((s) => s.title === '')) {
      toast({ description: 'Every sub-task being saved needs a title.', variant: 'destructive' });
      return;
    }
    if (plan.subtasks.length === 0 && !plan.goal) {
      toast({ description: 'Nothing new to save.' });
      return;
    }
    apply.mutate(
      { goalId: goal.id, plan },
      {
        onSuccess: ({ created }) => {
          setRows((current) =>
            current.map((r) => (created[r.key] ? { ...r, savedId: created[r.key] } : r)),
          );
          if (plan.goal) setGoalDraft((g) => (g ? { ...g, applied: true } : g));
          const n = Object.keys(created).length;
          toast({
            title: n > 0 ? `Saved ${n} building-block${n === 1 ? '' : 's'}` : 'Goal updated',
            description:
              dropped > 0
                ? `${dropped} dependenc${dropped === 1 ? 'y was' : 'ies were'} left out because the task waited for is not saved yet.`
                : undefined,
          });
        },
        onError: (error) => {
          toast({ title: 'Not saved', description: error.message, variant: 'destructive' });
        },
      },
    );
  };

  // Blocks that existed before this plan. Rows saved from it are offered by
  // their row number instead, so the same task never appears twice.
  const savedHere = new Set(rows.map((r) => r.savedId));
  const existing = blocksOfGoal(tasks, goal.id).filter((t) => !savedHere.has(t.id));
  const unsaved = rows.filter((r) => r.savedId === undefined);
  const selectedKeys = unsaved.filter((r) => r.selected).map((r) => r.key);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-full max-h-full max-w-full flex-col rounded-none sm:h-[90vh] sm:max-w-3xl sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Make this a goal
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose how the AI should help, then plan “{goal.title}”. Edit anything, untick what you
            do not want, then save. Nothing is stored until you save.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1" data-testid="goal-plan-body">
          <section
            className="space-y-3 rounded-md border bg-muted/30 p-3"
            aria-label="How the AI should help"
            data-testid="goal-plan-options"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <OptionBox
                checked={options.how}
                disabled={suggest.isPending}
                onChange={(how) => {
                  setOptions((o) => ({ ...o, how }));
                }}
                title="Help me on the how"
                detail="Plain explanations and a direct, step-by-step breakdown (boil the water, get a cup from the cupboard…)."
                testId="goal-plan-option-how"
              />
              <OptionBox
                checked={options.whoWhere}
                disabled={suggest.isPending}
                onChange={(whoWhere) => {
                  setOptions((o) => ({ ...o, whoWhere }));
                }}
                title="Help me on the who and where"
                detail="Searches the web for the right organisations, with phone numbers, emails, links and addresses."
                testId="goal-plan-option-who-where"
              />
            </div>
            <Button
              type="button"
              onClick={run}
              disabled={suggest.isPending || apply.isPending}
              className="w-full sm:w-auto"
              data-testid="goal-plan-run"
            >
              {suggest.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : rows.length > 0 ? (
                <RefreshCw className="mr-2 h-4 w-4" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {suggest.isPending ? 'Planning…' : rows.length > 0 ? 'Plan again' : 'Plan this goal'}
            </Button>
          </section>

          {suggest.isPending && (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              {options.whoWhere
                ? 'Searching the web for contacts and planning this goal. This can take a minute or two.'
                : 'Asking the AI to plan this goal…'}
            </div>
          )}

          {suggest.isError && (
            <p className="py-6 text-center text-sm text-danger" data-testid="goal-plan-error">
              {suggest.error.message}
            </p>
          )}

          {goalDraft && (
            <section className="space-y-2 rounded-md border p-3" data-testid="goal-plan-goal">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={goalDraft.apply || goalDraft.applied}
                  disabled={goalDraft.applied}
                  onChange={(e) => {
                    setGoalDraft({ ...goalDraft, apply: e.target.checked });
                  }}
                />
                {goalDraft.applied ? 'Goal wording applied' : 'Also apply this wording to the goal'}
              </label>
              <Input
                aria-label="Suggested goal title"
                value={goalDraft.title}
                disabled={goalDraft.applied}
                onChange={(e) => {
                  setGoalDraft({ ...goalDraft, title: e.target.value });
                }}
              />
              <Textarea
                aria-label="Suggested goal description"
                rows={3}
                value={goalDraft.description}
                disabled={goalDraft.applied}
                onChange={(e) => {
                  setGoalDraft({ ...goalDraft, description: e.target.value });
                }}
              />
              {goalDraft.apply && !goalDraft.applied && (
                <p className="text-[10px] text-muted-foreground">
                  Replaces the goal’s current title and description when you next save.
                </p>
              )}
            </section>
          )}

          {rows.length > 0 && (
            <ol className="space-y-3" data-testid="goal-plan-rows">
              {rows.map((row, i) => {
                const saved = row.savedId !== undefined;
                const earlier = rows.slice(0, i);
                return (
                  <li
                    key={row.key}
                    className={cn('space-y-2 rounded-md border p-3', saved && 'opacity-70')}
                    data-testid={`goal-plan-row-${i + 1}`}
                  >
                    <div className="flex items-center gap-2">
                      {saved ? (
                        <Check className="h-4 w-4 text-success" aria-label="Saved" />
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`Include ${row.title}`}
                          checked={row.selected}
                          onChange={(e) => {
                            patch(row.key, { selected: e.target.checked });
                          }}
                        />
                      )}
                      <span className="w-5 text-right font-mono text-xs text-muted-foreground">
                        {i + 1}.
                      </span>
                      <Input
                        aria-label={`Sub-task ${i + 1} title`}
                        value={row.title}
                        disabled={saved}
                        onChange={(e) => {
                          patch(row.key, { title: e.target.value });
                        }}
                        className="h-9 flex-1"
                      />
                      {saved ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          #{row.savedId}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 shrink-0 px-3 text-xs"
                          disabled={apply.isPending}
                          onClick={() => {
                            save([row.key]);
                          }}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                    <Textarea
                      aria-label={`Sub-task ${i + 1} description`}
                      rows={2}
                      value={row.description}
                      disabled={saved}
                      onChange={(e) => {
                        patch(row.key, { description: e.target.value });
                      }}
                      className="text-sm"
                    />
                    {row.contacts.length > 0 && (
                      <ContactList
                        contacts={row.contacts}
                        disabled={saved}
                        onRemove={(k) => {
                          patch(row.key, { contacts: row.contacts.filter((_, n) => n !== k) });
                        }}
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                      <label className="flex items-center gap-1.5">
                        Effort
                        <select
                          value={row.effort}
                          disabled={saved}
                          onChange={(e) => {
                            patch(row.key, { effort: Number(e.target.value) });
                          }}
                          className="h-7 rounded border bg-background px-1"
                        >
                          {Array.from(
                            { length: EFFORT_MAX - EFFORT_MIN + 1 },
                            (_, k) => k + EFFORT_MIN,
                          ).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <span className="text-muted-foreground">≈ days</span>
                      </label>
                      {(earlier.length > 0 || existing.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-muted-foreground">Waits for:</span>
                          {[...existing.map((t) => `#${t.id}`), ...earlier.map((r) => r.key)].map(
                            (dep) => {
                              const on = row.dependsOn.includes(dep);
                              const text = dep.startsWith('#')
                                ? dep
                                : String(rows.findIndex((r) => r.key === dep) + 1);
                              return (
                                <button
                                  key={dep}
                                  type="button"
                                  disabled={saved}
                                  aria-pressed={on}
                                  title={label(dep)}
                                  onClick={() => {
                                    patch(row.key, {
                                      dependsOn: on
                                        ? row.dependsOn.filter((d) => d !== dep)
                                        : [...row.dependsOn, dep],
                                    });
                                  }}
                                  className={cn(
                                    'min-w-7 rounded-full border px-2 py-0.5',
                                    on
                                      ? 'border-primary bg-primary/15 font-semibold'
                                      : 'text-muted-foreground',
                                  )}
                                >
                                  {text}
                                </button>
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            disabled={apply.isPending || selectedKeys.length === 0}
            onClick={() => {
              save(selectedKeys);
            }}
            data-testid="goal-plan-save-selected"
          >
            Save ticked ({selectedKeys.length})
          </Button>
          <Button
            type="button"
            disabled={apply.isPending || (unsaved.length === 0 && !goalDraft?.apply)}
            onClick={() => {
              save(unsaved.map((r) => r.key));
            }}
            data-testid="goal-plan-save-all"
          >
            {apply.isPending ? 'Saving…' : `Save all (${unsaved.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OptionBox({
  checked,
  disabled,
  onChange,
  title,
  detail,
  testId,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  title: string;
  detail: string;
  testId: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md border bg-background p-3 text-sm',
        checked && 'border-primary bg-primary/5',
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        data-testid={testId}
      />
      <span>
        <span className="font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

/** Who and where for one suggestion: found by web search, so each shows its source. */
function ContactList({
  contacts,
  disabled,
  onRemove,
}: {
  contacts: GoalPlanContact[];
  disabled: boolean;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-md bg-muted/40 p-2.5" data-testid="goal-plan-contacts">
      <p className="text-xs font-medium">
        Who and where{' '}
        <span className="font-normal text-muted-foreground">(check before relying on it)</span>
      </p>
      <ul className="space-y-1.5">
        {contacts.map((c, k) => (
          <li key={`${c.name}-${k}`} className="flex items-start gap-2 text-xs">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{c.name}</span>
              {c.purpose && <span className="text-muted-foreground">: {c.purpose}</span>}
              <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {c.phone && (
                  <a className="underline" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>
                    {c.phone}
                  </a>
                )}
                {c.email && (
                  <a className="underline" href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                )}
                {c.website && (
                  <a
                    className="underline"
                    href={c.website}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Website
                  </a>
                )}
                {c.address && <span>{c.address}</span>}
                {c.source && (
                  <a
                    className="text-muted-foreground underline"
                    href={c.source}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Source
                  </a>
                )}
              </span>
            </span>
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onRemove(k);
                }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
