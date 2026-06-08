# Roadmap: GSD v1.5 Capability Port

## Overview

v1.5 closes the fork's execution-detail gap by selectively porting four capability clusters from gsd-core. Phase 1 delivers standalone security guard hooks — the highest-confidence, lowest-effort addition. Phase 2 builds an autonomous technical-resolution loop (research → self-critique → decide) wired into discuss/plan, so technical unknowns resolve without bouncing back to the human. Phase 3 enriches execution with anti-pattern references and context-budget tooling. Phase 4 adds a code-level observability hook that logs every gsd-* subagent spawn (and its confidence verdict) to a structured telemetry file, making loop behavior grep-checkable. Phase 5 adds stall-detection to the plan revision loop and fixes the parseMustHavesBlock regression. Every port goes through the normal discuss → plan → execute → verify loop — adopted by understanding, not copied wholesale.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (1.1, 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Security Hooks** - Port 3 standalone advisory guard hooks into hooks/ under gsd2-* naming, config-gated, no build dependency (worktree-path-guard descoped — see CONTEXT) (completed 2026-06-03)
- [x] **Phase 2: Autonomous Technical Resolution** - Resolve technical/domain unknowns via a research→self-critique confidence loop wired into discuss/plan, so they stop bouncing to the human — loops over new agents (RESHAPED 2026-06-04) (completed 2026-06-04)
- [x] **Phase 3: Execution-Detail Enrichment** - Anti-pattern/bug-pattern reference docs (incl. Python), hybrid-loaded into planner/verifier — context-budget tiers + utilization classifier reshaped out → doctor phase (RESHAPED 2026-06-04) (completed 2026-06-04)
- [x] **Phase 4: Agent Observability & Telemetry** - Code-level PostToolUse(Task|Agent) hook logs every gsd-* subagent spawn + scraped confidence verdict to .planning/telemetry/agent-trace.jsonl, with a minimal `gsd-tools trace` reader — zero prompt-file changes (completed 2026-06-05)
- [x] **Phase 5: Plan-Loop Convergence and Verify Fix** - Stall-detection in the plan revision loop plus parseMustHavesBlock 2-space-indent fix (completed 2026-06-06)
- [ ] **Phase 6: Skill Self-Sufficiency** - Audit all 14 superpowers skills vs GSD coverage, then port only the genuine gaps (execution-time TDD discipline, receiving-code-review rigor, skill-authoring guidance, worktree-isolation default) into GSD as native commands/references so the external plugin dependency can be dropped — removal itself is a follow-up
- [ ] **Phase 7: Parallel Multi-Session Safety & Planning Ergonomics** - Worktree-isolated execution + merge so concurrent sessions and quick-fixes stop silently overwriting each other (axis A — file coupling); a parallel-safety gate combining `depends_on` (axis B — decision coupling) + file-scope disjointness (reuses Phase 4 dep-graph) to greenlight/refuse concurrent work and forbid parallel discussion of dependent phases; `depends_on`/`related_to` on todo frontmatter; absorbs the doctor source↔runtime symmetry-check (folded from backlog, verifies no drift post-merge); migrates the confusing backlog ID scheme to B-prefixed IDs (B1, B2…) outside the phase-number space
- [ ] **Phase 8: Validated Example Corpus** - Build a curated corpus of *validated handwritten* code examples mined from strong real-world reference projects, indexed by pattern (not by repo), with per-example commentary on what it solves and what not to cargo-cult — so GSD guidance stops leaning on plausible-but-untested LLM-generated examples. Also serves as the validated reference/eval substrate that Phase 9 needs. Absorbs CODE-EXAMPLES.md / IDEAS.md #7. (Split from the original combined Phase 8 on 2026-06-08.)
- [ ] **Phase 9: SkillOpt-Style Self-Improving Skills** - Build a GSD-native, full eval-harness + optimizer loop in the spirit of Microsoft's SkillOpt: a graded train/val/test set of real GSD tasks, an automated scorer (verifier/convergence/telemetry-derived), and an optimizer that proposes bounded edits to GSD skill/command/reference prose, accepting only validation-gated improvements. Large — likely needs its own benchmark-substrate sub-phase; consumes Phase 8's corpus as validated reference material. Absorbs the SkillOpt todo. (Split from the original combined Phase 8 on 2026-06-08.)

