# EPIC-04: Catch-up Replay — the board plays you the news

**Epic type:** Business feature (differentiator)
**Status:** Paused — pending B-01 data-model audit and EPIC-03 (see `docs/BACKLOG.md`); v2 with PR #108 review feedback applied
**Owner:** Product
**Target:** TBD at refinement
**Source:** Live "catching up and planning a day" use-case session, 14 Aug 2026; reviewed in PR #108

## Epic hypothesis statement

> **For** people who struggle to stay on top of their tasks because existing tools'
> complexity, pace, or trust demands have been a barrier — including people managing
> executive-function difficulties, mental-health load, or low confidence with
> technology,
> **who** open the board after time away and cannot consciously register what changed
> while they were gone (the changes happened silently, in the background),
> **the** Catch-up Replay **is a** playback mode in which the board rewinds to the
> state the user last witnessed, then replays the net changes in human-observable time
> — one task circle spotlighted at a time over a greyed-out board, with a ticker (or
> voice-over, later) explaining each change — ending in a committed "today" list,
> **that** turns silent background drift into consciously witnessed change, at a pace
> the user controls with familiar video controls (play/pause/speed/skip).
> **Unlike** guided planning wizards (Sunsama), invisible AI auto-scheduling (Motion),
> or gamified swipe-triage decks (TaskSwipe, Task Triage),
> **our solution** keeps the user's own spatial board as the stage and plays the delta
> on it — calm, spatial, one change at a time: **every change that matters played
> individually, and a summary of the rest.**
>
> **We will know we are right when** (quality gate) a replay run moves the baseline
> board state to the current state with zero visual glitches, **and** (product
> outcomes) completed replays outnumber immediate skip-alls, and users reach their
> first task interaction faster after a catch-up session than after a plain open.

## Context / problem

1. **The premise rests on established perception research.** Change blindness: users
   reliably fail to notice state changes that occur abruptly, during loads, or in the
   background — even large ones (NN/g). Today the board embodies that failure mode:
   due-date rollovers, staleness, and priority drift all happen silently between
   sessions, so the user's mental model and the board diverge. Animated transitions
   are the documented remedy — they show *where* a change happened and *why* — with
   one caveat that shapes this whole epic: **competing simultaneous animations dilute
   attention**. Hence the one-circle rule.
2. **A competitive scan (Aug 2026) found no one doing this.** Sunsama (guided wizard),
   Motion (invisible automation), Akiflow (keyboard triage), and the swipe-triage apps
   (one-at-a-time, but gamified, mobile, list-based) all occupy other corners. No tool
   scanned replays changes ambiently *on the user's own board*. Treat this as a scan
   result to re-verify near launch, not a proven absence.
3. **The target population needs it most.** Studies of older adults and late adopters
   identify usability complexity, low self-efficacy, anxiety, and trust as the
   dominant barriers — not missing features. Automation that acts silently *erodes*
   trust; watching the system make each move, remote control in hand, is designed to
   *build* it. The video-playback metaphor is chosen because it is already universal:
   no new interaction grammar to learn.
4. **The per-task logic already exists.** `shared/task-warning-highlight.ts`
   (overdue → high-priority backlog → stale) and `shared/briefing.ts` (due buckets,
   urgency ranks 1–3 that "a briefing must never drop") supply the surfacing and
   message vocabulary. This epic is a **presentation layer over existing logic**,
   consumed through a dedicated adapter (see Replay state model).

**Design principle for this epic — replay, don't touch; one circle, one message, user
holds the remote.** Replay is a client-side visual layer over frozen inputs: it never
writes task-domain data. Exactly one task circle is ever in focus. Each update is
delivered through one primary channel (ticker *or* voice — with captions always
available as an accessibility override). Pacing is ambient by default, but the user
can pause, change speed, skip one, or skip all at any moment, using controls that look
like a video player. If a story adds a second simultaneous focus element, modifies the
shared warning/briefing logic, or invents a novel control, it is out of scope.

## Replay state model (resolves PR #108 blockers 1–4)

**The decision: a *witnessed transition* — historical baseline reconstruction, net
delta, presentation-only.** Not an event-history replay, and not an overlay of badges
on the current board.

- **Witnessed checkpoint.** A persisted record of the board as the user last finished
  witnessing it: a version/timestamp plus, per task, the raw placement fields
  (`stageId`, `subStageId`, `priority`, `dueDate`, `archived`) **and the evaluated
  outputs** (warning-highlight kind, due bucket) at witness time. Evaluated outputs
  are stored because time-derived states ("became overdue," "went stale") cannot be
  reconstructed from raw fields alone.
