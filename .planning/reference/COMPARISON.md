# GSD2 vs GSD-Core — Comparison Summary

**Compared:** `mine/` = `itsoneword/get-shit-done` (npm `gsd2`, v1.4.6) — your experimental fork —
against `core/` = `open-gsd/gsd-core` (`@opengsd/gsd-core`, v1.2.0) — the original line continued
in a different direction. Both cloned 2026-06-03. This summary sits on top of four subagent-written
sections: [1. Workflow](01-workflow.md) · [2. Inventory & Overlap](02-inventory.md) ·
[3. Node Layer](03-node.md) · [4. Porting Candidates](04-porting.md).

---

## The one-paragraph picture

Both descend from one common ancestor (TÂCHES' GSD) and share the same spine:
`new-project → discuss → plan → execute → verify → transition → ship → milestone`.
From there they diverged in **opposite directions**. **Your fork deepened the *front* of the
pipeline** — the quality of captured intent: conversation-first discussion, decision
signal-strength tags, cross-phase note pollination, specialist-in-the-loop — while *slimming*
the prose everywhere else. **Core widened the *whole* pipeline** — it kept the original
gray-area-menu discussion and bolted on dozens of new sub-stages, modes, guard hooks, a
TypeScript engine, and a heavy test/quality apparatus. This is **not "mine = an older core."**
They are two divergent descendants. Core is bigger and more engineering-mature; your fork is
more focused and carries genuinely unique ideas core does not have.

## Answers to your three questions

### 1. Is the workflow different, and where?
Same skeleton, diverged at specific stages (full detail in §1):

| Stage | mine (fork) | core | Verdict |
|---|---|---|---|
| **Init** | classic flow + roadmapper emits per-phase **"Discussion focus"** hint; milestone-partitioned `.planning/{milestone}/` layout | superset: multi-runtime detection, MVP/Horizontal mode, spike/sketch ingestion, drift-guard, PR-body onboarding | core = superset + 1 fork tweak |
| **Discussion** | **rewritten** to conversation-first; `[STRONG]/[WEAK]/[DISCRETION]` signal tags; cross-phase pollination; specialist micro-research | **kept** the gray-area menu, multiplied into a mode engine (power/advisor/assumptions/batch/analyze) + SPEC-lock + anti-pattern gates | **materially different — same filename, opposite philosophy** (sharpest divergence) |
| **Research** | folded into plan-phase; reused earlier for discuss-phase micro-research | folded into plan-phase too, **plus** a domain/AI research tier (AI-SPEC, 4-agent chain) | shared core + core superset |
| **Planning** | planner↔checker revision loop (≤3); signal-strength-aware preference-gap surfacing; Nyquist/AGENT-SPEC gates | same loop **plus** spec-phase, mvp-phase, ultraplan, cross-AI plan-review-convergence, secure-phase, big planner-reference library | shared loop, core broad superset |
| **Execution** | shared wave engine + **inline verify→investigate→fix loop** (mine-only) | shared wave engine + worktree/drift/post-merge gates, cross-AI execution, MVP-TDD path (core-only) | same engine, different bolt-ons |
| **Verify/Ship/Loop-back** | leaner ancestor + verify-loop | **LEARNINGS graduation scan** (cross-phase pattern promotion) + AI eval-review (core-only) | loop-back materially different |

**Your three signature ideas are verified unique to your fork** — a whole-tree grep of `core/`
for signal-strength tags, cross-phase-notes, and specialist micro-research returns **zero**.

### 2. Agents / commands / hooks / skills (counts + overlap; full tables in §2)

| Surface | mine | core | In both | Only mine | Only core |
|---|---:|---:|---:|---:|---:|
| Agents | 22 | 33 | 16 | 6 | 17 |
| Commands | 53 | 67 | 32 | 21 | 35 |
| Hooks | 4 | 15 (+lib) | 4 | 0 | 11 |
| Skills | 0 | full subsystem | — | — | — |

- **Important nuance:** "in both" means *same filename* — your fork **rewrote every shared agent
  prompt** (README: −46% lines) and **forked `discuss-phase` behaviorally**. So same-name ≠ same-behavior.
- **Biggest core-only gaps:** (1) a **security/guard hook layer** (5 guards incl. 2 hard blockers)
  your fork has none of; (2) an **AI/eval agent cluster**; (3) a **docs/knowledge-graph subsystem**;
  (4) `ns-*` namespace routers; (5) the **skills system** itself.
- **Your fork's counter-investment** is a *contract-first* layer (agent-spec, test-spec,
  document/SYSTEM-MAP) plus finer-grained capture commands (note, backlog, todos, plant-seed).
- **"Skills" in core ≠ superpowers skills:** core's commands *are* its skills — `commands/gsd/*.md`
  carry `requires:` frontmatter, linted as a dependency graph and cross-runtime-synced. Your fork
  dropped that machinery and ships plain `/gsd2:` slash commands.

### 3. The Node side — how core execution works in each (full detail in §3)

