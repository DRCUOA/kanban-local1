# EPIC-06: Owner as an entity — one assignment namespace

**Epic type:** Enabler + business feature
**Status:** Spec — decisions locked 12 Oct 2026, awaiting refinement
**Owner:** Product
**Target:** 1–2 sprints (≈31 pts, of which 30 in the main release)
**Traceability prefix:** `OWN`

**Locked decisions (12 Oct 2026, product owner).** These are not up for re-litigation during
refinement: (1) an `owners` lookup table plus `tasks.owner_id` FK — not an enum, and not a
`users` table with authentication; (2) person-named sub-stage lanes fold into that one
namespace; (3) `owner_id` stays nullable, null meaning *Unassigned*; (4) on backfill, the lane
wins where lane and text owner disagree; (5) the existing `tasks.owner` text column survives as
a maintained read-only mirror and is dropped in a later migration; (6) deleting an owner
releases their tasks; (7) an owner row carries colour, archived, order and a short code.

---

## 1. Epic hypothesis statement

> **For** everyone and everything that reads "whose task is this?" — the board, the task editor,
> `GET /api/export` and the daily-briefing agent —
> **who** today read it from a free-text label in one place and a tag string in another, and can
> get two different answers for the same task,
> **the** Owner entity **is a** first-class row that a task points at by foreign key
> **that** makes a person a thing the board knows about rather than a string someone typed.
> **Unlike** the current `varchar(15)` label, whose set of valid values is defined by
> `SELECT DISTINCT owner FROM tasks` — so a typo invents a person, a rename is impossible, and a
> person ceases to exist when their last task is binned —
> **our solution** stores assignment once, as `tasks.owner_id`, and derives both the owner chip
> and the person lane from it.
>
> **We will know we are right when** every non-null assignment on the board resolves to an
> `owners` row, `ownerConflict` is false by construction rather than by inference, the
> lane-names-a-person heuristic is deleted from `shared/briefing.ts` rather than merely returning
> false, and renaming a person is one write instead of fifteen.

## 2. Context / problem

`owner` arrived as a label and never grew up. `migrations/0007_add_task_owner.sql` is one line —
`ALTER TABLE "tasks" ADD COLUMN "owner" varchar(15)` — with no table, no foreign key and no
constraint. `server/storage.ts:314` then derives the list of people from the tasks themselves:

```sql
SELECT DISTINCT owner FROM tasks WHERE owner IS NOT NULL AND length(owner) > 0
```

Five consequences, all live today:

1. **The set of people is whatever has been typed.** `OwnerSelector.tsx:74` commits any typed
   string, so `Rich`, `rich ` and `Rcih` are three owners. Nothing anywhere rejects the third.
2. **A person cannot be renamed.** The name is copied into every row that mentions it. On the
   current board that is 12 task rows plus 3 sub-stage rows.
3. **A person cannot exist without work.** Bin their last task and they leave the picker.
4. **Assignment is stored up to three ways.** Measured against the dev database on 12 Oct 2026,
   "this is Rich's" is carried by `tasks.owner = 'Rich'`, by `tags: ["rich"]` (Backlog lane,
   sub-stage 2) and by `tags: ["rich-doing"]` (In Progress lane, sub-stage 3). Saying it fully
   means setting the field *and* dragging the card, and nothing enforces agreement between them.
5. **A consumer has to guess which lanes name people.** `shared/briefing.ts:518` builds
   `ownerLabels` from the distinct text owners and then tests `ownerLabels.has(swimlane)` to
   decide whether a lane is a person — so the lane `Rich` is only recognised as a person while
   somebody happens to own a task. `ownerConflict` (`briefing.ts:474`) is a report of the
   ambiguity this creates, not a fix for it.

**Current data (dev DB `kanban_local1_dev`, 12 Oct 2026).** 16 live tasks, 0 archived, 0 binned.
Owners: `Rich` ×9, `Moi` ×3, blank ×4. Seven sub-stages, of which three name a person —
`Rich` in Backlog (tag `rich`), `Rich` in In Progress (tag `rich-doing`), `Moi` in In Progress
(tag `moi`) — while `Unallocated`, `Waiting on others` and `Scheduled action | on track` do not.
`Cross check with Moi` mentions a person without being a person lane, which is exactly the case
any name-matching rule has to get right. The `tags` array mixes lane tags with genuine topic tags
(`solar`, `family`), so folding lanes into owners must not eat the topic tags.

