# GSD (Get Shit Done)

## What This Is

A framework that shifts AI-assisted development from "write code, fix bugs" to "plan deeply, execute cleanly." GSD orchestrates Claude Code (and other AI CLIs) through structured workflows: discuss, plan, execute, verify. It manages planning artifacts, phase tracking, parallel agent execution, and state persistence across sessions.

## Core Value

Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

**Operating principle — minimize the human round-trip.** The bottleneck in AI-assisted development is no longer the model; it is the human in the loop. Every time Claude Code stops to ask a question or hand back output, a fast system waits on a slow human — and most of those questions the model could have answered itself. GSD's job is twofold: keep the human oriented with *just-enough* context (no human holds 10 objectives × 10 plans × 10 details), and reserve human input for judgment only a human can supply — taste, preference, intent ("do you want it to work this way?"), never "which technical approach." Everything the model can resolve — technical choices, research, documentation — it should resolve autonomously. Bias toward **loops and skills that raise model autonomy over proliferating special-case agents.**

## Current Milestone: v1.7 Planning-Graph Layer

**Goal:** Unify GSD's seven fragmented edge encodings behind one `graph.cjs` model and compute what the metadata already promises but no code delivers — topological order, code-enforced cycle detection, and transitive `affects` closure — then promote the graph from an advisory validator to the authoritative source for wave ordering and context selection.

**Guiding principle:** Advisory before authoritative. Ship the graph read-only first (a `/gsd2:health` integrity check, zero behavior change), earn trust from clean integrity numbers, then let it drive parallel-safety, wave computation, and plan-phase context selection — the same rollout the symmetry-check used.

**Target features:**
- Normalized graph model — one `graph.cjs` reading phase `depends_on`, plan `depends_on`/`wave`, `files_modified` overlap, SUMMARY `requires`/`provides`/`affects`, PLAN `key_links`, requirement→phase, and todo edges into a single node/edge structure
- Graph algorithms — `topoSort`, code-based `detectCycles` (replacing the LLM-eyeball cycle check), `blastRadius` transitive `affects` closure; surfaced as `gsd-tools graph analyze|validate|blast-radius|export`
- Integrity check — `/gsd2:health` flags dangling references, cycles, and `affects`-vs-`files_modified` contradictions (the trust gate before going authoritative)
- Consumer repoint — `parallel-gate.cjs` coupling decision and `overnight.md` BLOCKED/SKIPPED traversal read the graph instead of ad-hoc regex
- Authoritative promotion — computed/cross-checked waves in `phase.cjs` and `requires`-closure context selection in plan-phase (overrides planner/executor output)

## Current State

**v1.7 Phase 17 (Graph Algorithms + Integrity Check) complete — 2026-07-05.** The GRAPH-04/05/06 set shipped on top of Phase 16's read-only model, all advisory (computes and reports, changes no consumer's execution behavior). `graph.cjs` gained `topoSort` (Kahn over `depends_on`), `detectCycles` (Tarjan SCC naming the actual cycle participants, not the Kahn-stall residual), `blastRadius` (forward BFS over `affects`+`provides`, N-hop levels), and a shared `computeGraphIntegrity` pure function; surfaced as `gsd-tools graph validate` (two-tier severity — structural = cycles + dangling structural refs = fatal/exit-nonzero; advisory = dangling advisory refs + `affects`-vs-`files_modified` contradictions = warn/exit-zero; `--strict` promotes all, a dev/CI convenience that is NOT the Phase-19 gate) and `gsd-tools graph blast-radius <node>` (unknown node → exit-nonzero). `/gsd2:health` Check 10 reuses `computeGraphIntegrity` with the same split (structural→`error`, advisory→`info`, never `--repair`-able; codes `E-GRAPH-*`/`I-GRAPH-*`). Implementing `detectCycles` verbatim caught a real live-repo false-positive cycle (`plan:16-01`↔`plan:16-02`, an arbitrary-direction `files_modified` edge running opposite a genuine `plan_depends_on` edge), fixed by excluding non-ordering `files_modified` edges from sort/cycle traversal only (`NON_ORDERING_DEPENDS_ON_SOURCES`) — dangling-ref tiering unaffected. Live repo now: plain `validate` exits 0 (structural clean) reporting 6 advisory contradictions — the reviewable "clean numbers" that gate Phase 19. 25 new tests (graph + health). Verification: 6/6 must-haves. Next: Phase 18 (consumer repoint) / the Phase 19 trust-gate promotion.

