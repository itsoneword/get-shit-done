---
phase: 02-agent-spec
plan: 02
subsystem: agent registration + plan-phase wiring
tags: [agent-spec, model-profiles, config, init, plan-phase, discovery]
dependency_graph:
  requires: []
  provides: [SPEC-06]
  affects: [plan-phase step 5.6 Agentic branch, planner prompt files_to_read, init plan-phase JSON, init execute-phase JSON]
tech_stack:
  added: []
  patterns:
    - "phase directory file-find discovery (mirrors *-CONTEXT.md / *-RESEARCH.md pattern)"
    - "VALID_CONFIG_KEYS dotted-key registration"
    - "MODEL_PROFILES tier mapping for new agent types"
key_files:
  created:
    - tests/agent-spec-init.test.cjs
  modified:
    - get-shit-done/bin/lib/model-profiles.cjs
    - get-shit-done/references/model-profiles.md
    - get-shit-done/bin/lib/config.cjs
    - get-shit-done/bin/lib/init.cjs
    - get-shit-done/workflows/plan-phase.md
decisions:
  - "Used Node's built-in node:test runner for new test file (Jest is not a project dependency)"
  - "Synced model-profiles.md table with model-profiles.cjs (table was missing all UI rows; fixed alongside agent-* additions)"
  - "Added has_agent_spec discovery to cmdInitExecutePhase even though that function had no prior phase-file scanning, for symmetry with cmdInitPlanPhase"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-17"
  tasks_completed: 2
  files_created: 1
  files_modified: 5
requirements_addressed: [SPEC-06]
---

# Phase 02 Plan 02: Agent Type Registration and AGENT-SPEC Wiring Summary

Wired in the infrastructure that lets the upcoming `/gsd2:agent-spec-phase` workflow function: registered `gsd-agent-researcher` / `gsd-agent-checker` model profiles, added `workflow.agent_spec` / `workflow.agent_spec_gate` config keys, taught `init.cjs` to discover `*-AGENT-SPEC.md` in phase directories, and updated `plan-phase.md` step 5.6 + step 8 to feed the spec into the planner prompt.

## What Was Built

### Task 1 — Agent and config registration (commit f759160)

- **`get-shit-done/bin/lib/model-profiles.cjs`** — Added two MODEL_PROFILES entries after `gsd-ui-auditor`:
  - `gsd-agent-researcher`: `{ quality: 'opus', balanced: 'sonnet', budget: 'haiku' }`
  - `gsd-agent-checker`: `{ quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' }`
- **`get-shit-done/references/model-profiles.md`** — Added rows for both new agents (and synced UI rows that were missing — the table had drifted from code).
- **`get-shit-done/bin/lib/config.cjs`** — Added `'workflow.agent_spec', 'workflow.agent_spec_gate'` to `VALID_CONFIG_KEYS`.

Verification: `resolve-model gsd-agent-researcher` and `resolve-model gsd-agent-checker` both return `sonnet` (balanced profile default). `npm test -- model-profiles` passes 13 tests; `npm test -- config` passes 22 tests.

### Task 2 — AGENT-SPEC discovery and plan-phase wiring (commit 610e49f)

- **`get-shit-done/bin/lib/init.cjs`**:
  - `cmdInitPlanPhase` — added `has_agent_spec: false` default, plus a phase-directory scan that sets `result.agent_spec_path` and flips `has_agent_spec` to `true` when `*-AGENT-SPEC.md` (or `AGENT-SPEC.md`) is found. Uses identical `files.find(...)` pattern as the existing CONTEXT/RESEARCH/VERIFICATION/UAT discovery.
  - `cmdInitExecutePhase` — added the same `has_agent_spec` default and discovery block. (This function had no prior phase-file scanning; added it cleanly so execute-phase can reference the spec if needed.)
- **`get-shit-done/workflows/plan-phase.md`**:
  - Step 5.6 Agentic branch — when AGENT-SPEC.md is missing, now displays `No AGENT-SPEC.md found. Run /gsd2:agent-spec-phase ${PHASE} to generate one.` instead of skipping silently. When found, sets `AGENT_SPEC_PATH` and notes that step 8 will include it in the planner's `<files_to_read>`.
  - Step 8 planner prompt — added `- {AGENT_SPEC_PATH} (Agent System Design Contract — architecture, communication contracts, test contracts, observability decisions, if exists)` to the `<files_to_read>` block, alongside `{UI_SPEC_PATH}`.