**Zero tasks currently report `ownerConflict`** in dev. The one documented occurrence is #142
(`owner: "Moi"` in the `Rich` lane) against production data of 11 Aug 2026, recorded in
EPIC-03 §Context item 2. The defect being fixed here is therefore structural — the board permits
the contradiction and infers its way around it — not a present-tense outage.

**Relationship to EPIC-03.** This is EPIC-03 story 5, "resolve the owner/swimlane overlap into
one assignment field" (5 pts), pulled out and specified. EPIC-03 line 52 defers turning labels
into records to "EPIC-02: Identity & membership", which has never been written. That boundary is
hereby redrawn: **an owner is a label with an identity, not an account.** No email, no
credentials, no membership, no permissions — those stay EPIC-02's, and EPIC-02 shrinks to
authentication. EPIC-03 must be amended to say so (see §11).

## 3. In scope

- `owners` table; `tasks.owner_id` FK; `sub_stages.owner_id` FK.
- Owner CRUD in the existing Admin page, alongside the project, stage and sub-stage sections.
- Person-lane membership derived from `owner_id` instead of tag-string matching.
- Drag-and-drop into and out of a person lane writing `owner_id`.
- Owner picker reading the `owners` table, with free-text creation removed.
- Owner colour chip on the card and the preview pane; owner filter and owner sort on the board.
- Backfill with a written report of every row it changed.
- `tasks.owner` maintained as a mirror so `GET /api/export` and the daily-briefing agent keep
  reading the field they read today.

## 4. Out of scope (explicitly)

- **Authentication, accounts, sign-in, permissions** → EPIC-02, now reduced to that alone. An
  owner is still a label anyone can set; nothing here is an access boundary.
- **Tag-lane membership.** `Waiting on others` and `Scheduled action | on track` keep matching
  `tasks.tags` against `sub_stages.tag`. Giving every sub-stage a real foreign key is EPIC-03
  story 3 and stays there; this epic only fixes the lanes that name people.
- **Multiple owners per task.** One owner, as today. A task needing two people is two tasks or a
  parent with subtasks.
- **Owner inheritance for subtasks** — see Q5.
- **Retiring the `Unallocated` lane**, which becomes a second way to say "nobody" — see Q4.
- **Collapsing owner into project, or project into owner.** EPIC-01 settled that they are
  separate entities (a person works on several projects; a project has several people) and this
  epic does not reopen it. It does answer the question BACKLOG B-01 Q3 asks (see §11).
- **Any change to the board's visual design** beyond the owner chip gaining a colour.

## 5. Data model

```sql
-- New entity. Mirrors `projects` (migrations/0010_projects.sql) deliberately:
-- same shape, same nullability stance, same delete semantics.
CREATE TABLE owners (
  id         serial PRIMARY KEY,
  name       text NOT NULL,               -- <= OWNER_NAME_MAX_LEN (40)
  key        text,                        -- optional short code / initials, <= OWNER_KEY_MAX_LEN (4)
  color      text,                        -- hex; DEFAULT_OWNER_COLOR when unset
  archived   boolean NOT NULL DEFAULT false,
  "order"    integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Case-variant names are the duplicate-owner defect; the database refuses them.
CREATE UNIQUE INDEX owners_name_lower_uniq ON owners (lower(btrim(name)));

-- Assignment. Nullable on purpose: null is Unassigned, exactly as project_id
-- is nullable for "no project". Deleting an owner releases their tasks.
ALTER TABLE tasks      ADD COLUMN owner_id integer REFERENCES owners(id) ON DELETE SET NULL;
ALTER TABLE sub_stages ADD COLUMN owner_id integer REFERENCES owners(id) ON DELETE SET NULL;

CREATE INDEX tasks_owner_id_stage_id_idx ON tasks (owner_id, stage_id);

-- A stage may hold at most one lane per owner, or lane membership is ambiguous.
CREATE UNIQUE INDEX sub_stages_stage_owner_uniq
  ON sub_stages (stage_id, owner_id) WHERE owner_id IS NOT NULL;

-- `tasks.owner` survives as a mirror, not an input. It is widened from
-- varchar(15) to text because an owner name may now exceed 15 characters.
ALTER TABLE tasks ALTER COLUMN owner TYPE text;
```

**A sub-stage now has two kinds, discriminated by `owner_id`:**

| Kind | `owner_id` | Membership | Example (dev data) |
|---|---|---|---|
| Person lane | set | `task.owner_id = lane.owner_id AND task.stage_id = lane.stage_id` | sub-stages 2, 3, 4 |
| Tag lane | null | `task.tags` contains `lane.tag` (unchanged) | sub-stages 1, 5, 6, 7 |

