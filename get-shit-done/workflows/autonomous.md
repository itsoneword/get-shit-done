<purpose>

Drive all remaining milestone phases autonomously. For each incomplete phase: discuss, plan, execute via Skill() invocations. Pauses only for explicit user decisions. Re-reads ROADMAP.md after each phase to catch dynamically inserted phases.

The iterate loop now runs independent frontier phases in parallel: each round it computes the runnable frontier (`roadmap frontier`), and any co-schedulable phases (no shared `files_modified`) launch as per-worktree headless processes, capped by the `max_parallel_phases` config key (default 4). Falls back to today's serial inline execution when `parallelization=false` or only one phase is runnable this round.

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

Parse `$ARGUMENTS` for `--phase N` flag and detect harness mode:

```bash
SINGLE_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-phase\s+[0-9]'; then
  SINGLE_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-phase\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi
HARNESS_MODE=""
if [ -n "$GSD_RUN_ID" ]; then HARNESS_MODE="true"; fi
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

If `SINGLE_PHASE` is set, display: `Single-phase mode: phase ${SINGLE_PHASE}`

If `HARNESS_MODE` is true, display: `Harness mode: run ${GSD_RUN_ID} — non-interactive routing active`

</step>

<step name="discover_phases">

## 2. Discover Phases

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

Parse `phases` array. Filter to incomplete: `disk_status !== "complete"` OR `roadmap_complete === false`. If `FROM_PHASE` set, exclude phases where `number < FROM_PHASE` (numeric comparison for decimals like "5.1"). Sort by `number` ascending.

**Single-phase mode (`SINGLE_PHASE` set):** restrict the phase list to exactly that phase number. If the phase is not in ROADMAP.md: end immediately with final line `PHASE RESULT: failed phase=${SINGLE_PHASE} reason=not-found`. If the phase is already complete (disk_status complete AND roadmap_complete): end immediately with final line `PHASE RESULT: completed phase=${SINGLE_PHASE} reason=already-complete`. In single-phase mode the lifecycle step (audit/complete/cleanup) is NEVER entered — after the one phase finishes, emit the PHASE RESULT line (see execute_phase step) and stop.

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

**3a.0 Resume Detection (HARNESS_MODE only)**

If HARNESS_MODE is not true, skip to step 3a immediately.

Set the snapshot file path:

```bash
SNAPSHOT_FILE="$(pwd)/.planning/run/$GSD_RUN_ID/parked/phase-${PHASE_NUM}.json"
```

If the snapshot file is absent (`[ -f "$SNAPSHOT_FILE" ]` is false), skip to step 3a (normal new-phase path).

If the snapshot file exists:

Read `QUESTION_ID` from the snapshot using a synchronous node one-liner:

```bash
QUESTION_ID=$(node -e "const s=JSON.parse(require('fs').readFileSync('$SNAPSHOT_FILE','utf8')); process.stdout.write(s.question_id||'')")
```

Query the mailbox for that question's status:

```bash
MAILBOX_STATUS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox list $GSD_RUN_ID --raw | \
  node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('close',()=>{const recs=d.join('').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);const r=recs.find(r=>r.id==='$QUESTION_ID');process.stdout.write(r?r.status:'missing');})")
```

If `MAILBOX_STATUS` is not `"answered"`: skip to step 3a (still parked). In single-phase mode: emit `PHASE RESULT: parked phase=${PHASE_NUM} q=${QUESTION_ID}` and stop.

If `MAILBOX_STATUS` is `"answered"`: enter the **RESUME ROUTE** (four sub-steps below). Any path that enters the resume route does NOT proceed to existing step 3a. Step 3a runs only when the snapshot file is absent or the mailbox question is not answered.

---

**Step R1: Re-read planning state**

```bash
cat .planning/STATE.md
cat .planning/ROADMAP.md
cat .planning/cross-phase-notes.md 2>/dev/null
```

Extract `ANSWER_TEXT` from the mailbox record (same pipeline as `MAILBOX_STATUS` but writes `r.answer` instead of `r.status`):

```bash
ANSWER_TEXT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox list $GSD_RUN_ID --raw | \
  node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('close',()=>{const recs=d.join('').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);const r=recs.find(r=>r.id==='$QUESTION_ID');process.stdout.write(r&&r.answer?r.answer:'');})")
