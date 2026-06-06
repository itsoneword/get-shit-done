# Phase 7: Parallel Multi-Session Safety & Planning Ergonomics - Research

**Researched:** 2026-06-06
**Domain:** GSD framework meta-work — git worktree orchestration, CLI/workflow tooling, frontmatter schema
**Confidence:** HIGH (internal codebase audit + git primitives; no external library selection)

---

## Summary

Phase 7 wires five interlocking pieces onto already-built primitives: the git-worktree technique reference (Phase 6), the `depends_on` parser in `roadmap.cjs`, the Phase 4 file-dep graph, the `validate health` harness in `verify.cjs`, and the existing todo frontmatter in `init.cjs`. None of the five scope items require a new library or external dependency — all implementation is git CLI + existing GSD bin/lib code.

The largest genuine unknowns are (A) the N-way merge-back sequence when multiple executors each get their own worktree branch, and (B) a reliable "is a phase currently executing?" signal that survives crashes. Both have tractable answers from reading existing code: worktrees merge sequentially into the phase branch (each step can conflict independently, so "auto if clean" must be checked per-merge, not once); STATE.md `status: Executing Phase N` exists but is crash-stale-prone, making `git worktree list` a more reliable signal.

The backlog ID migration is the most mechanical scope item — it touches two command files, ROADMAP.md, and the two existing `999.x` phase directories. No regex in `roadmap.cjs`'s phase parser needs changing to stop parsing `B`-prefixed IDs because the existing pattern already matches only `\d+[A-Z]?(?:\.\d+)*` — `B1` won't match. The migration is additive (new commands, new ROADMAP section format) not a parse-engine change.

**Primary recommendation:** Sequence the plans as: Wave 1 (parallel, file-disjoint) = worktree orchestration in `execute-phase`, parallel-safety gate, doctor symmetry-check. Wave 2 = todo frontmatter extension + backlog ID migration. Wave 1 items share no files; Wave 2 items share only `frontmatter.cjs` and `add-todo.md` (make them sequential or carefully disjoint).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Merge ergonomics:** Auto-merge if clean, pause + surface a reviewable diff only on conflict. Merge target = the phase branch. [WEAK, recommendation-backed]
- **Parallel-safety gate:** Deterministic, baked into workflows. HARD-refuses parallel discuss/plan of `depends_on`-linked phases (axis B). File-scope overlap (axis A) only WARNS. Gate reads both `depends_on` (roadmap.cjs) and the Phase 4 file-dep graph. [STRONG on the axis-B-hard-refuse half]
- **Quick-fix convention:** `/gsd2:quick` auto-creates a worktree when it detects concurrent phase execution, falling back to in-place when nothing else is running. Detection mechanism is open for planning. [WEAK, recommendation-backed]
- **Backlog ID scheme:** `B1, B2, …` non-phase backlog IDs; real phase number only on promotion. Replaces `999.x`. [WEAK, recommendation-backed]
- **Doctor shape:** Fold into `/gsd2:health` (structural check + `--repair`) AND call same function as `execute-phase` post-merge step. No new command. Check = `diff -rq get-shit-done .claude/get-shit-done` + settings.json hook/statusLine registration parity. Does NOT claim the `/gsd2:doctor` name. [STRONG on no-new-command]
- **Scope/sequencing:** All 5 items land in Phase 7. Phase 6 must hard-close before Phase 7 starts. [STRONG, user-override]
- **Isolation in execute-phase:** Deterministically in workflow/CLI, never in agent prose. [STRONG]

### Claude's Discretion

- Detection mechanism for "a phase is executing" (candidate: telemetry/state signal from execute-phase — open per CONTEXT.md).
- gsd-tools worktree helper: Phase 7 may build one (Phase 6 deliberately left it unbuilt). API must be defined here.
- How many PLANs and their wave grouping.

### Deferred Ideas (OUT OF SCOPE)

- Semantic stale-decision healer doctor (Phase 3 cross-phase note) — distinct, future phase.
- RAG/semantic retrieval (Phase 5 cross-phase note).
- `worktree-path-guard` hard-block hook (SEC-DEFER-01) — reconsider post-Phase-7 as follow-up.

