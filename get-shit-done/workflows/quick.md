<purpose>
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking). Spawns gsd-planner (quick mode) + gsd-executor(s), tracks in `.planning/quick/`, updates STATE.md's "Quick Tasks Completed" table.

Composable flags: `--discuss` (surfaces assumptions via CONTEXT.md), `--research` (spawns researcher before planning), `--full` (plan-checking max 2 iterations + verification).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>
**Step 1: Parse arguments and get task description**

Parse `$ARGUMENTS` for:
- `--full` → `$FULL_MODE`, `--discuss` → `$DISCUSS_MODE`, `--research` → `$RESEARCH_MODE`
- Remaining text → `$DESCRIPTION`

If `$DESCRIPTION` is empty:
```
AskUserQuestion(
  header: "Quick Task",
  question: "What do you want to do?",
  followUp: null
)
```
Store response as `$DESCRIPTION`. If still empty, re-prompt.

Display banner with active flags. Build label from active flags:
- Combine active flag names: DISCUSS, RESEARCH, FULL
- If none: just "QUICK TASK"

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK ${flags_label ? '(' + flags_label + ')' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ ${summary_of_enabled_features}
```

---

**Step 2: Initialize**

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init quick "$DESCRIPTION")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `branch_name`, `quick_id`, `slug`, `date`, `timestamp`, `quick_dir`, `task_dir`, `roadmap_exists`, `planning_exists`.

**If `roadmap_exists` is false:** Error — run `/gsd2:new-project` first. Quick tasks can run mid-phase; only ROADMAP.md is required.

---

**Step 2.5: Handle quick-task branching**

Skip if `branch_name` is empty/null. Otherwise:

```bash
git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"
```

All quick-task commits stay on that branch. User handles merge/rebase afterward.

---

**Step 3: Create task directories**

```bash
mkdir -p "${task_dir}"
QUICK_DIR=".planning/quick/${quick_id}-${slug}"
mkdir -p "$QUICK_DIR"
```

Report: `Creating quick task ${quick_id}: ${DESCRIPTION} — Directory: ${QUICK_DIR}`

---

**Step 4: Discussion phase (only when `$DISCUSS_MODE`)**

Skip if NOT `$DISCUSS_MODE`.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DISCUSSING QUICK TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Surfacing gray areas for: ${DESCRIPTION}
```

**4a. Identify 2-4 gray areas** — concrete decision points using domain heuristic:
- SEE → layout, density, interactions, states
- CALL → responses, errors, auth, versioning
- RUN → output format, flags, modes, error handling
- READ → structure, tone, depth, flow
- ORGANIZED → criteria, grouping, naming, exceptions

**4b. Present gray areas**

```
AskUserQuestion(
  header: "Gray Areas",
  question: "Which areas need clarification before planning?",
  options: [
    { label: "${area_1}", description: "${why_it_matters_1}" },
    { label: "${area_2}", description: "${why_it_matters_2}" },
    { label: "${area_3}", description: "${why_it_matters_3}" },
    { label: "All clear", description: "Skip discussion — I know what I want" }
  ],
  multiSelect: true
)
```

If "All clear" → skip to Step 5 (no CONTEXT.md).

**4c. Discuss selected areas** — for each, ask 1-2 focused questions:

```
AskUserQuestion(
  header: "${area_name}",
  question: "${specific_question_about_this_area}",
  options: [
    { label: "${concrete_choice_1}", description: "${what_this_means}" },
    { label: "${concrete_choice_2}", description: "${what_this_means}" },
    { label: "${concrete_choice_3}", description: "${what_this_means}" },
    { label: "You decide", description: "Claude's discretion" }
  ],
  multiSelect: false
)
```

Rules: concrete choices (not abstract), highlight recommended, "Other" → plain text follow-up, "You decide" → Claude's Discretion in CONTEXT.md. Max 2 questions per area.

**4d. Write `${QUICK_DIR}/${quick_id}-CONTEXT.md`**

```markdown
# Quick Task ${quick_id}: ${DESCRIPTION} - Context

**Gathered:** ${date}
**Status:** Ready for planning

<domain>
## Task Boundary

${DESCRIPTION}

</domain>

<decisions>
## Implementation Decisions

### ${area_1_name}
- ${decision_from_discussion}

### Claude's Discretion
${areas_where_user_said_you_decide_or_areas_not_discussed}

</decisions>

<specifics>
## Specific Ideas

${any_specific_references_or_examples_from_discussion}

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<canonical_refs>
## Canonical References

${any_specs_adrs_or_docs_referenced_during_discussion}

[If none: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>
```

Omit `<code_context>` and `<deferred>` sections. Include `<canonical_refs>` only when external docs apply.

Report: `Context captured: ${QUICK_DIR}/${quick_id}-CONTEXT.md`

---

**Step 4.5: Research phase (only when `$RESEARCH_MODE`)**

Skip if NOT `$RESEARCH_MODE`.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING QUICK TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Investigating approaches for: ${DESCRIPTION}
```

Spawn a single focused researcher (not 4 parallel like full phases):

```
Task(
  prompt="
<research_context>

**Mode:** quick-task
**Task:** ${DESCRIPTION}
**Output:** ${QUICK_DIR}/${quick_id}-RESEARCH.md

<files_to_read>
- .planning/STATE.md (Project state)
- .planning/PROJECT.md (Project context)
- ./CLAUDE.md (if exists)
${DISCUSS_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-CONTEXT.md (User decisions — align with these)' : ''}
</files_to_read>

</research_context>

<focus>
Concise, targeted research for a quick task:
1. Best libraries/patterns for this task
2. Common pitfalls and avoidance
3. Integration points with existing codebase
4. Constraints or gotchas before planning

Target 1-2 pages of actionable findings. Skip inapplicable sections.
Return: ## RESEARCH COMPLETE with file path
</focus>
",
  subagent_type="gsd-phase-researcher",
  model="{planner_model}",
  description="Research: ${DESCRIPTION}"
)
```

Verify research exists. If not found, warn but continue.

---

**Step 5: Spawn planner**

Mode: `quick-full` if `$FULL_MODE`, else `quick`.

```
Task(
  prompt="
<planning_context>

**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<files_to_read>
- .planning/STATE.md (Project State)
- ./CLAUDE.md (if exists)
${DISCUSS_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-CONTEXT.md (Locked decisions — do not revisit)' : ''}
${RESEARCH_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md (Research findings)' : ''}
</files_to_read>

**Project skills:** Check .claude/skills/ or .agents/skills/ (if exists) — read SKILL.md files, plans should account for skill rules

</planning_context>

<constraints>
- SINGLE plan with 1-3 focused, atomic tasks
${RESEARCH_MODE ? '- Use research findings for library/pattern choices' : ''}
${FULL_MODE ? '- Target ~40% context (structured for verification)' : '- Target ~30% context (simple, focused)'}
${FULL_MODE ? '- MUST generate `must_haves` in plan frontmatter (truths, artifacts, key_links)' : ''}
${FULL_MODE ? '- Each task MUST have `files`, `action`, `verify`, `done` fields' : ''}
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${quick_id}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Quick plan: ${DESCRIPTION}"
)
```

Verify plan exists. If not found, error: "Planner failed to create ${quick_id}-PLAN.md"

---

**Step 5.5: Plan-checker loop (only when `$FULL_MODE`)**

Skip if NOT `$FULL_MODE`.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CHECKING PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Checker prompt:

```markdown
<verification_context>
**Mode:** quick-full
**Task Description:** ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan to verify)
</files_to_read>

**Scope:** Quick task — skip checks requiring ROADMAP phase goal.
</verification_context>

<check_dimensions>
- Requirement coverage: plan addresses task description?
- Task completeness: tasks have files, action, verify, done?
- Key links: referenced files real?
- Scope sanity: 1-3 tasks?
- must_haves derivation: traceable to task description?
- Skip: cross-plan deps, ROADMAP alignment
${DISCUSS_MODE ? '- Context compliance: plan honors locked CONTEXT.md decisions?' : ''}
</check_dimensions>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Check quick plan: ${DESCRIPTION}"
)
```

Handle return:
- `## VERIFICATION PASSED` → proceed to Step 6
- `## ISSUES FOUND` → revision loop (max 2 iterations)

**Revision loop:** Track `iteration_count` (starts at 1 after initial check).

If iteration_count < 2, send back to planner with issues:

```
Task(
  prompt="
<revision_context>
**Mode:** quick-full (revision)

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Existing plan)
</files_to_read>

**Checker issues:** ${structured_issues_from_checker}

Make targeted updates — do NOT replan from scratch unless issues are fundamental.
Return what changed.
</revision_context>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Revise quick plan: ${DESCRIPTION}"
)
```

After planner returns → re-check, increment iteration_count.

If iteration_count >= 2: display remaining issues, offer: 1) Force proceed, 2) Abort.

