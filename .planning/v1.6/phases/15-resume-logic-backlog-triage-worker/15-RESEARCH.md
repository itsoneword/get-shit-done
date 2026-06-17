# Phase 15: Resume Logic + Backlog Triage Worker - Research

**Researched:** 2026-06-17
**Domain:** Agentic workflow wiring — autonomous.md / overnight.md integration, mailbox/park/ledger primitives
**Confidence:** HIGH

---

## Summary

Phase 15 wires two already-specified capabilities onto already-built primitives. No new library design is required. The research goal is to map exact integration points, expose precise primitive signatures, and identify the one real implementation risk (idempotency on resume replay). All decisions are locked in 15-CONTEXT.md and 15-AGENT-SPEC.md; this document provides the implementation-level evidence the planner needs to write executable tasks.

**Resume** is a conditional branch inserted at the TOP of `execute_phase` step 3a in `autonomous.md` — before the `has_context` check, before `smart_discuss` is ever considered. When a phase has a parked snapshot whose mailbox question is `status === "answered"`, the branch intercepts, runs `park staleness --raw`, and either re-parks (drift) or proceeds to write CONTEXT.md decisions + ledger superseding record + replay. All primitives are operational: `cmdParkStaleness`, `checkStaleness`, `cmdMailboxAnswer`, `answerRecord`, `printResumeHandoff`, `cmdLedgerAppend`. The one gap is idempotency: CONTEXT.md may be written but ledger may fail; resume-replay must check for an existing superseding record before re-writing.

**Triage** is a new step appended to `overnight.md` step 6 (finish) before the morning report, and also a standalone `/gsd2:triage` command. It reads `list-todos` + ROADMAP `## Backlog` section, assigns one of six verdicts with evidence per item, and calls `mailbox append` once per item. The inbox already handles non-decision-type mailbox entries via the `triage-verdict:` prefix on the `context` field.

**Primary recommendation:** Build resume as workflow prose (no new .cjs module needed — all gates are CLI calls to existing park/mailbox/ledger commands). Build triage as one new `bin/lib/triage.cjs` module (pure verdict-assignment functions + `cmdTriageRun` handler) following the Phase 10/12 pattern, with thin dispatch in gsd-tools.cjs. Two new workflow files: `workflows/autonomous.md` (edit existing), `workflows/overnight.md` (edit existing), `workflows/triage.md` (new). One new command stub: `commands/gsd2/triage.md`.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Resume entry point (SC1)**
- Resume is a branch inside the existing phase loop in `autonomous.md` (inherited by `overnight.md`), NOT a new top-level command
- Trigger condition: phase has `parked/phase-N.json` AND its mailbox question `status === "answered"`
- Detection happens before the discuss/plan/execute sub-steps — resume short-circuits to "continue the blocked step"

**Replay granularity (SC1)**
- Resume replays from the blocked step, not a full-phase restart
- The snapshot's `resume_instruction` is the literal replay directive
- The answer is applied as a locked decision (written into phase CONTEXT.md and ledger superseding record)

**Pre-replay sequence (SC1 contract)**
- Before replaying: (1) re-read STATE.md / ROADMAP.md / cross-phase-notes.md, (2) run `park staleness <run-id> --phase N`, (3) surface the staleness diff, (4) then replay

**Drift handling**
- Interactive morning path: human is present; diff is shown, no separate confirm prompt needed
- Headless auto-resume: if `changed` is non-empty or `missing` is non-empty, re-park with "state moved since park" note

**Triage input scope (TRIAGE-01)**
- Reads BOTH pending todos (`todos/pending/` via `list-todos`) AND ROADMAP `## Backlog` items (B-prefixed)

**Triage output + verdict schema (TRIAGE-01)**
- Six verdicts verbatim: already-done / obsolete / fold-into-phase / new-phase / needs-input / defer
- Each appended to MAILBOX.jsonl as a triage-type entry distinguishable by `context` prefix `triage-verdict:`
- One `mailbox append` per proposal — per-line atomic, no batch machinery needed

**Triage run posture**
- Folded into overnight run as a step after the phase loop (before/with morning report)
- Also available as standalone `/gsd2:triage` command

**Acceptance routing (TRIAGE-02)**
- Inbox stays THIN. Accept records `mailbox answer` + prints routing command. Does NOT execute disposal.

### Claude's Discretion

- Exact triage-entry `type`/marker field name and proposal-presentation format in the inbox
- Whether resume detection lives in `discover_phases` filtering vs a check at the top of `execute_phase`
- Exact routing command for each of the six verdicts (reuse existing skills/CLI)
- run.log line wording for resume/triage events (MUST reuse 16 locked TYPE tokens)
- Triage's per-item codebase-evidence-gathering method (grep/agent-read depth)
- Test structure (follows Phase 10+ unit-test conventions)

### Deferred Ideas (OUT OF SCOPE)

- Auto-running triage on a schedule independent of overnight
- One-click accept-and-execute in the inbox
- Resuming MORE than the blocked step (smarter drift-reconciliation)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TRIAGE-01 | `/gsd2:triage` analyzes pending todos/backlog against codebase + roadmap and emits six-verdict proposals into the mailbox, each with evidence | `list-todos` returns `{count, todos[{file, title, area, path}]}`; ROADMAP `## Backlog` is grep-parseable; `mailbox append` is per-line atomic via `appendFileSync`; six verdicts defined in 15-AGENT-SPEC.md contract |
| TRIAGE-02 | Triage writes only to the mailbox; routing executes only on human acceptance in the inbox | `cmdMailboxAppend` only writes MAILBOX.jsonl; inbox `present_and_discuss` rule "do not hardcode decision-type-only assumptions" already covers triage entries; `printResumeHandoff` pattern shows how to print-not-execute |

PARK-03 (resume staleness check) is already marked complete at primitive level (Phase 12); Phase 15's job is wiring it into autonomous.md's phase loop.

---

## Integration Points: Exact Splice Locations

### autonomous.md: Where the Resume Branch Inserts

The resume branch inserts at the **very beginning of step 3 (`execute_phase`)**, BEFORE the existing sub-step 3a. The current step 3a is:

```
3a. Smart Discuss
  - Fetch phase state: PHASE_STATE=$(... init phase-op ${PHASE_NUM})
  - Parse has_context, phase_dir
  - If has_context true: Display "Context exists -- skipping discuss." Proceed to 3b.
  - If false AND HARNESS_MODE not true: Execute smart_discuss step...
  - If false AND HARNESS_MODE true: Skill(skill="gsd2:discuss-phase", args="--auto")...
```

The new resume branch becomes **3a.0 (resume detection — runs before 3a)**:

```
3a.0 Resume Detection (HARNESS_MODE only)

If HARNESS_MODE is true:
  Check if snapshot exists: .planning/run/$GSD_RUN_ID/parked/phase-${PHASE_NUM}.json
  If snapshot exists:
    Read snapshot → parse question_id (snapshot.question_id)
    Check mailbox: gsd-tools mailbox list $GSD_RUN_ID --raw | grep question_id
    If mailbox record has status === "answered":
      ENTER RESUME ROUTE (see resume-gate → resume-replay sequence below)
      After resume route: PHASE RESULT emitted (completed/parked/failed); skip 3a–3d
  If snapshot absent or mailbox not answered: continue to existing 3a as normal
```

**Why before 3a and not in `discover_phases`**: `discover_phases` filters to `disk_status !== "complete"`. A parked phase is not complete, so it would still appear. The resume detection needs the mailbox check (runtime state), which `discover_phases` does not do. The check belongs at the start of `execute_phase` where `GSD_RUN_ID` and `PHASE_NUM` are both in scope. The AGENT-SPEC rationale confirms: "resuming short-circuits to 'continue the blocked step,' it does not re-run smart-discuss from scratch."

**Single-phase mode interaction**: In `--phase N` mode, `SINGLE_PHASE` is set. The resume branch fires correctly — the session was invoked explicitly to re-run phase N. After the resume route emits its PHASE RESULT line, the single-phase mode exits (same contract as any other execute_phase outcome).

### overnight.md: Where the Triage Step Inserts

The triage step inserts in **step 6 (finish)**, after the phase loop completes and before the morning report:

Current step 6 structure:
```
Step 6: Finish + morning report
  - if BLOCKED and SKIPPED empty AND one phase completed → RUN_COMPLETE
  - else → RUN_STOP
  - Then: gsd-tools run report $GSD_RUN_ID
  - Print report verbatim
  - Print "Morning: run /gsd2:inbox ${GSD_RUN_ID}..."
```

New structure:
```
Step 6: Finish + morning report
  - Determine RUN_COMPLETE vs RUN_STOP (unchanged)
  - [NEW] Step 6.5: Triage step
    Invoke triage workflow (inline or via Skill):
      node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" triage run
    On failure: log PHASE_FAILURE phase=triage reason=triage-failed; continue to report
  - gsd-tools run report $GSD_RUN_ID (unchanged)
  - Print report verbatim (unchanged)
  - Print "Morning: run /gsd2:inbox ${GSD_RUN_ID}..." (unchanged)
```

The triage step must reuse only existing 16-token TYPE vocabulary. Triage events log as:
- Per-item append success: no run.log line (the MAILBOX.jsonl line is the record)
- Per-item append failure: `PHASE_FAILURE phase=triage reason=mailbox-append-failed item=<title>`
- Triage step fatal: `PHASE_FAILURE phase=triage reason=triage-failed`

### inbox.md: How Triage-Type Entries Present

The inbox `present_and_discuss` step already includes the rule: "Do not hardcode decision-type-only assumptions about mailbox entries — Phase 15 adds triage-type entries flowing through this same inbox."

Detection: a mailbox entry with `context` field starting with `triage-verdict:` is a triage proposal. The inbox reads this in `load_questions` (all entries with `status !== 'answered'` are loaded regardless of type) and presents it with a different template block per 15-AGENT-SPEC:

```
---
Triage Proposal {q-NNN}
Verdict: <verdict>  Target: <phase or reason>
Item: <todo title or backlog item>
Evidence: <rationale text>
Options:
  A. accept — print routing command and mark answered
  B. defer — leave for a future triage session (mark answered with "deferred")
```

On accept: calls `mailbox answer <run-id> --id q-NNN --answer "accepted: <verdict>"` and prints the verdict-specific routing command. Does NOT execute the routing command.

The inbox workflow file (`workflows/inbox.md`) needs a prose addition to `present_and_discuss` describing the triage-entry detection and presentation. No structural changes to the workflow are needed — it is an extension of the existing THIN rule, not a replacement.

---

## Exact Primitive Signatures and Behavior

### park.cjs

**`buildParkSnapshot(opts)`** — pure function, returns the snapshot object:
```
opts: { phase, blockedAt, questionId, phaseDir, contextPath, resumeInstruction, contentHashes, gitHead }
Returns: { phase, blocked_at, question_id, phase_dir, context_path, resume_instruction, content_hashes, git_head, ts }
```
Content hashes keys (FIXED): `'STATE.md'`, `'ROADMAP.md'`, `'cross-phase-notes.md'`, `'CONTEXT.md'`

**`checkStaleness(cwd, snapshot)`** — pure function, never runs git:
```
Returns: { changed, unchanged, missing, git_range }
  changed: keys where hash differs (or null→non-null)
  unchanged: keys where hash is identical (including both null)
  missing: keys that were non-null at park but null now
  git_range: "<snapshot.git_head>..HEAD" or null
```
This is the resume gate's source of truth. `changed.length === 0 && missing.length === 0` = proceed.

**`cmdParkStaleness(cwd, runId, opts, raw)`** — CLI handler for `park staleness <run-id> --phase N [--raw]`:
- Reads `.planning/run/{runId}/parked/phase-{opts.phase}.json`
- Calls `checkStaleness`
- `--raw` output is a single JSON object: `{ phase, question_id, resume_instruction, changed, unchanged, missing, git_range }`
- Exit 1 if snapshot file missing or runId not set

**`snapshotPath(cwd, runId, phase)`** — returns absolute path to snapshot file: `.planning/run/{runId}/parked/phase-{phase}.json`

