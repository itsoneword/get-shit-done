# Architecture
**Analysis Date:** 2026-06-12

## Pattern Overview

**Overall:** Markdown-driven meta-workflow framework with a CLI tool core.

GSD is not a conventional application — it is a framework that installs into AI coding assistants (Claude Code, Gemini CLI, GitHub Copilot, Codex, OpenCode) and orchestrates AI agents to execute structured software development workflows. The "code" that runs on a user's machine is minimal Node.js; the real "application" is the network of AI agents communicating through shared markdown files in `.planning/`.

Key characteristics:

- **Three-tier separation:** Installer (`bin/install.js`) → Tool CLI (`gsd-tools.cjs`) → Agent/Workflow definitions (`agents/*.md`, `workflows/*.md`)
- **Commands as thin stubs:** `commands/gsd2/*.md` files are Claude slash-command definitions that load workflows by reference (`@~/.claude/get-shit-done/workflows/*.md`)
- **Agents as specialized roles:** `agents/*.md` files define sub-agent personas with specific tools, responsibilities, and role boundaries
- **State persisted in markdown:** The `.planning/` directory in each user project is the runtime state store — `STATE.md`, `ROADMAP.md`, `phases/`, `config.json`
- **V1.6 supervision harness (Phases 10-15):** Append-only ledger + mailbox + parking + multi-lens discussion loop enable autonomous runs with human review checkpoints and conflict detection

---

## Layers

**Installer Layer:**

- Purpose: Install GSD into AI runtimes (Claude Code, Copilot, Gemini, Codex, OpenCode, Cursor, Antigravity)
- Location: `bin/install.js`
- Depends on: Node.js `fs`, `path`, `os`, `readline`, `crypto`; `package.json` for version
- Behavior: Writes agent definitions to `~/.claude/agents/` (or runtime-equivalent), writes commands to `~/.claude/commands/gsd2/`, copies `get-shit-done/` reference tree to `~/.claude/get-shit-done/`, installs hooks to runtime hook directories
- Per-runtime path mapping: Claude → `.claude/`, Copilot → `.github/`, Gemini → `.gemini/`, Codex → `.codex/`, OpenCode → `.config/opencode/`, Cursor → `.cursor/`, Antigravity → `.agent/`

**Tool CLI Layer (`gsd-tools.cjs`):**

- Purpose: Provide programmatic operations that workflows call via `node gsd-tools.cjs <command>` in bash blocks. Replaces ~50 repetitive inline bash patterns across workflow files.
- Location: `get-shit-done/bin/gsd-tools.cjs`
- Depends on: All `get-shit-done/bin/lib/*.cjs` modules
- Used by: Every agent and workflow — called inline as `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" <command>`
- Output contract: JSON to stdout (or `@file:/tmp/gsd-*.json` for payloads >50KB), or `--raw` for plain values. Exits 0 on success, 1 on error.
- Key compound commands: `init execute-phase`, `init plan-phase`, `init new-project`, `init resume` — these return all context a workflow needs in a single JSON blob, minimizing orchestrator context usage

**Core Library Layer (`get-shit-done/bin/lib/*.cjs`):**

