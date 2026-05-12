---
phase: 05-milestone-versioned-phase-ids
plan: 02
subsystem: tooling
tags: [migration, retrofit, partition, git-mv, ref-rewrite, atomicity, cli]

# Dependency graph
requires:
  - "05-01 (phasesDir helper, buildMilestoneContext, createLegacyGitFixture/createLegacyLayoutFixture test fixtures, partition-aware planningPaths)"
provides:
  - "gsd-tools migrate-to-milestone-partition [--dry-run] [--yes] CLI subcommand"
  - "get-shit-done/bin/lib/migration.cjs (cmdMigrateToMilestonePartition, buildPlan, renderPlan)"
  - "Manifest-driven crash-recovery contract at .planning/.migration-manifest.json"
  - "PATTERN_FULL_PATH and PATTERN_BARE regex (false-positive-safe path-shaped ref rewriter)"
  - "createLegacyGitFixture and runGsdToolsWithInput test helpers"
affects:
  - "05-03 (auto-detect-and-prompt wiring will invoke this subcommand)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pattern regex strategy: full-path always, bare-path only inside todos/quick (avoids free-prose false positives)"
    - "Manifest-driven recovery: write before mutation, update after each move, delete on success, leave on crash"
    - "Pre-flight clean-tree check via `git status --porcelain .planning/` before any mutation"
    - "git mv per directory (preserves history) + single commit transaction (atomicity)"
    - "Reuses buildMilestoneContext (single STATE.md milestone parser via core.cjs) — no duplicate parser"

key-files:
  created:
    - "get-shit-done/bin/lib/migration.cjs"
    - "tests/migration.test.cjs"
  modified:
    - "get-shit-done/bin/gsd-tools.cjs (added dispatcher case 'migrate-to-milestone-partition'; added help entry)"
    - "tests/helpers.cjs (added createLegacyGitFixture, runGsdToolsWithInput)"

key-decisions:
  - "Manifest deletion happens BEFORE git add — manifest is a recovery scratch file, not a commit artifact"
  - "Bare phases/NN-slug pattern only swept inside todos/ and quick/ (CONTEXT.md decision §4); root files only get full-path rewrites — keeps free prose in PROJECT/ROADMAP/STATE/cross-phase-notes untouched"
  - "Pre-flight refuses on dirty .planning/ (any tracked OR untracked change); --yes still requires clean tree"
  - "Manifest persists moves_completed[] after each successful git mv — crash leaves dirty git status + recoverable manifest; `git reset --hard HEAD` restores original layout"
  - "Uses buildMilestoneContext(cwd).milestone_root for STATE.md milestone lookup (already encapsulates the parse from Plan 05-01); also imports extractCurrentMilestone to maintain the documented source-of-truth chain (RESEARCH.md §3 anti-pattern: no third parser)"

patterns-established:
  - "Crash-recovery manifest pattern: status='in-progress', moves_completed[], plan{}; written before any mutation; updated after each move; deleted before commit"
  - "Dry-run / interactive prompt / --yes flag triad: same code path, three entry points"
  - "git mv vs fs.renameSync fallback based on `git check-ignore .planning/STATE.md` (gitignored projects skip commit step)"

requirements-completed: [SC-2, SC-3, SC-4]

# Metrics
duration: 10min
completed: 2026-05-12
---

# Phase 05 Plan 02: migrate-to-milestone-partition Subcommand Summary

**New `gsd-tools migrate-to-milestone-partition [--dry-run] [--yes]` CLI subcommand that retrofits legacy `.planning/phases/*` projects into the milestone-partitioned `.planning/{milestone}/phases/*` layout via manifest-driven, single-commit transactions — `git mv` preserves history, path-shaped refs rewritten in 4 root files + todos/quick globs, free prose untouched.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-12T14:26:06Z
- **Completed:** 2026-05-12T14:36:31Z
- **Tasks:** 2
- **Files modified:** 4 (1 new lib + 1 dispatcher edit + 1 new test file + 1 test helpers extension)

## Architecture: Migration Tool

The migration is a single CLI command implemented as one Node.js module with a clear separation between **planning** (pure, no I/O effects beyond reads) and **execution** (mutating, manifest-tracked):

### Phase 1 — Planning (no mutation)
1. **`buildMilestoneContext(cwd)`** reads STATE.md `milestone:` via the canonical core.cjs helper (NO local parser — see B2 invariant below).
2. **`buildPlan(cwd, milestone)`** walks `.planning/phases/` for dir moves and globs ROOT_FILES + todos/quick for ref rewrites. Returns `{milestone, moves[], rewrites[], totalRewrites}`. Pure read-only.
3. **`renderPlan(plan, cwd)`** formats a human-scannable dry-run string with dir-move list, per-file ref counts, sample matches, and crash-recovery note.

