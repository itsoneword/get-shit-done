---
phase: quick-260704-m9p
plan: 01
subsystem: infra
tags: [scheduler, worktree, autonomous, roadmap, config]

requires:
  - phase: quick-260704-lbp
    provides: hard/soft dependency distinction (depends_on vs sequence_after) in roadmap.cjs
provides:
  - "gsd-tools roadmap frontier command (testable scheduling brain)"
  - "max_parallel_phases config key + config-get defaults fallback"
  - "autonomous.md frontier scheduler with per-worktree headless parallel execution"
affects: [autonomous, roadmap, config, worktree, parallel-gate]

tech-stack:
  added: []
  patterns:
    - "Non-exiting analyzer + thin output() wrapper (analyzeRoadmapData / cmdRoadmapAnalyze) so downstream commands can consume phases[] in-process"
    - "config-get on-disk-first, loadConfig-defaults-fallback-second resolution order"

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/roadmap.cjs
    - get-shit-done/bin/lib/parallel-gate.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/bin/lib/core.cjs
    - get-shit-done/bin/lib/config.cjs
    - tests/roadmap.test.cjs
    - tests/config.test.cjs
    - get-shit-done/workflows/autonomous.md
    - .planning/reference/2026-07-04-parallel-phase-execution.md

key-decisions:
  - "roadmap frontier reads ONLY depends_on for the hard-dep gate; sequence_after is never consulted (P1's hard/soft split is the whole point)"
  - "Axis-B is moot within a frontier (a frontier phase's hard deps are, by construction, already complete) — the co-schedule filter checks axis-A file overlap only, reusing parallel-gate's getPhaseFiles"
  - "config-get resolves the on-disk config.json first; only falls back to loadConfig defaults when the dot-path resolves to undefined there — on-disk values always win, unknown keys still error"
  - "Parallel phases run headless with --dangerously-skip-permissions by construction (worktree isolation + unattended autonomous run); documented as an explicit ledgered decision, not silently applied"

patterns-established:
  - "Scheduling brain vs orchestration split: testable lib command (roadmap frontier) computes what CAN run; prose (autonomous.md) decides HOW to run it (inline serial vs per-worktree parallel)"

requirements-completed: []

duration: ~45min
completed: 2026-07-04
---

# Quick Task 260704-m9p: Parallel-Phase Frontier Scheduler Summary

**Built a testable `roadmap frontier` scheduling command plus a per-worktree headless parallel executor wired into autonomous.md, unblocked by a `config-get` defaults-fallback fix.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files modified:** 9

## Accomplishments

- New `gsd-tools roadmap frontier` command: computes incomplete phases whose hard `depends_on` are all satisfied (ignoring `sequence_after` entirely), then splits the frontier into a `coschedulable[]` subset and a `serialized[]` remainder using the axis-A file-overlap guard reused from `parallel-gate.cjs` (`getPhaseFiles`, now exported).
- Fixed a real blocker: `config-get` used to error `Key not found` for any key absent from the on-disk `config.json` — including `parallelization` on THIS repo's own config. It now falls back to `loadConfig`'s defaults-merged view, while still erroring for genuinely unknown keys and a missing config file.
- Added `max_parallel_phases` config key (default 4).
- Rewrote `autonomous.md`'s `<step name="iterate">` from a serial "next roadmap-ordered phase" loop into a frontier scheduler: computes the frontier each round, falls back to today's inline serial path when parallelization is off or only one phase is runnable, and otherwise launches co-schedulable phases as per-worktree headless `claude -p --dangerously-skip-permissions` processes from the orchestrator shell (never a Task subagent), capped at `max_parallel_phases`, with unconditional per-phase stdout capture driving the merge-vs-leave decision and every launch/merge/removal ledgered.
- Documented the new behavior in `autonomous.md`'s purpose/success_criteria and marked P4 as implemented in the design reference doc.

## Task Commits

1. **Task 1: Add `roadmap frontier` scheduler command + config cap knob + config-get defaults fallback + node:test coverage** — `e144d34` (feat)
2. **Task 2: Rewrite autonomous.md iterate/execute into a frontier scheduler with per-worktree headless runner** — `97f1d56` (feat)
3. **Task 3: Document the concurrency cap and parallel behavior** — `ecb7afb` (docs)