```

---

**Step R2: Staleness gate**

Run the staleness check:

```bash
STALENESS_RAW=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" park staleness $GSD_RUN_ID --phase $PHASE_NUM --raw 2>&1)
```

Check if the output is valid JSON (pipe to node -e JSON.parse, exit 0 on success, exit 1 on parse error):

```bash
echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{try{JSON.parse(d.toString());process.exit(0);}catch{process.exit(1);}})"
```

If parse error (exit 1): log the failure to run.log, emit the PHASE RESULT line, and stop — no CONTEXT.md write and no ledger append:

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_FAILURE phase=$PHASE_NUM reason=staleness-parse-error" >> "$GSD_RUN_LOG"
echo "PHASE RESULT: failed phase=${PHASE_NUM} reason=staleness-parse-error"
# stop execute_phase
```

If valid JSON: extract the four fields using separate node -e inline scripts on `$STALENESS_RAW`:

```bash
CHANGED=$(echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d.toString());process.stdout.write(JSON.stringify(s.changed));})")
MISSING=$(echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d.toString());process.stdout.write(JSON.stringify(s.missing));})")
RESUME_INSTRUCTION=$(echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d.toString());process.stdout.write(s.resume_instruction||'');})")
GIT_RANGE=$(echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d.toString());process.stdout.write(s.git_range||'n/a');})")
```

Display the staleness block: changed files, missing files, git range.

If `CHANGED` is not `[]` OR `MISSING` is not `[]` (drift detected): do NOT write CONTEXT.md, do NOT call ledger append. Append a new mailbox question with `"status":"pending"` and context mentioning "state moved since park", the changed files, and the git_range:

```bash
Q_NEW=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data \
  "{\"question\":\"Phase $PHASE_NUM parked branch cannot resume: planning state moved since park. Re-answer with current context.\",\"phase\":$PHASE_NUM,\"context\":\"Staleness check at resume: changed=$CHANGED git_range=$GIT_RANGE. Original question: $QUESTION_ID. Original answer: $ANSWER_TEXT.\",\"status\":\"pending\"}")
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_PARKED phase=$PHASE_NUM q=$Q_NEW" >> "$GSD_RUN_LOG"
echo "PHASE RESULT: parked phase=${PHASE_NUM} q=${Q_NEW}"
# stop execute_phase
```

If `CHANGED` is `[]` AND `MISSING` is `[]` (clean): proceed to Step R3.

---

**Step R3: Idempotency check + CONTEXT.md write**

Run the idempotency check before any write: scan the ledger for any record where `r.supersedes === QUESTION_ID` OR where `r.evidence` contains `QUESTION_ID`. Capture result as `"true"` or `"false"` in `EXISTING_SUPER`:

```bash
EXISTING_SUPER=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ledger list $GSD_RUN_ID --raw | \
  node -e "process.stdin.on('data',d=>{const lines=d.toString().split('\n').filter(Boolean);const qid='$QUESTION_ID';const found=lines.some(l=>{try{const r=JSON.parse(l);return r.supersedes===qid||(typeof r.evidence==='string'&&r.evidence.includes(qid));}catch{return false;}});process.stdout.write(found?'true':'false');})")
```

If `EXISTING_SUPER` is `"true"`: a superseding record already exists from a prior partial attempt; CONTEXT.md already has the answer. Skip to Step R4.

If `EXISTING_SUPER` is `"false"`:

Read `CONTEXT_PATH` from the snapshot:

```bash
CONTEXT_PATH=$(node -e "const s=JSON.parse(require('fs').readFileSync('$SNAPSHOT_FILE','utf8')); process.stdout.write(s.context_path||'')")
```

Write the settled answer as a `### Resume Decision (from q-${QUESTION_ID})` subsection with `- ${ANSWER_TEXT}` as a bullet inside the phase CONTEXT.md `<decisions>` block, before the closing `</decisions>` tag.

If the write fails: log `PHASE_FAILURE phase=$PHASE_NUM reason=context-write-error` to `$GSD_RUN_LOG`, emit `PHASE RESULT: failed phase=${PHASE_NUM} reason=context-write-error`, and stop. Do NOT call ledger append.

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_FAILURE phase=$PHASE_NUM reason=context-write-error" >> "$GSD_RUN_LOG"
echo "PHASE RESULT: failed phase=${PHASE_NUM} reason=context-write-error"
# stop execute_phase
```

If the write succeeds: run `gsd-tools ledger append` with the superseding record JSON:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ledger append --data \
  "{\"decision\":\"Answer to parked question $QUESTION_ID\",\"alternatives\":[],\"evidence\":\"Resumed after human answered $QUESTION_ID: $ANSWER_TEXT\",\"confidence\":\"HIGH\",\"escalated\":null,\"supersedes\":\"$QUESTION_ID\",\"phase\":\"$PHASE_NUM\"}"
```

If `ledger append` exits non-zero: log `PHASE_FAILURE phase=$PHASE_NUM reason=ledger-write-error` to `$GSD_RUN_LOG`, emit `PHASE RESULT: failed phase=${PHASE_NUM} reason=ledger-write-error`, and stop.

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_FAILURE phase=$PHASE_NUM reason=ledger-write-error" >> "$GSD_RUN_LOG"
echo "PHASE RESULT: failed phase=${PHASE_NUM} reason=ledger-write-error"
# stop execute_phase
```

---

**Step R4: Replay the blocked step**

Display the resume instruction and the answer that was applied:

```
Resume: ${RESUME_INSTRUCTION}
Answer applied: ${ANSWER_TEXT}
```

Re-enter the workflow at the step named in `RESUME_INSTRUCTION`. The answer is locked in CONTEXT.md — the replayed step MUST read CONTEXT.md decisions and treat `### Resume Decision` entries as locked (do NOT re-ask the answered question).

