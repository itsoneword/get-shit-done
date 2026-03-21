<trigger>
Use this workflow when:
- Starting a new session on an existing project
- User says "continue", "what's next", "where were we", "resume"
- Any planning operation when .planning/ already exists
- User returns after time away from project
</trigger>

<required_reading>
@~/.claude/get-shit-done/references/continuation-format.md
</required_reading>

<process>

<step name="initialize">
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init resume)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `state_exists`, `roadmap_exists`, `project_exists`, `planning_exists`, `has_interrupted_agent`, `interrupted_agent_id`, `commit_docs`.

```
# Route based on init flags:
if planning_exists == false  → /gsd2:new-project
elif state_exists == true    → load_state
else                         → offer to reconstruct STATE.md from roadmap/project artifacts
```
</step>

<step name="load_state">
```bash
cat .planning/STATE.md
cat .planning/PROJECT.md
```

Extract from STATE.md: project reference, current position (phase X of Y, plan A of B), progress bar, recent decisions, pending todos, blockers, session continuity.

Extract from PROJECT.md: what this is, requirements (validated/active/out-of-scope), key decisions, constraints.
</step>

<step name="check_incomplete_work">
```bash
cat .planning/HANDOFF.json 2>/dev/null

ls .planning/phases/*/.continue-here*.md 2>/dev/null

for plan in .planning/phases/*/*-PLAN.md; do
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "Incomplete: $plan"
done 2>/dev/null

# Use has_interrupted_agent / interrupted_agent_id from init
if [ "$has_interrupted_agent" = "true" ]; then
  echo "Interrupted agent: $interrupted_agent_id"
fi
```

Priority order for resumption signals:

**HANDOFF.json** (highest — from `/gsd2:pause-work`): parse `status`, `phase`, `plan`, `task`, `total_tasks`, `next_action`, `blockers`, `human_actions_pending`, `completed_tasks`, `uncommitted_files`, `context_notes`. Validate `uncommitted_files` against `git status` — flag divergence. MUST delete HANDOFF.json after successful resumption (one-shot artifact).

**`.continue-here` file** (fallback): read for mid-plan resumption context.

**PLAN without SUMMARY**: execution started but not completed.

**Interrupted agent**: read agent-history.json for task details.
</step>

<step name="present_status">
```
╔══════════════════════════════════════════════════════════════╗
║  PROJECT STATUS                                               ║
╠══════════════════════════════════════════════════════════════╣
║  Building: [one-liner from PROJECT.md "What This Is"]         ║
║                                                               ║
║  Phase: [X] of [Y] - [Phase name]                            ║
║  Plan:  [A] of [B] - [Status]                                ║
║  Progress: [██████░░░░] XX%                                  ║
║                                                               ║
║  Last activity: [date] - [what happened]                     ║
╚══════════════════════════════════════════════════════════════╝

[If incomplete work found:]
⚠️  Incomplete work detected:
    - [.continue-here file or incomplete plan]

[If interrupted agent found:]
⚠️  Interrupted agent detected:
    Agent ID: [id]
    Task: [task description from agent-history.json]
    Interrupted: [timestamp]

    Resume with: Task tool (resume parameter with agent ID)

[If pending todos exist:]
📋 [N] pending todos — /gsd2:check-todos to review

[If blockers exist:]
⚠️  Carried concerns:
    - [blocker 1]
    - [blocker 2]

[If alignment is not ✓:]
⚠️  Brief alignment: [status] - [assessment]
```
</step>

<step name="determine_next_action">
```
# Priority cascade — use first match:
if interrupted_agent      → resume agent (Task tool) | start fresh
elif HANDOFF.json         → resume from handoff | discard and reassess
elif .continue-here       → resume from checkpoint | start fresh on plan
elif incomplete plan      → complete it | abandon
elif phase all plans done → transition workflow (internal) | review
elif phase ready to plan:
  if CONTEXT.md missing   → discuss-phase (preferred) | plan directly
  else                    → plan-phase | review roadmap
elif phase ready to exec  → execute next plan | review plan first
```
</step>

<step name="offer_options">
Check CONTEXT.md before offering phase planning:
```bash
ls .planning/phases/XX-name/*-CONTEXT.md 2>/dev/null
```

```
What would you like to do?

[Primary action based on state — e.g.:]
1. Resume interrupted agent [if interrupted agent found]
   OR
1. Execute phase (/gsd2:execute-phase {phase})
   OR
1. Discuss Phase 3 context (/gsd2:discuss-phase 3) [if CONTEXT.md missing]
   OR
1. Plan Phase 3 (/gsd2:plan-phase 3) [if CONTEXT.md exists or discuss declined]

2. Review current phase status
3. Check pending todos ([N] pending)
4. Review brief alignment
5. Something else
```

Wait for user selection.
</step>

<step name="route_to_workflow">
- **Execute plan** →
  ```
  ---
  ## ▶ Next Up
  **{phase}-{plan}: [Plan Name]** — [objective from PLAN.md]
  `/gsd2:execute-phase {phase}`
  <sub>`/clear` first → fresh context window</sub>
  ---
  ```
- **Plan phase** →
  ```
  ---
  ## ▶ Next Up
  **Phase [N]: [Name]** — [Goal from ROADMAP.md]
  `/gsd2:plan-phase [phase-number]`
  <sub>`/clear` first → fresh context window</sub>
  ---
  **Also available:**
  - `/gsd2:discuss-phase [N]` — gather context first
  - `/gsd2:research-phase [N]` — investigate unknowns
  ---
  ```
- **Advance to next phase** → ./transition.md (internal workflow, invoked inline — NOT a user command)
- **Check todos** → Read .planning/todos/pending/, present summary
- **Review alignment** → Read PROJECT.md, compare to current state
- **Something else** → Ask what they need
</step>

<step name="update_session">
Update STATE.md before proceeding — ensures next resume knows state if session ends unexpectedly:

```markdown
## Session Continuity

Last session: [now]
Stopped at: Session resumed, proceeding to [action]
Resume file: [updated if applicable]
```
</step>

</process>

<reconstruction>
If STATE.md missing but other artifacts exist — "STATE.md missing. Reconstructing from artifacts...":

1. Read PROJECT.md → extract "What This Is" and core value
2. Read ROADMAP.md → determine phases, find current position
3. Scan `*-SUMMARY.md` files → extract decisions, concerns
4. Count pending todos in .planning/todos/pending/
5. Check for .continue-here files → session continuity

Write reconstructed STATE.md, then proceed normally.
</reconstruction>

<quick_resume>
If user says "continue" or "go": load state silently, determine primary action, execute immediately without presenting options.

"Continuing from [state]... [action]"
</quick_resume>

<success_criteria>
- [ ] STATE.md loaded (or reconstructed)
- [ ] Incomplete work detected and flagged
- [ ] Clear status presented to user
- [ ] Contextual next actions offered
- [ ] User knows exactly where project stands
- [ ] Session continuity updated
</success_criteria>
