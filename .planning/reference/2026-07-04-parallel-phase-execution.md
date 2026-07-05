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

## P3 isolation spike — RESULT: GO (2026-07-04)

Verified in a throwaway repo: `git worktree add` → launch `claude -p "<edits>" --dangerously-skip-permissions` with cwd=worktree → the process wrote all edits *inside* the worktree; main tree stayed untouched (no leaked files, HEAD unchanged). Committed on the branch, then `gsd-tools worktree merge` returned `{clean:true}` and all edits landed in main via merge commit.

Conclusion: per-worktree **separate-process** execution holds isolation, unlike in-process Task subagents (the `execute-phase.md:242` leak). This is the mechanism P4 builds on.

Deltas for P4 design:
- Each parallel phase = a background `claude -p ... --dangerously-skip-permissions` process with cwd set to its worktree (NOT a Task spawn). Launched from the orchestrator shell.
- Runs are unpermissioned by construction (headless skip-permissions) — acceptable for autonomous/unattended; note in ledger.
- Clean merge depends on non-overlapping files across concurrent phases → keep the parallel-gate axis-A file-overlap check as a co-scheduling guard (don't run file-overlapping phases together).
- Each phase is a full process (real token/latency cost) — cap concurrency ~4–6.

## P4 — IMPLEMENTED (2026-07-04)

Quick task 260704-m9p built the frontier scheduler + parallel runner:

- `gsd-tools roadmap frontier` — the scheduling brain (testable lib, node:test covered): incomplete phases whose hard `depends_on` are all satisfied, `sequence_after` never read, split into `coschedulable[]` / `serialized[]` via the axis-A file-overlap guard reused from `parallel-gate.cjs` (`getPhaseFiles`, now exported).
- `max_parallel_phases` config key (default 4), alongside the existing `parallelization` toggle.
- `config-get` defaults-fallback fix: keys omitted from the on-disk `config.json` (true for this repo's own config) now resolve to the `loadConfig` default instead of erroring — unblocks the scheduler reading `parallelization`/`max_parallel_phases` cleanly on any project.
- `autonomous.md` `<step name="iterate">` rewritten as prose: each round launches co-schedulable frontier phases as per-worktree headless `claude -p --dangerously-skip-permissions` processes from the orchestrator shell (not Task subagents), capped at `max_parallel_phases`; unconditional per-phase stdout capture to a run-scoped log drives the merge-vs-leave decision; clean merges remove the worktree, conflicts surface without aborting; falls back to the serial inline path when parallelization is off or the frontier is singular.
- Every launch, merge, and removal is written to the ledger (auditable-from-ledger, no transcript replay needed).

## BUG found by smoke test (2026-07-05) — frontier false-dependency from prose

Smoke project (~/gsd-smoke-test, 2 independent phases) revealed: `cmdRoadmapFrontier` (and likely parallel-gate coupling) matches phase numbers by naive substring/number scan of the raw `**Depends on**` text. Phase 02's line `Nothing (independent of Phase 01)` was read as a hard dep on Phase 01 → 02 dropped from frontier (only `["01"]` returned). Removing the "of Phase 01" wording → frontier correctly returns `["01","02"]` co-schedulable.

Impact: real roadmaps whose depends lines mention other phases in prose get false serial edges → silent under-parallelization. FIX: parse the depends field to structured phase-number tokens (word-boundary / list-item aware), not a raw `.includes()`. Check parallel-gate.cjs for the same pattern.

Second flag (unconfirmed): `init milestone-op` returned `phase_count: 0` for the 2-phase roadmap (no phase *dirs* yet, only ROADMAP entries) — may confuse autonomous's milestone-empty detection; needs a look before the full e2e run.

Status: frontier brain proven to co-schedule independents once depends text is clean; full autonomous e2e NOT yet run (blocked on the above + fresh context to monitor headless executors).

## BUG #2 found by smoke test (2026-07-05) — worktrees lack GSD (.claude not provisioned)

`autonomous.md` launches each parallel phase as `(cd .worktrees/phase-N && claude -p "...")`. But `.claude/` (the GSD install) is typically untracked/gitignored, so a worktree created off HEAD does NOT contain it, and global `~/.claude` has no GSD either → the child session has no `/gsd2` commands or `gsd-tools`. P4 never provisions GSD into the worktree.

FIX options: (a) after `worktree add`, symlink/copy the main tree's `.claude` into the worktree; or (b) have the child reference GSD via an absolute path to the main tree rather than relying on cwd; or (c) require a global GSD install for parallel mode. Needs a decision + implementation before parallel autonomous works on a real project.

Smoke-test workaround: committed `.claude` in the throwaway so worktrees inherit it, to exercise the rest of the mechanism (frontier → launch → execute → merge).

## int_prep application (after P1)
- v0.1.3 migration wave 01–11 is a genuine chain (each island builds on the prior proven bridge pattern); real parallelism is limited.
- True parallel opportunities: **Phase 14** (roadmap says independent of 01–13), **Phase 12** (hard-depends only on 04; "after 11" is soft), **02∥03** (03's dep on 02 is soft).
- Correct shape: `01 → 02 → [03,04,05,06,12,14 parallel] → 07→08→09 → 10,11`.
