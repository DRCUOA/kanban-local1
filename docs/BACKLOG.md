# Consolidated dev backlog

**Status:** Live — supersedes the loose board chatter as the ordered dev list
**Last consolidated:** 14 Aug 2026, from board tasks #151–#162 + EPIC-01/03/04
**Amended:** 12 Oct 2026 — **B-11** added (EPIC-06, owner as an entity); B-01 Q3, B-04, B-05 and B-10 updated where it changes them
**Amended:** 13 Oct 2026 — **B-05** part-done: EPIC-03 stories 1 and 2 landed (state collapse), ahead of B-01's audit
**Amended:** 21 Oct 2026 — **B-11 shipped** (PR #131, 12 Oct). B-04 and B-07 updated where shipped work changes them. New section *Shipped outside the backlog, 12–21 Oct* records eight pieces of work that shipped without a backlog item (one of them partly EPIC-05); each PR is in `docs/CHANGE-CONTROL.md`. Nothing reordered: that is the weekly review's call
**Convention:** items carry a stable `B-xx` id for tracking; board task ids and epic
docs are cross-referenced so nothing exists in two places with two meanings.

## How the chatter consolidated

| Board task | What it said | Where it landed |
|---|---|---|
| #160 Data model audit | full audit, pain points, triage, maybe rebuild | **B-01** (and it front-runs EPIC-03) |
| #151 Bug: description links (email arrived twice — one task) | `file://` not hyperlinking; display names for links | **B-02** |
| #153 Project layer | project scoping; 13 Aug thought: "owner becomes project?" | Already captured as **EPIC-01** (task says "epic 3" — that's a mis-reference; project layer is EPIC-01). The owner-as-project thought becomes an explicit **B-01 audit question** |
| #158 Visual interaction feedback | clicked-in-24h shade change, freshness markers | **B-07** |
| #159 AI UX research | @-mention / MCP-style interactions in boards | **B-09** |
| #161 Drag-drop / screenshot paste in description | attachments UX | **B-06** — hard-gated by EPIC-03's attachment extraction |
| #162 Sorting options | due date / effort / owner sorts | Split: **B-04** (due+effort, safe now) and the owner sort folded into **B-05** (needs EPIC-03's single owner namespace) |

## Ordered backlog

### Now

**B-01 — Data-model audit** · board #160 · effort 1–2 · due 31 Aug
Raise board priority Low → **High** (agreed 14 Aug: it gates everything below).
Scope: re-validate EPIC-03's seven findings against *current* production data; find
anything new. Three explicit questions whose answers are audit outputs:
1. Is task history complete/trustworthy enough to reconstruct past states?
   (→ answers EPIC-04 open Q2, snapshot vs watermark)
2. What would EPIC-04's witnessed-checkpoint table need that the model lacks?
3. ~~Owner-as-project (board #153, 13 Aug update): should EPIC-01's project layer be
   an entity, or collapse into a normalized owner namespace?~~ **Answered 12 Oct 2026
   — they stay separate entities, and owner becomes an entity of its own** (see
   **B-11** / EPIC-06). EPIC-01 shipped a `projects` table on the reasoning that a
   person works on several projects and a project has several people; EPIC-06 gives
   owner the same treatment rather than collapsing either into the other. The audit
   no longer needs to decide this, though it may still disagree in writing.
Output: audit report in `docs/`, EPIC-03 confirmed/amended, triage of any new finds.

**B-02 — Description link handling** · board #151 · effort 2 · due 26 Aug
Bug + small enhancement, independent of everything: `file://` URIs don't render as
links; add display-name support for both web and local links.
Reality check to capture in the task: browsers block `file://` navigation from
http(s) pages — "make it a hyperlink" needs a deliberate mechanism (copy-path
affordance, custom protocol, or local-open endpoint), not just an anchor tag.
Quick win; can ship while B-01 runs.

**B-03 — Park EPIC-04 cleanly** · admin
Merge PR #114 (v2 of the epic), add a "Paused — pending B-01/EPIC-03" status line.
No further EPIC-04 work until B-01 reports.

### Next

**B-04 — Board sorting, phase 1: due date + effort** · from board #162 · effort 1
Due-date and effort sorts read unambiguous fields and can ship on the current model.
Owner sort is **excluded** here — `owner` vs swimlane-tag is exactly the ambiguity
EPIC-03 removes; sorting on it now would sort wrong.
_12 Oct 2026: the owner sort now has a home — **B-11** / EPIC-06 story OWN-08 — and
no longer waits on B-05._
_21 Oct 2026: the owner sort shipped with B-11 (More menu, PR #131). Soonest-due-first
has been the board's fixed default order since 15 Aug (`db0ec74`), but there is still no
effort sort and no way to choose a sort; that is what remains of this item._

**B-05 — EPIC-03: One authoritative state per task** · 2–3 sprints (~29 pts)
The big rock. Refine with B-01's report in hand, then implement.
Sequencing inside the epic: pull the **attachment extraction** story early (it
unblocks B-06 and removes the 97% payload problem), and the **state collapse +
board timezone** stories early (they unblock EPIC-04).
_12 Oct 2026: story 5 (the owner/swimlane overlap, 5 pts) left this epic for **B-11**
/ EPIC-06 v3.2, taking the target from ~34 to ~29 pts. The owner sort went with it.
Story 3 (sub-stage FK) still owns the lanes that name a **status**; EPIC-06 takes the
lanes that name a **person**._

_13 Oct 2026: **stories 1 and 2 landed** (10 pts) — `stages.kind` plus the drop of
`tasks.status`, pulled early as the sequencing note above asks, since the state
collapse unblocks EPIC-04. Taken out of order relative to B-01: the two findings
they close (#1 and #5) were unambiguous on current production data, and the
backfill reports (`stage_kind_backfill_report`, `task_status_backfill_report`) give
the audit better evidence than it would have had. ~19 pts remain in the epic.
**B-01 should now re-validate findings 2, 3, 4, 6 only.**_

**B-06 — Attachment UX: drag-drop + screenshot paste** · board #161 · effort 1–2
_Unblocked 28 Sep 2026:_ EPIC-03 story 7 (attachment extraction) landed on its own —
attachments are `task_attachments` rows referenced by url, and `description` no
longer carries base64 (the single worst finding in EPIC-03, 533 KB of a 547 KB
payload). Remaining: drag-drop onto the modal, clipboard paste for screenshots,
dynamic preview.

**B-11 — EPIC-06: Owner as an entity** · 1–2 sprints (~31 pts) · spec'd 12 Oct 2026
`tasks.owner` becomes an `owners` table plus an `owner_id` FK, and the sub-stage
lanes that name a person (`Rich`, `Rich`, `Moi` — sub-stages 2, 3, 4) bind to those
rows so lane membership is derived from assignment instead of from a tag string.
Spec: `docs/epics/EPIC-06-owner-as-entity.md`. Decisions are locked; it needs
refinement against the seven open questions, then build.

_21 Oct 2026: **shipped** in PR #131 on 12 Oct: the `owners` table, `tasks.owner_id`,
person lanes bound to owners, the Admin Owners card and the owner filter and sort
(migration `0013`, with `owner_backfill_report`). OWN-10, dropping the trigger-kept
`tasks.owner` mirror, is left for a later release. The epic doc's status line still
reads "Spec"._

Why it does **not** wait on B-01: the audit's job is to re-validate EPIC-03's
findings against current data, and this item did exactly that for the assignment
finding — measured against the live dev board on 12 Oct 2026 (16 tasks, `Rich` ×9,
`Moi` ×3, 4 unassigned, 3 person lanes, topic tags mixed into the same `tags`
array). It also *removes* a story from B-05 rather than adding one, and carries the
owner sort that B-04 had to cut. B-01 may still disagree in writing; nothing here
depends on its other two questions.

### Later

**B-07 — Ambient freshness markers** · board #158 · effort 1–2
Clicked-within-24h shade change + at-a-glance interaction cues. Two reasons it
waits: it needs a *viewed/interacted* timestamp (a new fact — `updatedAt` only
tracks mutations), which shouldn't be added mid-model-flux; and it's a sibling of
EPIC-04's awareness thesis — design them together so the board has one coherent
"what's new/what's touched" language, not two competing ones.
_21 Oct 2026: the first reason has partly gone. `tasks.viewed_at` exists (migration
`0024`, PR #159): stamped by `POST /api/tasks/:id/viewed` when the task dialog opens,
and used by the landing page's "New tasks" row. Only tasks made from mail start
unseen; existing rows and every other way in count as seen, so it is a "nobody has
opened it" fact, not a general last-viewed time. The marker design, and its
co-design with EPIC-04, has not started._

**B-08 — EPIC-01: Project scoping** · 2 sprints (~21 pts) · **Shipped 26 Sep 2026**
Pulled forward on the product owner's request, ahead of B-01: a project is a set
of tasks related to a common goal, kept as its own entity rather than collapsed
into the owner namespace (a person works on several projects; a project has
several people). `project_id` is nullable — null is "no project" — so nothing was
backfilled and deleting a project releases its tasks. Decisions are recorded in the
epic's *Implementation notes*. Still open from the epic: inbound-alias → project
mapping (story 8), and any owner-namespace consequences B-01 surfaces.

**B-09 — EPIC-04: Catch-up Replay — implementation planning, then build**
Resumes when B-01 answers Q2 and B-05's state/timezone stories have landed.
Plan against the 10-step skeleton in the epic doc (adapter → checkpoint →
headless state machine → reduced-motion presentation first).

**B-10 — Research spike: AI @-interaction patterns** · board #159 · effort 2 · Low
Timeboxed spike (suggest 1 day): how Jira/Confluence-class boards do @/slash/agent
interactions, how fragile, what to replicate; output is user stories only.
No dependencies — parallelizable whenever there's slack; deliberately last so it
can't displace committed work.

**Library question already answered (14 Aug, from board chatter suggesting `cmdk`
or Plate JS): use neither — use `@tiptap/suggestion`.** The description field is
already Tiptap 3 (`client/src/components/RichTextEditor.tsx`, StarterKit +
Placeholder), which the chatter didn't account for.

- **Plate JS is a Slate-based editor framework** — adopting it means replacing
  Tiptap wholesale, migrating serialization and every consumer of description HTML
  (`RichTextContent.tsx`, export, briefing). An enormous change to acquire a menu.
- **`cmdk` is the wrong shape** (and not currently installed — no shadcn
  `command.tsx`). It is built for *overlay* palettes with their own focus and input.
  An in-editor slash menu is the inverse: the caret stays in the document, the query
  is the text typed after the trigger, and the popup only borrows arrow keys/Enter.
- **`@tiptap/suggestion` is the exact primitive**: configurable trigger character,
  match/range tracking, render callbacks for a popup you supply, and correct
  replacement of the trigger range on select. First-party, same mechanism behind
  Notion-style slash menus; `@tiptap/extension-mention` wraps it for @-people.

**Spike's real deliverable — which insert types are safe before the model is fixed.**
The menu is not the fragile part; what it *inserts* is:

| Insert type | Risk |
|---|---|
| Self-contained content — date, checklist, heading, code block, plain link | Safe. No ids, nothing the data model must guarantee. |
| Entity references — `@person`, `#task`, project | Fragile. Needs a custom node with an id that survives HTML serialization, stays valid across rename/delete, and is understood by every description consumer. |

`@owner` today would encode assignment as a **third** namespace inside description
HTML, on top of the two contradictory ones EPIC-03 documents (`owner` vs swimlane
tags) — inventing a new integrity problem inside the area being repaired. `#task`
has the same defect: no stable permalink until EPIC-03 adds one. Hence entity
references stay behind B-01/B-05.

_12 Oct 2026: for `@owner` specifically, **B-11** / EPIC-06 changes the picture —
after it lands there is one assignment namespace with stable row ids to mention, so
`@owner` becomes a reference to a real entity rather than a third way of saying the
same thing. `#task` still waits on EPIC-03's permalink._

**Optional early subset:** a slash menu limited to self-contained content could ship
before the model work — it proves the interaction and touches no ambiguous field.
It overlaps B-06's territory (both are description-input UX), so pull it forward
only as one combined piece of work, not a second pass over the same modal.

**Product caution:** slash commands are a power-user idiom whose discoverability
depends on knowing to type a character with no visible affordance. For the audience
described in EPIC-04 — people for whom tool complexity is already the barrier — a
hidden interface reads as "not for me." Any implementation must be an accelerator
layered over visible buttons, never the only route to a capability.

### Shipped outside the backlog, 12–21 Oct 2026

Recorded so the next weekly review can decide what each becomes: a backlog item
closed after the fact, an epic amendment, or nothing. Per-PR detail, schema and
deploy actions are in `docs/CHANGE-CONTROL.md`.

| Work | PRs | Bearing on this backlog |
|---|---|---|
| Goals, building-blocks and dependencies (task type, goal link, predecessor/successor edges, same-project rules) | #136–#139, #141, #147 | EPIC-05's relation, built ahead of its B-01 gate at the owner's direction. Its status line still reads "Draft" |
| Project and goal views, critical path, Gantt, plan write-up | #143, #148, #156 | EPIC-05 §6 lists critical path, slack and Gantt as **non-goals**; the epic was not amended |
| "Make this a goal" AI planner | #144, #145, #151 | None. Adds `app_settings` (`0021`) |
| Access gate, export tokens, developer console | #146, #149 | None. Production needs `CODE_HASH_KEY` and `DEVELOPER_SECRET` |
| Drag-select and bulk edit, goal filter, active-filter strip | #140, #150 | None |
| Inbox, `POST /api/inbox` | #158 | None. Renames the Gmail queue's key (`0023`) |
| Landing page and `tasks.viewed_at` | #159 | Supplies B-07's missing fact (above) |
| Phone UI passes and restyle | #131, #152, #155, #157 | None |

## Dependency spine (why this order)

```plantuml
@startuml
title Consolidated backlog — dependency spine (why this order)
left to right direction
skinparam shadowing false
skinparam rectangleRoundCorner 12
skinparam ArrowColor #555555
skinparam defaultTextAlignment center

rectangle "**B-01 · Now**\nData-model audit\n(board #160)" as B01 #FFE082
rectangle "**B-05 · Next**\nEPIC-03\nOne authoritative\nstate per task" as B05 #FFCC80
rectangle "**B-06 · Next**\nAttachments UX\ndrag-drop + paste\n(board #161)" as B06 #FFFFFF
rectangle "**B-08 · Later**\nEPIC-01\nProject layer\n(board #153)" as B08 #FFFFFF
rectangle "**B-09 · Later**\nEPIC-04\nCatch-up Replay build" as B09 #FFFFFF
rectangle "**B-07 · Later**\nFreshness markers\n(board #158)" as B07 #FFFFFF
rectangle "**B-11 · Shipped**\nEPIC-06\nOwner as an entity\n(PR #131, 12 Oct)" as B11 #C5E1A5

package "Independent — schedule in slack" #E8F5E9 {
  rectangle "**B-02 · Now**\nDescription link fix\n(board #151)" as B02
  rectangle "**B-04 · Next**\nSorting: due + effort\n(board #162, phase 1)" as B04
  rectangle "**B-10 · Later**\nAI @-interaction spike\n(board #159)" as B10
}

B01 -[bold]-> B05 : findings validated,\ntriage confirmed
B05 --> B06 : attachment extraction\nlanded first
B05 --> B08 : owner namespace\nnormalised
B05 --> B09 : state collapse +\nboard timezone landed
B05 --> B07 : model stable; add\nviewed-timestamp fact

B11 -[bold]-> B05 : story 5 delegated:\nEPIC-03 drops to ~29 pts
B11 -[bold]-> B04 : owner sort lands\nhere, not in EPIC-03
B01 .[#888888].> B08 : decision output:\nowner-as-project?
B01 .[#888888].> B09 : Q2 answer: snapshot vs\nwatermark + history
B07 .[#888888]. B09 : co-design one\n"what's new" language

note bottom of B01
  Cheapest item on the list (effort 1–2)
  and the only one that de-risks
  everything downstream.
  Amends the epics as needed.
end note

note bottom of B09
  B-03 (park EPIC-04) already done:
  status "Paused", PR #114 merged.
end note

note bottom of B11
  The one item that answers a
  B-01 question instead of waiting
  for it — and it takes work out
  of B-05 rather than adding it.
end note

legend right
  |= line |= meaning |
  | solid | hard dependency — do not start before |
  | dotted | information flow — a decision or answer travels |
  | green box | no dependencies either way |
endlegend
@enduml
```

### Narrative notes — the logic behind the spine

1. **Everything begins with B-01 because it is the cheapest way to find out whether
   everything else is standing on solid ground.** The audit is a one-to-two effort
   task, yet its output determines the shape of a ~34-point epic and, through that,
   three more work items. Doing cheap, high-information work before expensive,
   dependent work is the whole logic of the spine.
2. **B-05 (EPIC-03) is the trunk, not just another branch.** Every ambiguity it
   removes — two contradictory state machines, the double-booked owner field,
   tag-string swimlanes, the untyped due date, base64 blobs inside descriptions — is
   a fault line that some later item would otherwise be built directly on top of.
   Three items wait for it, each for a specific, nameable reason.
3. **B-06 (attachments UX) waits for one specific EPIC-03 story: attachment
   extraction.** Shipped today, every dropped file would become more base64 inside
   the `description` text column — actively growing the single worst measured
   problem in the model (533 KB of a 547 KB payload). The feature isn't hard;
   building it *first* would be building the problem a bigger front door.
   _28 Sep 2026: that story landed ahead of the rest of EPIC-03; B-06 is open._
4. **B-08 (EPIC-01, projects) waits for a decision, not just for code.** The audit
   carries the question "should a project be its own entity, or should a normalised
   owner become the project?" Until that's answered, EPIC-01 as written might be the
   wrong epic entirely. What travels along the dotted line from B-01 is a decision,
   not software.
5. **B-09 (EPIC-04, the replay) waits for two different things from two different
   places.** From B-01 it needs an *answer*: is task history trustworthy enough to
   reconstruct past states (watermark), or must we snapshot evaluated state
   (checkpoint table)? From B-05 it needs *landed code*: one authoritative task
   state and an explicit board timezone — because a replay that announces "this task
   moved" or "this became overdue" from self-contradicting fields would show wrong
   changes, and this feature's entire hypothesis is building trust.
6. **B-07 (freshness markers) has a soft dependency and a design constraint.** It
   needs a new fact the model doesn't hold — *when a task was last viewed* (today's
   `updatedAt` only tracks edits) — and new facts shouldn't be added while the model
   is mid-rebuild. The dotted line to B-09 isn't a dependency: it says the two
   features must share one visual language for "what's new here," so they are
   designed together even though either could ship first.
7. **The green box is the pressure valve.** B-02, B-04, and B-10 touch nothing on
   the spine and nothing on the spine touches them — pick one up whenever spine work
   is blocked or a small win is wanted. The one nuance is B-04's missing fragment: the
   *owner* sort was deliberately cut from phase 1, because sorting on a field the
   model can't yet answer honestly would produce confidently wrong orderings.
   _12 Oct 2026: that fragment now ships with **B-11** (EPIC-06) rather than with
   EPIC-03, because EPIC-06 is what makes the owner namespace single._
8. **B-03 doesn't appear as a box because it's already history** — EPIC-04 marked
   Paused, PR #114 merged; the diagram records it as a note so the spine reflects
   only live work.
9. **B-11 runs against the grain of the spine, deliberately.** Everything else in
   *Next* and *Later* waits on B-01 or B-05. B-11 does neither: it re-measured the
   assignment finding itself, hands a decision *back* to B-01 (owner-as-project:
   separate entities), and subtracts a story from B-05. It is the one item whose
   arrows into the trunk point the other way.

## Board hygiene actions from this consolidation

- [ ] #160: priority Low → High; link this doc.
- [ ] #153: fix epic reference (project layer is **EPIC-01**, not 3); note that the
      owner-as-project question moved into the B-01 audit scope.
- [ ] #162: split — phase 1 (due/effort) is B-04; owner sort is EPIC-06 story OWN-08
      (was: noted on EPIC-03).
- [ ] #161: add "blocked by EPIC-03 attachment extraction" so it isn't picked up early.
- [ ] #158: add "co-design with EPIC-04; needs interaction timestamp" note.
- [ ] #159: record the library conclusion (`@tiptap/suggestion`, not cmdk/Plate) so
      the board chatter doesn't re-litigate it; note entity references are gated by
      EPIC-03.
- [ ] Duplicate #151 email was noise — single task, no action.
