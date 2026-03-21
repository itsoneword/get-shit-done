<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean — delegates plan execution to subagents.
</purpose>

<core_principle>
Orchestrator coordinates, not executes. Each subagent loads the full execute-plan context. Orchestrator: discover plans, analyze deps, group waves, spawn agents, handle checkpoints, collect results.
</core_principle>

<runtime_compatibility>
Subagent spawning is runtime-specific:
- **Claude Code:** Uses `Task(subagent_type="gsd-executor", ...)` — blocks until complete, returns result.
- **Copilot:** Subagent completion signals are unreliable. Default to sequential inline execution: read and follow execute-plan.md directly for each plan. Only attempt parallel spawning if the user explicitly requests it.
- **Other runtimes (Gemini, Codex, OpenCode):** If Task/subagent API is unavailable, fall back to sequential inline execution.

**Completion verification fallback:** If a spawned agent finishes its work (commits visible, SUMMARY.md exists) but the orchestrator never receives the completion signal, treat it as successful based on filesystem/git state. Never block indefinitely waiting for a signal.
</runtime_compatibility>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<available_agent_types>
Valid GSD subagent types registered in .claude/agents/ (or equivalent). Always use exact names:

- gsd-executor — Executes plan tasks, commits, creates SUMMARY.md
- gsd-verifier — Verifies phase completion, checks quality gates
- gsd-planner — Creates detailed plans from phase scope
- gsd-phase-researcher — Researches technical approaches for a phase
- gsd-plan-checker — Reviews plan quality before execution
- gsd-debugger — Diagnoses and fixes issues
- gsd-codebase-mapper — Maps project structure and dependencies
- gsd-integration-checker — Checks cross-phase integration
- gsd-nyquist-auditor — Validates verification coverage
- gsd-ui-researcher — Researches UI/UX approaches
- gsd-ui-checker — Reviews UI implementation quality
- gsd-ui-auditor — Audits UI against design requirements
</available_agent_types>

<process>

<step name="initialize" priority="first">
Load all context in one call:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `executor_model`, `verifier_model`, `commit_docs`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`.

**Error conditions:**
- `phase_found` is false: phase directory not found.
- `plan_count` is 0: no plans found in phase.
- `state_exists` is false but `.planning/` exists: offer reconstruct or continue.

When `parallelization` is false, plans within a wave execute sequentially.

**Copilot runtime detection:**
Check if the current runtime is Copilot (test for `@gsd-executor` agent pattern or absence of `Task()` API). If Copilot, force sequential inline execution regardless of `parallelization` setting. Set `COPILOT_SEQUENTIAL=true` internally and use `check_interactive_mode`'s inline path for each plan.

**Sync chain flag with intent.** When invoked manually (no `--auto`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This prevents stale `_auto_chain_active: true` from causing unwanted auto-advance. This does not touch `workflow.auto_advance` (the user's persistent preference).

```bash
# Prevents stale auto-chain from previous --auto runs
if [[ ! "$ARGUMENTS" =~ --auto ]]; then
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
fi
```
</step>

<step name="check_interactive_mode">
Parse `--interactive` flag from $ARGUMENTS.

If present, switch to interactive execution mode — plans execute sequentially inline (no subagent spawning) with user checkpoints between tasks.

**Interactive execution flow:**

1. Load plan inventory as normal (discover_and_group_plans).
2. For each plan sequentially (ignoring wave grouping):

   a. Present the plan:
      ```
      ## Plan {plan_id}: {plan_name}

      Objective: {from plan file}
      Tasks: {task_count}

      Options:
      - Execute (proceed with all tasks)
      - Review first (show task breakdown before starting)
      - Skip (move to next plan)
      - Stop (end execution, save progress)
      ```

   b. If "Review first": display the full plan file, then ask: Execute, Modify, or Skip.

   c. If "Execute": read and follow `~/.claude/get-shit-done/workflows/execute-plan.md` inline (no subagent). Execute tasks one at a time.

   d. After each task: pause briefly. If the user intervenes, address their feedback before continuing.

   e. After plan complete: show results, commit, create SUMMARY.md, then present next plan.

3. After all plans: proceed to verification (same as normal mode).

Interactive mode is best for small phases, bug fixes, verification gaps, and learning GSD — it avoids subagent overhead and lets the user catch mistakes early.

Skip to handle_branching step (interactive plans execute inline after grouping).
</step>

<step name="handle_branching">
Check `branching_strategy` from init:

- **"none":** Skip, continue on current branch.
- **"phase" or "milestone":** Use pre-computed `branch_name`:
```bash
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```

All subsequent commits go to this branch. User handles merging.
</step>

<step name="validate_phase">
From init JSON: `phase_dir`, `plan_count`, `incomplete_count`.

Report: "Found {plan_count} plans in {phase_dir} ({incomplete_count} incomplete)"

Update STATE.md for phase start:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state begin-phase --phase "${PHASE_NUMBER}" --name "${PHASE_NAME}" --plans "${PLAN_COUNT}"
```
This updates Status, Last Activity, Current focus, Current Position, and plan counts so STATE.md reflects the active phase immediately.
</step>