---

**Step 6: Spawn executor**

```
Task(
  prompt="
Execute quick task ${quick_id}.

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan)
- .planning/STATE.md (Project state)
- ./CLAUDE.md (if exists)
- .claude/skills/ or .agents/skills/ (if exists — read SKILL.md for each, follow relevant rules)
</files_to_read>

<constraints>
- Execute all tasks in the plan
- Commit each task atomically
- Create summary at: ${QUICK_DIR}/${quick_id}-SUMMARY.md
- Do NOT update ROADMAP.md (quick tasks are separate from planned phases)
</constraints>
",
  subagent_type="gsd-executor",
  model="{executor_model}",
  description="Execute: ${DESCRIPTION}"
)
```

Verify summary exists. Extract commit hash.

**MUST:** If executor reports failure with `classifyHandoffIfNeeded is not defined`, check if summary file exists and git log shows commits — this is a Claude Code runtime bug, not a real failure.

If summary not found, error. For rare multi-plan quick tasks, spawn executors in parallel waves per execute-phase patterns.

---

**Step 6.5: Verification (only when `$FULL_MODE`)**

Skip if NOT `$FULL_MODE`.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
Task(
  prompt="Verify quick task goal achievement.
Task directory: ${QUICK_DIR}
Task goal: ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan)
</files_to_read>