## Phase Details

### Phase 1: Security Hooks
**Goal**: Users running GSD on agentic pipelines have a defense-in-depth hook layer that guards against prompt injection and out-of-worktree edits — config-gated, namespace-clean, with no TypeScript or core-lib dependency
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04 (worktree-path-guard descoped to SEC-DEFER-01 per Phase 1 discussion)
**Discussion focus**: RESOLVED in 01-CONTEXT.md — 3 advisory hooks (prompt-guard + read-injection-scanner default-on, read-guard opt-in); blanket `gsd2-*` rename incl. existing 4 hooks; config gating via `.planning/config.json` `hooks.*` keys mirroring `hooks.workflow_guard`; worktree-path-guard + validate-commit deferred
**Success Criteria** (what must be TRUE):
  1. Running `npm run build:hooks` produces the 3 new `gsd2-*` guard hooks in hooks/dist/ alongside the renamed existing hooks — no build errors
  2. Running `gsd2 --claude --local` (or equivalent install) registers the new hooks in .claude/settings.json under `gsd2-*` filenames and removes stale `gsd-*` registrations
  3. Each new hook is independently enable/disable-able via a config.json key; the default posture (on vs opt-in) is documented per hook
  4. The hooks run from pure standalone JS — no import of a TypeScript-compiled lib or any new runtime dependency
**Plans**: 2 (01 rename to gsd2-*, 02 port 3 new advisory hooks + gating)

### Phase 2: Autonomous Technical Resolution
**Goal**: Technical and domain unknowns are resolved by the model autonomously — researched, self-critiqued to a confidence threshold, and decided — so they stop bouncing back to the human. The human is reserved for genuine preference/taste ("do you want it to work this way?"), never "which technical approach." Wired into the GSD decision points that currently defer to the human.
**Depends on**: Nothing (sequenced after Phase 1 by confidence; no technical dependency)
**Requirements**: RSCH-01, RSCH-02, RSCH-03
**Discussion focus**: RESOLVED in 02-CONTEXT.md — reshaped 2026-06-04 from "port a general research agent" to "autonomous technical-resolution loop" per the minimize-human-round-trips north-star. Key decisions: loops/skills over a new specialized agent; reuse `deep-research` (already does fan-out + adversarial-verify) rather than rebuild; close plan-phase's missing inline research path; tighten discuss-phase `question_triage` so LOW-confidence technical questions resolve via the loop instead of defaulting to the human.
**Success Criteria** (what must be TRUE):
  1. A reusable technical-resolution loop (research → self-critique → confidence verdict) exists, composed from existing capability — no new specialized agent. It raises LOW→HIGH confidence without human input where evidence allows.
  2. A technical/HYBRID question arising in plan-phase is resolved inline (a path that does not exist today); discuss-phase's LOW-confidence fallback no longer defaults to asking the human when evidence can resolve it. A technical question reaches the human only when confidence stays LOW after the loop exhausts, or it is genuine preference.
  3. The loop honors signal strength — skips `[STRONG]`/`[STRONG, user-override]` decisions — and records resolved technical decisions with confidence + source so they aren't re-asked downstream.
**Plans**: 3 (01 loop contract + Wave 0 test, 02 discuss-phase LOW-branch wiring, 03 plan-phase orchestrator loop + gsd-planner surfacing)

