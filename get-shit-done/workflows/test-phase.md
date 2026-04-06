<purpose>
Generate a verification contract (TEST-SPEC.md) for a phase. Spawns gsd-test-designer which infers behavior-level scenarios from REQUIREMENTS/CONTEXT/RESEARCH, runs an internal coverage loop, and presents the user with a plain-language digest for approval. Sits between discuss-phase and plan-phase; locks "what does done mean" as runnable scenarios before the planner creates tasks.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<process>

## 1. Initialize

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `has_research`, `commit_docs`, `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `planning_exists`.

```bash
TEST_DESIGNER_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-test-designer --raw)
TEST_PHASE_ENABLED=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.test_phase 2>/dev/null || echo "true")
```

- If `TEST_PHASE_ENABLED` is `false`: display "Test phase is disabled in config. Enable via /gsd2:settings." Exit.
- If `planning_exists` is false: Error — run `/gsd2:new-project` first.

Also detect UI-SPEC.md (frontend phases) for copywriting alignment:
```bash
UI_SPEC_PATH=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

## 2. Parse and Validate Phase

Extract phase number from $ARGUMENTS. If not provided, detect next unplanned phase.

```bash
PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
```

If `found` is false: error with available phases.

## 3. Check Prerequisites

- If REQUIREMENTS.md missing: **blocking error** — "REQUIREMENTS.md required for verification contract. Run /gsd2:new-milestone or define requirements first."
- If `has_context` is false: warn "No CONTEXT.md for Phase {N} — run /gsd2:discuss-phase {N} first. Continuing without locked decisions." (non-blocking)
- If `has_research` is false: warn "No RESEARCH.md for Phase {N} — stack hints will be inferred from package.json." (non-blocking)

## 4. Check Existing TEST-SPEC

```bash
TEST_SPEC_FILE=$(ls "${PHASE_DIR}"/*-TEST-SPEC.md 2>/dev/null | head -1)
```

If exists, use AskUserQuestion:
- header: "Existing TEST-SPEC"
- question: "TEST-SPEC.md already exists for Phase {N}. What would you like to do?"
- options:
  - "Update — re-run designer with existing as baseline"
  - "View — display current TEST-SPEC and exit"
  - "Skip — keep current, proceed"

If "View": display file contents, exit. If "Skip": jump to step 7. If "Update": continue.

## 5. Spawn gsd-test-designer

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFICATION CONTRACT — PHASE {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning test designer...
```

Build prompt (omit null file paths from `<files_to_read>`):

```markdown
Read ~/.claude/agents/gsd-test-designer.md for instructions.

<objective>
Create verification contract for Phase {phase_number}: {phase_name}
Answer: "How will we know this phase actually works when it's done?"
</objective>

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements — PRIMARY INPUT, every requirement must map to a scenario)
- {context_path} (USER DECISIONS from /gsd2:discuss-phase — locked behavior)
- {research_path} (Technical Research — stack hints)
- {ui_spec_path} (UI Spec — copywriting strings to assert against, if frontend phase)
</files_to_read>

<output>
Write to: {phase_dir}/{padded_phase}-TEST-SPEC.md
Template: ~/.claude/get-shit-done/templates/TEST-SPEC.md
</output>

<config>
commit_docs: {commit_docs}
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

```
Task(
  prompt=test_designer_prompt,
  subagent_type="gsd-test-designer",
  model="{TEST_DESIGNER_MODEL}",
  description="Verification Contract Phase {N}"
)
```

## 6. Handle Designer Return

- If `## TEST-SPEC COMPLETE`: display scenario summary, continue to step 7.
- If `## TEST-SPEC NOT APPLICABLE`: display reason, continue to step 7 (stub was written).
- If `## TEST-SPEC BLOCKED`: display blocker details and options, exit.

## 7. Present Final Status

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST-SPEC READY ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {N}: {Name}** — Verification contract approved

Scenarios: {N} ({user_flows} user flows, {api_promises} API contracts)
Coverage: {covered}/{total} requirements
{If gaps: "⚠ Uncovered requirements: {list}"}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan Phase {N}** — planner will use TEST-SPEC.md scenarios as task acceptance criteria

`/gsd2:plan-phase {N}`

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────
```

## 8. Commit (if configured)

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): verification contract" --files "${PHASE_DIR}/${PADDED_PHASE}-TEST-SPEC.md"
```

## 9. Update State

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} TEST-SPEC approved" \
  --resume-file "${PHASE_DIR}/${PADDED_PHASE}-TEST-SPEC.md"
```

</process>

<success_criteria>
- [ ] Config checked (exit if test_phase disabled)
- [ ] Phase validated against roadmap
- [ ] REQUIREMENTS.md present (blocking)
- [ ] CONTEXT.md present (non-blocking warning)
- [ ] Existing TEST-SPEC handled (update/view/skip)
- [ ] gsd-test-designer spawned with correct context and file paths
- [ ] TEST-SPEC.md created in correct location
- [ ] Final status displayed with scenario count and next steps
- [ ] TEST-SPEC.md committed (if commit_docs enabled)
- [ ] State updated
</success_criteria>