## Files Created/Modified

- `get-shit-done/bin/lib/roadmap.cjs` — factored `analyzeRoadmapData` (non-exiting) out of `cmdRoadmapAnalyze`; added `cmdRoadmapFrontier` + `extractDepPhaseNums` helper; imports `getPhaseFiles` from `parallel-gate.cjs`
- `get-shit-done/bin/lib/parallel-gate.cjs` — exported `getPhaseFiles` (was internal-only)
- `get-shit-done/bin/gsd-tools.cjs` — routed `roadmap frontier` subcommand; updated usage comment + unknown-subcommand error list
- `get-shit-done/bin/lib/core.cjs` — added `max_parallel_phases: 4` to `loadConfig` defaults and returned object
- `get-shit-done/bin/lib/config.cjs` — added `max_parallel_phases` to `VALID_CONFIG_KEYS`; rewrote `cmdConfigGet` to fall back to `loadConfig(cwd)` defaults when the on-disk dot-path resolves to `undefined`
- `tests/roadmap.test.cjs` — new `describe('roadmap frontier', ...)` block: 5 cases (no-deps frontier, hard-dep gating both directions, soft `sequence_after` never gates, axis-A file-overlap split)
- `tests/config.test.cjs` — new `describe('config-get defaults fallback', ...)` block: 6 cases (parallelization/max_parallel_phases fallback, on-disk-wins override, 3 regression cases for unknown keys / missing config.json)
- `get-shit-done/workflows/autonomous.md` — rewrote `<step name="iterate">` as the frontier scheduler (4a-4e); added a purpose paragraph and a success_criteria line documenting the parallel/serial-fallback behavior
- `.planning/reference/2026-07-04-parallel-phase-execution.md` — appended "P4 — IMPLEMENTED" marker section

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed with their specified interfaces (`analyzeRoadmapData`/`cmdRoadmapAnalyze` split, exported `getPhaseFiles`, `config-get` fallback preserving on-disk precedence and existing error paths).

## Verification

- `node --test tests/roadmap.test.cjs tests/config.test.cjs tests/parallel-gate.test.cjs`: 77 pass, 3 fail. The 3 failures are pre-existing and unrelated (sandbox denies `mkdir '/home/user/.gsd'` in `config-ensure-section` Brave-Search/global-defaults tests) — confirmed present on the unmodified baseline via `git stash` before starting this work. Zero new failures introduced.
- All 5 new `roadmap frontier` tests pass; all 6 new `config-get defaults fallback` tests pass (including the 3 regression cases: unknown key, deeply-nested unknown key, missing config.json).
- `node get-shit-done/bin/gsd-tools.cjs roadmap frontier` runs clean against this repo, returning `{frontier:["16"], coschedulable:["16"], serialized:[]}`.
- `node get-shit-done/bin/gsd-tools.cjs config-get parallelization` → `true`; `config-get max_parallel_phases` → `4` — both clean against this repo's `config.json`, which omits both keys.
- All Task 2/3 structural grep verifies passed, including the `! grep -q "config get "` regression guard (no accidental un-hyphenated `config get` invocations introduced).

## Self-Check

- FOUND: get-shit-done/bin/lib/roadmap.cjs (cmdRoadmapFrontier present)
- FOUND: get-shit-done/bin/lib/parallel-gate.cjs (getPhaseFiles exported)
- FOUND: get-shit-done/bin/gsd-tools.cjs (roadmap frontier routed)
- FOUND: get-shit-done/bin/lib/core.cjs (max_parallel_phases default)
- FOUND: get-shit-done/bin/lib/config.cjs (defaults fallback + VALID_CONFIG_KEYS)
- FOUND: tests/roadmap.test.cjs (roadmap frontier describe block)
- FOUND: tests/config.test.cjs (config-get defaults fallback describe block)
- FOUND: get-shit-done/workflows/autonomous.md (frontier scheduler + docs)
- FOUND: .planning/reference/2026-07-04-parallel-phase-execution.md (P4 marker)
- FOUND commit e144d34
- FOUND commit 97f1d56
- FOUND commit ecb7afb

## Self-Check: PASSED
