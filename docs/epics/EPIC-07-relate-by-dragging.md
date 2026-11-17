# EPIC-07: Relate cards by dragging — goals on the board, merge, order

**Epic type:** Business feature
**Status:** Spec — decisions locked 7–8 Nov 2026, awaiting refinement
**Version:** v0.1 · 8 Nov 2026
**Owner:** Product (Rich)
**Target:** ≈ 29 pts, ten stories of a day or less, each shippable on its own
**Traceability prefix:** `REL`
**Replaces:** board task #393 "Improve Kanbando goal views" (close it as a duplicate of this epic)
**Source:** `request-drag-merge-and-link.md` (repo root), checked against the code twice, and the
owner's answers of 7–8 Nov 2026

**Locked decisions (7–8 Nov 2026, product owner).** Not up for re-litigation during refinement:
(1) the board merges cards of the same kind, task with task and goal with goal; (2) dropping a
task onto a goal on the board adds it to that goal in one drag; (3) creating predecessor and
successor links by dragging happens in the goal view, not on the board; (4) a merged-away card
goes to the Bin; (5) every goal card carries a goal mark, and while a goal is looked at its
building-blocks are highlighted; (6) goals are not ordered against each other; (7) goals on the
board ship first; (8) it must be quick to build: no schema change, existing APIs and components
reused, every story shippable alone.

---

## 1. Epic hypothesis statement

