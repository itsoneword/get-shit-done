# Phase 5: Milestone-versioned phase IDs - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-05-10
**Phase:** 05-milestone-versioned-phase-ids
**Status:** Discussion paused mid-session — user continuing on another workstation. CONTEXT.md "Open Items" lists what's still to drill.
**Decisions captured:** 6 strong, 0 weak, 0 discretion (1 sub-decision marked [DISCRETION] under success criteria — exact load window)

---

## Conversation Summary

### Phase intent (was missing — only a title existed)
**User's perspective:** Mid-milestone phase additions and decimal insertions accumulate. By v1.4 end, the planning tree is wide and half-finished. `/gsd2:progress` ingests ~60k tokens. `complete-milestone` bumps the label but keeps phase numbering effectively global, so v1.5 still inherits the mess. Real fix: milestones are *partitions*, not labels — each is a self-contained tree where phases reset to 1, 2, 3… Closing a milestone produces a *distilled* artifact (summary + critical decisions) that the next milestone reads instead of the full prior tree. Backward compat is non-negotiable.
**Decision:** Phase scope = partition + distillation, bundled. Phase ships capability, does NOT close v1.4.
**Signal:** [STRONG] — user gave detailed reasoning, drew the conceptual line ("milestones become partitions, not labels") clearly, and explicitly redirected when I proposed framing this as a v1.4 transition: "I would not think on finishing milestone 1.4 at the moment at all, lets concentrate on phase".

### Success criteria framing
**User's perspective:** Token count is project-dependent and unmeasurable in the abstract. The right metric is *what's loaded* — current phase ± 1 or 2, plus high-level docs, not all 20 phases.
**Decision:** Success metric is structural, not numeric. Type-of-load is locked; concrete window is [DISCRETION] for the planner.
**Signal:** [STRONG, user-override] — I had proposed token reduction as a success criterion; user pushed back with cleaner framing.

### Auto-retrofit on apply
**User's perspective:** "If I update gsd in project where it was done differently — it understand what to do." Backward compat must be flawless.
**Decision:** When the phase code lands, GSD detects old layout and auto-migrates the current project under `.planning/v1.4/phases/...`. No manual migration command. The retrofit doubles as the integration test of the migration path.
**Signal:** [STRONG] — user agreed with my proposal: "I agree with auto option too".

### Graph and RAG as separate phases
**User's perspective:** Partitioning is a workaround. The structural fix is a graph (tags/weights linking decisions, phases, requirements). The long-tail fix is RAG. The user noticed existing tag infrastructure (verification tags, success criteria) and suggested graph would leverage that. He asked whether graph belongs in Phase 5 or as a separate phase.
**Decision:** Graph = Phase 6, RAG = Phase 7. Phase 5 produces graph-friendly substrate (typed tags, explicit links in distill artifacts) so Phase 6 indexes it without retrofitting.
**Signal:** [STRONG] — user agreed with my push-back: "lets do it... description on graph\rag implementation".

### Cross-machine continuity
**User's perspective:** Wants to capture state and push so a second workstation can resume.
**Decision:** Pause discussion at current depth. Write CONTEXT.md with explicit "Open Items" section enumerating undrilled questions. Append cross-phase notes for Phase 6/7. Commit and push to origin.
**Signal:** [STRONG] — explicit user request.

---

## Open Items (carried into next session)

Listed in CONTEXT.md `<open_items>`:
1. ID literal shape — milestone in path only, or baked into ID?
2. Distillation artifact contents — what gets carried forward?
3. Migration trigger UX — silent / prompt / dry-run?
4. Reference rewrite scope — which files get IDs updated automatically?
5. Active milestone identifier source — STATE.md `milestone:` field?

---

## Established (Not Discussed)

- Decimal phase support already exists (preserved as-is)
- `padded_phase` / `phase_dir` / `phase_number` JSON contract from `gsd-tools init phase-op` is the workflow API (extended, not renamed)
- Source vs runtime mirror split — edits go to `get-shit-done/` and `commands/gsd2/`, not `.claude/`
- Quick-tasks have parallel ID scheme — precedent for non-uniform IDs

---

## Deferred Ideas

- Milestone v1.4 closure (separate user decision after Phase 5 lands)
- Phase 6 (Graph) — captured in cross-phase-notes.md
- Phase 7 (RAG) — captured in cross-phase-notes.md