**The mirror is trigger-maintained, not generated.** A Postgres generated column cannot read
another table, so `tasks.owner` is kept in step by two triggers: one on `tasks` before
insert/update, one on `owners` after a name change. This is the one piece of machinery the epic
adds that has no long-term home, and OWN-10 removes it.

**Constants** (`shared/constants.ts`, mirroring the `PROJECT_*` block):
`OWNER_NAME_MAX_LEN = 40`, `OWNER_KEY_MAX_LEN = 4`, `DEFAULT_OWNER_COLOR`. `TASK_OWNER_MAX_LEN`
(15) stops being a storage limit and becomes the card's display budget — above it, the chip
shows `key` (see Q2).

### Backfill algorithm (lane wins)

Run as one transaction, with a report written to `logs/` before commit:

1. **Create owner rows** from the case-folded union of distinct non-blank `tasks.owner` values
   and the cleaned names of person-named sub-stages. *Dev data → `Rich`, `Moi`.*
2. **Identify person lanes.** A sub-stage is a person lane when `cleanLabel(name)`
   (`briefing.ts:170`, which strips emoji and padding) equals an owner name, compared
   case-insensitively. *Dev data → sub-stages 2, 3, 4. `Cross check with Moi` does not match
   because the comparison is equality, not containment; `Unallocated` matches nothing.*
3. **Bind the lanes:** set `sub_stages.owner_id` for each lane from step 2.
4. **Assign tasks, lane first.** Where a task's `tags` contains the tag of a person lane in the
   task's own stage, `owner_id` is that lane's owner. Otherwise, where `tasks.owner` is non-blank,
   `owner_id` is the matching owner row. Otherwise null.
5. **Strip only lane tags.** Remove from `tasks.tags` exactly those values equal to the `tag` of a
   sub-stage bound to an owner. *Dev data → `rich`, `rich-doing`, `moi` go; `solar`, `family`,
   `unallocated`, `scheduled` stay.*
6. **Report every overwrite:** task id, previous `owner` string, assigned owner name, and the lane
   that decided it — for each row where step 4's lane answer differed from the text owner.

Expected dev-data outcome, to be asserted by the migration test: `Rich` 9 tasks, `Moi` 3,
Unassigned 4 — reconciling exactly to the pre-migration counts, with zero overwrites reported.

## 6. Requirements

EARS syntax. "The board" means the system as a whole where no narrower actor is named.

**Entity and its lifecycle**

- **OWN-R1** — The board shall store a task's assignment as a single `tasks.owner_id` foreign key
  to `owners.id`.
- **OWN-R2** — The owners API shall return every owner row, including an owner with no tasks.
- **OWN-R3** — If a task write names an owner with no `owners` row, then the API shall reject the
  write with HTTP 400 and name the unknown owner in the message.
- **OWN-R4** — If an owner create names an owner differing from an existing owner only by letter
  case or surrounding whitespace, then the API shall reject it with HTTP 409.
- **OWN-R5** — When an administrator renames an owner, the board shall show the new name on every
  task assigned to that owner without a further write per task.
- **OWN-R6** — When an administrator deletes an owner, the board shall set `owner_id` to null on
  every task assigned to that owner.
- **OWN-R7** — When an administrator deletes an owner, the board shall set `owner_id` to null on
  every sub-stage bound to that owner.
- **OWN-R8** — While an owner is archived, the owner picker shall omit that owner from its
  selectable list.
- **OWN-R9** — While an owner is archived, the board shall keep displaying that owner's name on
  tasks already assigned to them.
- **OWN-R10** — The owner picker shall offer only owners that exist as rows.

**The fold: lanes derived from owners**

- **OWN-R11** — A sub-stage whose `owner_id` is set shall contain exactly those tasks whose
  `owner_id` equals that value and whose `stage_id` equals the sub-stage's `stage_id`.
- **OWN-R12** — When a user drops a task on a sub-stage whose `owner_id` is set, the board shall
  set that task's `owner_id` to the sub-stage's `owner_id`.
- **OWN-R13** — While a stage holds a sub-stage bound to a task's owner, when a user drops that
  task on the stage's unlaned body, the board shall set the task's `owner_id` to null. *(Rule
  under confirmation — see Q1.)*
- **OWN-R14** — When a user moves a task to a stage holding a sub-stage bound to that task's
  owner, the board shall display the task within that sub-stage.