**A premise in my own brief was wrong, and the subagent caught it — worth knowing:** core's
`fallow-runner.cts` + `@anthropic-ai/claude-agent-sdk` + `ws` are **NOT** a programmatic Claude-agent
runner. `fallow-runner` just locates an external **Rust static-analysis CLI** (`fallow`) for the
code-review workflow; the `claude-agent-sdk` and `ws` deps are **declared but unimported** (the
Anthropic SDK is even flagged internally as an npm-audit liability to remove). A real query-bridge
path *did* once exist — core's *own* `@opengsd/gsd-sdk` — but it was **deliberately retired**
(ADR-0174 / #191 / #505), leaving inert shims in `gsd-tools.cjs`.

**So at the node level, both products are the same kind of thing:** a deterministic CLI of helpers
(`gsd-tools.cjs`) that the markdown workflows shell out to. The LLM/agent loop lives in the host
harness (Claude Code / Codex / Gemini), *outside* this node layer. **Neither ships a live autonomous
agent runner.** The genuine divergence is the engine's *form and rigor*:

| | mine | core |
|---|---|---|
| Language | pure CommonJS, no build | TypeScript `.cts` → `.cjs` via `tsc` (88 sources, ~35K lines) |
| Dispatch | one flat `switch` over 16 `lib/*.cjs` | typed no-throw `command-routing-hub` + `*-command-router` layer |
| Observability | none | `event/logger/redaction` (traceIds, opt-in JSONL audit, arg redaction) |
| Installer | plain copy | transactional migrations engine (manifest + lock + crash-recovery) |
| Tests | 29 files, 1 glob runner | 617 files, 5 suites + Stryker mutation + ESLint(+4 custom rules) + changesets |
| Extra capability modules | — | workstreams, intel store, drift detector, graphify, **`from-gsd2` importer** |

The engineering-maturity gap is large and one-directional. (Notable: core can *import from* gsd2 —
the original line knows about your fork.)

---

## What this means for the fork (feeds the IDEAS list)

- **Preserve and consider upstreaming** your discussion-side differentiators (signal strength,
  conversation-first, cross-phase pollination, specialist-in-the-loop). They're genuinely unique
  and would slot into core's discuss-phase — especially paired with core's `import.md` decision-conflict detection.
- **Cheapest high-value ports** (map to your ideas): anti-pattern/bug-pattern reference docs (idea#3),
  context-budget rules + utilization classifier (idea#2, which also *answers* "was that work finished?" —
  core has it), and stall-detection in the plan loop (idea#4). Full prioritized table in §4.
- **Graphify (idea#1) is a Medium, not a slam-dunk:** core's graph is a *code* graph, not the
  *bug/feature* level-1/2/3 links you want — reusable as scaffolding, but the schema needs rework;
  `analyze-dependencies` is the cheaper first step.

See [IDEAS.md](IDEAS.md) for your full parked idea list.


---

# 1. Workflow & Lifecycle

This section traces a unit of work through both systems stage by stage. `mine/` is the
experimental fork (`gsd2`, v1.4.x, forked from upstream v1.26) and `core/` is the original
line continued as `@opengsd/gsd-core` (v1.2.x). The two `workflows/` dirs are the same
layer renamed; same filenames frequently hide diverged behavior, so each stage below was
read in both repos rather than assumed equal.

**Headline shape of the divergence.** Both share an identical common-ancestor spine
(`new-project → discuss-phase → [research folded into] plan-phase → execute-phase →
verify → transition → ship → complete-milestone`, with `next.md` as the auto-router). From
that spine they evolved in opposite directions:

- **`mine/` deepened the front of the pipeline** — it rewrote discuss-phase into a
  conversation-first flow and added a *quality-of-intent* layer (signal strength,
  cross-phase pollination, specialist-in-the-loop, discussion-focus hints) plus an
  inline verify-loop during execution. It also slimmed the procedural prose everywhere.
- **`core/` widened the pipeline** — it kept the original gray-area-menu discuss-phase
  and bolted on many *new sub-stages and modes* around it (spec-phase, mvp-phase,
  ai-integration-phase, spike, sketch, secure-phase, eval-review, graduation,
  ultraplan, cross-AI plan-review-convergence, advisor/power/batch/analyze discuss
  modes, worktree/drift gates, multi-runtime support).

These are two divergent descendants of one ancestor — not "mine = a newer core."

---

## 1.0 Workflow inventory (high level)

`core/` has ~83 workflow files to `mine/`'s ~50. Files present in **core only** that
materially affect the lifecycle: `spec-phase`, `mvp-phase`, `ai-integration-phase`,
`ultraplan-phase`, `plan-review-convergence`, `secure-phase`, `eval-review`, `graduation`,
`spike` / `spike-wrap-up`, `sketch` / `sketch-wrap-up`, `extract-learnings`,
`discuss-phase-power`, `discuss-phase-assumptions`, plus the `discuss-phase/` (modes +
templates), `execute-phase/` (gate steps) and `help/` subdirs, and workspace/thread
management (`new-workspace`, `list-workspaces`, `thread`, `manager`, `import`).

Files present in **mine only**: `research-phase.md` (standalone research wrapper), plus
mine's domain-router additions `agent-spec-phase.md` and `test-phase.md`. (Note: `do`,
`quick`, `plant-seed`, `profile-user`, `discovery-phase` exist in **both** repos.)

Agents diverge similarly. **mine 22 agents**; **core 32**. Core adds a research/spec
agent roster with no analog in mine: `gsd-advisor-researcher`, `gsd-ai-researcher`,
`gsd-domain-researcher`, `gsd-framework-selector`, `gsd-eval-planner`, `gsd-eval-auditor`,
`gsd-security-auditor`, `gsd-assumptions-analyzer`, `gsd-pattern-mapper`,
`gsd-doc-classifier`/`gsd-doc-synthesizer`/`gsd-doc-verifier`/`gsd-doc-writer`. Mine's
unique agents are `gsd-agent-researcher`/`gsd-agent-checker` (for AGENT-SPEC),
`gsd-test-designer`, `gsd-fixer`, `gsd-document-mapper`/`gsd-document-updater`.

---

## 1.1 INIT / Project setup

**Files:** `*/workflows/new-project.md`, agent `gsd-roadmapper`, `gsd-project-researcher`,
`gsd-research-synthesizer`, `gsd-user-profiler`.

**What mine does.** `new-project.md` runs the classic unified flow: setup → brownfield
offer → deep questioning (freeform "What do you want to build?") → write PROJECT.md →
workflow-preference config → optional 4-way parallel project research
(Stack/Features/Architecture/Pitfalls via `gsd-project-researcher`) → synthesizer →
define REQUIREMENTS.md → spawn `gsd-roadmapper` → ROADMAP.md + STATE.md. Auto-mode
(`--auto @doc`) chains straight into `discuss-phase 1 --auto`. The roadmapper here is
modified to emit a per-phase `**Discussion focus**:` hint (`mine/agents/gsd-roadmapper.md`)
— a fork addition consumed later by discuss-phase.

**What core does.** Same skeleton, but with substantial additions woven into Step 1–8:
- **Agent-install verification** (`agents_installed`, `missing_required_agents`) — refuses
  or degrades gracefully if subagents aren't registered.
- **Multi-runtime detection** — derives `RUNTIME=claude|codex|gemini|opencode`, switches the
  instruction file to `AGENTS.md` for Codex, and supports `TEXT_MODE` (plain-text numbered
  lists replacing `AskUserQuestion`) for non-Claude CLIs.
- **Sub-repo detection** (`planning.sub_repos`) and **nested-worktree git guard**.
- **Prior spike/sketch detection** (Step 2b) — surfaces `.planning/spikes|sketches/` findings
  skills to seed questioning.
- **PR-body onboarding** (Step 2a/5) — seeds `ship.pr_body_sections` (user stories,
  risks, release criteria, stakeholder approval).
- **Drift-guard config** (`plan_review.source_grounding`) and **Project Structure Mode**
  (Step 7.5: Vertical MVP vs Horizontal Layers → sets `PROJECT_MODE`, which makes the
  roadmapper stamp `**Mode:** mvp` per phase).

**User-profiling & discovery.** Both ship `profile-user.md` + `gsd-user-profiler` and
`discovery-phase.md` (the latter is the same depth-leveled, plan-phase-invoked DISCOVERY.md
stage in both). The divergence is in *consumption*: core wires user-profiling into a
downstream **advisor discuss mode** — `core/.../discuss-phase.md` auto-enables advisor mode
when `USER-PROFILE.md` exists, driving research-backed comparison tables via
`gsd-advisor-researcher` — whereas mine has the `gsd-user-profiler` agent but no advisor-mode
consumer of its output. So core turns the profile into lifecycle behavior; mine leaves it
inert. This reinforces the "core widened" pattern.

**Divergence: superset (core) + one fork tweak (mine).** Core is a strict superset of
mine's init plus MVP-mode seeding, multi-runtime, drift-guard, and spike/sketch ingestion.
Mine's only init-stage divergence is the roadmapper discussion-focus hint
(`mine/agents/gsd-roadmapper.md:Discussion focus`), which has **no analog in core's
roadmapper** (`grep` for "discussion focus" in `core/agents/gsd-roadmapper.md` → 0).
Mine also carries a milestone-partitioned `.planning/{milestone}/phases/` data layout (v1.4)
with `partition_root`/`milestone_root` resolution — **26 references in mine, 0 in core** — a
structural storage divergence affecting every later path resolution.

---

## 1.2 DISCUSSION

This is the sharpest single divergence in the two systems.

**What mine does** (`mine/.../discuss-phase.md`). A **conversation-first** rewrite:
- Opens with "Tell me about this phase" (freeform), **not** a pre-generated multiple-choice
  menu. `AskUserQuestion` is reserved for binary choice points only.
- `build_understanding` step scouts the codebase and **classifies ESTABLISHED (don't ask)
  vs NEW (discuss)**, plus a domain classifier (UI / Agentic / Generic / UI+Agentic) that
  routes the next stage.
- **Signal strength** on every captured decision: `[STRONG]` / `[WEAK]` / `[DISCRETION]`,
  with specialist-backed variants `[STRONG, specialist-backed]`, `[WEAK, specialist-backed]`,
  `[STRONG, user-override]`. These tags are explicitly consumed downstream (planner won't
  deviate from STRONG, can adjust WEAK).
- **Specialist-in-the-loop** (`<question_triage>`): before asking any implementation
  question, classify PREFERENCE (ask user) vs TECHNICAL (spawn `gsd-phase-researcher` in
  micro-research mode) vs HYBRID (research then present options). Budget 0–5 micro-research
  calls per session.
- **Cross-phase pollination**: insights relevant to other phases are appended to
  `.planning/cross-phase-notes.md` and pre-loaded when those phases are later discussed
  ("From your Phase 2 discussion, you mentioned X. Still the plan?").
- **Discussion-focus hints**: reads the roadmapper's `**Discussion focus**:` line to
  prioritize the conversation.
- Outputs CONTEXT.md (+ DISCUSSION-LOG.md audit trail) with `<established>`,
  `<expected_outcome>`, `<canonical_refs>` (mandatory), `<code_context>` sections.

**What core does** (`core/.../discuss-phase.md` + `discuss-phase/modes/*`). Core **kept the
original gray-area menu** — the very thing mine's README says it replaced. The flow is
`analyze_phase` (generate phase-specific gray areas) → `present_gray_areas`
(multiSelect `AskUserQuestion`, "Which areas do you want to discuss?") → `discuss_areas`
(4 single-question turns per area). Rather than replacing this, core **multiplied it into a
mode-dispatch engine** with lazy-loaded mode files:
- `--power` → `discuss-phase-power.md`: generates ALL questions upfront into a
  `QUESTIONS.json` + an HTML companion UI, user answers async, one-pass CONTEXT.md.
- `--all` / `--auto` / `--batch` / `--analyze` / `--text` overlays (auto-pick, multi-question
  turns, trade-off tables, plain-text rendering); overlays stack in fixed order.
- **Advisor mode** (auto-detected when `USER-PROFILE.md` exists) → `modes/advisor.md`:
  research-backed comparison tables via `gsd-advisor-researcher`, table-first selection for
  non-technical owners.
- `discuss-phase-assumptions.md`: a codebase-first variant that surfaces evidence-cited
  assumptions and only asks the user to correct what's wrong (~2–4 corrections vs ~15–20
  questions), via `gsd-assumptions-analyzer`.
- `references/autonomous-smart-discuss.md`: a batch-table autonomous variant invoked from
  `execute-phase`/`autonomous`.
- Core adds front-gates mine lacks: **SPEC.md lock** (`check_spec`: if spec-phase ran, its
  requirements are pre-answered), **blocking anti-pattern gate** (must answer 3 questions
  about each `blocking` anti-pattern in `.continue-here.md`), **discussion checkpoints**
  (`*-DISCUSS-CHECKPOINT.json`, resumable), and a bounded **DECISIONS-INDEX.md** rolling
  summary in place of reading all prior CONTEXT.md files.

**Divergence: materially different.** Same filename, opposite philosophy — core =
menu-driven gray-area selection elaborated into many modes; mine = single conversation-first
flow. The fork's three signature ideas are **verified unique to mine**: a whole-tree grep of
`core/` for `[STRONG]`/`[WEAK]` signal tags, `cross-phase-notes`, `micro-research`, and
`specialist-backed` returns **zero**. (Nuance: a "Claude's Discretion" / "You decide" bucket
*does* exist in core's CONTEXT.md template — that is shared ancestry, not the same thing as
mine's graded `[STRONG]/[WEAK]/[DISCRETION]` signal-strength system.) Conversely, core's
power/advisor/assumptions/batch modes and the SPEC-lock + anti-pattern gates have **no
analog in mine**.

---

## 1.3 RESEARCH

**Files:** `mine/.../research-phase.md` (standalone), agents `gsd-phase-researcher`,
`gsd-project-researcher`; core folds phase research into `plan-phase.md`.

**What mine does.** Research is **folded into plan-phase** by default
(`plan-phase.md` Step 5 spawns `gsd-phase-researcher` → RESEARCH.md). `research-phase.md`
exists only as a thin standalone wrapper. Project-level research (4-way parallel) lives in
`new-project`. Mine adds a fork twist: the discuss-phase specialist-in-the-loop reuses
`gsd-phase-researcher` in a *micro-research* mode during conversation — research begins one
stage earlier than core.

**What core does.** Same fold-into-plan-phase model (`core/.../plan-phase.md` also spawns
`gsd-phase-researcher`). But core layers a whole **domain-aware research tier on top** via
`ai-integration-phase.md`, a dedicated pre-plan sub-stage for AI systems that orchestrates
`gsd-framework-selector → gsd-ai-researcher → gsd-domain-researcher → gsd-eval-planner` into
an **AI-SPEC.md** contract (framework choice, implementation guidance, domain rubric,
evaluation strategy). Core also adds `gsd-pattern-mapper` (PATTERNS.md from codebase) into
the plan-phase agent set.

**Divergence: shared core + superset (core) + earlier-start tweak (mine).** Both fold phase
research into planning. Core supersets with the `ai-*`/`domain-*`/`framework-selector`/
`eval-planner` research roster and the AI-SPEC stage (no analog in mine). Mine's only
research-stage divergence is starting micro-research during discussion. Mine's parallel
specialist asset is `agent-spec-phase` (an AGENT-SPEC contract for agentic phases via
`gsd-agent-researcher`) — roughly analogous in spirit to core's AI-SPEC but a different,
lighter artifact.

---

## 1.4 PLANNING

**Files:** `*/workflows/plan-phase.md`, agents `gsd-planner`, `gsd-plan-checker`; core
extras `ultraplan-phase`, `mvp-phase`, `spec-phase`, `plan-review-convergence`,
`secure-phase`, plus `references/planner-*.md`, `revision-loop.md`.

**What mine does** (`plan-phase.md`, ~900 lines). Default flow Research → Plan → Verify →
Done with a **revision loop (max 3)** between `gsd-planner` and `gsd-plan-checker`. Fork-
relevant features: PRD express path (`--prd`), Nyquist validation strategy (VALIDATION.md,
Dimension-8 coverage), domain-aware UI/Agent-spec gates that read discuss-phase's
`Detected domain:`, a **preference-gap check** (planner emits an `## ASSUMPTIONS` table;
only `preference`-typed assumptions are surfaced to the user — the signal-strength ethos
carried into planning), and a requirements-coverage gate. CONTEXT.md signal strength is
honored ("planner won't deviate from STRONG").

**What core does** (`plan-phase.md`, ~1810 lines — 2× mine). Same planner/checker/revision-
loop core, but the surrounding planning stage is far wider:
- **`spec-phase.md`** — a Socratic WHAT-clarification stage *before* discuss, with a
  quantitative ambiguity model (weighted Goal/Boundary/Constraint/Acceptance scoring, gate
  at ≤0.20). Produces SPEC.md that discuss-phase then treats as locked. No analog in mine.
- **`mvp-phase.md`** — "As a / I want / So that" user story + **SPIDR splitting** check,
  writes `**Mode:** mvp` to ROADMAP, and the planner switches to MVP-TDD mode
  (`references/planner-mvp-mode.md`, `execute-mvp-tdd.md`, `verify-mvp-mode.md`). A whole
  alternate planning/execution/verification track with no analog in mine.
- **`plan-review-convergence.md`** — cross-AI convergence loop (Codex/Gemini/Claude/
  Ollama/LM-Studio reviewers) that automates plan → review → replan cycles until HIGH-
  severity findings converge. Unique to core.
- **`ultraplan-phase.md`** (BETA) — offloads planning to Claude Code's ultraplan cloud.
- **`secure-phase.md`** — threat-register planning/verification via `gsd-security-auditor`.
- A large `references/planner-*.md` library (chunked, gap-closure, graphify-auto-update,
  human-verify-mode, interface-context, mvp-mode, revision, source-audit, antipatterns)
  that parameterizes the planner far beyond mine's single planner prompt.

**Divergence: shared loop, core is a broad superset.** Both center on a planner ↔
plan-checker revision loop (≤3). Core adds entire pre-plan and alternate-track sub-stages
(spec, mvp, ai-integration, secure) plus cross-AI convergence and a rich planner reference
library — none of which exist in mine. Mine's unique planning contributions are the
signal-strength-aware preference-gap surfacing and the Nyquist/AGENT-SPEC gates.

---

## 1.5 EXECUTION

**Files:** `*/workflows/execute-phase.md` (+ core `execute-phase/steps/*`), agents
`gsd-executor`, `gsd-verifier`, `gsd-fixer`, `gsd-debugger`.

**What mine does** (`execute-phase.md`, ~830 lines). Wave-based parallel execution:
orchestrator stays lean, spawns `gsd-executor` per plan, groups into dependency waves,
spot-checks SUMMARY.md/commits, runs a post-wave hook validation and a **cross-phase
regression gate**, then `gsd-verifier` for goal achievement → gap-closure cycle
(`--gaps`). The fork's signature execution addition is the **inline verify-loop sub-flow**
(v1.4): any task marked `verify_after` triggers a fresh-context
verifier → investigator(`gsd-debugger`) → fixer(`gsd-fixer`) loop, max 3 iterations, with
a `.planning/debug/{slug}-verify-loop.md` trace and a ceiling-reached checkpoint.

**What core does** (`execute-phase.md`, ~1740 lines). Same wave-based core and spot-check
fallbacks, but adds:
- **Cross-AI execution** (`--cross-ai` / `--no-cross-ai`, 17 references) — plans can be
  routed through other AI runtimes during execution.
- **Worktree / drift gates** (`execute-phase/steps/per-plan-worktree-gate.md`,
  `codebase-drift-gate.md`, `post-merge-gate.md`) — per-plan git-worktree isolation and a
  drift gate that grounds plan symbols against live source.
- MVP-TDD execution track (`execute-mvp-tdd.md`) for mvp-mode phases.

**Divergence: same wave engine, different bolt-ons.** Both share the lean-orchestrator,
wave-grouped, spot-check-fallback executor. **Mine-unique:** the inline verify-loop
(`grep verify_loop` in core's execute-phase → 0). **Core-unique:** cross-AI execution,
worktree/drift/post-merge gates, and the MVP-TDD execution path.

---

## 1.6 VERIFY / SHIP / LOOP-BACK

**Files:** `verify-phase`, `verify-work`, `audit-milestone`, `audit-uat`, `complete-milestone`,
`pr-branch`, `ship`, `transition`, `next`; core extras `eval-review`, `graduation`,
`extract-learnings`.

**Verify.** `verify-phase`/`verify-work` are the same conversational-UAT layer in both
(UAT.md survives `/clear`, feeds `plan-phase --gaps`). Both run `gsd-verifier` for goal
achievement during execute-phase. Mine's v1.4 verifier-loop primitives (above) extend the
verifier into a loop role; core keeps the verifier standalone and adds, for AI phases, a
retroactive `eval-review.md` audit (`gsd-eval-auditor` scoring eval coverage against
AI-SPEC.md) — no analog in mine.

**Transition (loop-back) — the material divergence here.** `transition.md` is internal in
both (invoked by execute-phase auto-advance). Mine's is ~9KB; core's is ~18KB. Core's
transition contains a **`graduation_scan` step** that delegates to `graduation.md`: it
clusters recurring items across the last N phases' **LEARNINGS.md** files and surfaces
HITL promotion candidates (configurable window/threshold, non-blocking). Mine's transition
has **no graduation step and no LEARNINGS.md concept** (`grep graduation|LEARNINGS` →
core: present; mine: 0). Core also has a standalone `extract-learnings.md`. So core has a
cross-phase *learning* loop-back that mine lacks entirely.

**Ship / milestone.** `ship.md` (PR creation + rich PR body) and `audit-milestone.md` are
the same layer in both. Core's ship body is wired to the `ship.pr_body_sections` config
seeded at init (PRD-style sections); mine's is the leaner ancestor. `complete-milestone.md`
is largely the same — both extract one-liners from `*-SUMMARY.md`, do PROJECT.md evolution,
reorganize ROADMAP.md, tag the release. Mine's CHANGELOG claims a typed-tag milestone
distillation artifact (`decisions[]`/`public_api[]`/`entry_points[]`); that typed schema is
**not present in mine's `complete-milestone.md` workflow** (likely CLI-side or aspirational),
so it is not a verified workflow-level divergence. Mine's verified milestone-stage divergence
is the partitioned `.planning/{milestone}/` layout that scopes what milestone close reads.

**`next.md`** is the same auto-router in both (`discuss → plan → execute → verify → complete`).

**Core-only extra stages with no lifecycle analog in mine:** `spike` / `sketch`
(experiential exploration & throwaway HTML mockups, wrap-up into findings skills consumed by
new-project/discuss), `secure-phase`, `eval-review`, `graduation`, `ultraplan-phase`,
`plan-review-convergence`, `mvp-phase`, `ai-integration-phase`, `spec-phase`, plus
workspace/thread management.

**Divergence:** verify/ship/milestone/next are largely the **same layer** (mine slimmed).
**Loop-back is materially different** — core adds a LEARNINGS graduation loop and AI eval
audit that mine lacks; mine adds the verifier→fixer auto-loop that core lacks.

---

## Workflow divergence summary

- **One ancestor, two directions.** Both descend from upstream's
  `new-project → discuss → plan → execute → verify → transition → ship → milestone` spine.
  `mine` deepened the *front* (intent quality), `core` widened the *whole* (more sub-stages
  and modes).
- **The discuss-phase split is the sharpest divergence.** `core` **kept and elaborated** the
  gray-area selection menu into a mode engine (power/advisor/assumptions/all/batch/analyze/
  auto + SPEC-lock + anti-pattern gates + resumable checkpoints); `mine` **replaced** it with
  a single conversation-first flow. Same filename, opposite philosophy.
- **Mine's three signature ideas are verified unique to mine.** `[STRONG]/[WEAK]/[DISCRETION]`
  signal strength (+ specialist-backed variants), `cross-phase-notes` pollination, and
  specialist-in-the-loop micro-research during discussion return **zero** matches across all
  of `core/`. (A "Claude's Discretion" bucket is shared ancestry — not the graded system.)
- **Discussion-focus hint** is a small but real mine-only roadmapper change that wires
  roadmap → discussion; core's roadmapper has no such field.
- **Core has whole pre-plan sub-stages mine lacks:** `spec-phase` (Socratic WHAT-clarification
  with ambiguity scoring), `mvp-phase` (SPIDR/user-story MVP-TDD track), `ai-integration-phase`
  (AI-SPEC contract via a 4-agent research chain), `secure-phase` (threat register). Mine's
  only parallel pre-plan contract is the lighter `agent-spec-phase`.
- **Core has exploration & cross-AI stages mine lacks entirely:** `spike` / `sketch`
  (feasibility/design experiments that wrap into findings skills feeding new-project/discuss),
  `plan-review-convergence` (multi-model plan convergence), cross-AI *execution*,
  `ultraplan-phase` (cloud planning).
- **Execution shares the wave engine but diverges on bolt-ons.** Mine-only: the inline
  `verify_after` verifier→investigator→fixer loop. Core-only: per-plan worktree isolation,
  codebase-drift / post-merge gates, cross-AI execution, MVP-TDD path.
- **Loop-back diverges materially.** Core's `transition` runs a LEARNINGS `graduation` scan
  (cross-phase pattern promotion) and offers AI `eval-review`; mine has neither LEARNINGS
  nor graduation. Mine's loop-back is the leaner ancestor plus its verify-loop.
- **Core is multi-runtime and workspace-aware; mine is Claude-first and single-tree.** Core
  threads `RUNTIME` (codex/gemini/opencode), `TEXT_MODE`, `AGENTS.md`, sub-repos, worktrees,
  and `thread`/`workspace` management throughout; mine targets Claude Code with `gsd2`
  namespace and a milestone-partitioned `.planning/{milestone}/` data layout (mine-only).
- **Net:** `core` optimizes for *breadth and ceremony* (more gates, modes, contracts, AI
  rigor, multi-runtime); `mine` optimizes for *fidelity of user intent through the pipeline*
  (capture it richly once in conversation, tag its strength, pollinate it across phases,
  and let a specialist resolve technical questions instead of the user guessing) plus prose
  slimming.


---

# 2. Inventory & Overlap

Comparing the experimental fork **`mine/`** (`itsoneword/get-shit-done`, npm `gsd2`, v1.4.x) against the original line **`core/`** (`open-gsd/gsd-core`, `@opengsd/gsd-core`, v1.2.x). The two repos have diverged substantially: core is the larger, security‑hardened, multi‑subsystem original; mine is a leaner fork focused on the discussion→planning pipeline.

> **Path alignment note.** `mine/get-shit-done/` and `core/gsd-core/` are the **same layer renamed** (both contain `bin/ references/ templates/ workflows/`). Overlap below is aligned by corresponding path/stem and by namespace (`gsd2:` ⇄ `gsd:`), not as distinct trees. A command/agent that differs only by the `gsd2:`/`gsd:` prefix is treated as "in both."

---

## Inventory headline

| Surface | mine | core | In both | Only mine | Only core |
|---|---:|---:|---:|---:|---:|
| Agents (`agents/*.md`) | 22 | 33 | 16 | 6 | 17 |
| Commands (`commands/gsd2` ⇄ `commands/gsd`) | 53 | 67 | 32 | 21 | 35 |
| Hooks (`hooks/*`) | 4 | 15 + `lib/` | 4 | 0 | 11 |
| Skills | 0 | system (no skill dirs shipped; discovery + sync + lint infra) | — | — | — |

**Headline:** Core carries roughly **1.5× the agents (33 vs 22), 1.3× the commands (67 vs 53), and ~4× the hooks (15 vs 4)** of the fork, plus a skills subsystem the fork has no trace of. The fork is not behind core on the same axis — it *diverged*: it adds its own spec/contract pipeline (`agent-spec`, `test-phase`, `document`) and rewrote every shared agent prompt (README: 9,210→4,961 lines, −46%). The five biggest gaps where core is strictly richer: **(1) security/guard hooks** — core adds 5 guard hooks (read‑injection‑scanner, prompt‑guard, read‑guard, worktree‑path‑guard, validate‑commit) the fork has none of; **(2) the AI/eval cluster** — ai‑researcher, eval‑planner/auditor, framework‑selector, domain‑researcher, security‑auditor agents + `ai-integration-phase`/`eval-review`/`secure-phase` commands; **(3) the docs/knowledge subsystem** — doc‑classifier/synthesizer/verifier/writer agents + `graphify`/`ingest-docs`/`docs-update` and a knowledge‑graph engine; **(4) the `ns-*` namespace routers** (6 command‑menu entry points); **(5) the ideation cluster** — `sketch`/`spike`/`surface`/`explore` + the skills system itself. The fork's counter‑investment is concentrated in the **discuss/plan pipeline** (conversation‑first discussion, signal strength, cross‑phase pollination, specialist‑in‑the‑loop) and a **contract‑first phase flow** (`agent-spec-phase`, `test-phase`, `list-phase-assumptions`).

---

## 1. Agents overlap

**Counts:** 22 (mine) vs 33 (core) — 16 shared by name, 6 only mine, 17 only core.

> **Forked across the board:** mine's README states *all 15 agent definitions were rewritten* (prescriptive steps → broad goals, aggressive language removed, ~47 examples added, −46% lines). So every "in both" agent below is **present in both by name but with a rewritten/condensed prompt in mine**. Verified-same *role* where checked (e.g. `gsd-research-synthesizer` — identical description bar the `gsd2:`/`gsd:` namespace). The genuine *behavioral* fork changes land on the discussion path: **`gsd-roadmapper`** (now emits per‑phase "Discussion focus" hints) and **`gsd-phase-researcher`** (gains a micro‑research "specialist‑in‑the‑loop" mode invoked from discuss‑phase).

| In both (same name) | Only in mine | Only in core |
|---|---|---|
| gsd-codebase-mapper | **gsd-agent-checker** — verifies AGENT-SPEC.md is implementable/anti-pattern-free before planning | **gsd-advisor-researcher** — researches one gray-area decision, returns comparison table (discuss-phase advisor mode) |
| gsd-debugger | **gsd-agent-researcher** — produces AGENT-SPEC.md design contract for agentic phases | **gsd-ai-researcher** — researches a chosen AI framework's docs for implementation guidance |
| gsd-executor | **gsd-document-mapper** — documents one subsystem into a sourced Mermaid SYSTEM-MAP file | **gsd-assumptions-analyzer** — deep codebase assumption analysis (discuss-phase assumptions mode) |
| gsd-integration-checker | **gsd-document-updater** — incremental/surgical updates to docs/SYSTEM-MAP tree | **gsd-code-fixer** — applies REVIEW.md findings, commits each fix atomically |
| gsd-nyquist-auditor | **gsd-fixer** — fixes post-execution issues with dependency awareness (`/gsd2:fix`) | **gsd-code-reviewer** — reviews source for bugs/security/quality → REVIEW.md |
| **gsd-phase-researcher** *(forked: +specialist micro-research mode)* | **gsd-test-designer** — produces TEST-SPEC.md verification contract | **gsd-debug-session-manager** — runs multi-cycle `/gsd:debug` checkpoint loop |
| gsd-plan-checker | | **gsd-doc-classifier** — classifies a planning doc as ADR/PRD/SPEC/DOC |
| gsd-planner | | **gsd-doc-synthesizer** — synthesizes classified docs into one consolidated context |
| gsd-project-researcher | | **gsd-doc-verifier** — verifies doc claims against live codebase |
| gsd-research-synthesizer *(same role, namespace only)* | | **gsd-doc-writer** — writes/updates project documentation |
| **gsd-roadmapper** *(forked: +"Discussion focus" hints)* | | **gsd-domain-researcher** — researches business domain / real-world eval criteria |
| gsd-ui-auditor | | **gsd-eval-auditor** — retroactive audit of an AI phase's eval coverage |
| gsd-ui-checker | | **gsd-eval-planner** — designs structured eval strategy for an AI phase |
| gsd-ui-researcher | | **gsd-framework-selector** — interactive decision matrix for AI/LLM framework choice |
| gsd-user-profiler | | **gsd-intel-updater** — writes structured intel files to `.planning/intel/` |
| gsd-verifier | | **gsd-pattern-mapper** — maps new files to closest existing-code analogs → PATTERNS.md |
| | | **gsd-security-auditor** — verifies PLAN.md threat mitigations exist in code → SECURITY.md |

**Note on mine-only agents:** they form a coherent *contract-first* layer the fork added — `gsd-agent-researcher`/`gsd-agent-checker` (AGENT-SPEC), `gsd-test-designer` (TEST-SPEC), and `gsd-document-mapper`/`gsd-document-updater` (a lightweight in-tree docs/SYSTEM-MAP generator). Core's 17 extras instead build out **AI-evals**, **doc-synthesis/verification**, **code-review/security**, and **intel/pattern** subsystems.

---

## 2. Commands overlap

**Counts:** 53 (mine, `commands/gsd2/`) vs 67 (core, `commands/gsd/`) — 32 shared, 21 only mine, 35 only core.

> **In core, commands ARE skills.** Core command files carry `requires: [...]` frontmatter and `allowed-tools: [Skill]`, and `scripts/lint-skill-deps.cjs` lints `commands/gsd/*.md` as the framework skill graph. So the command count and the "skills system" below are two views of the same surface. The fork kept commands as plain `/gsd2:` slash commands and dropped the skill/requires machinery.

> **Forked shared command:** **`discuss-phase`** is "present in both, but forked" — mine replaced the menu-driven interview with conversation-first discussion, signal-strength tags (`[STRONG]`/`[WEAK]`/`[DISCRETION]`), cross-phase note pollination, and specialist-in-the-loop routing (README §1–5). The other 31 shared commands are present in both by name; the fork's README notes a 21% workflow-prompt reduction across the board, so treat them as "same command, prompt re-optimized + `gsd2:` namespace" rather than verified-identical.

**In both (32):** add-tests, audit-milestone, audit-uat, autonomous, cleanup, complete-milestone, debug, **discuss-phase** *(forked)*, execute-phase, health, help, map-codebase, new-milestone, new-project, pause-work, plan-phase, pr-branch, profile-user, progress, quick, resume-work, review-backlog, review, settings, ship, stats, thread, ui-phase, ui-review, update, validate-phase, verify-work.

### Only in mine (21) — fork's contract-first + capture additions

| Theme | Commands |
|---|---|
| Contract-first phase flow | `agent-spec-phase`, `test-phase`, `list-phase-assumptions`, `research-phase` |
| In-tree docs | `document` |
| Roadmap CRUD (split out) | `add-phase`, `insert-phase`, `remove-phase`, `plan-milestone-gaps` |
| Capture / todos | `add-backlog`, `add-todo`, `check-todos`, `note`, `plant-seed` |
| Routing / flow | `do` (freeform→command router), `next` (advance workflow), `fix` |
| Config / lifecycle | `set-profile`, `reapply-patches` (post-update patch reapply), `session-report` |
| Community | `join-discord` |

### Only in core (35) — grouped by theme

| Theme | Commands | Count |
|---|---|---:|
| **Graph / workstreams / workspaces** | `graphify`, `workspace`, `workstreams`, `manager` | 4 |
| **Ideation** | `sketch`, `spike`, `surface`, `explore`, `capture` | 5 |
| **AI / eval** | `ai-integration-phase`, `eval-review`, `secure-phase` | 3 |
| **`ns-*` namespace routers** (command-menu entry points) | `ns-context`, `ns-ideate`, `ns-manage`, `ns-project`, `ns-review`, `ns-workflow` | 6 |
| **Docs / knowledge ingestion** | `ingest-docs`, `docs-update`, `import`, `extract-learnings`, `milestone-summary` | 5 |
| **Code review / quality** | `code-review`, `audit-fix`, `forensics`, `plan-review-convergence` | 4 |
| **Phase variants** | `phase` (phase CRUD), `spec-phase`, `mvp-phase`, `ultraplan-phase` `[BETA]` | 4 |
| **Execution / runtime** | `fast` (inline trivial exec), `undo` (safe git revert via manifest) | 2 |
| **Config / triage / lifecycle** | `config`, `inbox` (GitHub issue/PR triage) | 2 |

**Note:** the fork's mine-only set is mostly *finer-grained capture and contract* commands; core's extras are *whole subsystems* (knowledge graph, AI-evals, ideation, docs ingestion, namespaced menus). The `ns-*` routers and `surface`/`config` exist specifically to manage core's large skill surface — machinery the fork doesn't need because it has fewer commands and no skill profiles.

---

## 3. Hooks overlap

**Counts:** 4 (mine, built to `hooks/dist/` via esbuild) vs 15 files + `lib/` (core). All 4 of the fork's hooks exist in core; core adds **11** more, dominated by security/guard hooks.

| In both (event type) | Only in mine | Only in core (event type) |
|---|---|---|
| `gsd-check-update.js` — **SessionStart** (background update check) | *(none)* | `gsd-check-update-worker.js` — **SessionStart** worker (spawned by check-update) |
| `gsd-context-monitor.js` — **PostToolUse** / AfterTool (injects context-budget warnings) | | `gsd-update-banner.js` — **SessionStart** (update banner when statusline absent) |
| `gsd-statusline.js` — **statusLine** (model / task / dir / context) | | 🔒 `gsd-read-injection-scanner.js` — **PostToolUse** (scans Read output for prompt injection) |
| `gsd-workflow-guard.js` — **PreToolUse** (soft advisory; edits outside a GSD workflow) | | 🔒 `gsd-prompt-guard.js` — **PreToolUse** (scans `.planning/` writes for injection patterns) |
| | | 🔒 `gsd-read-guard.js` — **PreToolUse** (read-before-edit nudge for non-Claude models) |
| | | 🔒 `gsd-worktree-path-guard.js` — **PreToolUse** (BLOCKS edits to abs paths outside worktree, exit 2) |
| | | 🔒 `gsd-validate-commit.sh` — **PreToolUse** (BLOCKS non-Conventional-Commit messages, exit 2) |
| | | `gsd-phase-boundary.sh` — **PostToolUse** (reminder on out-of-workflow `.planning/` writes; opt-in) |
| | | `gsd-session-state.sh` — **SessionStart** (injects STATE.md head; opt-in) |
| | | `gsd-graphify-update.sh` — **PostToolUse** (auto-rebuilds knowledge graph on HEAD advance; opt-in) |
| | | `managed-hooks-registry.cjs` — *not a hook* — authoritative list of managed hook files; `lib/` holds `git-cmd.js` + `gsd-graphify-rebuild.sh` |

**Security/guard emphasis:** the fork lacks the entire 🔒 defense-in-depth layer core ships — **`gsd-read-injection-scanner`** and **`gsd-prompt-guard`** (catch prompt injection at Read ingestion and at `.planning/` write time), **`gsd-read-guard`** (read-before-edit for non-Claude runtimes), and two *hard‑blocking* guards: **`gsd-worktree-path-guard`** (blocks executor edits that escape the worktree, issue #260) and **`gsd-validate-commit`** (enforces Conventional Commits). mine's only guard, `gsd-workflow-guard`, is soft/advisory and present in both. Several of core's `.sh` hooks are **opt-in** (`hooks.community: true` or `graphify.*` config), but the JS injection/path guards are part of core's standard surface and have no fork equivalent.

---

## 4. Skills

**mine: none.** No `skills/` directories, no `SKILL.md`, no discovery/sync/lint machinery anywhere in the fork. The README's "Architecture / Planned Improvements" make no mention of skills.

**core: a full skills subsystem.** In GSD, "skills" means something distinct from the **superpowers** notion. The difference:

- **Superpowers skills** are *model-invoked capability bundles* — the model actively decides to call a skill (via a Skill tool) to pull in a procedure or capability on demand.
- **GSD (core) skills** are *passive project-convention / rule sets that GSD agents discover and consult*, plus a cross-runtime install/sync layer for the framework's own `gsd-*` skills. The model doesn't "call" them as actions; the orchestrator and agents **scan for them and load their rules** when relevant.

Core's skill system has four parts:

1. **Discovery contract** (`core/docs/skills/discovery-contract.md`, `core/gsd-core/references/project-skills-discovery.md`). Defines canonical scan roots (`.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, `.codex/skills/`, plus managed global roots under `~/.claude` / `~/.codex`), normalization rules (a skill = a subdir containing `SKILL.md`; read `name`/`description` from frontmatter, `TRIGGER when:` hints from the body), and the `skill-manifest` inventory shape. **Application is per-agent:** before execution, planners/executors/researchers/verifiers/debuggers check for project skills and load only the relevant `rules/*.md` on demand (explicitly *not* the large `AGENTS.md` files, to save context).

2. **Framework skills = the command surface.** Core's `commands/gsd/*.md` files carry `requires:` frontmatter and `allowed-tools: [Skill]`; `core/scripts/lint-skill-deps.cjs` lints them as a dependency graph — checking that any skill a body references (`/gsd:<stem>`) is declared in `requires:`, and that every install **profile** is closed under that dependency graph. So the 67 "commands" above double as core's installable `gsd-*` skill set, and `surface`/`config` toggle which clusters are active.

3. **Cross-runtime sync** (`core/gsd-core/workflows/sync-skills.md`, command `/gsd-sync-skills`). Copies managed `gsd-*` skill directories from one canonical runtime's skills root to others (claude, codex, grok, copilot, cursor, windsurf, opencode, gemini, kilo, augment, trae, qwen, codebuddy, cline, antigravity), keeping multi-runtime installs aligned after an update — dry-run by default.

4. **Dependency linting** (`lint-skill-deps.cjs`, above) — enforces frontmatter↔body consistency and profile closure so the skill graph stays installable.

**Bottom line:** the fork dropped the skills/profiles/sync machinery entirely and ships commands as plain `/gsd2:` slash commands; core treats the same surface as a discoverable, multi-runtime, dependency-linted skills system.


---

# 3. Node / Runtime Execution Layer

> **Scope:** the JavaScript/TypeScript that actually *runs* — `gsd-tools.cjs`, its
> `lib/*` modules, the installers, the hooks, and the build/test apparatus.
> Both products are fundamentally the same kind of thing at runtime: a
> **deterministic CLI of helpers that the markdown workflows shell out to**.
> Neither one is an autonomous agent. The divergence is in *how that CLI is built
> and organized*, not in what it fundamentally does.

---

## ⚠️ Headline correction: there is no `claude-agent-sdk` agent runner

The brief framed `core/src/fallow-runner.cts` + `@anthropic-ai/claude-agent-sdk` +
`ws` as core's "programmatic agent runner" — an autonomous/headless execution path
that mine lacks. **Reading the actual source contradicts this.** I'm leading with the
correction because it is load-bearing for the user's real question ("how does the
core node execution work"):

1. **`fallow-runner.cts` is a code-quality tool integration, not an agent runner.**
   The entire file (`core/src/fallow-runner.cts`, 166 lines) does two things:
   `resolveFallowBinary()/requireFallowBinary()` locate an external **`fallow`**
   executable (preferring `node_modules/.bin/fallow`, then `PATH`), and
   `normalizeFallowReport()` reshapes fallow's JSON into
   `{ unused_exports, duplicates, circular_dependencies }` findings. **Fallow is a
   Rust static-analysis CLI** (dead-export / duplicate-block / circular-dependency
   detection) — confirmed by the error string it throws:
   `install fallow via 'npm install -D fallow' or 'cargo install fallow'`, by
   `optionalDependencies.fallow: "^2.70.0"`, and by `config.cts` keys
   (`code_quality.fallow.scope` ∈ {phase, repo}, `.profile` ∈ {minimal, standard,
   strict}). It is wired into the `/gsd-code-review` workflow as a *structural
   pre-pass* (the workflow's `<step name="structural_pre_pass">` reads `FALLOW.json`;
   the reviewer agent gets a `## Structural Findings (fallow)` section). The runner's
   job is to locate the external **`fallow`** tool and reshape its output — *not* to
   invoke Claude. (Note: the function that would actually *run* fallow as a
   subprocess, `runFallowAudit`, is referenced by the integration test but is **not
   defined in this clone's `fallow-runner.cts`** — the 166-line source imports only
   `fs`/`path`, no `child_process`.)

2. **`@anthropic-ai/claude-agent-sdk` and `ws` are declared but have ZERO live
   importers.** A repo-wide grep (`grep -rn "claude-agent-sdk"` /
   `require('ws')|from 'ws'`, excluding `node_modules`) finds **no `import`/`require`
   anywhere in `src/`, `gsd-core/`, `bin/`, or `hooks/`**. The only hits are in
   `CHANGELOG.md`, `docs/`, and a `npm audit` note (`QUICK-WINS-CONFIRMED-BUGS.md`)
   that flags `@anthropic-ai/claude-agent-sdk` as the source of a transitive
   high/moderate vulnerability — i.e. it's a *liability that lingers in
   package.json*, not a used capability. `ws` has no code importer at all (only
   markdown workflow prose mentions websockets in unrelated verification examples).

3. **The SDK-based execution path once existed and was deliberately RETIRED.**
   Two regression tests document this:
   - `tests/enh-191-retire-sdk-package.test.cjs` asserts the `sdk/` directory and
     `bin/gsd-sdk.js` shim are **deleted**, the `gsd-sdk` bin entry is gone, and the
     installer no longer exposes `--sdk`/`--no-sdk` or runs `installSdkIfNeeded()`.
   - `tests/bug-505-remove-dead-sdk-verification.test.cjs` asserts ~16 SDK helper
     symbols (`installSdkIfNeeded`, `classifySdkInstall`, `readGsdSdkVersion`,
     `trySelfLinkGsdSdk`, …) are **no longer exported** from `bin/install.js`.

   **Crucially, this retired SDK was core's OWN `@opengsd/gsd-sdk` query-bridge
   package** (ADR-0174 / #191 / #505) — a sync "executeForCjs" bridge that let
   `gsd-tools` route commands through a TypeScript query layer. It is *not* the
   third-party `@anthropic-ai/claude-agent-sdk`. Don't conflate the two: gsd-sdk was
   built then deleted; the Anthropic SDK is an unused leftover dependency. The
   vestigial `_dispatchNonFamily()` shim and "SDK handler: sdk/src/query/*.ts"
   comments throughout `gsd-tools.cjs` are scar tissue from that removed bridge — the
   function `always returns false`, so every command falls through to the CJS path.

**So the single biggest node-side divergence is architectural, not agentic:** core
is a **compiled-TypeScript engine with a layered command-router + structured
observability + heavy quality apparatus**; mine is a **hand-written CommonJS switch
dispatcher with a minimal test runner**. The SDK story is real but is "built, then
retired; deps linger" — core *once* had a query-bridge path that mine never had, but
neither ships a live agent runner today.

---

## Runtime architecture — mine (`itsoneword/get-shit-done`, npm `gsd2` v1.4.6)

Pure CommonJS, Node `>=20`. **No `src/`, no TypeScript, no build step for the
engine.** Two `devDependencies` only: `c8`, `esbuild`. Zero runtime `dependencies`.

### The engine: `get-shit-done/bin/gsd-tools.cjs` (~795 lines)
A single `#!/usr/bin/env node` CLI. It `require()`s ~14 sibling `lib/*.cjs` modules
directly at module top, then dispatches via **one flat `switch (command)`** inside
`main()`. Argument parsing is inline per-case (`args.indexOf('--phase')` etc.).
Subcommands exposed (the surface the markdown workflows call):

- **`state`** — load/json/get/update/patch, plus progression verbs
  (`begin-phase`, `advance-plan`, `record-metric`, `update-progress`,
  `add-decision`, `add-blocker`, `resolve-blocker`, `record-session`,
  `signal-waiting`/`signal-resume` → writes `WAITING.json`).
- **`phase`** — next-decimal, add, insert, remove, complete.
- **`roadmap`** — get-phase, analyze, update-plan-progress.
- **`milestone`** — complete, distill; plus `migrate-to-milestone-partition`
  (git-mv retrofit of legacy `.planning/phases/` layout).
- **`verify`** — plan-structure, phase-completeness, references, commits,
  artifacts, key-links, commands.
- **`validate`** — consistency, health (`--repair`).
- **`init`** — compound context bundles for each workflow (execute-phase,
  plan-phase, new-project, quick, resume, verify-work, map-codebase, …).
- **`frontmatter`** CRUD, **`scaffold`**, **`progress`**,
  **`stats`**, **`todo`**, **`audit-uat`**, **`requirements mark-complete`**,
  **`history-digest`**, **`summary-extract`**, **`websearch`** (Brave API).
  (programmatic template-fill CLI subcommands removed 2026-07 as dead code.)
- **Profiling pipeline** — `scan-sessions`, `extract-messages`, `profile-sample`,
  `write-profile`, `generate-claude-md/-profile/-dev-preferences`.

`--cwd` and `--raw` are the only global flags. No `--pick`, no `--json-errors`, no
`--ws`, no `@file:` output protocol, no project-root/worktree resolution layer.

### `lib/*.cjs` modules (15 files, ~10K lines total)
Flat, hand-written, no router layer:
`core` (output/error/timestamps), `state`, `phase`, `roadmap`, `config`,
`milestone`, `commands` (grab-bag command impls), `init` (compound
context), `frontmatter`, `verify`, `uat`, `migration`, `model-profiles`,
`profile-pipeline`, `profile-output`. Each module exports `cmdXxx(cwd, …, raw)`
functions called directly from the switch.

### Installer: `bin/install.js` (the `gsd2` bin)
A single `#!/usr/bin/env node` CommonJS script. It detects the target runtime
(`--claude`/`--gemini`/`--codex`/`--copilot`/`--antigravity`/`--cursor`/
`--opencode`/`--all`), `--global` vs `--local`, and copies `commands/`, `agents/`,
and built `hooks/` into the runtime's config dir, doing per-runtime conversion
(e.g. Codex `config.toml` sandbox map, Copilot tool-name remapping). It also runs
`build:hooks` before install (`dev` script). No transactional migration engine, no
manifest, no lock.

### Hooks: copy-and-validate, not bundle
`hooks/*.js` → `hooks/dist/*.js` via `scripts/build-hooks.js`. Despite `esbuild`
being a dep, the script just **copies** the 4 hooks and **syntax-checks** each with
`new vm.Script(...)` (guarding against the duplicate-`const` shipping bug #1107).
The 4 hooks: `gsd-check-update`, `gsd-context-monitor`, `gsd-statusline`,
`gsd-workflow-guard`. No security hooks.

### Tests: minimal node runner
`scripts/run-tests.cjs` globs `tests/*.test.cjs`, sorts, and runs them all in one
`node --test` child (propagating `NODE_V8_COVERAGE`). **29 test files, no suites, no
categories.** `package.json` scripts: `build:hooks`, `dev`, `test`,
`test:coverage` (c8, `--lines 70`, scoped to `get-shit-done/bin/lib/*.cjs`).

---

## Runtime architecture — core (`open-gsd/gsd-core`, `@opengsd/gsd-core` v1.2.0)

Node `>=22`, npm `>=10`. The same `gsd-tools.cjs` *entrypoint shape*, but the engine
is now **compiled TypeScript** and the dispatch is **layered through command
routers**.

### Build pipeline: `src/*.cts` → `gsd-core/bin/lib/*.cjs` (ADR-457 "build-at-publish")
`tsconfig.build.json` maps **`rootDir: "src"` → `outDir: "gsd-core/bin/lib"`**,
`module/moduleResolution: nodenext`, `target: ES2022`, `strict: true`,
`noEmitOnError: true`. Sources use the **`.cts`** extension so `tsc` emits **`.cjs`**
natively. `build:lib = tsc -p tsconfig.build.json` (run by `prepare`, `prepack`,
`pretest`, `prepublishOnly`). **88 `.cts` source files, ~35K lines.** In this clone
the compiled `gsd-core/bin/lib/` contains only the 2 *hand-written* survivors
(`legacy-cleanup.cjs`, `package-identity.cjs`) — every other `lib/*.cjs`
(`core.cjs`, `state-command-router.cjs`, `fallow-runner.cjs`, `observability/*.cjs`,
…) is a **gitignored tsc artifact** produced at build time. Each `.cts` carries the
banner *"the hand-written bin/lib/X.cjs collapsed to a TypeScript source of truth …
behaviour preserved byte-for-behaviour; only types are added"* — confirming this was
a mechanical, behaviour-preserving migration (see the `migration-batch-1..15-ts`,
`migration-core-ts`, `migration-finalize-ts` changesets).

### `gsd-tools.cjs` entrypoint (~1700 lines): same role, richer dispatch
Still the CLI the workflows shell out to, but now it:
- `require()`s the compiled router modules and delegates families to
  **`route{State,Verify,Init,Phase,Phases,Validate,Roadmap,Agent,Check,Task}Command()`**
  instead of inline `if/else`.
- Adds global flags `--pick <field>` (built-in jq replacement, dot/bracket
  notation), `--json-errors` / `GSD_JSON_ERRORS` (structured `{ ok:false, reason }`
  stderr via an `ERROR_REASON` taxonomy), `--ws <name>` / `GSD_WORKSTREAM` (active
  workstream override), `--default`, dotted-command form (`state.update`), and a
  `query` meta-prefix.
- Adds a **`@file:` stdout protocol** (`captureStdoutSyncWrites` +
  `resolveAtFileOutput`): large JSON is written to a temp file and the path emitted,
  then transparently re-resolved — so workflows don't need shell-specific `@file:`
  handling.
- Adds **project-root + linked-worktree resolution** (`findProjectRoot`,
  `resolveWorktreeRoot`) and **active-workstream env propagation**
  (`resolveActiveWorkstream` / `applyResolvedWorkstreamEnv`).
- New command families absent from mine: `intel`, `graphify`, `workstream`,
  `worktree`, `gap-analysis`, `learnings`, `docs-init`, `from-gsd2`, `task`,
  `agent`, `check`, `prompt-budget`, `audit-open`.

### Command-router layer (vs mine's flat switch)
- **`command-routing-hub.cts`** — a pure, no-throw, no-print **dispatch hub**.
  `createHub({cjsRegistry, manifest}).dispatch({family, subcommand, args, cwd, raw})`
  returns a **closed discriminated-union `Result`**:
  `{ok:true,data}` | `{ok:false, kind:'UnknownCommand'|'InvalidArgs'|'HandlerRefusal'|'HandlerFailure', …}`.
  Invariants: never throws (internal throws → `HandlerFailure`), never touches
  stdout/exit, each error variant carries only its own typed payload. Its header
  states explicitly: *"Hub always routes through CJS handlers. There is no SDK path
  (#175)."*
- **`cjs-command-router-adapter.cts`** — `routeHubCommandFamily` /
  `routeCjsCommandFamily`: maps a family's subcommands+handlers onto the hub, using
  generated command metadata for availability and small per-family arg shapers.
- **`*-command-router.cts`** (state, verify, init, phase, phases, validate, roadmap,
  agent, check, task) — thin typed wrappers that declare their subcommand set
  (e.g. `STATE_SUBCOMMANDS` from `command-aliases.cts`), shape args via
  `command-arg-projection.cts`, and call into the underlying `state.cts` /
  `verify.cts` / etc. So `gsd-tools` stays thin; the per-family argument logic moves
  into typed routers instead of a 1700-line inline switch.

### Observability (`src/observability/*` — mine has nothing comparable)
A structured telemetry seam (issues #177/#178, ADR-0174 P1.3/P1.4):
- **`event.cts`** — `makeDispatchEvent()` builds a `DispatchEvent` per dispatch with
  a v4 `traceId`, optional propagated `parentTraceId` (validated against an RFC-4122
  regex), `command`, optional `args`, typed `result`, ISO `timestamp`.
- **`logger.cts`** — `createDefaultLogger`: silent on success, one-line structured
  JSON to stderr on error, and an **opt-in audit trail** (`GSD_AUDIT=1` or
  `config.audit.enabled`) appending every event as JSONL to
  `.planning/.gsd-trace.jsonl`. Plus a `createNoOpLogger` default.
- **`redaction.cts`** — args **omitted from events by default**; `GSD_AUDIT_ARGS=1`
  opts in. Stateless env reads (test-friendly).

### Capability modules (node-level summaries)
- **`graphify.cts`** — config-gated (`config.graphify.enabled`) integration that
  **spawns an external graphify subprocess** (via `shell-command-projection`'s
  `execTool`/`execGit`) to build/query a project knowledge-graph; query/status/diff/
  build/snapshot helpers. (Analogous external-tool integration to fallow.)
- **`workstream.cts` + `workstream-inventory*.cts` + `active-workstream-store.cts` +
  `workstream-name-policy.cts`** — CRUD for **workstream namespacing**: scopes
  ROADMAP/STATE/REQUIREMENTS/phases into `.planning/workstreams/{name}/` so multiple
  milestones run in parallel; degrades to "flat mode" when absent. (Mine has no
  workstream concept.)
- **`clusters.cts`** — named groups of skill stems (`core_loop`, `audit_review`,
  `milestone`, …) used by `/gsd:surface` to enable/disable cohesive skill groups
  without reinstall.
- **`drift.cts`** — pure codebase-drift detector (#2003): diffs committed code vs
  `.planning/codebase/STRUCTURE.md`, classifying new files as
  `new_dir`/`barrel`/`migration`/`route`; never throws (returns `{skipped:true}`).
- **`intel.cts`** — config-gated persistent project-intelligence store under
  `.planning/intel/` (file-roles, api-map, dependency-graph, arch-decisions, stack
  JSON); query/status/diff/snapshot/validate/extract-exports/api-surface.
- **`gsd2-import.cts`** (the `from-gsd2` command) — **reverse migration: core can
  IMPORT a gsd2 (`.gsd/`) project** back into GSD v1 `.planning/` format, mapping
  GSD-2's Milestone→Slice→Task hierarchy onto Milestone→Phase→Plan. (Notable: the
  original line knows about the fork and ingests from it.)
- **`fallow-runner.cts`** — external fallow static-analysis integration (see
  headline). `runFallowAudit` is referenced only by the integration test, not
  present in the shipped 166-line source — the test tolerates its absence.

### Installer differences
- **`bin/install.js`** is backed by a **transactional `installer-migrations` engine**
  (`src/installer-migrations.cts` + `installer-migrations/00X-*.cts`,
  `installer-migration-authoring.cts`, `installer-migration-report.cts`). It tracks a
  `gsd-file-manifest.json` + `gsd-install-state.json`, takes an
  `gsd-install-migration.lock`, and applies numbered migrations (e.g.
  `003-rename-get-shit-done-to-gsd-core`) with crash-recovery — none of which exists
  in mine.
- **`bin/lib/ui-safety-gate.cjs`** — a shell-free Node port (#3706) of a UI-token
  detector (`checkUiPresence`), STDIN-driven, grep-style exit codes, cross-platform
  (replaced a bash one-liner that broke on PowerShell/cmd).
- **`hooks/managed-hooks-registry.cjs`** — single authoritative `MANAGED_HOOKS`
  array so the installer/update-worker and tests agree on which files GSD owns in
  `~/.claude/hooks/` (drives stale-hook cleanup).

### Hooks: 10 vs mine's 4, including security hooks
Core ships `gsd-check-update(+-worker)`, `gsd-context-monitor`, `gsd-statusline`,
`gsd-workflow-guard`, **plus** `gsd-prompt-guard`, `gsd-read-guard`,
`gsd-read-injection-scanner`, `gsd-update-banner`, `gsd-worktree-path-guard`, and
opt-in **bash community hooks** (`gsd-session-state.sh`, `gsd-validate-commit.sh`,
`gsd-phase-boundary.sh`, `gsd-graphify-update.sh`). `build-hooks.js` adds atomic
staging (`.dist-staging-<pid>/` + rename) on top of mine's copy+syntax-validate.

### Tests / lint / quality apparatus
- **617 test files** (vs mine's 29), split into **suites** by filename marker
  (`*.integration|install|security|slow.test.cjs`, default = `unit`) via
  `run-tests.cjs --suite …`; plus `test:affected`, property tests (`fast-check`),
  adversarial/fuzz fixtures, fault-injection.
- **`test:mutation` = Stryker** (`@stryker-mutator/core`, `stryker.config.mjs`,
  `mutation-matrix.cjs`) — mutation testing mine has none of.
- **ESLint flat config** (`eslint.config.mjs`, typescript-eslint, eslint-plugin-n)
  **+ 4 custom rules** (`eslint-rules/no-source-grep`, `no-magic-sleep-in-tests`,
  `no-raw-rmsync-in-tests`, `no-elapsed-assertion`) and **~13 `lint:*` scripts**
  (descriptions, skill-deps, test-file-count, pr-checks, docs, legacy-name,
  identity-drift, …).
- **Changesets** — `.changeset/` (300+ files) + custom `scripts/changeset/*` and
  `lint:changeset`; release pipeline (`release-tarball-smoke`, `verify-npm-publish`,
  `check-npm-integrity`).
- **36 `scripts/*.cjs`** quality/CI utilities; `vitest.config.ts` present.
- Mine: a single ~30-line glob-and-run node test runner. **Engineering-maturity gap
  is large and one-directional.**

---

## What actually executes — `fallow-runner` + `claude-agent-sdk`, stated plainly

- **`fallow-runner.cts` resolves the external `fallow` Rust static-analysis binary
  and normalizes its JSON report** into structural code-quality findings (unused
  exports, duplicate blocks, circular deps) for the `/gsd-code-review` workflow. It
  is an *optional* integration (`optionalDependencies.fallow`, `code_quality.fallow.*`
  config). The actual executor (`runFallowAudit`, which would spawn fallow as a
  subprocess) is referenced by the integration test but **is not present in this
  clone's source** — so what's shipped here is binary-resolution + report-shaping for
  a linter, not anything that invokes a model.
- **`@anthropic-ai/claude-agent-sdk` and `ws` execute nothing** in the shipped code.
  They are declared dependencies with no importers. The Anthropic SDK is even flagged
  internally as a `npm audit` transitive-vuln liability to remove.
- **The programmatic-agent / query-bridge path that the brief expected DID exist**
  — core's own `@opengsd/gsd-sdk` (`sdk/src/query/*.ts`, `executeForCjs` sync
  bridge, `installSdkIfNeeded`) — **and was deleted** (ADR-0174, #191, #505).
  `gsd-tools.cjs` is littered with its retired shims (`_dispatchNonFamily` →
  `return false`).
- **Net:** at the node level **both products execute the same way** — a
  deterministic CLI that markdown workflows call via Bash; the Claude/LLM agent
  invocation happens *outside* this layer, in the host harness (Claude Code / Gemini
  / Codex) driven by the installed `.md` workflows/agents. Core's node engine is
  larger, typed, router-structured, observable, and far more rigorously tested; it is
  **not** more "autonomous."

---

## Comparison table

| Dimension | mine (`gsd2` v1.4) | core (`@opengsd/gsd-core` v1.2) |
|---|---|---|
| **Language** | Pure CommonJS, no TS, no engine build | TypeScript `.cts` → `.cjs` via `tsc` (ADR-457) |
| **Node** | `>=20` | `>=22`, `npm >=10` |
| **Engine source** | 16 hand-written `lib/*.cjs` (~10K lines) | 88 `src/*.cts` (~35K lines) → `gsd-core/bin/lib/` |
| **Entrypoint** | `gsd-tools.cjs` (~795 ln), flat `switch` | `gsd-tools.cjs` (~1700 ln), delegates to routers |
| **Routing** | Inline `if/else` per case | `command-routing-hub` (typed no-throw `Result`) + `*-command-router.cts` + adapter |
| **Agent execution model** | None (CLI helpers only) | **None live.** Own `gsd-sdk` query-bridge built then **retired** (#191/#505); `claude-agent-sdk`/`ws` declared but unimported |
| **External-tool runners** | None | `fallow` (code-quality), `graphify` (knowledge graph) subprocess integrations |
| **Observability** | None | `observability/{event,logger,redaction}`: traceIds, JSONL audit, arg redaction |
| **Output protocol** | `--raw` only | `--pick`, `--json-errors`/`ERROR_REASON`, `@file:` large-output, `--ws`, dotted/`query` forms |
| **Installer** | `bin/install.js`, plain copy, no migrations | `bin/install.js` + transactional `installer-migrations` engine (manifest+lock+recovery), `ui-safety-gate`, `managed-hooks-registry` |
| **Hooks** | 4 JS hooks; copy + `vm` syntax-check | 10 hooks (incl. prompt/read/injection/worktree security guards + `.sh` community hooks); atomic staged build |
| **Build** | `build:hooks` (esbuild dep, copy-only) | `build = generate:identity + build:lib(tsc) + build:hooks`; `prepack`/`prepare` |
| **Tests** | 29 files, 1 glob runner, no suites | 617 files, suite split (unit/integration/install/security/slow), affected-tests, property/fuzz/fault-injection |
| **Mutation testing** | None | Stryker (`test:mutation`) |
| **Lint** | None | ESLint flat config + typescript-eslint + 4 custom rules + ~13 `lint:*` scripts |
| **Release** | `prepublishOnly: build:hooks` | Changesets + tarball-smoke + npm-integrity/publish verifiers |
| **Deps** | 0 runtime; dev: `c8`, `esbuild` | runtime: `claude-agent-sdk` (unused), `ws` (unused); optional: `fallow`; dev: typescript, eslint, stryker, fast-check, … |
| **Cross-fork** | — | `from-gsd2` / `gsd2-import.cts` imports gsd2 `.gsd/` projects |

---

## Node-side headline (5–8 bullets)

- **No autonomous agent runner exists in either product.** Both are deterministic
  CLI helper engines (`gsd-tools.cjs`) that the markdown workflows shell out to; the
  LLM/agent loop lives in the host harness, outside this node layer.
- **`fallow-runner.cts` is the integration to the external `fallow` Rust
  static-analysis CLI** (dead-export/duplicate/circular-dependency finder for
  code-review), wired in as an *optional* structural pre-pass — it is **not** a
  Claude-agent runner.
- **`@anthropic-ai/claude-agent-sdk` and `ws` are dead dependencies** — declared in
  `package.json` with **zero importers** anywhere in shipped code; the Anthropic SDK
  is internally flagged as a `npm audit` liability awaiting removal.
- **A programmatic query-bridge path *did* exist and was deliberately retired** —
  core's own `@opengsd/gsd-sdk` (`executeForCjs` sync bridge) was deleted per
  ADR-0174/#191/#505; `gsd-tools.cjs` still carries its inert `_dispatchNonFamily`
  shims (`return false`). This is the real (historical) divergence vs mine, which
  never had any SDK path.
- **The genuine, live divergence is the engine's form:** core compiles ~88 typed
  `.cts` sources to `.cjs` (ADR-457 build-at-publish) and routes commands through a
  typed, no-throw `command-routing-hub` + `*-command-router` layer; mine is one
  hand-written CommonJS `switch`.
- **Core adds a structured observability seam** (traceIds, parent-trace propagation,
  opt-in `.gsd-trace.jsonl` audit, arg redaction) and richer runtime capabilities
  (workstream namespacing, intel store, drift detection, graphify, `from-gsd2`
  import) that mine entirely lacks.
- **Core's installer is transactional** (numbered migrations, manifest, lock,
  crash-recovery) and ships hardened security hooks; mine's installer plain-copies
  files and ships 4 basic hooks.
- **The engineering-maturity gap is large and one-directional:** core has 617 tests
  across 5 suites, Stryker mutation testing, ESLint + 4 custom rules + ~13 lint
  scripts, changesets, and release verifiers; mine has 29 tests behind a ~30-line
  glob runner and c8 coverage, with no lint/mutation/release tooling.


---

# 4. Net-New Capabilities in core (Porting Candidates)

Capabilities present in `core/` (`@opengsd/gsd-core` v1.2.x) but absent from
`mine/` (`gsd2` v1.4.x). Each block judges port value and maps to the user's
own parked ideas in `analysis/IDEAS.md` (referenced as **idea#N**).

> **Universal effort multiplier (read every "port a `.cts` module" row in this light):**
> core moved its tooling to TypeScript `src/*.cts` compiled at publish (the
> "ADR-457 build-at-publish" note in every header). `mine` still ships
> hand-written `get-shit-done/bin/lib/*.cjs`. Porting any core `.cts` module
> means either hand-writing the equivalent `.cjs` or adopting core's build
> pipeline — a real cost on top of the logic itself.

---

## Graphify / Knowledge Graph
- **What it is:** An opt-in project knowledge graph. `commands/gsd/graphify.md`
  exposes `build|query|status|diff`; `src/graphify.cts` (643 lines) drives an
  external `graphify` AST-extraction binary that emits nodes/edges with
  confidence tiers (EXTRACTED / INFERRED / AMBIGUOUS) into `.planning/graphs/`.
  `hooks/gsd-graphify-update.sh` + `lib/gsd-graphify-rebuild.sh` auto-rebuild on
  HEAD advance (double-gated, default off). `src/clusters.cts` is unrelated
  (skill clustering, see Skills). `workflows/analyze-dependencies.md` is a
  separate, lighter capability: infers phase↔phase file/semantic dependencies
  to suggest `Depends on` edges before parallel execution.
- **Does mine have it?** **No** (no graphs, no dependency analyzer).
- **Port value: Medium → idea#1.** *Caveat:* core's graph is a **code** graph
  (functions/modules), whereas idea#1 wants **bug/feature** links at levels
  1/2/3 — a different node/edge schema. What's portable is the **infrastructure
  pattern** (graph store, build/query/status/diff, staleness + commit tracking,
  auto-update hook), not the data model. Treat as "reusable scaffold, schema
  needs rework." Also depends on an external binary = feasibility risk.
  `analyze-dependencies.md` is the cheaper, higher-certainty slice and is a
  better first step toward idea#1.

## Plan-Review Convergence Loop
- **What it is:** `commands/gsd/plan-review-convergence.md` +
  `workflows/plan-review-convergence.md` automate a **cross-AI** plan loop:
  `plan-phase N → review N --codex/--gemini/--claude/... → plan-phase N --reviews → …`,
  driven by external reviewer CLIs, with `--max-cycles` (default 3).
  `references/revision-loop.md` formalizes **stall detection** (escalate when
  BLOCKER+WARNING count stops decreasing). `references/planner-reviews.md` /
  `planner-revision.md` define the "replan from REVIEWS.md" planner modes.
- **Does mine have it?** **Partial.** `mine` already runs a single-AI
  planner→`gsd-plan-checker`→iterate-to-pass loop (max 3) inside
  `plan-phase.md`. What's genuinely net-new is (a) **multiple external AI
  reviewers** and (b) the **explicit stall/escalation** logic.
- **Port value: High → idea#4.** Closest to mine's existing architecture
  (mine already has the checker and the loop scaffold), so lowest-friction
  high-value win. *Precision on idea#4:* idea#4 says "plan/researcher" — mine's
  loop covers the **planner only** (research is an upstream step, not in the
  loop). So the port is two things: cross-AI/stall-detection on the planner,
  **and** optionally extending an iterate-before-human loop to the researcher.
  External-CLI dependency is a feasibility flag; stall-detection alone is a
  pure, cheap, no-dependency win.

## Workstreams / Parallel Workspaces
- **What it is:** Two distinct mechanisms. **Workstreams** (`src/workstream*.cts`,
  `active-workstream-store.cts`, `commands/gsd/workstreams.md`) namespace
  ROADMAP/STATE/REQUIREMENTS/phases into `.planning/workstreams/{name}/` for
  concurrent milestones (backward-compatible "flat mode" when absent).
  **Workspaces** (`commands/gsd/workspace.md`, `new-workspace.md`) create
  isolated repo copies/worktrees with independent `.planning/`. `manager.md` is
  the single-terminal command center that dispatches discuss/plan/execute,
  some as background agents.
- **Does mine have it?** **No.**
- **Port value: Low–Medium → (no direct idea).** Powerful for power users but a
  large surface that touches state/roadmap pathing throughout. Doesn't map to
  the user's discussion-first fork direction; defer unless parallel execution
  becomes a goal.

## Skills System
- **What it is:** GSD's own per-project skills. `references/project-skills-discovery.md`
  defines a shared discovery contract (read `.claude/skills/*/SKILL.md`, load
  `rules/*.md` lazily) applied by planners/executors/researchers/verifiers.
  `src/clusters.cts` groups commands into named clusters; `/gsd:surface` and
  `/gsd:sync-skills` toggle which clusters are installed/surfaced without
  reinstall. `docs/skills/discovery-contract.md` + `scripts/lint-skill-deps.cjs`
  support it.
- **Does mine have it?** **No.**
- **Port value: Medium → idea#3 (partially), idea#5.** The discovery contract is
  a clean way to inject project conventions (good-practices, idea#3) without
  bloating prompts. The cluster/`surface` machinery is also relevant to idea#5
  (prune/curate which commands are active). Self-contained-ish; medium effort.

## Security / Guard Hooks
- **What it is:** A defense-in-depth layer. Hooks: `gsd-prompt-guard.js`
  (scans `.planning/` writes for injection), `gsd-read-injection-scanner.js`
  (scans Read output at ingestion), `gsd-read-guard.js`,
  `gsd-worktree-path-guard.js`, `gsd-validate-commit.sh`. Tooling: `src/secrets.cts`
  (API-key masking), `src/security.cts` (path-traversal / injection / regex-DoS
  validation). Workflow `commands/gsd/secure-phase.md` + agent
  `gsd-security-auditor` verify a phase's declared threat mitigations exist in
  code, producing `SECURITY.md`.
- **Does mine have it?** **No** (mine has only `gsd-workflow-guard.js` advisory
  hook + `context-monitor`/`statusline`/`check-update`).
- **Port value: Medium → idea#3.** The injection-scanner hooks are low-risk,
  advisory-only, and largely standalone JS (no `.cts` build dependency) — a
  good cheap win. `secure-phase`/auditor is a bigger, more optional addition.

## Observability
- **What it is:** `src/observability/{event,logger,redaction}.cts` — structured
  event logging with secret redaction.
- **Does mine have it?** **No** (mine logs ad hoc).
- **Port value: Low–Medium → idea#3 (logging).** Maps to the "logging" half of
  idea#3, but it's GSD's *own* telemetry, not guidance on how *user* code should
  log. Useful as a maturity upgrade; not what idea#3 is really asking for.

## Context-Budget / Engineering Maturity
- **What it is:** `references/context-budget.md` + `universal-anti-patterns.md`
  codify read-depth rules that scale with `context_window` (frontmatter-only
  under 500k, full-body permitted at 1M) and context-degradation tiers.
  `src/context-utilization.cts` classifies usage (healthy <60% / warning 60–70%
  / critical ≥70%) for `gsd-health --context`. `src/prompt-budget.cts` trims
  review prompts to a token budget for small-context models. `src/drift.cts`
  detects structural drift between the codebase and `codebase/STRUCTURE.md`.
- **Does mine have it?** **Partial.** Mine references `context_window` in many
  workflows but lacks the formal degradation tiers, the
  `context-utilization` classifier, prompt-budget trimming, and drift detection.
- **Port value: Medium-High → idea#2.** Directly answers idea#2 ("was the
  versioning/context-reduction-for-progress work finished?"): core has the
  finished classifier + budget rules + degradation tiers. Mostly
  prose/reference porting (cheap) for the rules; the `.cts` classifiers are
  small, pure functions (low-medium effort). Close to mine's existing model =
  low-friction.

## Extra Phase Modes
What each adds on top of the base discuss→plan→execute loop:
- **mvp-phase** — plan a phase as a vertical MVP slice (user story → SPIDR
  splitting → plan).
- **spec-phase** — clarify *what* a phase delivers with ambiguity scoring;
  produces `SPEC.md` before discuss.
- **ultraplan-phase** — [BETA] offload planning to Claude Code's cloud
  "ultraplan," review in browser, import back.
- **spike** / **sketch** — throwaway experiential exploration (spike = code,
  sketch = HTML/UI mockups), with "frontier mode" to propose what to do next.
- **eval-review** — audit an executed AI phase's evaluation coverage →
  `EVAL-REVIEW.md`.
- **ai-integration-phase** — generate an `AI-SPEC.md` design contract for
  phases that build AI systems.
- **secure-phase** — retroactive threat-mitigation verification (see Security).
- **graduation** — cross-phase `LEARNINGS.md` graduation helper.
- **Does mine have it?** **No** (mine has the base loop + ui/agent-spec/test
  phases only).
- **Port value: Low (most) / Medium (spec-phase, mvp-phase) → idea#3 weakly.**
  spec-phase's ambiguity scoring and mvp slicing are the most broadly useful;
  the AI-specific modes (eval-review, ai-integration) only pay off for AI
  projects. Mostly prose workflows = portable, but each is its own command to
  maintain (tension with idea#5's "prune").

## Ideation / Discovery Front-End
- **What it is:** `explore.md` (Socratic ideation/routing), `capture.md` +
  `inbox.md` + `surface.md` (capture ideas/seeds, triage GitHub issues, toggle
  skills), `import.md` (ingest external plans with decision-conflict detection),
  and the `ns-*` family (`ns-ideate/project/workflow/context/manage/review`) —
  namespaced umbrella commands grouping the whole surface. `src/gsd2-import.cts`
  notably imports **from** gsd2's `.gsd/` layout into core's `.planning/`.
- **Does mine have it?** **No** for ns-*/inbox/surface/explore/capture/import.
- **Port value: Low–Medium → idea#5.** The `ns-*` grouping is a curation/
  discoverability play that aligns with idea#5 (make the system easier to
  understand) — but it's organizational, not new capability. `import.md`'s
  conflict-detection-against-decisions is interesting given mine's
  decision/signal-strength focus (possible synergy). `gsd2-import.cts` is mainly
  relevant for migration parity, not a feature to add.

## Docs / Learning Loop
- **What it is:** `ingest-docs.md` (bootstrap `.planning/` from existing
  ADRs/PRDs/SPECs), `docs-update.md` (generate/update docs verified against
  code), `extract-learnings.md` (pull decisions/lessons/patterns from completed
  phases), `src/intel.cts` (queryable per-project intel store, gated on
  `intel.enabled`), and a fleet of `gsd-doc-*` agents
  (classifier/synthesizer/verifier/writer).
- **Does mine have it?** **No** (mine has `document`/`map-codebase` but no
  ingest/learnings/intel loop).
- **Port value: Medium → idea#3, idea#2.** `extract-learnings` + `intel`
  institutionalize "what we learned / good practices" feeding back into future
  phases (idea#3). `ingest-docs` is a strong onboarding-from-existing-repo
  capability. Self-contained workflows + agents; medium effort.

## Bonus (idea#3 best fit): Anti-Pattern & Bug-Pattern References
- **What it is:** `references/universal-anti-patterns.md`,
  `common-bug-patterns.md`, `planner-antipatterns.md` — codified "what good /
  bad looks like" that agents read during planning/verification.
- **Port value: High → idea#3 (best fit).** These map to idea#3's "what good
  code looks like" *better than the security cluster does*, and they are pure
  prose (no build dependency). Cheapest idea#3 win; extend with Python-specific
  guidance as idea#3 requests.

---

## Prioritized Porting Table

| Capability | Maps to idea# | Port value | Effort | Note |
|---|---|---|---|---|
| Anti-pattern / bug-pattern references | #3 | High | S | Pure prose; best fit for "good code" + add Python. No deps. |
| Context-budget rules + degradation tiers | #2 | High | S | Prose port; matches mine's `context_window` model. |
| Stall-detection in plan loop (`revision-loop`) | #4 | High | S | Mine already loops; add "escalate when issues stop decreasing." No deps. |
| context-utilization classifier / prompt-budget | #2 | Med-High | M | Small pure `.cts` fns → rewrite as `.cjs`. Answers "was it finished?" |
| Injection-scanner hooks (prompt/read guard) | #3 | Medium | S-M | Standalone advisory JS hooks; low risk, no build dep. |
| Cross-AI plan convergence (external reviewers) | #4 | High* | M-L | *High value but depends on external AI CLIs = feasibility risk. |
| `analyze-dependencies` (phase dep graph) | #1 | Medium | M | Cheap first step toward idea#1; no external binary. |
| extract-learnings + intel store | #3, #2 | Medium | M | Feedback loop of decisions/lessons; self-contained workflows+agents. |
| Skills discovery contract + clusters/surface | #3, #5 | Medium | M | Inject project conventions; curate active commands. |
| Graphify (code knowledge graph infra) | #1 | Medium | L | Reusable scaffold; **schema needs rework** for bug/feature links; external binary. |
| secure-phase + security-auditor | #3 | Medium | M-L | Optional; bigger surface than the hooks. |
| ingest-docs / docs-update | (#3) | Medium | M | Strong onboarding-from-existing-repo. |
| spec-phase / mvp-phase | (#3) | Low-Med | M | Ambiguity scoring + MVP slicing; each is a command to maintain (vs #5). |
| Observability (event/logger/redaction) | #3 (logging) | Low-Med | M | GSD's own telemetry, not user-code logging guidance. |
| Workstreams / workspaces / manager | — | Low-Med | L | Parallel-execution surface; off mine's discussion-first direction. |
| ns-* / inbox / surface / explore / capture | #5 | Low-Med | M | Organizational/discoverability, not new capability. |
| Extra AI/eval modes (eval-review, ai-integration, ultraplan, graduation, spike, sketch) | — | Low | M | Niche; only pay off for specific project types. |

\* feasibility-gated by external dependency.

---

## Reverse: What MINE has that core lacks (preserve / candidate to upstream)

The fork's unique value is entirely on the **discussion/planning** side and is
**genuinely net-new vs core** (verified: core's `discuss-phase` has no
decision-tagging or note-pollination; core's "specialist" dispatch exists only
in `debug.md`, and core's "cross-phase" hits are integration checks, not note
sharing). Specifically: (1) **conversation-first discuss-phase** — extract
decisions through genuine dialogue, letting user energy guide depth, vs core's
gray-area-enumeration (`discuss-phase-power`/`-assumptions`) approach; (2)
**signal-strength tagging** of every CONTEXT.md decision
(`[STRONG]`/`[WEAK]`/`[DISCRETION]` plus `specialist-backed`/`user-override`
variants) so downstream planner/researcher know what's non-negotiable vs
adjustable and never re-ask; (3) **cross-phase note pollination** via
`.planning/cross-phase-notes.md`, pre-gathering context so later phases ask
fewer questions; and (4) **specialist-in-the-loop** — classify and consult a
specialist before architecture/tech questions, folding confidence into signal
strength. These should be **preserved as the fork's differentiator** and are
strong **upstream candidates** — they would slot cleanly into core's
discuss-phase and pair especially well with core's `import.md`
decision-conflict detection.
