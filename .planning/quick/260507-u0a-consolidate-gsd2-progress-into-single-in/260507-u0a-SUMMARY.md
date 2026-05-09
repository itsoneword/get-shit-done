---
phase: quick-260507-u0a
plan: 01
subsystem: context-efficiency
tags: [token-savings, init-progress, workflow-consolidation, refactor]
dependency-graph:
  requires: [04-01-scoped-flag, 04-03-verify-loop]
  provides: [single-cli-progress-context, auditUatInternal, stateSnapshotInternal, progressRenderInternal, listTodosInternal, summaryExtractInternal]
  affects: [workflows/progress.md, bin/lib/init.cjs, bin/lib/uat.cjs, bin/lib/state.cjs, bin/lib/commands.cjs]
tech-stack:
  added: []
  patterns: [extract-then-delegate, bundled-context-object]
key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/init.cjs
    - get-shit-done/bin/lib/uat.cjs
    - get-shit-done/bin/lib/state.cjs
    - get-shit-done/bin/lib/commands.cjs
    - get-shit-done/workflows/progress.md
decisions:
  - "auditUatInternal returns safe empty object instead of process.exit on missing phases dir — consistent with null-safe internal pattern"
  - "stateSnapshotInternal extended to parse both table-format decisions and bullet-list decisions (GSD STATE.md uses bullet format)"
  - "recent_summaries extracted by mtime sort across milestone phases — top 3 only, one_liner sourced via summaryExtractInternal"
  - "progress_bar uses 20-char width from cmdProgressRender (not 10-char STATE.md bar) — larger bar is the workflow render width"
one-liner: "Collapse 8 CLI round-trips in /gsd2:progress into one init progress --scoped call by extracting non-emitting internals and bundling all report fields into cmdInitProgress"
metrics:
  duration: "~45min"
  completed: "2026-05-07"
  tasks_completed: 2
  files_modified: 5
---

# Quick Task 260507-u0a: Consolidate /gsd2:progress into Single CLI Call

## Summary

Collapsed 8 separate CLI calls in the `/gsd2:progress` workflow into one `init progress --scoped` call. This delivers the token savings that v1.4.5 advertised but never deployed — the `--scoped` flag was implemented in Plan 04-01 but never wired in the workflow.

## What Was Built

### Task 1: Extract Internals + Extend cmdInitProgress

**Extracted non-emitting helpers (extract-then-delegate pattern):**

- `auditUatInternal(cwd)` from `uat.cjs` — returns `{ results, summary }`, safe empty on missing phases dir
- `stateSnapshotInternal(cwd)` from `state.cjs` — returns full snapshot or `null`, handles both table and bullet-list decision formats
- `progressRenderInternal(cwd, format)` from `commands.cjs` — returns render result object for bar/table/json formats
- `listTodosInternal(cwd, area)` from `commands.cjs` — returns `{ count, todos }`
- `summaryExtractInternal(cwd, summaryPath, fields)` from `commands.cjs` — returns extracted fields or `null`

All `cmd*` wrappers now delegate to the internal and call `output()`. CLI behavior byte-identical.

**Extended `cmdInitProgress` with new top-level fields:**
- `progress_bar` / `progress_percent` — from progressRenderInternal (20-char bar)
- `verification_debt { total_files, total_items }` — from auditUatInternal.summary
- `todo_count` — from listTodosInternal
- `debug_session_count` — fs.readdirSync of `.planning/debug/` (non-resolved .md files)
- `recent_summaries[]` — top-3 mtime-sorted SUMMARY.md files with one_liner
- `profile` — from loadConfig.model_profile
- `state` — full stateSnapshotInternal result

**Extended per-phase objects with ROADMAP-sourced fields:**
- `goal`, `depends_on` — parsed from ROADMAP section text before phase loop
- `roadmap_complete` — parsed from ROADMAP checkbox status
- `has_context` — disk check for `*-CONTEXT.md` in phase dir (was missing from disk-walk loop)

### Task 2: Rewrite progress.md Workflow

Replaced the multi-call context loading with a single bash block:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init progress --scoped)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

**Removed 7 obsolete CLI calls:**
1. `roadmap analyze` — per-phase goals/depends_on now in `$INIT.phases[]`
2. `state-snapshot` — now `$INIT.state`
3. `progress bar --raw` — now `$INIT.progress_bar` / `$INIT.progress_percent`
4. `audit-uat --raw` — now `$INIT.verification_debt`
5. `summary-extract × N` — now `$INIT.recent_summaries[].one_liner`
6. `ls .planning/debug/*.md | grep -v resolved | wc -l` — now `$INIT.debug_session_count`
7. `config-get profile` — now `$INIT.profile`

**Preserved unchanged:** Routes A–F routing logic, per-phase `ls` disk checks in Step 1 (these are current-phase-specific and orthogonal to context bundling), success criteria block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] auditUatInternal safe-exit on missing phases dir**
- **Found during:** Task 1 (advisor review)
- **Issue:** Original `cmdAuditUat` called `error()` (process.exit) when `.planning/phases/` missing; extracting this into an internal called from `cmdInitProgress` would kill the whole CLI on any project without phases
- **Fix:** `auditUatInternal` returns `{ results: [], summary: { total_files: 0, total_items: 0, ... } }` on missing dir; `cmdAuditUat` wrapper retains the `error()` for CLI callers
- **Files modified:** get-shit-done/bin/lib/uat.cjs

**2. [Rule 2 - Missing functionality] stateSnapshotInternal handles bullet-list decisions**
- **Found during:** Task 1 testing
- **Issue:** GSD STATE.md uses `### Decisions` section with bullet-list format, not a Markdown table; the existing `cmdStateSnapshot` only parsed the table format, returning empty `decisions[]` for all current projects
- **Fix:** Added bullet-list fallback parsing for `### Decisions` section; table format still tried first for backward compat
- **Files modified:** get-shit-done/bin/lib/state.cjs

## Self-Check: PASSED

```
FOUND: get-shit-done/bin/lib/init.cjs (modified)
FOUND: get-shit-done/bin/lib/uat.cjs (modified)
FOUND: get-shit-done/bin/lib/state.cjs (modified)
FOUND: get-shit-done/bin/lib/commands.cjs (modified)
FOUND: get-shit-done/workflows/progress.md (modified)
FOUND: c084da7 (feat: extend cmdInitProgress)
FOUND: 8597abe (feat: rewrite progress.md)
```

All 13 plan verify commands passed. No `.claude/` files touched.
