---
phase: 12-park-don-t-block-mailbox
plan: "01"
subsystem: cli
tags: [park, snapshot, staleness, stuck-detection, sha256, DECISIONS.jsonl, RUN-META.json]

# Dependency graph
requires:
  - phase: 10-decision-ledger-cli-foundation
    provides: ledger.cjs cmdRunInit (run dir layout, RUN-META.json, parked/), mailbox.cjs pattern
  - phase: 11-escalation-contract-discuss-phase-wiring
    provides: park-and-ask verdict tier that triggers park create
provides:
  - get-shit-done/bin/lib/park.cjs (parking/staleness/stuck primitives)
  - park create CLI — writes parked/phase-{N}.json with question_id, blocked_at, resume_instruction, content hashes, git HEAD
  - park staleness CLI — re-hashes STATE.md/ROADMAP.md/cross-phase-notes.md/CONTEXT.md and reports changed/unchanged/missing + git range
  - run snapshot CLI — records decisions hash at phase boundary, detects stuck (2 consecutive identical hashes)
  - ledger list stuck header — STUCK FLAG prefix in non-raw mode when RUN-META.json has stuck=true
affects:
  - 12-02 (mailbox review/answer — calls park staleness for staleness diff)
  - 12-03 (inbox skill — consumes park staleness output)
  - 13 (overnight runner — calls run snapshot at phase boundaries)
  - 15 (autonomous.md replay — reads parked/phase-{N}.json for resume)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure functions exported for tests, cmd* handlers for process I/O, thin dispatch in gsd-tools.cjs (Phase 10 pattern)"
    - "SHA-256 via node:crypto for content hashing — zero new npm dependencies"
    - "STUCK FLAG header in non-raw branch only — raw output stays machine-parseable JSONL"
    - "resolveGitHead try/catches to null — pure functions never run git (Pitfall 4)"
    - "Boundary hashes recorded at phase COMPLETION — identical hashes mean a phase completed without growing the ledger (Pitfall 5)"

key-files:
  created:
    - get-shit-done/bin/lib/park.cjs
    - tests/park.test.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs (park create/staleness + run snapshot dispatch)
    - get-shit-done/bin/lib/ledger.cjs (stuck header in cmdLedgerList)

key-decisions:
  - "park.cjs never rewrites MAILBOX.jsonl — only writes parked/phase-{N}.json and RUN-META.json"
  - "isStuck threshold is exactly 2 consecutive identical non-null decisions_hash values (locked by 12-CONTEXT.md)"
  - "run.log gets two entries when stuck: snapshot line + STUCK narrative line"
  - "STUCK FLAG header suppressed in --raw mode to keep raw output machine-parseable"
  - "checkStaleness is a pure function — git_range computed from snapshot.git_head field, never runs git"

patterns-established:
  - "park.cjs follows ledger/mailbox module pattern exactly: path helpers, pure functions, cmd* handlers"
  - "run-context gate: resolve effectiveRunId from arg or GSD_RUN_ID; exit 1 with informative stderr if absent"
  - "appendPhaseSnapshot always sets meta.stuck boolean so downstream readers never need to re-derive it"

requirements-completed: [PARK-01, PARK-03, PARK-04]

# Metrics
duration: 11min
completed: 2026-06-12
---

# Phase 12 Plan 01: Park Primitives Summary

**SHA-256 content-hash-based park/staleness/stuck primitives as `lib/park.cjs` with `park create`, `park staleness`, `run snapshot` CLI surface and ledger list STUCK FLAG header**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-12T08:02:33Z
- **Completed:** 2026-06-12T08:13:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `park.cjs` delivers all 9 pure functions (hashContent, hashFile, buildContentHashes, buildParkSnapshot, checkStaleness, decisionsHash, isStuck, appendPhaseSnapshot, resolveGitHead) and 3 cmd handlers (cmdParkCreate, cmdParkStaleness, cmdRunSnapshot)
- CLI surface wired in gsd-tools.cjs: `park create`, `park staleness`, `run snapshot` — all run-context gated with informative exit 1 messages
- Stuck detection: two consecutive identical DECISIONS.jsonl hashes set `meta.stuck=true`, append a STUCK line to run.log, and surface a STUCK FLAG header in `ledger list` (non-raw only)
- 50 TDD tests cover pure functions, all CLI happy paths, error cases, env fallback, and raw vs human-readable output

## Task Commits

1. **Task 1: Write failing tests (RED)** - `4cd82c2` (test)
2. **Task 2: Implement park.cjs + dispatch + ledger stuck header (GREEN)** - `3e06b1d` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/park.cjs` — parking/staleness/stuck primitives module
- `tests/park.test.cjs` — 50 TDD tests (RED then GREEN)
- `get-shit-done/bin/gsd-tools.cjs` — added `park` case + `run snapshot` sub-case + `park = require('./lib/park.cjs')`
- `get-shit-done/bin/lib/ledger.cjs` — STUCK FLAG header in `cmdLedgerList` non-raw branch

## Decisions Made

- `park.cjs` never touches MAILBOX.jsonl — only `parked/phase-{N}.json` and `RUN-META.json` (invariant documented in module header)
- `checkStaleness` is a pure function that never runs git; `git_range` is computed from `snapshot.git_head` field only
- STUCK FLAG header emitted before the table in non-raw mode only, keeping raw output machine-parseable JSONL
- `run snapshot` output ordering: STUCK line (if stuck) printed before the always-present "snapshot recorded" line

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PARK-01 (snapshot half), PARK-03 (staleness substrate), and PARK-04 (stuck detection) are complete
- Phase 12-02 (mailbox review/answer) can read parked snapshots and call `park staleness` for staleness diffs
- Phase 12-03 (inbox skill) can present staleness output inline from `park staleness --raw`
- Phase 13 (overnight runner) can call `run snapshot` at phase boundaries for stuck detection
- Phase 15 (autonomous.md replay) can read `parked/phase-{N}.json` for resume context

---
*Phase: 12-park-don-t-block-mailbox*
*Completed: 2026-06-12*
