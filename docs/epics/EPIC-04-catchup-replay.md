# EPIC-04: Catch-up Replay — the board plays you the news

**Epic type:** Business feature (differentiator)
**Status:** Captured — ready for refinement
**Owner:** Product
**Target:** TBD at refinement
**Source:** Live "catching up and planning a day" use-case session, 14 Aug 2026

## Epic hypothesis statement

> **For** people who struggle to stay on top of their tasks — the late-majority/laggard
> population left behind by power-user tools, including people with executive-function
> difficulties, mental-health barriers, or low tech confidence,
> **who** open the board after time away and cannot cognitively register what changed
> while they were gone (the changes happened silently, in the background),
> **the** Catch-up Replay **is a** playback mode in which the board replays its own
> state changes in human-observable time — one floating task circle spotlighted at a
> time over a greyed-out board, with a ticker or voice-over delivering each update —
> ending in a committed "today" list,
> **that** converts invisible background updates into consciously witnessed ones, at a
> pace the user controls with familiar video controls (play/pause/speed/skip).
> **Unlike** Sunsama's linear planning wizard, Motion's invisible AI auto-scheduling,
> or Tinder-style swipe-triage apps, which are respectively a form, a black box, and a
> slot machine,
> **our solution** keeps the user's own spatial board as the stage and simply plays the
> delta on it — calm, spatial, and one update at a time.
>
> **We will know we are right when** a replay run moves an old board state to the new
> board state with zero visual glitches (the primary acceptance bar for this epic), and
> a catch-up session ends in a committed today list in ≤ 10 minutes.

## Context / problem

1. **The premise is established perception science, not styling.** Change blindness:
   users reliably fail to notice state changes that occur abruptly, during loads, or in
   the background — even large ones (NN/g). Today the board embodies the failure mode:
   due-date rollovers, staleness, and priority drift all happen silently between
   sessions, so the user's mental model and the board diverge. Animated transitions are
   the documented remedy — they show *where* a change happened and *why* — with one
   caveat that shapes this whole epic: **competing simultaneous animations dilute
   attention**. Hence the one-circle rule.
2. **Nobody in the space does this.** Competitors split into guided wizards (Sunsama),
   invisible automation (Motion), command-line triage (Akiflow), and gamified swipe
   decks (TaskSwipe, Task Triage). None replays changes ambiently *on the user's own
   board*. The open territory is calm + spatial + one-at-a-time.
3. **The target population needs it most.** Research on older adults and late
   adopters shows the barriers are usability complexity, low self-efficacy, anxiety,
   and trust — not missing features. Automation that acts silently *erodes* trust;
   watching the system make each move, with a remote control in hand, *builds* it.
   The video-playback metaphor is deliberately chosen because it is already universal:
   no new interaction grammar to learn.
4. **The per-task logic already exists.** `shared/task-warning-highlight.ts`
   (overdue → high-priority backlog → stale) and `shared/briefing.ts` (due buckets,
   urgency ranks 1–3 that "a briefing must never drop") are the surfacing and message
   logic for this epic. This epic is a **presentation layer over existing logic**.

**Design principle for this epic — replay, don't re-render; one circle, one message,
user holds the remote.** The surfacing/urgency logic is consumed read-only. Exactly one
task circle is ever in focus. Every update is delivered through one channel at a time
(ticker *or* voice, never both — see Evidence). Pacing is ambient by default but the
user can pause, change speed, skip one, or skip all, at any moment, using controls that
look like a video player. If a story adds a second simultaneous focus element, modifies
the warning/briefing logic, or invents a novel control, it is out of scope.

## Evidence base (what the psych research dictates)

