---
phase: 03-documentation-agent
plan: 01
subsystem: infra
tags: [init-cjs, model-profiles, agent-personas, documentation]

requires:
  - phase: 02-agent-spec
    provides: Validated AGENT-SPEC discovery pattern for domain-specific planning artifacts
provides:
  - init document compound command returning 17-key state JSON
  - gsd-document-mapper and gsd-document-updater model profile entries (sonnet/sonnet/haiku)
  - gsd-document-mapper persona (parallel, single-subsystem writer)
  - gsd-document-updater persona (two-pass incremental editor)
affects: [03-02 workflow, 03-03 milestone-hook, /gsd2:document]

tech-stack:
  added: []
  patterns:
    - "Compound init command pattern extended to include activity-signal computation (commits_since, new_summaries, completed_phases_since, new_todos)"
    - "Two-pass agent contract (propose → apply) enforced via mode field and _proposed.md scratch file"
    - "Citation-per-claim enforced in agent prompts with _gaps.md aggregation fallback"

key-files:
  created:
    - agents/gsd-document-mapper.md
    - agents/gsd-document-updater.md
  modified:
    - get-shit-done/bin/lib/init.cjs (cmdInitDocument + export)
    - get-shit-done/bin/gsd-tools.cjs (router case 'document' + JSDoc)
    - get-shit-done/bin/lib/model-profiles.cjs (two new entries)
    - get-shit-done/references/model-profiles.md (two new table rows)

key-decisions:
  - "existing_subsystems filter excludes both _gaps.md AND _proposed.md (not just _gaps.md as referenced in RESEARCH.md skeleton) because _proposed.md is an updater scratch file, not a subsystem"
  - "new_todos uses git log --numstat to sum additions under .planning/todos/ — aligns with Pitfall 3 (scope inference false negative) mitigation"
  - "completed_phases_since emits ALL [x] phases from ROADMAP (not filtered by git-blame date) — orchestrator compares against the last-run map to compute the delta"
  - "Mapper tools: Read, Bash, Grep, Glob, Write (no Edit); Updater tools add Edit for surgical pass-2 edits"

patterns-established:
  - "Dual-copy invariant: every edit to get-shit-done/** and agents/** is mirrored byte-for-byte to .claude/get-shit-done/** and .claude/agents/** respectively"
  - "Agent persona structure: <role> + <why_your_output_matters> + <guidelines> + <input_contract> + <output_template|output_template_reference>"
  - "Activity-signal computation lives in init.cjs, not in the workflow — keeps workflow file declarative"

requirements-completed: [DOCS-01, DOCS-04, DOCS-06]

duration: 8min
completed: 2026-04-17
---

# Phase 3 Plan 1: Documentation Agent Foundation Summary

**Primitives for the /gsd2:document workflow: init document state contract, two new model-profile entries, and mapper/updater persona files enforcing wikilinks, citation-per-claim, and append-only changelogs.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-17T20:32:00Z
- **Completed:** 2026-04-17T20:40:13Z
- **Tasks:** 3
- **Files modified:** 6 (4 source + 2 new persona files)

## Accomplishments

- `init document` compound command operational — returns exact 17-key JSON contract the Plan 03 workflow will consume (mapper_model, updater_model, commit_docs, docs_dir, system_dir, root_map_path, gaps_path, root_map_exists, system_dir_exists, existing_subsystems, last_run_iso, has_planning, has_codebase_maps, commits_since, new_summaries, completed_phases_since, new_todos).
- Model profiles registered: `gsd-document-mapper` and `gsd-document-updater` resolve sonnet/sonnet/haiku under quality/balanced/budget — mirroring the mapping-class cost curve used for `gsd-codebase-mapper` but with a higher balanced tier because narrative writing needs more reasoning than structural extraction.
- Mapper persona enforces Obsidian wikilinks, mermaid-per-subsystem, per-claim citation, and `_gaps.md` aggregation under `## Subsystem: {slug}` headings.
- Updater persona enforces two-pass contract (propose writes `_proposed.md`, apply reads it + deletes it), append-only changelog at root `SYSTEM-MAP.md`, and the existing-filename-is-source-of-truth rule for subsystem naming.

## Task Commits