- **OWN-R15** — If a write would bind a second sub-stage within one stage to an owner already
  bound in that stage, then the API shall reject it with HTTP 409.
- **OWN-R16** — The board shall read no value from `tasks.tags` when determining membership of a
  sub-stage whose `owner_id` is set.

**Migration**

- **OWN-R17** — When the migration runs, it shall create one owner row for each distinct name in
  the case-folded union of non-blank `tasks.owner` values and cleaned person-lane names.
- **OWN-R18** — When the migration runs, it shall assign each task whose `tags` contain the tag of
  a person lane in the task's own stage to that lane's owner.
- **OWN-R19** — When the migration runs, it shall assign each remaining task having a non-blank
  `owner` string to the owner row whose name matches that string.
- **OWN-R20** — When the migration runs, it shall remove from `tasks.tags` only those values equal
  to the `tag` of a sub-stage bound to an owner.
- **OWN-R21** — When the migration assigns a task to an owner other than the one its `owner`
  string named, it shall record one report entry giving the task id, the previous name, the
  assigned name and the deciding lane.
- **OWN-R22** — If the migration cannot assign every task without ambiguity, then it shall roll
  back in full and exit non-zero.

**Consumers**

- **OWN-R23** — Where the legacy `owner` field is still published, the task API shall return it as
  the name of the task's owner.
- **OWN-R24** — When an owner's name changes, the board shall update the mirrored `tasks.owner`
  value on every task assigned to that owner.
- **OWN-R25** — The export briefing shall report `swimlane` for a person lane as that lane's
  owner's name.
- **OWN-R26** — The export briefing shall report `ownerConflict` as false for every task.
- **OWN-R27** — When an import names an owner that exists as a row, the importer shall assign the
  imported task to that owner.
- **OWN-R28** — If an import names an owner with no `owners` row, then the importer shall leave
  the imported task unassigned and list the unmatched name in its result summary.

**Presentation and accessibility** *(WCAG 2.1 AA, per docs/WAYS-OF-WORKING.md)*

- **OWN-R29** — The owner chip shall display text naming its owner.
- **OWN-R30** — While an owner's name is longer than `TASK_OWNER_MAX_LEN` characters, the owner
  chip shall display that owner's short code.
- **OWN-R31** — The owner chip's text shall meet a contrast ratio of at least 4.5:1 against the
  chip's background in both light and dark themes.
- **OWN-R32** — The board shall offer a filter that restricts visible tasks to one owner.
- **OWN-R33** — The board shall offer a sort that orders tasks by owner name.

## 7. Acceptance criteria

Scenarios carry concrete values from the 12 Oct 2026 dev board. Each names the requirements it
covers; §8 maps the rest.

