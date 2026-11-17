# Request: relate cards by dragging — merge, add to a goal, put in order

Replaces board task #393 "Improve Kanbando goal views" (see the end).

## What I want

Let me see goals on the board and connect work by dragging. On the board, goal
cards are marked, and resting on one highlights its building-blocks. Dropping a
task onto a goal adds it to that goal in one drag. Dropping a card onto another
of the same kind merges them. In the goal view I drag a goal's tasks onto each
other to say which comes first, and in the project view I drag building-blocks
that have no goal onto a goal. Everything I can do by dragging I can also do
without dragging.

"Task" below means any card that is not a goal.

Rules already in the app, unchanged:

- A task belongs to at most one goal (there is one goal field). #393's "a task
  can't sit under two goals" is already true.
- A predecessor/successor link joins two tasks in the same project; no project
  counts as a project of its own.
- A goal in a project takes building-blocks only from that project. A goal with
  no project takes them from any project.

## Board: see goals

- Every goal card carries a goal mark, on the full card and on the summary
  circle. When the goal has building-blocks, the mark shows how many (live ones,
  the same count the goal view uses). Today nothing on a board card says it is
  a goal.
- While a goal card is being looked at, its building-blocks are highlighted
  wherever they sit on the board and the other cards are dimmed. "Looked at"
  means any of:
  - the pointer has rested on it for 250 ms (the preview pane's delay), until
    the pointer leaves;
  - it has keyboard focus, until focus moves;
  - it is the only card selected (shift-click or marquee, as today), until the
    selection changes.
- This works in both board layouts and on both card styles. It does not depend
  on the preview pane, which only the horizontal layout has.
- Blocks not on the board (filtered out, another project) are not shown.
- On a phone there is no resting pointer or shift-click; the Goal filter stays
  the way to see one goal with its blocks.

## Board: drop one card onto another

- Rest a dragged card on another card for about a third of a second (the same
  pause that opens the Filing menu) and that card is highlighted as the target.
  Let go to act on it. Passing over a card without pausing still moves the card
  into that lane, as today.
- **Task onto goal: added to the goal**, straight away, with no confirm step.
  - A task with no type becomes a building-block.
  - A task already in another goal moves to this one, and the message names the
    goal it left.
  - Refused, with the reason, when the project rule above does not allow it.
  - Then an optional step offers Before and After pickers listing the goal's
    other tasks in the same project. The pickers add links: the task's existing
    links stay. (The API replaces a whole side when one is sent, so the write
    must send the existing links with the new ones.) Skipping adds no links.
  - The message offers Undo for the whole drop. It removes any links the step
    added and puts back the task's previous goal and type. If the previous goal
    can no longer take it back (it has since been retyped or deleted forever),
    Undo is refused with the reason.
- **Task onto task, or goal onto goal: merge**, after a confirm step that lists
  what will move across. Both cards must be in the same project (no project
  counting as its own), as the other card's links move across and links cannot
  cross projects. Otherwise the merge is refused with the reason. This can
  happen when the board shows All projects.
- **Goal onto task: refused.** The card goes back where it started and a message
  says why.

What a merge does. The card dropped onto is kept, and it stays where it is:

- It keeps its own title, type, stage, lane, owner, project and other fields.
  Any of due date, effort or goal that it has empty is filled from the other
  card; a task with no type that takes a goal becomes a building-block. Owner is
  not filled, because a person's lane is decided by owner, and filling it could
  move the kept card into another lane.
- The other card's description is added to the end of its description, under
  "Merged from #N Title".
- The other card's tags are added, except lane tags (a card sits in one lane).
- The other card's attachments are copied, not moved, and the added description
  points at the copies. The other card keeps its originals, so restoring it from
  the Bin leaves its description and files intact.
- The other card's predecessor and successor links move across, and any link
  between the two cards is dropped. If that would make a loop (A before X before
  B: merging A into B makes B wait for itself), the merge is refused with the
  server's existing message, "These dependencies would create a loop".
- Goal onto goal: the other goal's building-blocks move to the kept goal.
- Links and building-blocks move whether they are live, archived or in the Bin,
  so nothing is left pointing at the merged-away card.
- The other card goes to the Bin, noted "Merged into #K", and the kept card's
  history records the merge. Restoring it from the Bin brings it back without
  the links and building-blocks that moved across.

## Goal view (`/goals/:goalId`): order by dragging

- Drag one of the goal's tasks onto another and choose Before this or After
  this. That writes a predecessor/successor link, and Tasks in order, the
  critical path and the Gantt chart update.
- Refused, with the reason: a link that would make a loop, one that already
  exists, or one between two tasks in different projects (possible when the
  goal has no project).
- Removing a link stays in the task form, as today.
- Unchanged: finished tasks are still listed (they count towards progress), and
  Edit goal or clicking a task still opens the task form.

## Project view (`/projects/:projectId`): add to goals

- New: list the building-blocks that have no goal. Today the view only counts
  them.
- Drag one of them onto a goal card and it becomes one of that goal's
  building-blocks.
- Under All projects, adding a block to a goal in a different project is
  refused with the reason. A goal with no project accepts any block.

## Without dragging

The board works to WCAG 2.1 AA (`docs/WAYS-OF-WORKING.md`), so every drag
action needs another way in:

- Before/after and add to goal: the task form's Predecessors, Successors and
  Goal fields already do this for a task.
- Merge: new. A "Merge into…" action in the task form that picks the other card
  from a list, with the same rules and the same confirm step.
- Highlighting a goal's blocks: keyboard focus on the goal card, or selecting
  it, does it.

## Not in this request

- An "update critical path" action, and flagging the Gantt chart and critical
  path while an update is pending (#393 item 4). Not needed: the goal view
  works out the order, critical path and Gantt chart from the current tasks and
  links each time it is shown, and stores no plan, so there is nothing to
  update. As everywhere on the board, changes made in another tab, by the email
  inbox or through the API appear after a reload; live updates are a separate
  matter.
- Linking to tasks outside the goal from the drop step. The task form does
  that, as today.
- Grouping a column's cards into one lane per goal.
- Ordering goals against each other. The task form disables Predecessors and
  Successors for a goal on purpose: a goal's order comes from its
  building-blocks and their links.
- Merging in the goal or project views, or making links by dragging on the
  board. EPIC-05 §6 ruled out creating links by drag on the board; the
  before/after step after adding to a goal uses pickers, not dragging.
- Dragging several selected cards at once.
- Undoing a merge beyond restoring the card from the Bin.
- Merging across projects.
- Hiding finished tasks in the goal view.

## Replaces #393

All four items of board task #393 are covered: items 1 and 2 under "Board: see
goals", and items 3 and 4 under "Task onto goal". Item 4's predecessors and
successors are offered from the goal's own tasks. Its "update critical path"
part is not needed; see "Not in this request". #393 can be closed as a duplicate of
this request. Its done-when, "linking a block to a goal is one drag", is met by
"Task onto goal".
