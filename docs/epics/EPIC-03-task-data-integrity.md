# EPIC-03: One authoritative state per task

**Epic type:** Enabler
**Status:** Ready for refinement
**Owner:** Platform
**Target:** 2–3 sprints (≈34 pts)

## Epic hypothesis statement

> **For** every consumer of the board's data — the UI, the export API, the daily-briefing agent, and the importer —
> **who** today each reconstruct "what state is this task in, and whose is it?" from a different combination of fields and get different answers,
> **the** task data layer **is a** set of typed columns and real foreign keys with exactly one source of truth per fact
> **that** makes state, assignment, and urgency the same for every reader without inference.
> **Unlike** the current approach of adding a derived projection per consumer, which multiplies the number of places the reconciliation logic can drift,
> **our solution** removes the ambiguity at the storage layer so there is nothing left to reconcile.
>
> **We will know we are right when** zero tasks report a `statusConflict` or `ownerConflict` in the export briefing, `tags` is never null, and the full-board export fits in under 50 KB.

## Context / problem

A daily-briefing agent consuming `GET /api/export` silently dropped task **#142** ("Check remaining gas") — overdue by 2 days and sitting in an In Progress column — from its report. The immediate cause was that nothing in the payload said "overdue" and the only ranking-shaped field, `priority`, was `normal` while every other in-progress task was `high`.

**That symptom is already fixed.** `shared/briefing.ts` now emits a per-task `urgency` block and a pre-bucketed `briefing` digest, both cut against `exportedAt` with the timezone and overdue rule declared inline. #142 now ranks 1 with `mustSurface: true`.

But that fix is a _projection over ambiguous storage_. It works by choosing a winner every time two fields disagree, and it reports the disagreements it papered over. Against production data (22 tasks, 11 Aug 2026) the projection had to make these calls:

