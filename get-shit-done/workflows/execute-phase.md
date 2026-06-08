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

**Legacy layout check (informational):**

If `legacy_layout_detected` is `true` in the init JSON, print the `migration_hint` field to the user:

> Detected legacy `.planning/phases/` layout. Migration is recommended before continuing.
> Run: `node bin/gsd-tools.cjs migrate-to-milestone-partition --dry-run` (preview)
> Then: `node bin/gsd-tools.cjs migrate-to-milestone-partition --yes` (execute, after [y/N] confirmation)
> Continue with current workflow anyway? [y/N]

If user declines migration, continue with the legacy layout (the CLI auto-falls-back). If user runs migration first, re-run this workflow afterward so paths resolve under the new partition.

Note: this is an INFORMATIONAL prompt — the migration is never auto-executed. Per CONTEXT.md decision 3, the user must explicitly run `migrate-to-milestone-partition` with `[y/N]` confirmation.

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

<step name="parallel_safety_check">
Before branching, determine whether another phase is currently executing and whether running this phase concurrently is safe.

**Detect a concurrently running phase (Pitfall 1 — use both signals; STATE.md status is stale-prone):**

```bash
# Signal 1: git worktree list (authoritative — shows live linked worktrees)
OTHER_PHASE_FROM_WORKTREE=$(git worktree list --porcelain | grep "^branch" | grep "refs/heads/phase-" | grep -v "refs/heads/phase-${PHASE_NUMBER}" | head -1 | sed 's|.*refs/heads/phase-||')

# Signal 2: STATE.md status field (may be stale after a crash)
CURRENT_PHASE_FROM_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get-state current_phase 2>/dev/null || echo "")
STATE_STATUS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get-state status 2>/dev/null || echo "")
```

Use `OTHER_PHASE_FROM_WORKTREE` as primary signal; fall back to `CURRENT_PHASE_FROM_STATE` if worktree list shows no running phase but STATE.md status indicates executing.

**Same-phase re-entry skip (Pitfall 4):** If the detected running phase is the SAME as the proposed phase (`OTHER_PHASE == THIS_PHASE` or `CURRENT_PHASE_FROM_STATE == PHASE_NUMBER`), skip the gate entirely — continuing one phase's next wave is not a new parallel set and must not be refused. Log: "Same-phase re-entry detected — skipping parallel-safety check."

**When a DIFFERENT phase P is detected as running:**

```bash
GATE_RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" parallel-safe "${OTHER_PHASE}" "${PHASE_NUMBER}" --raw)
GATE_DECISION=$(echo "$GATE_RESULT" | node -e "try{const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(r.decision)}catch{process.stdout.write('greenlight')}")
GATE_REASON=$(echo "$GATE_RESULT" | node -e "try{const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(r.reason||'')}catch{process.stdout.write('')}")
OVERLAP_FILES=$(echo "$GATE_RESULT" | node -e "try{const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write((r.overlap_files||[]).join(', '))}catch{process.stdout.write('')}")
```

| Decision | Action |
|----------|--------|
| `refuse` (axis B — depends_on coupling) | **STOP.** Do not proceed. Print: "Axis-B coupling detected between Phase ${OTHER_PHASE} and Phase ${PHASE_NUMBER}: ${GATE_REASON}. Running these phases in parallel risks silent decision overwrites. Finish Phase ${OTHER_PHASE} first." |
| `warn` (axis A — file overlap only) | **Warn and continue.** Worktrees make the overlap reviewable at merge. Print: "Axis-A overlap with Phase ${OTHER_PHASE} — shared files: ${OVERLAP_FILES}. Proceeding (worktrees provide merge isolation). Review the merge output carefully." |
| `greenlight` | Continue silently. |

**If no running phase is detected:** Continue silently.
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

Capture the phase base ref so the drift heuristic in `sync_sidecars` can diff actual changes (not just planner-declared files). Keep `PHASE_BASE` in orchestrator context for the rest of the run:
```bash
PHASE_BASE=$(git rev-parse HEAD 2>/dev/null)
```