1. **Task 1: Add cmdInitDocument and wire into CLI router** — `89106ff` (feat)
2. **Task 2: Register gsd-document-mapper and gsd-document-updater in model profiles** — `c318d03` (feat)
3. **Task 3: Create gsd-document-mapper and gsd-document-updater persona files** — `6ce7a34` (feat)

**Plan metadata commit:** (appended by orchestrator after this SUMMARY.md)

## Files Created/Modified

- `get-shit-done/bin/lib/init.cjs` — added `cmdInitDocument` (112 lines) computing activity signals from git + filesystem; exported at bottom of module.
- `get-shit-done/bin/gsd-tools.cjs` — added `case 'document'` to init router; JSDoc help lists `document`; error message updated.
- `get-shit-done/bin/lib/model-profiles.cjs` — two new entries under `MODEL_PROFILES`, placed immediately after `gsd-codebase-mapper`.
- `get-shit-done/references/model-profiles.md` — two new rows in the profile table for discoverability.
- `agents/gsd-document-mapper.md` — new persona (107 lines): single-subsystem parallel mapper.
- `agents/gsd-document-updater.md` — new persona (129 lines): two-pass incremental updater.
- `.claude/get-shit-done/bin/lib/init.cjs`, `.claude/get-shit-done/bin/gsd-tools.cjs`, `.claude/get-shit-done/bin/lib/model-profiles.cjs`, `.claude/get-shit-done/references/model-profiles.md`, `.claude/agents/gsd-document-mapper.md`, `.claude/agents/gsd-document-updater.md` — byte-identical mirrors of the above (runtime copies, gitignored).

## Decisions Made

- **Subsystems exclude `_proposed.md` as well as `_gaps.md`** — `_proposed.md` is a scratch file written by the updater on pass 1 and deleted on pass 2. Including it would cause the orchestrator to treat it as a subsystem once the updater has run. The RESEARCH.md skeleton only excluded `_gaps.md`; fixing this here prevents a latent bug in Plan 03.
- **`completed_phases_since` returns all `[x]` phases, not a date-filtered subset** — simpler, and the orchestrator already has `last_run_iso` to diff against a prior map snapshot. Date-filtering ROADMAP entries by git blame would add complexity without improving the signal.
- **Reference table in `get-shit-done/references/model-profiles.md` kept in sync** — the file comment in `model-profiles.cjs` calls it out as a parallel source of truth, so drift would surface as user confusion.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<action>` text called out the `_proposed.md` exclusion explicitly, so even though RESEARCH.md's skeleton missed it, the plan was correct.

## Issues Encountered

- `.claude/**` is gitignored in this repo (runtime copies are not versioned). First commit attempt with `.claude/` paths in `git add` failed. Resolution: committed only source files (`get-shit-done/**` and `agents/**`); runtime mirrors exist locally for immediate testing but will be regenerated by `install.js` on user installation. This matches the pattern in recent commits (`6996932`, `d268932`).

## User Setup Required

None — foundation-layer primitives only. Nothing user-facing until Plan 03 wires them into `/gsd2:document`.

## Next Phase Readiness

- Plan 02 (workflow file) can now call `gsd-tools.cjs init document` to bootstrap.
- Plan 02 can spawn `gsd-document-mapper` and `gsd-document-updater` via Task with resolved model names.
- Persona prompts enforce every locked decision from `03-CONTEXT.md`, so the workflow file can delegate behavioral correctness to the agents rather than embedding rules in the orchestrator.

## Self-Check

- [x] `get-shit-done/bin/lib/init.cjs` contains `cmdInitDocument` (verified via `grep -c`)
- [x] `get-shit-done/bin/gsd-tools.cjs` contains `case 'document':` (verified via `grep`)
- [x] `get-shit-done/bin/lib/model-profiles.cjs` contains both new entries (verified via Node one-liner)
- [x] `agents/gsd-document-mapper.md` and `agents/gsd-document-updater.md` exist
- [x] `.claude/` mirrors byte-identical to `get-shit-done/` and `agents/` sources (verified via `diff`)
- [x] `node .claude/get-shit-done/bin/gsd-tools.cjs init document --raw` returns JSON with all 17 keys
- [x] Commits `89106ff`, `c318d03`, `6ce7a34` exist in git log

## Self-Check: PASSED

---
*Phase: 03-documentation-agent*
*Completed: 2026-04-17*
