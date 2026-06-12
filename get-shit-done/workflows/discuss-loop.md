<purpose>
Multi-lens judgment loop for a concrete artifact. Three independent fresh-context lenses (Skeptic, User-Advocate, Architect) judge per round, up to a hard cap of 3 rounds. Convergence is a deterministic flag check, never sentence similarity. Non-convergence escalates the labeled divergent positions — never a synthesized average (LOOP-02). THIN constraint: this workflow judges and routes; it never resumes runs or schedules work (runner territory, Phases 13/15).
</purpose>

<process>

<step name="parse_arguments">
Parse `$ARGUMENTS`:

- First positional non-flag token → artifact file path.
- `--decision dec-NNN` → ledger-record artifact selector.
- `--question "<text>"` → the open question to judge.
- `--run-id <id>` → explicit run for `--decision` resolution.
- `--auto` → autonomous context marker.
- Neither a path nor `--decision` given → print usage and stop:

```
Usage: /gsd2:discuss-loop <artifact-path | --decision dec-NNN> [--question <text>] [--run-id <id>] [--auto]
```

Define the two mode flags used throughout this workflow:

- `run_context` = `GSD_RUN_ID` environment variable is set OR `--run-id` was passed.
- `autonomous` = `--auto` is present AND `GSD_RUN_ID` is set.

This mirrors the discuss-phase.md calibration: an interactive session with `GSD_RUN_ID` still presents positions in-session (because `--auto` is absent); only the explicit combination of `--auto` + `GSD_RUN_ID` writes the mailbox.
</step>

<step name="resolve_artifact">
Fail fast: zero spawns, zero transcript writes on any resolution failure.

**File path mode:**

```bash
test -f "<path>" || { echo "error: artifact not found: <path>"; exit 1; }
```

Read the full file content. Set `artifact = {kind:"file", ref:"<path>", content:"<full text>"}`.

**`--decision dec-NNN` mode:**

