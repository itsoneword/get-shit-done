---
phase: 13-overnight-runner
plan: "02"
subsystem: workflows
tags: [autonomous, overnight-runner, harness-mode, discuss-phase, phase-result]

# Dependency graph
requires:
  - phase: 13-overnight-runner-01
    provides: overnight.md workflow (consumer of the PHASE RESULT contract added here)
  - phase: 12-park-dont-block-mailbox
    provides: discuss-phase --auto park bifurcation; mailbox append CLI
  - phase: 11-escalation-contract-discuss-phase-wiring
    provides: discuss-phase --auto escalation evaluator
provides:
  - autonomous.md SINGLE_PHASE + HARNESS_MODE parse blocks in initialize
  - --phase N single-phase selector with PHASE RESULT outcome contract
  - harness-mode 3a: delegates to discuss-phase --auto (evaluator + park fire)
  - harness-mode 3d: all human pauses replaced by mailbox + failed outcomes
  - harness-mode handle_blocker: never AskUserQuestion; derives PHASE RESULT from blocker
  - adaptive-depth smart_discuss prompt (triage-first, no fixed counts)
  - commands/gsd2/autonomous.md --phase N argument-hint
affects:
  - 13-overnight-runner-03 (overnight.md invokes autonomous --phase N, reads PHASE RESULT)
  - any future caller of /gsd2:autonomous with GSD_RUN_ID set

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HARNESS_MODE gate: if [ -n GSD_RUN_ID ] then HARNESS_MODE=true; all non-interactive branches gated on this variable"
    - "PHASE RESULT contract: final output line machine-greppable via ^PHASE RESULT: (completed|parked|failed) phase="
    - "Single-phase mode exits immediately after phase resolves — never enters lifecycle or iterate"

key-files:
  created: []
  modified:
    - get-shit-done/workflows/autonomous.md
    - commands/gsd2/autonomous.md
    - tests/copilot-install.test.cjs

key-decisions:
  - "HARNESS_MODE branches are additive and gated — interactive behavior is byte-equivalent when GSD_RUN_ID is unset"
  - "PHASE RESULT is the sole outcome contract for the runner; ambiguous output treated as failed per AGENT-SPEC"
  - "Harness 3d human_needed: outcome is completed (not failed) with deferred_verification — mailbox carries it to morning inbox"
  - "Harness gaps_found: one automatic gap-closure attempt; still-failed = reason=gaps_found (fail-safe direction)"
  - "Harness handle_blocker: single-phase emits PHASE RESULT failed; multi-phase skips to independent (same as interactive Skip)"

patterns-established:
  - "Harness-mode gating pattern: prepend HARNESS_MODE branch to every interactive decision point, leave interactive path intact below it"
  - "Outcome contract: prose workflows end the response with a machine-greppable typed line (PHASE RESULT) when invoked in single-phase mode"

requirements-completed: [RUN-01]

# Metrics
duration: 12min
completed: 2026-06-12
---

# Phase 13 Plan 02: Overnight Runner - Autonomous Harness Wiring Summary

**autonomous.md made unattended-capable: --phase N selector, GSD_RUN_ID harness mode, all human pauses replaced by mailbox routing or PHASE RESULT failed, discuss delegates to discuss-phase --auto so park/evaluator machinery fires**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-12T11:32:00Z
- **Completed:** 2026-06-12T11:44:21Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `--phase N` single-phase selector and `GSD_RUN_ID`-based `HARNESS_MODE` detection to the initialize step; single-phase mode never enters lifecycle or iterate, ends with exactly one PHASE RESULT line
- Wired harness-mode 3a to delegate to `discuss-phase --auto` (Phase 11 evaluator + Phase 12 park fire); routes PHASE PARKED, design-contract pause, and success back to 3b/3c/3d with skip-already-done logic
- Replaced all harness-mode human pauses in 3d (empty/human_needed/gaps_found) and handle_blocker with mailbox routing or failed outcomes — every overnight decision point now non-blocking
- Landed Phase 10 carry-over: removed fixed-count style ("3-4 grey areas", "After 4 questions") from smart_discuss; triage-first adaptive depth
- Updated commands/gsd2/autonomous.md argument-hint and context block to advertise --phase N

## Task Commits

1. **Task 1: --phase selector + harness-mode discuss delegation + PHASE RESULT contract** - `cee8bf0` (feat)
2. **Task 2: harness-mode non-interactive routing for 3d and handle_blocker** - `b49df88` (feat)
3. **Task 3: adaptive-depth prompt alignment + command stub argument-hint** - `627dabe` (feat)

## Files Created/Modified

- `get-shit-done/workflows/autonomous.md` - SINGLE_PHASE/HARNESS_MODE parsing, harness 3a branch, all four PHASE RESULT variants, harness 3d branches, harness handle_blocker, adaptive-depth smart_discuss, success_criteria additions
- `commands/gsd2/autonomous.md` - argument-hint updated to "[--from N] [--phase N]"; context block documents --phase N and PHASE RESULT
- `tests/copilot-install.test.cjs` - updated argument-hint assertion to match new "[--from N] [--phase N]" value (Rule 3 fix)

## Decisions Made

- Harness branches are additive and HARNESS_MODE-gated; the interactive path (AskUserQuestion flows, smart_discuss, lifecycle) is byte-equivalent when GSD_RUN_ID is unset — this was a hard constraint from AGENT-SPEC
- human_needed in harness mode produces `completed` outcome (not `failed`) because the work did complete; the human item defers to the mailbox as `deferred_verification=q-NNN` on the PHASE RESULT line
- The four PHASE RESULT variants cover every branch end-to-end: completed, completed with deferred verification, parked (with q-NNN), failed (with reason)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated copilot-install test to match new argument-hint value**
- **Found during:** Task 3 verification
- **Issue:** tests/copilot-install.test.cjs line 674 asserted `argument-hint: "[--from N]"` exactly; changing the hint to `"[--from N] [--phase N]"` would break the test
- **Fix:** Updated the assertion string to match the new value; all 106 tests pass
- **Files modified:** tests/copilot-install.test.cjs
- **Verification:** `node --test tests/copilot-install.test.cjs` — 106 pass, 0 fail
- **Committed in:** `627dabe` (Task 3 commit, per plan's verification note "if one does, update it in the same commit")

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The test fix was anticipated by the plan's verification step ("if one does, update it to the new text in the same commit"). No scope creep.

## Issues Encountered

None — all three tasks executed cleanly within the plan's specification.

## Next Phase Readiness

- autonomous.md is now harness-wired: Plan 03 can build overnight.md to invoke `Skill(gsd2:autonomous, "--phase N")` and parse the `PHASE RESULT:` line for per-phase outcome recording in RUN-META.json
- The discuss-phase --auto delegation means the Phase 11 evaluator and Phase 12 park bifurcation are live for overnight runs without any further wiring
- Interactive sessions remain fully functional (no behavior change when GSD_RUN_ID is unset)

---
*Phase: 13-overnight-runner*
*Completed: 2026-06-12*
