---
phase: 03-execution-detail-enrichment
plan: "02"
subsystem: references/planner-wiring
tags: [anti-patterns, python, planner, dual-tree, on-demand]
dependency_graph:
  requires: []
  provides:
    - get-shit-done/references/universal-anti-patterns.md
    - agents/gsd-planner.md (code_quality_reference block)
  affects:
    - gsd-planner agent (on-demand code-quality standard)
tech_stack:
  added: []
  patterns:
    - on-demand Read pointer in agent definition (mirrors tdd.md idiom)
    - dual-tree byte-identical prose doc with PATH-TOKEN divergence for agent file
key_files:
  created:
    - get-shit-done/references/universal-anti-patterns.md
    - .claude/get-shit-done/references/universal-anti-patterns.md (runtime, gitignored)
  modified:
    - agents/gsd-planner.md
    - .claude/agents/gsd-planner.md (runtime, gitignored)
decisions:
  - "PATH-TOKEN RULE honored: source agent uses ~/.claude/ token; runtime uses absolute path; diff -q intentionally NOT asserted for agent files"
  - "Dangling refs neutralized: context-budget.md (reshaped out) and ios-scaffold.md (fork-absent) references removed from ported rules 3, 6, 28"
  - "planner-antipatterns.md content folded as ## Planner Anti-Patterns — no third standalone file created"
metrics:
  duration: "17 minutes"
  completed: "2026-06-04"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 03 Plan 02: Universal Anti-Patterns + Planner Wiring Summary

**One-liner:** universal-anti-patterns.md ported from gsd-core, planner-antipatterns folded in, Python idioms/typing added, on-demand pointer wired into gsd-planner agent definition.

## What Was Built

### Task 1: universal-anti-patterns.md (both trees)

Created `get-shit-done/references/universal-anti-patterns.md` and its byte-identical runtime copy.

- **Ported rules 1-29 verbatim** from `/home/cleversol/gsd2/core/gsd-core/references/universal-anti-patterns.md`, preserving all section headers and numbering.
- **Neutralized three dangling doc references** that would point at files absent from this fork:
  - Rule 3: removed trailing "See references/context-budget.md" sentence; trimmed tier prescription to a neutral single line.
  - Rule 6: removed the `< 500000` threshold tier wording (references a non-existent live classifier table); kept the intent (scale read depth to budget).
  - Rule 28 (iOS): removed trailing "See references/ios-scaffold.md" sentence.
- **Folded planner-antipatterns.md** as `## Planner Anti-Patterns` section — four subsections: Checkpoint Anti-Patterns, Specificity Examples, Context Section Anti-Patterns, Scope Reduction Anti-Patterns. No third standalone file created.
- **Added `## Python Anti-Patterns and Good Practices`** with three subsections:
  - Anti-Patterns (bare except, list mutation during iteration, range(len), str concatenation in loops, mutable defaults)
  - Idioms (comprehensions, with, enumerate/zip, dataclasses/NamedTuple, pathlib.Path)
  - Typing Conventions (annotate public sigs, Optional/X|None, Sequence/Mapping, TypedDict, future annotations)

Commit: `ab18b05`

### Task 2: on-demand pointer in gsd-planner.md (both trees)

Added `<code_quality_reference>` block between `</discovery_levels>` and `<task_design>` in both source and runtime agent definitions.

- **Source** (`agents/gsd-planner.md`): uses `~/.claude/` tilde token, matching the source tree's existing path convention.
- **Runtime** (`.claude/agents/gsd-planner.md`): uses absolute path `/home/cleversol/gsd2/mine/.claude/...` as install.js would expand it.
- Block is on-demand (no `@` prefix) — the planner reads the doc only when making code-quality judgments, keeping planning context lean.
- plan-phase.md was NOT modified (text outside the constructed prompt block never reaches the spawned agent).

Commit: `f226fcd`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rule 6 tier wording neutralized in addition to rule 3 and rule 28**
- **Found during:** Task 1 — reading the plan's action spec for rule 3 fix
- **Issue:** The plan's action for rule 3 also called for fixing rule 6's `at context_window < 500000 …` tier wording, which references the same absent context-budget.md table via a live classifier check.
- **Fix:** Rewrote rule 6 to say "read frontmatter only from prior phase SUMMARYs when context is tight; full body reads are permitted for direct-dependency phases when budget allows" — preserves intent without the non-existent table reference. This was explicitly called out in the plan action spec so it is expected behavior, not an unplanned deviation.
- **Files modified:** get-shit-done/references/universal-anti-patterns.md (and runtime copy)
- **Commit:** ab18b05

No architectural deviations. Plan executed exactly as written.

## Verification Results

All 9 acceptance criteria passed:
1. `test -f get-shit-done/references/universal-anti-patterns.md` — PASS
2. `test -f .claude/get-shit-done/references/universal-anti-patterns.md` — PASS
3. `diff -q` byte-identical — PASS
4. `grep -F '## Python'` — PASS
5. `grep -F '## Planner Anti-Patterns'` — PASS
6. `grep -iE 'typing|TypedDict|Optional'` — PASS
7. Source planner pointer (tilde token) — PASS
8. Runtime planner pointer (absolute path) — PASS
9. No third planner-antipatterns.md file — PASS

## Self-Check: PASSED

- `get-shit-done/references/universal-anti-patterns.md` — FOUND
- `.claude/get-shit-done/references/universal-anti-patterns.md` — FOUND
- Commit ab18b05 — FOUND
- Commit f226fcd — FOUND
