---
status: partial
phase: 11-escalation-contract-discuss-phase-wiring
source: [11-VERIFICATION.md]
started: 2026-06-11T00:00:00Z
updated: 2026-06-11T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live run + ledger review + CALIBRATION.md sign-off

Run one full /gsd2:discuss-phase under GSD_RUN_ID, then read the populated ledger with `gsd-tools ledger list <run-id>` and confirm every entry has escalation_verdict and escalation_reason populated correctly. Fill in the scoring table in 11-CALIBRATION.md and replace PENDING with PASS if thresholds are met.

expected: Ledger entries show correct verdicts; hard criteria (irreversibility, security) have zero misses; soft misses landing in plain proceed are <= 1; false parks <= 3/10. CALIBRATION.md Outcome field updated to PASS.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
