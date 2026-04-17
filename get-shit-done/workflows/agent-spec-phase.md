<purpose>
Generate an agent system design contract (AGENT-SPEC.md) for agentic phases. Orchestrates gsd-agent-researcher and gsd-agent-checker with a revision loop. Sits between discuss-phase and plan-phase; locks agent architecture, communication contracts, topology, observability, and security decisions before the planner creates tasks.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/AGENTIC-PATTERNS.md
</required_reading>

<process>

## 1. Initialize

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `has_research`, `commit_docs`, `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `planning_exists`.

```bash
AGENT_RESEARCHER_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-agent-researcher --raw)
AGENT_CHECKER_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-agent-checker --raw)
AGENT_SPEC_ENABLED=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.agent_spec 2>/dev/null || echo "true")
```

- If `AGENT_SPEC_ENABLED` is `false`: display "Agent spec phase is disabled in config. Enable via /gsd2:settings." Exit.
- If `planning_exists` is false: Error -- run `/gsd2:new-project` first.

## 2. Parse and Validate Phase

Extract phase number from $ARGUMENTS. If not provided, detect next unplanned phase.

```bash
PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
```

If `found` is false: Error with available phases.

## 3. Check Prerequisites

- If `has_context` is false: warn "No CONTEXT.md for Phase {N} -- run /gsd2:discuss-phase {N} first. Continuing without user decisions." (non-blocking)
- If `has_research` is false: warn "No RESEARCH.md for Phase {N} -- architecture decisions will be asked during agent research." (non-blocking)

## 4. Check Existing AGENT-SPEC

```bash
AGENT_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AGENT-SPEC.md 2>/dev/null | head -1)
```

If exists, use AskUserQuestion:
- header: "Existing AGENT-SPEC"
- question: "AGENT-SPEC.md already exists for Phase {N}. What would you like to do?"
- options: "Update -- re-run researcher with existing as baseline" / "View -- display current AGENT-SPEC and exit" / "Skip -- keep current, proceed to verification"

If "View": display file contents, exit. If "Skip": jump to step 7. If "Update": continue.

## 5. Spawn gsd-agent-researcher

Display:
```
---------------------------------------------------------
 GSD > AGENT SYSTEM DESIGN CONTRACT -- PHASE {N}
---------------------------------------------------------

> Spawning agent system researcher...
```

Build prompt (omit null file paths from `<files_to_read>`):

```markdown
You are a senior agentic systems consultant. Your job is to have a genuine conversation with the user about their agentic system architecture, educate them on tradeoffs, and fill out an AGENT-SPEC.md design contract.

Your character:
- You are NOT a form-filler. You are an expert who challenges overcomplicated approaches.
- If the user proposes a complex framework (like LangGraph) for a linear pipeline, push back and explain why a simpler chain approach would work better.
- Explain consequences of design choices. Example: If you choose X, debugging will look like Y. If you choose Z instead, you get W for free.
- At every agent boundary, specifically ask: what gets logged, what state is tracked, how to diagnose which agent failed.
- The agentic domain is newer than UI -- your educational role is higher priority here. Users often do not know what they do not know.

Your approach:
1. Open by showing what you detected from the codebase: existing agent files, framework imports, deployment patterns.
2. Map the phase goal to the closest topology pattern from the reference doc. Challenge the match if simpler would work.
3. Cover all 10 design dimensions through natural conversation, not a numbered list. Order follows what the user opens with.
4. For Design Decisions (dimensions 1-5): ask, educate on tradeoffs, let user decide.
5. For Cross-Cutting Concerns (dimensions 6-9): force a decision. Explain what happens if they skip it. Do not accept TBD or standard logging for observability.
6. For Lightweight Capture (dimension 10): ask briefly, note the answer, move on.
7. At each agent-to-agent boundary: define the message shape, what happens when it is malformed, and what gets logged.

Reference document: Read ~/.claude/get-shit-done/references/AGENTIC-PATTERNS.md for topology patterns, tradeoffs, failure modes, and observability requirements. Draw from this when educating the user.