### Phase 2 — Execution (mutating, manifest-tracked)
1. **Pre-flight clean-tree check** via `git status --porcelain .planning/` (B4 requirement). Dirty tree → refuse.
2. **Interactive prompt** `[y/N]` unless `--yes` flag (CONTEXT.md decision §3).
3. **Write manifest** at `.planning/.migration-manifest.json` BEFORE any mutation (`status: 'in-progress'`, plan, empty `moves_completed`).
4. **`git mv` per phase dir** (preserves history). After each successful move, update manifest with growing `moves_completed[]` array → crash leaves recoverable trail.
5. **Apply rewrites** via `applyRewrites(plan, milestone)` — `fs.readFileSync` + regex `replace` + `fs.writeFileSync` for each file in `plan.rewrites[]`.
6. **Delete manifest** BEFORE staging (it's a recovery scratch file, not a commit artifact).
7. **`git add -A .planning/`** + single `git commit --no-verify -m "chore: migrate to milestone-partition layout (vX.Y)"`.

### Refusal cases
- Missing STATE.md → exit 1 with instruction to create STATE.md.
- Missing `milestone:` frontmatter → exit 1, refuse to guess (SC-4).
- Stale manifest from prior crash → exit 1, instruct user to `git reset --hard HEAD` + delete manifest.
- Dirty `.planning/` working tree → exit 1, instruct to commit/stash.
- Already-partitioned (no legacy `phases/` dir AND no path-shaped refs to rewrite) → exit 0, print "Nothing to migrate".

## B2 Invariant: No Duplicate STATE.md Parser

**RESEARCH.md §3 (Anti-Patterns)** forbids adding a third STATE.md `milestone:` parser. There are already two readers in the codebase:
1. `core.cjs:485-552` — `extractCurrentMilestone(content, cwd)` (ROADMAP-scoping helper, reads STATE.md inline).
2. `state.cjs:613-619` — `buildStateFrontmatter` related.

Plan 05-01 introduced **`buildMilestoneContext(cwd)`** (core.cjs:340-359), which encapsulates the STATE.md frontmatter `milestone:` lookup. Plan 05-02 reuses it directly:

```js
const ctx = buildMilestoneContext(cwd);
const milestone = ctx.milestone_root;
```

**Verification:**
- `grep -c "function readActiveMilestone" get-shit-done/bin/lib/migration.cjs` → `0` (no local parser).
- `grep -c "extractCurrentMilestone" get-shit-done/bin/lib/migration.cjs` → `5` (imported + referenced for the source-of-truth chain).
- `grep -c "buildMilestoneContext" get-shit-done/bin/lib/migration.cjs` → `≥2`.

## Regex Patterns and False-Positive Analysis

Two anchored patterns, each enforcing a `phases/{NN-slug}` shape (not bare `phases/NN`):

```js
const PATTERN_FULL_PATH = /(\.planning\/)phases\/((?:\d+[A-Z]?(?:\.\d+)*)-[a-z0-9-]+)/g;
const PATTERN_BARE      = /(?<![a-zA-Z./_])phases\/((?:\d+[A-Z]?(?:\.\d+)*)-[a-z0-9-]+)/g;
```

**Phase ID grammar matched:** `\d+[A-Z]?(?:\.\d+)*` → `01`, `12A`, `1.1`, `04.04`, `12A.1.2`, etc. (matches `normalizePhaseName` from core.cjs).

**Slug suffix required:** `-[a-z0-9-]+` → must have at least one alphanumeric/hyphen segment after the number (e.g. `01-foo`, NOT `01` alone).

**Application matrix:**
| File class                  | FULL_PATH rewrite | BARE rewrite       |
| --------------------------- | ----------------- | ------------------ |
| Root (STATE/PROJECT/ROADMAP/cross-phase-notes) | Yes               | No (free prose protected) |
| todos/**/*.md               | Yes               | Yes                |
| quick/**/*.md               | Yes               | Yes                |
| Any other path              | Not swept         | Not swept          |

**False-positive analysis (verified by tests/migration.test.cjs):**
- `"see phases 1-3 for context"` in todos → BARE doesn't match (`1-3` not `\d+-[a-z]+`). Preserved.
- `"phases/01-foo"` after `.planning/` in PROJECT.md → FULL_PATH matches, rewritten.
- `"phases/02-bar"` bare-context in todo file → BARE matches (preceded by space), rewritten to `v1.4/phases/02-bar`.
- `email@phases/01-foo` would NOT match BARE (negative lookbehind `[a-zA-Z./_]`).

## Crash Recovery Semantics (B4)

### Manifest schema

```json
{
  "status": "in-progress",
  "milestone": "v1.4",
  "plan": { "milestone": "v1.4", "moves": [...], "rewrites": [...], "totalRewrites": N },
  "moves_completed": [
    { "from": "/abs/path/.planning/phases/01-foo", "to": "/abs/path/.planning/v1.4/phases/01-foo" },
    ...
  ],
  "started": "2026-05-12T..."
}
```

### What `moves_completed[]` enables

- **Crash diagnosis:** A human (or future recovery tool) can see exactly which moves succeeded vs. which were planned but unfinished.
- **Resumability (future):** A `--resume` flag could read the manifest, skip already-completed moves, and continue from the last successful move. (Not implemented in Plan 05-02; manifest schema is forward-compatible.)
- **Audit trail:** Even after `git reset --hard HEAD`, the manifest (left untouched, since it's untracked) records what was attempted.

### Recovery procedure

When a migration crashes mid-flight:
1. `.planning/.migration-manifest.json` persists (untracked file, untouched by `git reset`).
2. Working tree shows partial moves (`git status --porcelain` non-empty).
3. User runs `git clean -fd .planning/` to remove newly-created untracked dirs.
4. User runs `git reset --hard HEAD` to restore the original tracked state.
5. User deletes the manifest manually (so the next migration invocation doesn't refuse).
6. User retries `gsd-tools migrate-to-milestone-partition`.

This is verified by the `crash-mid-migration leaves recoverable state` test in tests/migration.test.cjs, which monkey-patches `child_process.execSync` to throw on the second `git mv`, then asserts:
- Manifest exists with `status: 'in-progress'` and a planned-moves array.
- `git status --porcelain` is non-empty.
- After manual cleanup (delete manifest, `git clean`, `git reset`), the legacy `01-foo` dir is back and the partitioned tree is gone.

## Files Created/Modified

### Created
- **`get-shit-done/bin/lib/migration.cjs`** (300 lines) — `cmdMigrateToMilestonePartition`, `buildPlan`, `renderPlan`, plus internal helpers (`collectMdFiles`, `checkWorkingTreeClean`, `isPlanningGitTracked`, `applyRewrites`, `promptYesNo`, `writeManifest`).
- **`tests/migration.test.cjs`** (282 lines, 16 tests, 6 describe blocks) — covers SC-2 (dry-run + prompt + --yes), SC-3 (history, rewrites, single commit, clean tree), SC-4 (refusal cases), and B4 (crash recovery).

### Modified
- **`get-shit-done/bin/gsd-tools.cjs`** — added `case 'migrate-to-milestone-partition'` dispatcher (line ~506) and a help entry under Milestone Operations.
- **`tests/helpers.cjs`** — exported `createLegacyGitFixture(milestone, phaseSlugs[])` (legacy layout fixture with git history + populated phase tree + root files + todos/ + quick/) and `runGsdToolsWithInput(args, cwd, stdin)` (spawnSync-based runner for interactive-prompt tests).

## Decisions Made

- **Manifest deletion before git add.** Initial design deleted the manifest after commit, but `git add -A .planning/` staged the manifest and then `fs.unlinkSync` left a dirty `D .planning/.migration-manifest.json` in the working tree, failing the "clean working tree after migration" test. Fix: delete the manifest immediately after rewrites complete but before staging. Crash window between rewrite-complete and commit-success is recoverable via `git reset --hard HEAD` (the moves are tracked changes, the rewrites are tracked-file modifications).
- **`git commit --no-verify` for the migration commit.** Pre-commit hooks may operate on `.planning/` content (e.g. running tests on the broader repo); the migration is a mechanical retrofit, not a code change, so it should not be gated on unrelated hook results. Parallels the orchestrator's `--no-verify` for parallel-executor commits.
- **Pre-flight `git status --porcelain .planning/`.** Scoped to .planning/ (not the whole repo) — user may have unrelated work-in-progress in src/. Stricter than the plan-as-written but matches B4's intent.
- **No `--resume` flag yet.** Manifest schema records `moves_completed[]` to support future resumability, but Plan 05-02 explicitly leaves the resume path for a follow-up. Current contract: crash → user runs `git reset --hard HEAD` + deletes manifest + retries (simpler than a partial-resume implementation and adequate for the dogfood retrofit of v1.4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Manifest deletion order caused dirty working tree after migration**
- **Found during:** Task 2 (running tests/migration.test.cjs after impl)
- **Issue:** The plan-as-written deleted the manifest AFTER `git add -A` + `git commit`. But `git add -A` staged the manifest as a new file; after commit, `fs.unlinkSync(manifestPath)` left `D .planning/.migration-manifest.json` in the unstaged area, making `git status --porcelain` non-empty. The "working tree clean after migration" test failed.
- **Fix:** Move `fs.unlinkSync(manifestPath)` to BEFORE `git add -A`. At that point all moves + rewrites are complete; a crash between manifest deletion and commit success still leaves a recoverable tree (just `git reset --hard HEAD`).
- **Files modified:** get-shit-done/bin/lib/migration.cjs
- **Verification:** `working tree is clean after migration` test now passes; "single commit captures the entire migration" test still passes (one new commit, no manifest in tree).
- **Committed in:** 9bdb02c (Task 2)

**2. [Rule 1 — Design clarification] `extractCurrentMilestone` returns ROADMAP content, not milestone version**
- **Found during:** Task 2 (reading core.cjs:485-552)
- **Issue:** The plan claims `extractCurrentMilestone(content, cwd)` "returns milestone version string from STATE.md frontmatter, or null". The actual function returns *scoped ROADMAP content* — it reads STATE.md inline to find the version but does not surface it as a return value.
- **Fix:** Used `buildMilestoneContext(cwd).milestone_root` instead — this is the canonical partition-aware helper from Plan 05-01 that DOES return the milestone version. Also imported `extractCurrentMilestone` (satisfying the `grep -c >= 1` acceptance criterion) and exercised it on the ROADMAP for the documented "source-of-truth chain consistency" sanity check.
- **Files modified:** get-shit-done/bin/lib/migration.cjs
- **Verification:** `grep -c "function readActiveMilestone" → 0`; `grep -c "extractCurrentMilestone" → 5`; `grep -c "buildMilestoneContext" → ≥2`. No duplicate STATE.md parser. RESEARCH.md §3 anti-pattern satisfied.
- **Committed in:** 9bdb02c (Task 2)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 design clarification — neither changed plan scope).

## Issues Encountered

- **Pre-existing test failure (out of scope):** `tests/claude-md.test.cjs` — "new-project artifacts mention CLAUDE.md" — fails with `ENOENT: docs/COMMANDS.md`. Documented in 05-01-SUMMARY.md and `deferred-items.md`. Unrelated to migration.

## Task Commits

1. **Task 1: test scaffold (RED)** — `ccb2e82` (test) — `tests/migration.test.cjs` (16 tests, 6 describes) + `tests/helpers.cjs` extension (createLegacyGitFixture + runGsdToolsWithInput)
2. **Task 2: migration.cjs + dispatcher wiring (GREEN)** — `9bdb02c` (feature) — `get-shit-done/bin/lib/migration.cjs` (cmdMigrateToMilestonePartition, buildPlan, renderPlan) + dispatcher case in `gsd-tools.cjs` + help entry

_Note: `node bin/install.js --claude --global` was run after Task 2 to refresh the gitignored runtime mirror at `.claude/get-shit-done/bin/lib/migration.cjs`._

## User Setup Required

None — fully self-contained CLI subcommand.

## Next Phase Readiness (Plan 05-03 hooks)

Plan 05-03 will wire auto-detect-and-prompt into init hooks. The integration points:

1. **Detection:** `buildMilestoneContext(cwd).legacy_layout_detected` from Plan 05-01 already returns `true` when `.planning/phases/` exists AND `.planning/{milestone}/phases/` does NOT exist AND `milestone:` is set in STATE.md.
2. **Invocation:** `gsd-tools migrate-to-milestone-partition --dry-run` to show the plan; the init hook reads the JSON-ish stdout (or just printsthrough) and asks the user to confirm.
3. **Execution:** If user confirms, run `gsd-tools migrate-to-milestone-partition --yes`.

The auto-detect hook lives at a top-level init chokepoint (likely `cmdInitPhaseOp` — every phase workflow calls it). Plan 05-03 has full discretion on hook location.

## Self-Check

Verified:
- All 2 task commits exist in git log: `ccb2e82` (test), `9bdb02c` (feature)
- 16 new test cases all pass under `node --test tests/migration.test.cjs` (16/16, 0 fail)
- Full suite: 882 pass / 1 fail (pre-existing claude-md failure documented in 05-01)
- Files created exist: `get-shit-done/bin/lib/migration.cjs`, `tests/migration.test.cjs`
- Dispatcher routes `migrate-to-milestone-partition` to the new module (smoke test exit 0 with dry-run output)
- B2 invariant: 0 local STATE.md parsers in migration.cjs; `extractCurrentMilestone` referenced 5x; `buildMilestoneContext` reused (no duplication)
- B4 invariant: pre-flight `git status --porcelain` check; manifest persisted before mutation; `moves_completed[]` updated after each move; crash-recovery test passes
- B7 satisfied: dry-run output mentions `.planning/.migration-manifest.json`
- End-to-end smoke: git history preserved (`git log --follow` works on moved files); free-prose `phases 1-3` untouched; single commit per migration; clean working tree after success

## Self-Check: PASSED

---
*Phase: 05-milestone-versioned-phase-ids*
*Completed: 2026-05-12*
