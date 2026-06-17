---
phase: 15-resume-logic-backlog-triage-worker
plan: 02
subsystem: agentic-workflow
tags: [autonomous, resume, park, mailbox, ledger, harness-mode]

# Dependency graph
requires:
  - phase: 12-park-don-t-block-mailbox
    provides: park snapshot contract, staleness primitive, mailbox answered status
  - phase: 13-overnight-runner
    provides: autonomous.md harness mode, PHASE RESULT contract, GSD_RUN_ID gate
  - phase: 10-decision-ledger-cli-foundation
    provides: ledger append, ledger list, write-once audit invariant

provides:
  - Resume branch (step 3a.0) inside autonomous.md execute_phase
  - Guard clause fires only when HARNESS_MODE=true AND snapshot exists
  - Staleness gate (park staleness --raw) gates replay before any write
  - Idempotency check (EXISTING_SUPER) prevents duplicate ledger entries on re-run
  - CONTEXT.md write-before-ledger strict ordering enforced
  - Drift re-park with status:pending on changed/missing planning files
  - Three failure paths: staleness-parse-error, context-write-error, ledger-write-error
  - Interactive path (no HARNESS_MODE) byte-equivalent — step 3a.0 does not fire

affects:
  - 15-03 (triage worker — uses same autonomous.md phase loop)
  - overnight.md (inherits autonomous.md phase loop)
  - Any executor re-running a parked phase with --phase N

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Guard-clause resume detection at top of execute_phase (before smart_discuss)
    - Strict CONTEXT.md write → ledger append → replay ordering
    - Idempotency via ledger supersedes scan before any write
    - Drift re-park uses status:pending mailbox entry (Phase 14-03 lesson)

key-files:
  created: []
  modified:
    - get-shit-done/workflows/autonomous.md

key-decisions:
  - "Resume detection fires at step 3a.0 — before the has_context check and smart_discuss — so it short-circuits to replay rather than re-running discuss from scratch"
  - "HARNESS_MODE guard makes step 3a.0 a no-op in interactive sessions — byte-equivalent contract preserved"
  - "Idempotency check (EXISTING_SUPER) runs BEFORE any write — prevents duplicate ledger entries when a prior attempt partially succeeded"
  - "CONTEXT.md write happens strictly before ledger append — replay step always finds the locked decision"
  - "Staleness parse error treated as drift (fail-safe) — log PHASE_FAILURE, no CONTEXT.md write, no ledger append"

patterns-established:
  - "Resume-gate pattern: snapshot check → mailbox status check → staleness gate → idempotency check → write sequence"
  - "Failure path uses run.log PHASE_FAILURE TYPE token with kebab-case reason= suffix"
  - "Re-park mailbox entry must explicitly carry status:pending — cmdMailboxAppend defaults to open"

requirements-completed: [PARK-03]

# Metrics
duration: 5min
completed: 2026-06-17
---

# Phase 15 Plan 02: Resume Logic — autonomous.md step 3a.0 Summary

**Resume branch (step 3a.0) inserted into autonomous.md execute_phase: HARNESS_MODE-only guard reads parked snapshot, runs staleness gate, and either re-parks on drift or writes CONTEXT.md + ledger superseding record + replays blocked step — five outcome paths, idempotency-safe**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-17T19:24:41Z
- **Completed:** 2026-06-17T19:29:02Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Inserted step 3a.0 Resume Detection guard clause between the progress banner and existing step 3a (Smart Discuss) — line 126 vs line 290
- All five resume outcomes implemented: answered+clean=replay, answered+drift=re-park, staleness-parse-error=failed, context-write-error=failed, ledger-write-error=failed
- Idempotency check (EXISTING_SUPER) gates both CONTEXT.md write and ledger append — safe on re-run after partial success
- Interactive path (HARNESS_MODE absent) confirmed byte-equivalent — step 3a.0 does not fire

## Task Commits

1. **Task 1: Insert step 3a.0 resume branch into autonomous.md execute_phase** - `8ff325d` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `get-shit-done/workflows/autonomous.md` — 164 lines inserted: step 3a.0 guard clause + steps R1/R2/R3/R4 with full failure-path prose

## Decisions Made

- Resume detection is a guard clause at the top of `execute_phase`, not a filter in `discover_phases` — `discover_phases` lacks the runtime mailbox state; the check belongs where `GSD_RUN_ID` and `PHASE_NUM` are both in scope
- Staleness parse error treated as implicit drift (fail-safe) — log `PHASE_FAILURE reason=staleness-parse-error`, emit `PHASE RESULT: failed`, no writes
- CONTEXT.md write path uses `context_path` field read from the snapshot — the snapshot already carries this per Phase 12 contract
- Drift re-park mailbox entry carries `"status":"pending"` explicitly — cmdMailboxAppend defaults to `"open"` (Phase 14-03 lesson)
- PHASE RESULT lines use machine-greppable format `^PHASE RESULT: (completed|parked|failed) phase=` — matches overnight.md outcome contract

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing test failures (7 tests: brave-search key detection, defaults.json merging, config-ensure-section, write-profile, generate-dev-preferences) were unrelated to this workflow prose edit and existed before this plan. No new failures introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Resume branch is wired and ready for 15-03 (triage worker) which also edits autonomous.md (overnight.md triage step)
- 15-03 should add the triage step to overnight.md without conflicting with the 3a.0 block added here
- `npm test` passes with no new failures (7 pre-existing failures unrelated to this change)

## Self-Check: PASSED

- [x] `get-shit-done/workflows/autonomous.md` exists and was modified
- [x] Commit `8ff325d` exists: `git log --oneline | grep 8ff325d`
- [x] `grep -q "3a.0 Resume Detection" get-shit-done/workflows/autonomous.md` exits 0
- [x] `grep -q "3a. Smart Discuss" get-shit-done/workflows/autonomous.md` exits 0 (existing step intact)
- [x] `grep -q "HARNESS_MODE is not true" get-shit-done/workflows/autonomous.md` exits 0
- [x] `grep -q "staleness-parse-error" get-shit-done/workflows/autonomous.md` exits 0
- [x] `grep -q "context-write-error" get-shit-done/workflows/autonomous.md` exits 0
- [x] `grep -q "ledger-write-error" get-shit-done/workflows/autonomous.md` exits 0
- [x] `grep -q "EXISTING_SUPER" get-shit-done/workflows/autonomous.md` exits 0
- [x] `grep -q "state moved since park" get-shit-done/workflows/autonomous.md` exits 0
- [x] `grep -q "Resume Decision" get-shit-done/workflows/autonomous.md` exits 0
- [x] 3a.0 line (126) is lower than "3a. Smart Discuss" line (290)
- [x] `npm test` passes with no new failures

---
*Phase: 15-resume-logic-backlog-triage-worker*
*Completed: 2026-06-17*
