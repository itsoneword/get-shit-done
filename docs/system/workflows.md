# Subsystem: Workflows

**Updated:** 2026-04-17 by /gsd2:document (full run)
**Sources:** `get-shit-done/workflows/*.md`, `commands/gsd2/*.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md:27-34, 54-60`

## Shape

```mermaid
flowchart TD
    User[User types /gsd2:name] --> Stub[commands/gsd2/name.md<br/>slash-command stub]
    Stub -->|@include| Workflow[get-shit-done/workflows/name.md<br/>orchestration steps]
    Workflow -->|step 1| Init[node gsd-tools.cjs init name]
    Init --> State[Parse init JSON: STATE, config, models, flags]
    State --> Steps[Execute numbered steps]
    Steps -->|spawn| Agents[Task subagent_type=gsd-*]
    Steps -->|invoke| CLI[node gsd-tools.cjs ...]
    Steps -->|read policy| Refs[references/*.md]
    Steps -->|fill template| Templates[templates/*.md]
    Agents --> Artifacts[Write phase/milestone artifacts]
    CLI --> State2[.planning/STATE, ROADMAP, config]
    Artifacts --> Done[Workflow completes]
    State2 --> Done
```

## How It Works

### Overview

Workflows are the orchestration layer. Each GSD slash-command is a thin stub in `commands/gsd2/<name>.md` that loads a workflow file in `get-shit-done/workflows/<name>.md` via `@~/.claude/get-shit-done/workflows/<name>.md` (source: `.planning/codebase/STRUCTURE.md:175-176`). 49 workflow files orchestrate the full GSD lifecycle (source: `.planning/codebase/STRUCTURE.md:54`); 51 slash-command stubs expose them to users.

### Workflow Structure

Per `.planning/codebase/STRUCTURE.md:177-179`, every workflow file follows a canonical layout:

- `<purpose>` block — one-sentence description
- `<required_reading>` block — reference files to load
- `<available_agent_types>` block — agents this workflow may spawn
- `<process>` block — numbered steps, each with bash commands, agent Task calls, or branching logic
- `<anti_patterns>` block (optional) — pitfalls with guards
- `<success_criteria>` block — exit conditions

The first step of every workflow is `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init <workflow>`, which returns a JSON blob bundling all workflow context (source: `.planning/codebase/STRUCTURE.md:179`). See [[tool-cli]] `init.cjs`.

### Slash-Command Stubs

`commands/gsd2/<name>.md` carries frontmatter declaring `name`, `description`, `argument-hint`, `allowed-tools` (source: `.planning/codebase/STRUCTURE.md:175-176`). The body loads the corresponding workflow. Stubs are the discoverable surface — they appear in `/help` listings.

### Workflow Categories

**Project lifecycle:**
- `new-project` — deep context gathering, initializes PROJECT.md
- `new-milestone` — starts a milestone cycle
- `complete-milestone` — archives completed milestone
- `audit-milestone` — pre-archive audit of original intent
- `plan-milestone-gaps` — creates phases to close audit gaps
- `cleanup` — archives accumulated phase directories

**Phase lifecycle:**
- `discuss-phase` — adaptive questioning before planning
- `research-phase` — standalone phase research
- `plan-phase` — PLAN.md creation with verification loop
- `execute-phase` — wave-based parallel execution
- `verify-work` — conversational UAT
- `validate-phase` — retroactive Nyquist audit
- `list-phase-assumptions` — surface assumptions pre-plan
- `add-phase` / `insert-phase` / `remove-phase` — roadmap editing

**Execution-time:**
- `fix` — dependency-aware post-execution fixes
- `debug` — scientific-method debugging
- `add-tests` — generate tests from UAT + implementation
- `ui-phase` — UI-SPEC.md contract generation
- `ui-review` — retroactive visual audit

**Utilities:**
- `help`, `stats`, `progress`, `next`, `health`, `update`, `check-todos`, `add-todo`, `note`, `plant-seed`
- `pause-work`, `resume-work`, `thread`, `session-report`
- `set-profile`, `settings`, `profile-user`
- `ship`, `pr-branch`, `review`, `review-backlog`, `add-backlog`
- `map-codebase` — spawns [[agents]] `gsd-codebase-mapper` ×4
- `document` — spawns [[agents]] `gsd-document-mapper`/`gsd-document-updater`
- `audit-uat`, `do`, `autonomous`

(source: `commands/gsd2/` directory listing; `get-shit-done/workflows/` directory listing)

### Where to Add a Workflow

1. Create `get-shit-done/workflows/<name>.md` following the canonical layout (`<purpose>`, `<required_reading>`, `<available_agent_types>`, `<process>`).
2. Create `commands/gsd2/<name>.md` with frontmatter and a body that loads the workflow via `@~/.claude/get-shit-done/workflows/<name>.md`.
3. First step calls `node gsd-tools.cjs init <name>` to load state.
4. If the workflow adds new init context, extend `init.cjs` in [[tool-cli]].

(source: `.planning/codebase/STRUCTURE.md:175-179`)

## Interfaces

### Inputs

- `$ARGUMENTS` — raw string from slash-command invocation (parsed per workflow)
- Init JSON from `gsd-tools.cjs init <workflow>` — bundled STATE, config, resolved models, flags
- `.planning/` state: STATE.md, ROADMAP.md, config.json, phase dirs

### Outputs

- Agent spawns via `Task(subagent_type=..., model=..., prompt=...)`
- CLI invocations via `node gsd-tools.cjs <cmd>`
- Written artifacts: phase files (PLAN/SUMMARY/RESEARCH/UAT/VERIFICATION), milestone archives, `docs/system/*`, `.planning/codebase/*`
- User prompts (AskUserQuestion) at decision points
- Next-step suggestions printed at end-of-workflow

### Argument Conventions

Loaded from `get-shit-done/references/phase-argument-parsing.md`. Common flags: `--phase N`, `--full`, `--yes`, `--auto`, `--skip-<x>`, `--subsystem <name>`.

## Related

- [[tool-cli]] — every workflow invokes `gsd-tools.cjs init <name>` first, plus many atomic commands
- [[agents]] — workflows spawn agents; agent catalog defines what workflows can orchestrate
- [[templates-references]] — workflows fill templates and `@`-include references
- [[hooks]] — `workflow-guard` advises users to invoke a workflow when editing outside one

## Gaps

See [[_gaps#workflows]] for un-sourced behaviors.