| Finding | Design consequence |
|---|---|
| Change blindness: background changes go unregistered; animated transitions fix it, but competing animations dilute attention (NN/g) | The replay exists at all; strictly one circle in motion/focus at a time |
| Modality effect (Mayer): narration + visuals uses both working-memory channels, expanding effective capacity | Voice-over is a legitimate P1 delivery channel, not a gimmick |
| Redundancy effect (Mayer): identical simultaneous text + narration *increases* load and impedes processing | Ticker and voice-over are a mutually exclusive user setting; never both for the same update |
| Self-paced beats system-paced for working memory, but segmented system-paced presentation also reduces load | Ambient auto-advance in discrete segments (one update = one segment) with ever-present pause/speed/skip — the video paradigm is the evidence-backed hybrid |
| Task paralysis ≠ procrastination; external scaffolding interventions show moderate-to-large effects (g ≈ 0.54–0.83); one small step at a time lowers the activation barrier | One update at a time; the mode ends by asking for a *small* commitment (today list), not a full re-plan |
| Overwhelm research: long undifferentiated lists increase avoidance; implementation intentions ("when-then") measurably reduce task avoidance | Replay is capped and ranked (briefing ranks 1–3 never dropped; the long tail is aggregated); the committed today list is the implementation-intention artifact |
| Late-adopter/older-adult barriers: complexity, self-efficacy, anxiety, trust | Familiar video controls only; visible cause for every change ("why" on the label); positive closure ("you're caught up") as a mastery/self-efficacy moment |
| WCAG 2.3.3 / vestibular research: large moving elements and drift can cause dizziness and nausea; honor `prefers-reduced-motion` and provide an in-app control | Reduced-motion variant is P0: static crossfade spotlight, one card at a time, no drift. Also decides E12: the 3D ball morph is deferred — motion must be minimal and meaningful, so v1 focus treatment is a 2D circle with gentle scale/elevation |

## In scope

- **Replay engine**: compute the delta between the last-witnessed board state and the
  current state; play it as an ordered sequence of single-task updates (order = existing
  briefing urgency ranks; ties by due bucket).
- **Last-witnessed snapshot**: persist the board state (or watermark) at the end of each
  completed/skipped replay, so the next delta has an anchor.
- **Focus presentation**: board greys out; the in-focus task renders as a slow-moving 2D
  circle; a ticker-style label states the update using existing
  warning-highlight/briefing vocabulary (e.g. "overdue 3 days", "gone stale").
- **Playback controls**: play/pause, speed, skip-one, skip-all. Explicit entry button
  (MVP). Single click on the circle pauses (position retained in state) and reverts the
  board to normal view of that task; user resumes or stays in normal mode.
- **"Am I done?" affordance**: detectable caught-up state; brief visual (or auditory)
  flag of any remaining stale state.
- **Committed today list**: the replay's exit step — user confirms a small today list.
- **Voice-over delivery (P1)**: TTS narration as an alternative to the ticker, mutually
  exclusive setting.
- **Reduced-motion variant (P0)**: crossfade spotlight, no drift, honoring
  `prefers-reduced-motion` plus an in-app toggle.
- **Blast-radius guard**: contract tests pinning this epic's consumption of
  `task-warning-highlight.ts` / `briefing.ts`, so independent evolution of that logic
  is caught, not silently absorbed.

## Out of scope (explicitly)

- **Any change to the surfacing logic** — warning-highlight and briefing modules are
  consumed read-only. They may evolve independently; the contract tests are the tripwire.
- **Card opening and static card display** — unchanged by this epic.
- **3D ball morph / physics** — deferred pending the reduced-motion-first v1; decorative
  motion contradicts the vestibular and attention evidence.
- **Gamification** — no streaks, confetti, sounds effects, or celebration animations;
  calm *is* the differentiation (that territory is owned by the swipe apps).
- **Auto-entry on open** — explicit button only for MVP; session-tracking/suppression
  rules are a later epic.
- **Mobile** — desktop web only for v1.
- **AI-generated narration content** — labels/narration use the existing deterministic
  briefing vocabulary only.

## User stories

1. **As a** returning board user, **I want** to press one button and watch the board
   replay what changed while I was away, one task at a time, **so that** I consciously
   register every move instead of discovering them by accident later.
2. **As a** user who paces differently day to day, **I want** familiar video controls
   (pause, speed, skip), **so that** the replay never outruns or bores me.
3. **As a** user who spots something urgent mid-replay, **I want** one click to pause
   and drop me on that task in the normal board, **so that** I can act without losing
   my place in the replay.
4. **As a** user with a vestibular disorder or motion sensitivity, **I want** a
   drift-free spotlight version, **so that** catch-up doesn't make me dizzy.