- **Frozen replay session.** Entering catch-up captures an immutable
  `{baselineVersion, asOfVersion}` pair. Changes arriving after `asOfVersion` never
  enter the active replay — they belong to the next one.
- **Playback.** The user arrives on the **normal current board** (never held hostage).
  Pressing *Catch up* performs a brief, legible **rewind** to the baseline render,
  anchored by a trust header ("As you left it — Tue 4:12 pm"), then applies
  `ReplayItem`s one at a time until the rendered board equals the `asOf` state.
- **No task-domain writes.** Replay's only writes are checkpoint advancement and
  today-list membership.
- **Checkpoint advancement.** Atomic, and only on run completion or explicit
  skip-all. Abandonment — tab close, crash, exit, or pause-into-normal-mode without
  resuming — advances nothing. Unseen changes can never be lost; the worst case is
  re-watching a few items.

### Change taxonomy (v1 `ReplayItem` kinds)

| Kind | Detected by |
|---|---|
| `removed` | present at baseline, absent at asOf (title taken from baseline) |
| `completed` / `archived` | status/archived transition |
| `created` | absent at baseline, present at asOf |
| `became_overdue` | evaluated highlight overdue at asOf, not at baseline |
| `moved` | `stageId`/`subStageId` differs |
| `became_high_priority_backlog` | evaluated highlight transition |
| `became_stale` | evaluated highlight transition |
| `due_today` | due bucket is `today` at asOf and was not at baseline |

A task with multiple changes yields **one** `ReplayItem`: the primary kind is the
highest in the table above (which embeds the existing warning precedence), and
secondary changes are appended to the ticker copy. Unsupported or malformed change
data falls back to a generic "this task changed" item — never a skipped task, never a
crash.

**Ordering (deterministic):** briefing urgency rank → due bucket → effective due
time → task ID.

**Aggregation (absolute rule):** every item at briefing urgency ranks 1–3 plays
individually — no cap, ever. Items below rank 3 play individually up to cap N (set at
refinement); the remainder becomes a single final **expandable** aggregate item
("+12 minor changes" → expands to a list). Summarized, never hidden.

## Design hypotheses (evidence-grounded)

| Source finding | Design hypothesis it grounds |
|---|---|
| Change blindness: background changes go unregistered; animated transitions remedy it, but competing animations dilute attention (NN/g) | The replay exists at all; strictly one circle in motion/focus at a time |
| Modality effect (Mayer): narration + visuals uses both working-memory channels | Voice-over is a legitimate P1 delivery channel, not a gimmick |
| Redundancy effect (Mayer): identical simultaneous text + narration increases load | Ticker XOR voice as the *default*; captions/transcript remain available with voice on, because accessibility need outranks the average-user load optimization |
| Self-paced presentation relieves working memory; segmented system-paced also helps | Ambient auto-advance in discrete one-update segments with ever-present pause/speed/skip — the video paradigm is the evidence-backed hybrid |
| Executive-function scaffolding interventions show moderate-to-large effects (g ≈ 0.54–0.83); one small step lowers the activation barrier | One update at a time; the mode ends with a *small* commitment (today list), not a full re-plan |
| Overwhelm research: long undifferentiated lists increase avoidance; implementation intentions reduce it | Cap-and-aggregate below rank 3; the committed today list is the implementation-intention artifact |
| Older-adult/late-adopter barriers: complexity, self-efficacy, anxiety, trust (JMIR scoping review) | Familiar video controls only; a visible reason on every change; a caught-up affirmation as a mastery moment |
| WCAG 2.3.3 / vestibular research: large moving elements can cause dizziness; honor `prefers-reduced-motion` | Reduced-motion variant is P0: crossfade spotlight, no drift. Also defers the 3D ball morph — v1 focus treatment is a 2D circle with gentle scale/elevation |

These are hypotheses to validate with the product-outcome metrics below, not settled
facts about this feature.

## In scope

- **Witnessed checkpoint persistence** (server + schema): store, load, and atomically
  advance the checkpoint described above.
- **`ReplayItem[]` adapter**: the tested contract that consumes
  `task-warning-highlight.ts` / `briefing.ts` read-only and emits the taxonomy above.
  Contract tests pin the adapter's output, not the shared modules' internals.
- **Headless playback state machine**: frozen session, ordering, aggregation,
  pause/resume position, checkpoint advancement rules — testable without UI.
- **Presentation**: rewind-to-baseline with trust header; greyed board; one 2D circle
  in focus with gentle scale/elevation; ticker label using existing
  warning/briefing vocabulary. Reduced-motion variant (crossfade spotlight, no drift)
  built **first**.