<objective>
Create agent system design contract for Phase {phase_number}: {phase_name}.
Answer: "What architecture, communication, and observability contracts does this agentic system need?"
</objective>

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /gsd2:discuss-phase -- detected domain and locked decisions)
- {research_path} (Technical Research -- stack and architecture pre-work)
- ~/.claude/get-shit-done/references/AGENTIC-PATTERNS.md (Topology pattern catalog -- draw from this)
</files_to_read>

<output>
Write to: {phase_dir}/{padded_phase}-AGENT-SPEC.md
Template: ~/.claude/get-shit-done/templates/AGENT-SPEC.md
</output>

<rules>
- Every section in the template must have content. No section left as placeholder.
- The Observability section MUST name at least one tracing tool, describe boundary-level logging for each agent pair, and include a failure diagnosis path.
- Every agent in the roster MUST have at least one communication contract defined.
- The Rationale subsection in each dimension MUST explain WHY, not just repeat WHAT.
- Test contracts MUST use the scenario/observable/pass-criteria format from TEST-SPEC.md.
- Include at least one test contract per agent in the roster.
</rules>

<config>
commit_docs: {commit_docs}
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

```
Task(
  prompt=agent_research_prompt,
  subagent_type="gsd-agent-researcher",
  model="{AGENT_RESEARCHER_MODEL}",
  description="Agent System Design Contract Phase {N}"
)
```

## 6. Handle Researcher Return

- If `## AGENT-SPEC COMPLETE`: display confirmation, continue to step 7.
- If `## AGENT-SPEC BLOCKED`: display blocker details and options, exit.

## 7. Spawn gsd-agent-checker

Display:
```
---------------------------------------------------------
 GSD > VERIFYING AGENT-SPEC
---------------------------------------------------------

> Spawning agent spec checker...
```

Build prompt:

```markdown
You are an agent system architecture reviewer. Validate the AGENT-SPEC.md against 10 dimensions. Return APPROVED or BLOCKED.

Validation dimensions -- each is binary against concrete criteria:

1. Dimension 1 Agent Roster: PASS if every agent has name, role description, model profile, tools list. FAIL if any agent is listed without all four fields.
2. Dimension 2 Orchestration Pattern: PASS if pattern is named, rationale explains why simpler will not work, reference to AGENTIC-PATTERNS.md is present. FAIL if pattern is unnamed or rationale is missing.
3. Dimension 3 Communication Contracts: PASS if every agent pair that communicates has message shape (as code block), malformed-message handling, and the number of contracts >= number of agents minus 1. FAIL if any communicating pair lacks a contract.
4. Dimension 4 Human-in-the-Loop: PASS if at least one decision point is defined with gate type and trigger condition. FLAG if section says none needed (acceptable but noteworthy). FAIL if section is empty.
5. Dimension 5 Memory Strategy: PASS if at least one memory type is described with scope and mechanism. FLAG if "no persistent memory needed" is stated with rationale. FAIL if section is empty.
6. Dimension 6 Observability: PASS if and only if (a) at least one tracing tool is named, (b) at least one boundary-level log statement is described per agent pair, (c) at least one failure diagnosis path is stated. FAIL if any of a, b, c is missing. "TBD" or "standard logging" is an automatic FAIL.
7. Dimension 7 Reflection: PASS if trigger condition, metrics, and failure response are defined. FLAG if "no reflection needed" with rationale. FAIL if empty.
8. Dimension 8 Security/Permissions: PASS if every agent has allowed/denied tools listed and scope constraints defined. FAIL if any agent lacks permission boundaries.
9. Dimension 9 Error Handling: PASS if at least one failure scenario per agent is defined with detection + recovery. FAIL if section is empty or has fewer scenarios than agents.
10. Dimension 10 Reasoning Approach: PASS if 3+ bullet points describe task decomposition approach. FLAG if fewer than 3. FAIL if empty.

Blocking criteria: Any dimension at FAIL = BLOCKED. All dimensions PASS or FLAG = APPROVED.

Additional cross-checks:
- Number of communication contracts should be >= (number of roster agents - 1). If not, FLAG with explanation.
- Test contracts section should have >= 1 contract per roster agent. If not, FLAG.
- Every Rationale subsection should contain "because" or equivalent causal reasoning. If any is purely descriptive (restates WHAT without WHY), FLAG that dimension.

<objective>
Validate agent system design contract for Phase {phase_number}: {phase_name}.
Check all 10 dimensions. Return APPROVED or BLOCKED.
</objective>

<files_to_read>
- {phase_dir}/{padded_phase}-AGENT-SPEC.md (Agent System Design Contract -- PRIMARY INPUT)
- {context_path} (USER DECISIONS -- check compliance)
- {research_path} (Technical Research -- check architecture alignment)
- ~/.claude/get-shit-done/references/AGENTIC-PATTERNS.md (Topology reference -- validate pattern match)
</files_to_read>

<return_format>
On approval, use heading "## AGENT-SPEC VERIFIED" with 10 dimension checkboxes (one per dimension above) and "**Approval:** approved {YYYY-MM-DD}".

On blocking issues, use heading "## ISSUES FOUND" with two subsections:
### Critical (must fix)
- {dimension}: {specific gap}
### Recommended (non-blocking)
- {dimension}: {non-blocking observation}
</return_format>

<config>
agent_spec_gate: {workflow.agent_spec_gate config value}
</config>
```

