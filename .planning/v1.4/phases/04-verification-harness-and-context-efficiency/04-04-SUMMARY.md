---
phase: 04-verification-harness-and-context-efficiency
plan: 04
subsystem: workflows
tags: [verify-loop, evaluator-optimizer, execute-phase, harness-integration]

# Dependency graph
requires:
  - phase: 04-verification-harness-and-context-efficiency
    provides: Plan 04-03 — gsd-verifier/gsd-fixer loop modes, verify commands subcommand, must_haves verify: schema
provides:
  - verify_after task attribute documented in phase-prompt.md
  - auto_verify plan-frontmatter flag documented (opt-out, default ON)
  - verify_loop config block exposed by init execute-phase JSON
  - verify_loop sub_flow spliced into execute-phase.md (verifier → investigator → fixer, ceiling=3)
  - parallel-wave serialization rule for concurrent loops
  - ceiling-reached CHECKPOINT REACHED handoff shape
affects: [phase-05-and-beyond-dogfood, future-execute-phase-runs, harness-uX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-flow blocks in execute-phase.md (<sub_flow name=\"...\">) — workflow logic separated from main step pipeline"
    - "Per-role files_to_read whitelist as fresh-context invariant"
    - "Structured tagged log lines (.planning/debug/{plan-slug}-verify-loop.md) as observability artifact"

key-files:
  created:
    - .planning/debug/  # directory created on demand by orchestrator (mkdir -p) — not yet populated
  modified:
    - .claude/get-shit-done/templates/phase-prompt.md
    - .claude/get-shit-done/bin/lib/init.cjs
    - .claude/get-shit-done/workflows/execute-phase.md

key-decisions:
  - "Deferred Task 4 (manual harness dogfood) — GSD self-verification needs its own workflow design"
  - "Per-plan verify_loop config emitted by init execute-phase (additive — no existing keys removed)"
  - "verify_loop sub_flow spliced after execute_waves and before verify_phase_goal — preserves end-of-waves verifier"
  - "Parallel-wave loops run sequentially to avoid debug-file races"

patterns-established:
  - "Evaluator-Optimizer wired into the execute-phase workflow as a sub-flow, not a new top-level step"
  - "Fresh-context spawning enforced by orchestrator-constructed files_to_read per agent role"
  - "Default-on, plan-frontmatter opt-out (auto_verify: false) for verification harness"

requirements-completed: []  # Plan frontmatter requirements: [] — none mapped

# Metrics
duration: ~45min
completed: 2026-05-07
---

# Phase 04 Plan 04: Verify-Loop Integration Summary

**Verifier→investigator→fixer loop spliced into execute-phase.md as a sub-flow with ceiling=3, fresh-context spawning, and ceiling-reached CHECKPOINT handoff — wired but not dogfooded.**

## Performance

- **Duration:** ~45 min (Tasks 1–3) + closeout
- **Started:** 2026-05-07T~16:50Z
- **Completed:** 2026-05-07T17:35Z (Tasks 1–3 wired and committed)
- **Tasks:** 3 of 4 completed; 1 deferred (see Deferred Validation)
- **Files modified:** 3

## Accomplishments

- **Task 1 — phase-prompt.md template** documents the `verify_after="true"` task attribute, the `auto_verify: false` plan-level opt-out, and cross-links to the `verify:` schema delivered by Plan 04-03.
- **Task 2 — init execute-phase JSON** now surfaces a `verify_loop` block: `default_enabled`, `max_iterations: 3`, `debug_dir: ".planning/debug"`, and per-plan `auto_verify` + `verify_after_tasks` derived from PLAN.md frontmatter and `<task>` blocks.
- **Task 3 — execute-phase.md sub-flow** splices the loop between `execute_waves` and `verify_phase_goal`. Includes per-role `files_to_read` whitelists, AGENT-SPEC.md back-references, ceiling-reached CHECKPOINT REACHED block shape, parallel-wave serialization rule, and opt-out path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Document verify_after / auto_verify in phase-prompt.md** — `f1e0f64` (feat)
2. **Task 2: Add verify_loop keys to init execute-phase JSON** — `127a721` (feat)
3. **Task 3: Splice verify_loop sub-flow into execute-phase.md** — `7900ca5` (feat)

**Plan metadata commit:** see git log entry following this SUMMARY.

## Files Created/Modified

- `.claude/get-shit-done/templates/phase-prompt.md` — added Task Attributes section with `verify_after`, plan-frontmatter docs for `auto_verify`, cross-link to `verify:` schema.
- `.claude/get-shit-done/bin/lib/init.cjs` — extended `cmdInitExecutePhase` with `verify_loop` block (additive, no existing keys removed).
- `.claude/get-shit-done/workflows/execute-phase.md` — added `<sub_flow name="verify_loop">` block and trigger splice in `execute_waves` after spot-check; preserved existing `verify_phase_goal` step verbatim.

## Decisions Made

- **Deferred Task 4** — Manual three-scenario dogfood (TC-LOOP-PASS, TC-LOOP-CEILING, TC-LOOP-RECOVER) is intentionally not executed in this plan. GSD's manual-verification UX is itself an unsolved workflow problem; running synthetic plans by hand is fragile and warrants a dedicated phase. Rationale: shipping the wired harness now is higher-value than blocking on a verification approach we know we want to redesign. The next phase that authors a `verify_after="true"` task in the natural course of work will dogfood the harness organically.
- **Sub-flow splice point** — Loop fires per-plan after spot-check passes for a wave but before advancing to the next wave; existing end-of-waves `verify_phase_goal` is left untouched (complementary, not redundant).
- **Default ON, opt-out per plan** — `auto_verify: false` in PLAN.md frontmatter disables the loop for all tasks in that plan. Visible loop runs > silent skips.

## Deviations from Plan

None for Tasks 1–3. Plan executed exactly as written.

Task 4 is **deferred**, not skipped — see Deferred Validation below for the distinction and rationale.

## Issues Encountered

None during Tasks 1–3. All automated acceptance criteria pass (verified by previous executor agent before this closeout).

## Deferred Validation

**Task 4 — Manual end-to-end harness dogfood — DEFERRED.**

**What is verified:**
- The verify-loop is wired end-to-end in code: phase-prompt.md documents the contracts, init.cjs surfaces the per-plan config, execute-phase.md fires the sub-flow.
- All Task 1–3 acceptance criteria (grep checks, jq queries, line-count growth) pass.
- The sub-flow internally references AGENT-SPEC.md as the source of truth for every JSON contract; the AGENT-SPEC contracts themselves were checker-reviewed in Plan 04-02/04-03.

**What remains unverified:**
- TC-LOOP-PASS — synthetic plan with a passing `verify:` command runs the loop in <30s, no CHECKPOINT block, debug file ends at `status: resolved`.
- TC-LOOP-CEILING — synthetic plan with deterministically failing verify produces 3 verifier invocations, 2 investigator/fixer rounds, and a `## CHECKPOINT REACHED type: ceiling-reached` block with `iterations_attempted: 3`.
- TC-LOOP-RECOVER (non-recoverable variant) — investigator returning `classification: not-yet-built` exits the loop after 1 iteration without spawning a fixer.

**Why deferred (not failed, not skipped):**
GSD's manual verification workflow is itself an unsolved problem. Authoring throwaway sandbox plans, running `/gsd2:execute-phase` by hand, observing real subagent timing, and confirming structured log lines is fragile and brittle when done ad hoc. Doing it once now does not solve the recurring need to validate harness changes in future phases. The right move is a dedicated phase that designs the verification UX itself — a reusable harness-test command, fixture plans checked into the repo, or an automated regression suite over the loop sub-flow. Until that phase lands, the wired-but-not-dogfooded state is the honest representation of what shipped.

**Compensating controls:**
- The first real future phase that includes a `verify_after="true"` task will exercise the harness organically. If it misbehaves, the failure is observable (CHECKPOINT REACHED block surfaces, debug file shape can be inspected) and a regression bug can be filed against this plan.
- Plan 04-02's dependency graph plus the existing standalone `gsd-verifier`, `gsd-debugger`, and `gsd-fixer` agents are unchanged; the loop is additive.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Wired:** Future phases that author `verify_after="true"` on tasks will trigger the loop automatically; the orchestrator now reads `verify_loop.per_plan` from the init JSON and consults it during the wave step.
- **Open:** Manual three-scenario dogfood owed by a future "harness verification UX" phase. Until then, harness reliability rides on (a) AGENT-SPEC contract review, (b) automated grep/jq acceptance on the wiring code, and (c) organic exposure during real future-phase execution.
- **Known follow-up (carried over from Plan 04-03 discovery, unchanged):** `parseMustHavesBlock` in `frontmatter.cjs` uses a 4-space-indent regex; real plans use 2-space — separately filed.

## Self-Check: PARTIAL

**Verified by automated checks (run by previous executor before deferral decision):**
- `grep -cE 'verify_after.*true|verify_after:\s+true' .claude/get-shit-done/templates/phase-prompt.md` ≥ 2 — PASS
- `grep -q 'auto_verify' .claude/get-shit-done/templates/phase-prompt.md` — PASS
- `grep -q 'ceiling-reached' .claude/get-shit-done/templates/phase-prompt.md` — PASS
- `node .claude/get-shit-done/bin/gsd-tools.cjs init execute-phase 04-verification-harness-and-context-efficiency --raw | jq -e '.verify_loop != null and .verify_loop.max_iterations == 3'` — PASS
- `grep -q '<sub_flow name="verify_loop">' .claude/get-shit-done/workflows/execute-phase.md` — PASS
- `grep -q 'verify_phase_goal' .claude/get-shit-done/workflows/execute-phase.md` (existing step preserved) — PASS
- `grep -qE 'fresh context|fresh-context' .claude/get-shit-done/workflows/execute-phase.md` — PASS
- All three Task 1–3 commits present in `git log` — PASS (`f1e0f64`, `127a721`, `7900ca5`)

**Not verified (deferred, see Deferred Validation):**
- TC-LOOP-PASS end-to-end behavior with a real spawned verifier subagent
- TC-LOOP-CEILING end-to-end three-iteration ceiling and CHECKPOINT block emission
- TC-LOOP-RECOVER non-recoverable early-exit
- Debug file structured tagged log lines under realistic loop conditions

Status is PARTIAL rather than FAILED because everything we built was verified; what remains is the live-fire test we explicitly chose not to run inside this plan.

---
*Phase: 04-verification-harness-and-context-efficiency*
*Plan: 04-04*
*Completed: 2026-05-07 (Tasks 1–3 shipped; Task 4 deferred)*