- **`tests/agent-spec-init.test.cjs`** — 5 new tests covering both `init plan-phase` and `init execute-phase`:
  1. `has_agent_spec: true` + populated `agent_spec_path` when AGENT-SPEC.md present (plan-phase)
  2. `has_agent_spec: false` + `agent_spec_path` undefined when missing (plan-phase)
  3. `agent_spec_path` uses posix forward-slash separators
  4. Same true-case for execute-phase
  5. Same false-case for execute-phase

All 5 tests pass. `npm test -- init` passes 46 tests (no regressions).

## Commits

| Task | Commit  | Files |
|------|---------|-------|
| 1 — Register agent types and config keys | f759160 | model-profiles.cjs, model-profiles.md, config.cjs |
| 2 — AGENT-SPEC discovery + plan-phase wiring | 610e49f | init.cjs, plan-phase.md, tests/agent-spec-init.test.cjs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test framework mismatch**
- **Found during:** Task 2 (test scaffolding)
- **Issue:** Plan specified Jest test scaffolding (`describe`, `expect`, `execSync`-based runner). The project uses Node's built-in `node:test` runner; Jest is not a dependency.
- **Fix:** Adapted the test to use `node:test` + `node:assert` + the existing `tests/helpers.cjs` (`runGsdTools`, `createTempProject`, `cleanup`). Same 3 behaviors validated; added 2 extra tests for execute-phase symmetry.
- **Files modified:** tests/agent-spec-init.test.cjs
- **Commit:** 610e49f

**2. [Rule 1 - Bug] model-profiles.md table out of sync with code**
- **Found during:** Task 1
- **Issue:** Plan said to add new rows "after the existing gsd-ui-auditor row" — but the markdown table was missing all three UI rows (gsd-ui-researcher, gsd-ui-checker, gsd-ui-auditor) entirely. The reference table had drifted from `model-profiles.cjs`.
- **Fix:** Added the three missing UI rows alongside the two new agent-* rows so the table now matches code.
- **Files modified:** get-shit-done/references/model-profiles.md
- **Commit:** f759160

**3. [Rule 3 - Blocking] cmdInitExecutePhase had no phase-file discovery loop**
- **Found during:** Task 2 (init.cjs editing)
- **Issue:** Plan said to add AGENT-SPEC discovery in `cmdInitExecutePhase` "after the verification/uat discovery". That function had no such discovery block — only `cmdInitPlanPhase` and `cmdInitPhaseOp` did.
- **Fix:** Added a minimal `if (phaseInfo?.directory)` block in `cmdInitExecutePhase` that scans for AGENT-SPEC.md only (matching the plan's intent for execute-phase symmetry without expanding scope).
- **Files modified:** get-shit-done/bin/lib/init.cjs
- **Commit:** 610e49f

## Deferred Issues

Pre-existing test failures (21 total) were observed in `npm test`. They are NOT caused by this plan — confirmed by stashing all 02-02 changes and re-running `npm test` (still reports `# fail 21`). They live in agent-frontmatter and copilot-install tests that were already modified before this plan started (visible as `M` in initial `git status`). Logged at `.planning/phases/02-agent-spec/deferred-items.md` (gitignored — informational only).

## Self-Check: PASSED

- [x] `get-shit-done/bin/lib/model-profiles.cjs` contains `gsd-agent-researcher` and `gsd-agent-checker` (verified)
- [x] `get-shit-done/references/model-profiles.md` table contains both new rows (verified)
- [x] `get-shit-done/bin/lib/config.cjs` VALID_CONFIG_KEYS contains `workflow.agent_spec` and `workflow.agent_spec_gate` (verified)
- [x] `get-shit-done/bin/lib/init.cjs` has `agent_spec_path` references (4 lines) and `has_agent_spec` references (4 lines)
- [x] `get-shit-done/workflows/plan-phase.md` has `AGENT_SPEC_PATH` references (4 lines) and `agent-spec-phase` reference (1 line)
- [x] `tests/agent-spec-init.test.cjs` exists and `node --test` reports 5/5 pass
- [x] `npm test -- model-profiles` passes (13 tests)
- [x] `npm test -- init` passes (46 tests, no regressions)
- [x] Commit f759160 in `git log` (Task 1)
- [x] Commit 610e49f in `git log` (Task 2)
- [x] `node get-shit-done/bin/gsd-tools.cjs resolve-model gsd-agent-researcher` returns sonnet/balanced
- [x] `node get-shit-done/bin/gsd-tools.cjs init plan-phase 02` returns `has_agent_spec: false` (correct — no AGENT-SPEC.md in phase yet)
