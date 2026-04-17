---
name: gsd2:agent-spec-phase
description: Generate agent system design contract (AGENT-SPEC.md) for agentic phases
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - AskUserQuestion
  - mcp__context7__*
---
<objective>
Create an agent system design contract (AGENT-SPEC.md) for an agentic phase.
Orchestrates gsd-agent-researcher and gsd-agent-checker.
Flow: Validate -> Research Architecture -> Verify AGENT-SPEC -> Done
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/agent-spec-phase.md
@~/.claude/get-shit-done/references/AGENTIC-PATTERNS.md
</execution_context>

<context>
Phase number: $ARGUMENTS -- optional, auto-detects next unplanned phase if omitted.
</context>

<process>
Execute @~/.claude/get-shit-done/workflows/agent-spec-phase.md end-to-end.
Preserve all workflow gates.
</process>