<step name="discover_and_group_plans">
Load plan inventory with wave grouping:

```bash
PLAN_INDEX=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

Parse JSON for: `phase`, `plans[]` (each with `id`, `wave`, `autonomous`, `objective`, `files_modified`, `task_count`, `has_summary`), `waves` (map of wave number to plan IDs), `incomplete`, `has_checkpoints`.

**Filtering:** Skip plans where `has_summary: true`. If `--gaps-only`: also skip non-gap_closure plans. If all filtered: "No matching incomplete plans" and exit.

Report:
```
## Execution Plan

**Phase {X}: {Name}** — {total_plans} plans across {wave_count} waves

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1 | 01-01, 01-02 | {from plan objectives, 3-8 words} |
| 2 | 01-03 | ... |
```
</step>

<step name="execute_waves">
Execute each wave in sequence. Within a wave: parallel if `PARALLELIZATION=true`, sequential if `false`.

**For each wave:**

1. **Describe what's being built before spawning.** Read each plan's `<objective>`, extract what's being built and why.

   ```
   ---
   ## Wave {N}

   **{Plan ID}: {Plan Name}**
   {2-3 sentences: what this builds, technical approach, why it matters}

   Spawning {count} agent(s)...
   ---
   ```

   Example of what to aim for:
   - Weak: "Executing terrain generation plan"
   - Strong: "Procedural terrain generator using Perlin noise — creates height maps, biome zones, and collision meshes. Required before vehicle physics can interact with ground."

2. **Spawn executor agents.** Pass paths only — executors read files themselves with their fresh context window. This keeps orchestrator context lean (~10-15% for 200k models). For 1M+ models (Opus 4.6, Sonnet 4.6), richer context can be passed directly.

   ```
   Task(
     subagent_type="gsd-executor",
     model="{executor_model}",
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
       </objective>

       <parallel_execution>
       You are running as a PARALLEL executor agent. Use --no-verify on all git
       commits to avoid pre-commit hook contention with other agents. The
       orchestrator validates hooks once after all agents complete.
       For gsd-tools commits: add --no-verify flag.
       For direct git commits: use git commit --no-verify -m "..."
       </parallel_execution>

       <execution_context>
       @~/.claude/get-shit-done/workflows/execute-plan.md
       @~/.claude/get-shit-done/templates/summary.md
       @~/.claude/get-shit-done/references/checkpoints.md
       @~/.claude/get-shit-done/references/tdd.md
       </execution_context>

       <files_to_read>
       Read these files at execution start using the Read tool:
       - {phase_dir}/{plan_file} (Plan)
       - .planning/PROJECT.md (Project context — core value, requirements, evolution rules)
       - .planning/STATE.md (State)
       - .planning/config.json (Config, if exists)
       - ./CLAUDE.md (Project instructions, if exists — follow project-specific guidelines)
       - .claude/skills/ or .agents/skills/ (Project skills, if either exists — list skills, read SKILL.md for each)
       </files_to_read>

       <mcp_tools>
       If CLAUDE.md or project instructions reference MCP tools (e.g. jCodeMunch, context7),
       prefer those over Grep/Glob for code navigation when available — they save tokens
       by providing structured code indexes. Check tool availability first; fall back to
       Grep/Glob if MCP tools are not accessible.
       </mcp_tools>

       <success_criteria>
       - [ ] All tasks executed
       - [ ] Each task committed individually
       - [ ] SUMMARY.md created in plan directory
       - [ ] STATE.md updated with position and decisions
       - [ ] ROADMAP.md updated with plan progress (via `roadmap update-plan-progress`)
       </success_criteria>
     "
   )
   ```

3. **Wait for all agents in wave to complete.**

   **Completion signal fallback** (applies to all runtimes for resilience):

   If a spawned agent does not return a completion signal, verify via spot-checks:

   ```bash
   SUMMARY_EXISTS=$(test -f "{phase_dir}/{plan_number}-{plan_padded}-SUMMARY.md" && echo "true" || echo "false")
   COMMITS_FOUND=$(git log --oneline --all --grep="{phase_number}-{plan_padded}" --since="1 hour ago" | head -1)
   ```

   - SUMMARY.md exists AND commits found: agent completed successfully. Log: `"Plan {ID} completed (verified via spot-check)"` and proceed.
   - SUMMARY.md missing after reasonable wait: check `git log --oneline -5` for recent activity. If commits still appearing, wait longer. If no activity, report as failed and route to failure handler.

4. **Post-wave hook validation (parallel mode only):**

   When agents committed with `--no-verify`, run pre-commit hooks once after the wave:
   ```bash
   git diff --cached --quiet || git stash
   git hook run pre-commit 2>&1 || echo "Pre-commit hooks failed — review before continuing"
   ```
   If hooks fail: report the failure and ask "Fix hook issues now?" or "Continue to next wave?"

5. **Spot-check SUMMARY.md claims:**

   For each SUMMARY.md:
   - Verify first 2 files from `key-files.created` exist on disk
   - Check `git log --oneline --all --grep="{phase}-{plan}"` returns at least 1 commit
   - Check for `## Self-Check: FAILED` marker

   If any spot-check fails: report which plan failed, ask "Retry plan?" or "Continue with remaining waves?"

   If all pass, report what was built:
   ```
   ---
   ## Wave {N} Complete

   **{Plan ID}: {Plan Name}**
   {What was built — from SUMMARY.md}
   {Notable deviations, if any}

   {If more waves: what this enables for next wave}
   ---
   ```

   Example:
   - Weak: "Wave 2 complete. Proceeding to Wave 3."
   - Strong: "Terrain system complete — 3 biome types, height-based texturing, physics collision meshes. Vehicle physics (Wave 3) can now reference ground surfaces."

