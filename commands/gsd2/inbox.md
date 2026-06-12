---
name: gsd2:inbox
description: Morning inbox — review and answer all parked harness questions in one session. Presents context, evidence, and staleness inline; records answers; prints resume handoffs.
argument-hint: "[run-id]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<execution_context>
@~/.claude/get-shit-done/workflows/inbox.md
</execution_context>

<context>
Run id (optional): $ARGUMENTS
</context>

<process>
Execute the inbox workflow from @~/.claude/get-shit-done/workflows/inbox.md end-to-end: resolve the run, present every unanswered parked question with full context and staleness, discuss each with the user, record answers via gsd-tools mailbox answer, and print per-phase resume handoffs. Never resume, replan, or execute parked branches — handoffs are printed only.
</process>
