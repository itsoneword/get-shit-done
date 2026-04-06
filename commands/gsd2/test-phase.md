---
name: gsd2:test-phase
description: Generate verification contract (TEST-SPEC.md) before planning a phase
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
Create a verification contract (TEST-SPEC.md) for a phase.
Spawns gsd-test-designer which infers scenarios from REQUIREMENTS / CONTEXT / RESEARCH and presents a behavior-level digest for approval.
Flow: Validate → Design Tests → Done
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/test-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase number: $ARGUMENTS — optional, auto-detects next unplanned phase if omitted.
</context>

<process>
Execute @~/.claude/get-shit-done/workflows/test-phase.md end-to-end.
Preserve all workflow gates.
</process>
