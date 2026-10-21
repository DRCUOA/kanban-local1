# Change control register

**Status:** Live — the record of every change merged to `main`, one row per pull request
**Established:** 21 October 2026, backfilled to PR #131 (12 Oct 2026), the first merge after
the last docs consolidation (`docs/BACKLOG.md`, amended 12–13 Oct)
**Convention:** the PR number is the change id. Nothing gets a second id, so a row, a commit
and a PR can never name one change two ways.

## What this is for

`CHANGELOG.md` says what changed for someone using the board or its API. This register says
how each change reached `main`: what authorised it, what it did to the schema, what has to
happen at deploy for it to work, and what its own PR said was left unchecked. Those are the
questions asked when something breaks after a deploy, and until this file existed the answers
were spread across the PR descriptions.

Rules:

1. **Every PR adds its row in the same PR**, the way it adds its `CHANGELOG.md` entry (a
   docs-only PR has a row and no changelog entry). A PR with no row is not finished.
2. **Rows are append-only.** When a later change reverses or repairs an earlier one, it gets
   its own row naming the one it supersedes; the earlier row is not edited. The reasoning is
   the ADR rule in `docs/WAYS-OF-WORKING.md`.
3. **Authority names the backlog item or epic that asked for the change.** "Not on backlog" is
   a valid answer and is written down rather than left blank. A run of them is the signal that
   `docs/BACKLOG.md` needs consolidating.
4. **Carried items stay open until a row closes them.** The *Carried* table is the only
   mutable part of this file.

## Register

Merged dates are `Pacific/Auckland`. A row written in its own PR carries the day the PR was
opened, since its merge date is not yet known. Schema names the migration file under
`migrations/`.

| PR | Merged | Type | Change | Authority | Schema | Deploy action |
|---|---|---|---|---|---|---|
| #131 | 12 Oct | feat | Owner becomes an entity: `owners` table, `tasks.owner_id`, person lanes bound to owners. Header warning pills filter the board. Restyle off neumorphism onto the Clinical register; TK Workflow IT credit | Owner: EPIC-06 / B-11. Pills, restyle: not on backlog | `0013_owners` (backfill, `owner_backfill_report`) | — |
| #132 | 12 Oct | fix | Admin project row's badges stay on one line (`<div>`, not `<p>`) | Not on backlog (defect) | — | — |
| #133 | 13 Oct | docs | EPIC-05 Task dependencies, v0.1 framing | EPIC-05 | — | — |
| #134 | 13 Oct | feat | One authoritative state per task: `stages.kind`, `tasks.status` dropped, export `formatVersion` 2 | EPIC-03 stories 1–2 / B-05 | `0014_stage_kind`, `0015_drop_task_status` (both with backfill reports) | Export consumers: `tasks[].status` is gone |
| #135 | 14 Oct | fix | Summary-circle hover preview no longer covers drop targets during a drag | Not on backlog (defect) | — | — |
| #136 | 16 Oct | feat | Optional task type: `goal` or `building-block` | Not on backlog | `0016_task_type` | — |
| #137 | 16 Oct | feat | Goal link (`tasks.goal_task_id`) and predecessor/successor dependencies (`task_dependencies`, acyclic by trigger). Merged into the stacked `feat/epic-03-one-state-per-task` branch; reached `main` through #139 | EPIC-05, built ahead of its B-01 gate at the owner's direction (epic header note) | `0017_task_goal_link`, `0018_task_dependencies` | — |
| #138 | 16 Oct | feat | A building-block must share its goal's project (DB trigger, mirrored for a 400) | Not on backlog | `0019_goal_project_consistency` | — |
| #139 | 16 Oct | merge | Lands #137 on `main`; no change of its own | As #137 | As #137 | — |
| #140 | 16 Oct | feat | Read-only strip naming what is narrowing the board (`describeActiveFilters`) | Not on backlog | — | — |
| #141 | 16 Oct | feat | A dependency must join two tasks in the same project (DB trigger, mirrored for a 400) | EPIC-05 | `0020_dependency_same_project` | — |
| #142 | 16 Oct | fix | Predecessor/successor picker scrolls inside the edit dialog | Not on backlog (defect) | — | — |
| #143 | 16 Oct | feat | Project goals view, goal view, critical path and Gantt chart (`shared/schedule.ts`, `shared/goal-view.ts`) | Not on backlog. EPIC-05 §6 lists critical path, slack and Gantt as **non-goals** | — | — |
| #144 | 16 Oct | feat | "Make this a goal": AI plans a goal into editable building-blocks; Admin AI settings with the key encrypted at rest | Not on backlog | `0021_app_settings` | `SETTINGS_SECRET` (optional from #145) |
| #145 | 16 Oct | fix | GPT-5+ model picker, Responses API, key checked against OpenAI and set in the UI | Not on backlog (follow-up to #144) | — | — |
| #146 | 16 Oct | feat | Access gate: per-browser access codes, export tokens, developer console at `/console` | Not on backlog | `0022_access_devices` | **Required.** `CODE_HASH_KEY` (32+) and `DEVELOPER_SECRET` (16+), or production will not start. Issue an access code per browser. Issue an export token for the briefing agent, whose `GET /api/export` answers 401 until it sends one |
| #147 | 16 Oct | feat | Predecessor/successor pickers disabled when the task is a goal (UI only) | Not on backlog | — | — |
| #148 | 16 Oct | feat | Starts-after markers, critical-path network diagram, plan write-up under both views (`shared/plan-summary.ts`) | Not on backlog. EPIC-05 §6 non-goals, as #143 | — | — |
| #149 | 16 Oct | fix | Start-up error names which access setting is missing, empty or too short | Not on backlog (fault after #146) | — | — |
| #150 | 16 Oct | feat | Drag to select, "Edit together" (`POST /api/tasks/bulk-update`), goal filter | Not on backlog | — | — |
| #151 | 16 Oct | feat | "Help me on the how" and "Help me on the who and where" (OpenAI web search) in the goal planner; LangChain replaced by the OpenAI SDK for this call | Not on backlog | — | — |
| #152 | 16 Oct | fix | Phone UI decluttered: tablet layouts moved to `lg`, 44px touch targets, Admin stage and sub-stage deletes confirm | Not on backlog | — | — |
| #154 | 19 Oct | fix | Dictation stops when its field loses focus or the page is hidden | Issue #153 | — | — |
| #155 | 20 Oct | feat | Phone top bar is the project selector; Goals and More move to the nav; stage-count chips removed; warnings become icons | Not on backlog | — | — |
| #156 | 20 Oct | fix | Goals button always present; `/projects/all` is the goals view across every project | Not on backlog | — | — |
| #157 | 20 Oct | fix | Horizontal layout's columns run down to the nav | Not on backlog | — | — |
| #158 | 21 Oct | feat | Inbox: `POST /api/inbox` turns mail and notes into tasks without a provider API; inbox tokens (`kbi_…`) | Not on backlog | `0023_inbox` (renames `gmail_message_id` to `message_key`) | Issue an inbox token from `/console`. Optional: `INBOX_ALLOWED_SENDERS`, `INBOX_EXTRACTION`. Set up the mail receiver (`INBOX_SETUP.md`) |
| #159 | 21 Oct | feat | Landing page chooses what the board shows; board moves to `/board`; `tasks.viewed_at` | Not on backlog | `0024_task_viewed` | — |
| #161 | 21 Oct (opened) | docs | This register, backfilled to #131; `docs/BACKLOG.md` 21 Oct amendment; `docs/WAYS-OF-WORKING.md` lists the register and makes a row part of every PR. Its `CHANGELOG.md` backfill for #131–#154 rides in #160 (`513c95e`), not here | Not on backlog (asked for on 21 Oct) | — | — |
| #162 | 21 Oct (opened) | fix | `createStage` stores the stage's `kind`. Since #134 every new stage, seeded or added in Admin, was stored as `backlog`, so on a fresh database Done drew as an ordinary column and its tasks counted as open | Not on backlog (defect in #134) | — | Production unchecked: run the query in #162 to list stages created since `0014` that are `backlog`, and correct any that should not be in Admin |
| #165 | 21 Oct (opened) | fix | `npm run check` passes and runs the type-check (`typecheck`, `tsc --noEmit`). Fixture given its `urgency`; `logs.1774761325491.json` untracked and `logs.*.json` ignored; supertest apps served on 127.0.0.1 (`server/test-support/loopback.ts`: supertest's `::` bind let parallel runs on macOS reach another process's server); the LangGraph parallel test counts overlap instead of timing; Vitest excludes `.claude/`; the server's Postgres sessions run in UTC (`server/pg-session.ts`; a Pacific/Auckland database read every `defaultNow()` row 13 h ahead). Closes four Carried items: the `tsc` error, the `format:check` log file, the integration tests, the two parallel-run failures | Issue #18 (R2 epic), its first acceptance gate; asked for on 21 Oct. UTC sessions: not on backlog (defect found here) | — (local database migrated to `0024`; no new migration) | Production unchecked: its Postgres `TimeZone`. Nothing to do if it is UTC; otherwise rows written from this deploy are UTC and earlier ones keep their offset. `npm run db:migrate` (drizzle-kit) is not pinned |