- Purpose: Domain logic for all tool CLI operations, organized by concern
- Location: `get-shit-done/bin/lib/`
- Modules:
  - `core.cjs` — Shared utilities, path helpers, config loading, git utilities, markdown normalization, phase finding, roadmap scoping, model resolution. Everything else imports from here.
  - `state.cjs` — STATE.md read/write, phase progression, metrics recording
  - `phase.cjs` — Phase CRUD: list, find, add, insert, remove, complete
  - `roadmap.cjs` — ROADMAP.md parse and update
  - `milestone.cjs` — Milestone completion and archival, REQUIREMENTS.md management
  - `commands.cjs` — Utility commands: slug, timestamp, todo list, history digest, progress
  - `config.cjs` — `.planning/config.json` CRUD
  - `verify.cjs` — Summary verification, phase completeness, reference checking, artifact validation
  - `init.cjs` — Compound init commands that bundle context for workflow initialization
  - `frontmatter.cjs` — YAML frontmatter parse/serialize/CRUD for all `.planning/` markdown files
  - `model-profiles.cjs` — Agent-to-model mapping across quality/balanced/budget profiles
  - `profile-pipeline.cjs` — Claude Code session scanning for user behavioral profiling
  - `profile-output.cjs` — Structured output for user profile generation
  - `uat.cjs` — Cross-phase UAT/VERIFICATION.md scanner
  - `ledger.cjs` — Append-only decision ledger (Phase 10+): DECISIONS.jsonl with autonomously resolved decisions, confidence metadata, escalation verdicts
  - `mailbox.cjs` — Decision mailbox for escalated decisions (Phase 10+): MAILBOX.jsonl stores parked questions pending human review, tracks answer status
  - `park.cjs` — Phase snapshot persistence and stuck detection (Phase 12+): tracks file hashes at phase boundaries, detects staleness/convergence failure
  - `discuss-loop.cjs` — Multi-lens judgment loop primitives (Phase 14+): loop-id generation, position validation, constraint delta, survivor selection, transcript recording
  - `worktree.cjs` — Linked worktree lifecycle for parallel executor isolation (Phase 13+): create, merge, remove worktrees; conflict detection via clean flag
  - `parallel-gate.cjs` — Concurrent safety decision for phase dependencies (Phase 13+)
  - `trace.cjs`, `lesson.cjs`, `migration.cjs`, `install-transform.cjs` — Supporting utilities

**Persistence Layer (Phase 10+ ledger/mailbox, Phase 12+ park, Phase 13+ worktree, Phase 14+ discuss-loop):**

- Purpose: Record autonomous decision outcomes, escalated decisions, phase snapshots, worktree merges, and multi-lens judgment loops for auditable runs
- Location: `get-shit-done/bin/lib/ledger.cjs`, `get-shit-done/bin/lib/mailbox.cjs`, `get-shit-done/bin/lib/park.cjs`, `get-shit-done/bin/lib/discuss-loop.cjs`, `get-shit-done/bin/lib/worktree.cjs`
- Run context: Gated by `GSD_RUN_ID` environment variable. When set, `gsd-tools run init <run-id>` creates `.planning/run/<run-id>/` with:
  - `DECISIONS.jsonl` — Append-only ledger of autonomously resolved decisions
  - `MAILBOX.jsonl` — Parked questions and answers
  - `RUN-META.json` — Run metadata, phase tracking, git snapshots
  - `parked/phase-{N}.json` — File hashes and context snapshots at phase boundaries
  - `run.log` — Timestamped event stream (Phase 13+): parsed by runner for health, phase outcomes, stuck detection, conflict routing
- Worktree data: Git branch-based isolation; `.worktrees/` directory in project root (gitignored). Merges return `{clean: boolean, conflict_files: [...]}` for human conflict routing.
- Discuss-loop data: `.planning/discuss-loop/<loop-id>/` with:
  - `artifact.txt` — Artifact content snapshot (grounds anchor validation)
  - `transcript.jsonl` — Position blocks, deltas, and lens_failure records; append-only, JSONL format

**Escalation Contract Layer (Phase 11+):**

- Purpose: Deterministic, membership-check-based evaluation of autonomous decisions against four criteria (irreversibility, security boundary, scope change, spec ambiguity)
- Location: `get-shit-done/references/escalation-contract.md`
- Verdicts: `proceed` (HIGH confidence, no criteria met) | `proceed-and-log` (MEDIUM confidence or borderline, no criteria met) | `park-and-ask` (any criterion met or LOW after exhaustion)
- Applied by: discuss-phase question_triage step (inline, no Task spawn) and discuss-loop convergence evaluator when a resolution loop decision is autonomously resolved and `GSD_RUN_ID` is set
- Writes to: `.planning/run/<run-id>/DECISIONS.jsonl` with `escalation_verdict` and `escalation_reason` fields (write-once; verdict computed before append)

**Workflow Layer (`get-shit-done/workflows/*.md`):**

