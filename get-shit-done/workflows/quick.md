<purpose>
Execute small, ad-hoc tasks with GSD guarantees: atomic commit, STATE.md tracking. Spawns gsd-planner (quick mode) + gsd-executor, never touches ROADMAP.md.

Default flow shows a one-paragraph approach + file list before planning so the user can confirm or redirect. Composable flags: `--clarify` (ask 2–3 targeted questions before planning), `--full` (plan-check up to 2 iterations + post-execution verifier).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_args">
**Parse `$ARGUMENTS`:**

- `--full` → `$FULL_MODE`
- `--clarify` → `$CLARIFY_MODE`
- Remaining text → `$DESCRIPTION`

If `$DESCRIPTION` is empty:
```
AskUserQuestion(
  header: "Quick Task",
  question: "What do you want to do?",
  followUp: null
)
```
Store response as `$DESCRIPTION`. If still empty after prompt, abort.

Build flag label (combine active: CLARIFY, FULL — or omit if none) and display banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK ${flags_label ? '(' + flags_label + ')' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Task: ${DESCRIPTION}
```
</step>

<step name="init">
**Initialize:**

```bash
INIT=$(node "~/.claude/get-shit-done/bin/gsd-tools.cjs" init quick "$DESCRIPTION")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `branch_name`, `quick_id`, `slug`, `date`, `timestamp`, `quick_dir`, `task_dir`, `roadmap_exists`, `planning_exists`.

**If `roadmap_exists` is false:** Error — run `/gsd2:new-project` first. Quick tasks need ROADMAP.md so STATE.md exists; phase status is irrelevant.
</step>

<step name="branch">
**Branch (skip if `branch_name` empty/null):**

```bash
git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"
```

All quick-task commits stay on the branch. User handles merge/rebase afterward.
</step>

<step name="dirs">
**Create task directory:**

```bash
mkdir -p "${task_dir}"
```

Report: `Quick task ${quick_id} → ${task_dir}`
</step>

<step name="suggest_preview">
**Default preview (skip only if `$CLARIFY_MODE` is set — clarify supersedes):**

Read `.planning/STATE.md`, `./CLAUDE.md` (if present), and any obviously relevant code files for `$DESCRIPTION` to ground the proposal. Stay shallow — this is a preview, not research.

Display a 4–8 line proposal:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROPOSED APPROACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Approach:** ${one_paragraph_what_and_why}

**Files I expect to touch:**
- ${path/a.ext} — ${what_changes}
- ${path/b.ext} — ${what_changes}

**Out of scope:** ${anything_explicitly_not_covered}
```

Then ask via AskUserQuestion:

```
options:
  - { label: "Looks right — proceed", description: "Plan and execute as described" }
  - { label: "Redirect", description: "Free-text: what to change about the approach" }
  - { label: "Switch to clarify mode", description: "Ask me 2–3 questions first" }
  - { label: "Cancel", description: "Abort the quick task" }
```

Handle:
- **Proceed** → continue to Step 7 (planner).
- **Redirect** → capture user's text, fold it into `$DESCRIPTION` (append `Redirected: ${text}`), re-display the updated proposal once. If user redirects again, just proceed with the latest text.
- **Switch to clarify** → set `$CLARIFY_MODE=true`, fall through to Step 6.
- **Cancel** → clean up `${task_dir}` if empty, exit.
</step>

<step name="clarify">
**Clarify mode (only if `$CLARIFY_MODE`):**

Identify the 2–3 things you are genuinely uncertain about — not all gray areas, only the ones whose answers would change your plan. Skip if you have no real uncertainty; in that case, just write a minimal CONTEXT.md noting "no open questions" and proceed.

For each uncertainty:

```
AskUserQuestion(
  header: "${one_word_topic}",
  question: "${specific_question}",
  options: [
    { label: "${concrete_choice_1}", description: "${what_this_means}" },
    { label: "${concrete_choice_2}", description: "${what_this_means}" },
    { label: "You decide", description: "Claude's discretion" }
  ],
  multiSelect: false
)
```

Rules: concrete choices, max 1 question per uncertainty, "You decide" is always an option.

Write `${task_dir}/${quick_id}-CONTEXT.md`:

```markdown
# Quick Task ${quick_id}: ${DESCRIPTION} - Context

**Gathered:** ${date}

## Decisions
- ${topic_1}: ${user_answer}
- ${topic_2}: ${user_answer}

## Claude's Discretion
${areas_user_said_you_decide_or_undiscussed}
```

Report: `Context captured: ${task_dir}/${quick_id}-CONTEXT.md`
</step>

<step name="plan">
**Spawn planner:**

Mode: `quick-full` if `$FULL_MODE`, else `quick`.

```
Task(
  prompt="
<planning_context>
**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
**Directory:** ${task_dir}
**Description:** ${DESCRIPTION}

<files_to_read>
- .planning/STATE.md
- ./CLAUDE.md (if exists)
${CLARIFY_MODE ? '- ' + task_dir + '/' + quick_id + '-CONTEXT.md (Locked decisions — do not revisit)' : ''}
</files_to_read>

**Project skills:** Check .claude/skills/ or .agents/skills/ — read SKILL.md files, plans should account for skill rules.
</planning_context>

<constraints>
- SINGLE plan with 1–3 focused atomic tasks
${FULL_MODE ? '- Target ~40% context (structured for verification)' : '- Target ~30% context (simple, focused)'}
${FULL_MODE ? '- MUST generate `must_haves` in plan frontmatter (truths, artifacts, key_links)' : ''}
${FULL_MODE ? '- Each task MUST have `files`, `action`, `verify`, `done` fields' : ''}
</constraints>

<output>
Write plan to: ${task_dir}/${quick_id}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Quick plan: ${DESCRIPTION}"
)
```

Verify plan exists. If missing, error: "Planner failed to create ${quick_id}-PLAN.md".
</step>

<step name="check_plan">
**Plan-checker loop (only when `$FULL_MODE`):**

Skip if NOT `$FULL_MODE`.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CHECKING PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Spawn `gsd-plan-checker` with mode `quick-full`:

```markdown
<verification_context>
**Mode:** quick-full
**Task:** ${DESCRIPTION}

<files_to_read>
- ${task_dir}/${quick_id}-PLAN.md
${CLARIFY_MODE ? '- ' + task_dir + '/' + quick_id + '-CONTEXT.md' : ''}
</files_to_read>

**Scope:** Quick task — skip ROADMAP phase-goal checks.
</verification_context>

<check_dimensions>
- Requirement coverage: plan addresses task description?
- Task completeness: tasks have files, action, verify, done?
- Key links: referenced files real?
- Scope sanity: 1–3 tasks?
- must_haves derivation: traceable to task description?
${CLARIFY_MODE ? '- Context compliance: plan honors locked CONTEXT.md decisions?' : ''}
- Skip: cross-plan deps, ROADMAP alignment
</check_dimensions>

<expected_output>
- ## VERIFICATION PASSED, or
- ## ISSUES FOUND with structured list
</expected_output>
```

Handle:
- `## VERIFICATION PASSED` → continue.
- `## ISSUES FOUND` → revision loop (max 2 iterations). Send back to planner with structured issues, instruct: "targeted updates only, do not replan from scratch unless fundamental." Re-check, increment `iteration_count`. After iter ≥ 2, display remaining issues and offer: 1) Force proceed, 2) Abort.
</step>

