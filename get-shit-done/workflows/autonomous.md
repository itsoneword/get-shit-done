<purpose>

Drive all remaining milestone phases autonomously. For each incomplete phase: discuss, plan, execute via Skill() invocations. Pauses only for explicit user decisions. Re-reads ROADMAP.md after each phase to catch dynamically inserted phases.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

<step name="initialize" priority="first">

## 1. Initialize

Parse `$ARGUMENTS` for `--from N` flag:

```bash
FROM_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-from\s+[0-9]'; then
  FROM_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-from\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi
```

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init milestone-op)
```

Parse JSON for: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `roadmap_exists`, `state_exists`, `commit_docs`.

If `roadmap_exists` is false: Error -- "No ROADMAP.md found. Run `/gsd2:new-milestone` first."
If `state_exists` is false: Error -- "No STATE.md found. Run `/gsd2:new-milestone` first."

Display startup banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > AUTONOMOUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} -- {milestone_name}
 Phases: {phase_count} total, {completed_phases} complete
```

If `FROM_PHASE` is set, display: `Starting from phase ${FROM_PHASE}`

</step>

<step name="discover_phases">

## 2. Discover Phases

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

Parse `phases` array. Filter to incomplete: `disk_status !== "complete"` OR `roadmap_complete === false`. If `FROM_PHASE` set, exclude phases where `number < FROM_PHASE` (numeric comparison for decimals like "5.1"). Sort by `number` ascending.

If no incomplete phases remain:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > AUTONOMOUS > COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases complete! Nothing left to do.
```

Exit cleanly.

Display phase plan table:

```
## Phase Plan

| # | Phase | Status |
|---|-------|--------|
| 5 | Skill Scaffolding & Phase Discovery | In Progress |
| 6 | Smart Discuss | Not Started |
```

Fetch details for each phase:

```bash
DETAIL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extract `phase_name`, `goal`, `success_criteria`. Store for use in execute_phase and transitions.

</step>

<step name="execute_phase">

## 3. Execute Phase

Display progress banner with N = phase number, T = total phases from `phase_count`, P = (completed / T * 100):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > AUTONOMOUS > Phase {N}/{T}: {Name} [████░░░░] {P}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Progress bar: 8 chars wide, filled/empty segments based on P%.

**3a. Smart Discuss**

Fetch phase state (cache result -- reuse in 3b and 3d):

```bash
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
```

Parse `has_context`, `phase_dir` from JSON.

- If `has_context` true: Display `Phase ${PHASE_NUM}: Context exists -- skipping discuss.` Proceed to 3b.
- If false: Execute the smart_discuss step. After completion, re-fetch `PHASE_STATE` and verify `has_context`. If still false: handle_blocker "Smart discuss for phase ${PHASE_NUM} did not produce CONTEXT.md."

**3b. Plan**

```
Skill(skill="gsd2:plan-phase", args="${PHASE_NUM}")
```

Re-run `init phase-op` and check `has_plans`. If false: handle_blocker "Plan phase ${PHASE_NUM} did not produce any plans."

**3c. Execute**

```
Skill(skill="gsd2:execute-phase", args="${PHASE_NUM} --no-transition")
```

**3d. Post-Execution Routing**

Read verification status (use `phase_dir` from 3a, re-fetch via `init phase-op` only if not in scope):