If the replay succeeds (verification passes): log `PHASE_COMPLETE phase=$PHASE_NUM` to `$GSD_RUN_LOG`, then proceed to 3b/3c/3d for the remainder of the phase.

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_COMPLETE phase=$PHASE_NUM" >> "$GSD_RUN_LOG"
```

If the replay parks again (a new question arose during replay): capture the new q-NNN from the output and emit `PHASE RESULT: parked phase=${PHASE_NUM} q=q-NEW-NNN`.

---

**3a. Smart Discuss**

Fetch phase state (cache result -- reuse in 3b and 3d):

```bash
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
```

Parse `has_context`, `phase_dir` from JSON.

- If `has_context` true: Display `Phase ${PHASE_NUM}: Context exists -- skipping discuss.` Proceed to 3b.
- If false AND `HARNESS_MODE` is not true: Execute the smart_discuss step (unchanged interactive path). After completion, re-fetch `PHASE_STATE` and verify `has_context`. If still false: handle_blocker "Smart discuss for phase ${PHASE_NUM} did not produce CONTEXT.md."
- If false AND `HARNESS_MODE` is true: do NOT run smart_discuss. Invoke the real discuss skill so the escalation evaluator (Phase 11) and park branch (Phase 12) fire:

  ```
  Skill(skill="gsd2:discuss-phase", args="${PHASE_NUM} --auto")
  ```

  Route on the skill's return:
  - Output contains `PHASE PARKED` → the phase is parked (mailbox question + snapshot were already written by discuss-phase). Skip 3b/3c/3d entirely; the phase outcome is `parked` — capture the q-NNN id from the PHASE PARKED block for the PHASE RESULT line. In single-phase mode: end response with `PHASE RESULT: parked phase=${PHASE_NUM} q=q-NNN` (use captured q-NNN or `q-unknown` if id not in output).
  - Output contains `design contract is required` (UI/Agentic auto-chain pause) → append a mailbox question so it surfaces in the morning inbox:

    ```bash
    node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data '{"question":"Phase ${PHASE_NUM} needs an interactive design contract (ui-phase/agent-spec-phase) before planning — run it, then rerun the phase","phase":${PHASE_NUM},"context":"autonomous harness mode: discuss-phase --auto paused its chain at the design-contract gate","status":"pending"}'
    ```

    The phase outcome is `failed` with reason `needs-design-contract`. Skip 3b/3c/3d. In single-phase mode: end response with `PHASE RESULT: failed phase=${PHASE_NUM} reason=needs-design-contract`.
  - Otherwise → discuss succeeded. Note: discuss-phase --auto auto-advances (it may have already chained plan-phase and even execute-phase). Re-fetch `PHASE_STATE` via `init phase-op` before each subsequent sub-step and SKIP what the chain already did: run 3b only if `has_plans` is false; run 3c only if no `*-VERIFICATION.md` exists in `${PHASE_DIR}`; always run 3d.

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

**Empty** (no file/field):
- HARNESS_MODE: phase outcome is `failed` with reason `no-verification` — do not AskUserQuestion. In single-phase mode: emit `PHASE RESULT: failed phase=${PHASE_NUM} reason=no-verification` and stop. In multi-phase mode: treat as blocker (log it, skip to independent phases).
- Interactive: handle_blocker "Execute phase ${PHASE_NUM} did not produce verification results."

**`passed`**: Display `Phase ${PHASE_NUM} > ${PHASE_NAME} -- Verification passed`. Proceed to iterate. In single-phase mode: emit `PHASE RESULT: completed phase=${PHASE_NUM}` and stop.

**`human_needed`**:
- HARNESS_MODE: do not ask. Read human_verification items from VERIFICATION.md. Append the deferred verification to the mailbox so it surfaces in the morning inbox:

  ```bash
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data '{"question":"Phase ${PHASE_NUM} completed but needs human verification: <one-line summary of the human_verification items from VERIFICATION.md>","phase":${PHASE_NUM},"context":"autonomous harness mode: verification status human_needed — items listed in ${PHASE_DIR}/<file>-VERIFICATION.md","status":"pending"}'
  ```

  Capture the printed q-NNN. Phase outcome is `completed` with `deferred_verification=q-NNN` on the PHASE RESULT line. Display `Phase ${PHASE_NUM} > Human validation deferred to inbox (q-NNN)`. In single-phase mode: emit `PHASE RESULT: completed phase=${PHASE_NUM} deferred_verification=q-NNN` and stop. In multi-phase mode: proceed to iterate.
- Interactive: Read human_verification items from VERIFICATION.md. Ask user:
  - "Phase ${PHASE_NUM} has items needing manual verification. Validate now or continue?"
  - Options: "Validate now" / "Continue without validation"

  On "Validate now": Present items, then ask "Validation result?" with "All good -- continue" / "Found issues". Issues route to handle_blocker.
  On "Continue without validation": Display `Phase ${PHASE_NUM} > Human validation deferred`. Proceed to iterate.

**`gaps_found`**:
- HARNESS_MODE: do not ask. Run gap closure exactly once automatically (the existing 1-attempt limit applies):

  ```
  Skill(skill="gsd2:plan-phase", args="${PHASE_NUM} --gaps")
  Skill(skill="gsd2:execute-phase", args="${PHASE_NUM} --no-transition")
  ```

  Re-read VERIFY_STATUS. `passed` → phase outcome `completed`; in single-phase mode emit `PHASE RESULT: completed phase=${PHASE_NUM}` and stop; otherwise proceed to iterate. `human_needed` → route per the harness human_needed branch above. Still `gaps_found` (or empty) → phase outcome `failed` with reason `gaps_found` (fail-safe direction: a wrongly-failed phase is reviewable in the morning; a wrongly-completed phase poisons downstream merges). In single-phase mode: emit `PHASE RESULT: failed phase=${PHASE_NUM} reason=gaps_found` and stop. In multi-phase mode: log and skip to independent phases.
- Interactive: Read gap summary. Display score. Ask user:
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

**Single-phase mode:** after the phase resolves (via 3d routing, a parked discuss, or a failure), do not iterate. End the response with the outcome line as the FINAL line of output, exactly one of:

```
PHASE RESULT: completed phase=${PHASE_NUM}
PHASE RESULT: completed phase=${PHASE_NUM} deferred_verification=q-NNN
PHASE RESULT: parked phase=${PHASE_NUM} q=q-NNN
PHASE RESULT: failed phase=${PHASE_NUM} reason=<short-kebab-reason>
```

This line is the runner's outcome contract (AGENT-SPEC: ambiguous outcomes are treated as failed by the caller) — it must be machine-greppable: `^PHASE RESULT: (completed|parked|failed) phase=`. Multi-phase mode (no `--phase`) does not emit it.

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

Skip grey areas already decided in prior phases. Triage first, then go only as deep as the phase demands: surface only the genuinely undecided areas (no fixed area count) and, within each, only the questions whose answer actually changes implementation (no fixed question count). A clear-cut phase may yield one area with one question; an ambiguous one may yield several. For each question: pre-select recommended answer (based on prior decisions, codebase patterns, domain conventions, ROADMAP criteria), generate 1-2 alternatives, annotate with prior decision/code context where relevant.

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
**"Discuss deeper"**: Switch to interactive mode for this area -- ask questions one-at-a-time with 2-3 options + "You decide". Continue while genuinely undecided, implementation-changing questions remain; once what's left is low-stakes, offer "More questions" / "Next area". On "Next area", show final summary.
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

## 4. Iterate — Frontier Scheduler

**Single-phase mode (`SINGLE_PHASE` set):** never enter this step. After execute_phase completes, the PHASE RESULT line has already been emitted and the response ends. Do not loop.

After each phase completion, compute the runnable frontier instead of picking the next roadmap-ordered phase. This step decides HOW MANY phases run next and their isolation; the per-phase lifecycle (discuss -> plan -> execute -> 3d verify/gap-closure/human_needed routing, ledger, mailbox, PHASE RESULT contract) is unchanged and is entered once per phase exactly as in `execute_phase` above -- for parallel phases it is entered inside a per-worktree headless process instead of inline.

**4a. Compute frontier + read config**

```bash
FRONTIER=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap frontier)
MAX_PAR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get max_parallel_phases)
PAR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get parallelization)
```

`config-get` returns the loadConfig defaults (`parallelization=true`, `max_parallel_phases=4`) even when `.planning/config.json` omits the keys, so these reads never emit error strings on a default project. Parse `frontier` (all runnable phases), `coschedulable[]` (the phases to run this round, after the axis-A file-overlap split), and `serialized[]` (phases deferred to a later round because they overlap a co-scheduled one) from the `FRONTIER` JSON. Surface `serialized` phases in the round's progress output -- do not silently drop them, they run in a later round once their conflicting sibling completes.

If `frontier` is empty: proceed to `lifecycle` (same as "all complete" today).

**4b. Establish a run-scoped log dir (unconditional, not harness-gated)**

Synthesize a run id when `$GSD_RUN_ID` is unset and always create the log dir -- this capture is NOT gated on harness mode, because the parallel path's merge decision (4d) reads these logs whether or not a human is watching:

```bash
RUN_ID="${GSD_RUN_ID:-$(date +%Y%m%d-%H%M%S)-$$}"
LOG_DIR=".planning/run/$RUN_ID"
mkdir -p "$LOG_DIR"
```

**4c. Serial fallback (default path, unchanged behavior)**

If `PAR` is `false` OR `coschedulable` has 1 or fewer phases: run the single next phase via today's INLINE path -- loop back to `execute_phase` in-process, no worktree, no headless launch. This is the common case and preserves current behavior exactly. Read STATE.md fresh and check Blockers/Concerns (unchanged from before):

```bash
cat .planning/STATE.md
```

If blockers found: handle_blocker. Otherwise loop back to `execute_phase` for the one coschedulable phase (or the sole frontier phase). After it resolves, return to 4a.

**4d. Parallel path (2+ co-schedulable phases, parallelization on)**

Launch up to `MAX_PAR` phases concurrently, each isolated in its own worktree. Parallel phases run headless with `--dangerously-skip-permissions` BY CONSTRUCTION (isolation via worktree, unattended autonomous run) -- acceptable per the P3 spike (cwd=worktree keeps all writes in-worktree) and every launch/merge is logged to the ledger for auditability.

**CRITICAL — one blocking shell, not model-driven steps.** The launch, the `wait`, and the merges MUST run inside a SINGLE Bash invocation. A model turn cannot block across a backgrounded process: if you background the phases (`&`) and then end the turn intending to "wait then merge" in a later step, the session exits and the merges never run (parallel-executor BUG #3, observed 2026-07-05). Run the whole block below as ONE Bash call and let it block until every phase has finished and merged.

This round launches at most `MAX_PAR` phases (the first `MAX_PAR` of `coschedulable`); any remainder stays in the frontier and is picked up by the next 4a round once a slot frees. Copy this block verbatim, substituting `$COSCHED` = the space-separated coschedulable phase numbers (capped to `MAX_PAR`), `$LOG_DIR`, and the gsd-tools path:

```bash
GT="$HOME/.claude/get-shit-done/bin/gsd-tools.cjs"
COSCHED="01 02"   # <- first MAX_PAR coschedulable phase numbers, space-separated
declare -A PID