---

## Architecture Patterns

### Scope Item 1: Worktree Orchestration in execute-phase

**How execute-phase currently works (verified by reading the file):**

The `execute_waves` step (lines ~176–351) spawns executor subagents in parallel within each wave. Executors currently use `--no-verify` on commits to avoid pre-commit hook contention on the shared tree. Post-wave, the orchestrator runs hooks once.

**What changes with worktrees:**

Each executor gets its own linked worktree (separate directory, same `.git`). The worktree branch is created off the phase branch. After the executor completes, its worktree branch merges back into the phase branch. The `--no-verify` workaround becomes optional (no shared-tree contention) but can stay for speed.

**Proposed orchestration sequence (per plan/executor):**

```bash
# Before spawning executor for plan N:
WORKTREE_DIR=".worktrees/${PHASE}-${PLAN_ID}"
git worktree add "$WORKTREE_DIR" -b "worktree/${PHASE}-${PLAN_ID}" HEAD

# Executor runs inside $WORKTREE_DIR (passed via prompt context)

# After executor completes, in phase branch:
git merge "worktree/${PHASE}-${PLAN_ID}" --no-ff
# If exit code 0: auto-merged (clean)
# If exit code != 0 (conflict): pause, show diff, wait for human
git worktree remove "$WORKTREE_DIR"
git branch -d "worktree/${PHASE}-${PLAN_ID}"
```

**N-way merge-back (critical):**