```gherkin
Scenario: OWN-S1 — a typo can no longer invent a person        # OWN-R3, OWN-R10
  Given the owners are "Rich" and "Moi"
  When a user opens the owner picker and types "Rcih"
  Then no option to add "Rcih" is offered
  And the picker shows no match

Scenario: OWN-S2 — case variants are refused                   # OWN-R4
  Given an owner "Rich" exists
  When an administrator creates an owner named "  rich "
  Then the request is refused with status 409
  And the owners list still holds exactly one Rich

Scenario: OWN-S3 — one rename reaches 12 tasks and 3 lanes     # OWN-R5, OWN-R24
  Given owner "Rich" is assigned to 9 tasks and bound to the Backlog and In Progress "Rich" lanes
  When an administrator renames "Rich" to "Richard"
  Then all 9 task cards show "Richard"
  And both lane headers show "Richard"
  And the mirrored owner field on task 7 reads "Richard"

Scenario: OWN-S4 — an owner survives having no work            # OWN-R2
  Given owner "Moi" is assigned only to tasks 6, 13 and 15
  When all three tasks are moved to the Bin
  Then "Moi" still appears in the owner picker

Scenario: OWN-S5 — deleting an owner releases the work         # OWN-R6, OWN-R7
  Given owner "Moi" is assigned to 3 tasks and bound to the In Progress "Moi" lane
  When an administrator deletes "Moi"
  Then tasks 6, 13 and 15 are shown as Unassigned
  And none of the three tasks is archived or binned
  And the In Progress "Moi" lane is no longer bound to an owner

Scenario: OWN-S6 — an archived owner leaves the picker, not the cards   # OWN-R8, OWN-R9
  Given owner "Moi" is assigned to task 6
  When an administrator archives "Moi"
  Then the owner picker does not offer "Moi"
  And task 6 still shows "Moi"

Scenario: OWN-S7 — dropping into a person lane assigns it      # OWN-R12, OWN-R11
  Given task 6 "Cancel Albany Gym Membership" is owned by "Moi" and sits in the In Progress "Moi" lane
  When a user drags task 6 into the In Progress "Rich" lane
  Then task 6 is owned by "Rich"
  And task 6 is shown in the In Progress "Rich" lane
  And task 6's tags are unchanged

Scenario: OWN-S8 — a move follows its owner into the next stage # OWN-R14
  Given task 10 "Book dentist" is owned by "Rich" and sits in the Backlog "Rich" lane
  When a user drags task 10 into the In Progress column
  Then task 10 is shown in the In Progress "Rich" lane
  And task 10 is still owned by "Rich"

Scenario: OWN-S9 — unlaning clears the owner                   # OWN-R13
  Given task 10 "Book dentist" is owned by "Rich" and sits in the Backlog "Rich" lane
  When a user drops task 10 on the Backlog column outside any lane
  Then task 10 is Unassigned
  And task 10 is shown in the Backlog column outside any lane

Scenario: OWN-S10 — one owner, one lane per stage              # OWN-R15
  Given the Backlog stage holds a lane bound to "Rich"
  When an administrator binds a second Backlog lane to "Rich"
  Then the request is refused with status 409

Scenario: OWN-S11 — the backfill reconciles and keeps topic tags  # OWN-R17..R21
  Given the board holds 16 live tasks with owners Rich ×9, Moi ×3 and blank ×4
  And sub-stages 2, 3 and 4 are named "Rich", "Rich" and "Moi"
  And task 4 "Call back Solar Guy" has tags ["solar"] and task 8 has tags ["rich", "family"]
  When the migration runs
  Then 9 tasks are owned by "Rich", 3 by "Moi" and 4 are Unassigned
  And task 4 still has tags ["solar"]
  And task 8 has tags ["family"]
  And sub-stages 1, 5, 6 and 7 are bound to no owner
  And the report lists 0 overwrites

Scenario: OWN-S12 — the lane wins a disagreement, visibly      # OWN-R18, OWN-R21
  Given task 142 has owner "Moi" and tags ["rich"] in a stage whose "Rich" lane carries tag "rich"
  When the migration runs
  Then task 142 is owned by "Rich"
  And the report names task 142, previous "Moi", assigned "Rich", deciding lane "Rich"

Scenario: OWN-S13 — an ambiguous board stops the migration     # OWN-R22
  Given a stage holds two lanes both named "Rich"
  When the migration runs
  Then no owners rows are committed
  And the migration exits non-zero naming the two lane ids

Scenario: OWN-S14 — the briefing agent reads what it read before  # OWN-R23, OWN-R25, OWN-R26
  Given task 5 is owned by "Rich" and sits in the In Progress "Rich" lane
  When a consumer requests GET /api/export
  Then the task's owner field reads "Rich"
  And the entry's swimlane reads "Rich"
  And the entry's ownerConflict is false

Scenario: OWN-S15 — an import of an older export               # OWN-R27, OWN-R28
  Given an export file assigns "Rich" to one task and "Rcih" to another
  And owners "Rich" and "Moi" exist
  When the file is imported
  Then the first task is owned by "Rich"
  And the second task is Unassigned
  And the import summary names "Rcih" as unmatched

Scenario: OWN-S16 — the chip does not rely on colour           # OWN-R29, OWN-R30
  Given owner "Richard" has colour #2563EB and short code "RC"
  When a user views a card owned by "Richard"
  Then the chip shows the text "Richard"
  And when "Richard" is renamed to "Richard Clark-Donaldson", 24 characters
  Then the chip shows the text "RC"

Scenario: OWN-S17 — filter and sort by owner                   # OWN-R32, OWN-R33
  Given the board shows 16 tasks across owners Rich, Moi and Unassigned
  When a user filters to owner "Moi"
  Then exactly 3 tasks are shown
  And when the filter is cleared and the board is sorted by owner
  Then Moi's tasks precede Rich's, and Unassigned tasks sort last
```

## 8. Traceability