**In this window:** 28 PRs, 12 migrations (`0013`–`0024`), 2 changes with required deploy
actions (#146, #158). Of the 26 PRs that changed the app (all but #133, docs, and #139, a
merge), 5 trace to a backlog item, an epic or an issue: #131 in part, #134, #137, #141 and #154.

## Carried

Open items the PRs reported about themselves, plus what the 21 Oct review measured. A row
leaves this table only when a later PR's row closes it.

| Since | Item | Reported in | State on 21 Oct 2026 |
|---|---|---|---|
| #137 | Import does not restore goal links or dependency edges (ids are remapped) | #137 | Open |
| #143 | Schedules count effort as days, start today and do not skip weekends: "assumptions to confirm" | #143 | Unconfirmed |
| #145 | No real model response was checked ("no key here") | #145 | Not recorded since |
| #146 | Production stopped at start-up after #146 although both variables were set | #149 | #149 makes the log name the cause. Whether production now starts is not recorded here |
| #147 | A goal refuses dependencies in the UI only; the API still accepts them | #147 | Open: the PR asked whether to refuse server-side |
| #152 | Playwright mobile-first suite (`tests/uix/`, `playwright.config.ts`) kept out of the PR, uncommitted | #152 | Not in the repo (`tests/` holds `smoke.test.ts` only) |

### Documents out of step on 21 Oct 2026

- `docs/epics/EPIC-06-owner-as-entity.md` says *Spec — awaiting refinement*; #131 implemented it.
- `docs/epics/EPIC-05-task-dependencies.md` says *Draft — gated on B-01*; #136–#148 built
  most of its relation and some of its §6 non-goals, and only the `0018` note records any of it.
- `README.md` says R2 freezes the schema and forbids new features, which 12 migrations and most
  of the rows above contradict; it points at `development/01-R2-REFACTOR/…` and
  `bugs/archive-drag-drop-not-working.json`, both deleted on 27 Mar 2026 (`a1e7cb2`); and it
  describes `npm run check` as `tsc --noEmit`, which is not what `package.json` runs.
