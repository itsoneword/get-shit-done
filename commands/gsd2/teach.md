---
name: gsd2:teach
description: Teach GSD from a real failure. Proposes a bounded edit to the responsible artifact after human ratification.
argument-hint: "<failure description> | scan"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---
<execution_context>
@~/.claude/get-shit-done/workflows/teach.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the teach workflow from @~/.claude/get-shit-done/workflows/teach.md end-to-end.
When $ARGUMENTS is "scan", run the auto-miner nominations report only (no edit proposed).
</process>
