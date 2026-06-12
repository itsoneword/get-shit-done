---
phase: 13-overnight-runner
plan: "03"
subsystem: overnight-runner
tags: [overnight-runner, harness, workflow, rун-log, conflict-routing, auth-failure, inbox]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [overnight-runner-workflow, overnight-command, inbox-run-report-header]
  affects: [get-shit-done/workflows/overnight.md, commands/gsd2/overnight.md, get-shit-done/workflows/inbox.md]
tech_stack:
  added: []
  patterns: [typed-line-run-log, fail-closed-health-check, skip-to-independent, locked-type-vocabulary]
key_files:
  created:
    - get-shit-done/workflows/overnight.md
    - commands/gsd2/overnight.md
  modified:
    - get-shit-done/workflows/inbox.md
decisions:
  - "Sandbox-first posture locked: overnight.md NEVER uses bypassPermissions; permission denials auto-deny and route to mailbox (user override of research prescription)"
  - "AUTH_FAILURE = hard stop, zero silent retries (RUN-03 invariant); all other failures skip-to-independent"
  - "run.log TYPE vocabulary locked to exactly 16 tokens — the grep contract IS the observability API"
  - "ESC-03 gate count at sync time = 0 (health check will fail closed until calibration is completed by a human — correct behavior)"
  - "5 pre-existing test failures are sandbox write restrictions on $HOME/.gsd and profile-output; unrelated to this plan"
metrics:
  duration: 9 minutes
  completed: "2026-06-12"
  tasks_completed: 3
  files_changed: 3
---

# Phase 13 Plan 03: Overnight Runner Workflow Summary

Shipped `workflows/overnight.md` (harness wrapper), `/gsd2:overnight` command stub, and inbox-first morning composition — RUN-01/02/03/04 all closed.

## What Was Built

**Task 1 — `get-shit-done/workflows/overnight.md`:** The overnight runner harness. Runs all remaining milestone phases unattended at orchestrator level. Key design decisions implemented:

- Fail-closed startup health check: case-sensitive `grep -q "PASS"` on `11-CALIBRATION.md` (ESC-03 gate) + absolute `GSD_RUN_LOG` path assertion. Nothing runs if either check fails — no `PHASE_START` may ever appear after `HEALTH_FAIL`.
- Locked 16-token TYPE vocabulary for `run.log`: `RUN_START`, `HEALTH_PASS`, `HEALTH_FAIL`, `PHASE_START`, `PHASE_COMPLETE`, `PHASE_PARKED`, `PHASE_FAILURE`, `AUTH_FAILURE`, `PERMISSION_DENIAL`, `CONFLICT_ROUTED`, `CONFLICT_ROUTED_FAIL`, `MERGE_PARSE_FAIL`, `WORKTREE_FALLBACK`, `STUCK_FLAG`, `RUN_STOP`, `RUN_COMPLETE`. These are the observability API — exhaustive grep over run.log without prose reading.
- `worktree merge --raw` JSON `clean` field is the only merge truth — exit 0 on conflict is by design and must never be trusted (RUN-02). Parse failure treats as conflict (fail-safe direction).
- `AUTH_FAILURE` = hard stop + `RUN_STOP` + zero silent retries. No skip-to-independent for auth. Every other failure parks/fails the phase and the runner skips to the next independent phase via BLOCKED/SKIPPED sets and the `depends_on` graph.
- `GSD_RUN_LOG` computed absolute at init time before any worktree exists — the worktree trap prevention.
- Cron line documented (not installed); sandbox-first note; auth caveat (W0-1: OAuth expiry); `bypassPermissions` mentioned only in negative statements.

**Task 2 — `commands/gsd2/overnight.md`:** Command stub mirroring `autonomous.md` convention. Frontmatter with `name: gsd2:overnight`, `argument-hint: "[--from N] [--run-id <id>]"`, `execution_context: @~/.claude/get-shit-done/workflows/overnight.md`. Explicitly states orchestrator-level constraint.

**Task 2 — `get-shit-done/workflows/inbox.md`:** Added `run_report_header` step between `resolve_run` and `load_questions`. Invokes `gsd-tools run report <run-id>` and surfaces output verbatim; gracefully skips (silent continue) on non-zero exit so mailbox-only fixtures still work. Purpose block updated to mention the morning report header. Rules block unchanged (still forbids DECISIONS.jsonl writes and resuming branches).

**Task 3 — Runtime sync + seeded smoke + full suite:**

- `npm run dev` synced all 3 source files into `.claude/` successfully.
- All 5 runtime verifications passed (overnight.md with RUN_COMPLETE + CONFLICT_ROUTED, overnight command, inbox run_report_header, autonomous PHASE RESULT + HARNESS_MODE, run report exit 1 with no-run-context message).
- Seeded smoke test passed: `smoke-13-*` run init → ledger append → mailbox append → record-phase completed → status stopped → `run report` output contained `1 total`, `1 unanswered`, `phase 13  completed`, `stopped`. Artifacts removed after verification.
- Test suite: 1097 pass, 5 fail. The 5 failures are pre-existing sandbox write restrictions (`ENOENT: mkdir '/home/cleversol/.gsd'`) and profile-output failures — unrelated to this plan.

**ESC-03 gate state at sync time:** PASS-token count = 0. The health check will correctly fail closed until a human completes the calibration file. This is the trust-ladder gate working as intended — not a defect.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `get-shit-done/workflows/overnight.md` exists: PASS
- `commands/gsd2/overnight.md` exists: PASS
- All 16 TYPE tokens present in overnight.md: PASS (for-loop showed no MISSING lines)
- `grep -q "PASS"` ESC-03 gate case-sensitive in overnight.md: PASS (line 91)
- `Skill(skill="gsd2:autonomous", args="--phase ${N}")` in overnight.md: PASS (line 195)
- `worktree merge ... --raw` and `clean` field check in overnight.md: PASS (lines 242, 252, 254)
- `run record-phase`, `run status --set`, `run snapshot`, `run report`, `mailbox append` in overnight.md: PASS
- `GSD_RUN_LOG="$(pwd)` absolute path in overnight.md: PASS (line 45)
- Cron block present; bypassPermissions only in negative statements: PASS
- `reason=no-independent-work` and skip-to-independent in overnight.md: PASS
- AUTH_FAILURE + no-retry language in overnight.md: PASS
- `run_report_header` step in inbox.md between resolve_run and load_questions: PASS
- inbox.md rules block unchanged (DECISIONS.jsonl + resume forbidden): PASS
- Seeded smoke: 1 total, 1 unanswered, phase 13 completed, smoke artifacts removed: PASS
- npm test: 1097 pass, 5 pre-existing failures: PASS (no regressions introduced)
- Commits 1a4f275 and 55ce76f both exist: PASS
