---
phase: 04-verification-harness-and-context-efficiency
plan: 02
subsystem: tooling
tags: [dependency-graph, agents, workflows, gsd-tools, discovery]

# Dependency graph
requires:
  - phase: 04-verification-harness-and-context-efficiency
    provides: Phase 04 RESEARCH §4 schema spec and grep recipes
provides:
  - Machine-readable JSON map of every caller/callee inside .claude/ tree
  - Human-readable companion summary with per-agent / per-tool sections
  - Risk Surface analysis for the loop primitives (verifier/debugger/fixer)
affects: [04-03-loop-primitive-adaptation, 04-01-context-efficiency]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-level caller graph emitted as JSON + matching markdown"
    - "Subcommand call-site detection via regex tolerant to quoted absolute paths"

key-files:
  created:
    - .planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.json
    - .planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.md
  modified: []

key-decisions:
  - "File-level granularity only (not line numbers) — keeps graph readable and stable across edits"
  - "Scope strictly .claude/agents/, .claude/get-shit-done/, .claude/commands/ — exclude .planning/, worktrees/, gsd-local-patches/, node_modules/, .git/"
  - "Subcommand detection regex allows optional close-quote between gsd-tools.cjs and the verb (workflows wrap the path in double quotes)"
  - "Tools inventory curated from gsd-tools.cjs argv routing + lib cmd functions, including init namespace and verify/state/phase/roadmap/frontmatter/template/validate/scaffold subcommands"

patterns-established:
  - "Dependency-graph artifact pattern: JSON + companion markdown with hand-curated Risk Surface section for downstream implementer"

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-05-07
---

# Phase 4 Plan 02: Dependency Graph Summary

**Machine-readable map of 22 agents, 51 workflows, and 87 gsd-tools subcommands plus a hand-curated risk-surface analysis for the gsd-verifier / gsd-debugger / gsd-fixer trio**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-07T16:38:00Z
- **Completed:** 2026-05-07T17:02:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Indexed every agent, workflow, and gsd-tools subcommand in `.claude/` with caller / spawn-site / include lists
- Confirmed all three loop primitives (gsd-verifier, gsd-debugger, gsd-fixer) have non-zero caller lists, so Plan 04-03 has a complete risk surface
- Produced both machine-readable JSON (for tooling) and human-readable markdown (for plan readers) so downstream consumers don't re-run greps

## Counts

| Dimension              | Count |
|------------------------|-------|
| Agents indexed         | 22    |
| Workflows indexed      | 51    |
| Tool subcommands       | 87    |
| Tools with ≥1 caller   | 63    |
| Tools with 0 callers   | 24    |

## Top 3 Highest-Callsite Agents

1. **gsd-planner** — 20 callers (hub agent invoked from plan-phase, verify-work, quick, discuss-phase, multiple researcher agents, model-profiles registry, planner-subagent-prompt template)
2. **gsd-executor** — 11 callers (execute-phase, execute-plan, quick, ui-researcher, test-designer, model-profiles, AGENTIC-PATTERNS reference)
3. **gsd-phase-researcher** — 9 callers (research-phase, plan-phase, execute-phase, discuss-phase, command/research-phase, init.cjs, model-profiles registry, context.md template)

## Top 3 Highest-Callsite Tool Subcommands