```
Task(
  prompt=agent_checker_prompt,
  subagent_type="gsd-agent-checker",
  model="{AGENT_CHECKER_MODEL}",
  description="Verify AGENT-SPEC Phase {N}"
)
```

## 8. Handle Checker Return

- If `## AGENT-SPEC VERIFIED`: display dimension results, proceed to step 10.
- If `## ISSUES FOUND`: display blocking issues, proceed to step 9.

## 9. Revision Loop (Max 2 Iterations)

Track `revision_count` (starts at 0).

```
if revision_count < 2:
  increment revision_count
  re-spawn gsd-agent-researcher with revision prompt (below) -> then re-run step 7
else:
  show remaining issues + AskUserQuestion:
    1. Force approve -- proceed with current AGENT-SPEC (FLAGs accepted)
    2. Edit manually -- open AGENT-SPEC.md in editor, re-run /gsd2:agent-spec-phase
    3. Abandon -- exit without approving
```

Revision prompt addition:
```markdown
<revision>
The agent checker found issues with the current AGENT-SPEC.md.

### Issues to Fix
{paste blocking issues from checker return}

Read the existing AGENT-SPEC.md, fix ONLY the listed issues, re-write the file.
Do NOT re-ask the user questions that are already answered.
</revision>
```

## 10. Present Final Status

```
---------------------------------------------------------
 GSD > AGENT-SPEC READY
---------------------------------------------------------

**Phase {N}: {Name}** -- agent system design contract approved

Dimensions: {N}/10 passed
{If any FLAGs: "Recommendations: {N} (non-blocking)"}

---------------------------------------------------------------

## Next Up

**Plan Phase {N}** -- planner will use AGENT-SPEC.md as architecture context

`/gsd2:plan-phase {N}`

<sub>/clear first -> fresh context window</sub>

---------------------------------------------------------------
```

## 11. Commit (if configured)

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): agent system design contract" --files "${PHASE_DIR}/${PADDED_PHASE}-AGENT-SPEC.md"
```

## 12. Update State

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} AGENT-SPEC approved" \
  --resume-file "${PHASE_DIR}/${PADDED_PHASE}-AGENT-SPEC.md"
```

</process>

<success_criteria>
- [ ] Config checked (exit if agent_spec disabled)
- [ ] Phase validated against roadmap
- [ ] Prerequisites checked (CONTEXT.md, RESEARCH.md -- non-blocking warnings)
- [ ] Existing AGENT-SPEC handled (update/view/skip)
- [ ] gsd-agent-researcher spawned with consultant character and AGENTIC-PATTERNS.md reference
- [ ] AGENT-SPEC.md created in correct location
- [ ] gsd-agent-checker spawned with AGENT-SPEC.md
- [ ] All 10 dimensions evaluated against binary criteria
- [ ] Revision loop if BLOCKED (max 2 iterations)
- [ ] Final status displayed with next steps
- [ ] AGENT-SPEC.md committed (if commit_docs enabled)
- [ ] State updated
</success_criteria>
</content>
</invoke>