---
phase: 16-planning-graph-model-cli
plan: 03
subsystem: infra
tags: [yaml-parsing, frontmatter, graph, regex, tdd]

# Dependency graph
requires:
  - phase: 16-02
    provides: graph.cjs buildGraph/cmdGraphAnalyze/cmdGraphExport and the SUMMARY requires/affects edge-building logic this fix unblocks
provides:
  - "extractFrontmatter anchored to the file-start frontmatter block instead of matchAll's whole-document LAST-match scan"
  - "Regression test fixture mimicking real SUMMARY.md shape (opening frontmatter + body Deviations divider + closing footer divider)"
  - "Live provides edge in gsd-tools graph export/analyze (was 0, now >=1) — closes 16-VERIFICATION.md's one gap"
affects: [17-graph-algorithms-integrity, roadmap.cjs, all ~15 extractFrontmatter call sites (cmdFrontmatterGet/Set/Merge/Validate, graph.cjs PLAN/todo readers)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Anchored-loop block selection (^\\s*---...---, re-anchored after each stacked block) instead of unbounded matchAll — preserves CRLF-corruption-recovery intent while refusing to treat body dividers as frontmatter"]

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/frontmatter.cjs
    - get-shit-done/bin/lib/graph.cjs
    - tests/frontmatter.test.cjs

key-decisions:
  - "Fixed the shared parser (frontmatter.cjs) at its root rather than patching graph.cjs's SUMMARY reader — ~15 other call sites shared the same silent-data-loss exposure"
  - "graph.cjs's separate dash-list-flattening workaround (16-02) was confirmed still necessary and left unmodified except for one clarifying comment distinguishing it from this fix"

patterns-established:
  - "When multiple frontmatter blocks can legitimately stack (CRLF-corruption recovery), anchor the match to the current position after each consumed block rather than scanning the whole document for the last occurrence of a delimiter pair"

requirements-completed: [GRAPH-02]

# Metrics
duration: 15min
completed: 2026-07-04
---

# Phase 16 Plan 03: Gap-Closure — extractFrontmatter Block-Selection Fix Summary

**Anchored `extractFrontmatter`'s `---...---` block selection to the file start (replacing an unbounded `matchAll` whole-document scan), fixing silent frontmatter loss on 16/64 real SUMMARY.md files and restoring the `provides` edge type to the live planning graph (0 → 1 edges).**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-04T17:39:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Root-caused and fixed the exact bug 16-VERIFICATION.md identified: `extractFrontmatter` picked the LAST `---...---` pair anywhere in a document, so any SUMMARY.md with a body `---` divider (Deviations section, footer) silently returned `{}` and lost 100% of its frontmatter, not just `requires`/`affects`
- Preserved the original CRLF-corruption-recovery intent (stacked frontmatter blocks at file start resolve to the last one) with two dedicated regression tests, rather than blindly reverting to a naive single-block match
- Added a regression fixture mimicking this repo's real SUMMARY.md template shape (frontmatter + Deviations `---` divider + closing footer `---`) that now parses correctly
- Confirmed live: `gsd-tools graph export`/`graph analyze` against this repo's own `.planning/` tree now show 1 `provides` edge (was 0) — Phase 16's outstanding verification gap is closed
- Confirmed the full `npm test` suite holds at the pre-existing baseline (1163/1168 pass; same 5 pre-existing unrelated failures in `config.test.cjs`/`profile-output.test.cjs` — test count grew by 3 from the new regression tests, all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED regression tests proving the block-selection bug** - `a9ef4c3` (test)
2. **Task 2: Fix extractFrontmatter's block-selection anchor (GREEN), sync runtime, re-verify provides edges live** - `5e37458` (fix)

**Plan metadata:** (this commit) `docs(16-03): complete gap-closure plan`

## Files Created/Modified
- `tests/frontmatter.test.cjs` - 3 new regression tests (real-SUMMARY-shape RED case, LF and CRLF stacking-preservation guards)
- `get-shit-done/bin/lib/frontmatter.cjs` - `extractFrontmatter` block selection rewritten as an anchored `for(;;)` loop instead of `content.matchAll` over the whole document
- `get-shit-done/bin/lib/graph.cjs` - added one clarifying comment to the existing dash-list-flattening workaround (Source 1), noting it is unrelated to this fix and still needed for a separate, still-present per-item YAML-parsing limitation

## Decisions Made
- Fixed the shared parser at its root (not a `graph.cjs`-local workaround) since ~15 other call sites depend on `extractFrontmatter` and would otherwise remain exposed to the same silent-data-loss failure mode on any file with a body `---` divider
- Left `graph.cjs`'s dash-list-flattening workaround untouched except for a clarifying comment — verified it addresses a distinct, still-present per-item parsing limitation, not block selection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm run dev` blocked by a real read-only filesystem mount, not just Bash-tool sandboxing**
- **Found during:** Task 2, step 5 (runtime sync)
- **Issue:** `npm run dev` failed with `EROFS: read-only file system` writing `hooks/dist/gsd2-check-update.js` — anticipated in the plan's critical_reminders as expected in this environment. Attempted the narrower `node bin/install.js --local` next; it got further (backed up an already-drifted `.claude/get-shit-done/bin/lib/frontmatter.cjs` to `.claude/gsd-local-patches/`, consistent with a concurrent session's earlier independent runtime edit) but then hit a second EROFS on `rmdir` of `.claude/commands/gsd2`. Verified this second failure was non-destructive: file counts in `.claude/commands/gsd2` (58) matched the source `commands/gsd2` (58) before and after, confirming the aborted `rmdir` deleted nothing.
- **Fix:** Since `.claude/get-shit-done/bin/lib/` itself is writable (only `hooks/dist` and `.claude/commands/gsd2`'s directory-replace path are on the blocked mount), directly copied the two changed files (`frontmatter.cjs`, `graph.cjs`) from `get-shit-done/bin/lib/` to `.claude/get-shit-done/bin/lib/`, scoped to exactly what this plan touched. Verified byte-identical via `diff` (both report no difference) before re-running the live `graph export`/`graph analyze` verification.
- **Files modified:** `.claude/get-shit-done/bin/lib/frontmatter.cjs`, `.claude/get-shit-done/bin/lib/graph.cjs` (both gitignored runtime copies, not committed)
- **Verification:** `diff get-shit-done/bin/lib/{frontmatter,graph}.cjs .claude/get-shit-done/bin/lib/{frontmatter,graph}.cjs` — no difference; `gsd-tools graph export` then showed 1 `provides` edge
- **Note for orchestrator:** A full `npm run dev` (or `node bin/install.js --local`) still has not completed cleanly in this environment — `hooks/dist` and the `.claude/commands/gsd2` directory-replace step remain blocked by what appears to be a real EROFS-mounted path, not a Bash-tool sandbox restriction. The full sync (hooks build + complete `.claude/` tree refresh) should be run by a session/environment without that mount restriction.

---

**Total deviations:** 1 auto-fixed (1 blocking — worked around with a scoped manual copy, verified byte-identical to source)
**Impact on plan:** No scope creep. The core fix and its verification are exactly as planned; only the mechanism for syncing the runtime copy differed from `npm run dev` due to an environment-level filesystem restriction outside this plan's control.

## Issues Encountered
- During the `node bin/install.js --local` attempt, discovered `.claude/get-shit-done/bin/lib/frontmatter.cjs` had already diverged from the tracked source before this plan started (a near-identical but not byte-identical fix, missing the final clarifying sentence) — consistent with a concurrent session independently touching the runtime copy directly. Not investigated further since the scoped `cp` in the deviation above supersedes it with the exact, source-tracked fix; no data was lost (the pre-existing divergent copy was backed up by `install.js` to `.claude/gsd-local-patches/` before being overwritten).

## Next Phase Readiness
- GRAPH-02's `provides` edge type is now live and reliable in this repo's own `.planning/` tree — Phase 16's verification gap is closed with no remaining partial/failed truths
- Phase 17 (graph algorithms + integrity check) can build on a graph model that is no longer silently missing `provides` edges from ~25% of real SUMMARY.md files
- Orchestrator should run a full `npm run dev` from an unrestricted environment at the next opportunity to fully reconcile `.claude/`'s runtime tree (hooks/dist rebuild + complete directory sync), independent of this plan's scoped file-level fix

---
*Phase: 16-planning-graph-model-cli*
*Completed: 2026-07-04*

## Self-Check: PASSED