- **Playback controls**: play/pause, speed, skip-one, skip-all; explicit entry button;
  explicit exit (button + Esc). Single click on the circle pauses (position retained)
  and reverts to the normal board focused on that task; user resumes or stays.
- **Zero-change closure**: brief caught-up affirmation, then straight to today-list
  commit.
- **Committed today list (minimal v1 semantics)**: zero tasks is valid; no hard cap;
  the day is cut in the **board timezone** (same precedent as `isOverdueOn`);
  commitment writes only a today-membership record, never task fields; a failed save
  surfaces a retry and leaves the replay checkpoint recoverable.
- **Accessibility**: full keyboard operation, visible focus, `aria-live` announcements
  mirroring the ticker, defined focus behaviour while the board is greyed, explicit
  exit. Captions available whenever voice is enabled.
- **Instrumentation** for the product-outcome metrics.
- **Voice-over delivery (P1, excluded from v1 DoD)**: TTS narration as the
  alternative primary channel.

## Out of scope (explicitly)

- **Any change to the shared surfacing logic** — `task-warning-highlight.ts` and
  `briefing.ts` are consumed read-only through the adapter. If the adapter needs data
  they don't expose, that is a separate, additively-tested change on those modules —
  not part of this epic's stories.
- **Event-history replay** — v1 is net delta. A task that toured three columns and
  returned shows no update.
- **Card opening and static card display** — unchanged by this epic.
- **3D ball morph / physics** — deferred; decorative motion contradicts the
  vestibular and attention evidence.
- **Gamification** — no streaks, confetti, sound effects, or celebration animations;
  calm *is* the differentiation.
- **Auto-entry on open** — explicit button only for MVP; session-tracking/suppression
  rules are a later epic.
- **Mobile** — desktop web only for v1.
- **AI-generated narration content** — labels/narration use the deterministic
  briefing vocabulary only.
- **Rich today-list features** — capacity planning, carryover, scheduling: follow-up
  epic.

## User stories (all P0 unless marked)

### Story 1 (carries the epic) — the replay run

**As a** returning board user **I want** the board to rewind to the state I last
witnessed and replay the net changes one circle at a time **so that** I consciously
register every change that matters.

- [ ] Entering catch-up captures an immutable `{baselineVersion, asOfVersion}` pair;
      changes after `asOfVersion` never appear in the active replay.
- [ ] The board performs a brief, legible rewind to the baseline render, with a trust
      header showing the witnessed timestamp.
- [ ] Updates play strictly one at a time, ordered rank → due bucket → effective due
      time → task ID.
- [ ] Each label states the task and the reason using only existing
      warning/briefing vocabulary; multi-change tasks show one item with the primary
      kind per the taxonomy precedence.
- [ ] The full run transitions the rendered board to the exact `asOf` state with
      **zero visual glitches** (no flicker, teleporting cards, mis-parented circles,
      or label/task mismatches).
- [ ] Replay performs no task-domain writes (verified by test).
- [ ] Completing the run (or skip-all) atomically advances the checkpoint;
      abandonment advances nothing.

### Story 2 — playback controls

**As a** user who paces differently day to day **I want** familiar video controls
**so that** the replay never outruns or bores me.

- [ ] Play/pause, speed, skip-one, skip-all, and exit are all operable by mouse and
      keyboard, with visible focus.
- [ ] Control response < 100 ms; skip-all settles into the exact `asOf` render
      < 200 ms after activation.
- [ ] Pause retains position (previous/next item) for the life of the session.

### Story 3 — interruption and resume

**As a** user who spots something urgent mid-replay **I want** one click to pause and
drop me on that task in the normal board **so that** I can act without losing my
place.

- [ ] Clicking the in-focus circle pauses playback and reverts to the normal board
      with that task in view.
- [ ] Resume returns to the retained position and continues.
- [ ] Leaving without resuming is abandonment: the checkpoint does not advance.

### Story 4 — reduced motion and accessibility

**As a** user with motion sensitivity or assistive technology **I want** a drift-free,
announced, keyboard-operable replay **so that** catch-up is usable and safe for me.

- [ ] `prefers-reduced-motion` is honored automatically; an in-app motion toggle
      exists regardless of OS setting.
- [ ] Reduced-motion variant replaces drift with a static crossfade spotlight; all
      Story 1 criteria hold under it.
- [ ] Ticker content is announced via `aria-live` (polite); focus behaviour on the
      greyed board is defined and tested; Esc exits.
- [ ] When voice is enabled (P1), captions are available simultaneously.

### Story 5 — committed today list

**As a** user finishing catch-up **I want** to commit a small today list **so that**
the session ends in a plan, not just awareness.

