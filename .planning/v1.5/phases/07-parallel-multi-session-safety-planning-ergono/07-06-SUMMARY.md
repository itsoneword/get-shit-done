---
phase: 07-parallel-multi-session-safety-planning-ergono
plan: "06"
subsystem: infra
tags: [worktree, parallel-safety, symmetry-check, workflow-integration]

requires:
  - phase: 07-01
    provides: worktree CLI primitives (add/merge/remove/prune) and executor-targeting caveat
  - phase: 07-03
    provides: validate health symmetry-check CLI
  - phase: 07-05
    provides: parallel-safe gate CLI (axis-A warn, axis-B refuse)

provides:
  - execute-phase.md wired with worktree isolation per parallel executor, per-merge clean check, post-merge symmetry-check, and parallel-safety gate
  - discuss-phase.md and plan-phase.md wired with axis-B HARD REFUSE gate
  - quick.md auto-detects concurrent phase execution and creates a worktree for the quick task
  - All four workflow files byte-identical source↔runtime (.claude/ copies)

affects: [execute-phase, discuss-phase, plan-phase, quick, Phase 8, Phase 9]

tech-stack:
  added: []
  patterns:
    - "Workflow prose calls deterministic CLI (`gsd-tools worktree …`, `gsd-tools parallel-safe …`, `gsd-tools validate health …`); no logic re-implemented in prose"
    - "Source-first mirror rule: write get-shit-done/workflows/, cp to .claude/get-shit-done/workflows/, assert diff -q"
    - "Per-merge clean check: worktree merge called once per branch, not once after all merges (Pitfall 2)"
    - "Executor-targeting fallback: subagent cwd resets between bash calls so worktree-mode executor must use in-place fallback + human checkpoint (07-01 Wave 0 finding)"

key-files:
  created: []
  modified:
    - get-shit-done/workflows/execute-phase.md
    - get-shit-done/workflows/discuss-phase.md
    - get-shit-done/workflows/plan-phase.md
    - get-shit-done/workflows/quick.md

key-decisions:
  - "Executor-targeting caveat (07-01 Wave 0): subagent cwd resets between bash calls; executor writing absolute repo-root paths lands in main tree, not worktree — worktree-mode falls back to in-place + human checkpoint"
  - "cmdWorktreeMerge exits 0 on conflict ({clean:false}) — conflict is a detected state, not a command error; workflow JSON-parses to decide auto-merge vs pause"

patterns-established:
  - "Parallel-safety gate fires at execute/discuss/plan start: refuse on axis-B (depends_on coupling), warn on axis-A (same-phase re-entry skipped per Pitfall 4)"
  - "quick.md auto-worktrees when git worktree list shows a linked worktree OR STATE.md status == executing; falls back in-place on sandbox failure"

requirements-completed: [SC1, SC2, SC4]

duration: multi-session (Tasks 1-2 auto; Task 3 human-verify)
completed: 2026-06-08
---

# Phase 07 Plan 06: Workflow Integration (Worktree + Gate + Symmetry) Summary

**Wired worktree isolation, per-merge clean detection, post-merge symmetry-check, and axis-B/axis-A parallel-safety gate into all four workflow files (execute-phase, discuss-phase, plan-phase, quick) using deterministic CLI calls only**

## Performance

- **Duration:** multi-session (Tasks 1-2 executed by executor agent; Task 3 human-verified by user)
- **Started:** 2026-06-08
- **Completed:** 2026-06-08
- **Tasks:** 3 of 3
- **Files modified:** 4

## Accomplishments

- execute-phase.md: `worktree prune` in validate_phase; `worktree add` per parallel executor in execute_waves; per-merge `worktree merge` clean check with conflict-pause; `worktree remove` on success/failure; post-aggregate `validate health` symmetry step; `parallel-safe` gate before handle_branching (refuse axis-B, warn axis-A, skip same-phase re-entry per Pitfall 4)
- discuss-phase.md and plan-phase.md: `parallel-safe` gate with HARD REFUSE on axis-B coupling (discuss/plan decision coupling is unrecoverable even with worktrees)
- quick.md: auto-detects concurrent phase via `git worktree list --porcelain` or STATE.md status == executing; creates a worktree for the quick task; merges back at finish; falls back in-place on sandbox failure
- All four workflow files verified byte-identical source↔runtime (`diff -q` passes)

## Task Commits

1. **Task 1: Wire worktree isolation + merge + post-merge symmetry into execute-phase.md** - `0970589` (feat)
2. **Task 2: Wire parallel-safety gate into execute-phase, discuss-phase, plan-phase; auto-worktree quick.md** - `b7b6996` (feat)
3. **Task 3: Human verifies end-to-end worktree + merge + gate flow** - human-verify APPROVED (no code commit; CLI smoke tests confirmed by user/orchestrator)

## Files Created/Modified

- `get-shit-done/workflows/execute-phase.md` — worktree isolation, per-merge clean check, post-merge symmetry-check, parallel-safety gate; in-place fallback path preserved for sandbox/executor-targeting edge case
- `get-shit-done/workflows/discuss-phase.md` — parallel-safety gate with HARD REFUSE on axis-B
- `get-shit-done/workflows/plan-phase.md` — parallel-safety gate with HARD REFUSE on axis-B
- `get-shit-done/workflows/quick.md` — auto-worktree detection + fallback in-place

## Decisions Made

- Executor-targeting fallback: subagent cwd resets between bash calls, so an executor writing absolute repo-root paths defeats on-disk worktree isolation. Per the 07-01 Wave 0 recorded finding, worktree-mode executor must fall back to in-place + human checkpoint for correctness.
- cmdWorktreeMerge exits 0 even on conflict (clean:false is a detected state, not a command error); the workflow JSON-parses the result and pauses for human resolution rather than auto-aborting.
- Same-phase re-entry skip (Pitfall 4): parallel_safety_check in execute-phase skips when proposed phase == currently-executing phase, avoiding false refusals on multi-wave re-entry.

## Deviations from Plan

None — plan executed exactly as written. Executor-targeting caveat was pre-documented in 07-01 and referenced in the plan's read_first; the in-place fallback path was the specified honest mechanism.

## Issues Encountered

None. CLI smoke tests (Task 3 human-verify) confirmed:
- `worktree prune` → ok:true
- `parallel-safe 6 7 --raw` → decision: refuse (Phase 7 depends_on Phase 6 — axis-B)
- `validate health` symmetry-check operational (reported ~50 files of source↔runtime drift from PRIOR phases — pre-existing, out of scope for Phase 7; repairable via `/gsd2:health --repair`)
- All four wired workflow files byte-identical source↔runtime

**Pre-existing finding (out of scope):** `validate health` surfaced ~50 files of source↔runtime drift accumulated from phases prior to Phase 7. This is not a Phase 7 regression — Phase 7 wired the check so the drift is now visible. Repairable via `/gsd2:health --repair`. Flagged for awareness; Phase 8/9 or a quick task should run the repair.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SC1 (worktree-isolated execute + per-merge clean detection), SC2 (parallel-safety gate in execute/discuss/plan), and SC4 (post-merge symmetry-check) are all end-to-end wired and human-verified.
- Phase 7 is complete (all 6 plans done). Phase 8 (Skill Self-Improvement & Validated Example Corpus) is next.
- Pre-existing source↔runtime drift (~50 files) should be repaired before or at Phase 8 start to keep `validate health` signal clean.

---
*Phase: 07-parallel-multi-session-safety-planning-ergono*
*Completed: 2026-06-08*
