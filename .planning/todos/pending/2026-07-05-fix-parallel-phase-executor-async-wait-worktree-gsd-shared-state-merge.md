---
created: 2026-07-05T20:14:23.907Z
title: Fix parallel-phase executor (async-wait, worktree GSD, shared-state merge)
area: tooling
files:
  - get-shit-done/workflows/autonomous.md:594-677
  - get-shit-done/bin/lib/roadmap.cjs
  - .planning/reference/2026-07-04-parallel-phase-execution.md
depends_on: []
related_to: []
---

## STATUS 2026-07-05 — code fixes landed, only e2e green-light remains

All three bugs FIXED (see reference doc section "FIXES for #2/#3/#4 — IMPLEMENTED"):
- #2 `worktree add --provision-gsd` symlinks `.claude/` into worktree (unit-tested).
- #4 `worktree merge --shared-state` auto-resolves STATE.md/ROADMAP.md-only conflicts as ours + central `roadmap update-plan-progress` refresh (unit-tested).
- #3 `autonomous.md` 4d rewritten as one blocking bash (launch+wait+merge) — not unit-testable.
- Runtime synced (`node bin/install.js --local`). worktree/parallel-gate/roadmap tests: 70/70 green.

**Remaining:** the green-light e2e below (needs spawning real headless `claude`; run deliberately with fresh context to monitor). Close this todo once it's green.

## Problem (original)

The parallel-phase executor (P2+P4, quick 260704-m9p) is built and unit-verified, but a full end-to-end `/gsd2:autonomous` run on a 2-phase smoke project (2026-07-05) showed it is NOT usable yet. Three open bugs — full detail, root causes, and fix options in `.planning/reference/2026-07-04-parallel-phase-execution.md` (sections "BUG #2", "E2E smoke run").

**Proven working — do NOT re-verify:** frontier scheduling, worktree isolation at scale, per-worktree parallel execution, code-file merge. P1 hard/soft deps already shipped; serial autonomous unaffected.

**Open bugs (fix in this order):**

- **#3 Orchestrator can't wait across async.** `autonomous.md` per-worktree launch backgrounds `claude -p` with `&`, then relies on prose to "wait then merge" — but the single-shot session exits before the phases finish, so merges never run and worktrees dangle. This is why the smoke run left alpha.txt/beta.txt unmerged.

- **#2 Worktrees lack GSD.** `.claude/` is untracked, so a worktree forked off HEAD has no GSD to run — the child `claude -p` in the worktree has no `/gsd2` commands. (Smoke test worked around it by committing `.claude`.)

- **#4 (deepest) Parallel phases conflict on shared state.** Every phase writes `.planning/STATE.md` and `ROADMAP.md`, but those aren't in `files_modified`, so the axis-A guard co-schedules the phases anyway → phase N>1 conflicts on merge (phase-01 merged clean, phase-02 conflicted on STATE.md + ROADMAP.md). GSD's state model assumes serial phases.

## Solution

- **#3:** Make launch + `wait` + merge + `worktree remove` ONE self-contained blocking bash sequence — background all N phase PIDs in a single shell invocation, `wait` on them, then merge each branch and remove each worktree. Not model-driven steps after backgrounding.
- **#2:** After `worktree add`, symlink or copy the main tree's `.claude` into the worktree (or reference GSD by absolute path to the main tree).
- **#4:** Have the orchestrator update STATE.md/ROADMAP.md centrally AFTER merging each phase's code, rather than each phase writing them inside its worktree. (Alternatives: treat them as regenerate-not-merge, or force per-file serialization of the state update.)

**Green-light check after fixes:** re-run the ready-made smoke project at `~/gsd-smoke-test`:
`GSD_RUN_ID=smoke-e2e claude -p "/gsd2:autonomous" --dangerously-skip-permissions`
Expect: both alpha.txt + beta.txt merged clean into main, zero conflicts, worktrees auto-removed.
