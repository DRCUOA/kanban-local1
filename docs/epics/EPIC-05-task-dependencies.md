# EPIC-05: Task dependencies — sequence as a first-class relation

**Version:** 0.1 — epic framing only, atomics deliberately not yet broken out
**Epic type:** Business feature, with an enabler spine
**Status:** Draft — not ready for refinement; gated on B-01 (see *Sequencing*)
**Owner:** Platform
**Target:** unsized. Sizing is an output of ATOMIC-00, not an input to it.
**Note (migration 0018):** the predecessor/successor edge table and its form CRUD were built ahead of this epic's gate at the owner's direction: Option A shape, acyclic at write time, no stored temporal class. OQ-2, OQ-3 and OQ-8 are answered in code by `migrations/0018_task_dependencies.sql`; the rest stay open.
**Supersedes:** nothing. **Superseded by:** nothing.

> **Read this first.** Behaviour here is *fuzzy by declaration* (author's own
> assessment, 31 Aug 2026). This document is therefore written to a different
> standard than EPIC-03 or EPIC-04: it fixes the goal, the constraints and the
> candidate data models, and it refuses to fix the behaviour. Every unmade
> decision appears as a numbered open question, not as a `shall` statement.
> The requirements section is short **on purpose**. A longer one would be
> invented.

---

## 0. Is this worth doing at all?

Asked directly during specification: *essential to good task management in a tool
of this type, nice-to-have, or a waste of effort?* Answering it is the first
thing the epic owes the reader, because the answer changes the sequencing.

**Verdict: essential eventually, wrong order now, and the cheapest valuable
slice is not the one the request describes.**

The three parts of that, with the reasoning:

**1. Dependencies are not a nice-to-have in the general case.** Precedence
between units of work is the load-bearing concept in every formal scheduling
method — it is the *entire* content of the Precedence Diagramming Method and of
critical-path analysis, and every comparable tool ships it (Jira issue links,
Asana dependencies, Linear blocks/blocked-by, MS Project predecessors). A board
without it cannot answer "what actually has to happen first", which is a
different and more useful question than "what is due first", the only question
`shared/task-sort.ts` can answer today.

**2. But its realised value here is conditional, and the condition is unusual.**
On a solo board of roughly 22 tasks (last recorded count, EPIC-03, 11 Aug 2026)
the operator holds the sequence in their head, and the well-documented failure
mode of dependency features is decay: links get created once, never maintained,
and the graph quietly becomes a confident lie. On a board this size, the human
would notice a stale link. **A machine reader would not.** The genuinely strong
argument for this epic is therefore *not* the board UI — it is
`shared/briefing.ts`. The briefing agent currently ranks purely on due day and
stage, so it can say "#142 is 2 days overdue" but never "#142 is overdue
*because* the thing it waits on slipped". That is a real capability gap with a
real, non-human consumer that cannot compensate by remembering. This is the part
worth building.

**3. Building it before the data-model audit would be an active mistake.**
A dependency is not a stored fact; it is a *predicate over two other facts* —
"is the upstream task finished, and did it finish before the downstream task's
due day?". Both operands are precisely the fields EPIC-03 documents as
unreliable:

| Operand the predicate needs | What EPIC-03 found | Finding |
|---|---|---|
| "is the upstream task finished?" | `status` and `stage_id` are two contradictory state machines; 3 of 22 rows disagree | §1 |
| "before which calendar day?" | `due_date` is a date wearing a timestamp's clothes; overdue answers differ by timezone | §6 |

Every edge in a dependency graph evaluates that predicate. Adding *N* edges over
ambiguous operands does not inherit the ambiguity — it **multiplies** it, and it
does so into a structure whose whole purpose is to be trusted transitively. This
is the "consider the data model first" principle at its sharpest: the feature is
worth building, and building it now would manufacture exactly the class of debt
EPIC-03 exists to pay off.

**Consequence for this document:** EPIC-05 is framed now so the data-model audit
(B-01) can be told to ask its questions, and built after. See *Sequencing*.

---

## 1. Epic hypothesis statement

> **For** the daily-briefing agent and the operator reading the board,
> **who** can both see *when* work is due but neither of whom can see *what
> depends on what*, so a slip upstream stays invisible until the downstream task
> is itself late,
> **the** task dependency layer **is a** stored, directional relation between
> tasks with an explicit temporal class,
> **that** lets a reader attribute a slip to its cause rather than merely
> observing it.
> **Unlike** encoding sequence in prose inside `description` — which no consumer
> can read, and which the export ships verbatim to an agent that cannot act on
> it —
> **our solution** makes the relation a queryable edge whose timing judgement is
> derived, never stored, so it cannot go stale when a due date moves.
>
> **We will know we are right when** a briefing for a board containing a slipped
> precursor names the precursor as the cause, and when zero dependency links in
> the export report a stored classification that disagrees with the dates of the
> two tasks it connects.

