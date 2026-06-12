---
phase: 14-multi-lens-discussion-loop
plan: "01"
subsystem: discuss-loop-core
tags: [tdd, cli, deterministic, discuss-loop, loop-01, loop-02]
dependency_graph:
  requires: []
  provides: [discuss-loop validate, discuss-loop delta, discuss-loop survivors, discuss-loop loop-id, discuss-loop transcript]
  affects: [gsd-tools.cjs dispatch, Phase 14 Plans 02-03 orchestrator workflow]
tech_stack:
  added: []
  patterns: [mailbox/park module pattern, pure-functions + cmd-handlers separation, append-only JSONL transcript]
key_files:
  created:
    - get-shit-done/bin/lib/discuss-loop.cjs
    - tests/discuss-loop.test.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs
decisions:
  - "loop-id format includes Z from ISO timestamp (replace only /[:.]/g — Z is not replaced, stays in id)"
  - "validate errors written to stdout not stderr — matches plan spec (cmd prints errors to stdout, exit 1)"
  - "selectSurvivors: block passed through structurally identical via Object spread from parsed JSON — deepStrictEqual passes"
metrics:
  duration: "12 minutes"
  completed_date: "2026-06-12"
  tasks_completed: 2
  files_changed: 3
requirements_validated: [LOOP-01, LOOP-02]
---

# Phase 14 Plan 01: Discuss Loop Core Library Summary

Deterministic CLI primitives for the multi-lens discussion loop: position-block validation with artifact grounding (LOOP-01), convergence diff, survivors ordering (LOOP-02 no-synthesis), and append-only transcript — all exposed as `gsd-tools discuss-loop` subcommands backed by pure functions.

## What Was Built

**`get-shit-done/bin/lib/discuss-loop.cjs`** — CommonJS module following the ledger/mailbox/park pattern:

Pure functions (no `process.exit`):
- `generateLoopId(artifactRef, runId)` — ISO-timestamp slug, `--runId` suffix when env set
- `validatePositionBlock(block, opts)` — full schema validation: lens/position/modification/blocking/summary/constraints with anchor substring check against artifact content, severity/status enums, referential integrity for `carried` constraints
- `computeRoundDelta(round, blocks, degraded)` — deterministic `round_delta` record (blocking lenses, new/carried constraint counts, `converged` flag — never fuzzy)
- `selectSurvivors(rounds)` — root-walk carried chain, shared-root exclusion from weight, survivors ordered by unshared blocking count descending, blocks passed through UNMODIFIED (no synthesis path exists in code)
- `appendTranscript(cwd, loopId, record)` — `mkdirSync` + `appendFileSync` one JSONL line, `loop_id` + `ts` injected

Cmd handlers: `cmdLoopId`, `cmdValidate`, `cmdDelta`, `cmdSurvivors`, `cmdTranscript` — each does process I/O and exit codes, delegates to pure functions.

**`get-shit-done/bin/gsd-tools.cjs`** — `case 'discuss-loop':` dispatch + `require('./lib/discuss-loop.cjs')` wired next to mailbox/park.

**`tests/discuss-loop.test.cjs`** — 28 test contracts covering all subcommands:
- validate: 14 cases (anchor, enums, boolean types, carried referential integrity, round mismatch)
- delta: 4 cases (TC-ORCH-1 convergence core)
- survivors: 4 cases (TC-ORCH-2 no-synthesis, shared-root exclusion, weight ordering)
- loop-id: 2 cases (slug format, GSD_RUN_ID suffix)
- transcript: 4 cases (append-only, type required, bad JSON)

## Verification

```
node "get-shit-done/bin/gsd-tools.cjs" discuss-loop loop-id docs/x.md
→ loop-2026-06-12T11-42-22-048Z-docs-x-md

node "get-shit-done/bin/gsd-tools.cjs" discuss-loop delta --round 1 \
  --data '[{"lens":"skeptic","round":1,"position":"accept","modification":null,"blocking":false,"summary":"s","constraints":[]}]'
→ {"type":"round_delta","round":1,"blocking_lenses":[],"new_constraint_ids":[],"carried_count":0,"converged":true,"degraded":false}

node --test tests/discuss-loop.test.cjs → 28/28 pass
node scripts/run-tests.cjs → 1079/1084 pass (5 pre-existing unrelated failures)
```

## Commits

| Hash | Message |
|------|---------|
| f9b98af | test(14-01): discuss-loop validation/convergence/survivors/transcript contracts (RED) |
| e6b1e91 | feat(14-01): discuss-loop lib — validation, convergence delta, survivors, transcript (GREEN) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test regex TC-23 did not account for Z in loop-id timestamp**
- **Found during:** Task 2 GREEN run
- **Issue:** The plan spec's `generateLoopId` uses `replace(/[:.]/g, '-')` which leaves the trailing `Z` from ISO timestamps. The RED test regex `/^loop-\d{4}-\d{2}-\d{2}T[\dT-]+-[a-z0-9-]+$/` didn't match `Z`. Actual output: `loop-2026-06-12T11-34-31-274Z-docs-plan-v2-md`.
- **Fix:** Updated regex to `[\dTZ-]+` in TC-23 to account for the `Z` character in the timestamp portion.
- **Files modified:** tests/discuss-loop.test.cjs (1 line)
- **Commit:** e6b1e91 (included in GREEN commit)

## Self-Check: PASSED

- get-shit-done/bin/lib/discuss-loop.cjs: FOUND
- tests/discuss-loop.test.cjs: FOUND
- f9b98af (RED commit): FOUND
- e6b1e91 (GREEN commit): FOUND
- node --test tests/discuss-loop.test.cjs: 28/28 pass
- node scripts/run-tests.cjs: 1079/1084 (5 pre-existing failures unrelated to this plan)
