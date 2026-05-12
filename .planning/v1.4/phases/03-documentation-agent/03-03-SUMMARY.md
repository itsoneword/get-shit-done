---
phase: 03-documentation-agent
plan: 03
subsystem: documentation
tags: [workflow, documentation-agent, mermaid, wikilinks, system-map, milestone-hook]

requires:
  - phase: 03-01
    provides: init document CLI, gsd-document-mapper agent, gsd-document-updater agent
  - phase: 03-02
    provides: /gsd2:document command stub pointing to this workflow
provides:
  - End-to-end /gsd2:document workflow (FULL / INCREMENTAL / TARGETED modes)
  - Parallel mapper spawn for FULL runs; two-pass propose/apply updater for INCREMENTAL
  - ensure_codebase_maps sub-invocation for projects without .planning/codebase/
  - docs/SYSTEM-MAP.md with Mermaid + wikilinks + append-only changelog
  - docs/system/{slug}.md per-subsystem files with sourced claims
  - docs/system/_gaps.md subsystem-grouped gap tracker
  - complete-milestone offer_documentation pre-archive hook (non-blocking, --skip-docs honored)
affects: [future docs iteration, on-demand refresh UX, milestone archival flow]

tech-stack:
  added: []
  patterns:
    - "Two-pass diff preview: agent writes docs/system/_proposed.md (pass 1 propose), orchestrator shows to user, agent applies + cleans up (pass 2 apply)"
    - "Orchestrator never reads agent-produced document bodies — only confirmations"
    - "Milestone hook as suggestion not gate: prompts user, never invokes /gsd2:document inline (avoids blocking archival on doc errors)"
    - "Append-only changelog at root SYSTEM-MAP.md, one entry per run with ISO date + trigger"
    - "Obsidian [[wikilinks]] for all inter-doc navigation"