**Status of this hypothesis: unvalidated.** The falsifiable half is written, the
evidence half is not — see OQ-1.

---

## 2. Source request

Recorded verbatim, because the spec's job includes showing what was asked versus
what was decided.

> "Implement task linking functionality, starting with simple dependency
> identification where a task can have multiple dependencies. Dependencies should
> be supported whether they occur before, on, or after the related due date.
> Additionally, the data model should consider classifying dependencies as
> precursor, on-day, or post-day relationships."

**What this settles:** cardinality (many per task), that all three temporal
orderings are in scope, that the first cut is *identification* rather than
enforcement, and that a temporal classification is wanted.

**What it leaves open:** whether the classification is asserted by the user or
computed from the dates; whether "post-day" is a distinct stored fact or the
mirror image of "precursor"; what any of it means when a task has no due date;
and how links interact with hierarchy, Bin, Archive and delete. These are OQ-2
through OQ-8.

---

## 3. Terminology

Fixed here so the rest of the document and the spike share one vocabulary. These
are *definitions*, not decisions — which of them the database stores is OQ-2.

| Term | Meaning | Precedence-diagramming analogue |
|---|---|---|
| **Link** | A directed relation between two distinct tasks. Neutral term; carries no timing claim. | — |
| **Subject** | The task the relation is read *from*. | — |
| **Counterpart** | The task at the other end. | — |
| **Precursor** | The counterpart must land **before** the subject's due day. | Finish-to-Start |
| **On-day** | Subject and counterpart must land on the **same** day. | Finish-to-Finish, zero lag |
| **Post-day** | The counterpart lands **after** the subject's due day. | Start-to-Start / successor view |
| **Satisfied** | The relation's timing condition currently holds. Always derived. | — |
| **Violated** | It does not. Warning-only (R4). | — |

**Structural observation, offered to the spike rather than decided here:**
*post-day is the exact inverse of precursor.* "A before B" and "B after A" are
one fact. A model that stores both admits two rows describing the same relation,
which can be edited to disagree — the precise defect pattern EPIC-03 §1–§3
catalogues. **On-day is symmetric**, which raises the mirrored-duplicate problem
in a different form. Whether to store two kinds and derive the third, or store a
canonical direction and render all three at the boundary, is OQ-2.

---

## 4. Settled requirements

EARS syntax. Deliberately few: these are the statements supported by the source
request, an explicit decision made during specification, or a rule the existing
codebase already enforces on comparable features. **Nothing here is inferred to
fill a gap.**

| ID | Requirement | Source |
|---|---|---|
| **R1** | The system shall permit a task to hold zero or more links to other tasks. | Source request |
| **R2** | The system shall record each link as a directed relation between exactly two distinct tasks. | Source request |
| **R3** | The system shall permit links between tasks whose due days fall before, on, or after one another. | Source request |
| **R4** | If a link's timing condition is not satisfied, then the system shall present it as a warning, and shall not prevent any status change, stage move, archive, or completion. | Decision, 31 Aug 2026 |
| **R5** | The system shall derive every timing judgement about a link at read time, and shall not store the derived result. | Data-model-first principle; EPIC-03 "one fact, one column" |
| **R6** | The system shall resolve a task's calendar day and open/closed state for link evaluation using the same helpers as the board's existing overdue highlight. | `shared/task-warning-highlight.ts`, which already binds the board and briefing to one resolution path |
| **R7** | The system shall expose a task's links to the board UI and to the export payload from one shared projection. | Decision, 31 Aug 2026: both consumers first-class |
| **R8** | If a request would create a link from a task to itself, then the system shall reject it and report the reason. | Follows from R2 |
| **R9** | Where the export payload gains link data, the system shall add it as optional keys and shall not increment `EXPORT_FORMAT_VERSION`. | `shared/export.ts:15-18` — additive keys are declared non-breaking |

**R6 is the load-bearing one.** It is what prevents this epic from becoming a
fourth consumer that re-derives "is this task done, and when was it due" its own
way — the failure EPIC-03 is currently unwinding three instances of.

---

## 5. Candidate data models

Presented as options with trade-offs. **The spike chooses; this document does
not.** Both options satisfy R1–R3.

### Option A — canonical storage, three-word vocabulary at the boundary

Store only non-redundant kinds; render precursor / on-day / post-day as
direction-dependent *views* of the stored edge.