### Phase 3: Execution-Detail Enrichment
**Goal**: Planners and verifiers have codified reference docs for what good and bad code looks like (incl. Python), so plans and verifications draw on a shared "good/bad code" standard rather than improvising
**Depends on**: Nothing (sequenced after Phase 2; no technical dependency)
**Requirements**: GUIDE-01, GUIDE-02
**Reshaped-out requirements**: CTX-01, CTX-02 → doctor phase (see Discussion focus + REQUIREMENTS.md)
**Discussion focus**: RESOLVED in 03-CONTEXT.md — reshaped 2026-06-04. Docs land in `references/` (established convention). Loading is **hybrid**: verifier eager-loads (`@`) the bug-pattern doc (bad code matters most at verify time); planner references the anti-pattern doc on-demand ("Read when relevant", like `tdd.md`) to keep context lean. Python content covers idioms, anti-patterns, typing conventions. The entire context-budget cluster (CTX-01 tiers, CTX-02 classifier) was reshaped OUT: the user rejected a human-facing context warning ("only need to fix it"); the keep-context-tiny goal is met structurally (partitioning/distillation), and the forward-looking piece — an agent-assisted **doctor** that detects documented-then-overwritten decisions and archives superseded ones — becomes its own phase (see `.planning/cross-phase-notes.md`).
**Success Criteria** (what must be TRUE):
  1. Anti-pattern and bug-pattern reference docs exist in references/ and are loaded per the hybrid scheme — bug-pattern doc eager-loaded by the verifier, anti-pattern doc referenced on-demand by the planner
  2. The reference docs include Python-specific content (at minimum: Python anti-patterns, common bug patterns, and typing/idiom conventions) alongside the language-agnostic material
**Plans**: 2 (01 common-bug-patterns.md + verifier eager-load; 02 universal-anti-patterns.md [folds planner-antipatterns] + planner on-demand pointer) — both Wave 1, parallel (no shared files)

### Phase 4: Agent Observability & Telemetry
**Goal**: GSD emits a structured, code-level telemetry log of agent activity — every subagent spawn (who/when/spawning-context) and its returned confidence verdict — so loop and feature behavior is verifiable by inspecting a record rather than eyeballing a transcript. Addresses the structural problem that each new prose-based feature gets harder to dogfood-test.
**Depends on**: Nothing technically; sequenced BEFORE Phase 5 so convergence/stall-detection can consume the telemetry signal.
**Requirements**: OBS-01, OBS-02
**Discussion focus** (captured 2026-06-04, researched 2026-06-05): Mechanism = Claude Code **hooks**, reusing the Phase 1 hook infrastructure. A `PostToolUse` hook (`hooks/gsd2-agent-trace.js`, modeled on `gsd2-context-monitor.js`) with `matcher: "Task|Agent"` (amended from `"Task"` — the runtime surfaces the spawn tool as `Agent` per transcript evidence) fires on every gsd-* subagent return and appends one JSONL record (ts, agent_type, description, desc_hash, scraped confidence, seq). A `PostToolUseFailure(Task|Agent)` entry captures crashed spawns as `agent.error`. **Observability lives in code/config, NOT in prompts** (explicit user requirement): confidence is scraped from the agent's return text via a tolerant regex — zero workflow/agent prose changes. Log = append-only `.planning/telemetry/agent-trace.jsonl` (gitignored); reader = minimal `gsd-tools trace` (tail + filter), not a pretty-printer. Default-on via `config.hooks.agent_trace`. **Two empirical unknowns gate the scraper** (resolved in a Wave-0 step before implementation): the runtime `tool_name` string (Task vs Agent) and the hook `tool_response` shape (content-array vs result-string).
**Success Criteria** (what must be TRUE):
  1. A code-level hook records every `gsd-*` subagent spawn to a structured log (timestamp, agent type, spawning context) with zero changes to workflow/agent prompt files
  2. The log captures the confidence verdict of resolution/verifier agent returns, so a confidence-driven re-research (LOW → second spawn) is visible as distinct, timestamped, correlated entries
  3. Telemetry is best-effort and non-blocking — a hook failure never interrupts the agent run, and it degrades cleanly in runtimes without hook support