key-files:
  created:
    - get-shit-done/workflows/document.md
    - .claude/get-shit-done/workflows/document.md
    - docs/SYSTEM-MAP.md (produced by end-to-end run)
    - docs/system/*.md (7 subsystems produced by end-to-end run)
    - docs/system/_gaps.md
  modified:
    - get-shit-done/workflows/complete-milestone.md (offer_documentation step inserted)
    - .claude/get-shit-done/workflows/complete-milestone.md (mirror)
    - .claude/get-shit-done/agents/gsd-document-mapper.md (writing-style guidance, out-of-band)
    - .claude/get-shit-done/agents/gsd-document-updater.md (writing-style guidance, out-of-band)
    - .gitignore (legacy docs/*.md excluded in favor of auto-gen tree, out-of-band)

key-decisions:
  - "Locked _proposed.md scratch-file pattern for all diff previews (consistency + multi-file safety over inline diffs)"
  - "Milestone hook is a manual prompt instructing user to run /gsd2:document separately — not inline invocation (deferred until UX friction observed)"
  - "_gaps.md uses subsystem-grouped sections"
  - "discover_subsystems is agent-reconciled — orchestrator seeds a heuristic list, first mapper agent may refine"

patterns-established:
  - "Workflow orchestration: 11 named steps (init_context, parse_arguments, decide_mode, ensure_codebase_maps, discover_subsystems, spawn_full_mappers, write_root_map, spawn_incremental_updater, verify_outputs, commit, summarize)"
  - "Mode decision tree: --phase N rejected; --full OR !root_map_exists → FULL; --subsystem → TARGETED; no activity + last_run_iso → y/n prompt default n; else INCREMENTAL"
  - "Pre-archive documentation suggestion in complete-milestone (offer_documentation between reorganize_roadmap and archive_milestone)"

requirements-completed: [DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06]

duration: ~2h (including checkpoint resolution + out-of-band improvements)
completed: 2026-04-17
---

# Phase 03 Plan 03: Document workflow orchestration + milestone hook Summary

**End-to-end /gsd2:document workflow wiring init+mapper+updater primitives into FULL/INCREMENTAL/TARGETED modes, plus non-blocking offer_documentation hook before milestone archival — verified by generating 7-subsystem SYSTEM-MAP on this repo**

## Performance

- **Duration:** ~2h (including human-verify checkpoint + out-of-band fixes)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 4 (workflows dual-copy pair x2) + out-of-band agent + .gitignore edits

## Accomplishments
- Full /gsd2:document workflow (all 11 orchestration steps) composing Plan 01 primitives + Plan 02 command stub into user-facing behavior
- complete-milestone pre-archive doc-refresh prompt (non-blocking, --skip-docs honored)
- End-to-end validation: 7 subsystems mapped, docs/SYSTEM-MAP.md + docs/system/*.md produced with Mermaid diagrams, sourced claims, wikilinks
- All six DOCS-0X requirements satisfied by observable behavior

## Task Commits

1. **Task 1: Write workflows/document.md orchestration** — `13a4f7d` (feat)
2. **Task 2: Insert offer_documentation into complete-milestone.md** — `d132f8e` (feat)
3. **Task 3: End-to-end verification** — manual checkpoint, user-approved

**Out-of-band commits (made during checkpoint resolution):**
- `54af065` — feat(03-01): writing-style guidance added to document-mapper/updater personas
- `3c27b34` — docs: replace legacy docs/*.md with auto-generated docs/system/ tree (.gitignore update)

## Files Created/Modified
- `get-shit-done/workflows/document.md` — 11-step orchestration file
- `.claude/get-shit-done/workflows/document.md` — byte-identical runtime mirror
- `get-shit-done/workflows/complete-milestone.md` — offer_documentation step inserted between reorganize_roadmap and archive_milestone
- `.claude/get-shit-done/workflows/complete-milestone.md` — runtime mirror
- `docs/SYSTEM-MAP.md` — produced by workflow (Mermaid + wikilinks + changelog)
- `docs/system/*.md` — 7 subsystem files with sourced claims
- `docs/system/_gaps.md` — subsystem-grouped gap tracker

## Decisions Made
- Locked _proposed.md scratch-file for all diff previews (resolving RESEARCH.md Open Question 1)
- Milestone hook uses manual prompt not inline invocation (resolving Open Question 2, avoiding Pitfall 5)
- _gaps.md uses subsystem-grouped sections (Open Question 4)
- Orchestrator seeds heuristic subsystem list; first mapper may reconcile (Assumption 3)

## Deviations from Plan

### Out-of-band improvements during checkpoint resolution

**1. [Quality refinement] Writing-style guidance added to document-mapper/updater personas**
- **Found during:** Task 3 end-to-end run — initial generated docs read as mechanical enumerations rather than narrative explanations
- **Fix:** Added writing-style rules to both agent persona files prescribing explanatory prose over bullet lists, clear subject/verb/purpose framing, reader-first phrasing
- **Files modified:** `.claude/get-shit-done/agents/gsd-document-mapper.md`, `.claude/get-shit-done/agents/gsd-document-updater.md` (and source mirrors)
- **Scope note:** Touches Plan 03-01 agent files; classified as Rule 2 (missing critical — persona output quality below acceptance bar) rather than Rule 4 because it refines an existing persona contract rather than changing architecture
- **Committed in:** `54af065`

**2. [Cleanup] Legacy docs/*.md replaced by auto-generated docs/system/ tree**
- **Found during:** Task 3 end-to-end run — pre-existing hand-written docs/*.md files were stale and would confuse readers now that auto-gen is the source of truth
- **Fix:** Gitignored legacy docs/*.md files; docs/SYSTEM-MAP.md + docs/system/ tree is now the canonical documentation surface
- **Committed in:** `3c27b34`

---

**Total deviations:** 2 out-of-band improvements applied during checkpoint resolution
**Impact on plan:** Both are quality/cleanup refinements surfaced by running the workflow end-to-end. No scope creep; both necessary to satisfy the checkpoint's semantic-quality bar ("user confirms the generated map is coherent, sourced, and matches locked decisions").

## Issues Encountered
None beyond the two deviations above (both resolved inline during checkpoint).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 03 (documentation-agent) is complete; all six DOCS requirements satisfied
- /gsd2:document is production-ready on this repo
- Future refinement candidates: inline milestone-hook invocation once UX friction observed; tighter mapper reconciliation of discover_subsystems output

---
*Phase: 03-documentation-agent*
*Completed: 2026-04-17*

## Self-Check: PASSED
- All referenced files exist (workflow source + runtime mirror + SUMMARY)
- All four commits resolved in git log (13a4f7d, d132f8e, 54af065, 3c27b34)