**v1.6 Phase 15 (Resume Logic + Backlog Triage Worker) complete — 2026-06-18.** The TRIAGE + PARK-03 requirement set shipped, closing the v1.6 milestone's last phase. `lib/triage.cjs` provides the structural layer — `parseRoadmapBacklog` (ROADMAP `## Backlog` parser), `buildTriageProposal` (mailbox-ready proposal hardcoding `status: 'pending'` and a `triage-verdict:` context prefix — the type discriminator the inbox keys on), `pendingProposalExists` (dedup), `supersedingRecordExists` (resume idempotency), and `cmdTriageRun` wired into `gsd-tools triage run`; verdict *reasoning* lives in workflow prose, not code. `autonomous.md` gained step 3a.0 (HARNESS_MODE-only resume branch, PARK-03): an answered parked question re-reads planning state, runs the `park staleness --raw` gate (clean → proceed; drift → re-park with `PHASE RESULT: parked`), checks for an existing superseding ledger record (idempotency) before writing the settled answer to CONTEXT.md → appending a superseding ledger record → replaying the blocked step, with machine-greppable failure tokens (`staleness-parse-error` / `context-write-error` / `ledger-write-error`) and a byte-equivalent interactive path. Workflow wiring: `overnight.md` step 6.5 runs the triage worker after the phase loop and before the morning report (failure logs `PHASE_FAILURE phase=triage` and continues); `inbox.md` presents `triage-verdict:` entries with a distinct Verdict/Item/Evidence template whose accept path *prints* the routing command but never executes it (propose-never-dispose, enforced and stated); `/gsd2:triage` (workflow + command stub) drives standalone six-verdict assignment (already-done / obsolete / fold-into-phase / new-phase / needs-input / defer). 17 new triage tests; verification 14/14 must-haves. **All v1.6 Autonomous Supervision Harness phases (10–15) complete.** Next: milestone audit / archival (`/gsd2:audit-milestone` → `/gsd2:complete-milestone`).

**v1.6 Phase 14 (Multi-Lens Discussion Loop) complete — 2026-06-12.** The LOOP requirement set shipped: `lib/discuss-loop.cjs` + `gsd-tools discuss-loop` primitives (loop-id, transcript append-only JSONL, position-block validation with mechanical verbatim-anchor substring checks — LOOP-01 enforced in code, not prose; round delta via deterministic flag checks `no blocking lenses AND no new constraint ids`, never sentence similarity; survivors pass-through with zero synthesis path — LOOP-02), three fresh-context lens agents (`gsd-lens-skeptic` / `gsd-lens-user-advocate` / `gsd-lens-architect`, Read/Grep/Glob only, locked position-block schema), and `workflows/discuss-loop.md` + `/gsd2:discuss-loop` (artifact/decision resolution, ≤3 rounds of three parallel lens spawns with one corrective re-spawn per failed validation and a degraded ladder, converge → escalation-contract-gated application + run-gated ledger record, or escalate → labeled per-lens positions: mailbox in autonomous context, in-session interactively — never a blended option). Verified by a live orchestrator-level smoke run (3 rounds, escalated, full transcript audit, zero mailbox/ledger writes interactive) — 14-HUMAN-UAT 4/4. 28 new tests. Findings logged: hard-wrapped artifacts burn lens retries on anchor validation; `survivors` CLI takes a nested per-round array (workflow prose reads flat). Next: Phase 15 (resume logic + backlog triage worker).