5. **As a** user finishing catch-up, **I want** to commit a small today list, **so
   that** the session ends in a plan, not just awareness.
6. **As a** user with nothing new, **I want** a brief "you're caught up" moment,
   **so that** opening the board feels like mastery, not a dead end.
7. **As a** user returning after a long absence (40+ changes), **I want** the replay
   to play the ranked few and summarize the rest, **so that** catching up never feels
   like a punishment.
8. **As a** developer, **I want** contract tests around the consumed briefing/warning
   modules, **so that** independent evolution of that logic can't silently corrupt
   replay content.

### Story 1 (the one that carries the epic) — acceptance criteria

**As a** returning board user
**I want** the board to replay its changes one circle at a time
**So that** I consciously register every move

- [ ] Given a persisted last-witnessed state and a changed current state, when the user
      presses Catch up, then the board greys out and updates play strictly one at a time,
      ordered by briefing urgency rank.
- [ ] The full run transitions the rendered board from the old state to the exact
      current state with **zero visual glitches** (no flicker, teleporting cards,
      mis-parented circles, or label/task mismatches) — the epic's primary acceptance bar.
- [ ] Each update's label states the task and the reason, using only existing
      warning-highlight/briefing vocabulary.
- [ ] Skip-all lands the board in the exact current state instantly.
- [ ] Given zero changes, the mode shows a brief caught-up affirmation and goes
      straight to today-list commit.
- [ ] Given more than N changes (N set at refinement), ranks 1–3 all play individually;
      the remainder is delivered as one aggregate update ("+12 minor changes"), never
      silently dropped.

## Non-functional requirements

- `prefers-reduced-motion` honored automatically; in-app motion toggle regardless of OS
  setting (WCAG 2.3.3).
- Replay animation holds frame rate on a board of ≥ 200 tasks (glitch-free bar is
  visual *and* temporal).
- Pause/resume position survives navigation within the session.
- Ticker text meets contrast requirements against the greyed board.

## Metrics

- **Primary (F16):** 100% of replay runs end in a rendered state identical to the true
  current state, with zero visual glitches (automated visual regression + manual runs).
- Median catch-up session (entry → committed today list) ≤ 10 minutes.
- Skip-all rate: if > 50% of sessions skip-all immediately, the pacing default is wrong
  — investigate, don't add features.
- Catch-up initiated on a meaningful share of returns after ≥ 12h away (baseline first).

## Risks & assumptions

- **Snapshot/delta infrastructure is the hidden bulk of this epic.** Replay needs a
  reliable "last witnessed" anchor; task history exists, but a dedicated snapshot or
  watermark is likely needed. Sizing risk lives here, not in the animation.
- **Assumption:** the existing warning/briefing vocabulary is sufficient for labels.
  If refinement finds it isn't, that is a *separate* epic on the shared modules.
- **Voice-over (P1)** carries TTS engine/licensing questions — do not let it block v1;
  ticker alone satisfies the modality design via the mutually-exclusive setting.
- **Attention risk:** if ambient default pacing proves wrong for the audience, the fix
  is the speed slider default, not new mechanics.

## Dependencies

- `shared/task-warning-highlight.ts`, `shared/briefing.ts` (read-only consumption).
- Task history / new snapshot persistence (server + schema work).
- Today-list persistence (may be a new lightweight entity — open question).

## Definition of Done (epic)

- Story 1 acceptance criteria green, including reduced-motion variant.
- Contract tests pinning consumed logic in CI.
- Zero modifications landed in the consumed shared modules.
- A recorded end-to-end run: stale board → replay → committed today list, ≤ 10 min.

## Open questions for refinement

1. Snapshot mechanism: full board snapshot vs. watermark + task-history replay? (Eng)
2. Today list: new entity, or a tag/flag on tasks for the labeled day? (Eng/Product)
3. Cap N for individually-played updates before aggregation — 7? 10? (Product, tune
   against the ≤ 10 min target)
4. Ticker copy: exact phrasing per highlight kind — reuse briefing digest strings
   verbatim or a shorter spoken-register variant? (Product)
5. TTS engine for P1 voice-over: browser SpeechSynthesis vs. server-side? (Eng)
