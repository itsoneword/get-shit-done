---
phase: 07-parallel-multi-session-safety-planning-ergono
plan: 04
subsystem: planning
tags: [backlog, phase-ids, cli, migration]

# Dependency graph
requires:
  - phase: 07-01
    provides: gsd-tools worktree CLI + router structure this plan appends to
provides:
  - cmdPhaseNextBacklogId allocator (B1, B2… IDs outside phase-number space)
  - next-backlog-id router entry in gsd-tools.cjs phase case
  - add-backlog.md and review-backlog.md repointed to B-prefix scheme
  - 999.1 directory removed, 999.2 migrated to B1
  - ROADMAP.md backlog section uses ### B1: headings, zero 999.x references
affects: [07-05, 07-06, add-backlog, review-backlog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "B-prefixed backlog IDs (B1, B2…) allocated by phase next-backlog-id — never enter phase-number space until promoted"
    - "Allocator unions dir scan + ROADMAP ## Backlog heading scan to handle sparse/partial states"

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/phase.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - commands/gsd2/add-backlog.md
    - commands/gsd2/review-backlog.md
    - .planning/ROADMAP.md
    - tests/roadmap.test.cjs

key-decisions:
  - "Backlog command source lives in commands/gsd2/ (tracked), not .claude/commands/gsd2/ (gitignored) — plan's 'runtime-only' claim was wrong; source edited + copied to runtime"
  - "Allocator unions dir scan AND ROADMAP ## Backlog heading scan so sparse/deletion scenarios stay correct"
  - "ROADMAP 999.x prose references in Phase 7 planning body updated to neutral language (not just backlog section) to satisfy grep -c 999 = 0"

patterns-established:
  - "B-prefix pattern: backlog IDs use B{N} form, roadmap phase regex requires leading digit after 'Phase ' so B-IDs never pollute phase list"

requirements-completed: [SC5]

# Metrics
duration: 35min
completed: 2026-06-08
---

# Phase 07 Plan 04: Backlog ID Migration Summary

**B-prefixed backlog IDs (B1, B2…) replace 999.x via a new `phase next-backlog-id` allocator; existing 999.x dirs and ROADMAP entries migrated; commands repointed; roadmap parser ignores B-prefixed headings without any regex change**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-08T09:32:00Z
- **Completed:** 2026-06-08T10:07:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `cmdPhaseNextBacklogId` added to phase.cjs: scans phases dir for `B{N}-` dirs + ROADMAP `## Backlog` for `### B{N}:` headings, returns `B<max+1>` (B1 when none)
- Wired `next-backlog-id` into gsd-tools.cjs `case 'phase'` router with updated help string
- Confirmed roadmap phase regex (`/#{2,4}\s*Phase\s+(\d+…)/`) requires a leading digit — B-prefixed headings never match; no regex change needed
- `add-backlog.md` and `review-backlog.md` source files updated: all 999.x references replaced with B-prefix equivalents; copied to `.claude/` runtime
- `999.1-doctor-source-runtime-symmetry-check` removed (folded into Phase 7); `999.2-terse-output-default-verbose-opt-in` migrated to `B1-terse-output-default-verbose-opt-in`
- ROADMAP.md backlog section updated: `### Phase 999.1:` block removed, `### Phase 999.2:` renamed to `### B1:`; all inline 999.x references in Phase 7 prose updated; zero 999 references remain

## Task Commits

1. **Task 1 RED tests** - `481aed9` (test)
2. **Task 1 GREEN implementation** - `68be6e1` (feat)
3. **Task 2 migration** - `2aa6d29` (feat)

## Files Created/Modified
- `get-shit-done/bin/lib/phase.cjs` - added `cmdPhaseNextBacklogId`; imports `planningPaths` from core
- `get-shit-done/bin/gsd-tools.cjs` - wired `next-backlog-id` subcommand + updated help string
- `commands/gsd2/add-backlog.md` - all 999.x refs replaced with B-prefix; step 2 command updated
- `commands/gsd2/review-backlog.md` - `999*` glob replaced with `B[0-9]*`; prose updated
- `.planning/ROADMAP.md` - backlog section and Phase 7 prose migrated; 0 remaining 999 refs
- `tests/roadmap.test.cjs` - 3 new tests: next-backlog-id B1 (no dirs), B2 (B1 exists), B-prefix phase-space separation

## Decisions Made
- Backlog command source in `commands/gsd2/` (tracked, not gitignored) — plan incorrectly said runtime-only; edited source + copied to `.claude/`
- Allocator unions dir scan + ROADMAP heading scan to handle edge cases (sparse numbering, dirs deleted but ROADMAP entries remaining)
- All 999.x prose references in ROADMAP updated to neutral language, not just the backlog section, to satisfy the strict `grep -c "999" = 0` acceptance criterion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backlog command source tracked in commands/gsd2/, not runtime-only**
- **Found during:** Task 2 (before editing command files)
- **Issue:** Plan stated `add-backlog.md`/`review-backlog.md` exist only in `.claude/commands/gsd2/` (runtime-only, gitignored) with no source copy. `git ls-files` showed both tracked in `commands/gsd2/`.
- **Fix:** Edited tracked source in `commands/gsd2/` and copied to `.claude/commands/gsd2/` (same mirror pattern as phase.cjs).
- **Files modified:** commands/gsd2/add-backlog.md, commands/gsd2/review-backlog.md
- **Verification:** `grep -c "999" commands/gsd2/add-backlog.md` = 0; `grep -c "999" commands/gsd2/review-backlog.md` = 0
- **Committed in:** 2aa6d29

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan assumption)
**Impact on plan:** No scope creep; fix was necessary for the commit to land in the tracked source.

## Issues Encountered
- `grep -c "999"` returns exit code 1 when count is 0 (standard grep behavior) — chained verification commands needed `|| true` guard.

## Next Phase Readiness
- SC5 complete: B-prefixed backlog IDs are fully in place
- `phase next-backlog-id` available for 07-06 and future backlog additions
- 07-05 (parallel-safe gate) and 07-06 (wire worktree+merge into execute-phase) can proceed

---
*Phase: 07-parallel-multi-session-safety-planning-ergono*
*Completed: 2026-06-08*

## Self-Check: PASSED

- FOUND: get-shit-done/bin/lib/phase.cjs
- FOUND: commands/gsd2/add-backlog.md, review-backlog.md
- FOUND: .planning/v1.5/phases/07-.../07-04-SUMMARY.md
- FOUND: B1-terse-output-default-verbose-opt-in dir
- CONFIRMED: 999.1 removed, 999.2 removed
- Commits 481aed9, 68be6e1, 2aa6d29 all present
- 33 tests pass, 0 fail
- `phase next-backlog-id --raw` returns B2 (B1 exists)
