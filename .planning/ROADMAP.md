# Roadmap: GSD v1.7 Planning-Graph Layer

## Milestones

- ✅ **v1.5 Capability Port** - Phases 1-9 (shipped 2026-06-08)
- ✅ **v1.6 Autonomous Supervision Harness** - Phases 10-15 (shipped 2026-07-04)
- 🚧 **v1.7 Planning-Graph Layer** - Phases 16-22 (in progress) — graph chain (16-19) + closed-loop verification (20-22, from the Anthropic agent-harness lecture)

## Phases

<details>
<summary>✅ v1.5 Capability Port (Phases 1-9) - SHIPPED 2026-06-08</summary>

- [x] **Phase 1: Security Hooks** - Port 3 standalone advisory guard hooks into hooks/ under gsd2-* naming, config-gated, no build dependency (completed 2026-06-03)
- [x] **Phase 2: Autonomous Technical Resolution** - Resolve technical/domain unknowns via a research→self-critique confidence loop wired into discuss/plan (completed 2026-06-04)
- [x] **Phase 3: Execution-Detail Enrichment** - Anti-pattern/bug-pattern reference docs (incl. Python), hybrid-loaded into planner/verifier (completed 2026-06-04)
- [x] **Phase 4: Agent Observability & Telemetry** - Code-level PostToolUse hook logs every gsd-* subagent spawn + scraped confidence verdict (completed 2026-06-05)
- [x] **Phase 5: Plan-Loop Convergence and Verify Fix** - Stall-detection in the plan revision loop plus parseMustHavesBlock 2-space-indent fix (completed 2026-06-06)
- [x] **Phase 6: Skill Self-Sufficiency** - Audit 14 superpowers skills, port genuine gaps (TDD discipline, code-review rigor, artifact authoring, worktree technique) (completed 2026-06-06)
- [x] **Phase 7: Parallel Multi-Session Safety & Planning Ergonomics** - Worktree-isolated execution + parallel-safety gate (axis A/B) + symmetry-check + B-prefixed backlog IDs (completed 2026-06-08)
- [x] **Phase 8: Validated Example Corpus** - Pattern-indexed corpus of validated handwritten code examples from real reference projects (completed 2026-06-08)
- [x] **Phase 9: Self-Improving Skills (feedback-driven)** - Online skill-evolution loop: /gsd2:teach + lessons ledger + advisor-critic bounded edit + ratify gate (completed 2026-06-08)

</details>

<details>
<summary>✅ v1.6 Autonomous Supervision Harness (Phases 10-15) — SHIPPED 2026-07-04</summary>

**Milestone Goal:** Delegate the human's job of monitoring 5-10 parallel GSD sessions to an agentic supervision loop with a predictable, auditable escalation mechanism — the human reviews one inbox of logged decisions and parked questions instead of babysitting tabs.

**Guiding principle:** The harness proposes, never disposes. Trust ladder: validate on a single phase (read the ledger, score escalation precision) before widening to overnight multi-phase runs.

- [x] **Phase 10: Decision Ledger + CLI Foundation** - lib/ledger.cjs + lib/mailbox.cjs + gsd-tools subcommands — the shared persistence layer every other component calls (completed 2026-06-11)
- [x] **Phase 11: Escalation Contract + discuss-phase Wiring** - Written escalation contract artifact, inline evaluator in discuss-phase, and trust-ladder calibration gate before overnight runs are permitted (completed 2026-06-12)
- [x] **Phase 12: Park-Don't-Block Mailbox** - park-and-ask branch parking, mailbox inbox review command, staleness-checked resume, and stuck detection (completed 2026-06-12)
- [x] **Phase 13: Overnight Runner** - /gsd2:overnight wrapping /gsd2:autonomous with ledger + escalation + worktree isolation + morning report (Wave-0 required first) (completed 2026-06-12)
- [x] **Phase 14: Multi-Lens Discussion Loop** - /gsd2:discuss-loop with three-lens artifact judgment and content-delta convergence brake (completed 2026-06-12)
- [x] **Phase 15: Resume Logic + Backlog Triage Worker** - autonomous.md resume path after mailbox answers + /gsd2:triage propose-only worker (completed 2026-06-18)

</details>

**v1.7 Planning-Graph Layer** (in progress)

- [x] **Phase 16: Planning Graph Model + CLI** - Normalize phase `depends_on` and build a single `graph.cjs` node/edge model over all existing edge sources, inspectable via `gsd-tools graph analyze|export` (completed 2026-07-04)
- [ ] **Phase 17: Graph Algorithms + Integrity Check** - Code-based `topoSort`/`detectCycles`/`blastRadius` + `gsd-tools graph validate` + a `/gsd2:health` integrity check — the trust gate before the graph drives any decision
- [ ] **Phase 18: Consumer Repoint** - `parallel-gate.cjs` and `overnight.md` read the graph instead of hand-rolled traversal — still advisory, still non-authoritative
- [ ] **Phase 19: Authoritative Promotion** - Computed/cross-checked wave numbers in `phase.cjs` and `requires`-closure context selection in plan-phase — the graph overrides planner/executor output

