---
phase: 07-parallel-multi-session-safety-planning-ergono
plan: 01
subsystem: tooling
tags: [git-worktree, parallel-safety, cli, sc1]

# Dependency graph
requires:
  - phase: 06-skill-self-sufficiency-audit-and-port-superpo
    provides: git-worktree technique reference (detect-existing, ignore-check, sandbox fallback)
provides:
  - gsd-tools worktree add|merge|remove|prune CLI primitive
  - createTempGitRepo helper in tests/helpers.cjs
  - worktree lifecycle + conflict-detection tests in tests/worktree.test.cjs
  - .worktrees/ gitignored at project root
affects:
  - 07-06 (execute-phase worktree orchestration — consumes this CLI primitive and the executor-targeting caveat)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-merge clean-detection: each git merge exit code checked individually (Pitfall 2 guard)"
    - "Conflict = detected state (clean:false) not command error — exits 0 so 07-06 can parse JSON"
    - "Source→runtime mirror: cp get-shit-done/bin/lib/worktree.cjs .claude/get-shit-done/bin/lib/worktree.cjs"

key-files:
  created:
    - get-shit-done/bin/lib/worktree.cjs
    - tests/worktree.test.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs (require + case 'worktree' + help comment)
    - tests/helpers.cjs (createTempGitRepo helper + export)
    - .gitignore (.worktrees/ entry)

key-decisions:
  - "cmdWorktreeMerge exits 0 on conflict (clean:false) — conflict is a detected state not a command error; 07-06 JSON-parses to decide"
  - "merge abort NEVER called in worktree.cjs — conflict state left reviewable for human"
  - "Per-merge exit-code check in cmdWorktreeMerge (not global pre-check) — guards against Pitfall 2 (N-way merges can conflict with each other even if each was clean against base)"
  - "Executor-targeting caveat: on-disk isolation proven, but Task-spawned executor writing to an absolute repo-root path (get-shit-done/...) lands in MAIN tree — this environment resets subagent cwd between bash calls; 07-06 must fall back to in-place + checkpoint for executors who cannot be made to target the worktree dir"

patterns-established:
  - "Worktree add: detect-existing (Step 0) → ignore-check (.worktrees/ in .gitignore) → git worktree add; sandbox failure → {ok:false, fallback:'in-place'}"
  - "Conflict surfacing: leave unmerged state for human review; return {clean:false, conflict_files:[]} not a hard error"

requirements-completed: [SC1]

# Metrics
duration: 17min
completed: 2026-06-06
---

# Phase 07 Plan 01: Worktree CLI Primitive Summary

**`gsd-tools worktree` add|merge|remove|prune CLI with per-merge conflict detection (clean:false returns reviewable unmerged state, never silent overwrite); on-disk isolation proven; executor-targeting caveat recorded for 07-06**

## Performance

- **Duration:** 17 min
- **Started:** 2026-06-06T20:31:37Z
- **Completed:** 2026-06-06T20:49:34Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `gsd-tools worktree add|merge|remove|prune` CLI primitive implemented in `get-shit-done/bin/lib/worktree.cjs` and wired into gsd-tools.cjs router
- 6 tests written and green: 2 Wave-0 environment probes (smoke + write-isolation) + 4 lifecycle/conflict tests
- On-disk write isolation confirmed: file written into worktree dir exists on worktree branch but NOT on main HEAD tree
- Conflict detection verified: `{clean:false, conflict_files:[...]}` returned, base file not silently overwritten (merge conflict markers present)
- `.worktrees/` added to `.gitignore`; `createTempGitRepo` helper added to `tests/helpers.cjs`

## Executor-Targeting Caveat (CRITICAL for 07-06)

**On-disk isolation is proven** — a file written via an absolute path INTO the worktree directory `<tmp>/wt/probe.txt` lands on the worktree branch and NOT on the main HEAD tree (confirmed by test 2 in worktree.test.cjs).

**BUT: executor-into-worktree cannot be made deterministic in this environment.** This Claude Code environment resets subagent cwd between bash calls. A Task-spawned executor agent that writes to a repo-root absolute path (e.g., `get-shit-done/references/foo.md`) targets the MAIN tree regardless of which worktree branch the orchestrator set up for it. The worktree isolation only holds if the executor writes exclusively through the worktree's own absolute directory path — which cannot be enforced via cwd reset alone.

**07-06 recommendation:** Use the in-place execution + human checkpoint as the honest fallback when executor-targeting cannot be made deterministic. Worktree isolation is fully functional for human-driven quick-fixes (where the human controls their working directory). The CLI primitive is complete and correct regardless of this caveat — 07-06 must factor this into its orchestration design.

## Task Commits

1. **Task 1: Smoke + write-isolation probe + createTempGitRepo** - `530d7dd` (feat)
2. **Task 2: worktree.cjs + gsd-tools router wiring** - `33c1e71` (feat)
3. **Task 3: .worktrees/ in .gitignore** - `a167d1e` (chore)

## Files Created/Modified

- `get-shit-done/bin/lib/worktree.cjs` — worktree lifecycle CLI functions (add/merge/remove/prune)
- `get-shit-done/bin/gsd-tools.cjs` — require + `case 'worktree'` router + help comment block
- `tests/worktree.test.cjs` — 6 tests (Wave-0 environment probes + lifecycle/conflict TDD tests)
- `tests/helpers.cjs` — `createTempGitRepo()` helper with `{ dir, cleanup }` return shape
- `.gitignore` — `.worktrees/` entry added

Source↔runtime mirror maintained: `get-shit-done/bin/lib/worktree.cjs` and `get-shit-done/bin/gsd-tools.cjs` mirrored to `.claude/` runtime (gitignored).

## Decisions Made

- `cmdWorktreeMerge` exits 0 on conflict — conflict is a detected state (`{clean:false, conflict_files:[...]}`), not a command error, so the caller (07-06) can JSON-parse and decide whether to auto-merge or pause for human
- `git merge --abort` is NEVER called in `worktree.cjs` — the unmerged state is intentional and reviewable
- Per-merge exit-code check (not global pre-check) guards Pitfall 2: N-way sequential merges can conflict with each other even when each was individually clean against base
- `createTempGitRepo` returns `{ dir, cleanup }` (not a bare string, unlike the existing `createTempGitProject`) and includes `git config commit.gpgsign false` to avoid signing-hang failures in test environments

## Deviations from Plan

None — plan executed exactly as written. The merge --abort string was removed from worktree.cjs comments to satisfy the literal grep acceptance criterion (the criterion tests that no abort code path exists; comments mentioning it could confuse the grep check).

## Issues Encountered

None significant. The `grep -q "merge --abort"` acceptance criterion matched comment text (not code), so the comments were rephrased to avoid the exact string — the no-abort behavior is unchanged.

## Next Phase Readiness

- 07-02 (todo frontmatter extension) and 07-03 (doctor symmetry-check) can proceed independently — no dependency on this plan
- 07-06 (execute-phase orchestration) can consume `gsd-tools worktree` but must factor in the executor-targeting caveat above: in-place fallback + human checkpoint is the honest approach when executor cwd cannot be controlled

---
*Phase: 07-parallel-multi-session-safety-planning-ergono*
*Completed: 2026-06-06*