6. **Handle failures:**

   **classifyHandoffIfNeeded bug:** If an agent reports "failed" with error containing `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug, not a GSD issue. The error fires in the completion handler after all tool calls finish. Run the same spot-checks — if they pass, treat as successful. If they fail, treat as real failure.

   For real failures: report which plan failed, ask "Continue?" or "Stop?" If continue, note that dependent plans may also fail. If stop, create partial completion report.

7. **Pre-wave dependency check (waves 2+ only):**

    Before spawning wave N+1, verify cross-plan wiring:
    ```bash
    node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify key-links {phase_dir}/{plan}-PLAN.md
    ```

    If any key-link from a prior wave's artifact fails verification:

    ```
    ## Cross-Plan Wiring Gap

    | Plan | Link | From | Expected Pattern | Status |
    |------|------|------|-----------------|--------|
    | {plan} | {via} | {from} | {pattern} | NOT FOUND |

    Wave {N} artifacts may not be properly wired. Options:
    1. Investigate and fix before continuing
    2. Continue (may cause cascading failures in wave {N+1})
    ```

    Key-links referencing files in the current (upcoming) wave are skipped.

8. **Execute checkpoint plans between waves** — see `<checkpoint_handling>`.

9. **Proceed to next wave.**
</step>

<checkpoint_handling>
Plans with `autonomous: false` require user interaction.

**Auto-mode checkpoint handling:**

Read auto-advance config:
```bash
AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```

When executor returns a checkpoint AND (`AUTO_CHAIN` or `AUTO_CFG` is `"true"`):
- **human-verify** — Auto-approve and spawn continuation. Log `Auto-approved checkpoint`.
- **decision** — Auto-select first option and spawn continuation. Log `Auto-selected: [option]`.
- **human-action** — Present to user. Auth gates cannot be automated.

**Standard flow (not auto-mode, or human-action type):**

1. Spawn agent for checkpoint plan.
2. Agent runs until checkpoint task or auth gate, returns structured state.
3. Agent return includes: completed tasks table, current task + blocker, checkpoint type/details, what's awaited.
4. Present to user:
   ```
   ## Checkpoint: [Type]

   **Plan:** 03-03 Dashboard Layout
   **Progress:** 2/3 tasks complete

   [Checkpoint Details from agent return]
   [Awaiting section from agent return]
   ```
5. User responds: "approved"/"done" | issue description | decision selection.
6. Spawn continuation agent (not resume — resume relies on internal serialization that breaks with parallel tool calls; fresh agents with explicit state are more reliable) using continuation-prompt.md template:
   - `{completed_tasks_table}`: From checkpoint return
   - `{resume_task_number}` + `{resume_task_name}`: Current task
   - `{user_response}`: What user provided
   - `{resume_instructions}`: Based on checkpoint type
7. Continuation agent verifies previous commits, continues from resume point.
8. Repeat until plan completes or user stops.

**Checkpoints in parallel waves:** Agent pauses and returns while other parallel agents may complete. Present checkpoint, spawn continuation, wait for all before next wave.
</checkpoint_handling>

<step name="aggregate_results">
After all waves:

```markdown
## Phase {X}: {Name} Execution Complete