<step name="execute">
**Spawn executor:**

```
Task(
  prompt="
Execute quick task ${quick_id}.

<files_to_read>
- ${task_dir}/${quick_id}-PLAN.md
- .planning/STATE.md
- ./CLAUDE.md (if exists)
- .claude/skills/ or .agents/skills/ (if exists — follow relevant SKILL.md rules)
</files_to_read>

<constraints>
- Execute all tasks in the plan
- Commit each task atomically
- Create summary at: ${task_dir}/${quick_id}-SUMMARY.md
- Do NOT touch ROADMAP.md (quick tasks are separate from planned phases)
</constraints>
",
  subagent_type="gsd-executor",
  model="{executor_model}",
  description="Execute: ${DESCRIPTION}"
)
```

Verify summary file exists. Extract latest commit hash with `git rev-parse --short HEAD`.

If executor reports failure with `classifyHandoffIfNeeded is not defined` but the summary file exists and `git log` shows new commits, treat as success — that's a Claude Code runtime bug.
</step>

<step name="verify">
**Verifier (only when `$FULL_MODE`):**

Skip if NOT `$FULL_MODE`.

```
Task(
  prompt="Verify quick task goal achievement.
Task directory: ${task_dir}
Goal: ${DESCRIPTION}

<files_to_read>
- ${task_dir}/${quick_id}-PLAN.md
</files_to_read>

Check must_haves against actual codebase. Write VERIFICATION.md at ${task_dir}/${quick_id}-VERIFICATION.md.",
  subagent_type="gsd-verifier",
  model="{verifier_model}",
  description="Verify: ${DESCRIPTION}"
)
```