1. **`status` and `stage_id` are two contradictory state machines.** Three of 22 tasks disagree: #126 is `status: in_progress` but sits in Backlog; #128 and #139 are `status: backlog` but sit in Waiting. The `status` enum has no value that can represent the Waiting column at all, so `getStatusFromStageName('Waiting ✋️ ')` folds it to `backlog`. The UI renders by `stage_id`; an agent filtering `status == 'in_progress'` gets a different set.
2. **Assignment lives in two namespaces that contradict each other.** #142 has `owner: "Moi"` but sits in the **Rich** swimlane, because swimlane membership is encoded in `tags`, not `owner`. A per-person briefing attributes it to the wrong human.
3. **Sub-stage membership has no foreign key.** It is a string match of `tasks.tags[]` against `sub_stages.tag`, which is only unique _within a stage_ — tag `"Rich"` exists on stage 2 and means nothing on stage 1. Tag `"Status"` resolves to a sub-stage actually named "Scheduled Action | On Track", so the stored token carries none of the meaning.
4. **`tags` is tri-state.** 11 tasks store `null`, 3 store `[]`, 8 store an array — and the flattened tag set contains `null` entries. `task.tags.includes(x)` throws on half the board.
5. **Stage display names are load-bearing.** `getStatusFromStageName` substring-matches user-editable names to infer status. Renaming a column silently changes task semantics. Names also carry emoji and stray whitespace (`"Waiting ✋️ "`, `"Done  ✔"`), and stages 2 and 4 both have `order: 2`, so column order is non-deterministic.
6. **`due_date` is a date wearing a timestamp's clothes.** Every value is noon UTC — a date, stored as an instant. Nothing in the schema or payload declares a timezone, so "is this overdue?" has a different answer in UTC than in `Pacific/Auckland`. The board cuts days in server-local time; that was an undocumented convention until the export started declaring it.
7. **Descriptions carry base64 blobs inline.** Two tasks (#146 at 340 KB, #122 at 193 KB) account for **533 KB of the 547 KB payload — 97.4%**. Both are embedded `data:image/*;base64` URIs inside HTML in a `text` column. The whole rest of the board is 12.7 KB. Every consumer pays this cost on every read, and any upstream truncation cuts real tasks first.

**Design principle for this epic — one fact, one column.** Where two fields can disagree, delete one or make the other derived-and-generated. Where a relationship exists, use a foreign key. Where a value has a type, store that type. No story in this epic adds a new derived field to compensate for an ambiguous one; that is what we are removing.

## In scope

- Collapse `status` / `stage_id` to a single stored state, with stage-kind classification that does not depend on display names.
- `tasks.sub_stage_id` FK replacing tag-string matching for swimlane membership.
- `tags` normalisation: `NOT NULL DEFAULT '[]'`, no null elements.
- Assignment as one field, with the swimlane/owner overlap resolved.
- `due_date` typed as a date with an explicit board timezone setting.
- Attachment extraction: base64 blobs out of `description`, plus a plain-text projection.
- Stage `order` uniqueness and a `kind` discriminator.
- Task permalinks and richer history.

## Out of scope (explicitly)

- Project scoping → **EPIC-01**.
- Authentication and a real `users` table → **EPIC-02: Identity & membership**. This epic normalises `owner` into one namespace but keeps it a free-form label; turning labels into user records is EPIC-02's job.
- Changing the briefing digest's shape or ranking rules. `shared/briefing.ts` is the consumer contract and stays stable; it simply stops having conflicts to report.
- Recurrence as a working feature. `recurrence` is uniformly `'none'` across all 22 tasks; this epic leaves the column alone (see open question 3).
- Any change to the board's visual design.

## Proposed data model change

```sql
-- 1. Stage kind: classification stops depending on the editable display name.
ALTER TABLE stages ADD COLUMN kind text NOT NULL DEFAULT 'backlog';
--   kind ∈ ('backlog','in_progress','waiting','done','abandoned')
ALTER TABLE stages ADD CONSTRAINT stages_order_unique UNIQUE ("order");

-- 2. Single state. `tasks.status` becomes derived from the task's stage.
--    Expand/contract: backfill from stage_id, then drop the column.
ALTER TABLE tasks DROP COLUMN status;

-- 3. Real sub-stage membership.
ALTER TABLE tasks ADD COLUMN sub_stage_id integer REFERENCES sub_stages(id);

-- 4. Tags always an array, never null, no null elements.
UPDATE tasks SET tags = '[]'::jsonb WHERE tags IS NULL;
ALTER TABLE tasks ALTER COLUMN tags SET DEFAULT '[]'::jsonb;
ALTER TABLE tasks ALTER COLUMN tags SET NOT NULL;

-- 5. Due dates are dates. Board timezone is configuration, not convention.
ALTER TABLE tasks ALTER COLUMN due_date TYPE date USING (due_date AT TIME ZONE 'UTC')::date;
-- new: board_settings(timezone text NOT NULL DEFAULT 'Pacific/Auckland')

-- 6. Attachments leave the description body.
-- new: task_attachments(id, task_id FK, filename, mime_type, byte_size, storage_key, created_at)
ALTER TABLE tasks ADD COLUMN description_text text;  -- generated plain-text projection
```

Each change ships expand → backfill → contract so no deploy has a broken window. Story 2 is the only one that drops a column and must land a release after its backfill.

## User stories

| #   | Story                                                                                        | Pts |
| --- | -------------------------------------------------------------------------------------------- | --- |
| 1   | Add `stages.kind` + backfill from current names; replace name-substring inference (enabler)  | 5   |
| 2   | Collapse `tasks.status` into stage-derived state; reconcile the 3 conflicting rows (enabler) | 5   |
| 3   | Add `tasks.sub_stage_id` FK; backfill from tag matching; writers set it (enabler)            | 5   |
| 4   | Make `tags` `NOT NULL DEFAULT '[]'` and strip null elements (enabler)                        | 2   |
| 5   | Resolve the owner/swimlane overlap into one assignment field                                 | 5   |
| 6   | Type `due_date` as a date; add a board timezone setting surfaced in Admin                    | 3   |
| 7   | Extract base64 attachments out of `description` into `task_attachments`                      | 5   |
| 8   | Add `description_text` plain-text projection; export omits raw HTML by default               | 3   |
| 9   | Enforce unique `stages.order`; normalise emoji/whitespace in stage labels                    | 2   |
| 10  | Add a stable task permalink to the export                                                    | 1   |
| 11  | Extend `history` to record field-level changes and time-in-stage                             | 3   |

### Story 2 (the one that carries the epic) — acceptance criteria

- **Given** a task whose stored `status` disagreed with its stage, **when** the migration runs, **then** its state matches the column the board renders it in, and the pre-migration value is recorded in `history`.
- **Given** any task, **when** the export is built, **then** `briefing.*[].statusConflict` is `false` for every entry.
- **Given** a task is dragged to the Waiting column, **when** the export is read, **then** its state is `waiting` — a value the old `status` enum could not express.
- **Given** an import file written before this epic, **when** it is imported, **then** a legacy `status` field is accepted and mapped to a stage, or defaulted, without error.
- No consumer reads `getStatusFromStageName` after this story; the function is deleted.

### Story 5 — acceptance criteria

- **Given** task #142 (`owner: "Moi"`, Rich swimlane), **when** an operator opens it, **then** they are prompted once to pick the authoritative assignee, and the choice is stored in one field.
- **Given** any task, **when** the export is built, **then** `briefing.*[].ownerConflict` is `false` for every entry.
- **Given** a sub-stage that names a person, **when** a task is moved into it, **then** the assignment field updates — a card cannot sit in the "Rich" lane while assigned to someone else.
- **Given** a sub-stage that names a status (e.g. "Scheduled Action | On Track"), **when** a task is moved into it, **then** the assignment field is unchanged.

### Story 7 — acceptance criteria

- **Given** #146 and #122, **when** the migration runs, **then** their embedded base64 URIs are stored as `task_attachments` rows and the description references them by id.
- **Given** the full board, **when** `GET /api/export` is called, **then** the response is **under 50 KB** (from 547 KB) and no task loses content a user can see in the editor.
- **Given** a user pastes an image into the task editor, **when** the task is saved, **then** the image lands in `task_attachments`, not inline in the description body.
- Round-trip: export → import reproduces every attachment.

## Non-functional requirements

- Full-board export ≤ 50 KB and ≤ 150 ms p95 with 1,000 tasks.
- Zero data loss: post-migration task count, attachment count, and rendered description content reconcile to pre-migration values.
- Export stays additive for one release — `formatVersion` bumps to `2` only when `tasks.status` is dropped (story 2), which is the first genuinely breaking change.
- `shared/briefing.ts` output shape is unchanged throughout; only the values of the `*Conflict` flags change.

## Metrics

| Metric                                     | Baseline (11 Aug 2026) | Target  |
| ------------------------------------------ | ---------------------- | ------- |
| Tasks with `statusConflict`                | 3 / 22                 | 0       |
| Tasks with `ownerConflict`                 | 1 / 22                 | 0       |
| Tasks with null `tags`                     | 11 / 22                | 0       |
| Export payload size (22 tasks)             | 547 KB                 | < 50 KB |
| Payload bytes that are base64              | 97.4%                  | 0%      |
| Consumers inferring state from stage names | 3                      | 0       |

## Risks & assumptions

- **R1 — dropping `tasks.status` breaks an unknown consumer.** The briefing agent, the importer, and any saved export file all read it. _Mitigation:_ ship story 2's read path a release ahead of the column drop; keep the importer accepting a legacy `status` key permanently.
- **R2 — the owner/swimlane merge is a data decision, not a code one.** Only a human knows whether #142 belongs to Moi or Rich. _Mitigation:_ story 5 ships a one-time reconciliation prompt rather than guessing; the migration must not silently pick a side.
- **R3 — `date` conversion shifts due dates by a day.** Every current value is noon UTC, which is the _next_ calendar day in NZ. _Mitigation:_ convert via `AT TIME ZONE 'UTC'` and assert against a snapshot of the board's own overdue highlight before and after; #142 must stay 2 days overdue and #150 must stay due-today.
- **R4 — attachment extraction loses content in hand-authored HTML.** _Mitigation:_ dry-run the extractor over a production dump and diff rendered output before writing.
- **A1 — `stages.kind` is genuinely knowable for the four existing stages.** If a stage is ambiguous, story 1 fails and we need an explicit admin choice at migration time rather than a backfill.

## Dependencies

- Story 1 blocks 2 and 9. Story 3 blocks 5. Stories 7 and 8 pair and should ship together.
- Independent of EPIC-01; if both are in flight, story 2's migration and EPIC-01's `project_id` backfill should not share a release.

## Definition of Done (epic)

- All migrations applied and reversible; every FK enforced at the DB level.
- `briefing.overdue`, `dueToday`, `inProgress`, and `blocked` report zero conflicts on production data.
- `getStatusFromStageName` and tag-string swimlane matching are deleted, not merely unused.
- Export under 50 KB for the current board, verified against a live payload.
- Unit + integration tests for every migration backfill; existing suite green.
- `ARCHITECTURE.md`, `CHANGELOG.md`, and the export's `formatVersion` doc comment updated.

## Open questions for refinement

1. Should `stages.kind` be admin-editable, or fixed per stage at creation? _Recommendation:_ editable, since a rename today already changes behaviour — this just makes it deliberate and visible.
2. Should a person-named sub-stage and the assignment field be the _same_ concept (a lane **is** the assignee) rather than two synced fields? _Recommendation:_ yes for stage 2's lanes; it deletes the conflict class outright rather than keeping it in sync.
3. `recurrence` is `'none'` on all 22 tasks — is it an unfinished feature or dead weight? If dead, drop the column in this epic; if unfinished, it needs its own epic before it can be relied on.
4. Should the export offer `?include=descriptions` for the raw HTML, or should heavy bodies always be fetched per-task? _Recommendation:_ per-task, so the default board read has no large-payload path at all.
