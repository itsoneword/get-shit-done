---
phase: 10-decision-ledger-cli-foundation
plan: 02
subsystem: cli
tags: [jsonl, mailbox, q-NNN, run-context, gsd-tools]

# Dependency graph
requires:
  - phase: 10-01
    provides: run init layout (.planning/run/<run-id>/ with MAILBOX.jsonl), ledger dispatch pattern, helpers.cjs env forwarding

provides:
  - lib/mailbox.cjs: append-only question mailbox with q-NNN id allocation, question-field validation, GSD_RUN_ID gate
  - gsd-tools mailbox append: write one validated JSONL record to MAILBOX.jsonl
  - gsd-tools mailbox list: read all/filtered records by status
  - tests/mailbox.test.cjs: 10 unit tests covering append (schema + gate + validation) and list (status filter)

affects: [phase-12-inbox-review, phase-13-overnight-runner, LEDGER-01, LEDGER-02, LEDGER-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Append-only JSONL per-run file (same as DECISIONS.jsonl — shared substrate)
    - q-NNN monotonic id (regex /^q-(\d+)$/, padStart(3,'0'))
    - Run-context gate reused from ledger.cjs (effectiveRunId = arg || GSD_RUN_ID)
    - Required-field check before appendFileSync (fail loud, never silent write)
    - Object.assign pattern: defaults < caller-input < forced auto-fills (id, ts, run_id)

key-files:
  created:
    - get-shit-done/bin/lib/mailbox.cjs
    - tests/mailbox.test.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs

key-decisions:
  - "Append-only: no writeMailbox or cmdUpdate export; Phase 12 will answer via separate mechanism"
  - "question is the only required field at write time; all others default to null or 'open'"
  - "Object.assign merge order ensures run_id is always forced to effectiveRunId (caller cannot override)"
  - "status defaults to 'open' but caller can override via the input blob (first source in assign chain)"

patterns-established:
  - "mailbox.cjs mirrors ledger.cjs exactly: path helpers, readX, filterX, nextXId, formatTable, cmdX handlers"
  - "TDD: RED commit (test-only) followed by GREEN commit (implementation) within same plan"

requirements-completed: [LEDGER-01, LEDGER-02, LEDGER-03]

# Metrics
duration: 8min
completed: 2026-06-11
---

# Phase 10 Plan 02: Mailbox Write/Read Primitives Summary

**Append-only MAILBOX.jsonl per run: q-NNN ids, question-field validation, GSD_RUN_ID gate, status-filter list — wired as `gsd-tools mailbox append/list`**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-11T18:34:10Z
- **Completed:** 2026-06-11T18:40:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- `lib/mailbox.cjs` ships append-only JSONL write with q-NNN monotonic ids, question-field validation before write, and GSD_RUN_ID + run-dir-existence gate
- `gsd-tools mailbox list` returns all records or the `--status open` subset in raw/table mode
- 10 unit tests cover all paths: valid append, schema checks, run-context gate (no-env, uninitialized, env-fallback), and list+filter
- Full test suite: 983 tests, 0 failures — no regressions in ledger/run dispatch from 10-01

## Task Commits

1. **Task 1: Write RED tests for mailbox.cjs** - `6ae98d8` (test)
2. **Task 2: Implement mailbox.cjs and wire mailbox dispatch (GREEN)** - `0d67b24` (feat)

## Files Created/Modified
- `get-shit-done/bin/lib/mailbox.cjs` - Append-only mailbox module: mailboxPath, runDir, readMailbox, filterMailbox, nextQId, formatTable, cmdMailboxAppend, cmdMailboxList
- `tests/mailbox.test.cjs` - 10 tests: append schema, missing-question validation, run-context gate (3 cases), list all/status-filter
- `get-shit-done/bin/gsd-tools.cjs` - Added `require('./lib/mailbox.cjs')` and `case 'mailbox'` dispatch block before `case 'run'`

## Decisions Made
- Append-only: no writeMailbox or patch export — the audit guarantee is structural, not policy
- `question` is the sole required field; all others (phase, decision_id, context, options, evidence, answer, answered_ts) default to null; status defaults to 'open' but caller may override via input blob
- Object.assign merge order (`defaults < input < {id,ts,run_id}`) forces run_id to effectiveRunId regardless of what caller passes

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Mailbox primitives complete and tested; Phase 12 (inbox review / answer flow) can consume `readMailbox`/`filterMailbox` directly
- Phase 10 fully complete: both plans (10-01 ledger, 10-02 mailbox) shipped and tested
- No blockers for Phase 11

---
*Phase: 10-decision-ledger-cli-foundation*
*Completed: 2026-06-11*