## Phase Details

<details>
<summary>✅ v1.5 + v1.6 Phases 1-15 (shipped — full detail)</summary>

<details>
<summary>✅ v1.5 Phases 1-9 (complete — see git history for details)</summary>

### Phase 1: Security Hooks
**Goal**: Users running GSD on agentic pipelines have a defense-in-depth hook layer that guards against prompt injection and out-of-worktree edits — config-gated, namespace-clean, with no TypeScript or core-lib dependency
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04 (worktree-path-guard descoped to SEC-DEFER-01 per Phase 1 discussion)
**Success Criteria** (what must be TRUE):
  1. Running `npm run build:hooks` produces the 3 new `gsd2-*` guard hooks in hooks/dist/ alongside the renamed existing hooks — no build errors
  2. Running `gsd2 --claude --local` (or equivalent install) registers the new hooks in .claude/settings.json under `gsd2-*` filenames and removes stale `gsd-*` registrations
  3. Each new hook is independently enable/disable-able via a config.json key; the default posture (on vs opt-in) is documented per hook
  4. The hooks run from pure standalone JS — no import of a TypeScript-compiled lib or any new runtime dependency
**Plans**: 2/2 complete

### Phase 2: Autonomous Technical Resolution
**Goal**: Technical and domain unknowns are resolved by the model autonomously so they stop bouncing back to the human
**Depends on**: Nothing
**Requirements**: RSCH-01, RSCH-02, RSCH-03
**Success Criteria** (what must be TRUE):
  1. A reusable technical-resolution loop (research → self-critique → confidence verdict) exists, raising LOW→HIGH confidence without human input where evidence allows
  2. A technical/HYBRID question arising in plan-phase is resolved inline; discuss-phase's LOW-confidence fallback no longer defaults to asking the human when evidence can resolve it
  3. The loop honors signal strength — skips STRONG decisions — and records resolved technical decisions with confidence + source
**Plans**: 3/3 complete

### Phase 3: Execution-Detail Enrichment
**Goal**: Planners and verifiers have codified reference docs for what good and bad code looks like (incl. Python)
**Depends on**: Nothing
**Requirements**: GUIDE-01, GUIDE-02
**Success Criteria** (what must be TRUE):
  1. Anti-pattern and bug-pattern reference docs exist in references/ and are loaded per the hybrid scheme
  2. The reference docs include Python-specific content alongside language-agnostic material
**Plans**: 2/2 complete

### Phase 4: Agent Observability & Telemetry
**Goal**: GSD emits a structured, code-level telemetry log of agent activity so loop behavior is verifiable by inspecting a record rather than eyeballing a transcript
**Depends on**: Nothing technically
**Requirements**: OBS-01, OBS-02
**Success Criteria** (what must be TRUE):
  1. A code-level hook records every gsd-* subagent spawn to a structured log with zero changes to workflow/agent prompt files
  2. The log captures the confidence verdict of resolution/verifier agent returns
  3. Telemetry is best-effort and non-blocking — a hook failure never interrupts the agent run
**Plans**: 3/3 complete

### Phase 5: Plan-Loop Convergence and Verify Fix
**Goal**: The plan revision loop detects stalls and escalates rather than silently cycling; verify artifacts / verify key-links work correctly on all current plans
**Depends on**: Nothing
**Requirements**: CONV-01, FIX-01
**Success Criteria** (what must be TRUE):
  1. When the plan revision loop runs max_iterations without BLOCKER+WARNING count decreasing, it emits STALL DETECTED and escalates
  2. Running `gsd-tools verify artifacts <plan-path>` on a 2-space-indented must_haves block returns the correct artifact list
  3. Running `gsd-tools verify key-links <plan-path>` on a 2-space-indented must_haves block returns the correct key-links
**Plans**: 2/2 complete

### Phase 6: Skill Self-Sufficiency
**Goal**: GSD natively covers the capability gaps currently filled by the (now-disabled) superpowers Claude Code plugin
**Depends on**: Nothing
**Requirements**: (derived at plan time from audit)
**Success Criteria** (what must be TRUE):
  1. A written coverage audit maps each of 14 superpowers skills to either an existing GSD artifact (covered) or a concrete port target (gap)
  2. Each genuine gap is ported into GSD as a native artifact loaded through normal GSD flow
  3. Running a representative GSD workflow exercises the ported TDD/review/worktree behavior without any superpowers skill being available
**Plans**: 3/3 complete

