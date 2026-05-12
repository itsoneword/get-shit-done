---
phase: 02-agent-spec
plan: 03
subsystem: agent-spec workflow + command surface
tags: [agent-spec, workflow, slash-command, discuss-phase, orchestration]
dependency_graph:
  requires:
    - 02-01 (AGENT-SPEC.md template + AGENTIC-PATTERNS.md reference)
    - 02-02 (gsd-agent-researcher / gsd-agent-checker model profiles, workflow.agent_spec config keys, init has_agent_spec discovery)
  provides: [SPEC-02, SPEC-03]
  affects: [discuss-phase next-steps display, /gsd2 command surface]
tech_stack:
  added: []
  patterns:
    - "Inline researcher/checker prompt definition inside workflow file (mirrors ui-phase.md, no separate agent .md needed)"
    - "12-step researcher -> checker -> revision loop orchestration with config gate, existing-spec handling, and force-approve escape"
key_files:
  created:
    - get-shit-done/workflows/agent-spec-phase.md
    - commands/gsd2/agent-spec-phase.md
  modified:
    - get-shit-done/workflows/discuss-phase.md
decisions:
  - "Researcher and checker personas are defined inline in agent-spec-phase.md prompts, not as separate agent .md files (matches ui-phase.md convention)"
  - "Checker uses binary criteria (PASS/FLAG/FAIL) per dimension rather than soft scoring -- prevents underspecified specs from passing"
  - "Observability dimension treats 'TBD' or 'standard logging' as automatic FAIL -- forces concrete tracing tool + boundary log + failure path"
  - "discuss-phase change is additive (one line) rather than restructuring -- agent-spec command is shown alongside ui-phase, not as a replacement"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-17"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
requirements_addressed: [SPEC-02, SPEC-03]
---

# Phase 02 Plan 03: Agent-Spec Workflow and Command Surface Summary

Wired the user-facing surface for AGENT-SPEC: a 12-step orchestration workflow (`agent-spec-phase.md`) that spawns the consultant-character researcher and the binary-criteria checker registered in Plan 02, plus the `/gsd2:agent-spec-phase` slash command and discuss-phase next-steps line that exposes it.

## What Was Built

### Task 1 -- agent-spec-phase.md workflow (commit b938bb0)

- **`get-shit-done/workflows/agent-spec-phase.md`** -- 12-step workflow mirroring `ui-phase.md` structure exactly:
  1. Initialize (init plan-phase, resolve gsd-agent-researcher/checker, check workflow.agent_spec)
  2. Parse and Validate Phase
  3. Check Prerequisites (CONTEXT.md, RESEARCH.md as warnings)
  4. Check Existing AGENT-SPEC (Update / View / Skip)
  5. Spawn gsd-agent-researcher with inline consultant-character prompt (challenges overcomplicated topology, references AGENTIC-PATTERNS.md, enforces no-empty-section rule)
  6. Handle Researcher Return (COMPLETE vs BLOCKED)
  7. Spawn gsd-agent-checker with inline 10-dimension binary-criteria prompt
  8. Handle Checker Return (VERIFIED vs ISSUES FOUND)
  9. Revision Loop (max 2 iterations, then Force approve / Edit / Abandon)
  10. Present Final Status with `/gsd2:plan-phase` next-up
  11. Commit AGENT-SPEC.md via gsd-tools commit
  12. Update State with stopped_at + resume_file

The researcher prompt embeds the senior-consultant character verbatim from CONTEXT.md (challenges LangGraph-for-linear-pipelines, forces observability decisions per agent boundary, draws topology examples from AGENTIC-PATTERNS.md). The checker dimension definitions are binary -- Dimension 6 Observability requires (a) named tracing tool, (b) boundary log per agent pair, (c) failure diagnosis path; missing any one -> FAIL.

### Task 2 -- Command and discuss-phase trigger (commit 6996932)