**Plans**: 3 (01 Wave-0 empirical fixture capture + scraper/extract TDD; 02 hook body + build/install/config/gitignore wiring + live e2e verify; 03 `gsd-tools trace` reader + tests) — 01 is Wave 0 (gates the scraper); 02 and 03 are Wave 1, parallel (no shared files)

### Phase 5: Plan-Loop Convergence and Verify Fix
**Goal**: The plan revision loop detects when it has stalled (BLOCKER+WARNING counts stop decreasing) and escalates rather than silently cycling; and verify artifacts / verify key-links work correctly on all current plans (2-space-indent fix)
**Depends on**: Nothing (sequenced after Phase 3; FIX-01 is a self-contained bug fix; CONV-01 touches plan-phase revision loop only)
**Requirements**: CONV-01, FIX-01
**Discussion focus**: Stall-detection threshold (how many cycles of non-decreasing issue counts before escalation); escalation UX (hard stop vs soft prompt vs checkpoint); whether stall state is written to a file (like ceiling-reached CHECKPOINT) or inline; parseMustHavesBlock fix scope (2-space indent only, or generalize to N-space)
**Success Criteria** (what must be TRUE):
  1. When the plan revision loop runs max_iterations without the BLOCKER+WARNING count decreasing, it emits a STALL DETECTED block and escalates to the user rather than silently completing
  2. Running `gsd-tools verify artifacts <plan-path>` on a plan with 2-space-indented must_haves block returns the correct artifact list (not "no blocks found")
  3. Running `gsd-tools verify key-links <plan-path>` on a plan with 2-space-indented must_haves block returns the correct key-links (not "no blocks found")
**Plans**: 2 plans (Wave 1, parallel)
  - 05-01 — FIX-01: generalize parseMustHavesBlock to N-space indent (frontmatter.cjs + regression tests)
  - 05-02 — CONV-01: stall-detection in the plan-phase revision loop (plan-phase.md)

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hooks | 2/2 | Complete   | 2026-06-03 |
| 2. Autonomous Technical Resolution | 3/3 | Complete   | 2026-06-04 |
| 3. Execution-Detail Enrichment | 2/2 | Complete   | 2026-06-04 |
| 4. Agent Observability & Telemetry | 3/3 | Complete   | 2026-06-05 |
| 5. Plan-Loop Convergence and Verify Fix | 2/2 | Complete   | 2026-06-06 |
| 6. Skill Self-Sufficiency | 2/3 | In Progress|  |
| 7. Parallel Multi-Session Safety & Planning Ergonomics | 5/6 | In Progress|  |
| 8. Validated Example Corpus | 3/4 | In Progress|  |
| 9. SkillOpt-Style Self-Improving Skills | 0/0 | Not planned |  |

### Phase 6: Skill Self-Sufficiency: Audit and Port superpowers Gaps into GSD

**Goal**: GSD natively covers the capability gaps currently filled by the (now-disabled) `superpowers` Claude Code plugin, so the external dependency can be dropped without losing capability. GSD becomes the single self-contained framework — no SessionStart skill-injection from a third-party plugin steering the agent.
**Depends on**: Nothing (sequenced after Phase 5; pure additive audit + port, no technical dependency on prior v1.5 phases)
**Requirements**: TBD (derived at plan time from the audit)
**Discussion focus**: This is a *port-from-superpowers* phase, mirroring v1.5's port-from-gsd-core spirit. The user disabled the `superpowers@claude-plugins-official` plugin in `~/.claude/settings.json`; its cached skills remain on disk at `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/` for mining. Coverage audit already roughed in (this session): of 14 skills, ~10 are already covered by GSD (brainstorming→discuss-phase, writing/executing-plans→plan/execute-phase, subagent-driven & dispatching-parallel→wave executor, systematic-debugging→gsd2:debug, verification-before-completion→verify-work/gsd-verifier, requesting-code-review→gsd2:review, finishing-a-development-branch→ship/pr-branch). The genuine gaps to port: (1) **execution-time TDD discipline** — enforced red-green-refactor at execute-phase, beyond today's TEST-SPEC/add-tests which only produce specs; (2) **receiving-code-review** rigor — how to consume review feedback critically rather than blindly implement; (3) **writing-skills** — a skill/command-authoring guide for GSD itself; (4) **worktree-isolation as a first-class default** in execute-phase. Open scoping for discuss: which gaps land as references/ docs vs new commands vs workflow edits; whether the existing `gsd2:debug` already absorbs systematic-debugging fully or needs the red-green loop wired in.
**Out of scope**: Hard-removal of the superpowers plugin cache + `installed_plugins.json` registry entry — explicit follow-up after this phase proves GSD covers the gaps.
**Success Criteria** (what must be TRUE):
  1. A written coverage audit maps each of the 14 superpowers skills to either an existing GSD command/reference (covered) or a concrete port target (gap), with rationale
  2. Each genuine gap is ported into GSD as a native artifact (reference doc, command, or workflow edit) that an agent loads through normal GSD flow — no dependency on the superpowers plugin being installed
  3. Running a representative GSD workflow (plan→execute) exercises the ported TDD/review/worktree behavior without any superpowers skill being available