# --- launch: worktree (with GSD provisioned) + background headless runner ---
for N in $COSCHED; do
  node "$GT" worktree add ".worktrees/phase-$N" "gsd/parallel-phase-$N" --provision-gsd
  node "$GT" ledger append --data '{"decision":"launched parallel phase '"$N"'","alternatives":"run this phase serially inline","evidence":"headless claude -p cwd=.worktrees/phase-'"$N"' log='"$LOG_DIR"'/phase-'"$N"'.log","confidence":"HIGH","escalated":false,"phase":"'"$N"'"}'
  ( cd ".worktrees/phase-$N" && claude -p "/gsd2:autonomous --phase $N" --dangerously-skip-permissions ) > "$LOG_DIR/phase-$N.log" 2>&1 &
  PID[$N]=$!
done

# --- BUG #3 fix: block here until ALL phase processes exit (do NOT split this out) ---
for N in $COSCHED; do wait "${PID[$N]}" || true; done

# --- merge each completed phase (serial, so shared-state resolves in phase order) ---
for N in $COSCHED; do
  RESULT=$(grep -oE 'PHASE RESULT: [a-z_]+' "$LOG_DIR/phase-$N.log" | tail -1)
  if echo "$RESULT" | grep -q completed; then
    MERGE=$(node "$GT" worktree merge "gsd/parallel-phase-$N" --shared-state)
    # gsd-tools JSON is pretty-printed ("clean": true, with a space) — the regex must tolerate whitespace.
    if echo "$MERGE" | grep -qE '"clean":[[:space:]]*true'; then
      node "$GT" roadmap update-plan-progress "$N"   # BUG #4: refresh ROADMAP centrally from merged SUMMARYs
      node "$GT" worktree remove ".worktrees/phase-$N" --branch "gsd/parallel-phase-$N"
      node "$GT" ledger append --data '{"decision":"merged parallel phase '"$N"'","alternatives":"leave worktree unmerged for manual review","evidence":"worktree merge --shared-state returned clean for gsd/parallel-phase-'"$N"'","confidence":"HIGH","escalated":false,"phase":"'"$N"'"}'
      echo "MERGED phase $N"
    else
      # Extract conflict file names as a plain space-joined string — never embed the raw
      # multi-line JSON in a ledger field (literal newlines = invalid JSON control chars).
      CONFLICTS=$(echo "$MERGE" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('close',()=>{try{process.stdout.write((JSON.parse(s).conflict_files||[]).join(' ')||'unknown')}catch{process.stdout.write('parse-error')}})")
      node "$GT" ledger append --data '{"decision":"parallel phase '"$N"' left unmerged (conflict beyond shared-state)","alternatives":"auto-resolve as ours","evidence":"conflict_files: '"$CONFLICTS"'","confidence":"HIGH","escalated":true,"phase":"'"$N"'"}'
      echo "CONFLICT phase $N: $CONFLICTS"
    fi
  else
    node "$GT" ledger append --data '{"decision":"parallel phase '"$N"' not merged","alternatives":"merge the branch","evidence":"PHASE RESULT was '"$RESULT"' (not completed); worktree left for review","confidence":"HIGH","escalated":true,"phase":"'"$N"'"}'
    echo "NOT-COMPLETED phase $N: $RESULT — worktree left for review"
  fi
done
```

Notes on the block:

- **BUG #2 (worktree GSD):** `worktree add --provision-gsd` symlinks the main tree's `.claude/` into each worktree, so the headless child rooted there has the `/gsd2` commands and `gsd-tools`. Without it a worktree forked off HEAD has no GSD (`.claude/` is untracked).
- **BUG #3 (async wait):** the `wait "${PID[$N]}"` loop is the whole point — it blocks the single Bash call until every backgrounded phase exits. Merges run only after. Never move the merge loop into a separate Bash call or later model step.
- **BUG #4 (shared state):** `worktree merge --shared-state` auto-resolves STATE.md/ROADMAP.md-only conflicts as "ours" (main), then `roadmap update-plan-progress <N>` refreshes ROADMAP centrally from the merged per-phase SUMMARY files (which never conflict — distinct phase dirs). A conflict OUTSIDE the shared set is a REAL conflict: left reviewable, worktree kept, `CONFLICT phase N` printed — surface it as a mailbox question in harness mode.
- **Failure isolation:** `wait ... || true` and per-phase merge handling mean one phase failing/parking never aborts its siblings; non-completed phases leave their worktree for review.

**4e. Loop**

After the block above returns (all phases drained, merges/reviews resolved), return to 4a: re-run `roadmap frontier` and repeat until the frontier is empty, then proceed to `lifecycle`. Serialized phases and any coschedulable phases beyond this round's `MAX_PAR` cap reappear in the next frontier automatically.

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

**HARNESS_MODE: never AskUserQuestion.** Log the blocker description in the response output. In single-phase mode: the phase outcome is `failed` with a short kebab-case reason derived from the blocker description (e.g. `reason=no-plans-produced`) — emit the PHASE RESULT line and stop. In multi-phase harness mode: treat as the existing 'Skip this phase' branch (log `Phase {N} > {Name} — Skipped (harness): {description}`) and proceed to iterate.

Interactive sessions: the existing 3-option AskUserQuestion, unchanged.

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
- Single-phase mode (--phase N) runs exactly one phase, never enters lifecycle, and ends with exactly one PHASE RESULT line
- Harness mode (GSD_RUN_ID set) delegates discuss to discuss-phase --auto and never calls smart_discuss
- Harness mode never invokes AskUserQuestion anywhere in the workflow — every former pause routes to mailbox + continue or to a failed outcome
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
- Frontier scheduler runs co-schedulable phases in parallel (per-worktree headless, capped at `max_parallel_phases`, default 4) and falls back to the serial inline path when `parallelization=false` or only one phase is runnable
</success_criteria>
