<purpose>
Check project progress, summarize recent work, and route to the next action — execute an existing plan or create one.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="init_context">
Load all progress context in a single call:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init progress --scoped)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from $INIT JSON:
- Existence: project_exists, roadmap_exists, state_exists, config_path
- Paths: state_path, roadmap_path, project_path
- Milestone: milestone_version, milestone_name, profile, commit_docs
- Phases: phases[] (each with: number, name, status, plan_count, summary_count, has_research, has_context, goal, depends_on, roadmap_complete, directory)
- Position: phase_count, completed_count, in_progress_count, current_phase, next_phase, paused_at, has_work_in_progress
- Render: progress_bar, progress_percent
- Activity: todo_count, debug_session_count, verification_debt {total_files, total_items}
- History: recent_summaries[] (each: phase, plan, path, one_liner)
- State: state {decisions[], blockers[], session, paused_at}

Routing on missing structure:
- No `.planning/` → print "No planning structure found. Run /gsd2:new-project to start a new project." and exit
- Missing STATE.md → suggest `/gsd2:new-project`
- ROADMAP.md missing + PROJECT.md exists → **Route F** (milestone was archived)
- Both ROADMAP.md and PROJECT.md missing → suggest `/gsd2:new-project`
</step>

<step name="position">
Parse current position from `$INIT`:
- `current_phase`, `next_phase` from `$INIT.current_phase` / `$INIT.next_phase`
- `paused_at` from `$INIT.state.paused_at` (or `$INIT.paused_at`) if work was paused
- Pending todos count: `$INIT.todo_count`
- Active debug sessions: `$INIT.debug_session_count`
</step>

<step name="report">
Generate progress report from `$INIT` fields:

```
# [Project Name]

**Progress:** $INIT.progress_bar
**Profile:** $INIT.profile

## Phases

| # | Phase | Status | Description |
|---|-------|--------|-------------|
| [N] | [phase-name] | [status icon + label] | [phase.goal from $INIT.phases[]] |

Status icons: ✓ complete | ▶ in progress | ○ planned | - not started
Mark current phase with **bold**.
Derive status per phase from $INIT.phases[].status:
  complete → ✓, in_progress → ▶, researched/pending/not_started → ○ or -

## Recent Work
- [Phase X, Plan Y]: [$INIT.recent_summaries[0].one_liner]
- [Phase X, Plan Z]: [$INIT.recent_summaries[1].one_liner]
(iterate $INIT.recent_summaries[] — skip if empty)

## Current Position
Phase [N] of [$INIT.phase_count]: [phase-name]
Plan [M] of [phase-total]: [status]
CONTEXT: [✓ if has_context | - if not] (from $INIT.phases[current].has_context)

## Key Decisions Made
- [from $INIT.state.decisions[]]

## Blockers/Concerns
- [from $INIT.state.blockers[]]

## Pending Todos
- [$INIT.todo_count] pending — /gsd2:check-todos to review

## Active Debug Sessions
- [$INIT.debug_session_count] active — /gsd2:debug to continue
(Only show if debug_session_count > 0)

## What's Next
[Next phase/plan objective from $INIT.phases[] / $INIT.next_phase.goal]
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

Use `$INIT.verification_debt.total_items` and `$INIT.verification_debt.total_files` (already loaded).

If `total_items > 0`, append warning to report between "What's Next" and route suggestion:

```markdown
## Verification Debt ($INIT.verification_debt.total_files files across prior phases)

Review outstanding items: `/gsd2:audit-uat` — full cross-phase audit
Resume testing: `/gsd2:verify-work {phase}` — retest specific phase
```

Warning only — does not block routing. For the full per-file detail table, the user should run `/gsd2:audit-uat` directly (init progress carries summary counts only, not per-file rows).

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

Check if `{phase_num}-CONTEXT.md` exists (use `$INIT.phases[current].has_context`).

If CONTEXT.md exists:
```
---
## ▶ Next Up
**Phase {N}: {Name}** — {Goal from $INIT.phases[current].goal}
<sub>✓ Context gathered, ready to plan</sub>
`/gsd2:plan-phase {phase-number}`
<sub>`/clear` first → fresh context window</sub>
---
```

If no CONTEXT.md:
```
---
## ▶ Next Up
**Phase {N}: {Name}** — {Goal from $INIT.phases[current].goal}
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

Use `$INIT.phases[]` to identify current phase number and highest phase in milestone.

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
**Phase {Z+1}: {Name}** — {Goal from $INIT.phases[Z+1].goal}
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