If `run_context` is set (GSD_RUN_ID or --run-id):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ledger list <run-id> --raw
```

Find the line whose `"id"` field equals the dec-NNN. If not found → error "dec-NNN not found in run <run-id>" and stop.

If NO run context:

```bash
grep -rl '"id":"dec-NNN"' .planning/run/*/DECISIONS.jsonl 2>/dev/null
```

- Zero matches → error "dec-NNN not found in any run" and stop.
- Multiple matches → error "dec-NNN exists in multiple runs — pass --run-id" and stop.
- Exactly one match → derive run-id from the matching path and use it.

Render the matching ledger record as pretty-printed JSON for the artifact content. Set `artifact = {kind:"decision", ref:"dec-NNN", content:"<pretty-printed JSON>"}`.

**Oversized guard:** If `artifact.content` exceeds ~50,000 characters, stop with:

```
error: artifact too large for lens context — pass a section or a smaller file
```

**Question resolution:**

- From `--question "<text>"` if provided.
- If absent and interactive → ask: "What open question should the lenses judge this artifact against?"
- If absent and autonomous → default to: "Should this artifact be accepted as-is, modified, or rejected — and what downstream constraints does it force or break?"
</step>

<step name="init_loop">
**Transcript exit-code rule (applies to EVERY `discuss-loop transcript` call in this workflow):** After every `discuss-loop transcript` invocation, check the exit code. Non-zero → print:

```
transcript write failed — aborting (unauditable loop violates the trust constraint)
```

and stop with a non-zero outcome. Never continue past a transcript failure.

**Steps:**

1. Generate the loop id:

```bash
loop_id=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop loop-id "<ref>")
```

2. Materialize the artifact content to `.planning/discuss-loop/<loop_id>/artifact.txt` via the Write tool. This file is what `validate --artifact` substring-checks anchors against and makes every spawn reconstructible from the loop directory alone.

3. Append the `loop_start` record (exit-code checked per the rule above):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop transcript "$loop_id" \
  --data '{"type":"loop_start","artifact":{"kind":"<kind>","ref":"<ref>"},"question":"<question>","run_id":<"<id>"|null>,"interactive":<true|false>}'
```
</step>

<step name="round_loop">
Execute for round N = 1, 2, 3:

**1. Build the round envelope** once (identical for all three lenses except the `lens` field):

```json
{
  "loop_id": "<loop_id>",
  "lens": "<skeptic | user-advocate | architect>",
  "round": N,
  "question": "<question>",
  "artifact": {
    "kind": "<kind>",
    "ref": "<ref>",
    "content": "<<<ARTIFACT\n<full artifact content>\nARTIFACT>>>"
  },
  "prior_positions": [<ALL validated blocks from ALL prior rounds; empty array [] in round 1>],
  "output_schema": "<copy the full position-block schema verbatim from the lens agent's output_contract, including the carried/new tagging rule>"
}
```

The artifact content MUST be wrapped in the `<<<ARTIFACT` / `ARTIFACT>>>` data markers — this is how the lens agents are trained to identify content vs. instructions.

**2. Spawn all three lenses IN PARALLEL** — three `Task()` calls in a single message:

```
Task(subagent_type="gsd-lens-skeptic", description="Skeptic round N", prompt=<envelope with lens="skeptic">)
Task(subagent_type="gsd-lens-user-advocate", description="User-Advocate round N", prompt=<envelope with lens="user-advocate">)
Task(subagent_type="gsd-lens-architect", description="Architect round N", prompt=<envelope with lens="architect">)
```

Wait for all three before any validation. Never diff partial results across incomplete spawns.

**3. Validate each lens response** in order:

From each response, extract the FINAL fenced ` ```json ` block (the orchestrator parses the last one, matching lens agent behavior).

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop validate \
  --round N \
  --data '<extracted block JSON>' \
  --prior '<JSON array of every constraint id from all prior rounds>' \
  --artifact ".planning/discuss-loop/<loop_id>/artifact.txt"
```

- **Exit 0 (`valid`):** Append the block to the transcript as a `position` record (exit-code checked):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop transcript "$loop_id" \
  --data '{"type":"position", <all fields from the validated block>}'
```

- **Exit 1:** Execute ONE corrective re-spawn of that lens for this round, same envelope plus:

  > "Your previous output failed validation: <error lines from stdout>. Emit only the corrected JSON block."

  Validate the retry output the same way.

  - Retry also exit 0 → append as `position` record (exit-code checked).
  - Retry also exit 1 → append a `lens_failure` record (exit-code checked):

  ```bash
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop transcript "$loop_id" \
    --data '{"type":"lens_failure","lens":"<lens>","round":N,"attempt":2,"errors":[<error lines as strings>],"raw_output":"<verbatim retry response>"}'
  ```

  **Degraded ladder:**
  - 2 valid lenses remain → continue this round as degraded (pass `--degraded` to the delta CLI).
  - 1 or fewer valid lenses → append `loop_end` aborted (exit-code checked):

  ```bash
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop transcript "$loop_id" \
    --data '{"type":"loop_end","outcome":"aborted","rounds_run":N,"verdict":null,"mailbox_id":null,"ledger_id":null}'
  ```

  Then report the infrastructure failure explicitly — it MUST NOT masquerade as divergence — and stop non-zero.

**4. Compute the round delta:**

```bash
delta=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop delta \
  --round N \
  --data '<JSON array of this round's validated blocks>' \
  [--degraded if a lens failed this round])
```

Append the delta JSON verbatim as the `round_delta` transcript record (exit-code checked):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop transcript "$loop_id" \
  --data "$delta"
```

(The delta record already contains `"type":"round_delta"` from the CLI output.)

**5. Branch on `converged` in the delta:**

- `true` → go to **converged_path**.
- `false` and N < 3 → start next round. Grow `prior_positions` by appending this round's validated blocks to the cumulative list.
- `false` and N == 3 → go to **escalation_path**.

**6. Interactive round summary:** After each delta in interactive sessions, print a one-line summary:

```
Round N: blocking=[<lens, ...>], new constraints=<count> — not converged
```

(Skip in autonomous sessions.)
</step>

<step name="converged_path">
**1. Build the consensus verdict** from the final round's validated blocks:

- All `accept` → verdict position: `"accept"`.
- Any `modify` → verdict position: `"modify"`, with the union of all `modification` texts as the concrete change list.
- The final constraint set is the carried constraints from the last round (these are the agreed downstream constraints).

**2. Escalation-contract check for `modify` + committed file:**

If the verdict is `modify` AND the artifact is an existing committed file (`kind="file"` AND the file is tracked in git: `git ls-files --error-unmatch "<ref>" 2>/dev/null`):

a. Read `$HOME/.claude/get-shit-done/references/escalation-contract.md` once.

b. Apply the four criteria as membership checks against the condition lists (inline reasoning, never a Task() spawn): irreversibility, security boundary, scope change, spec ambiguity.

c. Compute `escalation_verdict` and `escalation_reason` BEFORE any write (the ledger is write-once; there is no patch):

   - Any condition fires → `"park-and-ask"`, `escalated: true`.
   - No condition fires, confidence HIGH (all-accept converged verdict) → `"proceed"`, `escalated: false`.
   - No condition fires, confidence MEDIUM → `"proceed-and-log"`, `escalated: false`.
   - Borderline → `"proceed-and-log"` — EXCEPT borderline on Irreversibility or Security boundary → `"park-and-ask"` (per the contract's tie-break rules).

d. Execute the verdict:

   **`proceed` or `proceed-and-log`** (reversible, no criterion fires): Apply the modification to the artifact via the Edit tool. Note "applied" in the `loop_end` verdict field.

   **`park-and-ask`**: Do NOT apply. Branch on mode:

   - **Autonomous (`--auto` AND `GSD_RUN_ID`)**: Append a mailbox confirm entry (exit-code checked; capture `q-NNN`):

   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data '{
     "question": "Confirm modification to <ref>: <modification summary>",
     "options": ["apply as proposed", "reject modification"],
     "evidence": "<final constraint set summary>",
     "context": "discuss-loop <loop_id>: converged modify verdict, <criterion + condition> fired",
     "status": "pending"
   }'
   ```

   Capture the `q-NNN` it prints.

   - **Interactive**: Ask the human directly via AskUserQuestion. Apply only on explicit yes.

e. Judgment-only outcomes (`accept`/`reject`) and net-new content (artifact `kind="file"` not tracked, or `kind="decision"`): logged, never gated (locked CONTEXT decision).

**3. Ledger record (if `run_context` is set):**

```bash
ledger_result=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ledger append --data '{
  "decision": "<accept | modify: <concrete change summary>>",
  "alternatives": ["<non-prevailing lens positions, labeled by lens>"],
  "evidence": "<final constraint set + loop_id>",
  "confidence": "HIGH",
  "escalated": <true|false>,
  "escalation_verdict": "<proceed-and-log | park-and-ask | proceed>",
  "escalation_reason": "<criterion + condition that fired, or: all criteria negative>",
  "phase": null,
  "context": "discuss-loop: <loop_id>",
  "question": "<question>"
}')
```

Exit-code check: non-zero → append `loop_end` with `outcome: "aborted"` (exit-code checked) and stop non-zero. Capture the `dec-NNN` on success.

Interactive sessions WITHOUT `run_context`: present the verdict in-session; skip the ledger (the write-once ledger is run-gated — Phase 10).

**4. Append `loop_end`** (exit-code checked):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop transcript "$loop_id" \
  --data '{"type":"loop_end","outcome":"converged","rounds_run":N,"verdict":"<accept or modify: summary>","mailbox_id":<"q-NNN"|null>,"ledger_id":<"dec-NNN"|null>}'
```

**5. Print the CONVERGED report:**

```
CONVERGED
Verdict:     <accept | modify: <summary>>
Rounds run:  N
Transcript:  .planning/discuss-loop/<loop_id>/transcript.jsonl
Ledger:      <dec-NNN | not recorded (no run context)>
Mailbox:     <q-NNN (park-and-ask) | n/a>
```
</step>

<step name="escalation_path">
Autonomous/interactive bifurcation is the FIRST branch — determine mode before building any output.

**1. Compute survivors:**

```bash
survivors=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop survivors \
  --data '<JSON array of ALL rounds' validated blocks (all rounds, not just the last)>')
```

The output is `[{lens, weight, block}]` ordered by divergence weight descending.

**2a. Autonomous (`--auto` AND `GSD_RUN_ID`):**

Build the mailbox entry from survivors. Each option string is built from ONE lens's block only — its `summary` plus its blocking constraint statements. Never combine text from two lenses into one option (LOOP-02 no-synthesis rule).

```bash
mailbox_result=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data '{
  "question": "<question>",
  "options": [
    "Skeptic: <block.summary> [blocking: <blocking constraint statements for this lens>]",
    "Architect: <block.summary> [blocking: <blocking constraint statements for this lens>]",
    ...
  ],
  "evidence": "<constraint-delta summary: which constraints stayed new/blocking across rounds, per lens — derived from the round_delta records>",
  "context": "<ref> | rounds: 3 | loop: <loop_id><; degraded: <lens> if any lens failed>",
  "status": "pending"
}')
```

`status` MUST be `"pending"` explicitly. The CLI default is `"open"` (Pitfall: wrong status means the entry is not treated as a parked harness question).

Exit-code check: non-zero → append `loop_end` with `outcome: "aborted"` (exit-code checked) and stop non-zero. Never silently drop an escalation (trust constraint: proposes, never disposes).

Capture the `q-NNN` printed by the CLI.

**2b. Interactive (no `--auto`, OR `GSD_RUN_ID` not set):**

Present the surviving positions in-session, labeled per lens with summary, blocking constraints, and divergence weight. Do NOT write to the mailbox. MAILBOX.jsonl and DECISIONS.jsonl remain untouched by interactive runs.

**3. Append `loop_end`** (exit-code checked):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" discuss-loop transcript "$loop_id" \
  --data '{"type":"loop_end","outcome":"escalated","rounds_run":3,"verdict":null,"mailbox_id":<"q-NNN"|null>,"ledger_id":null}'
```

**4. Print the ESCALATED report:**

```
ESCALATED — no convergence after 3 rounds
Positions:   <labeled per lens: summary + blocking constraints + weight>
Mailbox:     <q-NNN (autonomous) | presented in-session (interactive)>
Transcript:  .planning/discuss-loop/<loop_id>/transcript.jsonl
Next step:   <autonomous: "answer via /gsd2:inbox" | interactive: "choose a position to act on">
```
</step>

</process>

<guardrails>
These rules are absolute — no exception, no workaround:

1. **Hard cap:** Maximum 3 rounds. Never loop past round 3 regardless of convergence state.
2. **No synthesis:** The escalation path NEVER produces a blended option. Each mailbox option maps 1:1 to exactly one lens block. Text from two different lens blocks must never be merged into a single option string.
3. **CLIs only:** Never write directly to MAILBOX.jsonl or DECISIONS.jsonl. All writes go through `gsd-tools mailbox append` and `gsd-tools ledger append` — their exit codes enforce run-context gates that in-file writes would bypass.
4. **Every gated write is exit-code checked.** `mailbox append` exit 1 → aborted outcome. `ledger append` exit 1 → aborted outcome. Neither failure is silent.
5. **Every transcript write is exit-code checked.** A `discuss-loop transcript` exit 1 → abort immediately with "transcript write failed — aborting (unauditable loop violates the trust constraint)". An unauditable loop must not continue.
6. **Interactive sessions never write the mailbox.** If `--auto` is absent OR `GSD_RUN_ID` is not set, the escalation_path presents positions in-session. MAILBOX.jsonl and DECISIONS.jsonl remain byte-identical after any interactive run.
</guardrails>