Check must_haves against actual codebase. Create VERIFICATION.md at ${QUICK_DIR}/${quick_id}-VERIFICATION.md.",
  subagent_type="gsd-verifier",
  model="{verifier_model}",
  description="Verify: ${DESCRIPTION}"
)
```

Read verification status:
```bash
grep "^status:" "${QUICK_DIR}/${quick_id}-VERIFICATION.md" | cut -d: -f2 | tr -d ' '
```

| Status | Action |
|--------|--------|
| `passed` | `$VERIFICATION_STATUS = "Verified"`, continue |
| `human_needed` | Display items needing manual check, `$VERIFICATION_STATUS = "Needs Review"` |
| `gaps_found` | Display gaps, offer: 1) Re-run executor, 2) Accept as-is. `$VERIFICATION_STATUS = "Gaps"` |

---

**Step 7: Update STATE.md**

**7a.** Check if `### Quick Tasks Completed` section exists in STATE.md.

**7b.** If missing, insert after `### Blockers/Concerns`:

If `$FULL_MODE`:
```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
```

If NOT `$FULL_MODE`:
```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
```

If table exists, match its column format. If adding `--full` to a project without Status column, add the column header but leave predecessors' Status empty.

**7c.** Append row (include Status column if `$FULL_MODE` or table has one):
```markdown
| ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | ${VERIFICATION_STATUS} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
```

**7d.** Update last activity:
```
Last activity: ${date} - Completed quick task ${quick_id}: ${DESCRIPTION}
```

Use Edit tool for atomic changes.

---

**Step 8: Final commit and completion**

Build file list:
- `${QUICK_DIR}/${quick_id}-PLAN.md`, `${QUICK_DIR}/${quick_id}-SUMMARY.md`, `.planning/STATE.md`
- If `$DISCUSS_MODE`: `${QUICK_DIR}/${quick_id}-CONTEXT.md`
- If `$RESEARCH_MODE`: `${QUICK_DIR}/${quick_id}-RESEARCH.md`
- If `$FULL_MODE`: `${QUICK_DIR}/${quick_id}-VERIFICATION.md`

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(quick-${quick_id}): ${DESCRIPTION}" --files ${file_list}
```

```bash
commit_hash=$(git rev-parse --short HEAD)
```

Display completion:
```
---

GSD > QUICK TASK COMPLETE${FULL_MODE ? ' (FULL MODE)' : ''}

Quick Task ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Research: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Summary: ${QUICK_DIR}/${quick_id}-SUMMARY.md
${FULL_MODE ? 'Verification: ' + QUICK_DIR + '/' + quick_id + '-VERIFICATION.md (' + VERIFICATION_STATUS + ')' : ''}
Commit: ${commit_hash}

---

Ready for next task: /gsd2:quick
```

</process>

<success_criteria>
- [ ] ROADMAP.md validation passes
- [ ] Task description obtained; flags (`--full`, `--discuss`, `--research`) parsed
- [ ] Quick ID (YYMMDD-xxx) and slug generated; directory created at `.planning/quick/YYMMDD-xxx-slug/`
- [ ] (--discuss) Gray areas surfaced, decisions in `${quick_id}-CONTEXT.md`
- [ ] (--research) `${quick_id}-RESEARCH.md` created
- [ ] `${quick_id}-PLAN.md` created (honors CONTEXT.md and RESEARCH.md when applicable)
- [ ] (--full) Plan checker validates, revision loop capped at 2
- [ ] `${quick_id}-SUMMARY.md` created by executor
- [ ] (--full) `${quick_id}-VERIFICATION.md` created
- [ ] STATE.md updated with quick task row (Status column when --full)
- [ ] Artifacts committed
</success_criteria>