When Wave 1 has N parallel plans (e.g., 07-01 and 07-02), each gets its own worktree branch forked from the same base. After both complete, merges happen **sequentially into the phase branch**:
1. Merge worktree/07-01 → phase branch (may be clean)
2. Merge worktree/07-02 → phase branch (may conflict with 07-01's changes, even if both were clean against base)

"Auto-merge if clean" must be evaluated per-merge, not once globally. Step 2 can conflict even when step 1 was clean.

**Hook placement:** Worktree add before spawning executor. Merge-back after executor returns completion signal (existing SUMMARY.md spot-check). Worktree remove on success AND on failure (always clean up, even partial).

**Failure modes:**

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Executor crashes mid-task | SUMMARY.md missing, spot-check fails | `git worktree remove --force`, report to human |
| Merge conflict | `git merge` exits non-zero | Pause, `git diff HEAD..worktree-branch`, await human |
| Leftover worktrees (crashed orchestrator) | `git worktree list` at startup | `git worktree prune` at validate_phase step |
| Sandbox blocks `git worktree add` | Exit code + stderr message | Fall back to in-place (current behavior), warn user |

**Insert points in execute-phase.md:**
- `validate_phase` step: add `git worktree prune` call to clean leftovers from prior crashes
- `execute_waves` step 2: wrap executor spawn with worktree-add before and merge-back after
- `aggregate_results` step: confirm all worktrees removed
- New post-wave step after `aggregate_results`: doctor symmetry-check (scope 4)

**gsd-tools helper (recommended):** A `gsd-tools worktree` subcommand abstracting add/merge/remove/prune avoids repeating error-handling logic in prose. Proposed API:
```bash
gsd-tools worktree add <dir> <branch> [--base <branch>]  # → worktree-add + branch create
gsd-tools worktree merge <branch> [--target <branch>]    # → merge + clean-detect + return JSON {clean: bool, conflict_files: []}
gsd-tools worktree remove <dir> [--force]                # → worktree remove + branch delete
gsd-tools worktree prune                                  # → git worktree prune
```

**Source for technique details:** `get-shit-done/references/git-worktree.md` (Phase 6 artifact). Consume, do not re-derive. Specifically: Step 0 (detect existing isolation), ignore-check (`.worktrees/` must be in `.gitignore`), sandbox-fallback.

### Scope Item 2: Parallel-Safety Gate

**Axis-B (decision coupling) check:**

`roadmap.cjs` L125–126 already extracts `depends_on` per phase into the `phases[]` array from `cmdRoadmapAnalyze`. The field is a raw string like `"Phase 1, Phase 2"`. The gate parses the proposed parallel set and checks if any pair has a `depends_on` edge in either direction.

Logic:
```javascript
// Given phases A and B proposed for parallel execute/discuss/plan:
function hasDecisionCoupling(phaseA, phaseB, allPhases) {
  const a = allPhases.find(p => p.number === phaseA);
  const b = allPhases.find(p => p.number === phaseB);
  // Check A depends on B, or B depends on A
  return (a?.depends_on?.includes(phaseB)) || (b?.depends_on?.includes(phaseA));
}
```

Gate decision: axis B coupling → HARD REFUSE (for discuss/plan). For execute: also HARD REFUSE if axis B (decisions are baked into plans). For file-scope-only overlap (axis A): WARN only.

**Axis-A (file coupling) check:**

File-scope disjointness comes from the union of `files_modified` across each phase's plans (frontmatter field, already extracted by `phase-plan-index`). The Phase 4 dep-graph (`04-dependency-graph.json`) maps agent/workflow files to callers — useful for detecting transitive coupling (e.g., two phases both modify `roadmap.cjs` via separate callers). The graph alone does NOT answer "do these phases touch the same files" — it requires combining it with `files_modified`.

Computation:
```bash
# Get files_modified union for phase A:
FILES_A=$(node gsd-tools.cjs phase-plan-index 7 | jq '[.plans[].files_modified[]?] | unique')
FILES_B=$(node gsd-tools.cjs phase-plan-index 8 | jq '[.plans[].files_modified[]?] | unique')
# Overlap = intersection of FILES_A and FILES_B
```

**Gate invocation surface (where it fires):**

1. `discuss-phase.md` `build_understanding` step: before beginning discussion of phase N, check if another phase discussion is active (STATE.md status signal) AND if that phase has a `depends_on` edge to phase N or vice versa → HARD REFUSE.
2. `execute-phase.md` `handle_branching` step (or new `parallel_safety_check` step before): if invoked for a phase while STATE.md shows another phase executing → check axis B + axis A, refuse or warn accordingly.
3. `plan-phase.md`: same as discuss-phase check, at the plan-generation start.

**Gate as gsd-tools subcommand (recommended):**

```bash
gsd-tools parallel-safe <phaseA> <phaseB>
# → JSON: { safe: bool, axis_b_coupled: bool, axis_a_overlap: bool, overlap_files: [], decision: "refuse|warn|greenlight", reason: "..." }
```

This makes it testable in isolation.

### Scope Item 3: Todo Frontmatter Extension

**Current todo schema (from `add-todo.md` template and `init.cjs` `cmdInitTodos`):**

```yaml
---
created: [timestamp]
title: [title]
area: [area]
files:
  - [file:lines]
---
```

No formal `depends_on` or `related_to` fields. The CONTEXT.md notes an "informal `related:` line" seen in done/ todos — not found in the pending todos read during research (none had it). The informal precedent is weak; this is a clean schema addition.

**New schema:**

```yaml
---
created: [timestamp]
title: [title]
area: [area]
files:
  - [file:lines]
depends_on: []        # todo IDs or phase refs this must complete after
related_to: []        # todo IDs or phase refs that provide context
---
```

**Touch points:**

- `get-shit-done/workflows/add-todo.md` template block (lines ~90–108): add `depends_on` and `related_to` fields with empty defaults
- `get-shit-done/bin/lib/init.cjs` `cmdInitTodos` (L586–638): parse the new fields in the todo loop and expose them in the init JSON
- `get-shit-done/bin/lib/frontmatter.cjs` `FRONTMATTER_SCHEMAS` (~L266): there is no "todo" schema key currently — add one with the new fields, or document that todos are schema-free (the existing schemas are `plan`, `summary`, `verification`)
- Gate code that reads todos: must query `depends_on` from todo frontmatter to detect coupling between quick tasks

**Field value convention:** values can be todo file slugs (`260507-u0a`), phase refs (`phase:7`), or free text — keep flexible, parse loosely.

### Scope Item 4: Doctor Symmetry-Check

**Check specification (from CONTEXT.md decision):**

1. `diff -rq get-shit-done .claude/get-shit-done` — detects any file present in source but absent/different in runtime, or vice versa. The exception for agent files (path-token difference) must be excluded from the diff or the diff result must filter lines matching the agent files pattern.

   Agent files use `~/.claude/` token in source vs absolute path in runtime — `diff -rq` will always report them as different. Filter them:
   ```bash
   diff -rq get-shit-done .claude/get-shit-done 2>/dev/null \
     | grep -v "^Only in\|agents\/" \
     | head -20
   ```
   Alternatively, `--exclude` specific files.

2. settings.json hook/statusLine registration parity — verify every hook name in `get-shit-done/hooks/dist/` appears in `.claude/settings.json`; verify every statusLine entry registered matches the source.

**Integration points:**

- `get-shit-done/bin/lib/verify.cjs` `cmdValidateHealth`: add a new check function `checkSourceRuntimeSymmetry(cwd)` that runs both checks and returns findings in the same error/warning/info shape as existing checks. Insert before existing checks.
- `execute-phase.md` new post-merge step: call `gsd-tools validate health --symmetry-only` (or the full health check) after every worktree merge. This catches drift introduced during the merge itself.
- `/gsd2:health --repair`: repair action = `cp -r get-shit-done/* .claude/get-shit-done/` (with agent file exclusion). Risk: overwrites runtime customizations. Document clearly.

**Source-vs-runtime agent file exclusion pattern** (from STATE.md decision in Phase 3):

> PATH-TOKEN RULE: source agent uses `~/.claude/` token; runtime uses absolute path; `diff -q` not asserted for agent files.

So the symmetry check must skip files under `agents/` when comparing source vs runtime.

### Scope Item 5: Backlog ID Migration

**Current state (verified):**

- Two `999.x` directories exist: `.planning/v1.5/phases/999.1-doctor-source-runtime-symmetry-check/` (empty — folded into Phase 7) and `.planning/v1.5/phases/999.2-terse-output-default-verbose-opt-in/` (contains accumulated context from earlier).
- `add-backlog.md` (`.claude/commands/gsd2/add-backlog.md`) and `review-backlog.md` (`.claude/commands/gsd2/review-backlog.md`) both use `999*` patterns. Source equivalents do NOT exist in `get-shit-done/` — these commands live only in `.claude/commands/gsd2/`. They must be sourced from there and mirrored per the source↔runtime rule.

**Touch points:**

| File | Current reference | Change needed |
|------|-------------------|---------------|
| `.claude/commands/gsd2/add-backlog.md` | `phase next-decimal 999` to compute `999.N` | Change to new B-prefix allocation |
| `.claude/commands/gsd2/review-backlog.md` | `ls -d .planning/**/phases/999*` | Change glob to `B*` |
| `.planning/ROADMAP.md` | `## Backlog` section, `### Phase 999.1:`, `### Phase 999.2:` | Rename entries to `### B1:`, `### B2:` |
| `roadmap.cjs` L107 phase regex | `(\d+[A-Z]?(?:\.\d+)*)` | Review: this regex matches `999` but NOT `B1` (leading alpha). No change needed to stop parsing `B` IDs — they won't match. But the backlog section needs a distinct heading pattern so `cmdRoadmapAnalyze` doesn't lose the backlog entries. |
| `gsd-tools.cjs` `phase next-decimal` | Used by add-backlog for `999.N` allocation | Add new `phase next-backlog-id` subcommand returning `B1`, `B2`, etc. |

**Migration procedure for existing 999.x dirs:**

1. Rename `999.1-doctor-source-runtime-symmetry-check/` → remove entirely (content folded into Phase 7 scope; it was empty).
2. Rename `999.2-terse-output-default-verbose-opt-in/` → `B1-terse-output-default-verbose-opt-in/` (directory rename + ROADMAP.md entry update).
3. Update ROADMAP.md `## Backlog` section: `### Phase 999.2:` → `### B1: Terse output default + verbose opt-in`.

**Phase regex consideration:** `roadmap.cjs` L107 regex `(\d+[A-Z]?(?:\.\d+)*)` will NOT match `B1` (starts with alpha). The `cmdRoadmapAnalyze` function only looks for phase-heading patterns (`## Phase N:`) — backlog items under `## Backlog` with `### B1:` headings will simply not be parsed as phases. That is the correct outcome: backlog IDs are not phases. No regex change needed; the migration achieves phase-space separation automatically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Worktree lifecycle mgmt | Custom bash in workflow prose | `gsd-tools worktree` subcommand (thin wrapper around git + existing error-handling patterns) |
| Parallel-safe check | Ad-hoc dependency string parsing in multiple workflows | `gsd-tools parallel-safe <A> <B>` returning JSON — one place to test |
| Source-runtime diff | Custom file comparison logic | `diff -rq` with targeted exclusions |
| State detection ("phase executing?") | STATE.md status string parsing inline | `gsd-tools state json` already returns normalized `status` field — gate reads it via CLI |

---

## Common Pitfalls

### Pitfall 1: Treating STATE.md Status as a Reliable Execution Signal

**What goes wrong:** `state begin-phase` sets `Status: Executing Phase N`. `/gsd2:quick` reads this to decide whether to auto-worktree. A crashed orchestrator leaves the status set. `/gsd2:quick` always takes the worktree path, even in a fresh session with nothing running.

**Why it happens:** STATE.md is a human-readable log, not an atomic signal. There's no `state end-phase` that clears the "Executing" status (phase completion sets it to "Phase complete — ready for verification").

**How to avoid:** Gate uses `git worktree list` as the authoritative signal for "is something running in a worktree right now?" — worktrees disappear when cleaned up. STATE.md status is a hint, not ground truth. Quick check:
```bash
WORKTREES=$(git worktree list --porcelain | grep "^worktree " | grep -v "^worktree $(git rev-parse --show-toplevel)" | wc -l)
```
If `WORKTREES > 0`, something is running. Use both signals (worktree list AND STATE.md status) for defense in depth: either signal → take worktree path.

### Pitfall 2: Conflating Merge-Clean-Once with Per-Merge Clean Check

**What goes wrong:** Orchestrator checks if worktree branch is clean once (e.g., `git diff main...worktree/07-01`), then proceeds to merge all N worktrees auto. The second merge conflicts because both worktrees edited the same file from the same base.

**Why it happens:** Each worktree branches from the same base. They may be individually clean against base but conflict with each other when merged sequentially.

**How to avoid:** `gsd-tools worktree merge` must check the exit code of each individual `git merge` call, not pre-verify. Auto-merge decision is made per-merge, not globally.

### Pitfall 3: Symmetry-Check Fails on Every Agent File

**What goes wrong:** `diff -rq get-shit-done .claude/get-shit-done` always shows agents/ files as different (path token vs absolute path). Health check always reports "broken."

**Why it happens:** The PATH-TOKEN RULE: source uses `~/.claude/` token, runtime uses absolute path. This is intentional and correct — not drift.

**How to avoid:** Exclude `agents/` from the diff, or post-filter `diff` output to remove agent file lines. Document the exclusion in the check function.

### Pitfall 4: Gate Fires on Currently-Executing Phase's Own Plans (False Positive)

**What goes wrong:** `/gsd2:execute-phase 7` runs a plan. The gate sees STATE.md status="Executing Phase 7" and refuses to run because "Phase 7 is already executing."

**Why it happens:** The gate checks if the *same* phase is "executing" to prevent double-execution, but execute-phase legitimately re-enters for second/third waves.

**How to avoid:** Gate fires only on *different* phases, not the same one. Add: if `proposed_phase == currently_executing_phase`, skip the gate (you're continuing an in-progress execution, not a new parallel one).

### Pitfall 5: B-ID Backlog Items Parsed as Phase Numbers

**What goes wrong:** Some code tries to parse `B1` as a phase number, fails (expected integer), crashes.

**Why it happens:** `normalizePhaseName` in `roadmap.cjs` pads integer-like strings to two digits. `B1` is not integer-like.

**How to avoid:** The existing roadmap regex `(\d+[A-Z]?(?:\.\d+)*)` won't match `B1` — backlog entries under `## Backlog` with `### B1:` headings are invisible to the phase parser. Add a separate `cmdBacklogList` that reads the `## Backlog` section with a `B\d+` pattern. Do not route backlog IDs through the phase machinery.

---

## Code Examples

### Worktree Merge-Back with Clean Detection

```bash
# Source: git exit code semantics (documented behavior)
git merge "worktree/${PHASE}-${PLAN_ID}" --no-ff 2>&1
MERGE_EXIT=$?

if [ $MERGE_EXIT -eq 0 ]; then
  echo '{"clean": true, "action": "auto-merged"}'
else
  # Surface reviewable diff before pausing
  git diff HEAD.."worktree/${PHASE}-${PLAN_ID}" --stat 2>/dev/null
  echo '{"clean": false, "action": "conflict-paused"}'
  # Do NOT git merge --abort here — leave conflict state for human review
fi
```

### Phase Depends-On Extraction (existing, from roadmap.cjs L125–126)

```javascript
// Already implemented — reading roadmap.cjs confirms:
const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
const depends_on = dependsMatch ? dependsMatch[1].trim() : null;
// Returns string like "Phase 6, Phase 3" or null
```

### STATE.md Status Read (existing)

```bash
# gsd-tools state json already returns normalized status field
STATUS=$(node gsd-tools.cjs state json --raw | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.status||'unknown')})")
# Returns: 'executing', 'planning', 'verifying', 'paused', 'completed', 'unknown'
```

### Doctor Diff with Agent-File Exclusion

```bash
# Source: PATH-TOKEN RULE (STATE.md Phase 3 decision)
diff -rq get-shit-done .claude/get-shit-done \
  --exclude="*.md" \
  2>/dev/null | grep -v "agents/" \
  | head -50
# Note: --exclude="*.md" excludes agent MD files (path-token difference)
# Alternatively, filter agent paths post-diff
```

### Worktree Detection for Quick-Fix

```bash
# Count linked worktrees (excludes main worktree)
MAIN=$(git rev-parse --show-toplevel 2>/dev/null)
LINKED=$(git worktree list --porcelain 2>/dev/null | grep "^worktree " | grep -v "^worktree $MAIN" | wc -l | tr -d ' ')
if [ "$LINKED" -gt 0 ]; then
  echo "phase-running"
else
  echo "idle"
fi
```

---

## Open Questions

### Q1: Does the doctor diff scope to `get-shit-done/` only, or all of `.claude/`?

**What we know:** CONTEXT.md specifies `diff -rq get-shit-done .claude/get-shit-done`. This covers the main source↔runtime mirror for GSD scripts.

**What's unclear:** `settings.json` hooks/statusLine parity is a separate check (not covered by the file diff). The commands/ directory (`get-shit-done/commands/` source vs `.claude/commands/`) is also a mirror target — unclear if Phase 7 intends to check it too.

**Recommendation:** Keep scope exactly as CONTEXT.md states: `get-shit-done/` ↔ `.claude/get-shit-done/` for the diff check; settings.json hook registration parity as a separate named check. Commands/ directory is out of scope for Phase 7 (it is checked by Phase 1's hook-wiring work indirectly).

### Q2: Worktree dir placement: `.worktrees/` or `../worktrees/`?

**What we know:** `git-worktree.md` reference specifies `.worktrees/` at project root as the default (Step 1b priority 5). The ignore-check step requires `.worktrees/` be in `.gitignore` before creating a project-local worktree.

**What's unclear:** Whether `.planning/` is already in `.gitignore` (worktrees there would not need a separate ignore entry), or whether `.worktrees/` needs to be added.

**Recommendation:** Use `.worktrees/` at project root per the Phase 6 reference. Execute-phase should run the ignore-check (`git check-ignore -q .worktrees`) and add it to `.gitignore` if missing — this is already specified in the Phase 6 technique reference.

### Q3: How does `--no-verify` interact with worktrees?

**What we know:** Currently executors use `--no-verify` to avoid pre-commit hook contention on the shared tree. With separate worktrees, contention is eliminated.

**What's unclear:** Whether `--no-verify` is still needed. Pre-commit hooks on a worktree run from the worktree's directory — there is no contention between workers in separate worktrees.

**Recommendation:** Remove `--no-verify` from the executor prompt when using worktree isolation. Each worktree can run hooks cleanly. Keep `--no-verify` in the fallback in-place execution path. The post-wave hook validation step becomes redundant in worktree mode and can be skipped.

---

## Validation Architecture

**Framework:** node:test (built-in Node.js test runner — confirmed from `tests/roadmap.test.cjs` and `tests/frontmatter.test.cjs`)
**Config file:** none (`scripts/run-tests.cjs` auto-discovers `tests/*.test.cjs`)
**Quick run command:** `node --test tests/worktree.test.cjs tests/parallel-gate.test.cjs` (new files)
**Full suite command:** `npm test`

### Success Criterion → Test Map

| Success Criterion | Behavior to Test | Test Type | File | Automated Command |
|------------------|------------------|-----------|------|-------------------|
| SC-1: Quick-fix no longer silently overwrites concurrent phase | Worktree created when phase detected; conflict surfaces as merge (not silent overwrite) | Integration | `tests/worktree.test.cjs` | `node --test tests/worktree.test.cjs` |
| SC-2: Gate decides from depends_on + file-scope, refuses parallel discuss of dependent phases | Dependent phases → refuse; disjoint phases → greenlight; file-overlap only → warn | Unit | `tests/parallel-gate.test.cjs` | `node --test tests/parallel-gate.test.cjs` |
| SC-3: Todos carry depends_on/related_to and gate reads them | Todo frontmatter parse returns new fields; gate accepts todo edges as input | Unit | `tests/frontmatter.test.cjs` (extend) | `node --test tests/frontmatter.test.cjs` |
| SC-4: Doctor reports source↔runtime drift in one invocation | `validate health` check returns symmetry error when files differ; no error when synced; agent files excluded | Unit | `tests/verify-health.test.cjs` (extend) | `node --test tests/verify-health.test.cjs` |
| SC-5: Backlog ID scheme no longer reuses phase-number space | B-prefix IDs not parsed as phases by roadmap.cjs; `next-backlog-id` returns B1/B2 sequence | Unit | `tests/roadmap.test.cjs` (extend) | `node --test tests/roadmap.test.cjs` |

### Specific Test Cases

**SC-1 — Worktree integration test (create + force conflict + assert reviewable):**
```javascript
// tests/worktree.test.cjs
test('worktree merge-back: conflict surfaces reviewable diff, not silent overwrite', async () => {
  // Setup: temp git repo, two worktrees editing same file differently
  // Assert: gsd-tools worktree merge returns {clean: false}
  // Assert: git status shows unmerged paths (reviewable state)
  // Assert: original file is NOT silently overwritten to either version
});

test('worktree merge-back: clean merge auto-completes', async () => {
  // Setup: two worktrees editing disjoint files
  // Assert: gsd-tools worktree merge returns {clean: true}
  // Assert: both files present in merged branch
});
```

**SC-2 — Gate unit tests:**
```javascript
// tests/parallel-gate.test.cjs
test('gate: refuses dependent phases (axis B)', () => {
  // phases: [{number: '7', depends_on: 'Phase 6'}, {number: '6', depends_on: null}]
  // Assert: parallel-safe(6, 7) → {safe: false, axis_b_coupled: true, decision: 'refuse'}
});

test('gate: warns on file overlap (axis A)', () => {
  // phases with overlapping files_modified but no depends_on edge
  // Assert: parallel-safe → {safe: false, axis_a_overlap: true, decision: 'warn'}
});

test('gate: greenlights truly disjoint phases', () => {
  // phases with no depends_on edge AND disjoint files_modified
  // Assert: parallel-safe → {safe: true, decision: 'greenlight'}
});
```

**SC-4 — Symmetry check:**
```javascript
// Extend tests/verify-health.test.cjs
test('symmetry check: reports error when source has file missing in runtime', async () => {
  // Setup: temp dirs, get-shit-done/ has extra file absent in .claude/get-shit-done/
  // Assert: validate health returns error containing 'source-runtime-drift'
});

test('symmetry check: excludes agents/ from diff (PATH-TOKEN RULE)', async () => {
  // Setup: agents/ file differs between source/runtime (intentional path token diff)
  // Assert: validate health does NOT report it as drift
});
```

### Sampling Rate

- Per task commit: `node --test tests/worktree.test.cjs tests/parallel-gate.test.cjs` (new tests only, fast)
- Per wave merge: `npm test` (full suite)
- Phase gate: full suite green before `/gsd2:verify-work`

### Wave 0 Gaps (new test files needed before implementation)

- [ ] `tests/worktree.test.cjs` — worktree lifecycle + merge-back + conflict detection (SC-1)
- [ ] `tests/parallel-gate.test.cjs` — gate unit tests (SC-2)
- [ ] `tests/helpers.cjs` may need a `createTempGitRepo()` helper (check if already exists)

Existing test files to extend:
- [ ] `tests/frontmatter.test.cjs` — add todo `depends_on`/`related_to` parse cases (SC-3)
- [ ] `tests/verify-health.test.cjs` — add symmetry-check cases (SC-4)
- [ ] `tests/roadmap.test.cjs` — add B-prefix non-parsing cases + `next-backlog-id` (SC-5)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Parallel executors on shared tree with `--no-verify` | Each executor in own linked worktree, merges back at end | Conflicts become explicit merges instead of silent overwrites |
| `999.x` backlog IDs look like phase numbers | `B1, B2` IDs outside phase-number space | Backlog items no longer confusable with real phases |
| No parallel-safety gate | Deterministic gate checks `depends_on` + file-scope before allowing concurrent work | Prevents invisible knowledge coupling |

---

## Sources

### Primary (HIGH confidence)

- Direct read of `get-shit-done/workflows/execute-phase.md` — execute_waves L176–351, handle_branching L123, aggregate_results L494, sync_sidecars L760–822
- Direct read of `get-shit-done/bin/lib/roadmap.cjs` — phase parser L107, depends_on extraction L125–126
- Direct read of `get-shit-done/bin/lib/state.cjs` — writeStateMd L748, cmdStateBeginPhase L821, status normalization L679–694
- Direct read of `get-shit-done/bin/lib/verify.cjs` — verify.cjs L390–391 (wave/depends_on consistency), health error schema
- Direct read of `get-shit-done/bin/lib/frontmatter.cjs` — FRONTMATTER_SCHEMAS L265 (plan/summary/verification; no todo schema)
- Direct read of `get-shit-done/bin/lib/init.cjs` — cmdInitTodos L586–638
- Direct read of `get-shit-done/references/git-worktree.md` — Phase 6 technique reference
- Direct read of `.claude/commands/gsd2/add-backlog.md` and `review-backlog.md` — actual 999* glob locations
- Direct read of `tests/roadmap.test.cjs` — confirms node:test framework
- `find .planning/ -type d -name "999*"` — confirms two existing 999.x dirs
- `.planning/v1.5/phases/07-parallel-multi-session-safety-planning-ergono/07-CONTEXT.md` — locked decisions, canonical refs

### Secondary (MEDIUM confidence)

- git worktree merge exit-code semantics (exit 0 = clean, non-zero = conflict): documented behavior, not verified via primary docs in this session but well-established
- `diff -rq` exit codes and behavior: POSIX standard, well-established

---

## Metadata

**Confidence breakdown:**

- Worktree orchestration sequence: HIGH — derived from reading execute-phase.md + git-worktree.md; N-way merge reasoning is standard git semantics
- Gate implementation: HIGH — depends_on extraction verified in roadmap.cjs; axis-A computation design is derived but logical
- Doctor check: HIGH — diff -rq + settings.json parity is a deterministic filesystem operation; agent exclusion rule confirmed from STATE.md Phase 3 decision
- Todo frontmatter extension: HIGH — schema is clean-slate addition; no existing todo schema in frontmatter.cjs
- Backlog migration: HIGH — touch points verified by reading actual command files; regex behavior confirmed by reading roadmap.cjs L107
- Detection signal (STATE.md vs git worktree list): MEDIUM — STATE.md is stale-prone (confirmed from code); git worktree list as corroborating signal is design recommendation, not a verified prior pattern in this codebase

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable internal codebase; no external libraries to track)