**v1.6 Phase 13 (Overnight Runner) complete — 2026-06-12.** The RUN requirement set shipped: `gsd-tools run record-phase` / `run status` / `run report` (validated tool boundary for per-phase outcome records, terminal run status, and a plain-text morning report rendered from exactly three run artifacts — RUN-META.json, DECISIONS.jsonl, MAILBOX.jsonl — with corrupt-JSONL skip-and-count, never a crash), `autonomous.md` harness wiring (`--phase N` single-phase selector with the machine-greppable `PHASE RESULT: (completed|parked|failed)` outcome contract; with `GSD_RUN_ID` set the discuss step delegates to `discuss-phase --auto` so the Phase 11/12 evaluator+park machinery fires, and every AskUserQuestion pause routes to mailbox-park instead of blocking — interactive behavior byte-equivalent), and `workflows/overnight.md` + `/gsd2:overnight` (orchestrator-level harness wrapper: fail-closed ESC-03 health check via case-sensitive PASS grep, run init, sequential phase loop with skip-to-independent, per-phase worktree lifecycle where the `clean` JSON field — never exit code — is the merge truth and conflicts route structured mailbox entries, AUTH_FAILURE hard stop with zero silent retries, 16-token typed run.log, cron line documented not installed) plus inbox-first morning composition (`/gsd2:inbox` prints `run report` as its session header). Verification: 10/10 must-haves; 32 new ledger tests. **Operational gate: the overnight health check fails closed until a human completes `11-CALIBRATION.md` (ESC-03 sign-off).** Next: Phase 14 (multi-lens discussion loop — executing in a parallel session).

