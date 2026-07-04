# Milestones

## v1.6 Autonomous Supervision Harness (Shipped: 2026-07-04)

**Phases completed:** 6 phases, 16 plans, 31 tasks

**Key accomplishments:**

- **Phase 10 — Decision ledger + CLI foundation:** append-only `DECISIONS.jsonl` and `MAILBOX.jsonl` with `dec-NNN`/`q-NNN` ids, write-time field validation, and a `GSD_RUN_ID` run-context gate (interactive sessions unchanged), surfaced as `gsd-tools ledger`/`run`/`mailbox` subcommands
- **Phase 11 — Escalation contract + discuss-phase wiring:** deterministic contract (24 conditions across 4 criteria → proceed / proceed-and-log / park-and-ask) with an inline evaluator spliced into `discuss-phase` that writes a write-once ledger verdict, plus a 14-scenario calibration golden set
- **Phase 12 — Park-don't-block mailbox:** SHA-256 content-hash park/staleness/stuck primitives (`lib/park.cjs`) and a stdin-driven inbox CLI with targeted-answer and interactive-review commands, park↔mailbox boundary strictly enforced
- **Phase 13 — Overnight runner:** `autonomous.md` made unattended-capable (`--phase N`, harness mode, all human pauses routed to mailbox or `PHASE RESULT failed`); sandbox-first posture, 16-token `run.log` observability grep-contract, ESC-03 gate fails closed until human calibration
- **Phase 14 — Multi-lens discussion loop:** `/gsd2:discuss-loop` with 3-round parallel lens judgment (`lib/discuss-loop.cjs` + three versioned lens agents), deterministic convergence check, and mailbox/in-session bifurcation — live smoke run confirmed end-to-end
- **Phase 15 — Resume logic + triage worker:** autonomous resume branch (replay parked snapshot after staleness gate, idempotency-safe) and a propose-never-dispose `/gsd2:triage` writing six-verdict proposals to the mailbox for human-only routing

**Known tech debt (from v1.6 audit):** deferred human-UAT on phases 11 & 14; ESC-03 live-run calibration gate must be completed before the first real overnight run (tracked as a pending todo).

---

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
