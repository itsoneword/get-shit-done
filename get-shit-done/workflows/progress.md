<purpose>
Check project progress, summarize recent work, and route to the next action — execute an existing plan or create one.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="init_context">
Load progress context:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init progress)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `project_exists`, `roadmap_exists`, `state_exists`, `phases`, `current_phase`, `next_phase`, `milestone_version`, `completed_count`, `phase_count`, `paused_at`, `state_path`, `roadmap_path`, `project_path`, `config_path`.

Routing on missing structure:
- No `.planning/` → print "No planning structure found. Run /gsd2:new-project to start a new project." and exit
- Missing STATE.md → suggest `/gsd2:new-project`
- ROADMAP.md missing + PROJECT.md exists → **Route F** (milestone was archived)
- Both ROADMAP.md and PROJECT.md missing → suggest `/gsd2:new-project`
</step>

<step name="load_and_analyze">
Get structured data (minimizes context usage):

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state-snapshot)
```

`$ROADMAP` returns JSON with: phases (disk status, goals, dependencies, plan/summary counts), aggregated stats (total plans, summaries, progress %), current/next phase.

Gather recent work — find 2-3 most recent SUMMARY.md files:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" summary-extract <path> --fields one_liner
```
</step>

<step name="position">
Parse current position from `$ROADMAP` and `$STATE`:
- `current_phase`, `next_phase` from `$ROADMAP`
- `paused_at` from `$STATE` if work was paused
- Pending todos: `init todos` or `list-todos`
- Active debug sessions: `ls .planning/debug/*.md 2>/dev/null | grep -v resolved | wc -l`
</step>

<step name="report">
Generate progress bar and present status:

```bash
PROGRESS_BAR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" progress bar --raw)
```

```
# [Project Name]

**Progress:** {PROGRESS_BAR}
**Profile:** [quality/balanced/budget/inherit]

## Recent Work
- [Phase X, Plan Y]: [1-line from summary-extract]
- [Phase X, Plan Z]: [1-line from summary-extract]

## Current Position
Phase [N] of [total]: [phase-name]
Plan [M] of [phase-total]: [status]
CONTEXT: [✓ if has_context | - if not]

## Key Decisions Made
- [from $STATE.decisions[].decision]

## Blockers/Concerns
- [from $STATE.blockers[].text]

## Pending Todos
- [count] pending — /gsd2:check-todos to review

## Active Debug Sessions
- [count] active — /gsd2:debug to continue
(Only show if count > 0)

## What's Next
[Next phase/plan objective from roadmap analyze]
```
</step>

<step name="route">
**Step 1: Count plans, summaries, and issues in current phase**

```bash
ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
ls -1 .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null | wc -l
```

**Step 1.5: Check UAT status**

```bash
# diagnosed = gaps needing fixes; partial = incomplete testing
grep -l "status: diagnosed\|status: partial" .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null
```

Track: `uat_with_gaps` (diagnosed), `uat_partial` (partial).

**Step 1.6: Cross-phase verification debt**

```bash
DEBT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" audit-uat --raw 2>/dev/null)
```

Parse `summary.total_items` and `summary.total_files`. If `outstanding_debt > 0`, append warning to report between "What's Next" and route suggestion:

```markdown
## Verification Debt ({N} files across prior phases)

| Phase | File | Issue |
|-------|------|-------|
| {phase} | {filename} | {pending_count} pending, {skipped_count} skipped, {blocked_count} blocked |
| {phase} | {filename} | human_needed — {count} items |

Review: `/gsd2:audit-uat` — full cross-phase audit
Resume testing: `/gsd2:verify-work {phase}` — retest specific phase
```

Warning only — does not block routing.

**Step 2: Route based on counts**

| Condition | Route |
|-----------|-------|
| uat_partial > 0 | **E.2** — resume incomplete UAT |
| uat_with_gaps > 0 | **E** — plan UAT fixes |
| summaries < plans | **A** — execute next plan |
| summaries = plans, plans > 0 | Step 3 (phase complete) |
| plans = 0 | **B** — phase needs planning |

---

**Route A: Unexecuted plan exists**