### Phase 7: Parallel Multi-Session Safety & Planning Ergonomics
**Goal**: GSD makes it safe and ergonomic to run several sessions at once without the silent-overwrite mess that today's shared working tree produces
**Depends on**: Relates to Phase 6
**Requirements**: PAR-01..PAR-N (derived at plan time)
**Success Criteria** (what must be TRUE):
  1. A quick-fix run in a parallel session no longer silently overwrites a concurrently-executing phase — conflicts surface as a reviewable merge
  2. A documented gate decides, from depends_on + file-scope, whether a proposed parallel set is safe, and refuses parallel discussion of dependent phases
  3. Todos carry depends_on/related_to and the gate reads them
  4. The doctor command reports source-runtime drift in one invocation
  5. The backlog ID scheme no longer reuses the phase-number space
**Plans**: 6/6 complete

### Phase 8: Validated Example Corpus
**Goal**: GSD guidance draws on a curated corpus of validated, human-maintained code examples mined from strong real-world reference projects
**Depends on**: Nothing technically
**Requirements**: CORPUS-01..N
**Success Criteria** (what must be TRUE):
  1. A validated-example corpus exists as a pattern-indexed catalog with explicit selection criteria, sourced from real reference projects, with per-example commentary
  2. The corpus is loaded into at least one GSD flow through the normal references mechanism
  3. The corpus is structured so Phase 9 can consume it as validated reference/eval material
**Plans**: 4/4 complete

### Phase 9: Self-Improving Skills (feedback-driven)
**Goal**: GSD's skill/command/reference prose stops being static — it learns from real failures observed during development
**Depends on**: Phase 4 telemetry (load-bearing); Phase 8 corpus (soft reference)
**Requirements**: TEACH-01, TEACH-02, TEACH-03, TEACH-04, TEACH-05
**Success Criteria** (what must be TRUE):
  1. A /teach capture path exists; a lesson from a real failure is recorded to a .planning/lessons/ ledger, and an auto-miner can nominate recurring lessons without editing anything itself
  2. The loop attributes a captured lesson to a GSD prose artifact and proposes a bounded edit; nothing touches get-shit-done/ source without human ratification
  3. At least one real lesson lands as a committed, ratified, bounded edit to the correct GSD artifact with the before/after prose change recorded, and the loop is git-reversible
**Plans**: 2/2 complete

</details>

### Phase 10: Decision Ledger + CLI Foundation

**Goal**: Every harness component has a tested, shared persistence layer — append-only DECISIONS.jsonl and MAILBOX.jsonl — so autonomous decisions are auditable from the ledger alone without replaying transcripts

**Depends on**: Nothing (first v1.6 phase; direct application of lesson.cjs patterns)

**Requirements**: LEDGER-01, LEDGER-02, LEDGER-03

**Plans**: 2 (10-01 ledger.cjs + run init + dispatch; 10-02 mailbox.cjs + dispatch)

**Discussion focus**: Schema design for DECISIONS.jsonl entries (field names, required vs optional fields for alternatives/evidence/confidence); run-id coordination mechanism (new config key vs RUN-META.json field — must decide here before any workflow wiring); .planning/run/{run-id}/ directory layout; which gsd-tools subcommands cover filter/read operations (ledger list, ledger filter, mailbox review)

**Success Criteria** (what must be TRUE):
  1. Running `gsd-tools ledger append <run-id>` with a valid decision record writes a JSONL entry to `.planning/run/{run-id}/DECISIONS.jsonl` with schema enforced at write time — missing required fields (decision, alternatives, evidence, confidence, escalated) are rejected with a clear error
  2. Running `gsd-tools ledger list <run-id>` and `gsd-tools ledger filter <run-id> --phase N --escalated` returns filtered entries correctly from the ledger file
  3. A harness run context (run-id) is detectable from the process environment or config so that interactive sessions produce zero behavior change — `gsd-tools ledger append` outside a harness run either no-ops or errors, never silently writes to an undefined run
  4. `lib/ledger.cjs` and `lib/mailbox.cjs` are unit-tested modules following the lesson.cjs pattern; the `.planning/run/{run-id}/` directory layout is documented and enforced at run-init time

**Plans**: TBD

### Phase 11: Escalation Contract + discuss-phase Wiring

**Goal**: The harness has a written, discrete escalation contract — four criteria mapped to a three-tier verdict schema — and discuss-phase evaluates every autonomous decision against it when a harness run_id is active; the human reads a populated ledger from one real interactive phase run and confirms escalation precision before overnight runs are permitted

**Depends on**: Phase 10 (ledger.cjs and mailbox.cjs must exist before the evaluator can write verdicts)

**Requirements**: ESC-01, ESC-02, ESC-03

