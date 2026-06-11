---
phase: 10-decision-ledger-cli-foundation
plan: 01
subsystem: tooling
tags: [jsonl, ledger, append-only, cli, tdd]

requires: []

provides:
  - get-shit-done/bin/lib/ledger.cjs — append-only decision ledger library with write-time schema validation and GSD_RUN_ID gate
  - gsd-tools ledger append/list/filter subcommands
  - gsd-tools run init subcommand
  - .planning/run/<run-id>/ layout (DECISIONS.jsonl, MAILBOX.jsonl, RUN-META.json, parked/)
  - .gitignore entry for .planning/run/

affects: [10-02, phase-11-escalation-evaluator, phase-12-mailbox-review, phase-13-overnight-runner]

tech-stack:
  added: []
  patterns:
    - "Append-only JSONL ledger: appendFileSync only, never writeFileSync for DECISIONS.jsonl"
    - "Write-time schema validation: required fields checked via `in` before any I/O (escalated:null passes)"
    - "Run-context gate: effectiveRunId = explicit arg || GSD_RUN_ID; both missing = exit 1 loud"
    - "TDD RED/GREEN: tests written first, fail confirmed, then implementation"

key-files:
  created:
    - get-shit-done/bin/lib/ledger.cjs
    - tests/ledger.test.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - tests/helpers.cjs
    - .gitignore

key-decisions:
  - "Append-only ledger: no writeLedger/cmdUpdate/patch exports — audit guarantee requires immutable JSONL"
  - "Required-field validation uses `in` operator so escalated:null passes (field present, value nullable)"
  - "Run-context gate enforces GSD_RUN_ID or explicit arg; interactive sessions always hit exit 1 (never silent write)"
  - "helpers.cjs runGsdTools extended with optional third opts.env parameter for GSD_RUN_ID env injection in tests"

patterns-established:
  - "ledger cmd handlers (cmdRunInit, cmdLedgerAppend, cmdLedgerList) do process I/O and exit; pure functions (readLedger, filterLedger, nextDecId) never call process.exit"
  - "filterLedger --escalated uses strict === true (excludes null and false)"

requirements-completed: [LEDGER-01, LEDGER-02, LEDGER-03]

duration: 4min
completed: 2026-06-11
---

# Phase 10 Plan 01: Decision Ledger CLI Foundation Summary

**Append-only DECISIONS.jsonl ledger with `dec-NNN` ids, write-time required-field validation, and GSD_RUN_ID run-context gate, wired as `gsd-tools ledger` and `gsd-tools run` subcommands**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-11T18:27:18Z
- **Completed:** 2026-06-11T18:31:24Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 5

## Accomplishments

- Decision ledger library `lib/ledger.cjs` with append-only writes, write-time REQUIRED_FIELDS validation, and GSD_RUN_ID gate
- `gsd-tools run init <run-id>` creates the full run layout (DECISIONS.jsonl, MAILBOX.jsonl, RUN-META.json, parked/)
- `gsd-tools ledger append/list/filter` subcommands with --phase, --escalated, --raw flags
- 14 new unit tests covering all LEDGER-01/02/03 behaviors; full suite 973 tests pass (0 regressions from 959)

## Task Commits

1. **Task 1: RED tests for ledger.cjs and run init** - `d81f2b6` (test)
2. **Task 2: Implement ledger.cjs and wire dispatch (GREEN)** - `2e67022` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/ledger.cjs` — append-only JSONL ledger library (REQUIRED_FIELDS, runDir, ledgerPath, readLedger, filterLedger, nextDecId, formatTable, cmdRunInit, cmdLedgerAppend, cmdLedgerList)
- `tests/ledger.test.cjs` — 14 unit tests covering LEDGER-01/02/03 behaviors
- `get-shit-done/bin/gsd-tools.cjs` — added `require('./lib/ledger.cjs')`, `case 'ledger'`, `case 'run'` dispatch blocks
- `tests/helpers.cjs` — runGsdTools extended with optional third `opts` argument forwarding `env` into child process
- `.gitignore` — added `.planning/run/` entry

## Decisions Made

- Append-only enforced by having no writeLedger/cmdUpdate/patch exports — future supersede is a new append with `supersedes` field
- `in` operator for required-field validation so `escalated: null` passes (field present, value allowed as null when no evaluator ran)
- GSD_RUN_ID gate: both missing run-id arg AND missing env → loud exit 1; interactive sessions never write silently
- helpers.cjs backward-compatible: existing two-arg call sites unchanged since opts defaults to `{}`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ledger.cjs` is the shared persistence layer ready for Phase 11 (escalation evaluator writes `escalation_verdict`/`escalation_reason` via new appends), Phase 12 (mailbox review reads MAILBOX.jsonl from same run dir), and Phase 13 (overnight runner initializes runs via `run init`)
- Plan 10-02 (mailbox.cjs) can proceed in parallel or immediately

---
*Phase: 10-decision-ledger-cli-foundation*
*Completed: 2026-06-11*
