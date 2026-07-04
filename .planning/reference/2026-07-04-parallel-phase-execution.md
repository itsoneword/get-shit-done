# Parallel-phase execution — design

**Date:** 2026-07-04
**Trigger:** int_prep v0.1.3 autonomous run spawns only ~2 agents; user expected ~10 across independent phases.
**Scope decided:** planning fix + parallel executor (full).

## Problem

`autonomous.md` runs phases strictly serially (`iterate` step: re-read ROADMAP, loop back to `execute_phase`, one phase per iteration). Parallelism exists only *within* a phase (plans/waves). No cross-phase parallelism exists anywhere. Editing dependencies alone changes nothing about execution.

## Root causes (grounded in code)

1. **Prose-only deps — `roadmap.cjs:125`.** `**Depends on**` is regex-scraped from ROADMAP prose. No structured hard/soft distinction. A soft risk-ordering ("sequenced after 02, not a hard dependency") is parsed as a hard edge; the caveat is invisible to the scheduler. → false serial edges.
2. **Serial loop — `autonomous.md` `<step name="iterate">`.** Picks next incomplete phase in roadmap order; never computes a runnable frontier.
3. **Writer altitude — `execute-phase.md:242`.** Task-spawned executors reset cwd between bash calls; absolute-path writes escape the worktree into the main tree. → in-process parallel executors cannot be isolated.

## Assets already in place

- **`parallel-gate.cjs`** — working coupling classifier: axis-B (`depends_on` → refuse), axis-A (shared `files_modified` → warn), else greenlight. Keys off `depends_on`; needs no change if the parser separates hard/soft.
- **`worktree.cjs`** — solid worktree lifecycle: `add`/`merge`(--no-ff, per-merge clean check, conflicts reviewable)/`remove`/`prune`. SC1 satisfied.
- **CLAUDE.md constraint (v1.6):** "supervisor/runner must execute at orchestrator level (top-level session or headless run), never as a spawned subagent." — already predicts the fix.

## Design

### Fix A — hard/soft dependencies (planning)
- Roadmapper emits `**Depends on**` (hard, gates scheduling) and a new `**Sequence after**` (soft, tiebreak only).
- `roadmap.cjs` parses both; `roadmap analyze` exposes them as separate arrays.
- Only hard deps feed axis-B coupling. `parallel-gate.cjs` unchanged.
- Roadmapper also explicitly flags fully-independent phases.
- Files: `agents/gsd-roadmapper.md`, `get-shit-done/bin/lib/roadmap.cjs` (+ tests).

### Fix B — parallel executor (execution)
- **Frontier scheduler** in `autonomous.md`: after each completion, compute every phase whose *hard* deps are satisfied and that isn't axis-A/B coupled to a running one; launch concurrently up to a cap.
- **Per-worktree headless runner** (the crux): each parallel phase runs as a separate process rooted in its worktree — orchestrator shell does `worktree add` then launches `claude -p "execute phase N"` with cwd=worktree in background (NOT a Task subagent). Merge on completion via existing `worktree merge`; conflicts surface for review.
- Concurrency cap (~4–6), failure isolation (one phase failing doesn't poison siblings), ledger entries per launch/merge.

## Phasing (spine → fan-out → integrate)

- **P1 — hard/soft deps** (Fix A). Self-contained; unblocks the graph. Enables re-cutting int_prep roadmap (12/14 independent).
- **P2 — frontier computation** in autonomous (executes serially but dependency-correct; surfaces independents). No isolation risk.
- **P3 — isolation spike.** One headless `claude -p` phase rooted in a worktree; verify all writes land in-worktree and merge cleanly. **Go/no-go gate for parallelism.**
- **P4 — integrate.** Frontier + parallel runner + merge + cap + failure handling into autonomous.

## Overlap

P2–P4 are the v1.6 supervision-harness milestone (phases 10–15): DAG scheduler + worktree runner. Slot in, don't fork.

## int_prep application (after P1)
- v0.1.3 migration wave 01–11 is a genuine chain (each island builds on the prior proven bridge pattern); real parallelism is limited.
- True parallel opportunities: **Phase 14** (roadmap says independent of 01–13), **Phase 12** (hard-depends only on 04; "after 11" is soft), **02∥03** (03's dep on 02 is soft).
- Correct shape: `01 → 02 → [03,04,05,06,12,14 parallel] → 07→08→09 → 10,11`.
