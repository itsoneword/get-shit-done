---
name: gsd2:overnight
description: Run remaining phases unattended overnight — worktree-isolated, ledger + escalation + mailbox active, morning report at the end
argument-hint: "[--from N] [--run-id <id>]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
---

<objective>
Run all remaining milestone phases unattended. A health check gates every launch — the ESC-03 calibration file (`11-CALIBRATION.md`) must contain the uppercase PASS token before any phase runs; the check is case-sensitive (lowercase "pass" in the template does not satisfy it). On success, the runner initializes `.planning/run/{run-id}/` (run.log, RUN-META.json, DECISIONS.jsonl, MAILBOX.jsonl), executes each remaining phase sequentially via the autonomous loop with the full v1.6 harness active (ledger + escalation + mailbox + parking), and produces a morning report at the end.

Review results and answer parked questions with `/gsd2:inbox`.

Must run at orchestrator level — never as a spawned subagent (subagents lack Skill grants).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/overnight.md
</execution_context>

<context>
`$ARGUMENTS` may contain:

- `--from N` — start from phase N (skip phases whose number < N)
- `--run-id <id>` — override the auto-generated run-id (default: `overnight-YYYYMMDD-HHMMSS`)
</context>

<process>
Execute the overnight workflow from @~/.claude/get-shit-done/workflows/overnight.md end-to-end.

Preserve all gates: health check fail-closed (ESC-03 calibration + absolute GSD_RUN_LOG), conflict routing (read `clean` field from `--raw` JSON — never trust exit 0), loud auth stop (AUTH_FAILURE + RUN_STOP, no silent retry), skip-to-independent (BLOCKED/SKIPPED sets via depends_on graph).

Must run at orchestrator level — never as a spawned subagent.
</process>