**Waves:** {N} | **Plans:** {M}/{total} complete

| Wave | Plans | Status |
|------|-------|--------|
| 1 | plan-01, plan-02 | Complete |
| CP | plan-03 | Verified |
| 2 | plan-04 | Complete |

### Plan Details
1. **03-01**: [one-liner from SUMMARY.md]
2. **03-02**: [one-liner from SUMMARY.md]

### Issues Encountered
[Aggregate from SUMMARYs, or "None"]
```
</step>

<step name="close_parent_artifacts">
For decimal/polish phases only (X.Y pattern): close the feedback loop by resolving parent UAT and debug artifacts.

Skip if phase number has no decimal (e.g., `3`, `04`) — only applies to gap-closure phases like `4.1`, `03.1`.

1. **Detect decimal phase and derive parent:**
```bash
if [[ "$PHASE_NUMBER" == *.* ]]; then
  PARENT_PHASE="${PHASE_NUMBER%%.*}"
fi
```

2. **Find parent UAT file:**
```bash
PARENT_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase "${PARENT_PHASE}" --raw)
# Extract directory from PARENT_INFO JSON, then find UAT file
```

If no parent UAT found, skip this step (gap-closure may have been triggered by VERIFICATION.md instead).

3. **Update UAT gap statuses:** Read the parent UAT file's `## Gaps` section. For each gap with `status: failed`, update to `status: resolved`.

4. **Update UAT frontmatter:** If all gaps now resolved, update `status: diagnosed` to `status: resolved` and update `updated:` timestamp.

5. **Resolve referenced debug sessions:** For each gap with a `debug_session:` field, update the debug session's `status:` to `resolved`, update its timestamp, and move to resolved directory:
```bash
mkdir -p .planning/debug/resolved
mv .planning/debug/{slug}.md .planning/debug/resolved/
```

6. **Commit updated artifacts:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-${PARENT_PHASE}): resolve UAT gaps and debug sessions after ${PHASE_NUMBER} gap closure" --files .planning/phases/*${PARENT_PHASE}*/*-UAT.md .planning/debug/resolved/*.md
```
</step>

<step name="regression_gate">
Run prior phases' test suites to catch cross-phase regressions before verification.

Skip if this is the first phase (no prior phases) or no prior VERIFICATION.md files exist.

1. **Discover prior phases' test files:**
```bash
PRIOR_VERIFICATIONS=$(find .planning/phases/ -name "*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*" 2>/dev/null)
```

2. **Extract test file lists from prior verifications.** Look for:
   - Lines containing `test`, `spec`, or `__tests__` paths
   - "Test Suite" or "Automated Checks" sections
   - File patterns from `key-files.created` in SUMMARY.md files matching `*.test.*` or `*.spec.*`

   Collect all unique test file paths into `REGRESSION_FILES`.

3. **Run regression tests (if any found):**
```bash
if [ -f "package.json" ]; then
  npx jest ${REGRESSION_FILES} --passWithNoTests --no-coverage -q 2>&1 || npx vitest run ${REGRESSION_FILES} 2>&1