- Purpose: Step-by-step orchestration instructions consumed by orchestrator agents. Define the "how" of each workflow: what to call, in what order, what agents to spawn, how to handle errors.
- Location: `get-shit-done/workflows/`
- Depends on: `gsd-tools.cjs` (via bash blocks), agent sub-types (via Task tool)
- Pattern: Loaded by commands via `@~/.claude/get-shit-done/workflows/<name>.md` reference — the Claude runtime injects the file content into the orchestrator's context
- Key workflows: `execute-phase`, `plan-phase`, `discuss-phase`, `new-project`, `verify-work`, `overnight` (Phase 13+), `autonomous` (Phase 13+), `discuss-loop` (Phase 14+), `inbox` (Phase 10+)

**Command Layer (`commands/gsd2/*.md`):**

- Purpose: Claude slash-command stubs. Each file is the entry point for a user-invoked command (e.g., `/gsd2:plan-phase`). Commands are thin: they declare allowed tools, parse `$ARGUMENTS`, load the corresponding workflow via `@`-reference, and delegate.
- Location: `commands/gsd2/` (installed to `~/.claude/commands/gsd2/`)
- Pattern example:

```markdown
---
name: gsd2:execute-phase
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Task, TodoWrite, AskUserQuestion]
---
@~/.claude/get-shit-done/workflows/execute-phase.md
```

**Agent Layer (`agents/*.md`):**

- Purpose: Define specialized AI sub-agent personas spawned by orchestrators via the `Task` tool. Each agent has a focused role, specific tools, and behavioral guardrails.
- Location: `agents/` (installed to `~/.claude/agents/`)
- Agents include:
  - Core execution: `gsd-executor`, `gsd-planner`, `gsd-verifier`, `gsd-plan-checker`
  - Research & analysis: `gsd-phase-researcher`, `gsd-project-researcher`, `gsd-research-synthesizer`, `gsd-codebase-mapper`, `gsd-agent-researcher`, `gsd-document-mapper`
  - Quality & validation: `gsd-debugger`, `gsd-fixer`, `gsd-nyquist-auditor`, `gsd-integration-checker`, `gsd-test-designer`, `gsd-agent-checker`, `gsd-document-updater`
  - Multi-lens judgment (Phase 14+): `gsd-lens-skeptic`, `gsd-lens-user-advocate`, `gsd-lens-architect`
  - UI specialists: `gsd-ui-researcher`, `gsd-ui-checker`, `gsd-ui-auditor`
  - Other: `gsd-roadmapper`, `gsd-user-profiler`

**Hook Layer (`hooks/*.js`):**

- Purpose: Claude Code lifecycle hooks injected at Pre/PostToolUse events. Read-only observers and soft guardrails — they advise, never block.
- Location: `hooks/` (source); `hooks/dist/` (deployed, built via `scripts/build-hooks.js`)
- Hooks:
  - `gsd-context-monitor.js` — PostToolUse; reads context metrics from statusline bridge file, injects WARNING/CRITICAL advisories when context remaining drops below 35% / 25%
  - `gsd-statusline.js` — PostToolUse; writes context metrics to `/tmp/claude-ctx-{session_id}.json` for consumption by context monitor
  - `gsd-workflow-guard.js` — PreToolUse; detects Write/Edit calls outside GSD workflows and injects advisory to use `/gsd2:quick` instead (soft guard, does not block)
  - `gsd-check-update.js` — Checks for GSD version updates

**Reference Layer (`get-shit-done/references/*.md`):**

- Purpose: Behavioral reference documents loaded inline by agents/workflows. Define agent policies, patterns, and conventions.
- Location: `get-shit-done/references/`
- Key files: `model-profiles.md`, `ui-brand.md`, `continuation-format.md`, `verification-patterns.md`, `questioning.md`, `escalation-contract.md` (Phase 11+)

**Template Layer (`get-shit-done/templates/*.md`):**

- Purpose: Document templates for project artifacts created during workflows
- Location: `get-shit-done/templates/`
- Key templates: `state.md`, `project.md`, `roadmap.md`, `UAT.md`, `VALIDATION.md`, `summary-standard.md`, `summary-minimal.md`, `summary-complex.md`, `claude-md.md`

