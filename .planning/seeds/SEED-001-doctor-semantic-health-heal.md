---
id: SEED-001
status: dormant
planted: 2026-06-04
planted_during: v1.5 / Phase 3 discussion (execution-detail-enrichment)
trigger_when: documentation health, planning-context maintenance/reduction, stale-decision detection, or any extension of health/repair tooling enters scope — candidate for late v1.5 or a future milestone, once Phase 3 (GUIDE docs) lands
scope: Medium
---

# SEED-001: The "doctor" — agent-assisted semantic health/heal command

## Why This Matters

GSD's real defense against context bloat is **preventing the bloat at the source**, not measuring it. During Phase 3 discussion the user explicitly rejected a human-facing context-utilization classifier ("there is no need to inform me about this problem… there is only need to fix it"). The keep-context-tiny goal is met structurally — keep only the *latest* state in active docs and move superseded decisions to prior versions, so `/progress` and every workflow load minimal content.

The doctor is the agentic piece that makes this self-maintaining: it reads the planning documentation, detects **decisions that were documented and later overwritten/superseded**, and heals the docs by archiving the stale ones. This protects model output quality (less loaded context = less degradation) *and* keeps the human oriented with just-enough context — both halves of the project north-star (minimize human round-trips / human context-load).

This is the coherent inverse of gsd-core's context-budget approach: core **measures and reacts** to a full window (the `context-utilization` classifier); the doctor **removes the cause** so the window never fills with stale decisions.

## When to Surface

**Trigger:** documentation health / context-reduction / stale-decision detection / health-tooling extension enters a milestone's scope.

Present during `/gsd2:new-milestone` when the milestone scope matches any of:
- Maintaining or reducing planning-context size (distillation, archiving, "keep docs tiny")
- Detecting or resolving superseded/overwritten decisions across artifacts
- Extending health/diagnostic/repair tooling beyond structural integrity into *semantic* correctness
- Any agent-assisted "clean up / heal the planning directory" capability

## Scope Estimate

**Medium** — a phase or two. Needs planning: it's an agent + skill layered on existing tooling, not a one-file change. A bounded agent loop reads artifacts, identifies superseded decisions (semantic, not regex), proposes/executes archival to prior versions, with a confirmation/preview pass.

## Design Constraints (carried from the originating discussion)

- **Not greenfield — extend, don't rebuild.** A *semantic* layer on top of the existing `/gsd2:health` (diagnose) + `gsd-tools validate health --repair` (structural repair). Fold health INTO the doctor; doctor = diagnose + fix.
- **Inherits reshaped CTX-01/CTX-02 intent** (keep context lean) but NOT CTX-02's token-% thresholds — the doctor measures **stale-decision count**, not token %.
- **Honor the north-star design bias** (Phase 2): a **skill + bounded agent loop**, not a zoo of special-case agents. One loop that raises autonomy, not many agents.
- **Preview before heal** — archiving decisions is destructive to active docs; mirror the two-pass (propose diff → apply on confirm) pattern used by the document-updater.

## Breadcrumbs

- `.claude/get-shit-done/workflows/health.md` — existing diagnose workflow to fold in / extend
- `.claude/get-shit-done/bin/gsd-tools.cjs:573` — `validate health [--repair]` dispatch (`cmdValidateHealth`)
- `.claude/get-shit-done/bin/lib/verify.cjs` — `cmdValidateHealth` implementation (structural integrity + repair)
- `.planning/cross-phase-notes.md` — "From Phase 3 discussion (2026-06-04)" entry with the user's verbatim framing
- `.planning/v1.5/phases/03-execution-detail-enrichment/03-CONTEXT.md` — Deferred Ideas → doctor; the reshape rationale
- `.planning/REQUIREMENTS.md` — CTX-01, CTX-02 marked `Reshaped → doctor`
- `.planning/reference/COMPARISON.md` §"Context-Budget / Engineering Maturity" (~line 1077) — gsd-core's measure-and-react approach the doctor inverts

## Notes

Planted while planning Phase 3 in parallel with Phase 2 execution. The user said "think about it" — i.e., park with intent, not discard. Phase 3 was reshaped to GUIDE-only (anti-pattern/bug-pattern/Python docs); the entire context-budget cluster migrated here.