> **For** the owner working the board day to day,
> **who** today links each building-block to its goal by opening the card, setting its type,
> picking the goal and saving; tidies a duplicate by copying its text across by hand and binning
> it; cannot tell on the board which cards are goals or which cards belong to one; and orders a
> goal's work one task form at a time,
> **the** relate-by-dragging feature **is a** set of drag-and-drop actions on the board, the goal
> view and the project view
> **that** turns each of those jobs into one drag, with one confirm step for a merge.
> **Unlike** the task form, which does all of this one field at a time on one card at a time,
> **our solution** shows goal structure on the board and lets the drag itself say what relates to
> what.
>
> **We will know we are right when** linking a block to a goal is one drag (#393's done-when),
> merging a duplicate is one drag and one confirm, and a goal's blocks can be picked out on the
> board without opening anything.

## 2. Problem and evidence

All four problems are the owner's own observations (8 Nov 2026). No measurements exist.

| # | What happens today | Where it is in the code |
|---|---|---|
| E1 | **Duplicate cards.** The same job is captured twice, and tidying it is manual: copy the text across, re-enter its links, bin one. | No merge exists anywhere in the app. |
| E2 | **Linking to a goal is slow.** Each block: open the card, set Type to Building block, pick the goal, save. | `TaskTypeField.tsx:75`: the Goal picker appears only once the type is Building block. |
| E3 | **Goal structure is invisible on the board.** Nothing on a card says it is a goal, or which goal it belongs to. | `TaskCard.tsx` and `TaskCardSummary.tsx` never read `type` or `goalTaskId`. |
| E4 | **Ordering is clumsy.** The goal view shows the order but cannot change it: each change means opening a task's form and editing its Predecessors or Successors. | `GoalView.tsx` opens the task form (`:119–128`); `TaskDependenciesField.tsx`. |

Board task #393 records E2 and E3 and asks for one-drag linking.

## 3. Success measures

| # | Measure | Today | Target | How we'll see it |
|---|---|---|---|---|
| M1 | Actions to add a block to a goal | 4: open card, set Type, pick Goal, save | 1 drag | REL-S12 |
| M2 | Actions to merge a duplicate | Manual copy, re-link in the form, bin | 1 drag + 1 confirm | REL-S35 (form), REL-S43 (drag) |
| M3 | Goals recognisable on the board | None marked | Every goal marked | REL-S1 |
| M4 | Actions to order two of a goal's tasks | Open card, pick predecessor, save | 1 drag + 1 choice | REL-S27 |

Leading measures (quality gates): every scenario in §10 passes as an automated test; no migration
is added. Lagging measure: the owner's judgement after use. No metric was set for it.

## 4. Constraints and principles

- **P1 — Quick to build.** No schema change and no new dependency. Reuse the endpoints, rules and
  components listed in §6. Each story ships on its own and leaves the board working.
  *Why: the owner's instruction, 8 Nov 2026.*
- **P2 — The existing rules are the rules.** One goal per task; a link joins two tasks in the
  same project, no project counting as a project of its own; a goal in a project takes blocks
  only from that project, a goal with no project from any; no loops. These are already enforced
  in the database and the API (`ARCHITECTURE.md:316–340`). This epic adds no rule and relaxes none.
- **P3 — Refuse, never half-do.** A refused action changes nothing and says why, in words.
- **P4 — Every drag has another way in.** WCAG 2.1 AA is the floor (`docs/WAYS-OF-WORKING.md:71`),
  and accessibility requirements sit in this epic's acceptance criteria, not in a later pass
  (`docs/WAYS-OF-WORKING.md:81`).
- **P5 — A drop without a pause still moves the card.** Dropping onto a card without pausing keeps
  today's meaning: move into that card's lane (`use-kanban-drag-drop.ts`, `handleDragEnd`).

## 5. Scope

**In scope:** goal mark and block highlight on the board; dropping a task onto a goal on the
board, with Undo and an optional order step; a list of goal-less blocks in the project view that
can be dragged onto goals; before/after by drag in the goal view; merging two tasks or two goals,
from the task form and by drag on the board.

**Out of scope (explicitly):**

- **Ordering goals against each other.** The task form disables Predecessors and Successors for a
  goal on purpose: a goal's order comes from its blocks and their links
  (`TaskDependenciesField.tsx:195`).
- **Creating links by dragging on the board.** EPIC-05 §6 ruled this out, and this epic keeps to
  it. The order step after a drop uses pickers, not dragging.
- **Merging in the goal or project views.** Merges happen on the board and in the task form.
- **Merging across projects.** Links cannot cross projects, so the merged-away card's links would
  have nowhere to go.
- **An "update critical path" action, or a pending-update flag** on the Gantt chart and critical
  path (#393 item 4). The goal view works these out from current data each time it is shown and
  stores no plan (`ARCHITECTURE.md:350`), so there is nothing to update. Changes made in another
  tab, by the inbox or through the API appear after a reload, as everywhere on the board
  (`queryClient.ts:33–35`); live updates are a separate matter.
- **Linking to tasks outside the goal from the order step.** The task form does that, as today.
- **Grouping a column's cards into one lane per goal.**
- **Dragging several selected cards at once.**
- **Undoing a merge** beyond restoring the merged-away card from the Bin.
- **Hiding finished tasks in the goal view.**
- **Highlighting on a phone.** There is no resting pointer and no shift-click; the Goal filter
  stays the way to see one goal with its blocks.

## 6. Build notes (reuse map — guidance, not requirements)

| Need | Reuse or watch for | Where |
|---|---|---|
| A goal's blocks, and how many | `blocksOfGoal` | `shared/goal-view.ts:42` |
| Highlight after a pointer rest | The preview pane's hover-intent pattern, in its own state so it works in both layouts | `KanbanBoard.tsx:39, 213–215, 235–256` |
| Share highlight state with cards | A context like `TaskSelectionContext` | `task-selection-context.ts` |
| Rest-to-target while dragging | The Filing menu's rest timer | `use-kanban-drag-drop.ts` (`FILING_HOVER_OPEN_MS`, `handleDragOver`) |
| A rest on a card in the same column | Each column is one sortable list whose cards slide out from under the pointer, so a rest never settles. Order within a column is never saved (the board sorts by due date), so switch the sliding off | `KanbanColumnContent.tsx:49–53`; `KanbanBoard.tsx:142` |
| Add to goal, and its Undo | `PATCH /api/tasks/:id` with `type` and `goalTaskId`; `checkGoalLink` applies P2 | `server/routes.ts:413–489, :121` |
| Refusal wording | The server's messages, e.g. "A building-block must be in the same project as its goal", "Task 510 is not a goal" | `shared/task-goal.ts:42, 49` |
| Undo in a message | `ToastAction`. A message carries one action, only one message shows at a time, and it lasts 5 s (library default) | `ui/toast.tsx:55`; `use-toast.ts:6, 13` |
| Before/After pickers | Hide loop-closing choices with `reachable`, as the task form does. `DependencyPicker` is a task-form field, so wrap it in a small form or lift its list out | `shared/task-dependencies.ts` (`reachable`); `TaskDependenciesField.tsx:31–50, 199–215` |
| Writing links without losing others | A PATCH that sends a side replaces it: send existing + new | `ARCHITECTURE.md:342` |
| Loop message | `dependencySetError` → "These dependencies would create a loop" | `shared/task-dependencies.ts:114` |
| Drag in the goal and project views | `@dnd-kit/core`, already a dependency | — |
| Merge, all-or-nothing | One new endpoint running one `db.transaction`. `updateTask`, `binTask`, `setTaskDependencies` and `bindAttachments` use the shared connection, not a transaction, so the merge needs variants that take the transaction, as `insertTaskWithExecutor` does | `server/storage.ts:69–71, 332, 427, 511, 850` |
| B's files on A | Run A's new description through `prepareDescriptionAttachments` before the transaction; it copies B's files. Bind the copies to A inside the transaction. A copy left behind by a rollback is unreferenced, and the sweeper deletes it | `server/attachments.ts:37–65, 93, 128` |
| Moving links | Delete and re-insert the rows. The loop and same-project triggers fire only on INSERT | `migrations/0018:56–58`, `0020:29–31` |
| Merge note on the binned card | `binTask` always writes "Moved to Bin", so the merge writes its own history entry | `server/storage.ts:427–447`; `shared/schema.ts:138` |
| Child tasks | `parent_task_id` has no foreign key and nothing stops a task being its own parent | `migrations/0003:9` |

## 7. Data model

**No schema change.** A merge writes existing columns and tables only: `description`, `tags`,
`history` (through its `note`), `deleted_at`, `goal_task_id` and `parent_task_id` on `tasks`;
deleted and re-inserted rows of `task_dependencies`; and new rows of `task_attachments` (A's
copies of B's files).

## 8. Requirements

EARS syntax. "The board" means the system as a whole where no narrower actor is named.
"Live" means not archived and not in the Bin. "Same project" counts no project as a project of
its own. A goal "accepts" a task when the goal has no project or shares the task's project.

**Table 1 — what a rest-then-drop onto a card does**

| Dragged | Dropped onto | Result | Story |
|---|---|---|---|
| Task | Goal | Added to the goal | REL-03 |
| Goal | Task | Refused; the goal goes back | REL-03 |
| Task | Task | Merge, after a confirm step | REL-09 |
| Goal | Goal | Merge, after a confirm step | REL-10 |

A row takes effect when its story ships; until then that pair keeps today's lane move.

**REL-01 — Goal mark**

- **REL-R1** — The board shall show a goal mark on every goal card, in both card styles.
- **REL-R2** — While a goal has at least one live building-block, the board shall show the number
  of its live building-blocks in its goal mark.
- **REL-R3** — The goal mark's number shall equal the number of tasks the goal view shows for
  that goal.
- **REL-R4** — The goal mark shall carry a text alternative that names the card as a goal and gives
  its block count.

**REL-02 — Highlight a goal's blocks**

- **REL-R5** — When the pointer has rested on a goal card for 250 ms, the board shall highlight
  that goal's building-blocks.
- **REL-R6** — When a goal card receives keyboard focus, the board shall highlight that goal's
  building-blocks.
- **REL-R7** — While a goal card is the only selected card, the board shall highlight that goal's
  building-blocks.
- **REL-R8** — The board shall highlight one goal's building-blocks at a time: those of the goal
  most recently rested on, focused or selected.
- **REL-R9** — When a rest or focus on another goal card ends while a goal card is the only selected
  card, the board shall return to highlighting the selected goal's building-blocks.
- **REL-R10** — While a goal's building-blocks are highlighted, the board shall dim every card that
  is neither that goal nor one of its building-blocks.
- **REL-R11** — While no goal card is rested on, focused or the only selected card, the board shall
  show every card undimmed.
- **REL-R12** — While a card is being dragged, the board shall start no highlight.
- **REL-R13** — The board shall keep the text of dimmed cards at a contrast ratio of at least 4.5:1.

**REL-03 — Drop a task onto a goal**

- **REL-R14** — While the pair has a result in Table 1, when a dragged card has rested on another
  card for 350 ms, the board shall mark that card as the drop target.
- **REL-R15** — The board shall show the drop-target state by a change other than colour alone.
- **REL-R16** — While a card is being dragged, the board shall keep the other cards in its column
  in place.
- **REL-R17** — When a dragged card is released over a card not marked as the drop target, the
  board shall move the dragged card into that card's lane.
- **REL-R18** — When a task is released on a goal marked as the drop target, the board shall make
  the task one of that goal's building-blocks.
- **REL-R19** — When a task with no type is added to a goal, the board shall set the task's type to
  Building block.
- **REL-R20** — When a task has been added to a goal by a drop, the board shall show a message
  naming the goal.
- **REL-R21** — When a task moves from one goal to another by a drop, the board shall name the goal
  it left in that message.
- **REL-R22** — If a task is released on a goal it already belongs to, then the board shall leave
  the task unchanged.
- **REL-R23** — If a task is released on a goal that does not accept it, then the board shall
  refuse the add with a message that gives the reason.
- **REL-R24** — If a goal is released on a task marked as the drop target, then the board shall
  return the goal to the place the drag began.
- **REL-R25** — If a goal is released on a task marked as the drop target, then the board shall
  show a message saying a goal cannot be dropped onto a task.

**REL-04 — Undo, and place it in order**

The order step comes first, when there is one; the message of REL-R20 follows when it closes.

- **REL-R26** — When a task has been added to a goal that has another live task in the same project,
  the board shall offer an order step with a Before picker (tasks this task comes before) and an
  After picker (tasks this task comes after).
- **REL-R27** — The order step's pickers shall list only the goal's other live tasks in the task's
  project.
- **REL-R28** — The order step's pickers shall omit every task whose choice would close a loop.
- **REL-R29** — When the order step is confirmed, the board shall add the chosen links to the task's
  existing links.
- **REL-R30** — When the order step is skipped, the board shall leave the task's links unchanged.
- **REL-R31** — The order step shall offer Undo.
- **REL-R32** — The message of REL-R20 shall offer Undo for 5 seconds.
- **REL-R33** — When Undo is chosen, the board shall restore the task's previous goal and type.
- **REL-R34** — When Undo is chosen after the order step was confirmed, the board shall remove the
  links the order step added.
- **REL-R35** — If the task's previous goal no longer exists as a goal, then the board shall refuse
  the Undo with a message that gives the reason.

**REL-05 — Project view: add goal-less blocks to goals**

- **REL-R36** — The project view shall list the live building-blocks in its scope that have no goal.
- **REL-R37** — When a listed block is dropped on a goal card, the project view shall make it one
  of that goal's building-blocks.
- **REL-R38** — When a block has been added to a goal, the project view shall remove it from the
  list without a reload.
- **REL-R39** — If a listed block is dropped on a goal that does not accept it, then the project
  view shall refuse the drop with a message that gives the reason.
- **REL-R40** — When a listed block is activated without dragging, the project view shall open it
  in the task form.

**REL-06 — Goal view: before and after by drag**

- **REL-R41** — When one of the goal's tasks is dropped on another of its tasks, the goal view shall
  offer the choices Before this and After this.
- **REL-R42** — When Before this is chosen, the goal view shall record the dragged task as a
  predecessor of the target task.
- **REL-R43** — When After this is chosen, the goal view shall record the dragged task as a
  successor of the target task.
- **REL-R44** — The goal view shall keep every existing link of both tasks when it records a new one.
- **REL-R45** — When a link has been recorded, the goal view shall show the new order without a
  reload.
- **REL-R46** — If the new link would close a loop, then the goal view shall refuse it with the
  message "These dependencies would create a loop".
- **REL-R47** — If the link already exists, then the goal view shall refuse it with a message saying
  so.
- **REL-R48** — If the two tasks are in different projects, then the goal view shall refuse the
  link with a message that gives the reason.

**REL-07 — Merge two tasks from the task form: text, tags and files**

In REL-R51 to REL-R66, card B is merged into card A, and A is kept.

- **REL-R49** — The task form shall offer a Merge into… action on every saved task.
- **REL-R50** — The Merge into… picker shall list only live cards of the same kind in the same
  project.
- **REL-R51** — Before a merge, the board shall show a confirm step that lists what will move to A.
- **REL-R52** — When a merge is confirmed, the board shall append B's description to A's
  description under the heading "Merged from #B <B's title>".
- **REL-R53** — The appended section shall state B's due date, effort and owner where B has them.
- **REL-R54** — When a merge is confirmed, the board shall give A its own copy of every file that
  B's description links to.
- **REL-R55** — When a merge is confirmed, the board shall add B's tags to A, except lane tags.
- **REL-R56** — A merge shall change no field of A other than its description, tags and history.
- **REL-R57** — When a merge is confirmed, the board shall move B to the Bin.
- **REL-R58** — When a merge is confirmed, the board shall add the note "Merged into #A" to B's
  history.
- **REL-R59** — When a merge is confirmed, the board shall add the note "Merged #B into this" to
  A's history.
- **REL-R60** — If any write of a merge fails, then the board shall leave A and B as they were
  before the merge.
- **REL-R61** — When B is restored from the Bin, the board shall restore B without the links,
  child tasks and building-blocks that moved to A.
- **REL-R62** — If B has a predecessor, a successor or a child task, then the board shall refuse
  the merge with a message that names them. *Temporary: withdrawn when REL-08 ships.*

**REL-08 — Merge carries links and child tasks**

- **REL-R63** — When a merge is confirmed, the board shall move every predecessor and successor
  link of B to A, whatever the state of the linked task.
- **REL-R64** — When a merge is confirmed, the board shall drop every link between A and B.
- **REL-R65** — When a merge is confirmed, the board shall make A the parent of every task other
  than A whose parent is B.
- **REL-R66** — If moving B's links to A would close a loop, then the board shall refuse the merge
  with the message "These dependencies would create a loop".

**REL-09 — Drag to merge two tasks on the board**

- **REL-R67** — When a task is released on a task marked as the drop target, the board shall show
  the confirm step for merging the dragged task into the target.
- **REL-R68** — If a task is released on a task marked as the drop target in a different project,
  then the board shall refuse the merge with a message that gives the reason.
- **REL-R69** — When the confirm step is cancelled, the board shall return the dragged card to the
  place the drag began.

**REL-10 — Merge two goals**

- **REL-R70** — When goal B is merged into goal A, the board shall make every building-block of B a
  building-block of A, whatever the block's state.
- **REL-R71** — When a goal is released on a goal marked as the drop target, the board shall show
  the confirm step for merging the dragged goal into the target.
- **REL-R72** — The task form shall offer the Merge into… action on every saved goal.

## 9. Quality attributes

| Attribute | Requirement | Verified by |
|---|---|---|
| Accessibility — another way in | Add to goal: the form's Goal field. Order: the form's Predecessors and Successors. Merge: Merge into… (REL-R49, R72). Highlight: keyboard focus (REL-R6). Project-view block: open in the form (REL-R40). | REL-S7, REL-S26, REL-S33, REL-S48 |
| Accessibility — not colour alone | Goal mark (REL-R4) and drop target (REL-R15) | REL-S2, REL-S10 |
| Accessibility — contrast | Dimmed text ≥ 4.5:1 in both themes (REL-R13) | Measured with a contrast checker in both themes, result recorded in the PR. The test suite has no contrast tool |
| Integrity | Refusals change nothing (P3, REL-R60, R66) | REL-S37, REL-S40 |
| Performance | None set by the owner | — |

## 10. Atomics

Sizes: **S** ≈ ≤ 1 h · **M** ≈ half-day · **L** ≈ 1 day. Points follow EPIC-06's scale.

| # | Story | Size | Pts | Needs |
|---|---|---|---|---|
| REL-01 | Goal mark with block count | S | 1 | — |
| REL-02 | Highlight a goal's blocks | M | 3 | — |
| REL-03 | Drop a task onto a goal | L | 5 | REL-01 (soft) |
| REL-04 | Undo, and place it in order | M | 3 | REL-03 |
| REL-05 | Project view: drag goal-less blocks onto goals | M | 3 | — |
| REL-06 | Goal view: before and after by drag | M | 3 | — |
| REL-07 | Merge two tasks from the form: text, tags and files | L | 5 | — |
| REL-08 | Merge carries links and child tasks | M | 3 | REL-07 |
| REL-09 | Drag to merge two tasks on the board | S | 1 | REL-03, REL-07 |
| REL-10 | Merge two goals | S | 2 | REL-07 (REL-03 for the drag) |

Examples below use project Home, goal #500 "Build the shed" and project Work; ids are
illustrative.

### Phase 1 — Goals on the board (#393)

**REL-01 · Goal mark with block count** (S) — REL-R1–R4

```gherkin
Scenario: REL-S1 — goals are marked, with their count        # REL-R1, REL-R2, REL-R3
  Given goal #500 has live blocks #501, #502 and #503, of which #503 is done
  And block #504 of goal #500 is in the Bin
  When the board is shown, in either card style
  Then card #500 carries the goal mark showing 3
  And the goal view for #500 shows 3 tasks

Scenario: REL-S2 — a goal with no blocks is still marked      # REL-R1, REL-R4
  Given goal #510 "Plan the garden" has no blocks
  When the board is shown
  Then card #510 carries the goal mark with no number
  And a screen reader announces it as a goal with 0 blocks
```

**REL-02 · Highlight a goal's blocks** (M) — REL-R5–R13

```gherkin
Scenario: REL-S3 — resting on a goal lights up its blocks     # REL-R5, REL-R10
  Given goal #500 has blocks #501 in Backlog and #502 in Doing
  When the pointer rests on card #500 for 250 ms
  Then #501 and #502 are highlighted
  And every other card except #500 is dimmed

Scenario: REL-S4 — moving away ends it                          # REL-R11
  Given #500's blocks are highlighted from a pointer rest
  When the pointer leaves card #500
  Then no card is dimmed

Scenario: REL-S5 — selecting a goal holds the highlight         # REL-R7
  Given card #500 is the only selected card
  When the pointer moves to an empty part of the board
  Then #501 and #502 stay highlighted until the selection changes

Scenario: REL-S6 — the latest goal wins, then the selection returns # REL-R8, REL-R9
  Given card #500 is the only selected card and goal #510 has block #511
  When the pointer rests on card #510 for 250 ms
  Then #511 is highlighted and #501 is dimmed
  And when the pointer leaves #510, #501 and #502 are highlighted again

Scenario: REL-S7 — keyboard focus does the same                 # REL-R6
  Given the board is used by keyboard only
  When focus moves to card #500
  Then #501 and #502 are highlighted

Scenario: REL-S8 — no highlight mid-drag                        # REL-R12
  Given card #520 is being dragged
  When it passes over goal card #500 and rests there for 250 ms
  Then no card is dimmed
```

REL-R13 is verified by measurement (§9).

**REL-03 · Drop a task onto a goal** (L) — REL-R14–R25

```gherkin
Scenario: REL-S9 — dropping without a pause still moves the card  # REL-R17
  Given task #520 in Backlog and goal #500 in Doing
  When #520 is dropped on #500 without pausing
  Then #520 moves into #500's lane in Doing
  And #520 has no goal

Scenario: REL-S10 — resting marks the target                     # REL-R14, REL-R15
  Given task #520 is being dragged
  When it rests on goal #500 for 350 ms
  Then #500 is marked as the drop target by an outline and a label, not by colour alone

Scenario: REL-S11 — a card in the same column can be the target  # REL-R16, REL-R14
  Given task #520 and goal #500 are both in Backlog
  When #520 is dragged over #500 and rests there for 350 ms
  Then #500 stays where it is and is marked as the drop target

Scenario: REL-S12 — one drag adds a task to a goal               # REL-R18, REL-R19, REL-R20
  Given task #520 "Buy screws" in project Home, with no type and no goal
  When #520 rests on goal #500 and is dropped
  Then #520 is a building-block of #500
  And #520 stays in its own lane in Backlog
  And a message says "Added to Build the shed"

Scenario: REL-S13 — moving between goals says so                 # REL-R21
  Given block #521 belongs to goal #510 "Plan the garden" in project Home
  When #521 is dropped on goal #500 as the drop target
  Then #521 belongs to #500
  And the message names "Plan the garden" as the goal it left

Scenario: REL-S14 — wrong project is refused                     # REL-R23
  Given task #530 is in project Work and goal #500 is in project Home
  When #530 is dropped on #500 as the drop target
  Then #530 is unchanged
  And the message reads "A building-block must be in the same project as its goal"

Scenario: REL-S15 — a goal onto a task is refused                # REL-R24, REL-R25
  Given goal #500 is in Doing and task #520 is in Backlog
  When #500 is dropped on #520 as the drop target
  Then #500 is back in Doing where it started
  And the message says a goal cannot be dropped onto a task
```

REL-R22 (dropping on the goal a task already belongs to) is covered by a unit test; no scenario.

**REL-04 · Undo, and place it in order** (M) — REL-R26–R35

```gherkin
Scenario: REL-S16 — the order step offers only fitting tasks      # REL-R26, REL-R27, REL-R28
  Given goal #500 has blocks #501 and #502 in Home, and #502 already waits for #520
  When #520 is added to #500 by a drop
  Then the order step shows a Before picker and an After picker
  And the After picker offers #501 but not #502, as #520 waiting for #502 would close a loop

Scenario: REL-S17 — choosing adds, and keeps what was there       # REL-R29
  Given #520 already waits for #540
  When #501 is chosen under After and the step is confirmed
  Then #520 waits for #501 and #540

Scenario: REL-S18 — skipping adds nothing                         # REL-R30
  Given the order step is shown for #520
  When it is skipped
  Then #520's links are as they were before the drop
  And the message "Added to Build the shed" appears with Undo

Scenario: REL-S19 — Undo from the message puts it back            # REL-R32, REL-R33
  Given #521 moved from goal #510 to goal #500 by a drop, and the message is showing
  When Undo is chosen within 5 seconds
  Then #521 belongs to #510 again, as a building-block

Scenario: REL-S20 — Undo removes the step's links too            # REL-R34
  Given #520 already waited for #540, then was added to #500 and set to wait for #501
  When Undo is chosen in the message
  Then #520 has no goal and no longer waits for #501
  And #520 still waits for #540

Scenario: REL-S21 — Undo from the order step                      # REL-R31
  Given the order step is shown for #520 after a drop onto #500
  When Undo is chosen in the order step
  Then #520 has no goal, and its links are as they were before the drop

Scenario: REL-S22 — Undo is refused when the old goal is gone    # REL-R35
  Given #521 moved from goal #510 to goal #500 by a drop
  And #510 has since been retyped to a plain task
  When Undo is chosen
  Then #521 stays in #500
  And the message reads "Task 510 is not a goal"
```

### Phase 2 — Order in the views

**REL-05 · Project view: drag goal-less blocks onto goals** (M) — REL-R36–R40

```gherkin
Scenario: REL-S23 — goal-less blocks are listed                   # REL-R36
  Given project Home has blocks #550 and #551 with no goal, and #552 with no goal in the Bin
  When the project view for Home is shown
  Then it lists #550 and #551, and not #552

Scenario: REL-S24 — drag one onto a goal                          # REL-R37, REL-R38
  Given the project view for Home lists #550
  When #550 is dropped on goal card #500
  Then #550 is a building-block of #500
  And #550 leaves the list, and #500's count goes up by 1, without a reload

Scenario: REL-S25 — wrong project is refused                      # REL-R39
  Given the view shows All projects, block #560 is in Work and goal #500 is in Home
  When #560 is dropped on #500
  Then #560 still has no goal
  And the message reads "A building-block must be in the same project as its goal"

Scenario: REL-S26 — no drag needed                                # REL-R40
  Given the project view for Home lists #550
  When #550 is clicked or chosen with the keyboard
  Then #550 opens in the task form, where its Goal field can be set
```

**REL-06 · Goal view: before and after by drag** (M) — REL-R41–R48

```gherkin
Scenario: REL-S27 — drag to say which comes first                 # REL-R41, REL-R42, REL-R45
  Given goal #500's tasks in order are #501 then #502, with no link between them
  When #502 is dropped on #501 and Before this is chosen
  Then #501 waits for #502
  And Tasks in order shows #502 before #501, without a reload

Scenario: REL-S28 — after this                                    # REL-R43
  Given goal #500 has unlinked tasks #501 and #503
  When #503 is dropped on #501 and After this is chosen
  Then #503 waits for #501

Scenario: REL-S29 — existing links stay                           # REL-R44
  Given #503 already waits for #540
  When #503 is set to come after #501 by a drag
  Then #503 waits for #501 and #540

Scenario: REL-S30 — a loop is refused                             # REL-R46
  Given #502 waits for #501
  When #501 is dropped on #502 and After this is chosen
  Then no link is added
  And the message reads "These dependencies would create a loop"

Scenario: REL-S31 — a link that exists is refused                 # REL-R47
  Given #503 already waits for #501
  When #503 is dropped on #501 and After this is chosen
  Then nothing changes
  And the message says #503 already comes after #501

Scenario: REL-S32 — cross-project links are refused              # REL-R48
  Given goal #600 has no project, with task #601 in Home and task #602 in Work
  When #602 is dropped on #601 and Before this is chosen
  Then no link is added
  And the message says the two tasks are in different projects
```

### Phase 3 — Merge

**REL-07 · Merge two tasks from the form: text, tags and files** (L) — REL-R49–R62

```gherkin
Scenario: REL-S33 — Merge into offers only fitting cards          # REL-R49, REL-R50
  Given tasks #520 and #525 in Home, task #530 in Work, and goal #500 in Home
  When Merge into… is opened on #525
  Then it offers #520, and not #530, #500 or #525

Scenario: REL-S34 — the confirm step says what will move          # REL-R51
  Given #525 has 2 tags and 1 file, and no links
  When #520 is chosen as the card to keep
  Then the confirm step lists the description, 2 tags and 1 file

Scenario: REL-S35 — a confirmed merge                             # REL-R52–R59
  Given #525 "Buy screws (from email)", due 12 Nov 2026, effort 2, owner Moi, tag "hardware", one file plan.pdf
  And #520 "Buy screws", in Doing, owner Rich, with no due date
  When #525 is merged into #520 and confirmed
  Then #520's description ends with a "Merged from #525 Buy screws (from email)" section giving due 12 Nov 2026, effort 2 and owner Moi
  And #520 has tag "hardware" and its own copy of plan.pdf
  And #520 is still in Doing, owned by Rich, with no due date
  And #525 is in the Bin with the note "Merged into #520"
  And #520's history records "Merged #525 into this"

Scenario: REL-S36 — restoring the merged-away card               # REL-R61
  Given #525 was merged into #520
  When #525 is restored from the Bin
  Then #525 is back with its own description and plan.pdf

Scenario: REL-S37 — a failed write changes nothing               # REL-R60
  Given the merge of #525 into #520 is confirmed
  When writing #520's new description fails
  Then #520 and #525 are exactly as they were, and #525 is not in the Bin

Scenario: REL-S38 — a card with links waits for REL-08           # REL-R62
  Given #525 waits for #540
  When #525 is merged into #520
  Then the merge is refused
  And the message names #540
```

**REL-08 · Merge carries links and child tasks** (M) — REL-R63–R66

```gherkin
Scenario: REL-S39 — links follow the merge                        # REL-R63
  Given #525 waits for #540, and archived task #541 waits for #525
  When #525 is merged into #520
  Then #520 waits for #540
  And #541 waits for #520

Scenario: REL-S40 — a loop refuses the whole merge                # REL-R66, REL-R60
  Given #520 waits for #540 and #540 waits for #525
  When #525 is merged into #520 and confirmed
  Then the message reads "These dependencies would create a loop"
  And #520 and #525 are exactly as they were

Scenario: REL-S41 — links between the pair, and child tasks       # REL-R64, REL-R65
  Given #520 waits for #525, email task #526 has #525 as its parent, and so does #520
  When #525 is merged into #520
  Then #520 has no link to #525
  And #526's parent is #520
  And #520's parent is still #525

Scenario: REL-S42 — moved links stay on A after a restore         # REL-R61
  Given #525 was merged into #520, and its link to #540 moved to #520
  When #525 is restored from the Bin
  Then #520 still waits for #540, and #525 has no links
```

**REL-09 · Drag to merge two tasks on the board** (S) — REL-R67–R69

```gherkin
Scenario: REL-S43 — drag one task onto another                    # REL-R67
  Given tasks #525 and #520 are in Home
  When #525 rests on #520 and is dropped
  Then the confirm step for merging #525 into #520 is shown

Scenario: REL-S44 — cancelling puts it back                       # REL-R69
  Given the confirm step for merging #525 into #520 is shown
  When it is cancelled
  Then #525 is back where the drag began and nothing has changed

Scenario: REL-S45 — across projects is refused                    # REL-R68
  Given the board shows All projects, task #530 is in Work and #520 is in Home
  When #530 rests on #520 and is dropped
  Then nothing changes and the message says the cards are in different projects
```

**REL-10 · Merge two goals** (S) — REL-R70–R72

```gherkin
Scenario: REL-S46 — blocks follow the merge                       # REL-R70
  Given goal #510 in Home has live block #521 and binned block #522
  When #510 is merged into goal #500
  Then #521 and #522 are building-blocks of #500
  And #510 is in the Bin with the note "Merged into #500"

Scenario: REL-S47 — drag one goal onto another                    # REL-R71
  Given goals #510 and #500 are in Home
  When #510 rests on #500 and is dropped
  Then the confirm step for merging #510 into #500 is shown

Scenario: REL-S48 — goals can be merged from the form             # REL-R72
  Given goals #510 and #500 are in Home
  When Merge into… is opened on #510
  Then it offers #500
```

## 11. Traceability

| Requirement | Story | Verified by |
|---|---|---|
| R1–R4 | REL-01 | S1, S2 |
| R5–R12 | REL-02 | S3–S8 |
| R13 | REL-02 | Measurement (§9), no scenario |
| R14–R21, R23–R25 | REL-03 | S9–S15 |
| R22 | REL-03 | Unit test, no scenario |
| R26–R35 | REL-04 | S16–S22 |
| R36–R40 | REL-05 | S23–S26 |
| R41–R48 | REL-06 | S27–S32 |
| R49–R62 | REL-07 | S33–S38 (R56: S35, where A keeps its stage, owner and due date) |
| R61, R63–R66 | REL-08 | S39–S42 |
| R67–R69 | REL-09 | S43–S45 |
| R70–R72 | REL-10 | S46–S48 |

Coverage holes, stated rather than hidden: REL-R13 is verified by measurement and REL-R22 by a
unit test. Every other requirement has a scenario, and every scenario names its requirements.

## 12. Sequencing and dependencies

1. **Phase 1 first** (owner's choice). REL-01 lands before REL-03 so the board shows which card is
   a goal before drops depend on it. REL-02 can run alongside. REL-04 follows REL-03.
2. **Phase 2 any time.** REL-05 and REL-06 touch only their own views and can run in parallel with
   everything else.
3. **Phase 3.** REL-07 first: it builds the merge and its non-drag route, for cards with no links
   or child tasks. REL-08 then lifts that limit. REL-09 needs REL-03's drop target and REL-07.
   REL-10 needs REL-07, and REL-03 for its drag.

Each story ships alone and leaves the board working. REL-04, REL-08, REL-09 and REL-10 are not
independent in the INVEST sense; they are small because they reuse what came before.

## 13. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| K1 | A pause over a card while moving it to a lane turns into an add or a merge | Medium | Medium | Only pairs in Table 1 become targets; the target is clearly marked; a merge always confirms; an add has Undo |
| K2 | A merge cannot be fully undone: links, child tasks and blocks stay with A | Medium | Medium | The confirm step lists what will move (REL-R51); B and its files survive in the Bin |
| K3 | Dimming competes with existing card styling (overdue, warning borders, selection outline) | Low | Low | Dimming leaves borders and outlines visible; contrast floor (REL-R13) |
| K4 | The goal mark's count differs from the goal view under a scoped board, since the board loads only its scope's tasks | Low | Low | REL-R3 pins the count to the goal view's; for a goal with no project the count may need the all-projects list |
| K5 | Keeping cards still during a drag (REL-R16) changes how a drag looks within a column | Low | Low | Order within a column is never saved, so nothing is lost; the drop target is marked instead |

## 14. Documents this epic amends

- `ARCHITECTURE.md` — "Project and goal views": dragging in both views, the goal mark and
  highlight, and the merge.
- `docs/BACKLOG.md` — add the epic as a backlog item. Placement is the weekly review's call.
- `CHANGELOG.md` and `docs/CHANGE-CONTROL.md` — a row per PR, as usual.
- Board task #393 — close as a duplicate of this epic.
- EPIC-05 — no change. Its non-goal "link creation by drag on the board" still holds.

## 15. Definition of Done (epic)

- [ ] REL-01 to REL-10 merged, each with its scenarios as passing automated tests.
- [ ] REL-R62 withdrawn once REL-08 has shipped.
- [ ] No migration added.
- [ ] REL-R13 contrast measured in light and dark themes and recorded in the PR.
- [ ] Each drag action shown to have its non-drag route (§9).
- [ ] `ARCHITECTURE.md` updated (§14).
- [ ] #393 closed as a duplicate.

## 16. Open questions

| # | Question | Why it matters | Who decides | Blocking? |
|---|---|---|---|---|
| Q1 | Is 5 seconds long enough for Undo? It is the toast library's default (`node_modules/@radix-ui/react-toast/dist/index.mjs:27`); the app sets no duration | Too short and Undo is missed; only one message shows at a time (`use-toast.ts:6`) | Owner | No — 5 s stands |
| Q2 | Should a done goal still accept tasks by drop, and still be a merge target? | Neither the request nor #393 says; the rules allow both | Owner | No |

## 17. Assumptions

- **A1** — A merge writes B's due date, effort and owner into the appended text rather than
  copying them into A's empty fields. Chosen for speed (P1): one rule fewer, and nothing is lost.
  *Invalidated if: the owner wants A's empty fields filled.*
- **A2** — The goal mark's count includes finished blocks, as the goal view's does.
  *Invalidated if: the owner wants only open blocks counted.*
- **A3** — The 350 ms rest matches the Filing menu, and the 250 ms highlight rest matches the preview
  pane. *Invalidated if: either feels wrong in use; both are single constants.*
- **A4** — A merge carries over none of B's other fields (priority, recurrence, stage, lane, project,
  goal, type). *Invalidated if: the owner names one that must carry.*
- **A5** — Undo after a drop restores the task's previous goal and type but not its lane, because a
  drop onto a goal does not move the card. *Invalidated if: a drop also moves the card.*
- **A6** — The highlight follows the goal most recently rested on, focused or selected, and falls
  back to a selected goal when a rest or focus ends (REL-R8, R9). Chosen as the default; the
  request did not say. *Invalidated if: the owner wants selection to win throughout.*
- **A7** — REL-07 refuses cards with links or child tasks (REL-R62) until REL-08 ships, so that
  REL-07 fits in a day. *Invalidated if: the two are built together.*
