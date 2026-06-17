---
name: gsd2:triage
description: Triage pending todos and ROADMAP backlog items — assign verdicts and append proposals to the morning inbox. Optionally pass an explicit run-id.
argument-hint: "[run-id]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
<execution_context>
@~/.claude/get-shit-done/workflows/triage.md
</execution_context>

<context>
Run id (optional): $ARGUMENTS
</context>

<process>
Execute the triage workflow from @~/.claude/get-shit-done/workflows/triage.md end-to-end: resolve the run context, gather pending todos and ROADMAP backlog items, assign one of six verdicts per item with concrete evidence, append proposals to the mailbox, and print a summary. Never modify todo files or ROADMAP.md — propose only.
</process>