---

## Data Flow

**New Project Flow:**
`/gsd2:new-project` → load `new-project.md` workflow → deep questioning → `gsd-project-researcher` → `gsd-roadmapper` → writes `.planning/{PROJECT.md, ROADMAP.md, STATE.md, config.json}`

**Discuss Phase Flow:**
`/gsd2:discuss-phase <N>` → conversation with user → extracts decisions with signal strength ([STRONG]/[WEAK]/[DISCRETION]) → applies escalation contract when `GSD_RUN_ID` is set (inline, no Task spawn) → writes `.planning/phases/NN-slug/N-CONTEXT.md` → appends to `.planning/run/<run-id>/DECISIONS.jsonl` with verdict → cross-phase notes written to `.planning/cross-phase-notes.md`

**Plan Phase Flow:**
`/gsd2:plan-phase <N>` → `init plan-phase N` (gsd-tools JSON) → optionally spawn `gsd-phase-researcher` → spawn `gsd-planner` → spawn `gsd-plan-checker` → revision loop (max 3) → writes `.planning/phases/NN-slug/{N-PLAN.md}`

**Execute Phase Flow:**
`/gsd2:execute-phase <N>` → `init execute-phase N` (gsd-tools JSON) → analyze PLAN frontmatter for `wave`/`depends_on` → group plans into waves → per wave: spawn `gsd-executor` for each plan (parallel if `parallelization: true`) → `gsd-executor` commits code, writes `SUMMARY.md` → orchestrator updates `STATE.md`

**Verify Work Flow:**
`/gsd2:verify-work <N>` → `gsd-verifier` reads PLAN.md + SUMMARY.md → checks must_haves, artifacts, commits → writes VERIFICATION.md → if gaps: creates gap-closure PLAN.md with `gap_closure: true` frontmatter

**Autonomous Decision Flow (Phase 11+, harness-driven via GSD_RUN_ID):**
discuss-phase question_triage: resolution loop resolves decision (HIGH/MEDIUM/LOW) → only when GSD_RUN_ID is set (harness run): inline escalation evaluator applies four contract criteria as membership checks → computes `escalation_verdict` (proceed|proceed-and-log|park-and-ask) + `escalation_reason` → appends to `.planning/run/<run-id>/DECISIONS.jsonl` (write-once) → if `park-and-ask`: question appended to MAILBOX.jsonl for morning review; if `proceed`/`proceed-and-log`: decision executes autonomously and is flagged in ledger for morning review

**Multi-Lens Discussion Loop (Phase 14+):**
`/gsd2:discuss-loop <artifact-path | --decision dec-NNN>` → parse artifact (file or ledger decision) → up to 3 rounds of parallel judgment (fresh-context Skeptic, User-Advocate, Architect lenses) → each round: three lens agents spawned in parallel via Task() → each returns position block with `{lens, round, position, blocking, constraints[]}` → orchestrator validates each block (anchor substring check against artifact.txt, referential integrity for carried constraints) → computes round delta (blocking lenses, new vs. carried constraint counts, convergence flag) → converge on `blocking: false` + no new constraints, or escalate divergent positions → on convergence: apply modifications to artifact (after escalation-contract check if committed file), append decision to ledger (if run context) → on escalation (round 3 divergence): compute survivor lenses via divergence-weight ranking, append mailbox entry (if `--auto` + run context, never synthesis of lens positions), or present in-session (interactive) → transcript appended at every step (loop-start, position record per lens, round-delta, loop-end)

**Overnight Autonomous Run (Phase 13+, v1.6 harness):**
`/gsd2:overnight [--from N] [--run-id <id>]` → health check (ESC-03 calibration gate + absolute GSD_RUN_LOG path) → `gsd-tools run init <run-id>` → discover phases and dependency graph → for each remaining phase: spawn autonomous loop via `Skill(skill="gsd2:autonomous", args="--phase N")` with GSD_RUN_ID, GSD_RUN_LOG in environment → worktree creation attempt (fallback to in-place if isolation unavailable) → each Skill invocation inherits run context, appends to ledger/mailbox, reads/writes parked snapshots → runner monitors for conflicts (clean: false from `worktree merge --raw`) and auth failures (hard stop) → conflicts route to mailbox with file list and run-id for morning resolution → phase stuck detection via `run snapshot` comparing hash deltas → morning report printed at end with decision summary, pending questions, and mailbox pointer