**`cmdParkCreate`** CLI: `park create <run-id> --phase N --question q-NNN [--blocked-at X] [--resume Y] [--phase-dir D] [--context-path C]`
- Writes the snapshot file; prints relative path

### mailbox.cjs

**`cmdMailboxAppend(cwd, runId, jsonString)`** — CLI handler for `mailbox append`:
- Only required field: `question`
- Auto-assigns `id` (q-NNN sequential), `ts`, `run_id`
- Default `status` is `"open"` (NOT "pending" — callers that need "pending" must pass `"status":"pending"` in the JSON; this is the Phase 14-03 lesson)
- Uses `appendFileSync` exclusively — never `writeFileSync`
- Prints the assigned `id` to stdout

**`answerRecord(records, qId, answerText)`** — pure function:
```
Returns:
  { error: 'not found' }         — qId not in records
  { error: 'already answered' }  — record.status === 'answered'
  { records: [...], record: <updated> }  — success; updated record has status:'answered', answer, answered_ts
```

**`cmdMailboxAnswer(cwd, runId, qId, answerText)`** — CLI: `mailbox answer [run-id] --id q-NNN --answer "text"`:
- Calls `answerRecord`; on success: `writeMailbox` (full-file rewrite — the ONLY legitimate rewrite path)
- Calls `printResumeHandoff` (prints resume block if snapshot exists)
- Prints `qId` to stdout

**`printResumeHandoff(cwd, runId, phase, out)`** — reads snapshot, calls `checkStaleness`, prints:
```
── Resume handoff: phase N ──
resume: <snapshot.resume_instruction>
staleness: <changed files or 'nothing changed since park'>
git range: <git_range or 'n/a'>
detail: gsd-tools park staleness <runId> --phase N
```
Returns `true` if printed, `false` if no snapshot or phase is null.

**`readMailbox(cwd, runId)`** — returns array of parsed records; `[]` if MAILBOX.jsonl absent; skips malformed lines.

**`filterMailbox(records, opts)`** — `opts.status` for exact status match; `opts.last` (default 50) for tail-N.

**Status semantics**: `"pending"` = parked by harness (the harness calls with explicit `"status":"pending"`); `"open"` = default for manually-appended or informational entries; `"answered"` = terminal state. Both `pending` and `open` count as unanswered in `load_questions` (`status !== 'answered'`).

### ledger.cjs

**`cmdLedgerAppend(cwd, runId, jsonString)`** — CLI: `ledger append [run-id] --data <json>`:
- Required fields: `decision`, `alternatives`, `evidence`, `confidence`, `escalated` (validated with `in` operator so `escalated: null` passes)
- Auto-assigns `id` (dec-NNN sequential), `ts`
- Uses `appendFileSync` exclusively
- Prints assigned `id` to stdout
- Exit 1 if `GSD_RUN_ID` not set and no explicit runId

**Superseding record pattern**: a new ledger record with a `supersedes` field referencing the original decision id. There is NO update/patch command. The superseding record is a new append. For Phase 15 resume, the superseding record shape:
```json
{
  "decision": "<the topic/question resolved>",
  "alternatives": ["<original options from mailbox record>"],
  "evidence": "Resumed after human answered q-NNN: <answer text>",
  "confidence": "HIGH",
  "escalated": null,
  "supersedes": "<original decision_id or q-NNN>",
  "phase": "N"
}
```

**`readLedger(cwd, runId)`** — returns array of parsed records; `[]` if absent; skips malformed lines.

**Idempotency gap (the flagged AGENT-SPEC gap)**: If CONTEXT.md is written with the answer but `ledger append` then fails, the next resume attempt will see:
- `snapshot.question_id` still exists, mailbox still shows `status: "answered"`
- Resume branch fires again
- CONTEXT.md already has the answer in the `<decisions>` block

The idempotency check must happen BEFORE writing CONTEXT.md, not before the ledger write. The check: scan `readLedger(cwd, runId)` for any record where `record.supersedes === snapshot.question_id` OR where the `evidence` field contains `q-NNN`. If found, the superseding record already exists — skip the ledger write; proceed to replay using the existing CONTEXT.md decisions. This makes resume idempotent on re-run even when a prior attempt partially succeeded.

### gsd-tools.cjs dispatch

**`case 'todo'`** at line 636:
- `subcommand === 'complete'` → `commands.cmdTodoComplete(cwd, args[2], raw)`
- `subcommand === 'match-phase'` → `commands.cmdTodoMatchPhase(cwd, args[2], raw)`
- No `list-todos` under `todo` — that is the top-level `case 'list-todos'` at line 438 → `commands.cmdListTodos(cwd, args[1], raw)`

**`cmdListTodos(cwd, area, raw)`** returns `{ count, todos: [{file, created, title, area, path}] }`. `--raw` outputs the count integer only. Without `--raw` the JSON object is printed. Triage should call it without `--raw` to get the full todos array.

**`cmdTodoMatchPhase(cwd, phase, raw)`** — keyword-scores todos against a phase's name/goal/section from ROADMAP. Returns `{ phase, matches: [{...todo, score, reasons}], todo_count }`. This is useful as evidence-gathering for triage verdicts (especially `fold-into-phase` scoring).

**`case 'mailbox'`** at line 945: supports `append`, `list`, `answer`, `review`.

**`case 'park'`** at line 1004: supports `create`, `staleness`.

**`case 'ledger'`** at line 902: supports `append`, `list`/`filter`.

**`case 'run'`** at line 1038: supports `init`, `snapshot`, `record-phase`, `status`, `report`.

Note on env-fallback dispatch: for `mailbox append` and `ledger append`, when the run-id arg starts with `--data`, the dispatch treats it as env-fallback mode (`effectiveRunId = undefined` → falls back to `process.env.GSD_RUN_ID`). This means all triage/resume CLI calls can omit the run-id when `GSD_RUN_ID` is exported in the environment (which overnight.md ensures via `export GSD_RUN_ID`).

### ROADMAP ## Backlog Parsing

The ROADMAP `## Backlog` section format (from live data):
```
## Backlog

### B1: Terse output default + verbose opt-in (BACKLOG)

**Goal:** ...
**Requirements:** TBD
**Plans:** 3/3 plans complete
```