| Requirement | Story | Verified by |
|---|---|---|
| OWN-R1, R2 | OWN-01, OWN-02 | OWN-S4; schema inspection of the FK |
| OWN-R3, R4, R10 | OWN-01, OWN-03 | OWN-S1, OWN-S2 |
| OWN-R5, R24 | OWN-01, OWN-02 | OWN-S3 |
| OWN-R6, R7 | OWN-01, OWN-04 | OWN-S5 |
| OWN-R8, R9 | OWN-01, OWN-03 | OWN-S6 |
| OWN-R11, R12, R16 | OWN-05, OWN-06 | OWN-S7; unit test asserting tags are not read for a person lane |
| OWN-R13 | OWN-06 | OWN-S9 |
| OWN-R14 | OWN-05 | OWN-S8 |
| OWN-R15 | OWN-04 | OWN-S10 |
| OWN-R17–R21 | OWN-02, OWN-05 | OWN-S11, OWN-S12 |
| OWN-R22 | OWN-02 | OWN-S13 |
| OWN-R23, R25, R26 | OWN-07 | OWN-S14 |
| OWN-R27, R28 | OWN-09 | OWN-S15 |
| OWN-R29, R30 | OWN-08 | OWN-S16 |
| OWN-R31 | OWN-08 | Automated contrast check in both themes — no scenario; inspection requirement |
| OWN-R32, R33 | OWN-08 | OWN-S17 |

Coverage holes, stated rather than hidden: **OWN-R31** is verified by measurement, not by a
Given/When/Then. Every other requirement has at least one scenario, and every scenario names at
least one requirement.

## 9. User stories

Sizes: **S** ≈ ≤1 h · **M** ≈ half-day · **L** ≈ 1 day. Points follow the house scale.

| # | Story | Size | Pts |
|---|---|---|---|
| OWN-01 | `owners` table, CRUD API, and an Admin Owners section beside Projects | L | 5 |
| OWN-02 | `tasks.owner_id` + backfill + mirror triggers, with a report | L | 5 |
| OWN-03 | Owner picker reads the `owners` table; free-text creation removed | M | 3 |
| OWN-04 | `sub_stages.owner_id`; person lanes bound in Admin; one lane per owner per stage | M | 3 |
| OWN-05 | Person-lane membership derived from `owner_id`; lane tags stripped | L | 5 |
| OWN-06 | Drag into and out of a person lane writes `owner_id` | M | 3 |
| OWN-07 | Export and briefing: swimlane from the owner; `ownerConflict` pinned false; heuristic deleted | M | 2 |
| OWN-08 | Owner chip with colour and short code; owner filter and owner sort | M | 3 |
| OWN-09 | Importer resolves owners by name; email and share helpers read the owner name | S | 1 |
| OWN-10 | *(separate release)* Drop `tasks.owner`, its triggers, and `GET /api/tasks/owners` | S | 1 |

### OWN-05 — the story that carries the epic

**As** someone reading the board
**I want** the person lane and the owner field to be the same fact
**So that** a card cannot sit in Rich's lane while saying it belongs to Moi

- **Given** a sub-stage bound to owner `Rich`, **when** the board renders, **then** it contains
  exactly the tasks in that stage owned by `Rich`, and no value in `tasks.tags` affects which
  tasks those are.
- **Given** task 8 with tags `["rich", "family"]`, **when** the migration has run, **then** its
  tags are `["family"]` and it is owned by `Rich`.
- **Given** a stage with no lane for a task's owner, **when** the board renders, **then** the task
  appears in the stage body as it does today, and its owner is unchanged.
- **Given** a tag lane (`Scheduled action | on track`, tag `scheduled`), **when** a task is
  dropped on it, **then** the tag is written as it is today and the task's owner is unchanged.
- **Given** the `Unallocated` lane, which is bound to no owner, **when** the board renders,
  **then** it keeps its current tag-matching behaviour.

### OWN-02 — acceptance criteria

- **Given** the 16-task dev board, **when** the migration runs, **then** per-owner task counts
  reconcile exactly to the pre-migration counts (Rich 9, Moi 3, Unassigned 4).
- **Given** a successful migration, **when** the down script runs, **then** `tasks.owner` holds
  the same strings it held before, and `owner_id` is gone.
- **Given** any failure during backfill, **when** the transaction ends, **then** nothing is
  committed and the exit code is non-zero.
- The report is written before commit and names every overwritten row.

### OWN-07 — acceptance criteria

- `ownerLabels` and `swimlaneNamesPerson` are deleted from `shared/briefing.ts`, not left
  returning false.
- `BriefingEntry` keeps every field it publishes today, including `ownerConflict`, which is
  documented as deprecated and always false.