- **`commands/gsd2/agent-spec-phase.md`** -- New slash command. Frontmatter (name/description/argument-hint/allowed-tools including Task and AskUserQuestion) and body (objective + execution_context with workflow + AGENTIC-PATTERNS @-refs + process) follow `commands/gsd2/ui-phase.md` structure.
- **`get-shit-done/workflows/discuss-phase.md`** -- One-line addition in the `auto_advance` next-steps display, immediately after the existing `/gsd2:ui-phase` line. Additive change so the UI flow is untouched. The domain router (Phase 1) already classifies the domain into CONTEXT.md; this surfaces the command when agentic.

## Commits

| Task | Commit  | Files |
|------|---------|-------|
| 1 -- Workflow file | b938bb0 | get-shit-done/workflows/agent-spec-phase.md |
| 2 -- Command + discuss-phase line | 6996932 | commands/gsd2/agent-spec-phase.md, get-shit-done/workflows/discuss-phase.md |

## Verification Results

All plan-defined verification commands ran clean:
- `grep -c "^## " agent-spec-phase.md` -> 13 (12 numbered steps + the literal `## Next Up` heading inside the Step 10 display banner). Matches ui-phase.md exactly (also 13 with the same banner heading) -- the plan's "expect 12" was a counting oversight; structurally there are 12 steps as required.
- `grep "gsd-agent-researcher"` -> 6 matches (>=3 required)
- `grep "gsd-agent-checker"` -> 5 matches (>=2 required)
- `grep "AGENTIC-PATTERNS"` -> 6 matches (>=2 required)
- `grep "workflow.agent_spec"` -> 2 matches (>=1 required)
- `grep "Dimension 6 Observability"` -> 1 match
- `grep "revision_count"` -> 3 matches
- `grep "AGENT-SPEC VERIFIED"` -> 2 matches
- `grep "senior agentic systems consultant"` -> 1 match
- Command file: workflow @-ref present (2 matches), AGENTIC-PATTERNS @-ref present (1 match)
- discuss-phase: agent-spec-phase line is exactly one line below ui-phase line (verified via `grep -A1`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan verify expected H2 count of 12, actual is 13**
- **Found during:** Task 1 verification
- **Issue:** Plan said `grep -c "^## " agent-spec-phase.md` should return 12 (one per step). Actual returns 13 because the Step 10 display banner contains a literal `## Next Up` heading inside a code-fenced block-style example.
- **Fix:** No code change. Cross-checked ui-phase.md (the canonical pattern) -- it also returns 13 for the same reason. The 12 numbered steps are all present and correctly ordered. Plan's verify count was off by one; the structure matches the canonical pattern.
- **Files modified:** none
- **Commit:** n/a

## Deferred Issues

None. Pre-existing test failures noted by Plan 02-02 are still present in the working tree (unrelated to this plan).

## User Setup Required

None -- this plan is purely additive markdown/command authoring. The command becomes available immediately on next session for projects with this version of GSD installed.

## Next Phase Readiness

- All 6 SPEC-* requirements (SPEC-01 through SPEC-06) for Phase 02 are now addressed across Plans 01-03.
- The full discuss -> agent-spec -> plan -> execute flow is wired:
  - discuss-phase classifies domain (Phase 1) and surfaces `/gsd2:agent-spec-phase` (Plan 03)
  - `/gsd2:agent-spec-phase` runs researcher + checker against template (Plan 01) using model profiles + config keys (Plan 02)
  - plan-phase step 5.6 reads has_agent_spec from init.cjs (Plan 02) and includes AGENT_SPEC_PATH in planner prompt
- No blockers. Phase 02 is ready for `/gsd2:transition`.

## Self-Check: PASSED

- [x] FOUND: get-shit-done/workflows/agent-spec-phase.md (12 numbered steps, all required content)
- [x] FOUND: commands/gsd2/agent-spec-phase.md (frontmatter + body matching ui-phase.md structure)
- [x] FOUND: discuss-phase.md updated (agent-spec-phase line present, ui-phase line preserved)
- [x] FOUND commit: b938bb0 (Task 1)
- [x] FOUND commit: 6996932 (Task 2)
- [x] All verify-block grep commands return at-or-above expected counts (12-vs-13 discrepancy explained against canonical ui-phase.md baseline)

---
*Phase: 02-agent-spec*
*Completed: 2026-04-17*