```sql
CREATE TABLE task_links (
  id                serial PRIMARY KEY,
  subject_task_id   integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  counterpart_task_id integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind              text    NOT NULL,   -- canonical set only; see OQ-2
  note              text,
  created_at        timestamp NOT NULL DEFAULT now(),
  CONSTRAINT task_links_no_self CHECK (subject_task_id <> counterpart_task_id),
  CONSTRAINT task_links_unique_pair UNIQUE (subject_task_id, counterpart_task_id)
);
```

*For:* one row per real-world fact; the two directions cannot drift apart;
matches EPIC-03's stated design principle. *Against:* the API and UI must
translate, so "post-day" exists in the vocabulary but never in a column — which
is a legitimate reading of the source request but not the literal one.

### Option B — literal three-kind storage

`kind ∈ ('precursor','on_day','post_day')` stored as written, no canonicalisation.

*For:* the stored model reads exactly like the request; no translation layer.
*Against:* admits mirrored pairs that disagree, and needs either a trigger or
application-level discipline to prevent them — i.e. it reintroduces the
reconciliation burden by choice.

### Common to both, whichever is chosen

- Foreign keys enforced **at the database level**. Note that `tasks.parent_task_id`
  is documented as an enforced FK at `shared/schema.ts:94` but **no such
  constraint exists in any migration** — `migrations/0003_add_task_columns.sql:9`
  adds a bare `integer` column. This epic must not repeat that; see OQ-6.
- Expand-only, additive migration. No column dropped, no existing behaviour
  changed.
- A bound on links per task, to keep the payload and the UI finite (value: OQ-7).

---

## 6. Non-goals

Drafted from the repo and the neighbouring epics, per the boundary instruction —
**strike or add freely.**

- **Enforcement of any kind.** No blocking, no confirm-to-override, no automatic
  status propagation. R4 is a decision, not a staging post.
- **Scheduling behaviour.** No critical path, no float or slack calculation, no
  auto-rescheduling of a downstream task when an upstream date moves.
- **Lag or lead values.** No "3 days after"; the three named classes only.
- **Cross-project links.** There are no projects (EPIC-01).
- **Bulk link editing, or link creation by drag on the board.** A drag-only
  affordance would also fail the WCAG 2.1 AA floor set in `docs/WAYS-OF-WORKING.md`.
- **Changing `shared/briefing.ts`'s existing ranking or digest shape.** Any link
  data is a new, additive section.
- **Retiring `parent_task_id`** — unless the spike decides otherwise (OQ-6).
- **Visualising the graph.** No dependency chart, no timeline, no Gantt.

---

## 7. Open questions

Every one of these must have an answer before atomics can be written. Owner is
Rich throughout unless noted; several are explicitly routed into B-01.

| ID | Question | Why it matters | Route |
|---|---|---|---|
| **OQ-1** | What is the specific observed incident that motivates this? | Evidence was declared as "observed pain I can point to" but the case was not supplied. Without it the hypothesis in §1 has no baseline and no falsification test. | Rich, before refinement |
| **OQ-2** | Is post-day stored, or derived as the inverse of precursor? (Option A vs B) | Determines whether two rows can ever disagree about one fact. The single highest-consequence modelling choice in the epic. | Spike |
| **OQ-3** | Is the temporal class **asserted** by the user or **computed** from the two due dates? | If computed and stored, it goes stale the instant a due date moves — violating R5. If asserted, the stored intent and the actual dates can disagree, and the UI must show that as a violation rather than silently correcting it. | Spike |
| **OQ-4** | What does a link mean when one or both tasks have **no due date**? | "Before the due day" is undefined without one. Options: reject such links, permit them as untimed ordering only, or treat the undated task as unconstrained. Frequency of undated tasks on the live board is unmeasured — B-01 should count it. | Spike + B-01 |
| **OQ-5** | How do links behave across **Bin, Archive and hard delete**? | `deleted_at` soft-deletes (`migrations/0009`), archive is a separate flag, and `storage.deleteTask` hard-deletes. Whether a link to a binned task still warns, whether restore re-arms it, and whether `ON DELETE CASCADE` is right, are three distinct decisions. | Spike |
| **OQ-6** | Does this absorb `parent_task_id`, sit beside it, or sit beside it *and* repair its missing FK? | Routed to the spike by decision, 31 Aug 2026. Note the FK is genuinely absent, not merely undocumented. | Spike |
| **OQ-7** | What is the maximum number of links per task, and what happens at the limit? | Bounds export size and UI. EPIC-03 targets a sub-50 KB full-board export; an unbounded edge set can defeat that. | Spike |
| **OQ-8** | Must ordering links form an acyclic graph, and is a cycle rejected at write time or reported by an integrity check? | A cycle makes "satisfied" undecidable. Near-universal in comparable tools, but **not decided here** — see ASSUMPTION-1. | Spike |
| **OQ-9** | Should EPIC-05 be **merged into** B-01/EPIC-03 or **sequenced after** it? | Raised by Rich as genuinely open. Recommendation in §8. | Rich |