Read verification status:
```bash
grep "^status:" "${task_dir}/${quick_id}-VERIFICATION.md" | cut -d: -f2 | tr -d ' '
```

| Status | Action | `$VERIFICATION_STATUS` |
|--------|--------|------------------------|
| `passed` | Continue | `Verified` |
| `human_needed` | Display items needing manual check, continue | `Needs Review` |
| `gaps_found` | Display gaps, offer: 1) Re-run executor, 2) Accept as-is | `Gaps` |
</step>

<step name="state">
**Update STATE.md:**

1. If `### Quick Tasks Completed` section is missing, insert after `### Blockers/Concerns`:

   `--full` mode (with Status column):
   ```markdown
   ### Quick Tasks Completed

   | # | Description | Date | Commit | Status | Directory |
   |---|-------------|------|--------|--------|-----------|
   ```
   Otherwise:
   ```markdown
   ### Quick Tasks Completed

   | # | Description | Date | Commit | Directory |
   |---|-------------|------|--------|-----------|
   ```

2. If table exists, match its column shape. If adding `--full` to a project whose table lacks Status, add the column header but leave older rows' Status empty.

3. Append row (include Status if `$FULL_MODE` or table has the column):
   ```markdown
   | ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | ${VERIFICATION_STATUS} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
   ```

4. Update last activity:
   ```
   Last activity: ${date} - Completed quick task ${quick_id}: ${DESCRIPTION}
   ```

Use Edit tool for atomic STATE.md changes.
</step>

<step name="commit">
**Final commit:**

Build file list:
- `${task_dir}/${quick_id}-PLAN.md`, `${task_dir}/${quick_id}-SUMMARY.md`, `.planning/STATE.md`
- If `$CLARIFY_MODE`: `${task_dir}/${quick_id}-CONTEXT.md`
- If `$FULL_MODE`: `${task_dir}/${quick_id}-VERIFICATION.md`

```bash
node "~/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(quick-${quick_id}): ${DESCRIPTION}" --files ${file_list}
commit_hash=$(git rev-parse --short HEAD)
```

Display completion:

```
---

GSD ► QUICK TASK COMPLETE${FULL_MODE ? ' (FULL MODE)' : ''}

Quick Task ${quick_id}: ${DESCRIPTION}

Summary: ${task_dir}/${quick_id}-SUMMARY.md
${FULL_MODE ? 'Verification: ' + task_dir + '/' + quick_id + '-VERIFICATION.md (' + VERIFICATION_STATUS + ')' : ''}
Commit: ${commit_hash}

---

Ready for next task: /gsd2:quick
```
</step>

</process>

<success_criteria>
- [ ] ROADMAP.md exists (validated via `init quick`)
- [ ] Description obtained; flags `--clarify`, `--full` parsed
- [ ] `quick_id` (YYMMDD-xxx) and slug generated; `${task_dir}` created
- [ ] Default flow: suggest preview displayed, user confirmed or redirected (or switched to clarify)
- [ ] `--clarify` mode: targeted questions asked, `${quick_id}-CONTEXT.md` written
- [ ] `${quick_id}-PLAN.md` created (honors CONTEXT.md when applicable)
- [ ] `--full`: plan-checker passes (or revision loop capped at 2)
- [ ] `${quick_id}-SUMMARY.md` created by executor
- [ ] `--full`: `${quick_id}-VERIFICATION.md` created
- [ ] STATE.md updated with quick task row
- [ ] All artifacts committed
</success_criteria>
