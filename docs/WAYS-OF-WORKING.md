# Ways of working

**Status:** Live — the practice this repo's documents follow
**Established:** 15 August 2026

This project is developed by one person, but deliberately uses recognised agile
artifacts rather than ad-hoc notes. This document names the practice so the other
documents in `docs/` are legible to anyone picking them up.

## Document taxonomy

The three artifact types are kept separate because they have different change
cadences. Collapsing them into one file is what makes documentation rot.

| Artifact | Location | Changes | Lifecycle |
|---|---|---|---|
| Now-Next-Later roadmap | `docs/BACKLOG.md` | Weekly, constantly reordered | Mutable, always current |
| Epic specifications | `docs/epics/EPIC-xx-*.md` | On refinement | Versioned (e.g. "v2") |
| Architecture Decision Records | `docs/adr/NNNN-*.md` | **Never** | Append-only; superseded, not edited |
| Architecture overview | `ARCHITECTURE.md` | On structural change | Mutable |

**ADRs are immutable by design.** When a decision changes, write a new record that
states it supersedes the old one. Editing a past decision destroys the only thing an
ADR is for: reconstructing why a choice was made, without present-you having quietly
overwritten the evidence.

Format: [MADR](https://adr.github.io/madr/) (Markdown Any Decision Record). The
minimal variant is about eight lines. Templates at
[adr.github.io/adr-templates](https://adr.github.io/adr-templates/).

## Frameworks in use

The epic documents follow **SAFe** conventions:

- **Epic hypothesis statement** — the `For / who / the / that / unlike / our solution`
  form, closing with a falsifiable "we will know we are right when".
- **Epic typing** — `Business feature` vs `Enabler`, where enablers are the technical
  work that makes features possible.
- **Definition of Done** per epic.
- **Leading and lagging metrics** — quality gates distinguished from product outcomes.

The backlog follows **Now-Next-Later**: ordered by dependency and value, not dated.
Later items stay deliberately thin; detail is added as an item approaches Now. Vague
at the horizon and sharp up close is the intended gradient, not an omission.

## Technical debt policy

**Debt is tracked as enabler epics in the same ranked backlog as features.** There is
deliberately no separate debt register — separate lists become graveyards, because
debt never competes against features for a slot and therefore never wins.

Two rules for a debt item to be actionable:

1. **Quantify the interest rate, not the principal.** The useful measure is what the
   debt costs per unit time, not how unpleasant the code is. EPIC-03's "533 KB of a
   547 KB payload, paid by every consumer on every read" is the model.
2. **State a trigger condition.** Either it is scheduled, or it carries a "fix this
   when X happens" clause. Untriggered debt rots in the list.

## Accessibility standard

Work targets **WCAG 2.1 AA** as a floor, aligning with the
[NZ Government Web Accessibility Standard](https://www.digital.govt.nz/standards-and-guidance/design-and-ux/accessibility),
and follows the user-centred and inclusion principles of the
[Digital Service Design Standard](https://www.digital.govt.nz/standards-and-guidance/digital-service-design-standard/principles).

Some work exceeds the floor where evidence justifies it — EPIC-04 specifies
`prefers-reduced-motion` handling against **WCAG 2.3.3** (a AAA criterion), because
the vestibular and cognitive-load research behind that epic makes motion safety a
functional requirement rather than a compliance checkbox.

Accessibility requirements belong in epic acceptance criteria, not in a separate
remediation pass.

## Cadence

Adapted for a team of one — the ceremonies that survive are the ones with an artifact:

- **Weekly (20 min)** — review the backlog, reorder Now, pull exactly one item.
- **Monthly** — retrospective on one question: what slowed me down? Answers become
  backlog items or ADRs.
- **Per epic** — Definition of Done is the highest-value solo artifact, because there
  is nobody else to say a thing is not finished.

## Conventions

- **Commits** — [Conventional Commits](https://www.conventionalcommits.org/)
  (`docs(epics):`, `fix(board):`, `feat(api):`).
- **Branching** — short-lived branches off `main`, merged via PR. Documentation
  changes are PR'd like code, so decisions get a review trail.
- **Reviews** — review feedback is answered by a revision that maps each point to a
  resolution, rather than by argument in comments. EPIC-04 v2 (PR #108 → #114) is the
  worked example.