Triage reads backlog items by grepping ROADMAP.md for `### B\d+:` headers and extracting the B-label + title. The `roadmap analyze` command does NOT parse the backlog section — backlog parsing is a new read-and-grep operation, not an existing primitive. The triage module must implement it as a pure function `parseRoadmapBacklog(cwd)` returning `[{ id: 'B1', title: '...', goal: '...', body: '...' }]`.

---

## Architecture Patterns

### Recommended New File Structure

```
get-shit-done/
  bin/lib/
    triage.cjs            # NEW: pure functions + cmdTriageRun + cmdParseBacklog
  workflows/
    autonomous.md         # EDIT: add resume branch before step 3a
    overnight.md          # EDIT: add triage step in finish (step 6.5)
    inbox.md              # EDIT: add triage-entry detection in present_and_discuss
    triage.md             # NEW: triage workflow prose for standalone /gsd2:triage
commands/gsd2/
  triage.md               # NEW: command stub
tests/
  triage.test.cjs         # NEW: unit tests for triage.cjs pure functions
```

No other files are added. `autonomous.md` and `overnight.md` are edited in-place (both are in `get-shit-done/workflows/` and synced via `npm run dev`).

### Pattern 1: Resume Detection at Top of execute_phase

The resume branch is a guard clause at the top of execute_phase step 3. In workflow prose:

```
## 3. Execute Phase

[banner display unchanged]

### 3a.0 Resume Detection (HARNESS_MODE only)

If HARNESS_MODE is true:
  SNAPSHOT_PATH=".planning/run/$GSD_RUN_ID/parked/phase-${PHASE_NUM}.json"
  
  If snapshot file exists:
    SNAPSHOT=$(cat "$SNAPSHOT_PATH")
    QUESTION_ID=$(echo "$SNAPSHOT" | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d.toString());process.stdout.write(s.question_id||'');})")
    
    MAILBOX_RECORD=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox list $GSD_RUN_ID --raw | \
      node -e "const lines=[]; process.stdin.on('data',d=>lines.push(...d.toString().split('\n').filter(Boolean))); process.stdin.on('close',()=>{ const id='${QUESTION_ID}'; const rec=lines.map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean).find(r=>r.id===id); process.stdout.write(rec?JSON.stringify(rec):'null'); })")
    
    If MAILBOX_RECORD is not 'null' AND the parsed record's status is "answered":
      ENTER RESUME ROUTE:
        [resume-gate: re-read planning state, run staleness, surface diff]
        [resume-replay: write CONTEXT.md + ledger + replay blocked step]
      After resume route: the PHASE RESULT line has been emitted; stop execute_phase.
  
  Otherwise: continue to step 3a (existing flow).
```

The exact parsing approach is Claude's discretion; the above is illustrative. The planner should choose a reliable bash-JSON approach consistent with existing patterns in overnight.md (which uses `node -e JSON.parse` for worktree merge result).

### Pattern 2: Resume-Gate (Staleness Gate)

```
STALENESS_RAW=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" park staleness $GSD_RUN_ID --phase $PHASE_NUM --raw 2>&1)

# Fail-safe: treat non-JSON as drift
if ! echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{try{JSON.parse(d.toString());process.exit(0);}catch{process.exit(1);}})"; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_FAILURE phase=$PHASE_NUM reason=staleness-parse-error" >> "$GSD_RUN_LOG"
  echo "PHASE RESULT: failed phase=$PHASE_NUM reason=staleness-parse-error"
  # exit execute_phase
fi

CHANGED=$(echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d.toString());process.stdout.write(JSON.stringify(s.changed));})")
MISSING=$(echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d.toString());process.stdout.write(JSON.stringify(s.missing));})")
RESUME_INSTRUCTION=$(echo "$STALENESS_RAW" | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d.toString());process.stdout.write(s.resume_instruction||'');})")

if [ "$CHANGED" != "[]" ] || [ "$MISSING" != "[]" ]; then
  # DRIFT: re-park
  Q_NEW=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data \
    "{\"question\":\"Phase $PHASE_NUM parked branch cannot resume: planning state moved since park. Re-answer with current context.\",\"phase\":$PHASE_NUM,\"context\":\"Staleness check at resume: changed=$CHANGED git_range=$(echo $STALENESS_RAW | node -e ...). Original question: $QUESTION_ID. Original answer: $ANSWER_TEXT.\",\"status\":\"pending\"}")
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_PARKED phase=$PHASE_NUM q=$Q_NEW" >> "$GSD_RUN_LOG"
  echo "PHASE RESULT: parked phase=$PHASE_NUM q=$Q_NEW"
  # exit execute_phase
fi
# proceed to resume-replay
```

### Pattern 3: Resume-Replay (Write-Before-Replay Invariant)

The ordering is strict: CONTEXT.md write → ledger append → replay. Never replay without both writes having succeeded.

**Idempotency check (the AGENT-SPEC gap fix)**:

```
# Check for existing superseding record before any writes
EXISTING_SUPER=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ledger list $GSD_RUN_ID --raw | \
  node -e "process.stdin.on('data',d=>{const lines=d.toString().split('\n').filter(Boolean);const qid='$QUESTION_ID';const found=lines.some(l=>{try{const r=JSON.parse(l);return r.supersedes===qid||String(r.evidence).includes(qid);}catch{return false;}});process.stdout.write(found?'true':'false');})")

if [ "$EXISTING_SUPER" = "true" ]; then
  # Ledger already written (previous attempt partially succeeded). Skip to replay.
  # CONTEXT.md already has the answer (it was written before the ledger in the previous attempt).
else
  # Write CONTEXT.md decisions block with the settled answer
  # [write answer as locked decision into <decisions> block of phase CONTEXT.md]
  if failed:
    echo "PHASE_FAILURE phase=$PHASE_NUM reason=context-write-error" >> "$GSD_RUN_LOG"
    echo "PHASE RESULT: failed phase=$PHASE_NUM reason=context-write-error"
    exit

  # Write superseding ledger record
  DEC_ID=$(node ... ledger append --data '{"decision":"...","alternatives":[...],"evidence":"Resumed after human answered $QUESTION_ID: $ANSWER_TEXT","confidence":"HIGH","escalated":null,"supersedes":"$QUESTION_ID","phase":"$PHASE_NUM"}')
  if failed:
    echo "PHASE_FAILURE phase=$PHASE_NUM reason=ledger-write-error" >> "$GSD_RUN_LOG"
    echo "PHASE RESULT: failed phase=$PHASE_NUM reason=ledger-write-error"
    exit
fi

# Replay the blocked step
# Re-read STATE.md / ROADMAP.md / cross-phase-notes.md first (SC1 contract)
# Then re-enter the workflow step named in RESUME_INSTRUCTION
```