**Morning Inbox (Phase 10+):**
`/gsd2:inbox [run-id]` → resolve run → print morning report (from `gsd-tools run report <run-id>`) → load unanswered questions from MAILBOX.jsonl → present each with context, evidence, staleness state → record answers via `gsd-tools mailbox answer` → print per-phase resume handoffs (never execute resume)

**State Management:**
All workflows read STATE.md first via `gsd-tools state load`. Writes happen at: plan start, plan completion, phase completion, blocker/decision recording. STATE.md stays under 100 lines; full decision log lives in PROJECT.md. Run context (when `GSD_RUN_ID` is set) replaces PROJECT.md ledger entries with append-only DECISIONS.jsonl for audit trail integrity.

---

## Entry Points

- `bin/install.js` — npm package binary, triggered by `npx gsd2`. Prompts runtime selection, writes all files to AI runtime config dirs.
- `get-shit-done/bin/gsd-tools.cjs` — Tool CLI called by workflows/agents via bash. Installed at `~/.claude/get-shit-done/bin/gsd-tools.cjs`.
- `commands/gsd2/*.md` — User-facing slash commands in Claude Code (e.g., `/gsd2:plan-phase 3`, `/gsd2:overnight`, `/gsd2:discuss-loop`). Each is the true runtime entry point for GSD workflows.

---

## Error Handling

- `gsd-tools.cjs` functions call `error(message)` from `core.cjs` — writes to stderr, exits 1. Orchestrators check exit codes and surface errors to the user.
- Large payloads (>50KB JSON) are written to `/tmp/gsd-*.json` and the path returned with `@file:` prefix. Callers must check: `if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi`
- Hook scripts use stdin timeouts (3s / 10s) to prevent hanging on slow pipes — exit 0 silently rather than reporting hook errors that confuse the agent.
- Workflows have fallback logic: missing `.planning/` → error and instruct to run new-project; missing STATE.md → offer reconstruct; missing phase directory → offer to create; absent Task API (non-Claude runtimes) → sequential inline execution fallback.
- Run context failures are fail-closed: health check gates fail-closed (no phase starts on HEALTH_FAIL); transcript write failures abort the loop immediately (unauditable); conflict detection never silently retries — conflicts route to mailbox with evidence preserved. Worktree merge conflicts leave branches UNMERGED for human morning review (TC-2 invariant: the branch is the conflict evidence).
- Auth failures in overnight runs halt immediately (AUTH_FAILURE + RUN_STOP logged, no silent retry, no skip-to-independent for auth — every other failure parks/fails phase and continues to independent phases — auth is the asymmetric exception per RUN-03 invariant).

---

## Cross-Cutting Concerns

**Model Selection:**
Every agent type has a model profile entry in `model-profiles.cjs`. The active profile (quality/balanced/budget) is set in `.planning/config.json`. `resolveModelInternal(cwd, agentType)` in `core.cjs` checks per-agent overrides (`model_overrides` in config) first, then profile lookup. If `resolve_model_ids: true`, aliases (opus/sonnet/haiku) are resolved to full model IDs to prevent API 404s.

**Config System:**
`.planning/config.json` is the per-project config. `loadConfig(cwd)` provides typed defaults, handles migration of deprecated keys (e.g., `depth` → `granularity`), and supports nested key paths via dotted notation in `config-set` commands. Valid keys are enumerated in `config.cjs:VALID_CONFIG_KEYS`.

**Markdown Normalization:**
`normalizeMd()` in `core.cjs` enforces markdownlint rules (MD022, MD031, MD032, MD012, MD047) at every write point for `.planning/` files. This prevents IDE lint errors in agent-generated markdown.