1. **commit** — 41 callers (used by virtually every workflow that produces planning artifacts)
2. **init phase-op** — 15 callers (entry point for phase add/insert/remove/complete commands and workflows)
3. **roadmap get-phase** — 11 callers (used wherever a workflow needs a single phase's roadmap row)

## Risk Callouts for Plan 04-03

The trio that 04-03 must adapt in-place. Standalone callers below MUST keep working unchanged.

### gsd-verifier

- **Spawn sites (Task() invocations):**
  - `.claude/get-shit-done/workflows/execute-phase.md` (verify_phase_goal step at end of waves)
  - `.claude/get-shit-done/workflows/quick.md` (one-shot verify path)
- **Other references (must remain compatible):**
  - `.claude/agents/gsd-plan-checker.md` (cross-references verifier output shape)
  - `.claude/get-shit-done/bin/lib/init.cjs` (model resolution)
  - `.claude/get-shit-done/bin/lib/model-profiles.cjs` (registry)
  - `.claude/get-shit-done/references/model-profiles.md` (docs)
- **Implication:** Loop-mode adaptation must be additive. The standalone `## Verification Complete` block must survive untouched; loop output goes in a new `## LOOP VERIFY RESULT` block.

### gsd-debugger

- **Spawn sites:**
  - `.claude/get-shit-done/workflows/diagnose-issues.md`
  - `.claude/commands/gsd2/debug.md`
  - `.claude/get-shit-done/templates/debug-subagent-prompt.md`
- **Other references:**
  - `.claude/get-shit-done/bin/lib/model-profiles.cjs`
  - `.claude/get-shit-done/references/model-profiles.md`
  - `.claude/get-shit-done/workflows/execute-phase.md` (referenced for diagnose handoff path)
- **Implication:** The existing `goal: find_root_cause_only` and `symptoms_prefilled: true` flags already exist and are consumed. 04-03 should reuse these flags for the loop-investigator role rather than introducing a new mode.

### gsd-fixer

- **Spawn sites:**
  - `.claude/commands/gsd2/fix.md` (the only existing spawn site)
- **Other references:**
  - `.claude/get-shit-done/bin/lib/model-profiles.cjs`
- **Implication:** Today fixer has only a single direct caller. Extending `## FIXES COMPLETE` with a `loop_iteration: N` field is safe as long as existing keys remain. The model-profiles registry needs no change if the agent is adapted in-place rather than forked.

### Cross-cutting

- All three agents are listed in `.claude/get-shit-done/bin/lib/model-profiles.cjs` (canonical) and `.claude/get-shit-done/references/model-profiles.md` (docs). If 04-03 forks new variants (e.g. `gsd-loop-verifier`), both files need updating. In-place adaptation is the cheaper path.

## Task Commits

Each task's deliverable was emitted via `gsd-tools commit --no-verify`. Both returned `skipped_gitignored` because `.planning/` is in `.gitignore` for this repo — this is the configured behavior for planning artifacts in GSD's host repo, not a failure. The deliverables persist on disk and are picked up by downstream plans via path reference.

1. **Task 1: Build the JSON dependency graph** — gsd-tools commit reason: `skipped_gitignored` (artifact at `.planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.json`)
2. **Task 2: Generate human-readable graph summary** — gsd-tools commit reason: `skipped_gitignored` (artifact at `.planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.md`)

## Files Created/Modified

- `.planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.json` — JSON graph with `agents`, `workflows`, `tools` top-level keys
- `.planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.md` — Markdown companion with per-agent / per-workflow / per-tool sections plus Risk Surface block

## Decisions Made

- **Subcommand inventory curated from CLI source, not exported list.** The bin/gsd-tools.cjs argv switch is the source of truth; lib `cmd*` functions don't always map 1:1 to subcommands (e.g. `cmdInitProgress` → `init progress`). Curated 87 subcommands across all namespaces (state, phase, roadmap, requirements, milestone, validate, verify, frontmatter, template, init, scaffold, plus standalone verbs).
- **Subcommand caller regex tolerates quoted absolute path.** Workflows invoke `gsd-tools.cjs` with the full absolute path wrapped in double quotes (`node "/Users/.../gsd-tools.cjs" init progress`). The naive `gsd-tools.cjs <verb>` substring match misses these; switched to a regex that allows optional `["']` between path and verb.
- **gsd-fixer model-profiles caller is excluded as "spawn site" but kept as caller.** model-profiles.cjs lists all agents for resolution but doesn't spawn them. Distinguishing `callers` (any reference) from `spawned_by` (Task() invocations) makes the Risk Surface clearer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Subcommand caller regex missed quoted-path invocations**
- **Found during:** Task 1 verification step (acceptance criterion `init progress` callers > 0 returned `false`)
- **Issue:** First-pass `content.includes('gsd-tools.cjs init progress')` fails for `node "/abs/path/gsd-tools.cjs" init progress` because of the closing double-quote.
- **Fix:** Replaced with regex `gsd-tools\.cjs["']?\s+<subcommand>\b` to match both quoted and unquoted invocations.
- **Files modified:** `/tmp/build-graph.cjs` (build script, not part of deliverable)
- **Verification:** Re-ran the script; `init progress` now has 1 caller (`workflows/progress.md`) and the seven required subcommand acceptance checks all pass.
- **Committed in:** N/A (build script is not part of repo; deliverable JSON regenerated)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for Task 1 acceptance criteria. No scope creep.

## Issues Encountered

- **`gsd-tools verify artifacts` and `verify key-links` returned schema errors** for this plan's frontmatter (`No must_haves.artifacts found`). Inspecting `frontmatter get` showed the parser flattens nested array-of-object structures into single-string entries, so it can't see `path:` fields under `must_haves.artifacts`. This is a pre-existing CLI limitation affecting all plans with structured `must_haves`, not specific to this work. The plan's verify checks documented in frontmatter (`jq` queries on the JSON) all pass, which is the meaningful signal.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-03 implementer can now answer "who else calls gsd-verifier/debugger/fixer?" by reading the JSON without re-running greps.
- The Risk Surface section of the markdown enumerates every standalone caller of the trio, so loop-mode adaptation can preserve those interfaces.
- Re-running the build script regenerates the JSON deterministically — same keys and same caller orderings (every list is sorted).

## Self-Check: PASSED

- Files exist:
  - FOUND: `.planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.json`
  - FOUND: `.planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.md`
- Acceptance criteria checks:
  - `jq -e '.'` exits 0 — JSON valid
  - `.agents | length` = 22 (≥ 15)
  - `.agents["gsd-verifier"].callers | length` = 6 (>0)
  - `.agents["gsd-debugger"].callers | length` = 6 (>0)
  - `.agents["gsd-fixer"].callers | length` = 2 (>0)
  - `.workflows["execute-phase.md"].callers | length` > 0
  - `.tools["init progress"].callers | length` = 1 (>0)
  - No paths starting with `.planning/`, `worktrees/`, `node_modules/` in any callers list
  - `git diff --stat .claude/` empty — no source files modified
  - `grep -c '^### gsd-' 04-dependency-graph.md` = 25 (≥ 15)
  - `^## Workflows`, `^## Tools`, `^## Risk Surface for Plan 04-03` all present
  - Risk Surface mentions trio ≥ 3 times (4 mentions counted)

---
*Phase: 04-verification-harness-and-context-efficiency*
*Completed: 2026-05-07*