- [ ] Zero tasks is a valid commitment; no hard cap is enforced.
- [ ] The day is cut in the board timezone.
- [ ] Commitment writes only a today-membership record — no task fields change.
- [ ] A failed save surfaces a retry and leaves the replay checkpoint in a
      recoverable state.

### Story 6 — zero-change closure

**As a** user with nothing new **I want** a brief "you're caught up" moment **so
that** opening the board feels like mastery, not a dead end.

- [ ] Given no `ReplayItem`s, the mode shows a brief affirmation and goes straight to
      today-list commit.

### Story 7 — aggregation

**As a** user returning after a long absence **I want** the replay to play the ranked
few and summarize the rest **so that** catching up never feels like a punishment.

- [ ] All rank 1–3 items play individually, uncapped.
- [ ] Below rank 3, items play individually up to cap N; the remainder is one final
      expandable aggregate item; expanding lists every summarized task.
- [ ] Nothing is silently dropped.

### Story 8 — contract boundary (enabler)

**As a** developer **I want** a stable, tested `ReplayItem[]` adapter **so that**
independent evolution of the shared logic cannot silently corrupt replay content.

- [ ] Contract tests pin the adapter's output shape and semantics in CI.
- [ ] The adapter is the epic's only consumer of the shared modules.

### Story 9 (P1, out of v1 DoD) — voice-over

**As a** user who prefers listening **I want** spoken updates instead of the ticker
**so that** both my working-memory channels are engaged.

## Non-functional requirements

- Replay holds 60 fps on a board of ≥ 200 tasks; replay entry (button press to
  baseline render) < 500 ms; targets measured on latest two versions of
  Chrome/Safari/Firefox on M1-class hardware.
- Ticker text meets WCAG contrast requirements against the greyed board.
- Pause/resume position survives in-session navigation.

## Metrics

- **Quality gate:** 100% of replay runs end in a rendered state identical to the true
  `asOf` state, zero visual glitches (automated visual regression + manual runs).
- **Product outcomes (hypothesis tests):**
  - Completed replays > immediate skip-alls. A majority skipping immediately means
    the pacing default is wrong — fix the default, don't add features.
  - Time from board-open to first task interaction is lower after catch-up sessions
    than after plain opens (instrumented locally).
  - Median catch-up session (entry → committed today list) ≤ 10 minutes.

## Risks & assumptions

- **Checkpoint/delta infrastructure is the hidden bulk of this epic.** Sizing risk
  lives in snapshot persistence and the adapter, not the animation.
- **The rewind moment is the comprehension risk.** Going visually backwards could
  itself confuse; the trust header and a usability check on the rewind transition are
  the mitigations.
- **Assumption:** existing warning/briefing vocabulary suffices for labels. If
  refinement disproves this, extending those modules is separate, additively-tested
  work.
- **Voice-over (P1)** carries TTS engine questions — must not block v1; the ticker
  alone satisfies the modality design.

## Dependencies

- `shared/task-warning-highlight.ts`, `shared/briefing.ts` (read-only, via adapter).
- New checkpoint persistence (server + schema).
- Today-membership persistence (lightweight; richer today-list features are a
  follow-up epic).

## Definition of Done (epic)

- Stories 1–8 acceptance criteria green, including the reduced-motion variant.
- Contract tests for the `ReplayItem` adapter in CI.
- A test proves replay performs no task-domain writes.
- A recorded end-to-end run: stale board → rewind → replay → committed today list,
  ≤ 10 minutes.
- Story 9 (voice-over) explicitly **not** required for v1.

## Implementation-planning skeleton (from PR #108 review)

1. Document the replay state model (done — this doc) and confirm net-delta semantics.
2. Define and contract-test the `ReplayItem[]` adapter.
3. Implement checkpoint persistence (schema + server).
4. Implement the frozen replay session and headless playback state machine.
5. Build the accessible reduced-motion presentation **first**.
6. Add playback controls and interruption/resume.
7. Add aggregation and zero-change closure.
8. Add today-list commitment (minimal semantics).
9. Add visual regression, performance tests, and product instrumentation.
10. Voice-over as a separate P1 issue.

## Open questions for refinement

1. Cap N for individually-played sub-rank-3 items — tune against the ≤ 10 min
   target. (Product)
2. Checkpoint storage mechanics: dedicated snapshot table vs. watermark +
   task-history reconstruction. The state model requires evaluated outputs at witness
   time, which favours the snapshot; confirm size/retention. (Eng)
3. Ticker copy register: reuse briefing digest strings verbatim, or a shorter
   spoken-register variant per kind? (Product)
4. Today-membership record shape, and the scope line between it and the follow-up
   today-list epic. (Eng/Product)
5. TTS engine for P1: browser SpeechSynthesis vs. server-side. (Eng, non-blocking)