**Git Integration:**
`execGit(cwd, args)` wraps `spawnSync('git', ...)`. Commits are made by `gsd-executor` after each plan task group. The `commit_docs` config flag controls whether `.planning/` state changes are committed separately. Branch templates support `{phase}`, `{slug}`, `{milestone}` placeholders.

**Context Budget:**
Orchestrators stay lean (~15% context budget) by delegating all heavy work to subagents. Each subagent gets 100% fresh context. The `@file:` protocol avoids bloating orchestrator context with large JSON payloads. Plans are kept to 2-3 tasks each to ensure executors complete within ~50% context.

**Runtime Compatibility:**
Workflows detect the active runtime and adapt. Copilot does not reliably return subagent completion signals, so it forces sequential inline execution. Other non-Claude runtimes fall back similarly. The `Task()` subagent API is the Claude Code canonical path; absence of it triggers the fallback branch.

**Run Context Gating (Phase 10+):**
When `GSD_RUN_ID` environment variable is set, all append-only writes to `DECISIONS.jsonl`, `MAILBOX.jsonl`, and parked snapshots are permitted. Without `GSD_RUN_ID`, these writes are gated off — decisions stay in STATE.md/PROJECT.md only. This prevents orphaned ledger entries in interactive runs and ensures harness-context-only write semantics.

**Autonomous Decision Evaluation (Phase 11+):**
When `GSD_RUN_ID` is set (harness/overnight run), the discuss-phase question_triage evaluator applies the escalation contract inline (no Task spawn, no human roundtrip) to each autonomously resolved decision. The contract is a deterministic four-criterion membership check — conditions are literal, not heuristic. Verdicts are computed before ledger append (write-once). Borderline cases (condition resembles but doesn't literally match) default to `proceed-and-log` per tie-break rules, except borderline irreversibility or security → `park-and-ask`. This makes autonomous runs auditable and tunable — decisions flow through the ledger with their verdict and reason, visible in morning review.

**Multi-Lens Grounding (Phase 14+):**
Every constraint emitted by a lens agent must carry a verbatim anchor — a character-exact quote from the artifact being judged. The orchestrator mechanically substring-checks anchors against `artifact.txt` via `validatePositionBlock()` — a paraphrased or invented anchor fails validation and costs a re-spawn. No anchor → no constraint. This prevents lens synthesis of invented positions and grounds judgment in artifact text alone. Constraint IDs follow `<lens>-r<round>-c<n>` format and must be referenced by name when carried to later rounds (referential integrity check).

**Discuss-Loop Convergence (Phase 14+):**
The loop converges deterministically: no blocking position + no new constraints = verdict `accept`. Otherwise, escalate divergent positions to mailbox (autonomous runs) or present in-session (interactive). Divergent constraint sets are never averaged or synthesized — each surviving position is presented as-is via `selectSurvivors()`, ordered by divergence weight (unshared blocking constraint count). Survivors are labeled per lens; non-surviving positions are discarded per LOOP-02 contract (no synthesis, no re-ranking of decisions that already converged).

**Worktree Isolation (Phase 13+):**
Parallel phase execution via overnight runner uses git linked worktrees (`.worktrees/overnight-phase-{N}/`) to isolate concurrent work. The `worktree add` command detects pre-existing isolation and detects submodules (not worktrees). Merges are conflict-aware: exit code is always 0, but the `clean: boolean` field (from `worktree merge --raw` JSON) indicates conflict state (TC-2: exit codes are meaningless, JSON clean flag is canonical truth). On conflict, the branch is left UNMERGED for human review; no silent retry. On clean merge, the worktree is removed. In-place fallback (WORKTREE_FALLBACK logged) occurs when isolation unavailable — runner logs the fallback, not a failure.

**Stuck Phase Detection (Phase 13+):**
At every phase boundary, `gsd-tools run snapshot` compares file hashes against parked snapshots from prior phases. If hashes haven't changed, the phase is marked stuck. A stuck completed phase is downgraded to failed (TC-6: stuck never completes). This catches convergence failures and loops where the model cannot progress.