### Pattern 4: Triage Worker

The triage worker is a new module `bin/lib/triage.cjs` with pure functions exported for testing:

```javascript
// Pure functions (testable)
function parseRoadmapBacklog(cwd)       // → [{id, title, goal, body}]
function parseTodos(cwd)                // → [{file, title, area, path}] (wraps listTodosInternal)
function assignVerdict(item, codebaseCtx, roadmapCtx)  // → {verdict, evidence, target}
function buildTriageProposal(item, verdict, evidence, target)  // → mailbox JSON object

// CLI handler
async function cmdTriageRun(cwd, runId)  // reads todos+backlog, assigns verdicts, appends to mailbox
```

The `cmdTriageRun` function follows the Phase 10/12 pattern:
1. Resolve `effectiveRunId` (explicit arg or `process.env.GSD_RUN_ID`)
2. Gate: run dir must exist
3. Parse todos via `listTodosInternal` pattern
4. Parse ROADMAP backlog via `parseRoadmapBacklog`
5. For each item: read codebase evidence (grep/file reads), assign verdict via LLM reasoning in workflow prose, build proposal
6. Call `cmdMailboxAppend` per item; log failures and continue
7. Print summary: `triage complete: N proposals appended, M failed`

**Important**: `cmdTriageRun` is the I/O handler; the pure verdict-assignment logic in `assignVerdict` can be tested with mocked inputs. The actual LLM-driven verdict assignment happens in the triage workflow prose, not in the module — the module's job is to structure the items, write proposals, and handle failures.

### Anti-Patterns to Avoid

- **Replaying before writing CONTEXT.md**: The replayed discuss/plan step reads CONTEXT.md to find settled decisions. If the answer is absent, the step re-asks the same question, defeating the entire apparatus.
- **Using `writeMailbox` for triage appends**: `writeMailbox` is exclusively for terminal-state answer updates. Triage proposals MUST use `appendFileSync` via `cmdMailboxAppend`. Using `writeMailbox` for appends would clobber concurrent park events.
- **Appending `triage-verdict:` prefix to `question` instead of `context`**: The type discriminator belongs on `context`, not `question`. The inbox presents `question` verbatim to the human; the `context` field is the metadata channel.
- **Inventing a new run.log TYPE token**: The 16-token vocabulary is locked. Use `PHASE_FAILURE phase=triage reason=...` for triage step failures; use `PHASE_PARKED` for re-parks during resume.
- **Setting mailbox status `"open"` for harness-written triage proposals**: Must explicitly pass `"status":"pending"` in the JSON — `cmdMailboxAppend` defaults to `"open"`, which is wrong for harness-generated entries (Phase 14-03 lesson).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Staleness diffing of planning files | Custom hash comparison | `checkStaleness(cwd, snapshot)` from park.cjs | Already implements 4-key tracking, null handling, git_range; tested in park.test.cjs |
| Snapshot reading | Ad-hoc file read + parse | `snapshotPath(cwd, runId, phase)` + `JSON.parse(readFileSync(...))` | Path convention locked in Phase 12 |
| Mailbox type discrimination | New schema field or file | `triage-verdict:` prefix on `context` field | Schema locked in Phase 10; adding a field requires `cmdMailboxAppend` validation update |
| Batch-atomic triage writes | Transaction wrapper | Per-item `cmdMailboxAppend` with individual failure handling | `appendFileSync` is POSIX-atomic per line; partial runs are acceptable and re-runnable |
| Ledger update/patch | Rewrite DECISIONS.jsonl | New append with `supersedes` field | Write-once is the ledger invariant; no writeLedger export exists by design |
| Resume handoff display | Custom print block | `printResumeHandoff(cwd, runId, phase)` | Already prints resume_instruction + staleness; already called by `cmdMailboxAnswer` |
| ROADMAP phase lookup | Raw file parsing | `cmdTodoMatchPhase` for phase-keyword scoring; `cmdRoadmapGetPhase` for phase detail | These already extract goal + section text from ROADMAP.md |

---

## Common Pitfalls

### Pitfall 1: The Ledger-After-CONTEXT Inconsistency