---

## 8. Sequencing — and the merge-versus-sequence recommendation

**Recommendation: sequence, do not merge — but inject three questions into B-01
now.**

Reasoning. Merging would put a *feature* inside an *enabler* epic whose stated
discipline is that "no story in this epic adds a new derived field to compensate
for an ambiguous one" (EPIC-03). Dependency links are exactly such a derived
structure, so folding them in would corrupt the one property that makes EPIC-03
reviewable. Sequencing keeps both documents honest.

But sequencing alone wastes the audit. B-01 is scheduled, it re-validates
EPIC-03's findings against live data, and it is the only moment where the
questions below are cheap to answer. So:

**Inject into B-01's scope (three additional audit questions):**

1. How many live tasks have **no due date**? (feeds OQ-4)
2. Does `history` retain enough to reconstruct *when* a task became done, as
   opposed to only that it is done? A precursor's satisfaction is a question
   about a **completion date**, and the board currently stores completion as a
   state, not a date. If it cannot be reconstructed, "satisfied" is only ever
   answerable in the present tense — which materially reduces this epic's value
   and must be known before it is sized.
3. Is there any existing sequencing intent encoded informally — in
   `description` prose, in tags, or in sub-stage names — that a dependency model
   would need to absorb rather than duplicate?

**The order:**

```
B-01 (data-model audit, + the 3 questions above)
      │
      ▼
EPIC-03 stories 1, 2 and 6  ── single stored state; due_date typed as a date
      │                        with an explicit board timezone
      ▼
EPIC-05 ATOMIC-00 (spike)  ── settles OQ-2 … OQ-8, produces an ADR
      │
      ▼
EPIC-05 atomics             ── written only after the spike reports
```

EPIC-03 stories 1, 2 and 6 are hard prerequisites, not preferences: R6 cannot be
satisfied while `status` and `stage_id` disagree, and R3 cannot be evaluated
while a due day's answer depends on the reader's timezone.

---

## 9. ATOMIC-00 — the spike (the only piece specified at this altitude)

**Type:** Enabler / research. **Time-box: 1 day**, matching the B-10 precedent in
`docs/BACKLOG.md`. **Output is decisions and an ADR, not code.**

**Definition of Done for the spike:**

- OQ-2 through OQ-8 each carry a written answer with its reasoning.
- The direction convention is stated in one unambiguous sentence, with a worked
  example naming two real task ids. *(Direction ambiguity is the most common
  defect class in dependency features: every consumer that reads the edge
  backwards produces a confidently inverted answer.)*
- Comparable models reviewed against the three named classes — at minimum the
  Precedence Diagramming Method's four relation types, and how at least two
  shipping tools reduce them to a usable UI.
- An **ADR is written** to `docs/adr/` per `docs/WAYS-OF-WORKING.md`. This would
  be the repo's first ADR; the directory is referenced by the ways-of-working
  document but does not yet exist.
- A revised EPIC-05 at v1.0 with atomics, estimates and Given/When/Then
  acceptance criteria — or **a recommendation not to build it**, which is a
  legitimate and non-failing outcome of a spike.

---

## 10. Assumptions

Each is the author's, not the requester's. **Strike any of them.**

- **ASSUMPTION-1** — ordering links should form an acyclic graph, and a cycle
  should be rejected at write time. Universal in comparable tools; not stated by
  the requester. Recorded as an assumption rather than promoted to a `shall`
  because OQ-8 is open.
- **ASSUMPTION-2** — links are between tasks on the same board and there is no
  cross-board case, because no second board exists.
- **ASSUMPTION-3** — "simple dependency identification" in the source request
  means recording and displaying, with no derived planning behaviour. §6's
  non-goals rest on this reading.
- **ASSUMPTION-4** — the briefing agent is a real, current consumer whose output
  is read. §0's central argument depends on it; if it is not, the epic's value
  case is materially weaker and should be re-argued.

---

## 11. Definition of Done — for this framing document

This document is done, at v0.1, when:

- [x] The worth-doing question is answered explicitly rather than assumed (§0).
- [x] Every unmade decision appears as a numbered open question (§7).
- [x] Every author-supplied judgement is labelled as an assumption (§10).
- [x] Candidate data models are presented as options with trade-offs, not as a
      chosen design (§5).
- [ ] OQ-1 answered — the motivating incident is recorded.
- [ ] The three additional audit questions are added to B-01 in `docs/BACKLOG.md`.
- [ ] EPIC-05 is placed in the backlog's Later section with its dependency on
      B-01 and EPIC-03 stated.

The epic itself has no Definition of Done yet. **Writing one before the spike
reports would be the exact failure this document is structured to avoid.**