- Existing `shared/briefing.test.ts` expectations for `swimlane` and `owner` still pass, amended
  only where a fixture's assignment now comes from `owner_id`.

## 10. Non-functional requirements

- Board read for 1,000 tasks across 5 owners returns within 300 ms p95 with
  `tasks_owner_id_stage_id_idx` in place — the ceiling EPIC-01 set for the scoped board read.
- Zero data loss: post-migration per-owner counts reconcile to pre-migration counts, asserted in
  an integration test against a seeded copy of the dev board.
- The migration is reversible: a down script restores `tasks.owner` from the mirror and drops
  `owner_id`.
- `GET /api/export` keeps every field it publishes today for at least one release after OWN-07.
- `owners.name` is unique case-insensitively at the database level, not only in the API.
- Owner colour meets WCAG 2.1 AA contrast in light and dark themes (OWN-R31).

## 11. Documents this epic amends

Per `docs/WAYS-OF-WORKING.md`, nothing may exist in two places with two meanings:

1. **`docs/epics/EPIC-03-task-data-integrity.md` line 52** — "This epic normalises `owner` into
   one namespace but keeps it a free-form label; turning labels into user records is EPIC-02's
   job." Amend: owner records are EPIC-06's; EPIC-02 reduces to authentication.
2. **EPIC-03 story 5** ("Resolve the owner/swimlane overlap into one assignment field", 5 pts) —
   mark delegated to EPIC-06 and deduct from EPIC-03's total.
3. **EPIC-03 finding 3** (sub-stage membership has no foreign key) — note that EPIC-06 fixes it
   for person lanes; tag lanes remain EPIC-03 story 3.
4. **`docs/BACKLOG.md` B-01 question 3** (owner-as-project) — answered: they stay separate
   entities, per EPIC-01's implementation note, and owner becomes an entity in its own right.
5. **`docs/BACKLOG.md` B-04** — the owner sort excluded from sorting phase 1 lands here as
   OWN-08, no longer waiting on EPIC-03.
