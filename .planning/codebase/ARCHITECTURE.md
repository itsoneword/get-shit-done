# Architecture
**Analysis Date:** 2026-03-21

## Pattern Overview

**Overall:** Markdown-driven meta-workflow framework with a CLI tool core.

GSD is not a conventional application — it is a framework that installs into AI coding assistants (Claude Code, Gemini CLI, GitHub Copilot, Codex, OpenCode) and orchestrates AI agents to execute structured software development workflows. The "code" that runs on a user's machine is minimal Node.js; the real "application" is the network of AI agents communicating through shared markdown files in `.planning/`.

Key characteristics:

- **Three-tier separation:** Installer (`bin/install.js`) → Tool CLI (`gsd-tools.cjs`) → Agent/Workflow definitions (`agents/*.md`, `workflows/*.md`)
- **Commands as thin stubs:** `commands/gsd2/*.md` files are Claude slash-command definitions that load workflows by reference (`@~/.claude/get-shit-done/workflows/*.md`)
- **Agents as specialized roles:** `agents/*.md` files define sub-agent personas with specific tools, responsibilities, and role boundaries
- **State persisted in markdown:** The `.planning/` directory in each user project is the runtime state store — `STATE.md`, `ROADMAP.md`, `phases/`, `config.json`

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
  - `template.cjs` — Template selection and fill for SUMMARY.md / PLAN.md / VERIFICATION.md
  - `verify.cjs` — Summary verification, phase completeness, reference checking, artifact validation
  - `init.cjs` — Compound init commands that bundle context for workflow initialization
  - `frontmatter.cjs` — YAML frontmatter parse/serialize/CRUD for all `.planning/` markdown files
  - `model-profiles.cjs` — Agent-to-model mapping across quality/balanced/budget profiles
  - `profile-pipeline.cjs` — Claude Code session scanning for user behavioral profiling
  - `profile-output.cjs` — Structured output for user profile generation
  - `uat.cjs` — Cross-phase UAT/VERIFICATION.md scanner

**Workflow Layer (`get-shit-done/workflows/*.md`):**

- Purpose: Step-by-step orchestration instructions consumed by orchestrator agents. Define the "how" of each workflow: what to call, in what order, what agents to spawn, how to handle errors.
- Location: `get-shit-done/workflows/`
- Depends on: `gsd-tools.cjs` (via bash blocks), agent sub-types (via Task tool)
- Pattern: Loaded by commands via `@~/.claude/get-shit-done/workflows/<name>.md` reference — the Claude runtime injects the file content into the orchestrator's context

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
- Key agents:
  - `gsd-executor` — Executes PLAN.md tasks, creates SUMMARY.md, commits changes
  - `gsd-planner` — Creates PLAN.md files from phase scope and research
  - `gsd-phase-researcher` — Researches technical approaches before planning
  - `gsd-verifier` — Validates phase completion against success criteria
  - `gsd-plan-checker` — Reviews PLAN.md quality in a verification loop
  - `gsd-debugger` — Diagnoses and fixes issues
  - `gsd-codebase-mapper` — Maps codebase structure for planning context
  - `gsd-nyquist-auditor` — Validates verification coverage
  - `gsd-integration-checker` — Checks cross-phase integration
  - `gsd-ui-researcher`, `gsd-ui-checker`, `gsd-ui-auditor` — UI-specific specialists

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
- Key files: `model-profiles.md`, `ui-brand.md`, `continuation-format.md`, `verification-patterns.md`, `questioning.md`

**Template Layer (`get-shit-done/templates/*.md`):**

- Purpose: Document templates for project artifacts created during workflows
- Location: `get-shit-done/templates/`
- Key templates: `state.md`, `project.md`, `roadmap.md`, `phase-prompt.md`, `UAT.md`, `VALIDATION.md`, `summary-standard.md`, `summary-minimal.md`, `summary-complex.md`, `claude-md.md`

---

## Data Flow

**New Project Flow:**
`/gsd2:new-project` → load `new-project.md` workflow → deep questioning → `gsd-project-researcher` → `gsd-roadmapper` → writes `.planning/{PROJECT.md, ROADMAP.md, STATE.md, config.json}`

**Discuss Phase Flow (gsd2 fork feature):**
`/gsd2:discuss-phase <N>` → conversation with user → extracts decisions with signal strength ([STRONG]/[WEAK]/[DISCRETION]) → writes `.planning/phases/NN-slug/N-CONTEXT.md` → cross-phase notes written to `.planning/cross-phase-notes.md`

**Plan Phase Flow:**
`/gsd2:plan-phase <N>` → `init plan-phase N` (gsd-tools JSON) → optionally spawn `gsd-phase-researcher` → spawn `gsd-planner` → spawn `gsd-plan-checker` → revision loop (max 3) → writes `.planning/phases/NN-slug/{N-PLAN.md}`

**Execute Phase Flow:**
`/gsd2:execute-phase <N>` → `init execute-phase N` (gsd-tools JSON) → analyze PLAN frontmatter for `wave`/`depends_on` → group plans into waves → per wave: spawn `gsd-executor` for each plan (parallel if `parallelization: true`) → `gsd-executor` commits code, writes `SUMMARY.md` → orchestrator updates `STATE.md`

**Verify Work Flow:**
`/gsd2:verify-work <N>` → `gsd-verifier` reads PLAN.md + SUMMARY.md → checks must_haves, artifacts, commits → writes VERIFICATION.md → if gaps: creates gap-closure PLAN.md with `gap_closure: true` frontmatter

**State Management:**
All workflows read STATE.md first via `gsd-tools state load`. Writes happen at: plan start, plan completion, phase completion, blocker/decision recording. STATE.md stays under 100 lines; full decision log lives in PROJECT.md.

---

## Entry Points

- `bin/install.js` — npm package binary, triggered by `npx gsd2`. Prompts runtime selection, writes all files to AI runtime config dirs.
- `get-shit-done/bin/gsd-tools.cjs` — Tool CLI called by workflows/agents via bash. Installed at `~/.claude/get-shit-done/bin/gsd-tools.cjs`.
- `commands/gsd2/*.md` — User-facing slash commands in Claude Code (e.g., `/gsd2:plan-phase 3`). Each is the true runtime entry point for GSD workflows.

---

## Error Handling

- `gsd-tools.cjs` functions call `error(message)` from `core.cjs` — writes to stderr, exits 1. Orchestrators check exit codes and surface errors to the user.
- Large payloads (>50KB JSON) are written to `/tmp/gsd-*.json` and the path returned with `@file:` prefix. Callers must check: `if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi`
- Hook scripts use stdin timeouts (3s / 10s) to prevent hanging on slow pipes — exit 0 silently rather than reporting hook errors that confuse the agent.
- Workflows have fallback logic: missing `.planning/` → error and instruct to run new-project; missing STATE.md → offer reconstruct; missing phase directory → offer to create; absent Task API (non-Claude runtimes) → sequential inline execution fallback.

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