**Discussion focus**: Escalation criteria precision — prose criteria drift across LLM runs; must settle on a discrete verb list for each of the four criteria (irreversibility, security boundary, scope change, spec ambiguity); where the contract artifact lives (references/ vs .planning/); what counts as a "golden set" (10 decisions minimum, format for scoring); trust-ladder gate mechanics (who reads the ledger and what blocks Phase 13 if precision is low)

**Success Criteria** (what must be TRUE):
  1. A written escalation contract artifact exists with four discrete criteria (irreversibility, security boundary, scope change, spec ambiguity) each mapped to a specific tier (proceed / proceed-and-log / park-and-ask) — verifiable by reading the artifact, no inference required
  2. Running discuss-phase with a harness run_id active causes the question_triage step to evaluate each decision against the contract and write a verdict to the ledger — interactive sessions without a run_id see no behavior change
  3. After one complete interactive phase run, a human reads the populated DECISIONS.jsonl and confirms that escalation precision meets a stated threshold against the golden set — this confirmation is the structural gate blocking Phase 13 (overnight runner)
  4. ESC-03 calibration is documented as a human activity with a concrete pass/fail criterion, not an automated score — the gate is social, not algorithmic

**Plans**: 2 plans — 11-01 (escalation-contract.md + discuss-phase evaluator wiring, wave 1), 11-02 (golden set + calibration gate witness, wave 2)

### Phase 12: Park-Don't-Block Mailbox

**Goal**: A park-and-ask verdict parks the blocked branch and appends a structured question to the mailbox without stopping the run; the human resolves all parked questions in one inbox session; resuming a branch re-reads current planning state before replay; and the runner detects stuck phases before token burn

**Depends on**: Phase 11 (escalation contract must produce park-and-ask verdicts before parking is exercised)

**Requirements**: PARK-01, PARK-02, PARK-03, PARK-04

**Discussion focus**: Branch-parking state machine (how a phase is marked as parked — MAILBOX entry only, or a separate `.planning/run/{run-id}/parked/phase-N.json` snapshot); context snapshot contents for staleness detection; what "resume" means at the prompt level (how the inbox review command hands off a phase restart); stuck detection threshold (how many consecutive identical ledger hashes before flagging)

**Success Criteria** (what must be TRUE):
  1. When discuss-phase emits a park-and-ask verdict, a question + context snapshot is appended to `MAILBOX.jsonl` and the current phase execution halts — the run continues other work rather than blocking
  2. Running `gsd-tools mailbox review <run-id>` presents each parked question with context, accepts a human answer, and records the answer; all parked questions can be resolved in a single inbox session without switching tabs
  3. After a human answers a parked question, the branch resumes by re-reading `STATE.md`, `ROADMAP.md`, and `cross-phase-notes.md` before replaying — the staleness diff between the context snapshot at park time and current planning state is visible before replay proceeds
  4. An identical ledger hash across two consecutive phase snapshots is detected and flagged as a stuck run — the flag is visible in `gsd-tools ledger list` output and `run.log`

**Plans**: 3 plans — 12-01 (park.cjs primitives: snapshot + staleness + stuck detection + CLI, wave 1), 12-02 (mailbox review/answer + resume handoff, wave 2), 12-03 (discuss-phase park branch + /gsd2:inbox skill, wave 3)

### Phase 13: Overnight Runner

**Goal**: `/gsd2:overnight` runs remaining phases unattended — worktree-isolated, ledger-wired, mailbox-integrated, with a startup health check and a morning report — after Wave-0 empirical validation of headless session lifespan and bypassPermissions behavior

**Depends on**: Phase 12 (all core harness primitives calibrated); Wave-0 research (headless session lifespan + `--permission-mode bypassPermissions` must be empirically confirmed before scheduling logic is built)

**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04

**Discussion focus**: Wave-0 findings must precede discuss-phase for this phase — headless session lifespan (token expiry mid-run?), bypassPermissions runtime behavior, auth failure surface; per-phase worktree isolation pattern for the runner (reuses Phase 7 machinery); merge-conflict routing to mailbox vs checkpoint; morning report format and delivery (stdout, file, or mailbox); crontab entry convention; parallel worktree writes to agent-trace.jsonl (per-run trace files or mutex?)

**Success Criteria** (what must be TRUE):
  1. Running `/gsd2:overnight` starts a headless harness run, executes remaining phases with ledger + escalation + mailbox active, and produces a `run.log` — auth or permission failures are recorded loudly in run.log and the run stops, never silently retrying
  2. Each phase executes in a worktree-isolated environment; a merge conflict routes a structured entry to `MAILBOX.jsonl` rather than being swallowed silently (the runner checks `clean:false` from `cmdWorktreeMerge`)
  3. The morning report (`gsd-tools run report <run-id>`) summarizes decisions made, questions parked, and phases completed from the ledger alone — no transcript replay required
  4. Wave-0 empirical results (headless session lifespan, bypassPermissions behavior) are documented as a concrete constraint record in the phase context before any scheduling logic is implemented