6. **`docs/BACKLOG.md` B-10** — the `@owner` mention risk ("a third namespace inside description
   HTML") changes shape: after this epic there is one namespace with stable ids to mention.
7. **`ARCHITECTURE.md`** — table list gains `owners`.

## 12. Metrics

| # | Measure | Today (12 Oct 2026) | Target | How we'll see it |
|---|---|---|---|---|
| 1 | Distinct owner values not backed by an owners row | 2 of 2 (100%) | 0 | `SELECT` for `owner_id IS NULL AND owner <> ''` |
| 2 | Stored facts needed to say "this is Rich's" | 3 (`owner`, tag `rich`, tag `rich-doing`) | 1 | Schema inspection |
| 3 | Rows written to rename one person | 15 (12 tasks + 3 lanes) | 1 | OWN-S3 |
| 4 | Tasks able to report `ownerConflict` | any (1 of 22 observed, 11 Aug 2026) | 0 by construction | OWN-S14; heuristic deleted |
| 5 | Owners able to exist with zero tasks | 0 | unbounded | OWN-S4 |
| 6 | Lines of lane-names-a-person inference in `shared/briefing.ts` | 2 constructs (`ownerLabels`, `swimlaneNamesPerson`) | 0 | Code review of OWN-07 |
| 7 | Board p95 render time | current | no regression | Existing measurement |

## 13. Risks and assumptions

- **R1 — the mirror drifts.** Two triggers maintaining a denormalised copy is exactly the class of
  thing that goes stale. *Mitigation:* an integration test asserts `tasks.owner` equals the
  owner's name after an insert, an update, a rename and a delete; OWN-10 removes the mirror in the
  release after.
- **R2 — the owners table invites identity creep.** The next request after "owners have colours"
  is "owners have email addresses", and that is EPIC-02 arriving through the back door.
  *Mitigation:* the table carries no contact or credential field, and §4 says so.
- **R3 — the tag strip eats topic tags.** `tags` holds lane tags and topic tags in one array.
  *Mitigation:* OWN-R20 removes only exact matches of a bound lane's tag; OWN-S11 asserts `solar`
  and `family` survive.
- **R4 — this dev database is behind.** `kanban_local1_dev` has no `projects` table, so
  `migrations/0010_projects.sql` has not been applied there. *Mitigation:* the owner migration
  verifies the journal is current before it runs, and refuses otherwise.
- **R5 — a real name exceeds the card's 15-character budget.** Today the cap is storage; after
  this, names up to 40 characters can be stored and the card must cope. *Mitigation:* the chip
  falls back to `key`; see Q2.
- **R6 — "Moi" is not a person's name.** The existing labels are household shorthand, so the
  owners table may be seeded with names nobody intends to keep. *Accepted:* renaming is now one
  write, which is the point.
- **A1 — a person lane is one whose cleaned name equals an owner name.** *Invalidated if* a lane
  names someone by a different label than the owner string (a `R.` lane for `Rich`). The step-6
  report exposes it, and such a lane is bound by hand in Admin.
- **A2 — no authentication arrives during this epic.** Owners stay labels; nothing here is an
  access boundary.
- **A3 — the production board resembles dev in size** (16–22 tasks, 2 owners, ≤4 person lanes),
  so the backfill runs as a single transaction without batching.
- **A4 — one owner per task is the whole model.** *Invalidated if* shared work needs two names on
  one task, at which point the foreign key becomes a join table and this model is the wrong one.

## 14. Dependencies and sequencing

- OWN-01 blocks everything. OWN-02 blocks OWN-03 and OWN-05.
- OWN-04 blocks OWN-05, which blocks OWN-06.
- OWN-07, OWN-08 and OWN-09 depend on OWN-02 and can run in parallel after it.
- **OWN-10 ships in a separate release**, after at least one release of the mirror, and is gated
  on Q7 (whether the daily-briefing agent still reads `GET /api/tasks/owners`).
- No dependency on EPIC-03's remaining stories, and none on EPIC-02. EPIC-03 story 5 is delegated
  here rather than waiting.

## 15. Definition of Done (epic)

- Migration applied and reversible; `tasks.owner_id` and `sub_stages.owner_id` in place with FK
  and indexes; case-insensitive unique name index enforced by the database.
- The backfill report is committed to the repo as the record of what the migration decided.
- No code path creates an owner from free text.
- Person-lane membership reads `owner_id` and reads nothing from `tasks.tags`.
- `ownerLabels`/`swimlaneNamesPerson` deleted from `shared/briefing.ts`; `GET /api/export`
  unchanged in shape.
- Unit and integration tests for the CRUD, the backfill, the lane derivation, the drag rules and
  the mirror triggers; existing suite green.
- `ARCHITECTURE.md`, `CHANGELOG.md`, EPIC-03 and `docs/BACKLOG.md` updated per §11.
- Demonstrated with ≥3 owners, ≥2 person lanes in different stages, and one rename propagating.

## 16. Open questions for refinement

| # | Question | Why it matters | Who decides | Blocking |
|---|---|---|---|---|
| Q1 | Should dropping a task on a stage's unlaned body clear its owner (OWN-R13), or leave the owner and let the card snap back into its lane? | It is the only way to unassign by dragging; the alternative makes the drop a no-op the user cannot see the result of | Product owner | OWN-06 |
| Q2 | `OWNER_NAME_MAX_LEN = 40` with the chip falling back to `key` above 15 characters — right numbers? | Today's 15-char cap exists for card space; storage and display are now separable | Product owner | OWN-01, OWN-08 |
| Q3 | Does EPIC-02 reduce to authentication alone, as §2 and §11 assert? | EPIC-02 is unwritten; this epic takes a slice of what it was reserving | Product owner | No — amend EPIC-03 either way |
| Q4 | Retire the `Unallocated` lane now that `owner_id IS NULL` means Unassigned? | Two ways to say "nobody" is the same defect this epic removes, one level down | Product owner | No — OWN-05 leaves it working |
| Q5 | Should a subtask inherit its parent's owner on create? | EPIC-01 answered "no inheritance" for projects; consistency argues the same, usefulness argues the opposite | Product owner | No |
| Q6 | Does this close BACKLOG B-01 Q3, or does the audit still want to look? | B-01 is the next item in *Now* and lists owner-as-project as an output | Product owner | No |
| Q7 | Keep `GET /api/tasks/owners` beyond one release? | The daily-briefing agent is an outside consumer whose code is not in this repo | Whoever runs the agent | OWN-10 |

## 17. Implementation cost estimate (agent-assisted)

31 points across 10 stories, 30 of them in the main release (OWN-10 ships later, on its own). The backfill (OWN-02) and the lane
derivation (OWN-05) carry the risk; everything else mirrors a pattern already in the repo —
`projects` for the entity and its Admin section, `ProjectChip` for the card chip, and
`project_id` for the nullable FK with `ON DELETE SET NULL`.
