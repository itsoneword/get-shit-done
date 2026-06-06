# Phase 7: Parallel Multi-Session Safety & Planning Ergonomics - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-06
**Phase:** 07-parallel-multi-session-safety-planning-ergonomics
**Decisions captured:** 6 (1 strong-override, 5 weak/recommendation-backed — two with strong sub-components)

---

## Conversation Summary

The roadmap discussion-focus had already locked the heavy conceptual model (two coupling axes, worktree-for-A, sequencing-for-B, deterministic-not-prose, Phase 6/7 boundary), so discussion focused on the open ergonomic/preference choice points. User selected all 4 offered gray areas, then answered 6 concrete choice points.

### A — Merge ergonomics
**Decision:** Auto-merge if clean, pause + reviewable diff only on conflict.
**Signal:** WEAK, recommendation-backed — picked recommended from explained tradeoffs.

### B — Parallel-safety gate force
**Decision:** Deterministic, baked-in. Hard-refuse axis-B (depends_on) parallel discuss/plan; warn-only on axis-A file-scope overlap.
**Signal:** WEAK, recommendation-backed; axis-B-hard-refuse half is effectively STRONG (restates roadmap success criterion).

### C — Quick-fix convention
**Decision:** `/gsd2:quick` auto-worktrees on detected concurrent execution; in-place fallback.
**Signal:** WEAK, recommendation-backed; reinforced by the STRONG deterministic-not-prose principle.

### D — Backlog ID scheme
**Decision:** `B1, B2` non-phase IDs; real phase number only on promotion. Replaces 999.x.
**Signal:** WEAK, recommendation-backed — matches roadmap candidate direction.

### E — Doctor symmetry-check shape
**Decision:** Fold into `/gsd2:health` (+`--repair`) AND call same check as execute-phase post-merge step. No new command; `/gsd2:doctor` name reserved for the future semantic healer.
**Signal:** WEAK, recommendation-backed; no-new-command intent is STRONG (PROJECT + Phase 6 bias).

### F — Scope & sequencing
**Decision:** All 5 items land in Phase 7. **Phase 6 must hard-close before Phase 7 starts.**
**Signal:** STRONG, user-override — user overrode the recommendation (and the roadmap's "may start 7 before 6 closes"). Converts soft relation into a hard dependency.

## Established (Not Discussed)
- Two-axis coupling model (A=file→worktree, B=decision→sequencing).
- Isolation deterministic in execute-phase + session-launch convention, never agent prose.
- Phase 6 ships worktree technique; Phase 7 wires it.
- Gate reuses Phase 4 file-dep graph + existing depends_on parsing.
- Source↔runtime mirror rule (the doctor check's invariant).

## Deferred Ideas
- Semantic stale-decision healer doctor (keeps /gsd2:doctor name) — future.
- RAG/semantic retrieval — far future.
- worktree-path-guard hard-block hook (SEC-DEFER-01 reversal) — follow-up.

## Notes
- No micro-research spawned — all 6 choice points were preference/ergonomics; technical mechanics settled by Phase 6 (technique) + Phase 4 (graph) + standard git worktree.
