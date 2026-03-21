<purpose>
Validate built features via conversational UAT. Creates UAT.md tracking test progress (survives /clear), feeds gaps into /gsd2:plan-phase --gaps.

User tests, Claude records. One test at a time. Plain text responses.
</purpose>

<philosophy>
Show expected, ask if reality matches.
- "yes"/"y"/"next"/empty → pass
- Anything else → logged as issue, severity inferred
</philosophy>

<template>
@~/.claude/get-shit-done/templates/UAT.md
</template>

<process>

<step name="initialize" priority="first">
If $ARGUMENTS contains a phase number:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init verify-work "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `planner_model`, `checker_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `has_verification`.
</step>

<step name="check_active_session">
```bash
find .planning/phases -name "*-UAT.md" -type f 2>/dev/null | head -5
```

**Active sessions exist, no $ARGUMENTS:**
Read each file's frontmatter and Current Test. Display:

```
## Active UAT Sessions

| # | Phase | Status | Current Test | Progress |
|---|-------|--------|--------------|----------|
| 1 | 04-comments | testing | 3. Reply to Comment | 2/6 |

Reply with a number to resume, or provide a phase number to start new.
```

- Number reply → load that file, go to `resume_from_file`
- Phase number → new session, go to `create_uat_file`

**Active sessions exist, $ARGUMENTS provided:**
If session exists for that phase → offer resume or restart. Otherwise → `create_uat_file`.

**No active sessions, no $ARGUMENTS:**
```
No active UAT sessions.

Provide a phase number to start testing (e.g., /gsd2:verify-work 4)
```

**No active sessions, $ARGUMENTS provided:** → `create_uat_file`
</step>

<step name="find_summaries">
Use `phase_dir` from init (run init if needed).

```bash
ls "$phase_dir"/*-SUMMARY.md 2>/dev/null
```

Read each SUMMARY.md to extract testable deliverables.
</step>

<step name="extract_tests">
Parse SUMMARYs for Accomplishments and User-facing changes. Focus on USER-OBSERVABLE outcomes only (skip refactors, type changes).

For each deliverable, create: name + expected (specific, observable).

Example:
- Accomplishment: "Added comment threading with infinite nesting"
  → Test: "Reply to a Comment"
  → Expected: "Clicking Reply opens inline composer below comment. Submitting shows reply nested under parent with visual indentation."

**Cold-start smoke test:** Scan SUMMARY file paths. If ANY match: `server.{ts,js}`, `app.{ts,js}`, `index.{ts,js}`, `main.{ts,js}`, `database/*`, `db/*`, `seed/*`, `seeds/*`, `migrations/*`, `startup*`, `docker-compose*`, `Dockerfile*` — **prepend** this test:

- name: "Cold Start Smoke Test"
- expected: "Kill running server. Clear ephemeral state. Start from scratch. Server boots without errors, seed/migration completes, primary query returns live data."

WHY: Catches race conditions and silent seed failures that pass against warm state but break in production.
</step>

<step name="create_uat_file">
```bash
mkdir -p "$PHASE_DIR"
```

Build test list from extracted deliverables. Write to `.planning/phases/XX-name/{phase_num}-UAT.md`:

```markdown
---
status: testing
phase: XX-name
source: [list of SUMMARY.md files]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: [first test name]
expected: |
  [what user should observe]
awaiting: user response

## Tests

### 1. [Test Name]
expected: [observable behavior]
result: [pending]

### 2. [Test Name]
expected: [observable behavior]
result: [pending]

## Summary

total: [N]
passed: 0
issues: 0
pending: [N]
skipped: 0

## Gaps

[none yet]
```

Proceed to `present_test`.
</step>

<step name="present_test">
Read Current Test from UAT file. Display:

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                           ║
╚══════════════════════════════════════════════════════════════╝

**Test {number}: {name}**

{expected}