**Plans**: 3 (all Wave 1, parallel — file-disjoint)
  - 06-01 — Gap 1: execution-time TDD discipline (tdd.md Iron Law + executor/execute-plan watch-it-fail + planner exemption)
  - 06-02 — Gap 2: receiving-code-review reference + review.md/ship.md wiring
  - 06-03 — 14-skill audit + Gap 3 artifact-authoring guide + Gap 4 git-worktree technique

### Phase 7: Parallel Multi-Session Safety & Planning Ergonomics

**Goal**: GSD makes it safe and ergonomic to run several sessions at once — start a quick-fix while a phase executes, or work two independent phases in parallel — and finish faster than serial, without the silent-overwrite mess that today's shared working tree produces. Folds in the doctor symmetry-check and tidies the planning ID model these multi-session workflows depend on.

**Depends on**: Relates to Phase 6 (which ports *worktree-isolation as a default* — Phase 7 builds the multi-session orchestration + merge on top of that primitive). Not a hard block — user intends to start Phase 7 before Phase 6 closes; sequencing to be confirmed at discuss time.

**Discussion focus** (captured 2026-06-06 from a design conversation — to be expanded at discuss-phase):

The core insight is that parallel work has **two independent coupling axes**, and they need different mechanisms — conflating them is the trap:

- **Axis A — file/write coupling.** Two tasks edit the same file. Solved by **worktree isolation**: each task runs in its own `git worktree add <dir>`, merged back at the end. This does not *prevent* conflicts — it makes them *explicit and reviewable at merge* instead of silent overwrites mid-run (today's "hard to tell if harm was done" problem). Must be a separate **worktree** (separate directory), not just a branch in the shared tree — a branch alone doesn't isolate files on disk.
- **Axis B — decision/knowledge coupling.** Task B's *correctness* depends on a decision made in task A's discussion (e.g. phase 1's discussion picks an approach that invalidates phase 2's assumption). Worktrees do **nothing** for this — the trees merge clean while the logic is built on stale ground. The only safe handling is *sequencing*: refuse to run discussion/planning of dependent phases in parallel. GSD already models these edges as `depends_on`.

Mapping cases to the dominant axis:
- *Quick-fix while a phase runs* → axis A dominates, axis B ≈ 0 → **safest, highest value; worktree-isolate and merge.**
- *Execute two already-planned phases* → axis A → safe **iff** `depends_on` shows no edge.
- *Discuss/plan two phases at once* → axis B dominates → worktrees don't help → **keep serial** (planning artifacts live in separate phase folders so they rarely collide on A anyway; the real risk is decisions).

Where isolation lives (NOT in agent prose — an LLM "remembering" to make a worktree is too fragile for a load-bearing guarantee): deterministically in **`execute-phase`** (workflow does the `git worktree add` → wave → merge) for agent-driven work, and as a **session-launch convention** (each session opened in its own worktree dir) for human-driven quick-fixes that no agent instruction would catch.

**Scope (to refine at discuss/plan):**
1. Worktree-isolated execution + merge in `execute-phase` (and the quick path) — axis A.
2. Parallel-safety gate: combine `depends_on` (axis B) + file-scope disjointness (reuse the Phase 4 file-level dependency graph + caller analysis, axis A) → greenlight / refuse a proposed parallel set; explicitly forbid parallel discussion of dependent phases.
3. `depends_on` / `related_to` on **todo** frontmatter (formalize — precedent exists: a todo already carries an informal `related:` line) so the same gate covers quick tasks, not just phases.
4. Doctor source↔runtime symmetry-check (absorbed from the ex-backlog doctor item, folded into Phase 7): `diff -rq get-shit-done .claude/get-shit-done` + settings.json hook/statusLine registration parity — and post-merge drift verification for the worktree flow.
5. Backlog ID scheme migration: B-prefixed IDs (B1, B2…) outside the phase-number space, allocated by `phase next-backlog-id` — items only receive a real phase number when promoted into a milestone.

**Success Criteria** (what must be TRUE):
  1. A quick-fix run in a parallel session no longer silently overwrites a concurrently-executing phase — conflicts surface as a reviewable merge.
  2. A documented gate decides, from `depends_on` + file-scope, whether a proposed parallel set is safe, and refuses parallel discussion of dependent phases.
  3. Todos carry `depends_on`/`related_to` and the gate reads them.
  4. The doctor command reports source↔runtime drift in one invocation.
  5. The backlog ID scheme no longer reuses the phase-number space — B-prefixed IDs (B1, B2…) are allocated outside it.

**Plans**: 6 across 4 waves
  - 07-01 (W1) — gsd-tools worktree CLI primitive (add/merge/remove/prune) + Wave-0 smoke + tests (SC1)
  - 07-02 (W1) — todo depends_on/related_to frontmatter schema + init parse + add-todo template (SC3)
  - 07-03 (W1) — source↔runtime symmetry-check folded into /gsd2:health (+--repair), exported for reuse (SC4)
  - 07-04 (W2) — backlog ID migration to B-prefixed IDs (next-backlog-id allocator + commands + dir migration) (SC5)
  - 07-05 (W3) — parallel-safe gate CLI (axis-B refuse / axis-A warn / greenlight), reads phase + todo edges (SC2,SC3)
  - 07-06 (W4) — wire worktree+merge+symmetry into execute-phase; gate into execute/discuss/plan; auto-worktree into quick (SC1,SC2,SC4)

### Phase 8: Validated Example Corpus

**Goal**: GSD guidance draws on a curated corpus of *validated, human-maintained* code examples mined from strong real-world reference projects — indexed by pattern, with commentary — instead of leaning on plausible-but-untested LLM-generated examples. The corpus is structured to also serve as the validated reference/eval substrate Phase 9 will consume.

**Depends on**: Nothing technically. Sequenced after Phase 7. Relates to Phase 3 (reference docs — same `references/` hybrid-load scheme) and Phase 6 (skill self-sufficiency). Feeds Phase 9.

**Discussion focus** (captured 2026-06-08; split from the original combined Phase 8 per user decision — the SkillOpt loop moved to Phase 9):

Build a small internal catalog *by pattern, not by repo* (e.g. CLI parsing, async retry, validation layer, config loading, telemetry hook, planner-prompt structure), with per-example commentary on what constraint it solves and what NOT to cargo-cult — connected to the failure modes the verifier/debug loops repeatedly catch. Source: `.planning/reference/CODE-EXAMPLES.md` (candidate sources + selection criteria already drafted), `IDEAS.md` #7. Open questions for discuss: corpus shape (excerpt vs link-only — licensing), how examples enter GSD's flow (which agents/refs consume it), what "validated" means operationally, and the initial bucket/language scope.

**Success Criteria** (what must be TRUE — to refine at discuss/plan):
  1. A validated-example corpus exists as a pattern-indexed catalog with explicit selection criteria, sourced from real reference projects (not synthetic), with per-example commentary on what it solves and what not to cargo-cult
  2. The corpus is loaded into at least one GSD flow (e.g. planner/verifier reference) through the normal references mechanism
  3. The corpus is structured so Phase 9 can consume it as validated reference/eval material

**Plans**: 4 across 3 waves
  - 08-01 (W1) — corpus structure: entry _TEMPLATE.md (front-matter schema + commentary sections, counters locked to common-bug-patterns.md headers) + SELECTION-CRITERIA.md + slim INDEX.md schema (SC1)
  - 08-02 (W2) — curate 3 Python seed entries (error-propagation/requests, validation-layer/pydantic, resource-management/cpython) with real attributed excerpts (SC1, SC3)
  - 08-03 (W2) — curate 3 Node/TS seed entries (async-retry/undici, validation-layer/zod, config-env/fastify-or-node) with real attributed excerpts (SC1, SC3)
  - 08-04 (W3) — populate INDEX rows + wire on-demand pointer into gsd-planner.md code_quality_reference + propagate runtime copy (SC2)

### Phase 9: SkillOpt-Style Self-Improving Skills

**Goal**: GSD's skill/command/reference prose stops being static — a GSD-native optimizer loop, in the spirit of Microsoft's SkillOpt, evolves it against a graded benchmark of real GSD tasks, accepting only validation-gated improvements.

**Depends on**: Phase 8 (consumes the validated-example corpus as reference/eval material). Builds on Phase 4 telemetry (`agent-trace.jsonl`) and Phase 5 convergence signals as candidate scorers.

**Discussion focus** (captured 2026-06-08 — to be expanded at its own discuss-phase):

This is the ambitious thread, deliberately split out because it's large (the user picked "full eval harness + loop"). SkillOpt ([arXiv 2605.23904](https://arxiv.org/abs/2605.23904), [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt)) treats a single skill doc as the trainable state of a frozen agent: `rollout → reflect → bounded edit → validation-gate → update`, across epochs, accepting an edit only when a held-out score strictly improves.

The hard prerequisite — and the core challenge of this phase — is an **eval substrate GSD does not yet have**: a `train/val/test` set of real GSD tasks plus an **automated scorer**. GSD's emitted artifacts (CONTEXT.md, PLAN.md, code) are not trivially auto-gradable like SkillOpt's QA benchmarks. Candidate score signals to investigate: verifier BLOCKER/WARNING counts, plan-loop convergence iterations (Phase 5), telemetry confidence verdicts (Phase 4). Likely needs its own **benchmark-substrate sub-phase** before the optimizer loop is buildable. Open scoping for discuss: what counts as a gradable GSD "task," which prose artifacts are the optimization target (agent instructions vs command/workflow prose vs references), the optimizer model, and whether to reuse `microsoft/SkillOpt` directly vs. a GSD-native reimplementation.

**Success Criteria** (what must be TRUE — to refine at its own discuss/plan):
  1. A graded benchmark of real GSD tasks exists with an automated scorer (built on verifier/convergence/telemetry signals)
  2. An optimizer proposes bounded add/delete/replace edits to a target GSD skill/command/reference artifact and accepts only validation-gated improvements
  3. At least one GSD artifact is measurably improved by the loop against held-out tasks, with the before/after score recorded

**Plans**: TBD (run `/gsd2:plan-phase 9` to break down)

## Backlog

### B1: Terse output default + verbose opt-in (BACKLOG)

**Goal:** GSD command/agent output defaults to a minimal terse form (smallest possible sentence, no filler) with an opt-in detailed mode for the current verbose prose. Applies to workflow reports and agent-facing summaries. Surfaced 2026-06-05 — detailed output is valued but overwhelming as the default.
**Requirements:** TBD
**Plans:** 3/4 plans executed

Plans:
- [ ] TBD (promote with /gsd2:review-backlog when ready)
