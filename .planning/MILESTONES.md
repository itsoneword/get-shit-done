# Milestones

## v1.4 Domain-Aware Planning (Shipped: 2026-05-13)

**Phases completed:** 5 phases, 15 plans, 31 tasks

**Key accomplishments:**

- Domain classification router inserted into discuss-phase with UI/Agentic/Generic/UI+Agentic detection, evidence display, confirm/override UX, and structured CONTEXT.md domain fields
- 1. [Rule 3 - Blocking] Applied change to tracked file instead of .claude/ copy
- AGENT-SPEC.md template with 10 design dimensions plus AGENTIC-PATTERNS.md topology reference -- the content layer the gsd-agent-researcher will fill and cite.
- 1. [Rule 3 - Blocking] Test framework mismatch
- 1. [Rule 1 - Bug] Plan verify expected H2 count of 12, actual is 13
- Primitives for the /gsd2:document workflow: init document state contract, two new model-profile entries, and mapper/updater persona files enforcing wikilinks, citation-per-claim, and append-only changelogs.
- 1. [Rule 3 - Blocking] `.claude/` is gitignored — adjusted commit strategy
- End-to-end /gsd2:document workflow wiring init+mapper+updater primitives into FULL/INCREMENTAL/TARGETED modes, plus non-blocking offer_documentation hook before milestone archival — verified by generating 7-subsystem SYSTEM-MAP on this repo
- Three mechanical context cuts: --scoped data trimming on init progress + roadmap analyze, 45-char slug cap, and dedup of progress.md @-include — together saving ~10KB raw / ~13k tokens per /gsd2:progress invocation.
- Machine-readable map of 22 agents, 51 workflows, and 87 gsd-tools subcommands plus a hand-curated risk-surface analysis for the gsd-verifier / gsd-debugger / gsd-fixer trio
- Adapted gsd-verifier and gsd-fixer with loop-invocation modes, added `verify commands` CLI subcommand executing must_haves verify: assertions, and extended phase-prompt.md template with the verify: schema — all four primitives needed for Plan 04-04 to wire the verify-loop into execute-phase.
- Verifier→investigator→fixer loop spliced into execute-phase.md as a sub-flow with ceiling=3, fresh-context spawning, and ceiling-reached CHECKPOINT handoff — wired but not dogfooded.
- Partition-aware phasesDir(cwd) helper introduced in core.cjs and cascaded across 23 callsites; planningPaths().phases is now a getter, init JSON output gains milestone_root/partition_root/legacy_layout_detected/prior_milestones[] fields — all backward-compatible with the legacy .planning/phases/ layout.
- RESEARCH.md §3 (Anti-Patterns)
- Distillation writer (5 typed-tag sections, ROADMAP.md-sourced phase + VERIFICATION.md evidence), migration_hint auto-detect hook, and complete dogfood retrofit of this repo's .planning/ tree under .planning/v1.4/phases/ — SC-5 and SC-8 both closed

---