**Plans**: 3 plans — 13-01 (gsd-tools run report + record-phase/status run-meta helpers, TDD, wave 1), 13-02 (autonomous.md harness mode: --phase selector + discuss-phase --auto delegation + PHASE RESULT contract, wave 1), 13-03 (overnight.md workflow + /gsd2:overnight stub + inbox report header, wave 2)

### Phase 14: Multi-Lens Discussion Loop

**Goal**: `/gsd2:discuss-loop` judges a concrete artifact through three lenses (Skeptic, User-Advocate, Architect) and either reaches convergence with a verifiable content delta or escalates the top divergent positions to the mailbox — a synthesized average is never produced

**Depends on**: Phase 11 (escalation contract must exist for convergence-failure escalation path); Phase 12 (mailbox must exist to receive unresolved positions)

**Requirements**: LOOP-01, LOOP-02

**Discussion focus**: Convergence test definition (content-delta on downstream constraints, not sentence similarity); what "anchored to a concrete artifact" means operationally (CONTEXT.md section, DECISIONS.jsonl entry, or any file passed as argument); round cap value (research suggests 3); how divergent positions are structured in the mailbox entry; whether the three lenses run sequentially inline or as parallel role switches

**Success Criteria** (what must be TRUE):
  1. Running `/gsd2:discuss-loop <artifact>` produces three-lens judgment of the artifact's content — each lens (Skeptic, User-Advocate, Architect) produces a distinct position grounded in the artifact text, not abstract opinions
  2. When lenses converge (content-delta test passes), the loop exits early with a resolution record; when the hard round cap is reached without convergence, the top two divergent positions are written to the mailbox as structured entries — a synthesized average is never produced

**Plans**: 3 plans — 14-01 (discuss-loop.cjs judgment primitives: validate/delta/survivors/transcript CLI, TDD, wave 1), 14-02 (three lens agents + /gsd2:discuss-loop stub, wave 1), 14-03 (orchestrator workflow + install + live smoke checkpoint, wave 2)

### Phase 15: Resume Logic + Backlog Triage Worker

**Goal**: A parked branch restarts correctly by replaying through the current planning state in `autonomous.md`; and `/gsd2:triage` analyzes pending todos against the codebase and roadmap, emitting six-verdict proposals to the mailbox that execute only on human acceptance

**Depends on**: Phase 13 (overnight runner must be stable before resume logic is wired into autonomous.md — resume is the most complex component and is most sensitive to planning-state drift); Phase 12 (mailbox write path for triage proposals)

**Requirements**: TRIAGE-01, TRIAGE-02

**Discussion focus**: Resume path in autonomous.md — where exactly does the parked-phase restart splice in; what "replay" means (restart the full phase from ROADMAP position, or from the parked step); staleness diff format shown to the human before replay; triage worker scope (how it reads pending todos — todos/pending/ dir scan vs gsd-tools query); evidence format for six-verdict proposals; batch-to-mailbox write atomicity

**Success Criteria** (what must be TRUE):
  1. When a parked branch is resumed after a human answers a mailbox question, `autonomous.md` re-reads `STATE.md`, `ROADMAP.md`, and `cross-phase-notes.md` before replaying the blocked step — the staleness diff between park-time snapshot and current state is surfaced to the human before execution continues
  2. Running `/gsd2:triage` reads pending todos against the codebase and roadmap and appends proposals to `MAILBOX.jsonl` — each proposal carries one of six verdicts (already-done / obsolete / fold-into-phase / new-phase / needs-input / defer) with evidence; nothing is promoted, folded, or deleted until the human accepts via `gsd-tools mailbox review`

**Plans**: 3 plans — 15-01 (triage.cjs module + tests, TDD, wave 1), 15-02 (autonomous.md resume branch, wave 1), 15-03 (overnight.md triage step + inbox.md triage-entry + workflows/triage.md + commands/gsd2/triage.md, wave 2)

</details>

### Phase 16: Planning Graph Model + CLI

**Goal**: A single normalized `{nodes, edges}` graph model exists over every fragmented edge encoding GSD already declares (phase depends_on, plan depends_on/wave, files_modified overlap, SUMMARY requires/provides/affects, PLAN key_links, requirement→phase, todo edges), inspectable by a human via CLI — read-only, zero behavior change to any existing consumer

**Depends on**: Nothing (first v1.7 phase)

**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03

**Discussion focus**: Node/edge type taxonomy (node type ∈ phase|plan|requirement|todo|artifact; edge type ∈ depends_on|provides|affects|satisfies|wires) — confirm this covers all 7 existing edge kinds without forcing a lossy mapping; where `graph.cjs` sits relative to `roadmap.cjs`/`frontmatter.cjs`/the SUMMARY parser (reuse vs re-implement); analyze vs export output shape (human-readable text vs JSON schema)

