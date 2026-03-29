---
name: gsd2:fix
description: Fix issues found after phase execution with dependency awareness
argument-hint: "[phase-number] [issue descriptions]"
allowed-tools:
  - Read
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Fix post-execution issues without breaking other modules.

Orchestrator role: gather issues, resolve phase context, spawn gsd-fixer agent, report results.

Why subagent: investigating dependencies burns context fast (reading files, grepping usages, tracing callers). Fresh context per fix session keeps the main conversation lean.
</objective>

<context>
User's input: $ARGUMENTS
</context>

<process>

## 0. Initialize Context

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract `commit_docs` from init JSON. Resolve fixer model:
```bash
fixer_model=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-fixer --raw)
```

## 1. Determine Phase

Parse phase number from $ARGUMENTS (first numeric value), or read STATE.md to find the last active phase.

```bash
# Find phase directory
phase_info=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase "${PHASE_NUM}")
```

If no phase can be determined, ask:
```
AskUserQuestion(
  question: "Which phase are you fixing issues for?",
  followUp: "I'll look at the phase plans and summaries for context"
)
```

## 2. Gather Issues

If $ARGUMENTS contains issue descriptions (beyond just a phase number), use them directly.

Otherwise:
```
AskUserQuestion(
  question: "List the issues you found after execution. One per line is ideal, but any format works.",
  followUp: "I'll classify each one and fix what's safe to fix"
)
```

## 3. Spawn gsd-fixer Agent

Build the files_to_read list from the phase directory:
```bash
ls "${PHASE_DIR}"/*-PLAN.md "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null
```

```
Task(
  prompt="""
<objective>
Fix post-execution issues for Phase ${PHASE_NUM}.
</objective>

<issues>
${ISSUE_LIST}
</issues>

<files_to_read>
- ${PHASE_DIR}/*-PLAN.md (What was planned)
- ${PHASE_DIR}/*-SUMMARY.md (What was built)
- .planning/STATE.md (Project state)
- .planning/ROADMAP.md (Phase scope — helps classify not-yet-built)
</files_to_read>
""",
  subagent_type="gsd-fixer",
  model="${fixer_model}",
  description="Fix Phase ${PHASE_NUM} issues"
)
```

## 4. Handle Return

**If `## FIXES COMPLETE`:**
- Display the summary table
- Offer: "Run `/gsd2:fix` again if you find more issues, or continue to the next phase."

**If `## FIXES PARTIAL`:**
- Display what was fixed and what needs input
- For items needing input: present the decisions needed
- After user responds, spawn continuation if needed

</process>

<success_criteria>
- [ ] Phase context resolved
- [ ] Issues gathered from user
- [ ] gsd-fixer spawned with phase plans, summaries, and issue list
- [ ] Results reported clearly
</success_criteria>