**v1.6 Phase 12 (Park-Don't-Block Mailbox) complete — 2026-06-12.** The PARK requirement set shipped: `lib/park.cjs` (SHA-256 content-hash parking snapshots, staleness detection re-hashing STATE/ROADMAP/cross-phase-notes/CONTEXT against park-time hashes, stuck detection via two-consecutive-identical-decisions-hash threshold; CLI `park create`, `park staleness`, `run snapshot`), the human-facing inbox CLI (`mailbox answer` for targeted terminal-state updates, `mailbox review` stdin loop over all pending questions with inline context/options/evidence and resume handoffs surfacing staleness the moment a question is answered), the discuss-phase park branch (autonomous context with GSD_RUN_ID writes mailbox pending + park snapshot and halts with PHASE PARKED — the Phase 11 placeholder is gone; interactive flow byte-identical), and the thin `/gsd2:inbox` skill (command stub + workflow: one morning discussion session over all parked questions). Replay-after-resume is deferred to Phase 15 by design. 74 new tests (50 park + 24 mailbox); 1042 total pass. Verification: 4/4 must-haves. Next: Phase 13 (overnight runner — still gated on the human calibration sign-off in `11-CALIBRATION.md`).

**v1.6 Phase 11 (Escalation Contract + discuss-phase Wiring) complete — 2026-06-12.** The ESC requirement set shipped: `get-shit-done/references/escalation-contract.md` (4 criteria — irreversibility, security boundary, scope change, spec ambiguity — as 24 numbered discrete conditions mapped to the proceed / proceed-and-log / park-and-ask verdict schema, with tie-break rules), an inline evaluator sub-step inside discuss-phase's `question_triage` that fires only when `GSD_RUN_ID` is set and writes verdict+reason in the single write-once `ledger append` call (interactive sessions byte-identical), a 14-scenario golden set (`11-GOLDEN-SET.md`), and the `11-CALIBRATION.md` gate witness (ships PENDING, zero uppercase "PASS" tokens — Phase 13's overnight runner stays blocked until a human fills it after a live calibration run; see `11-HUMAN-UAT.md`). Next: Phase 12 (park-don't-block mailbox).

**v1.6 Phase 10 (Decision Ledger + CLI Foundation) complete — 2026-06-11.** The shared persistence layer for the supervision harness shipped: `lib/ledger.cjs` (append-only `DECISIONS.jsonl`, write-time validation of decision/alternatives/evidence/confidence/escalated, GSD_RUN_ID run-context gate so interactive sessions never write), `lib/mailbox.cjs` (`MAILBOX.jsonl` append/list with q-NNN ids, same gate), and `gsd-tools run init` enforcing the `.planning/run/<run-id>/` layout (gitignored). CLI: `ledger append/list/filter --phase/--escalated`, `mailbox append/list --status`. 24 new unit tests; 983 total pass. Verification: 10/10 must-haves. Next: Phase 11 (escalation contract + discuss-phase wiring).

**v1.4 Domain-Aware Planning — shipped 2026-05-13**

Domain router, AGENT-SPEC, documentation agent, verification harness, and milestone-partitioned layout all shipped. Planning directory migrated to `.planning/v1.4/phases/`. v1.5 Capability Port in progress — Phases 1 (Security Hooks), 2 (Autonomous Technical Resolution), 3 (Execution-Detail Enrichment), 4 (Agent Observability Telemetry), and 5 (Plan-Loop Convergence and Verify Fix) complete. Phase 4 added a `PostToolUse`/`PostToolUseFailure` (`matcher: Task|Agent`) telemetry hook that records every `gsd-*` subagent spawn — timestamp, agent type, scraped confidence verdict — to a gitignored `.planning/telemetry/agent-trace.jsonl`, plus a `gsd-tools trace` reader, all in code/config with zero prompt-file changes. Phase 5 made the plan-phase revision loop convergence-aware (a non-decreasing BLOCKER+WARNING trajectory across all 3 iterations now emits a `## STALL DETECTED` block and escalates rather than silently completing) and fixed the v1.4-carryover `parseMustHavesBlock` indent bug (dynamic child-indent detection so `verify artifacts`/`verify key-links` parse real 2-space plans). Phase 6 (Skill Self-Sufficiency) audited all 14 superpowers skills (`06-AUDIT.md`) and ported the 4 genuine gaps as native references/edits: execution-time TDD discipline (Iron Law + watch-it-fail + agent-edit exemption in `tdd.md`/`gsd-executor`/`gsd-planner`), `receiving-code-review.md` (wired into `review.md`/`ship.md`), `artifact-authoring.md`, and `git-worktree.md` (technique only — Phase 7 wires the orchestration). All automated checks + 912 unit tests pass; **the end-to-end behavioral proof (SC3) is deferred to a real prod plan→execute run — see `cross-phase-notes.md` Phase 6 "PENDING MANUAL VERIFICATION" and `06-HUMAN-UAT.md`; clear it with `/gsd2:verify-work 6`.** Phase 7 (Parallel Multi-Session Safety) wired the worktree orchestration + the axis-A/axis-B parallel-safety gate. Phase 8 (Validated Example Corpus) shipped a pattern-indexed corpus of validated, human-maintained code excerpts under `get-shit-done/references/validated-examples/` — 6 seed entries (3 Python: requests/pydantic/CPython, 3 Node-TS: undici/zod/fastify-env-schema), each a short attributed excerpt + commentary, indexed by a slim `INDEX.md` the planner reads on-demand via `agents/gsd-planner.md`'s `<code_quality_reference>` pointer. Each entry's `counters:` front matter maps to exact `common-bug-patterns.md` section headers, structuring the corpus as the Phase 9 eval/reference substrate. Phase 9 (Self-Improving Skills, feedback-driven) shipped the online skill-evolution loop: a `.planning/lessons/` JSONL ledger + `gsd-tools lesson` CLI (append/list/update/bump-recurrence/attribute/scan — attribution a unit-tested pure function, scan nominate-only), plus a `/gsd2:teach` command + `workflows/teach.md` running observe→attribute→advisor-critic bounded edit (≤20 lines/one section)→[y/N] ratify→source-only commit + separate ledger commit→`npm run dev`. The apply commit is source-only (zero `.claude/`) so the `git revert` undo stays conflict-free; mechanical guarantees (no-auto-apply, source-only, reversibility) were dogfooded on the gsd repo itself this session, which surfaced and fixed a real two-commit-ordering bug. **v1.5 Capability Port complete — all 9 phases shipped.** SC2/SC3/TEACH-05 carry a `09-HUMAN-UAT.md` for independent interactive verification in a real project (`/gsd2:verify-work 9`).

## Last Completed Milestone: v1.6 Autonomous Supervision Harness

**Goal:** Delegate the human's job of monitoring 5–10 parallel GSD sessions to an agentic supervision loop with predictable, auditable escalation — the human reviews one inbox of logged decisions and parked questions instead of babysitting tabs.

**Shipped (v1.6.0–v1.6.2, 6 phases, 16 plans, archived 2026-07-04):** decision ledger + mailbox persistence, escalation contract + discuss-phase evaluator, park-don't-block mailbox + inbox, overnight runner, multi-lens discussion loop, resume logic + triage worker.

**Known tech debt:** deferred human-UAT on phases 11 & 14; ESC-03 live-run calibration gate must be completed before the first real overnight run (tracked as a pending todo). v1.5 archival still pending (`/gsd2:complete-milestone` v1.5; human UAT open for phases 02/06/09).

## Requirements

### Validated

- GSD core workflow (discuss, plan, execute, verify) — shipped v1.0+
- Multi-runtime support (Claude Code, Copilot, Gemini, Codex) — shipped v1.1+
- UI-SPEC workflow for frontend phases — shipped v1.2+
- Parallel wave-based execution with gsd-executor agents — shipped v1.0+
- Model profile system with inheritance — shipped v1.3+
- Test-phase verification contract workflow — shipped v1.3.5
- Domain router in discuss-phase — shipped v1.4.1
- AGENT-SPEC template for agentic systems — shipped v1.4.1
- Documentation agent (/gsd2:document) — shipped v1.4.1
- /gsd2:progress context savings (~13k tokens/invocation) — shipped Phase 04
- Verifier-loop primitives (gsd-verifier/gsd-fixer loop mode, gsd-debugger investigator role, must_haves.verify schema, gsd-tools verify commands) — shipped Phase 04
- verify_after task attribute and verify_loop sub-flow spliced into execute-phase — shipped Phase 04 (manual end-to-end dogfood deferred — see 04-HUMAN-UAT.md)
- Agent observability telemetry (`PostToolUse`/`PostToolUseFailure` hook → JSONL spawn log with scraped confidence + `gsd-tools trace` reader, zero prompt changes) — shipped v1.5 Phase 4 (OBS-01, OBS-02)
- Convergence-aware plan revision loop — stall detection (non-decreasing BLOCKER+WARNING trajectory over 3 cycles emits STALL DETECTED + escalates) — shipped v1.5 Phase 5 (CONV-01)
- `parseMustHavesBlock` N-space indent fix — `verify artifacts`/`verify key-links` now parse real 2-space plans instead of returning "no blocks found" — shipped v1.5 Phase 5 (FIX-01)
- Security guard hooks, gsd2-namespaced + config-gated — shipped v1.5 Phase 1 (SEC)
- Autonomous technical-resolution loop in discuss/plan — shipped v1.5 Phase 2 (RSCH)
- Anti-pattern/bug-pattern reference docs incl. Python — shipped v1.5 Phase 3 (GUIDE)
- Skill self-sufficiency, parallel multi-session safety (worktrees + axis-A/B gate), validated example corpus, self-improving skills (`/gsd2:teach`) — shipped v1.5 Phases 6–9
- Decision ledger + mailbox persistence layer (`lib/ledger.cjs`, `lib/mailbox.cjs`, `run init`, ledger/mailbox CLI) — shipped v1.6 Phase 10 (LEDGER)
- Escalation contract + discuss-phase evaluator wiring + calibration gate material — shipped v1.6 Phase 11 (ESC-01, ESC-02, ESC-03; live calibration sign-off pending in 11-HUMAN-UAT.md)
- Park-don't-block mailbox: park/staleness/stuck primitives, inbox CLI (`mailbox answer`/`review`), discuss-phase park branch, `/gsd2:inbox` skill — shipped v1.6 Phase 12 (PARK-01, PARK-02, PARK-03, PARK-04; replay-after-resume deferred to Phase 15)
- Overnight runner: `run record-phase`/`status`/`report` CLI, autonomous.md harness mode (`--phase N` + PHASE RESULT contract), `workflows/overnight.md` + `/gsd2:overnight`, inbox-first morning report — shipped v1.6 Phase 13 (RUN-01, RUN-02, RUN-03, RUN-04; first live run gated on ESC-03 calibration sign-off)
- Multi-lens discussion loop: `discuss-loop` CLI primitives (anchor-validated position blocks, flag-check convergence, no-synthesis survivors), three lens agents, `/gsd2:discuss-loop` workflow with converge/escalate bifurcation — shipped v1.6 Phase 14 (LOOP-01, LOOP-02; live smoke run verified)
- Graph algorithms + integrity check (advisory): `topoSort`/`detectCycles` (Tarjan SCC), `blastRadius`, tiered `gsd-tools graph validate` (structural fatal / advisory exit-zero / `--strict`), `graph blast-radius`, and `/gsd2:health` graph-integrity Check 10 (`E-GRAPH-*`/`I-GRAPH-*`, error/info split, non-repairable) — shipped v1.7 Phase 17 (GRAPH-04, GRAPH-05, GRAPH-06)
- Todo/backlog triage worker: six-verdict proposals into the mailbox, propose-never-dispose routing (`lib/triage.cjs` + `gsd-tools triage run`, `/gsd2:triage`), plus autonomous.md resume-after-answer branch — shipped v1.6 Phase 15 (TRIAGE-01, TRIAGE-02, PARK-03 replay)

### Active

_(milestone v1.7 Planning-Graph Layer — see `.planning/REQUIREMENTS.md` for full REQ-IDs)_

- Normalized planning-graph model + algorithms — one node/edge model, `topoSort`/`detectCycles`/`blastRadius`, `gsd-tools graph` CLI (GRAPH)
- Graph-integrity health check in `/gsd2:health` (GRAPH)
- Consumer repoint: `parallel-gate` + `overnight` read the graph (GRAPH)
- Authoritative promotion: computed waves + `requires`-closure context selection (GRAPH)

### Out of Scope

- DATA-SPEC for database/performance — future domain, same pattern will apply
- Framework-specific integrations (LangGraph, Pydantic AI) — spec is framework-agnostic by design
- Changes to executor agent — existing execution machinery is sufficient
- Inline documentation by executor agents — replaced by on-demand doc agent

## Context

- GSD already has one domain-specific workflow: UI-SPEC for frontend phases. The domain router generalizes this pattern.
- The UI-SPEC currently triggers via a question ("would you like to create a UI spec?") which fires even for non-UI work. The domain router should replace this with automatic classification.
- Agentic systems are the primary use case driving this milestone — the user builds agent pipelines and needs planning support for: communication contracts, security boundaries, observability, and test-driven development.
- Documentation should be generated from existing artifacts (specs, planning docs, git history), not maintained inline by agents.

## Constraints

- **Architecture**: New domain support must follow the UI-SPEC pattern — one spec template, one questionnaire, minimal new commands
- **Scalability**: Domain router must work without adding per-domain yes/no gates
- **Testing**: AGENT-SPEC should produce test contracts at planning time (TDD for agentic work)
- **Compatibility**: Must not break existing UI-SPEC workflow — router subsumes it
- **Orchestration level (v1.6)**: GSD subagents lack Skill/Agent tool grants — the supervisor/runner must execute at orchestrator level (top-level session or headless run), never as a spawned subagent
- **Working tree (v1.6)**: Parallel sessions share one working tree — background *execution* requires worktree isolation per phase (v1.5 Phase 7 machinery); background *planning* writes only `.planning/` and is safe
- **Trust (v1.6)**: The harness proposes, never disposes — no silent discards; every autonomous decision must be auditable from the ledger alone, without replaying transcripts

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Classify, don't ask | Yes/no gates don't scale as domains grow; model should infer from phase description | Implemented Phase 1 |
| Observability in spec, not implementation | Logging/tracing in agentic systems is a design decision, not an afterthought | -- Pending |
| Framework-agnostic spec with pattern references | Show topology patterns (chain, graph, orchestrator) without prescribing tools | -- Pending |
| On-demand docs, not inline | One agent reads all artifacts and produces system map; avoids fragmented inline docs | -- Pending |
| Loops over agent proliferation | Bottleneck is human-loop time, not model capability; many special-case agents add wiring cost without raising autonomy (the week lost wiring 5–10 agents for simple CV text is the anti-pattern) | Reshaped Phase 2 (RSCH) from "general research agent" → "autonomous technical-resolution loop" — 2026-06-04 |
| Minimize the human round-trip | Reserve human input for taste/preference/intent; resolve everything model-answerable autonomously | Adopted as Core Value operating principle — 2026-06-04 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd2:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd2:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-05 — v1.7 Phase 17 (Graph Algorithms + Integrity Check) complete: `topoSort`/`detectCycles` (Tarjan SCC)/`blastRadius`, tiered `gsd-tools graph validate` + `blast-radius`, `/gsd2:health` graph-integrity Check 10 (structural error / advisory info, non-repairable); live repo validates structurally clean with 6 advisory findings (the Phase-19 trust-gate "clean numbers"); GRAPH-04/05/06, 6/6 must-haves. Previous note: v1.6 Autonomous Supervision Harness archived; v1.7 Planning-Graph Layer started (normalize 7 fragmented edge encodings into one `graph.cjs` model; `topoSort`/`detectCycles`/`blastRadius` + `gsd-tools graph` CLI; `/gsd2:health` integrity check; repoint parallel-gate + overnight; then authoritative waves + closure-based context selection — advisory-before-authoritative rollout). Previous note (v1.6 Phase 15 complete): resume logic + backlog triage worker (`lib/triage.cjs` structural layer + `gsd-tools triage run`, `autonomous.md` step 3a.0 HARNESS_MODE resume branch with staleness gate + ledger idempotency, `overnight.md` step 6.5 triage worker, `inbox.md` triage-verdict proposal presentation with propose-never-dispose, `/gsd2:triage` six-verdict workflow; 17 new tests, 14/14 verified). **All v1.6 phases (10–15) complete.** Previous note (Phase 14): multi-lens discussion loop (`discuss-loop` CLI primitives, three lens agents, `/gsd2:discuss-loop` converge/escalate workflow; live smoke run verified). Previous note (Phase 13): overnight runner (`run record-phase`/`status`/`report` CLI, autonomous.md harness mode with PHASE RESULT contract, `workflows/overnight.md` + `/gsd2:overnight`, inbox-first morning report; first live run gated on ESC-03 calibration sign-off). Previous note (Phase 12): park-don't-block mailbox (`lib/park.cjs` snapshot/staleness/stuck primitives, `mailbox answer`/`review` inbox CLI with resume handoffs, discuss-phase autonomous park branch, `/gsd2:inbox` skill; 1042 tests pass). Previous note (Phase 11): escalation contract (4 criteria / 24 conditions / 3-tier verdicts), discuss-phase inline evaluator gated on GSD_RUN_ID, 14-scenario golden set, and PENDING calibration gate witness blocking Phase 13 until human sign-off. Previous note (Phase 10): decision ledger + mailbox persistence layer (`lib/ledger.cjs`, `lib/mailbox.cjs`, `run init`, ledger/mailbox CLI subcommands; 983 tests pass). Milestone v1.6 Autonomous Supervision Harness started 2026-06-10 (decision ledger, escalation contract, park-don't-block mailbox, overnight runner, discussion loop, triage worker). Previous note (v1.5 Phase 9): `.planning/lessons/` JSONL ledger + `gsd-tools lesson` CLI + `/gsd2:teach` online skill-evolution loop (attribute → advisor-critic bounded edit → [y/N] ratify → source-only commit + separate ledger commit → npm run dev); dogfooded on the gsd repo (found+fixed a two-commit-ordering bug that broke git-revert undo); 959 unit tests pass. v1.5 Capability Port complete — all 9 phases shipped.*