──────────────────────────────────────────────────────────────
→ Type "pass" or describe what's wrong
──────────────────────────────────────────────────────────────
```

Wait for user response (plain text, no AskUserQuestion).
</step>

<step name="process_response">
**Pass** (empty, "yes", "y", "ok", "pass", "next", "approved", "✓"):
```
result: pass
```

**Skip** ("skip", "can't test", "n/a"):
```
result: skipped
reason: [user's reason if provided]
```

**Blocked** (response contains: server, blocked, not running, physical device, release build):
Infer `blocked_by` tag:
- server/not running/gateway/API → `server`
- physical/device/hardware/real phone → `physical-device`
- release/preview/build/EAS → `release-build`
- stripe/twilio/third-party/configure → `third-party`
- depends on/prior phase/prerequisite → `prior-phase`
- default → `other`

```
result: blocked
blocked_by: {tag}
reason: "{verbatim}"
```

MUST NOT add blocked tests to Gaps section — they're prerequisite gates, not code issues.

**Anything else** → issue. Infer severity:

| User says | Severity |
|-----------|----------|
| crash, error, exception, fails, broken, unusable | blocker |
| doesn't work, wrong, missing, can't | major |
| slow, weird, off, minor, small | minor |
| color, font, spacing, alignment, visual | cosmetic |
| unclear | major (default) |

MUST NOT ask "how severe is this?" — infer and move on.

```
result: issue
reported: "{verbatim}"
severity: {inferred}
```

Append to Gaps:
```yaml
- truth: "{expected}"
  status: failed
  reason: "User reported: {verbatim}"
  severity: {inferred}
  test: {N}
  artifacts: []
  missing: []
```

**After any response:** Update Summary counts and frontmatter.updated.
- More tests remain → update Current Test, go to `present_test`
- No more → go to `complete_session`
</step>

<step name="resume_from_file">
Read UAT file. Find first `result: [pending]` test.

```
Resuming: Phase {phase} UAT
Progress: {passed + issues + skipped}/{total}
Issues found so far: {issues count}

Continuing from Test {N}...
```

Update Current Test, proceed to `present_test`.
</step>

<step name="complete_session">
Determine status:
```
if pending > 0 OR blocked > 0 OR (skipped without reason) > 0:
  status: partial
else:
  status: complete
```

Update frontmatter status/updated. Clear Current Test to `[testing complete]`.

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test({phase_num}): complete UAT - {passed} passed, {issues} issues" --files ".planning/phases/XX-name/{phase_num}-UAT.md"
```

```
## UAT Complete: Phase {phase}

| Result | Count |
|--------|-------|
| Passed | {N}   |
| Issues | {N}   |
| Skipped| {N}   |

[If issues > 0: list from Issues section]
```

- Issues > 0 → `diagnose_issues`
- Issues == 0 →
```
All tests passed. Ready to continue.

- `/gsd2:plan-phase {next}` — Plan next phase
- `/gsd2:execute-phase {next}` — Execute next phase
- `/gsd2:ui-review {phase}` — visual quality audit (if frontend files modified)
```
</step>

<step name="diagnose_issues">
```
{N} issues found. Diagnosing root causes...
Spawning parallel debug agents to investigate each issue.
```

- Load and follow @~/.claude/get-shit-done/workflows/diagnose-issues.md
- Spawn parallel debug agents for each issue
- Collect root causes, update UAT.md
- Proceed to `plan_gap_closure`

Diagnosis runs automatically — parallel agents minimize overhead, improve fix accuracy.
</step>

<step name="plan_gap_closure">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING FIXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner for gap closure...
```

```
Task(
  prompt="""
<planning_context>

**Phase:** {phase_number}
**Mode:** gap_closure

<files_to_read>
- {phase_dir}/{phase_num}-UAT.md (UAT with diagnoses)
- .planning/STATE.md (Project State)
- .planning/ROADMAP.md (Roadmap)
</files_to_read>

</planning_context>

<downstream_consumer>
Output consumed by /gsd2:execute-phase
Plans must be executable prompts.
</downstream_consumer>
""",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Plan gap fixes for Phase {phase}"
)
```

- PLANNING COMPLETE → `verify_gap_plans`
- PLANNING INCONCLUSIVE → report, offer manual intervention
</step>

<step name="verify_gap_plans">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING FIX PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Initialize: `iteration_count = 1`

```
Task(
  prompt="""
<verification_context>

**Phase:** {phase_number}
**Phase Goal:** Close diagnosed gaps from UAT

<files_to_read>
- {phase_dir}/*-PLAN.md (Plans to verify)
</files_to_read>

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
""",
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} fix plans"
)
```

- VERIFICATION PASSED → `present_ready`
- ISSUES FOUND → `revision_loop`
</step>

<step name="revision_loop">
Planner ↔ checker iteration (max 3).

**iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

```
Task(
  prompt="""
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {phase_dir}/*-PLAN.md (Existing plans)
</files_to_read>

**Checker issues:**
{structured_issues_from_checker}

</revision_context>

<instructions>
Read existing PLAN.md files. Make targeted updates for checker issues.
Do NOT replan from scratch unless issues are fundamental.
</instructions>
""",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

After planner returns → re-run `verify_gap_plans` logic, increment iteration_count.

**iteration_count >= 3:**

`Max iterations reached. {N} issues remain.`

Offer:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit, user runs /gsd2:plan-phase manually)
</step>

<step name="present_ready">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► FIXES READY ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} gap(s) diagnosed, {M} fix plan(s) created

| Gap | Root Cause | Fix Plan |
|-----|------------|----------|
| {truth 1} | {root_cause} | {phase}-04 |

Plans verified and ready for execution.

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute fixes** — run fix plans

`/clear` then `/gsd2:execute-phase {phase} --gaps-only`

───────────────────────────────────────────────────────────────
```
</step>

</process>

<update_rules>
Batched writes — keep results in memory, write to file only:
1. **Issue found** — preserve immediately
2. **Session complete** — final write before commit
3. **Checkpoint** — every 5 passed tests (safety net for /clear)

| Section | Rule | Trigger |
|---------|------|---------|
| Frontmatter.status | OVERWRITE | start, complete |
| Frontmatter.updated | OVERWRITE | any write |
| Current Test | OVERWRITE | any write |
| Tests.{N}.result | OVERWRITE | any write |
| Summary | OVERWRITE | any write |
| Gaps | APPEND | issue found |
</update_rules>

<success_criteria>
- UAT file created with all tests from SUMMARY.md
- Tests presented one at a time with expected behavior
- User responses processed as pass/issue/skip/blocked
- Severity inferred from description (MUST NOT ask user)
- Batched writes: on issue, every 5 passes, or completion
- Committed on completion
- If issues: parallel debug agents → planner (gap_closure) → checker → revision loop (max 3) → ready for `/gsd2:execute-phase --gaps-only`
</success_criteria>
