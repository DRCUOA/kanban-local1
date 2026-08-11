# EPIC-01: Project scoping for tasks

**Epic type:** Enabler + business feature
**Status:** Ready for refinement
**Owner:** Product
**Target:** 2 sprints (≈21 pts)

## Epic hypothesis statement

> **For** people sharing the kanban board who work on different streams of work,
> **who** currently see every other person's tasks mixed into the same columns,
> **the** Project layer **is a** first-class grouping on tasks
> **that** lets the board be scoped to one project at a time while keeping one shared workflow.
> **Unlike** creating a separate board per team, which forks the stages and splits reporting,
> **our solution** adds one selector to the header and one field to a task.
>
> **We will know we are right when** the median number of tasks visible on the board drops below 40 for a scoped view, and no user reports needing a second board within 30 days of launch.

## Context / problem

1. Specialist work (e.g. one person's infrastructure backlog) is irrelevant to everyone else, but it competes for the same column space and cognitive attention.
2. The board's value is the *shared workflow* (stages/sub-stages), so per-team boards are the wrong cut — they duplicate the workflow and destroy cross-project views.
3. `tasks.owner` already exists as a weak filter, but "who" ≠ "what stream of work". A person can work on three projects; a project can have three people.

**Design principle for this epic — filter, don't fork.** Stages and sub-stages stay global. A project changes *which tasks are visible*, never *what the board looks like*. One new control in the header; one new field on the task form. If a story adds a second concept to the UI, it is out of scope.

## In scope

- `projects` table; `tasks.project_id` FK.
- Project CRUD in the existing Admin page.
- A single header project selector that scopes the board (including "All projects").
- Project assignment on task create/edit; project attribution for email-ingested tasks.
- Persisted + shareable scope (localStorage + `?project=` query param).

## Out of scope (explicitly)

- Authentication, user accounts, project membership, permissions → **EPIC-02: Identity & membership**. Until then, "different users" is served by per-browser persisted scope, not access control.
- Per-project stages, sub-stages, WIP limits, or colours.
- Cross-project reporting/dashboards.
- Nested projects / portfolios.

## Proposed data model change

```sql
-- projects: id, name, key (short code), color, archived, order, created_at
-- tasks: + project_id integer references projects(id)   -- NOT NULL after backfill
```

Rollout is a three-step expand/backfill/contract so no deploy has a broken window:

1. Add `projects` + nullable `tasks.project_id`; seed a default project (`General`).
2. Backfill all existing tasks to `General`; ship writers that always set `project_id`.
3. Add `NOT NULL`.

`sub_stages.tag` semantics are untouched — sub-stage matching stays per stage, independent of project.

## User stories

| # | Story | Pts |
|---|---|---|
| 1 | Create `projects` table + seed default project (enabler) | 3 |
| 2 | Add `tasks.project_id`, backfill, extend API contracts (enabler) | 3 |
| 3 | As an admin, I can create/rename/archive projects | 3 |
| 4 | As a board user, I can scope the board to one project | 5 |
| 5 | As a task author, my new task lands in the project I'm viewing | 2 |
| 6 | As a board user, I can tell which project a task belongs to in "All projects" | 2 |
| 7 | As a board user, my chosen project sticks between sessions and is shareable by URL | 2 |
| 8 | As a board user, emailed-in tasks land in the right project | 3 |

### Story 4 (the one that carries the epic) — acceptance criteria

**As a** board user
**I want** to scope the board to a single project
**So that** I only see work that is relevant to me

- **Given** more than one active project exists, **when** I open the board, **then** a project selector appears in the header showing my last-used scope, defaulting to "All projects" on first visit.
- **Given** I select project *Alpha*, **when** the board re-renders, **then** only tasks with `project_id = Alpha` are shown, and every stage and sub-stage remains visible — including stages that now hold zero tasks.
- **Given** a scoped view, **when** I drag a task between stages or sub-stages, **then** the move behaves exactly as it does unscoped and the task's project is unchanged.
- **Given** exactly one project exists, **when** I open the board, **then** the selector is hidden (no new UI until there's a second project to choose).
- **Given** a scoped view, **when** I open Archive or Admin, **then** the same scope applies to Archive and does **not** apply to Admin.
- Filtering is applied server-side (`GET /api/tasks?projectId=`), not by fetching all tasks and hiding them client-side.

### Story 6 — acceptance criteria

- **Given** scope is "All projects", **when** I look at a task card, **then** a project colour chip is shown.
- **Given** scope is a single project, **when** I look at a task card, **then** **no** project chip is shown (the header already says it — no redundant ink).
- Chip adds no more than one line to card height and does not displace the owner badge.

### Story 8 — acceptance criteria

- **Given** an inbound email creates a task, **when** no project can be inferred, **then** it is assigned to the default project and is visible without filtering.
- **Given** a project has an inbound alias mapping, **when** an email arrives to that alias, **then** the created task is assigned to that project.
- `inbound_email_processing` rows remain correct and idempotent — project attribution must not affect dedupe keys.

## Non-functional requirements

- Board load with 1,000 tasks across 10 projects returns in ≤300 ms p95 for a scoped view; `tasks(project_id, stage_id)` index in place.
- Zero data loss on migration: post-backfill count of tasks per project reconciles to the pre-migration total.
- Existing task API responses stay backward compatible for one release (`project_id` additive).

## Metrics

| Metric | Baseline | Target |
|---|---|---|
| Median tasks rendered per board view | current all-tasks count | < 40 |
| Tasks with a non-default project after 30 days | 0% | > 60% |
| Requests for a second board | n/a | 0 |
| Board p95 render time | current | no regression |

## Risks & assumptions

- **R1 — project becomes a second owner field.** Users may encode people as projects ("Rich's stuff"). *Mitigation:* seed with work-stream examples; review naming after 2 weeks.
- **R2 — scope hides work and things get dropped.** *Mitigation:* "All projects" is always one click away and is the first-run default; counts on the selector show hidden task volume.
- **R3 — no auth means scope is a preference, not a boundary.** Anyone can switch scope and see everything. *Accepted* — documented, and deferred to EPIC-02.
- **A1 — one shared stage workflow is genuinely right for all projects.** If a project needs different stages, this epic's premise fails and we revisit with per-project stage overrides.

## Dependencies

- None external. Story 2 blocks 4–8. Stories 1–2 must ship in the same release as the backfill script.

## Definition of Done (epic)

- Migration applied and reversible; `tasks.project_id` is `NOT NULL` with FK.
- Board, Archive, task create/edit, and the email pipeline all project-aware.
- Unit + integration tests for scoped queries and migration backfill; existing suite green.
- `ARCHITECTURE.md` table list and `CHANGELOG.md` updated.
- Demoed with ≥3 projects and ≥50 tasks.

## Open questions for refinement

1. Should `project_id` be **nullable forever** (a "no project" inbox lane) rather than forced `NOT NULL`? Recommendation: `NOT NULL` with a default project.
2. Should subtasks inherit project from `parent_task_id`? Recommendation: inherit on create, re-pointable afterwards.