**What goes wrong:** CONTEXT.md is written with the settled answer (so the phase's decisions block now shows the locked decision), but `ledger append` then fails (disk full, GSD_RUN_ID not set, permissions). The next overnight run detects the answered mailbox record, sees the snapshot, fires resume again, overwrites CONTEXT.md a second time (same content, but a second write), and appends a SECOND superseding ledger record — creating a duplicate audit entry.

**Why it happens:** Resume fires whenever `snapshot exists AND mailbox status === answered`. Without an idempotency check, a previously-partially-successful attempt looks identical to a fresh attempt.

**How to avoid:** Before any write, check `readLedger(cwd, runId)` for a record where `supersedes === question_id` OR where `evidence` contains the question_id. If found, skip to replay using existing CONTEXT.md.

**Warning signs:** Two ledger records with the same `supersedes` value; `PHASE_FAILURE reason=ledger-write-error` in run.log for a phase that later shows as completed.

### Pitfall 2: Triage Status Defaulting to "open" Instead of "pending"

**What goes wrong:** Triage proposals appear in the inbox as `status: "open"` (default). The inbox shows them but the morning report's "unanswered questions" count only shows entries where `status !== 'answered'` — both "open" and "pending" count, so the count is correct. However, if any future code distinguishes "open" from "pending" (e.g., a filter for harness-originated entries), triage proposals would be misclassified.

**Why it happens:** `cmdMailboxAppend` defaults `status: "open"`. The harness-parked questions explicitly pass `"status":"pending"` in their JSON data. Triage callers must do the same.

**How to avoid:** Always include `"status":"pending"` in the triage proposal JSON passed to `mailbox append --data`.

### Pitfall 3: Single-Phase Mode Resume After Overnight Run

**What goes wrong:** An overnight run parks phase 5. The next morning, the user answers via `/gsd2:inbox`. The user then manually runs `/gsd2:autonomous --phase 5` (which internally calls `autonomous.md --phase 5`). The resume branch fires and replays — CORRECT. However, if the user runs `/gsd2:autonomous` WITHOUT `--phase` (multi-phase mode), the discover_phases step lists phase 5 as incomplete, the phase loop enters execute_phase for phase 5, and the resume branch fires — also CORRECT. The bug scenario: the user runs autonomous.md WITHOUT `GSD_RUN_ID` set. `HARNESS_MODE` is false, so the resume detection (3a.0) is skipped entirely, and autonomous.md runs smart_discuss from scratch, generating a new CONTEXT.md over the existing one.

**How to avoid:** Resume detection is HARNESS_MODE-only by design (the snapshot was written by the harness; resuming outside the harness context requires a different path). The interactive path for resume is: human answers via inbox, sees the handoff, manually re-enters the blocked step. Do not add resume detection to the interactive path.

### Pitfall 4: ROADMAP Backlog Not Found

**What goes wrong:** `parseRoadmapBacklog` finds 0 items because the `## Backlog` heading is absent or the B-prefixed items use a different format.

**Why it happens:** The backlog section is optional in ROADMAP.md. If the current milestone has no backlog items, the section may be absent.

**How to avoid:** `parseRoadmapBacklog` must return `[]` gracefully when the section is absent. Triage with 0 backlog items is valid (it still runs on todos). Log a note: `triage: no backlog section found in ROADMAP.md; running on todos only`.

### Pitfall 5: Triage Deduplication on Re-Run

**What goes wrong:** A triage run is interrupted after items 1–3 of 10 are written. The user re-runs `/gsd2:triage`. Items 1–3 now have two pending proposals each in the mailbox.

**Why it happens:** Triage is idempotent at re-run by spec, but "idempotent" means "produces same proposals again" not "avoids duplicates." The AGENT-SPEC explicitly calls out that a deduplication guard is Claude's discretion.

**How to avoid (optional):** Before appending a proposal, check if a pending entry already exists for the same item title prefix: `readMailbox(cwd, runId).some(r => r.status !== 'answered' && r.question.includes(itemTitle))`. If found, skip the append. This prevents duplicates without requiring a full-file rewrite.

---

## Code Examples

### Resume Detection Check (from 15-AGENT-SPEC.md contract)

```bash
# Check if this phase has an answered snapshot (resume-gate trigger)
SNAPSHOT_FILE="$(pwd)/.planning/run/$GSD_RUN_ID/parked/phase-${PHASE_NUM}.json"
if [ -f "$SNAPSHOT_FILE" ]; then
  QUESTION_ID=$(node -e "const s=JSON.parse(require('fs').readFileSync('$SNAPSHOT_FILE','utf8')); process.stdout.write(s.question_id||'')")
  
  # Check mailbox for answered status
  MAILBOX_STATUS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox list $GSD_RUN_ID --raw | \
    node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('close',()=>{
      const recs=d.join('').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
      const r=recs.find(r=>r.id==='$QUESTION_ID');
      process.stdout.write(r?r.status:'missing');
    })")
  
  if [ "$MAILBOX_STATUS" = "answered" ]; then
    # ENTER RESUME ROUTE
    ANSWER_TEXT=$(node ... # extract answer from same mailbox record)
    # ... resume-gate + resume-replay sequence
  fi
fi
```

### Staleness Gate Call (CLI form)

```bash
# park staleness --raw output shape:
# {"phase":15,"question_id":"q-001","resume_instruction":"...","changed":[],"unchanged":[...],"missing":[],"git_range":"abc..HEAD"}
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" park staleness $GSD_RUN_ID --phase $PHASE_NUM --raw
```

### Superseding Ledger Record Write

```bash
# ledger append accepts --data <json>; GSD_RUN_ID in env means run-id arg can be omitted
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ledger append --data \
  "{\"decision\":\"<topic resolved by answer>\",\"alternatives\":[\"<option A>\",\"<option B>\"],\"evidence\":\"Resumed after human answered $QUESTION_ID: $ANSWER_TEXT\",\"confidence\":\"HIGH\",\"escalated\":null,\"supersedes\":\"$QUESTION_ID\",\"phase\":\"$PHASE_NUM\"}"
```

### Triage Mailbox Proposal Append

```bash
# One call per item; status must be "pending" (not the default "open")
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data \
  "{\"question\":\"Triage proposal: Add user sync checkpoints to plan-phase subagent chains\",\"phase\":null,\"context\":\"triage-verdict: fold-into-phase target=phase-15\",\"options\":[\"accept\",\"defer\"],\"evidence\":\"The todo references workflows/plan-phase.md. Phase 15 (resume logic) is the active autonomous-loop phase and is in-scope. Work belongs here.\",\"status\":\"pending\"}"
# → prints q-NNN to stdout
```

### Idempotency Check for Superseding Record

```javascript
// In triage.cjs or as workflow prose
const { readLedger } = require('./ledger.cjs');
function supersedingRecordExists(cwd, runId, questionId) {
  const records = readLedger(cwd, runId);
  return records.some(r =>
    r.supersedes === questionId ||
    (typeof r.evidence === 'string' && r.evidence.includes(questionId))
  );
}
```

### ROADMAP Backlog Parser

```javascript
// Pure function for tests — new in triage.cjs
function parseRoadmapBacklog(cwd) {
  const roadmapPath = require('path').join(cwd, '.planning', 'ROADMAP.md');
  if (!require('fs').existsSync(roadmapPath)) return [];
  const content = require('fs').readFileSync(roadmapPath, 'utf8');
  
  // Find ## Backlog section
  const backlogMatch = content.match(/^## Backlog\s*$([\s\S]*?)(?=^## |\z)/m);
  if (!backlogMatch) return [];
  
  const section = backlogMatch[1];
  const items = [];
  // Match ### B\d+: ... headers
  const headerRe = /^### (B\d+): (.+)$/gm;
  let m;
  while ((m = headerRe.exec(section)) !== null) {
    const id = m[1];
    const title = m[2].replace(/\s*\(BACKLOG\)\s*$/, '').trim();
    // Extract body until next ### or end
    const start = m.index + m[0].length;
    const nextHeaderMatch = /^### /m.exec(section.slice(start));
    const body = nextHeaderMatch
      ? section.slice(start, start + nextHeaderMatch.index)
      : section.slice(start);
    const goalMatch = body.match(/\*\*Goal:\*\*\s*(.+)/);
    items.push({ id, title, goal: goalMatch ? goalMatch[1].trim() : '', body: body.trim() });
  }
  return items;
}
```

### Routing Commands for Triage Verdicts (from 15-AGENT-SPEC.md)

| Verdict | Routing command printed by inbox |
|---------|----------------------------------|
| `already-done` | `node gsd-tools.cjs todo complete <todo-filename>` |
| `obsolete` | Manual: delete from `.planning/todos/pending/<filename>` |
| `fold-into-phase` | Manual: move todo reference to target phase notes |
| `new-phase` | Manual: add to ROADMAP.md `## Backlog` or run `/gsd2:add-phase` |
| `needs-input` | `# No command — provide input and re-run /gsd2:triage` |
| `defer` | `# No command — item remains in pending` |

Note: The exact command surface is Claude's discretion. Where existing CLI commands cover the operation (`todo complete`), use them. Where they do not (obsolete removal, new-phase addition), print a manual instruction. The planner should map this table precisely in the plan.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. This section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 20+) |
| Config file | none — scripts/run-tests.cjs discovers tests/*.test.cjs |
| Quick run command | `node --test tests/triage.test.cjs` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIAGE-01 | `parseRoadmapBacklog` extracts B-items from ROADMAP.md | unit | `node --test tests/triage.test.cjs` | ❌ Wave 0 |
| TRIAGE-01 | `parseRoadmapBacklog` returns [] when Backlog section absent | unit | `node --test tests/triage.test.cjs` | ❌ Wave 0 |
| TRIAGE-01 | `buildTriageProposal` produces required fields with `triage-verdict:` prefix | unit | `node --test tests/triage.test.cjs` | ❌ Wave 0 |
| TRIAGE-01 | Triage mailbox entry has `status: "pending"` not `"open"` | unit | `node --test tests/triage.test.cjs` | ❌ Wave 0 |
| TRIAGE-01 | Triage proposals are not written to ROADMAP.md or todo files | unit | `node --test tests/triage.test.cjs` | ❌ Wave 0 |
| TRIAGE-02 | Inbox detects `triage-verdict:` prefix in `context` field | workflow-prose | `grep -q 'triage-verdict:' get-shit-done/workflows/inbox.md` | ❌ Wave 0 |
| TRIAGE-02 | Inbox prints routing command, does not call routing command itself | workflow-prose | `grep -q 'print.*routing\|routing command' get-shit-done/workflows/inbox.md` | ❌ Wave 0 |
| PARK-03 (resume) | `checkStaleness` proceed path: changed=[], missing=[] | unit (existing) | `node --test tests/park.test.cjs` | ✅ |
| PARK-03 (resume) | Resume detection: snapshot present + mailbox answered → resume route | integration | `node --test tests/triage.test.cjs` (resume integration cases) | ❌ Wave 0 |
| PARK-03 (resume) | Drift re-park: changed non-empty → new mailbox entry, no CONTEXT.md write | integration | `node --test tests/triage.test.cjs` | ❌ Wave 0 |
| PARK-03 (resume) | Idempotency: superseding record present → skip ledger write, proceed to replay | unit | `node --test tests/triage.test.cjs` | ❌ Wave 0 |
| PARK-03 (resume) | CONTEXT.md write failure → abort, no ledger write | unit | `node --test tests/triage.test.cjs` | ❌ Wave 0 |

Observable success criteria from 15-AGENT-SPEC.md test contracts:

**TC-resume-1 (answered snapshot → replay)**:
- `park staleness --raw` called and returns `changed: []`
- Phase CONTEXT.md `<decisions>` block updated before any discuss/plan step runs
- `ledger append` called with record containing `supersedes: "q-NNN"`
- Workflow does NOT invoke `discuss-phase` from scratch
- `PHASE RESULT:` is `completed` or `parked q=q-NEW` (not `failed`)

**TC-resume-2 (drift → re-park)**:
- `park staleness --raw` returns `changed: ["ROADMAP.md"]`
- New mailbox entry appended with `status: "pending"` and "state moved since park" in context
- `PHASE RESULT:` is `parked phase=N q=q-NEW`
- `ledger append` NOT called
- CONTEXT.md NOT modified

**TC-resume-3 (staleness parse error → PHASE_FAILURE)**:
- run.log contains `PHASE_FAILURE phase=N reason=staleness-parse-error`
- No CONTEXT.md write
- No ledger append

**TC-triage-1 (proposals appended with correct prefix)**:
- `mailbox list --raw` returns N new entries with `context` starting `triage-verdict:`
- Each entry `status: "pending"`
- No todo file or ROADMAP.md modified

**TC-inbox-1 (accept prints routing, does not execute)**:
- `mailbox answer` called with `"accepted: <verdict>"`
- Routing command printed to stdout
- Todo file NOT modified, ROADMAP.md NOT modified

### Sampling Rate

- Per task commit: `node --test tests/triage.test.cjs`
- Per wave merge: `npm test`
- Phase gate: `npm test` green before `/gsd2:verify-work`

### Wave 0 Gaps

- [ ] `tests/triage.test.cjs` — covers TRIAGE-01, TRIAGE-02, resume idempotency, drift re-park, staleness-parse-error
- [ ] `get-shit-done/bin/lib/triage.cjs` — new module skeleton with exported pure functions
- [ ] Workflow prose edits: `workflows/autonomous.md` (resume branch), `workflows/overnight.md` (triage step), `workflows/inbox.md` (triage-entry detection)
- [ ] New files: `workflows/triage.md`, `commands/gsd2/triage.md`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Park-and-ask causes phase to fail/skip entirely | Park-and-ask halts branch; run continues to independent phases | Phase 12 | Resume (Phase 15) now has a concrete artifact (the snapshot) to replay from |
| Resume = re-run the entire phase from scratch | Resume = replay from the blocked step using `blocked_at` + `resume_instruction` | Phase 15 design | Preserves all discuss/plan work done before the parking point |
| Inbox prints handoff prose, human copy-pastes resume instruction | Resume wired into autonomous.md phase loop via answered-snapshot detection | Phase 15 (this phase) | Morning answers automatically continue the work on the next overnight run |
| Backlog pile requires manual triage | `/gsd2:triage` emits structured proposals into the same morning inbox | Phase 15 (this phase) | Backlog triage becomes another stream of morning-inbox decisions |

**Not deprecated/outdated:** The `printResumeHandoff` function in `mailbox.cjs` continues to print its block after `mailbox answer` — this is still correct for the interactive inbox session. Phase 15's autonomous resume supplements this with a workflow-level replay; it does not replace the handoff printing.

---

## Open Questions

1. **Where exactly to put the inline triage logic vs the CLI dispatch**
   - What we know: The triage-worker's verdict-assignment involves LLM reasoning (reading codebase files, applying the six-verdict decision table). This is workflow prose, not pure-function logic in triage.cjs.
   - What's unclear: Should `cmdTriageRun` in triage.cjs invoke the full verdict-assignment loop, or should the workflow prose drive evidence-gathering and verdict assignment, and triage.cjs only provide `parseRoadmapBacklog` + `buildTriageProposal` + `cmdMailboxAppend` wrapper?
   - Recommendation: Triage.cjs provides structural helpers (parse backlog, build proposal, dedup check) and the CLI dispatch; verdict assignment lives in triage.md workflow prose. This matches the Phase 11 pattern (escalation logic lives in discuss-phase workflow prose; ledger.cjs provides write primitives). The planner should specify which functions live in triage.cjs vs workflow prose.

2. **Deduplication guard: implement or defer?**
   - What we know: 15-AGENT-SPEC marks it as "Claude's discretion." A partial triage run produces duplicates; a re-run produces duplicate pending proposals.
   - What's unclear: How disruptive are duplicate proposals in practice given the small backlog (currently 2 todos + 1 backlog item)?
   - Recommendation: Implement a lightweight title-prefix check as described in Pitfall 5. The cost is one `readMailbox` call per item (already needed for `nextQId` anyway inside `cmdMailboxAppend`). Given the test corpus is small (3 items), the implementation is low-risk.

---

## Sources

### Primary (HIGH confidence)

- `get-shit-done/workflows/autonomous.md` — exact step 3a structure; `HARNESS_MODE` gate; `PHASE RESULT:` contract; `single-phase` mode behavior
- `get-shit-done/workflows/overnight.md` — step 6 finish structure; 16-token TYPE vocabulary (source of truth); `GSD_RUN_ID` export; phase loop
- `get-shit-done/workflows/inbox.md` — THIN constraint; `load_questions` filter logic; `present_and_discuss` step; triage-type entry future-proofing rule
- `get-shit-done/bin/lib/park.cjs` — `buildParkSnapshot` signature; `checkStaleness` return shape; `cmdParkStaleness` I/O; `snapshotPath` path convention
- `get-shit-done/bin/lib/mailbox.cjs` — `cmdMailboxAppend` default status behavior; `answerRecord` pure function; `printResumeHandoff` output; `writeMailbox` restriction
- `get-shit-done/bin/lib/ledger.cjs` — `cmdLedgerAppend` required fields; `readLedger` for idempotency check; `REQUIRED_FIELDS` list; `appendFileSync`-only contract
- `get-shit-done/bin/gsd-tools.cjs` — `case 'todo'` (line 636): `match-phase` dispatch; `case 'list-todos'` (line 438); `case 'mailbox'` (line 945): env-fallback dispatch; `case 'park'` (line 1004); `case 'ledger'` (line 902); `case 'run'` (line 1038)
- `get-shit-done/bin/lib/commands.cjs` — `listTodosInternal` return shape; `cmdTodoMatchPhase` keyword-scoring logic
- `.planning/ROADMAP.md` — live backlog format (`### B1: ... (BACKLOG)` + `**Goal:**` subfields)
- `.planning/todos/pending/*.md` — live todo file structure (frontmatter: created, title, area, files + body)
- `tests/ledger.test.cjs`, `tests/mailbox.test.cjs`, `tests/park.test.cjs` — established test patterns (tempProject fixture, `runGsdTools` helper, describe/test/beforeEach/afterEach)

### Secondary (MEDIUM confidence)

- `.planning/v1.6/phases/15-resume-logic-backlog-triage-worker/15-AGENT-SPEC.md` — all four communication contracts with exact JSON shapes; idempotency gap documented in Error Handling section row 5; checker sign-off table
- `.planning/v1.6/phases/15-resume-logic-backlog-triage-worker/15-CONTEXT.md` — locked decisions; Claude's discretion areas; deferred ideas

### Tertiary

- `.planning/STATE.md` — Phase 10–14 decision log confirms: `appendFileSync`-only for both ledger and mailbox; `status: "pending"` must be explicit in harness-generated entries (Phase 14-03 lesson); write-once ledger with no `writeLedger`/`cmdUpdate` exports

---

## Metadata

**Confidence breakdown:**
- Primitive signatures: HIGH — read from source; confirmed against dispatch and tests
- Integration splice points: HIGH — read from actual workflow files with line-level understanding
- Idempotency gap fix: HIGH — AGENT-SPEC explicitly flags it; ledger.cjs read confirms `readLedger` exists for the check
- Triage module structure: HIGH — follows established Phase 10/12 pattern documented in CONTEXT.md and CONVENTIONS.md
- Routing command surface: MEDIUM — some commands (`todo complete`) exist; others (obsolete removal, new-phase add) are manual-instruction patterns; planner discretion on exact verbs

**Research date:** 2026-06-17
**Valid until:** Phase 15 is the final v1.6 phase; stable until implementation begins