Find first PLAN.md without matching SUMMARY.md. Read its `<objective>`.

```
---
## ▶ Next Up
**{phase}-{plan}: [Plan Name]** — [objective summary]
`/gsd2:execute-phase {phase}`
<sub>`/clear` first → fresh context window</sub>
---
```

---

**Route B: Phase needs planning**

Check if `{phase_num}-CONTEXT.md` exists.

If CONTEXT.md exists:
```
---
## ▶ Next Up
**Phase {N}: {Name}** — {Goal from ROADMAP.md}
<sub>✓ Context gathered, ready to plan</sub>
`/gsd2:plan-phase {phase-number}`
<sub>`/clear` first → fresh context window</sub>
---
```

If no CONTEXT.md:
```
---
## ▶ Next Up
**Phase {N}: {Name}** — {Goal from ROADMAP.md}
`/gsd2:discuss-phase {phase}` — gather context and clarify approach
<sub>`/clear` first → fresh context window</sub>
---
**Also available:**
- `/gsd2:plan-phase {phase}` — skip discussion, plan directly
- `/gsd2:list-phase-assumptions {phase}` — see Claude's assumptions
---
```

---

**Route E: UAT gaps need fix plans**

```
---
## ⚠ UAT Gaps Found
**{phase_num}-UAT.md** has {N} gaps requiring fixes.
`/gsd2:plan-phase {phase} --gaps`
<sub>`/clear` first → fresh context window</sub>
---
**Also available:**
- `/gsd2:execute-phase {phase}` — execute phase plans
- `/gsd2:verify-work {phase}` — run more UAT testing
---
```

---

**Route E.2: UAT testing incomplete (partial)**

```
---
## Incomplete UAT Testing
**{phase_num}-UAT.md** has {N} unresolved tests (pending, blocked, or skipped).
`/gsd2:verify-work {phase}` — resume testing
<sub>`/clear` first → fresh context window</sub>
---
**Also available:**
- `/gsd2:audit-uat` — full cross-phase UAT audit
- `/gsd2:execute-phase {phase}` — execute phase plans
---
```

---

**Step 3: Milestone status (only when phase complete)**

Read ROADMAP.md — identify current phase number and highest phase in milestone.

| Condition | Route |
|-----------|-------|
| current < highest | **C** — more phases remain |
| current = highest | **D** — milestone complete |

---

**Route C: Phase complete, more phases remain**

```
---
## ✓ Phase {Z} Complete
## ▶ Next Up
**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}
`/gsd2:discuss-phase {Z+1}` — gather context and clarify approach
<sub>`/clear` first → fresh context window</sub>
---
**Also available:**
- `/gsd2:plan-phase {Z+1}` — skip discussion, plan directly
- `/gsd2:verify-work {Z}` — user acceptance test before continuing
---
```

---

**Route D: Milestone complete**

```
---
## 🎉 Milestone Complete
All {N} phases finished!
## ▶ Next Up
**Complete Milestone** — archive and prepare for next
`/gsd2:complete-milestone`
<sub>`/clear` first → fresh context window</sub>
---
**Also available:**
- `/gsd2:verify-work` — user acceptance test before completing milestone
---
```

---

**Route F: Between milestones (ROADMAP.md missing, PROJECT.md exists)**

Read MILESTONES.md for last completed milestone version.

```
---
## ✓ Milestone v{X.Y} Complete
Ready to plan the next milestone.
## ▶ Next Up
**Start Next Milestone** — questioning → research → requirements → roadmap
`/gsd2:new-milestone`
<sub>`/clear` first → fresh context window</sub>
---
```
</step>

<step name="edge_cases">
- Phase complete but next not planned → offer `/gsd2:plan-phase [next]`
- All work complete → offer milestone completion
- Blockers present → highlight before offering to continue
- Handoff file exists → mention it, offer `/gsd2:resume-work`
</step>

</process>

<success_criteria>
- [ ] Current position clear with visual progress
- [ ] Recent work, decisions, blockers included
- [ ] Smart routing: /gsd2:execute-phase if plans exist, /gsd2:plan-phase if not
- [ ] User confirms before any action
</success_criteria>