**Success Criteria** (what must be TRUE):
  1. Phase `depends_on` in ROADMAP.md is parsed by `roadmap.cjs` into a structured array (not a raw prose string) exposed to callers
  2. `graph.cjs` builds one `{nodes, edges}` model that includes edges from phase depends_on, plan depends_on/wave, files_modified overlap, SUMMARY requires/provides/affects, PLAN key_links, requirement→phase traceability, and todo depends_on/related_to
  3. Running `gsd-tools graph analyze` prints the normalized model in a readable form covering all node/edge types present in this repo's own `.planning/` tree
  4. Running `gsd-tools graph export` emits the identical model as machine-readable JSON
  5. No existing consumer (`roadmap.cjs` callers, `parallel-gate.cjs`, `phase.cjs`, `overnight.md`, `gsd-plan-checker.md`) changes behavior — this phase only adds a reader

**Plans**: 2 plans — 16-01 (roadmap.cjs depends_on_parsed + graph.cjs buildGraph Part A: phase/plan nodes, depends_on edges from roadmap/plan-frontmatter/files_modified, wave 1); 16-02 (buildGraph Part B: SUMMARY requires/affects, PLAN key_links, requirement traceability, todo edges + gsd-tools graph analyze/export CLI, wave 2)

### Phase 17: Graph Algorithms + Integrity Check

**Goal**: The graph proves structural properties by code instead of LLM eyeballing — topological order, cycle detection, and transitive blast-radius closure — and `/gsd2:health` surfaces integrity problems (dangling edges, cycles, affects-vs-files_modified contradictions), forming the trust gate that must show clean numbers before any consumer is allowed to treat the graph as authoritative

**Depends on**: Phase 16 (algorithms and validation operate on the normalized model built there)

**Requirements**: GRAPH-04, GRAPH-05, GRAPH-06