elif [ -f "Cargo.toml" ]; then
  cargo test 2>&1
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  python -m pytest ${REGRESSION_FILES} -q --tb=short 2>&1
fi
```

4. **Report results:**

   All pass:
   ```
   Regression gate: {N} prior-phase test files passed — no regressions detected
   ```
   Proceed to verify_phase_goal.

   Any fail:
   ```
   ## Cross-Phase Regression Detected

   Phase {X} execution may have broken functionality from prior phases.

   | Test File | Phase | Status | Detail |
   |-----------|-------|--------|--------|
   | {file} | {origin_phase} | FAILED | {first_failure_line} |

   Options:
   1. Fix regressions before verification (recommended)
   2. Continue to verification anyway (regressions will compound)
   3. Abort phase — roll back and re-plan
   ```
</step>

<step name="verify_phase_goal">
Verify the phase achieved its goal, not just completed tasks.

```
Task(
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md — every ID should be accounted for.
Create VERIFICATION.md.",
  subagent_type="gsd-verifier",
  model="{verifier_model}"
)
```

Read status:
```bash
grep "^status:" "$PHASE_DIR"/*-VERIFICATION.md | cut -d: -f2 | tr -d ' '
```

| Status | Action |
|--------|--------|
| `passed` | Proceed to update_roadmap |
| `human_needed` | Present items for human testing, get approval or feedback |
| `gaps_found` | Present gap summary, offer `/gsd2:plan-phase {phase} --gaps` |

**If human_needed:**

Step A: Persist human verification items as UAT file. Create `{phase_dir}/{phase_num}-HUMAN-UAT.md`:

```markdown
---
status: partial
phase: {phase_num}-{phase_name}
source: [{phase_num}-VERIFICATION.md]
started: [now ISO]
updated: [now ISO]
---

## Current Test

[awaiting human testing]

## Tests

{For each human_verification item from VERIFICATION.md:}

### {N}. {item description}
expected: {expected behavior from VERIFICATION.md}
result: [pending]

## Summary

total: {count}
passed: 0
issues: 0
pending: {count}
skipped: 0
blocked: 0

## Gaps
```

Commit:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test({phase_num}): persist human verification items as UAT" --files "{phase_dir}/{phase_num}-HUMAN-UAT.md"
```

Step B: Present to user:
```
## Phase {X}: {Name} — Human Verification Required

All automated checks passed. {N} items need human testing:

{From VERIFICATION.md human_verification section}

Items saved to `{phase_num}-HUMAN-UAT.md` — they will appear in `/gsd2:progress` and `/gsd2:audit-uat`.

"approved" → continue | Report issues → gap closure
```

If user says "approved": proceed to `update_roadmap`. The HUMAN-UAT.md file persists with `status: partial` and surfaces in future progress checks until the user runs `/gsd2:verify-work`.

If user reports issues: proceed to gap closure.

**If gaps_found:**
```
## Phase {X}: {Name} — Gaps Found

**Score:** {N}/{M} must-haves verified
**Report:** {phase_dir}/{phase_num}-VERIFICATION.md

### What's Missing
{Gap summaries from VERIFICATION.md}

---
## Next Up

`/gsd2:plan-phase {X} --gaps`

<sub>`/clear` first for a fresh context window</sub>

Also: `cat {phase_dir}/{phase_num}-VERIFICATION.md` — full report
Also: `/gsd2:verify-work {X}` — manual testing first
```

Gap closure cycle: `/gsd2:plan-phase {X} --gaps` reads VERIFICATION.md, creates gap plans with `gap_closure: true`, user runs `/gsd2:execute-phase {X} --gaps-only`, verifier re-runs.
</step>

<step name="update_roadmap">
Mark phase complete and update all tracking files:

```bash
COMPLETION=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase complete "${PHASE_NUMBER}")
```

The CLI handles: marking phase checkbox `[x]` with date, updating Progress table, advancing STATE.md to next phase, updating REQUIREMENTS.md traceability, scanning for verification debt (returns `warnings` array).

Extract from result: `next_phase`, `next_phase_name`, `is_last_phase`, `warnings`, `has_warnings`.

If `has_warnings`:
```
## Phase {X} marked complete with {N} warnings:

{list each warning}

These items are tracked and will appear in `/gsd2:progress` and `/gsd2:audit-uat`.
```

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>

<step name="update_project_md">
Evolve PROJECT.md to reflect phase completion. Without this step, PROJECT.md drifts silently over multiple phases.

1. Read `.planning/PROJECT.md`
2. If the file has a `## Validated Requirements` or `## Requirements` section:
   - Move requirements validated by this phase from Active to Validated
   - Add: `Validated in Phase {X}: {Name}`
3. If the file has a `## Current State` section:
   - Update to reflect phase completion (e.g., "Phase {X} complete — {one-liner}")
4. Update the `Last updated:` footer to today's date
5. Commit:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-{X}): evolve PROJECT.md after phase completion" --files .planning/PROJECT.md
```

Skip this step if `.planning/PROJECT.md` does not exist.
</step>

<step name="offer_next">

**Exception:** If `gaps_found`, the `verify_phase_goal` step already presents the gap-closure path. Skip auto-advance.

**If `--no-transition` flag present:**

Execute-phase was spawned by plan-phase's auto-advance. After verification passes and roadmap is updated, return completion status and stop:

```
## PHASE COMPLETE

Phase: ${PHASE_NUMBER} - ${PHASE_NAME}
Plans: ${completed_count}/${total_count}
Verification: {Passed | Gaps Found}

[Include aggregate_results output]
```

**If `--no-transition` flag is not present:**

Check auto-advance:

1. Parse `--auto` flag from $ARGUMENTS
2. Read config:
   ```bash
   AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true (and verification passed):**

```
AUTO-ADVANCING → TRANSITION
Phase {X} verified, continuing chain
```

Execute the transition workflow inline (orchestrator context is ~10-15%, transition needs phase completion data already in context): read and follow `~/.claude/get-shit-done/workflows/transition.md`, passing through the `--auto` flag so it propagates to the next phase.

**Otherwise, present options and wait:**

There is no `/gsd2:transition` command — transition is internal only.

```
## Phase {X}: {Name} Complete

/gsd2:progress — see updated roadmap
/gsd2:discuss-phase {next} — discuss next phase before planning
/gsd2:plan-phase {next} — plan next phase
/gsd2:execute-phase {next} — execute next phase
```
</step>

</process>

<context_efficiency>
Orchestrator: ~10-15% context for 200k windows, can use more for 1M+ windows.
Subagents: fresh context each (200k-1M depending on model). No polling (Task blocks). No context bleed.

For 1M+ context models:
- Pass richer context (code snippets, dependency outputs) directly to executors instead of just file paths
- Run small phases (3 plans or fewer, no dependencies) inline without subagent overhead
- Relax /clear recommendations — context rot onset is much further out with 5x window
</context_efficiency>

<failure_handling>
- **classifyHandoffIfNeeded false failure:** Agent reports "failed" but error is `classifyHandoffIfNeeded is not defined` — Claude Code bug, not GSD. Spot-check SUMMARY + commits; if pass, treat as success.
- **Agent fails mid-plan:** Missing SUMMARY.md — report, ask user how to proceed.
- **Dependency chain breaks:** Wave 1 fails, Wave 2 dependents likely fail — user chooses attempt or skip.
- **All agents in wave fail:** Systemic issue — stop, report for investigation.
- **Checkpoint unresolvable:** "Skip this plan?" or "Abort phase execution?" — record partial progress in STATE.md.
</failure_handling>

<resumption>
Re-run `/gsd2:execute-phase {phase}` — discover_plans finds completed SUMMARYs, skips them, resumes from first incomplete plan, continues wave execution.

STATE.md tracks: last completed plan, current wave, pending checkpoints.
</resumption>
