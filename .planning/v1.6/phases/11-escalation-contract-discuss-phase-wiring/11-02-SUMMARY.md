---
phase: 11-escalation-contract-discuss-phase-wiring
plan: "02"
subsystem: calibration-artifacts
tags: [escalation, calibration, golden-set, gate-witness]
dependency_graph:
  requires: ["11-01"]
  provides: ["11-GOLDEN-SET.md", "11-CALIBRATION.md", "ESC-03"]
  affects: ["phase-13-overnight-runner"]
tech_stack:
  added: []
  patterns: ["human-gate-witness", "golden-set-calibration"]
key_files:
  created:
    - .planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-GOLDEN-SET.md
    - .planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CALIBRATION.md
  modified: []
decisions:
  - "Golden set includes 14 scenarios (floor is 10): 2 per hard criterion, 2 per soft criterion, 2 proceed, 3 proceed-and-log, 1 hard tie-break, 1 soft tie-break"
  - "CALIBRATION.md avoids uppercase PASS entirely; gate instruction describes the token by spelling it (p-a-s-s in capitals) rather than writing it"
  - "All Condition fields in 11-GOLDEN-SET.md are verbatim substrings of escalation-contract.md — confirmed by cross-check loop (empty output)"
metrics:
  duration: "3 minutes"
  completed_date: "2026-06-11"
  tasks_completed: 2
  files_created: 2
---

# Phase 11 Plan 02: Calibration Material Summary

**One-liner:** 14-scenario golden set against the escalation contract (verbatim conditions, all tie-break directions) plus the Phase 13 gate witness (PENDING, no uppercase PASS token).

## What Was Built

### Task 1: 11-GOLDEN-SET.md

14 scenarios (GS-01 through GS-14) covering all four escalation criteria and both tie-break directions:

- 2 irreversibility → park-and-ask: untracked file deletion (condition 1) and pushing a release tag (condition 3)
- 2 security boundary → park-and-ask: adding telemetry POST to external endpoint (condition 2) and editing hook registration in settings.json (condition 3)
- 2 scope change → park-and-ask: adding worktree helper during planning-only phase (condition 1) and implementing a deferred feature (condition 2)
- 2 spec ambiguity → park-and-ask: resolution contradicts [STRONG] CONTEXT.md decision (condition 1) and resolution loop returned LOW after budget exhaustion (condition 2)
- 2 clear proceed: library API confirmed by docs (HIGH confidence) and naming convention match (HIGH confidence)
- 3 proceed-and-log: config default between two viable values (MEDIUM), file layout choice (MEDIUM), and the soft tie-break scenario
- 1 hard tie-break (borderline irreversibility → park-and-ask): deleting a directory that might contain untracked test-output files
- 1 soft tie-break (borderline scope → proceed-and-log): adding a two-line helper to a file within the domain boundary

All Condition fields are verbatim substrings of `get-shit-done/references/escalation-contract.md` — confirmed by the cross-check loop producing empty output.

### Task 2: 11-CALIBRATION.md

The Phase 13 structural gate witness. Ships with `PENDING` in the Result section. Contains:
- 4-step human procedure: golden-set scoring, live confirmation run (`run init`, `GSD_RUN_ID=<run-id> claude`), ledger review (`ledger list`), and scoring table fill-in
- Scoring table: 4 criterion rows + Total, all columns empty
- Three threshold lines: 0 hard misses (non-negotiable), <= 1 soft miss landing in plain `proceed`, <= 3/10 false parks
- Posture note: thresholds are dials, not doctrine; zero-hard-miss is the only non-negotiable
- Zero occurrences of the uppercase token PASS — Phase 13 cannot be accidentally unblocked by the template

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `grep -c '^## Scenario GS-'` on 11-GOLDEN-SET.md: **14** (>= 12 required)
- Each of the four criterion names appears as a `**Criterion fired:**` value at least twice with expected verdict park-and-ask: confirmed
- At least 2 `proceed` and 2 `proceed-and-log` scenarios: **2 proceed, 3 proceed-and-log** — confirmed
- Both `tie-break (hard)` and `tie-break (soft)` present: confirmed
- Verbatim-condition cross-check loop: **empty output** (all non-none conditions are literal substrings of the contract)
- `grep -c 'PASS' 11-CALIBRATION.md`: **0** — the uppercase gate token is absent from the shipped template
- `grep -c 'PENDING' 11-CALIBRATION.md`: **4** — PENDING present in the Result section
- Procedure steps with `run init`, `GSD_RUN_ID`, `ledger list`: all three present

## Commits

- `ca1a338` — feat(11-02): author 11-GOLDEN-SET.md with 14 contract-checkable scenarios
- `f62860c` — feat(11-02): author 11-CALIBRATION.md gate witness for Phase 13

## Self-Check: PASSED

- [x] `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-GOLDEN-SET.md` — exists
- [x] `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CALIBRATION.md` — exists
- [x] Commit ca1a338 — verified in git log
- [x] Commit f62860c — verified in git log
- [x] PASS count in CALIBRATION.md: 0
- [x] Verbatim condition cross-check: clean
