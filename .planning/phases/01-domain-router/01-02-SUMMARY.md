---
phase: 01-domain-router
plan: 02
subsystem: plan-phase workflow
tags: [domain-router, plan-phase, ui-spec, agent-spec, backward-compat]
dependency_graph:
  requires: [01-01]
  provides: [DRTR-04]
  affects: [plan-phase step 5.6, discuss-phase CONTEXT.md integration]
tech_stack:
  added: []
  patterns: [CONTEXT.md domain field consumption, bash glob for spec artifact detection]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/plan-phase.md
decisions:
  - "Domain classification reads **Detected domain:** from CONTEXT.md rather than re-running keyword grep"
  - "Fallback to original keyword grep preserved for backward compatibility (phases without CONTEXT.md)"
  - "Agentic stub is an uncommented active check that skips silently if AGENT-SPEC.md missing — clean hook for Phase 2"
  - "Not a frontend phase option removed from domain-aware path (domain is already known; option only in fallback)"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-17"
  tasks_completed: 1
  files_modified: 1
---

# Phase 01 Plan 02: Domain-Aware Plan-Phase Gate Summary

Plan-phase step 5.6 now reads `**Detected domain:**` from CONTEXT.md and does a spec-existence check instead of re-running the frontend keyword grep when discuss-phase has already classified the domain.

## What Was Built

Step 5.6 of `plan-phase.md` was replaced with a two-path implementation:

**Primary path (domain-aware):** When CONTEXT.md exists and has a `**Detected domain:**` field (written by the Plan 01 discuss-phase router), plan-phase reads that value into `DETECTED_DOMAIN` and branches on it:
- "UI" or "UI+Agentic" → check for `*-UI-SPEC.md`; gate fires if missing and `UI_GATE_CFG=true`
- "Agentic" or "UI+Agentic" → check for `*-AGENT-SPEC.md`; skip silently if missing (Phase 2 delivers that workflow)
- "Generic" → skip silently to step 6

**Fallback path (backward compatibility):** When `DETECTED_DOMAIN` is empty (no CONTEXT.md or no domain field), original keyword grep fires on the ROADMAP phase section using the same `grep -iE "UI|interface|frontend|..."` pattern with the three-option AskUserQuestion including "Not a frontend phase".

The config guard (`workflow.ui_phase` / `workflow.ui_safety_gate`) is preserved and evaluated first, before either path runs.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — Rewrite step 5.6 | d3d31c1 | get-shit-done/workflows/plan-phase.md |

## Deviations from Plan

**1. [Rule 3 - Blocking] Applied change to tracked file instead of .claude/ copy**
- **Found during:** Task 1 commit
- **Issue:** `.claude/` directory is gitignored; the plan referenced `get-shit-done/workflows/plan-phase.md` which maps to `get-shit-done/workflows/plan-phase.md` in the repo root (tracked), not `.claude/get-shit-done/workflows/plan-phase.md` (local install copy)
- **Fix:** Applied identical edit to both the `.claude/` copy (for local runtime) and the tracked `get-shit-done/workflows/plan-phase.md` (for distribution). The tracked file uses `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` paths instead of hardcoded absolute paths
- **Files modified:** Both copies; committed tracked version
- **Commit:** d3d31c1

## Self-Check: PASSED

- [x] `get-shit-done/workflows/plan-phase.md` modified and committed (d3d31c1)
- [x] `grep -c "Detected domain" get-shit-done/workflows/plan-phase.md` returns 2
- [x] `grep -c "AGENT-SPEC" get-shit-done/workflows/plan-phase.md` returns 3
- [x] `grep -c "Fallback path" get-shit-done/workflows/plan-phase.md` returns 1
- [x] `grep -c "frontend indicators" get-shit-done/workflows/plan-phase.md` returns 3
- [x] Step 5.6 heading preserved
- [x] All other step headings (1 through 15) intact and unmodified
- [x] Config keys UI_PHASE_CFG and UI_GATE_CFG preserved
