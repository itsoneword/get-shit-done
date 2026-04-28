---
name: gsd2:quick
description: Execute a quick ad-hoc task with GSD guarantees (atomic commit, STATE.md tracking)
argument-hint: "[--clarify] [--full] <description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Execute small, ad-hoc tasks with GSD guarantees: atomic commit, STATE.md tracking, separate from planned phases.

Pipeline: gsd-planner (quick mode) → gsd-executor → STATE.md update → commit.
Tasks live in `.planning/quick/` and never touch ROADMAP.md.

**Default flow** — Claude proposes a one-paragraph approach + file list before planning. You confirm, redirect, or push back. One round-trip, no ceremony.

**`--clarify`** — Claude asks 2–3 targeted questions about the things it is uncertain about (not all gray areas), then plans. Use when the task has real ambiguity.

**`--full`** — Adds plan-checker (max 2 iterations) + post-execution verifier. Use when you want quality guarantees without milestone ceremony.

Flags compose: `--clarify --full` gives questions + plan-check + verification.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/quick.md
</execution_context>

<context>
$ARGUMENTS

Context files are resolved inside the workflow (`init quick`) and delegated via `<files_to_read>` blocks.
</context>

<process>
Execute the quick workflow from @~/.claude/get-shit-done/workflows/quick.md end-to-end.
Preserve all workflow gates (validation, suggest preview, planning, execution, state updates, commits).
</process>
