<internal_workflow>

Not a user-facing command. Invoked automatically by `execute-phase` during auto-advance or by the orchestrator after phase verification.

Valid user commands for phase progression: `/gsd2:discuss-phase {N}`, `/gsd2:plan-phase {N}`, `/gsd2:execute-phase {N}`, `/gsd2:progress`

</internal_workflow>

<required_reading>

1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/ROADMAP.md`
4. Current phase plan files (`*-PLAN.md`) and summary files (`*-SUMMARY.md`)

</required_reading>

<purpose>

Mark current phase complete and advance to next. "Planning next phase" = "current phase is done."

</purpose>

<process>

<step name="load_project_state" priority="first">

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/PROJECT.md 2>/dev/null
```

Parse current position to verify correct phase. Note accumulated context needing post-transition updates.

</step>

<step name="verify_completion">

```bash
ls .planning/phases/XX-current/*-PLAN.md 2>/dev/null | sort
ls .planning/phases/XX-current/*-SUMMARY.md 2>/dev/null | sort
```

If PLAN count == SUMMARY count → all complete. Otherwise → incomplete.

<config-check>

```bash
cat .planning/config.json 2>/dev/null
```

</config-check>

Check for verification debt:

```bash
OUTSTANDING=""
for f in .planning/phases/XX-current/*-UAT.md .planning/phases/XX-current/*-VERIFICATION.md; do
  [ -f "$f" ] || continue
  grep -q "result: pending\|result: blocked\|status: partial\|status: human_needed\|status: diagnosed" "$f" && OUTSTANDING="$OUTSTANDING\n$(basename $f)"
done
```

If OUTSTANDING is not empty, append to confirmation message (does NOT block transition):

```
Outstanding verification items in this phase:
{list filenames}

These will carry forward as debt. Review: `/gsd2:audit-uat`
```

**If all plans complete:**

<if mode="yolo">

```
⚡ Auto-approved: Transition Phase [X] → Phase [X+1]
Phase [X] complete — all [Y] plans finished.

Proceeding to mark done and advance...
```

Proceed directly to cleanup_handoff.

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

Ask: "Phase [X] complete — all [Y] plans finished. Ready to mark done and move to Phase [X+1]?"

Wait for confirmation.

</if>

**If plans incomplete:**

**MUST always prompt here — skipping plans is destructive, regardless of mode.**

```
Phase [X] has incomplete plans:
- {phase}-01-SUMMARY.md ✓ Complete
- {phase}-02-SUMMARY.md ✗ Missing
- {phase}-03-SUMMARY.md ✗ Missing

⚠️ Safety rail: Skipping plans requires confirmation (destructive action)

Options:
1. Continue current phase (execute remaining plans)
2. Mark complete anyway (skip remaining plans)
3. Review what's left
```

Wait for user decision.

</step>

<step name="cleanup_handoff">

```bash
ls .planning/phases/XX-current/.continue-here*.md 2>/dev/null
```

If found, delete them — phase complete, handoffs are stale.

</step>

<step name="update_roadmap_and_state">

```bash
TRANSITION=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase complete "${current_phase}")
```

The CLI handles: marking phase `[x]` with date, updating plan count, updating Progress table, advancing STATE.md (phase, status → Ready to plan, plan → Not started), detecting last phase in milestone.

Extract: `completed_phase`, `plans_executed`, `next_phase`, `next_phase_name`, `is_last_phase`.

</step>

<step name="archive_prompts">

Generated prompts stay in place. The `completed/` subfolder pattern handles archival.

</step>

<step name="evolve_project">

Read phase summaries and evolve PROJECT.md:

```bash
cat .planning/phases/XX-current/*-SUMMARY.md
```

Assess and update:

1. **Validated** — Active requirements shipped this phase → move to Validated: `- ✓ [Requirement] — Phase X`
2. **Invalidated** — Active requirements proven unnecessary → move to Out of Scope with reason
3. **Emerged** — New requirements discovered → add to Active: `- [ ] [New requirement]`
4. **Decisions** — Extract from SUMMARYs → add to Key Decisions table
5. **"What This Is"** — Update description if product meaningfully changed

Update "Last updated" footer:

```markdown
---
*Last updated: [date] after Phase [X]*
```

</step>

<step name="update_current_position_after_transition">

Basic position updates already handled by `gsd-tools phase complete`. Verify by reading STATE.md. If progress bar needs updating:

```bash
PROGRESS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" progress bar --raw)
```

Update progress bar line in STATE.md with result.

</step>

<step name="update_project_reference">

Update Project Reference in STATE.md:

```markdown
## Project Reference

See: .planning/PROJECT.md (updated [today])

**Core value:** [Current core value from PROJECT.md]
**Current focus:** [Next phase name]
```

</step>

<step name="review_accumulated_context">

Update Accumulated Context in STATE.md:

- **Decisions:** Note 3-5 recent decisions from this phase (full log in PROJECT.md)
- **Blockers/Concerns:** Remove resolved blockers, keep unresolved with "Phase X" prefix, add new concerns from summaries

</step>

<step name="update_session_continuity_after_transition">

Update Session Continuity in STATE.md:

```markdown
Last session: [today]
Stopped at: Phase [X] complete, ready to plan Phase [X+1]
Resume file: None
```

</step>

<step name="offer_next_phase">

**MUST verify milestone status before presenting next steps.**

Use `is_last_phase` from `gsd-tools phase complete` result:
- `false` → Route A (more phases)
- `true` → Route B (milestone complete)

Use `next_phase` and `next_phase_name` for details. For additional context if needed:

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

---

**Route A: More phases remain**

```bash
ls .planning/phases/*[X+1]*/*-CONTEXT.md 2>/dev/null
```

<if mode="yolo">

If CONTEXT.md exists:

```
Phase [X] marked complete.

Next: Phase [X+1] — [Name]

⚡ Auto-continuing: Plan Phase [X+1] in detail
```

Exit skill and invoke SlashCommand("/gsd2:plan-phase [X+1] --auto")

If CONTEXT.md does NOT exist:

```
Phase [X] marked complete.

Next: Phase [X+1] — [Name]

⚡ Auto-continuing: Discuss Phase [X+1] first
```

Exit skill and invoke SlashCommand("/gsd2:discuss-phase [X+1] --auto")

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

If CONTEXT.md does NOT exist:

```
## ✓ Phase [X] Complete

---

## ▶ Next Up

**Phase [X+1]: [Name]** — [Goal from ROADMAP.md]

`/gsd2:discuss-phase [X+1]` — gather context and clarify approach

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd2:plan-phase [X+1]` — skip discussion, plan directly
- `/gsd2:research-phase [X+1]` — investigate unknowns

---
```

If CONTEXT.md exists:

```
## ✓ Phase [X] Complete

---

## ▶ Next Up

**Phase [X+1]: [Name]** — [Goal from ROADMAP.md]
<sub>✓ Context gathered, ready to plan</sub>

`/gsd2:plan-phase [X+1]`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd2:discuss-phase [X+1]` — revisit context
- `/gsd2:research-phase [X+1]` — investigate unknowns

---
```

</if>

---

**Route B: Milestone complete**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false
```

<if mode="yolo">

```
Phase {X} marked complete.

🎉 Milestone {version} is 100% complete — all {N} phases finished!

⚡ Auto-continuing: Complete milestone and archive
```

Exit skill and invoke SlashCommand("/gsd2:complete-milestone {version}")

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

```
## ✓ Phase {X}: {Phase Name} Complete

🎉 Milestone {version} is 100% complete — all {N} phases finished!

---

## ▶ Next Up

**Complete Milestone {version}** — archive and prepare for next

`/gsd2:complete-milestone {version}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- Review accomplishments before archiving

---
```

</if>

</step>

</process>

<partial_completion>

If user wants to move on with incomplete phase:

```
Phase [X] has incomplete plans:
- {phase}-02-PLAN.md (not executed)
- {phase}-03-PLAN.md (not executed)

Options:
1. Mark complete anyway (plans weren't needed)
2. Defer work to later phase
3. Stay and finish current phase
```

Respect user judgment. If marking complete with skips: update ROADMAP with actual count (e.g., "2/3 plans complete") and note skipped plans.

</partial_completion>

<success_criteria>

- [ ] Phase plan summaries verified (all exist or user chose to skip)
- [ ] Stale handoffs deleted
- [ ] ROADMAP.md updated (completion status, plan count, progress table)
- [ ] PROJECT.md evolved (requirements, decisions, description)
- [ ] STATE.md updated (position, project reference, context, session)
- [ ] User knows next steps

</success_criteria>
