---
name: gsd2:discuss-loop
description: Judge an artifact through Skeptic / User-Advocate / Architect lenses. Up to 3 rounds of parallel fresh-context judgment — converge with a verifiable constraint delta, or escalate the top divergent positions (autonomous runs write the mailbox; interactive sessions present them in-session). Never a synthesized average.
argument-hint: "<artifact-path | --decision dec-NNN> [--question <text>] [--run-id <id>] [--auto]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Task
  - Write
  - Edit
  - AskUserQuestion
---
<execution_context>
@~/.claude/get-shit-done/workflows/discuss-loop.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the discuss-loop workflow from @~/.claude/get-shit-done/workflows/discuss-loop.md end-to-end: resolve the artifact, run up to 3 rounds of three parallel lens spawns, validate position blocks and diff constraint sets via gsd-tools discuss-loop, then converge (verdict; ledger in run context; escalation-contract-gated application if the verdict modifies a committed artifact) or escalate divergent positions (mailbox only when --auto and GSD_RUN_ID are both present; otherwise present in-session). Write every step to the loop transcript.
</process>