**Discussion focus**: Cycle-detection algorithm choice (DFS coloring vs Kahn's algorithm byproduct) and how `gsd-plan-checker.md`'s current LLM-eyeball cycle instruction is retired in favor of pointing at `graph validate`; blast-radius depth semantics — exact definition of level 1 (direct)/2 (one-hop)/3 (full closure) and which edge types participate (`affects`/`provides` only, per requirement text); what counts as an `affects`-vs-`files_modified` "contradiction" precisely, given requires/provides/affects are author-supplied and often sloppy (`requires: []` common) — this is the key risk this phase exists to catch

**Success Criteria** (what must be TRUE):
  1. `graph.cjs` computes a topological order of all nodes from the edge model in code
  2. Running `gsd-tools graph validate` on a roadmap with a deliberately introduced dependency cycle exits non-zero and reports the specific cycle
  3. `gsd-tools graph validate` also reports dangling edge references (an edge pointing to a node id that doesn't exist) and wave/dependency contradictions
  4. Running `gsd-tools graph blast-radius <node>` returns the transitive affects/provides closure at a requested depth — depth 1 returns only direct edges, depth 2 adds one hop, depth 3 returns the full closure
  5. Running `/gsd2:health` includes a graph-integrity check that flags dangling references, cycles, and cases where a phase's declared `affects` contradicts its actual `files_modified` overlap — with zero change to any execution behavior elsewhere

**Plans**: 2 plans — 17-01 (topoSort/detectCycles/blastRadius + graph validate/blast-radius CLI, wave 1); 17-02 (verify.cjs /gsd2:health graph-integrity check reusing 17-01's computeGraphIntegrity, wave 2)

**Risk**: `requires`/`provides`/`affects` are author-supplied by the executor agent and are frequently sloppy or empty. A graph built on bad edges gives confident wrong answers, which is worse than no graph. This phase's integrity check is the explicit mitigation — Phase 19 (authoritative promotion) must not proceed until this check reports clean numbers on the live repo.

### Phase 18: Consumer Repoint

**Goal**: `parallel-gate.cjs` and `overnight.md` stop re-deriving traversal/coupling logic by hand and read the graph instead — deleting duplicated logic while remaining strictly advisory (no consumer's decision becomes authoritative over planner/executor output yet)

**Depends on**: Phase 17 (repointing to the graph is only safe once validate/integrity checks exist to catch a bad model before it silently drives a wrong verdict)

**Requirements**: GRAPH-07, GRAPH-08

**Discussion focus**: Regression strategy for `hasPhaseDecisionCoupling` replacement — how "identical-or-better verdicts on existing phases" is measured (golden set of current phase pairs + expected coupling verdict, run before/after); whether the old hand-rolled functions are deleted outright or kept temporarily behind a flag during rollout; how `overnight.md`'s regex-based BLOCKED/SKIPPED extraction is swapped for a topo-order read without changing the run.log observability contract

**Success Criteria** (what must be TRUE):
  1. `parallel-gate.cjs`'s axis-B coupling decision is computed from a graph edge query instead of the hand-rolled `hasPhaseDecisionCoupling` string check
  2. Running the repointed `parallel-gate.cjs` against this repo's existing shipped phases (10-15, 1-9) produces coupling verdicts identical to or more accurate than the pre-repoint check — no regressions
  3. `overnight.md`'s BLOCKED/SKIPPED phase traversal reads the graph's topological order instead of ad-hoc regex extraction over ROADMAP.md text
  4. A dry run of the overnight phase-ordering logic on the current ROADMAP.md produces the same phase sequence as before the repoint

**Plans**: TBD

### Phase 19: Authoritative Promotion

**Goal**: The graph becomes the source of truth for wave ordering and context selection — `phase.cjs` cross-checks and can correct planner-assigned wave numbers, and plan-phase assembles upstream context from the graph's `requires` transitive closure — the highest-risk tier because the graph now overrides, not just observes, planner/executor output

**Depends on**: Phase 18 (consumer repoint must be stable; more importantly, Phase 17's integrity check must report clean numbers on the live repo before this phase is authorized — authoritative promotion on a graph with unresolved dangling/cycle/contradiction findings would produce confident wrong decisions)

**Requirements**: GRAPH-09, GRAPH-10

**Discussion focus**: Repair vs flag-only semantics when a plan's frozen `wave:N` contradicts the graph's computed order (auto-correct the integer vs surface a blocking warning for human/planner review); how `phase.cjs:305`'s current wave-bucketing is modified without breaking existing plans that already carry (correct) wave numbers; what "requires-closure context selection" concretely replaces in plan-phase's current context-gathering step; rollback plan if authoritative promotion produces a wrong wave/context decision on a real phase

**Success Criteria** (what must be TRUE):
  1. Plan wave numbers are computed or cross-checked against the graph's topological order at phase-execution time in `phase.cjs`, rather than trusted as the planner-assigned integer alone
  2. A plan whose frozen `wave:N` contradicts its declared dependencies is flagged or automatically repaired — never silently executed out of dependency order
  3. plan-phase context selection assembles upstream context from the graph's `requires` transitive closure, delivering the "transitive closure for context selection" that `templates/summary.md` already promises but no code computed before this phase
  4. Running phase.cjs on a roadmap with a deliberately wrong wave number (contradicting depends_on) surfaces the contradiction rather than executing in the wrong order

**Plans**: TBD

**Risk**: This is the authoritative tier — the graph now drives real execution decisions instead of only observing them. It must not begin until Phase 17's integrity check shows clean numbers on the live repo; a graph promoted to authority while still built on sloppy `requires`/`provides`/`affects` edges would produce confident wrong wave/context decisions, silently, at execution time.

## Progress

**Execution Order:** 10 → 11 → 12 → 13 → 14 → 15 (v1.6, shipped) → 16 → 17 → 18 → 19 (v1.7 graph chain) → 20/21 (independent) → 22 (v1.7 verification loop)
(v1.7 graph chain: strict linear order — advisory foundation (16, 17) must ship and pass integrity checks before consumer repoint (18); consumer repoint must be stable before authoritative promotion (19).
v1.7 verification loop: Phases 20 and 21 are independent of the graph chain and of each other — either can run anytime; Phase 22 depends only on Phase 20.)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Security Hooks | v1.5 | 2/2 | Complete | 2026-06-03 |
| 2. Autonomous Technical Resolution | v1.5 | 3/3 | Complete | 2026-06-04 |
| 3. Execution-Detail Enrichment | v1.5 | 2/2 | Complete | 2026-06-04 |
| 4. Agent Observability & Telemetry | v1.5 | 3/3 | Complete | 2026-06-05 |
| 5. Plan-Loop Convergence and Verify Fix | v1.5 | 2/2 | Complete | 2026-06-06 |
| 6. Skill Self-Sufficiency | v1.5 | 3/3 | Complete | 2026-06-06 |
| 7. Parallel Multi-Session Safety & Planning Ergonomics | v1.5 | 6/6 | Complete | 2026-06-08 |
| 8. Validated Example Corpus | v1.5 | 4/4 | Complete | 2026-06-08 |
| 9. Self-Improving Skills | v1.5 | 2/2 | Complete | 2026-06-08 |
| 10. Decision Ledger + CLI Foundation | v1.6 | 2/2 | Complete    | 2026-06-11 |
| 11. Escalation Contract + discuss-phase Wiring | v1.6 | 2/2 | Complete    | 2026-06-12 |
| 12. Park-Don't-Block Mailbox | v1.6 | 3/3 | Complete    | 2026-06-12 |
| 13. Overnight Runner | v1.6 | 3/3 | Complete    | 2026-06-12 |
| 14. Multi-Lens Discussion Loop | v1.6 | 3/3 | Complete    | 2026-06-12 |
| 15. Resume Logic + Backlog Triage Worker | v1.6 | 3/3 | Complete    | 2026-06-18 |
| 16. Planning Graph Model + CLI | v1.7 | 3/3 | Complete    | 2026-07-04 |
| 17. Graph Algorithms + Integrity Check | v1.7 | 0/2 | Not started | - |
| 18. Consumer Repoint | v1.7 | 0/? | Not started | - |
| 19. Authoritative Promotion | v1.7 | 0/? | Not started | - |
| 20. Execution-Grounded Verification | v1.7 | 0/? | Not started | - |
| 21. Contract Negotiation | v1.7 | 0/? | Not started | - |
| 22. Verdict-Only Feedback + Restart Valve | v1.7 | 0/? | Not started | - |

## Backlog

### B1: Terse output default + verbose opt-in (BACKLOG)

**Goal:** GSD command/agent output defaults to a minimal terse form (smallest possible sentence, no filler) with an opt-in detailed mode for the current verbose prose. Applies to workflow reports and agent-facing summaries. Surfaced 2026-06-05 — detailed output is valued but overwhelming as the default.
**Requirements:** TBD
**Plans:** 3/3 plans complete

Plans:
- [ ] TBD (promote with /gsd2:review-backlog when ready)

### B2: Planner task-count discipline (BACKLOG)

**Goal:** Stop plans from accumulating excessive tasks. gsd-planner.md has no upper bound on task count and no "is this task worth existing" litmus. Fix shape: add a task-count cap / requirement-trace litmus to gsd-planner.md, plus a gsd-plan-checker rule flagging plans over N tasks or tasks with no requirement trace. Surfaced 2026-07-02 usability discussion (user pain point: tasks excessive sometimes).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd2:review-backlog when ready)

### B3: Global state overview / cross-phase transparency (BACKLOG)

**Goal:** Give the user a milestone-wide view instead of current-phase-only. Pain points from 2026-07-02 usability discussion: /gsd2:progress shows only the current phase; routing a feature to the next or a prior phase is opaque; the backlog → new-version flow ("ask model to create new version based on what was solved") is not transparent about what happens under the hood. Fix shape: a global overview view (all phases + status + backlog + what landed where), plus explicit feature-routing guidance. Related: B1 (output form), self-audit Topic 4 recs 3/4/6 (backlog/seed rot).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd2:review-backlog when ready)

### Phase 20: Execution-Grounded Verification

**Goal:** `gsd-verifier` and `verify-work` stop confirming a feature by *reading* code plus goal-backward reasoning, and instead *drive the built artifact* — run the CLI/server/browser flow, observe real behavior, and score against the phase's success criteria before a PASS is allowed. The antidote to self-sycophancy (calling a half-built feature done). Reuses the `/verify` and `/run` skills. Constraint: the executing verifier must run at orchestrator level — subagents lack the tool grants to drive arbitrary project types.
**Requirements**: TBD (derived at plan time)
**Depends on:** None — independent of the v1.7 graph chain (16–19); upgrades the existing verifier
**Source:** Anthropic agent-harness lecture — the Evaluator must actually run the app, not read diffs
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd2:plan-phase 20 to break down)

### Phase 21: Contract Negotiation

**Goal:** Point `discuss-loop`'s fresh-context judgment machinery at the TEST-SPEC / AGENT-SPEC contract so the builder and tester adversarially converge on concrete, testable success criteria *before* build — surfacing spec ambiguity that a single authored, human-approved contract hides. Near-pure reuse of existing discuss-loop convergence + delta brake.
**Requirements**: TBD (derived at plan time)
**Depends on:** None — reuses discuss-loop; independent of Phase 20 and the graph chain
**Source:** Anthropic agent-harness lecture — Generator and Evaluator negotiate testable criteria on disk before building
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd2:plan-phase 21 to break down)

### Phase 22: Verdict-Only Feedback + Restart Valve

**Goal:** `gsd-fixer` receives the *verdict*, not the evaluator's full reasoning (anti-muddying between the build and judge roles), and a patch-debt counter triggers "reject and rebuild from the contract" instead of patching endlessly. Loop-control tweaks, not a new subsystem.
**Requirements**: TBD (derived at plan time)
**Depends on:** Phase 20 — needs a real execution-grounded verdict to isolate feedback from and to react to
**Source:** Anthropic agent-harness lecture — Generator sees only the verdict; the pair throws out the whole build and restarts when stuck
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd2:plan-phase 22 to break down)