```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

Route on VERIFY_STATUS:

**Empty** (no file/field): handle_blocker "Execute phase ${PHASE_NUM} did not produce verification results."

**`passed`**: Display `Phase ${PHASE_NUM} > ${PHASE_NAME} -- Verification passed`. Proceed to iterate.

**`human_needed`**: Read human_verification items from VERIFICATION.md. Ask user:
- "Phase ${PHASE_NUM} has items needing manual verification. Validate now or continue?"
- Options: "Validate now" / "Continue without validation"

On "Validate now": Present items, then ask "Validation result?" with "All good -- continue" / "Found issues". Issues route to handle_blocker.
On "Continue without validation": Display `Phase ${PHASE_NUM} > Human validation deferred`. Proceed to iterate.

**`gaps_found`**: Read gap summary. Display score. Ask user:
- "Gaps found in phase ${PHASE_NUM}. How to proceed?"
- Options: "Run gap closure" / "Continue without fixing" / "Stop autonomous mode"

On "Run gap closure" (limit: 1 attempt -- WHY: prevents infinite loops):

```
Skill(skill="gsd2:plan-phase", args="${PHASE_NUM} --gaps")
```

Verify gap plans via `init phase-op`. If none: handle_blocker.

```
Skill(skill="gsd2:execute-phase", args="${PHASE_NUM} --no-transition")
```

Re-read VERIFY_STATUS. If `passed`/`human_needed`: route normally. If still `gaps_found`: ask "Gap closure did not fully resolve issues" with "Continue anyway" / "Stop autonomous mode".

On "Continue without fixing": Display `Phase ${PHASE_NUM} > Gaps deferred`. Proceed to iterate.
On "Stop autonomous mode": handle_blocker "User stopped -- gaps remain in phase ${PHASE_NUM}".

</step>

<step name="smart_discuss">

## Smart Discuss

Autonomous-optimized variant of `gsd:discuss-phase`. Produces identical CONTEXT.md output but uses batch table proposals instead of sequential questioning. The original `discuss-phase` skill remains unchanged (per CTRL-03).

**Inputs:** `PHASE_NUM` from execute_phase. Use PHASE_STATE already fetched in step 3a. Parse: `phase_dir`, `phase_slug`, `padded_phase`, `phase_name`. If not in scope:

```bash
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
```

### Sub-step 1: Load Prior Context

Read project files for settled decisions:

```bash
cat .planning/PROJECT.md 2>/dev/null
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/STATE.md 2>/dev/null
```

Extract vision/principles from PROJECT.md, constraints from REQUIREMENTS.md, progress from STATE.md.

Read all prior CONTEXT.md files:

```bash
find .planning/phases -name "*-CONTEXT.md" 2>/dev/null | sort
```

For earlier phases: extract `<decisions>` (locked preferences), `<specifics>` (references), and patterns. Build internal `prior_decisions` context (not written to file). If no prior context exists, continue -- expected for early phases.

### Sub-step 2: Scout Codebase

Lightweight scan (~5% context max).

```bash
ls .planning/codebase/*.md 2>/dev/null
```

If maps exist: read relevant ones (CONVENTIONS.md, STRUCTURE.md, STACK.md). Extract reusable components, patterns, integration points.

If no maps, do targeted grep using phase goal keywords:

```bash
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10
ls src/components/ src/hooks/ src/lib/ src/utils/ 2>/dev/null
```

Read 3-5 most relevant files. Build internal `codebase_context`: reusable assets, established patterns, integration points.

### Sub-step 3: Analyze Phase and Generate Proposals

```bash
DETAIL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extract `goal`, `requirements`, `success_criteria`.

**Infrastructure detection (check FIRST):**

Phase is pure infrastructure when ALL true:
1. Goal keywords: "scaffolding", "plumbing", "setup", "configuration", "migration", "refactor", "rename", "restructure", "upgrade", "infrastructure"
2. Success criteria all technical: "file exists", "test passes", "config valid", "command runs"
3. No user-facing behavior: no "users can", "displays", "shows", "presents"

If infrastructure: skip Sub-step 4, jump to Sub-step 5 with minimal CONTEXT.md defaults (domain from ROADMAP goal, single "Claude's Discretion" decision, no specifics). Display: `Phase ${PHASE_NUM}: Infrastructure phase -- skipping discuss, writing minimal context.`

**If not infrastructure:** Determine domain type from goal:
- Users **SEE** -> visual (layout, interactions, states, density)
- Users **CALL** -> interface (contracts, responses, errors, auth)
- Users **RUN** -> execution (invocation, output, behavior modes, flags)
- Users **READ** -> content (structure, tone, depth, flow)
- Being **ORGANIZED** -> organization (criteria, grouping, exceptions, naming)

Skip grey areas already decided in prior phases. Generate 3-4 grey areas with ~4 questions each. For each question: pre-select recommended answer (based on prior decisions, codebase patterns, domain conventions, ROADMAP criteria), generate 1-2 alternatives, annotate with prior decision/code context where relevant.

### Sub-step 4: Present Proposals Per Area

Present areas one at a time (M of N):

```
### Grey Area {M}/{N}: {Area Name}

| # | Question | Recommended | Alternative(s) |
|---|----------|-------------|-----------------|
| 1 | {question} | {answer} -- {rationale} | {alt1}; {alt2} |
| 2 | {question} | {answer} -- {rationale} | {alt1} |
```

Ask via AskUserQuestion:
- "Accept these answers for {Area Name}?"
- Options: "Accept all", then "Change Q1" through "Change QN", then "Discuss deeper" (cap 6 options; AskUserQuestion adds "Other" automatically)

**"Accept all"**: Record recommendations, next area.
**"Change QN"**: Show alternatives + "You decide" for that question. Record choice, re-display updated table, re-present acceptance prompt.
**"Discuss deeper"**: Switch to interactive mode for this area -- ask questions one-at-a-time with 2-3 options + "You decide". After 4 questions, offer "More questions" / "Next area". On "Next area", show final summary.
**"Other" (free text)**: Interpret and incorporate, re-display table, re-present prompt.

**Scope creep**: If user mentions something outside phase domain: note as deferred idea, redirect to current area.

### Sub-step 5: Write CONTEXT.md

Path: `${phase_dir}/${padded_phase}-CONTEXT.md`

Use exactly this structure (identical to discuss-phase output):

```markdown
# Phase {PHASE_NUM}: {Phase Name} - Context

**Gathered:** {date}
**Status:** Ready for planning

<domain>
## Phase Boundary

{Domain boundary statement -- what this phase delivers}

</domain>

<decisions>
## Implementation Decisions

### {Area 1 Name}
- {Accepted/chosen answer for Q1}
- {Accepted/chosen answer for Q2}
- {Accepted/chosen answer for Q3}
- {Accepted/chosen answer for Q4}

### {Area 2 Name}
- {Accepted/chosen answer for Q1}
...

### Claude's Discretion
{Any "You decide" answers -- Claude has flexibility here}

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- {Components, hooks, utilities from codebase scout}

### Established Patterns
- {State management, styling, data fetching}

### Integration Points
- {Where new code connects}

</code_context>

<specifics>
## Specific Ideas

{Specific references or "I want it like X" from discussion}
{If none: "No specific requirements -- open to standard approaches"}

</specifics>

<deferred>
## Deferred Ideas

{Ideas captured but out of scope}
{If none: "None -- discussion stayed within phase scope"}

</deferred>
```

Write the file, then commit:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${PADDED_PHASE}): smart discuss context" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Display: `Created: {path}` and `Decisions captured: {count} across {area_count} areas`

</step>

<step name="iterate">

## 4. Iterate

Re-read ROADMAP.md after each phase (WHY: catches phases inserted mid-execution, e.g., decimal phases like 5.1):

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

Re-filter incomplete phases using same logic as discover_phases. Read STATE.md fresh:

```bash
cat .planning/STATE.md
```

Check Blockers/Concerns section. If blockers found: handle_blocker.

If incomplete phases remain: loop back to execute_phase.
If all complete: proceed to lifecycle.

</step>

<step name="lifecycle">

## 5. Lifecycle

After all phases complete: audit, complete, cleanup.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > AUTONOMOUS > LIFECYCLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases complete -> Starting lifecycle: audit -> complete -> cleanup
 Milestone: {milestone_version} -- {milestone_name}
```

**5a. Audit**

```
Skill(skill="gsd2:audit-milestone")
```

```bash
AUDIT_FILE=".planning/v${milestone_version}-MILESTONE-AUDIT.md"
AUDIT_STATUS=$(grep "^status:" "${AUDIT_FILE}" 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

Route on AUDIT_STATUS:
- **Empty**: handle_blocker "Audit did not produce results -- audit file missing or malformed."
- **`passed`**: Display `Audit passed -- proceeding to complete milestone`. Proceed to 5b (no user pause per CTRL-01).
- **`gaps_found`**: Show gaps summary. Ask "Milestone audit found gaps. How to proceed?" with "Continue anyway -- accept gaps" / "Stop -- fix gaps manually". Stop routes to handle_blocker with guidance to run `/gsd2:audit-milestone` then `/gsd2:complete-milestone`.
- **`tech_debt`**: Show debt summary. Ask "Milestone audit found tech debt. How to proceed?" with "Continue with tech debt" / "Stop -- address debt first". Stop routes to handle_blocker with guidance to run `/gsd2:audit-milestone`.

**5b. Complete Milestone**

```
Skill(skill="gsd2:complete-milestone", args="${milestone_version}")
```

Verify archive exists:

```bash
ls .planning/milestones/v${milestone_version}-ROADMAP.md 2>/dev/null
```

If missing: handle_blocker "Complete milestone did not produce expected archive files."

**5c. Cleanup**

```
Skill(skill="gsd2:cleanup")
```

Cleanup shows its own dry-run and asks user for approval internally -- acceptable pause per CTRL-01 (explicit decision about file deletion).

**5d. Final Completion**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > AUTONOMOUS > COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} -- {milestone_name}
 Status: Complete
 Lifecycle: audit -> complete -> cleanup

 Ship it!
```

</step>

<step name="handle_blocker">

## 6. Handle Blocker

Present 3 options via AskUserQuestion:
- Prompt: "Phase {N} ({Name}) encountered an issue: {description}"
- Options: "Fix and retry" / "Skip this phase" / "Stop autonomous mode"

**"Fix and retry"**: Re-run the failed step. If same step fails again, re-present options.
**"Skip this phase"**: Log `Phase {N} > {Name} -- Skipped by user`. Proceed to iterate.
**"Stop autonomous mode"**: Display summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > AUTONOMOUS > STOPPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Completed: {list of completed phases}
 Skipped: {list of skipped phases}
 Remaining: {list of remaining phases}

 Resume with: /gsd2:autonomous --from {next_phase}
```

</step>

</process>

<success_criteria>
- All incomplete phases executed in order (smart discuss -> plan -> execute each)
- Smart discuss proposes grey area answers in tables; user accepts or overrides per area
- Progress banners displayed between phases
- Execute-phase invoked with --no-transition (WHY: autonomous manages its own transitions)
- Post-execution verification reads VERIFICATION.md and routes on status
- Passed -> auto-continue; human_needed -> user prompted; gaps_found -> user offered closure/continue/stop
- Gap closure limited to 1 retry (WHY: prevents infinite loops)
- Plan/execute failures route to handle_blocker
- ROADMAP.md re-read after each phase (WHY: catches inserted phases)
- STATE.md checked for blockers before each phase
- After all phases, lifecycle runs: audit -> complete -> cleanup
- Audit routing: passed -> auto-continue, gaps/debt -> user decides, missing -> handle_blocker
- Complete-milestone invoked with ${milestone_version} arg
- Cleanup internal confirmation is acceptable (CTRL-01)
- Progress bar uses phase number / total milestone phases (not position among incomplete)
</success_criteria>