**Prune leftover worktrees** from any previous crashed run so stale worktree state does not interfere:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" worktree prune
```
If the command exits non-zero (e.g., sandbox denies it), log the warning and continue — a stale worktree from a prior crash will be caught by `git worktree list` later.
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

> Phase 4 adds an inline verify-loop sub-flow per task — see `<sub_flow name="verify_loop">` below. The contract source of truth is `.planning/**/phases/04-verification-harness-and-context-efficiency/04-AGENT-SPEC.md`.

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

   **⚠ model= is REQUIRED.** Agent definitions carry no `model:` frontmatter; omitting this param causes the agent to inherit the orchestrator's model (which is often Opus), burning 5× the token cost. If `executor_model` is `"inherit"`, omit the param instead of passing the string — the Agent tool only accepts `sonnet|opus|haiku`.

   **Worktree isolation (attempt) and in-place fallback:**

   Before spawning each executor, attempt to create a per-plan worktree:

   ```bash
   WORKTREE_DIR=".worktrees/${PHASE_NUMBER}-${PLAN_ID}"
   WORKTREE_BRANCH="worktree/${PHASE_NUMBER}-${PLAN_ID}"
   WORKTREE_RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" worktree add "$WORKTREE_DIR" "$WORKTREE_BRANCH" 2>&1)
   WORKTREE_MODE=$(echo "$WORKTREE_RESULT" | node -e "try{const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(r.fallback==='in-place'?'false':'true')}catch{process.stdout.write('false')}")
   ```

   If `WORKTREE_MODE` is `true`: the executor should write files under `$WORKTREE_DIR` as its root (worktree-relative paths). However, **note the executor-targeting caveat from Wave 0 (07-01-SUMMARY.md):** this Claude Code environment resets subagent cwd between bash calls, so a Task-spawned executor writing to an absolute repo-root path (e.g., `get-shit-done/references/foo.md`) lands in the MAIN tree regardless of the worktree — defeating isolation. **Therefore, when spawning in-process Task() executors, treat `WORKTREE_MODE=true` as a best-effort hint and not a guarantee.** The honest mechanism for this runtime is the in-place fallback path below.

   If `WORKTREE_MODE` is `false` (sandbox denial, git failure, or the above caveat applies): fall back to in-place execution (current shared-tree behavior). Remind the executor to use `--no-verify` on commits to avoid hook contention.

   **Worktree mode prompt (WORKTREE_MODE=true):**

   ```
   Task(
     subagent_type="gsd-executor",
     model="{executor_model}",  # MUST pass — from init JSON executor_model field
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
       </objective>

       <worktree_isolation>
       This executor has been assigned a dedicated worktree at: {WORKTREE_DIR}
       Write all files relative to {WORKTREE_DIR} as your working root. Do NOT write
       to absolute paths under the main repo root — those would bypass isolation and
       land in the main tree. If you cannot resolve your work under {WORKTREE_DIR},
       report this in your SUMMARY.md so the orchestrator can address it.
       </worktree_isolation>

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

   **In-place fallback prompt (WORKTREE_MODE=false):**

   ```
   Task(
     subagent_type="gsd-executor",
     model="{executor_model}",  # MUST pass — from init JSON executor_model field
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
       </objective>

       <parallel_execution>
       You are running as a PARALLEL executor agent in in-place mode (no dedicated
       worktree). Use --no-verify on all git commits to avoid pre-commit hook
       contention with other agents. The orchestrator validates hooks once after all
       agents complete.
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

3.5. **Merge worktree branches back (worktree mode only):**

   After all agents in the wave have completed (spot-checks passed), merge each worktree branch back into the phase branch **sequentially, one per-merge clean check at a time** (Pitfall 2: N-way merges can each conflict with each other even when each was individually clean against the base — do NOT assume a single global clean state):

   ```bash
   for PLAN_ID in ${WAVE_PLAN_IDS}; do
     WORKTREE_BRANCH="worktree/${PHASE_NUMBER}-${PLAN_ID}"
     WORKTREE_DIR=".worktrees/${PHASE_NUMBER}-${PLAN_ID}"

     # Per-merge clean check — each merge evaluated independently:
     MERGE_RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" worktree merge "$WORKTREE_BRANCH")
     MERGE_CLEAN=$(echo "$MERGE_RESULT" | node -e "try{const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(r.clean))}catch{process.stdout.write('false')}")
     CONFLICT_FILES=$(echo "$MERGE_RESULT" | node -e "try{const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write((r.conflict_files||[]).join(' '))}catch{process.stdout.write('')}")

     if [ "$MERGE_CLEAN" = "true" ]; then
       # Clean merge — remove worktree and branch
       node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" worktree remove "$WORKTREE_DIR"
     else
       # Conflict detected — PAUSE and surface for human review
       echo "## MERGE CONFLICT: Plan ${PLAN_ID}"
       echo "Conflicting files: ${CONFLICT_FILES}"
       git diff HEAD
       echo ""
       echo "The unmerged state is left reviewable. Resolve the conflicts, then:"
       echo "  git add <resolved-files> && git merge --continue"
       echo "Then re-run worktree remove: node gsd-tools.cjs worktree remove ${WORKTREE_DIR}"
       # STOP — do NOT auto-abort, do NOT auto-advance to next plan's merge.
       # Wait for user to resolve before proceeding with remaining merges.
       break
     fi
   done
   ```

   **Skip this sub-step if in-place fallback mode** (no worktrees were created for this wave).

   **Worktree remove on failure:** Even if an executor failed (SUMMARY.md missing), always clean up its worktree: `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" worktree remove "$WORKTREE_DIR" --force`. Prevents stale worktree accumulation.

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

   **Verify-loop trigger (Phase 4):**

   After spot-checks pass for each plan in the wave:
   - Read `verify_loop.per_plan["<plan-id>"]` from the init execute-phase JSON (already loaded into context in earlier steps).
   - For each task name in `verify_after_tasks` that was just completed by the executor (cross-reference SUMMARY.md task list):
     - Execute the `<sub_flow name="verify_loop">` defined below in a fresh context per spawned agent.
   - If any verify_loop emitted `## CHECKPOINT REACHED type: ceiling-reached`: pause execution, do not advance to the next wave, surface the block to the user.
   - If all verify_loops pass: continue to step 6 (handle failures, then next wave).

   Loops within a single wave run sequentially (parallel-wave serialization rule). Concurrent loops would race on the loop debug file at `.planning/debug/{plan-slug}-verify-loop.md` and confuse iteration counting.

   The contract source of truth is `.planning/**/phases/04-verification-harness-and-context-efficiency/04-AGENT-SPEC.md`.

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

<sub_flow name="verify_loop">

**Trigger:** any task with `verify_after="true"` in a PLAN.md whose plan frontmatter does NOT set `auto_verify: false`.

**Source of truth for contracts:** `.planning/**/phases/04-verification-harness-and-context-efficiency/04-AGENT-SPEC.md` §Communication Contracts. Every JSON message shape below is reproduced from that spec — when in doubt, the spec wins, not this prose.

**Pre-condition:** spot-check for the plan passed (existing step 5 in execute_waves).

**Procedure:**

1. **Setup:**
   - Ensure `.planning/debug/` exists (`mkdir -p .planning/debug`).
   - Compute `plan_slug = <phase>-<plan>` (e.g. `04-04`).
   - Compute `debug_file = .planning/debug/{plan_slug}-verify-loop.md`.
   - Initialize debug file with frontmatter:
     ```yaml
     status: verifying
     iteration: 1
     max_iterations: 3
     trace_id: <uuid or timestamp+random>
     created: <ISO ts>
     ```
   - Append `loop.start trace_id=<id> plan_slug=<slug>` log line to the debug file.

2. **Iteration loop, max 3 (`iteration_count` starts at 1):**

   a. **Spawn loop-verifier in a fresh context:** `Task()` with `subagent_type=gsd-verifier`. The orchestrator constructs `<files_to_read>` explicitly per role and never passes executor work logs to the verifier. The fresh-context invariant is: `<files_to_read>` MUST contain ONLY:
      - `[plan_path, debug_file path if iteration > 1]`
      Explicitly NOT executor SUMMARY.md, NOT task work logs.

      Append a `## LOOP MODE` block to the prompt with the JSON input shape:
      ```json
      {"plan_path": "<>", "task_id": "<>", "verify_commands": [<from must_haves>], "must_haves_slice": [<>], "iteration": <N>, "trace_id": "<>", "debug_file_path": "<>"}
      ```
      Append `boundary.validate role=verifier iter=<N> trace_id=<>` log line to debug file.

   b. **Parse `## LOOP VERIFY RESULT` block** from verifier output. Append `agent.return agent=verifier status=<> iter=<N> trace_id=<>` log line to debug file.

   c. If `status == "pass"`: append `loop.end status=pass iterations=<N>` log line. Continue executor to next task. **Do NOT emit any user-visible block.** Skip to step 3 (cleanup).

   d. If `status == "fail"` AND `iteration_count < 3`:

      i. **Spawn loop-investigator in a fresh context:** `Task()` with `subagent_type=gsd-debugger`. Pass `goal: find_root_cause_only` and `symptoms_prefilled: true` flags. `<files_to_read>` MUST contain ONLY:
         - `[verifier_failure_report (extracted gaps), files_implicated from prior_fix_attempts only, plan_path, debug_file path]`
         Explicitly DO NOT pass executor SUMMARY.md, executor work logs, or the just-written code's diff in iteration 1. Construct the input message per §"loop-orchestrator → loop-investigator" contract including `prior_fix_attempts` array (empty on iteration 1).

      ii. **Parse `## ROOT CAUSE FOUND` block** from investigator output. Append `agent.return agent=investigator classification=<> iter=<N>` log line.

      iii. **If classification ∈ {`not-yet-built`, `unrelated`}:** fire ceiling-reached IMMEDIATELY (skip remaining iterations). Use the `chronological_narrative` shape from step 4 below with only the iterations actually run (e.g. `iterations_attempted: <current>`).

      iv. **Spawn loop-fixer in a fresh context:** `Task()` with `subagent_type=gsd-fixer`. `<files_to_read>` MUST contain ONLY:
         - `[investigator hypothesis ROOT CAUSE FOUND block, plan_slice, recent_diff via 'git diff HEAD~1 -- <files_implicated>', debug_file path]`
         Construct input per §"loop-orchestrator → loop-fixer" contract including `loop_iteration: <N>`.

      v. **Parse `## FIXES COMPLETE (loop)` block** from fixer output. Append `agent.return agent=fixer status=<> commit=<> iter=<N>` log line. Capture `commit_hash` for `prior_fix_attempts` on the next iteration.

      vi. Increment `iteration_count`. Update debug file frontmatter `iteration: <new value>`. Loop back to step 2a.

   e. If `status == "fail"` AND `iteration_count == 3`: fall through to step 4 (ceiling reached).

3. **Cleanup on pass:** update debug file `status: resolved`. Append final log line `loop.end status=pass`. (Optionally archive — not required for v1.)

4. **Ceiling-reached handoff:** emit a `## CHECKPOINT REACHED` block to the user with the shape per §"orchestrator → user (ceiling-reached)". Update debug file `status: ceiling_reached`. Pause executor. Block indefinitely — do NOT default-approve, do NOT default-deny, do NOT advance to the next wave.

   ```
   ## CHECKPOINT REACHED
   type: ceiling-reached
   task_id: <id>
   plan_path: <path>
   iterations_attempted: <1, 2, or 3>
   debug_file_path: <path to .planning/debug/{plan-slug}-verify-loop.md>
   chronological_narrative:
     - iteration: 1
       verifier_result: <one-line summary>
       investigator_hypothesis: <one-line summary>
       fixer_commit: <sha or null>
       re_verify_result: <one-line summary or "(not run — ceiling)">
     - iteration: 2
       ...
     - iteration: 3
       ...
   final_gaps:
     - truth: <text>
       reason: <text>
   ```

**Parallel-wave serialization (RESEARCH §2):** when multiple plans in a wave each have `verify_after` triggers, run their loop sub-flows sequentially after all spot-checks pass for the wave. Concurrent loops would race on the loop debug file and confuse iteration counting.

**Permission scoping (AGENT-SPEC §Security):**
- Verifier runs ONLY `verify_commands[*].cmd` from the plan — orchestrator validates this list before spawning.
- Investigator is denied Bash via the agent definition itself; orchestrator must NOT attempt to override.
- Fixer's only allowed Bash is `gsd-tools.cjs commit ...`; the agent definition enforces this.
- `actual_output` from verifier is truncated to 1024 chars before being passed in any subsequent message (`cmdVerifyCommands` already truncates — orchestrator does not re-expand).

**Opt-out:** if `init execute-phase` returned `verify_loop.per_plan["<plan-id>"].auto_verify == false`, do NOT execute this sub-flow for any task in that plan. Log `loop.skipped reason=auto_verify_false plan=<id>` to stdout (not the debug file — file is never created when skipped).

</sub_flow>

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

<step name="post_merge_drift_check">
After all waves complete and worktree branches are merged (or after in-place execution), run the source↔runtime symmetry-check to catch any drift the merges may have introduced:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" validate health
```

Parse output for `symmetry` findings. If the health check reports source↔runtime drift:

```
## Post-Merge Drift Detected

The symmetry check found source/runtime divergence after merge. This typically means
a merge introduced changes to `get-shit-done/` files that were not mirrored to `.claude/get-shit-done/`.

Drift details:
{output from validate health}

To repair: cp -r get-shit-done/* .claude/get-shit-done/ (with agent-file exclusion)
Or run: /gsd2:health --repair
```

Surface this for the user before proceeding to `close_parent_artifacts`. Drift after a successful merge is not a blocker — it is reviewable and repairable — but it should not be silently ignored.

**Skip this step if validate health is not available** (e.g., early phases before 07-03 shipped the symmetry check). `gsd-tools validate health` exits non-zero only on hard errors; missing-symmetry-check is a soft finding in the output text.
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
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-${PARENT_PHASE}): resolve UAT gaps and debug sessions after ${PHASE_NUMBER} gap closure" --files .planning/**/phases/*${PARENT_PHASE}*/*-UAT.md .planning/debug/resolved/*.md
```
</step>

<step name="regression_gate">
Run prior phases' test suites to catch cross-phase regressions before verification.

Skip if this is the first phase (no prior phases) or no prior VERIFICATION.md files exist.

1. **Discover prior phases' test files:**
```bash
PRIOR_VERIFICATIONS=$(find .planning -path "*/phases/*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*" 2>/dev/null)
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

<step name="sync_sidecars">
Refresh the codebase sidecars this phase made stale, then re-sync root `CLAUDE.md`. Sidecars (`.planning/codebase/*.md`) feed the always-loaded `CLAUDE.md`; left frozen, they make Claude operate on a stale mental model.

**Skip the entire step if root `CLAUDE.md` does not exist** — sidecar creation is `/gsd2:new-project`'s job, not a side effect of phase execution:
```bash
[ -f CLAUDE.md ] || echo "no root CLAUDE.md — skip sidecar sync"
```
If it exists, continue.

**1. Declared impact (planner-driven).** Union `sidecar_impact` across every plan in the phase:
```bash
DECLARED=$(for p in {phase_dir}/*-PLAN.md; do
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" frontmatter get "$p" sidecar_impact --raw 2>/dev/null
done | grep -oE 'STACK|ARCHITECTURE|CONVENTIONS|INTEGRATIONS|STRUCTURE|TESTING|CONCERNS' | sort -u)
```

**2. Drift heuristic (safety net).** Independently, match the phase's *actual* changed files against glob rules — this is the case `sidecar_impact` exists to backstop: implementation touched files planning never anticipated (deviations), so a plan can't have declared them. Use the phase base ref captured at `validate_phase`; fall back to the union of plan `files_modified` only if the ref was lost (e.g. resumed run):
```bash
if [ -n "$PHASE_BASE" ] && git cat-file -e "$PHASE_BASE" 2>/dev/null; then
  CHANGED=$(git diff --name-only "$PHASE_BASE" HEAD 2>/dev/null)
else
  CHANGED=$(for p in {phase_dir}/*-PLAN.md; do
    node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" frontmatter get "$p" files_modified --raw 2>/dev/null
  done)
fi
DRIFT=""
echo "$CHANGED" | grep -qE 'package\.json|package-lock|requirements\.txt|Cargo\.toml|go\.mod|pyproject\.toml|Gemfile' && DRIFT="$DRIFT STACK"
echo "$CHANGED" | grep -qE '(^|/)src/(routes|app|services|modules)/|^(app|src)/' && DRIFT="$DRIFT ARCHITECTURE"
echo "$CHANGED" | grep -qE '\.eslintrc|\.prettierrc|jest\.config|vitest\.config|\.test\.|_test\.|(^|/)tests?/' && DRIFT="$DRIFT CONVENTIONS"
DRIFT=$(echo "$DRIFT" | tr ' ' '\n' | grep -v '^$' | sort -u)
```

**3. Build the refresh set.**
- Every sidecar in `DECLARED` → refresh automatically (no prompt).
- Each sidecar in `DRIFT` but NOT in `DECLARED` → ask once, non-blocking:
  ```
  Phase {X} touched files that usually change {SIDECAR}, but no plan declared it stale. Refresh the {SIDECAR} sidecar now? (y/n)
  ```
  Add it only on `y`. If the user declines or skips, continue — never block phase completion on this.

If the refresh set is empty, skip to `offer_next`.

**4. Map sidecars → mapper focus** (a focus may cover several sidecars; spawn each focus at most once):

| Sidecar(s) | Focus |
|------------|-------|
| `STACK`, `INTEGRATIONS` | `tech` |
| `ARCHITECTURE`, `STRUCTURE` | `arch` |
| `CONVENTIONS`, `TESTING` | `quality` |
| `CONCERNS` | `concerns` |

**5. Spawn only the needed mapper(s).** Use the same focus prompts as `/gsd2:map-codebase` (its tech/arch/quality/concerns agent blocks), restricted to the focuses computed above. Each mapper rewrites only its own sidecar files.
```bash
MAPPER_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-codebase-mapper --raw 2>/dev/null || echo "inherit")
```
Spawn with `subagent_type="gsd-codebase-mapper"`, `model="${MAPPER_MODEL}"`, `run_in_background=true`; wait for all to confirm before continuing.

**6. Re-sync and commit.** `--auto` detects manually-edited managed sections and skips them, so user edits are never clobbered:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-claude-md --auto
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-{X}): refresh impacted sidecars + CLAUDE.md" --files .planning/codebase/*.md CLAUDE.md
```
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
