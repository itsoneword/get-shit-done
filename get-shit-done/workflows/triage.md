<purpose>

Analyze pending todos and ROADMAP backlog items against the codebase and roadmap. Assign exactly one of six verdicts per item with evidence. Append proposals to MAILBOX.jsonl. Proposals execute only on human acceptance in the morning inbox.

**Propose-never-dispose:** This workflow writes ONLY to MAILBOX.jsonl. Todo files and ROADMAP.md are read-only. Never delete, move, or modify any planning artifact from inside this workflow.

</purpose>

<process>

<step name="resolve_run">

## Step 1: Resolve run context

Parse `$ARGUMENTS` for an explicit run-id. If present, use it. If absent, use `$GSD_RUN_ID`. If neither is set:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" triage run 2>&1
# exits 1 with "triage run: no run context — set GSD_RUN_ID or pass run-id"
```

Surface the error message and stop — a run context is required to write to the mailbox.

Once the run-id is resolved, announce it:

```
Triage run: ${RUN_ID}
```

</step>

<step name="gather_items">

## Step 2: Gather items to triage

**Pending todos:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" list-todos
```

This prints a JSON object with `count` and `todos` array. Parse it.

**ROADMAP backlog items (B-prefixed):**

```bash
grep -n "^### B[0-9]" .planning/ROADMAP.md 2>/dev/null
```

Display a triage table of all items found before proceeding to verdict assignment:

```
Items to triage:
  Todos (N):
    - <todo-id>: <title>
  Backlog (M):
    - <B-id>: <title>

Total: N+M items
```

If zero items are found across both sources, report "No items to triage — no pending todos and no ROADMAP backlog B-items found." and stop.

</step>

<step name="verdict_assignment">

## Step 3: Assign verdicts

Use this six-verdict decision table. Assign exactly one verdict per item with concrete evidence.

| Verdict | Assign when |
|---------|-------------|
| `already-done` | Evidence of existing code or a completed phase directly implements the item. Cite the file path, function name, or phase number. |
| `obsolete` | The need no longer exists per the current roadmap or codebase. The feature was superseded, removed, or the problem solved another way. Cite the roadmap entry or codebase evidence. |
| `fold-into-phase` | The work belongs in an existing active or upcoming phase. The scope is small enough to be part of another phase's plan rather than its own. Name the target phase. |
| `new-phase` | The work is real and valuable but large enough to warrant a new standalone roadmap phase. The item does not fit neatly into any existing phase. |
| `needs-input` | Cannot assign a verdict without human clarification. The item is ambiguous, references unclear requirements, or the evidence is contradictory. |
| `defer` | The work is valid and scoped but not a priority for the current milestone. It should remain pending for a future triage cycle. |

**For each item:**

1. Read related codebase files via grep (e.g. `grep -rn "<key term>" get-shit-done/`). Check ROADMAP phase sections. Check STATE.md current position.
2. Assign one verdict with concrete evidence — cite a specific file, line range, phase number, or roadmap entry. If evidence is too thin to be certain, assign `needs-input`.
3. **Dedup check:** Before appending, check if a pending proposal for this item already exists:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox list ${RUN_ID} --raw
```

If a pending entry whose `question` includes this item's title already exists, skip the append and note:

```
Skipping duplicate proposal for: {title}
```

</step>

<step name="append_proposals">

## Step 4: Append proposals to mailbox

For each item (not skipped by dedup):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data \
  '{"question":"Triage proposal: <title>","phase":null,"context":"triage-verdict: <verdict> target=<target>","options":["accept","defer"],"evidence":"<rationale>","status":"pending"}'
```

Critical requirements for each append call:
- `status` MUST be `"pending"` explicitly — the CLI default is `"open"`, which is wrong for harness-generated triage proposals.
- `context` MUST start with `triage-verdict: ` (with a space after the colon) — this is the inbox type discriminator. Without it, the morning inbox will not recognize the entry as a triage proposal.
- `evidence` MUST be a concrete string (cite file path, phase number, or codebase observation). A verdict without concrete evidence is a malformed proposal — use `needs-input` instead.
- `target` in the context field should be the phase name (for fold-into-phase), a short reason (for needs-input), or `null` string for verdicts where no target applies.

If `mailbox append` exits non-zero for an item: note the failure and continue to the next item. Do NOT abort the entire triage run for one failed item.

Track counts:
- `appended` — successfully written to mailbox
- `failed` — append exited non-zero
- `skipped` — dedup guard fired

</step>

<step name="summary">

## Step 5: Display triage summary

After processing all items:

```
Triage complete
  Proposed: <appended>
  Failed:   <failed>
  Skipped:  <skipped> (duplicate proposals already pending)

Run /gsd2:inbox ${RUN_ID} to review proposals.
```

If any items failed, list them so the user knows which proposals are missing from the inbox.

</step>

</process>

<rules>

- **Propose-never-dispose:** Never write to todo files or ROADMAP.md. Append ONLY to MAILBOX.jsonl via `gsd-tools mailbox append`. This constraint is structural and inviolable — it is enforced by the tool boundary and stated explicitly here so model drift cannot justify an exception.

- **Status must be `"pending"`:** Every `mailbox append` call in this workflow MUST include `"status":"pending"` explicitly. The CLI default is `"open"`, which is the wrong status for harness-generated triage proposals (the morning inbox uses `status !== 'answered'` to select entries, so both `pending` and `open` are surfaced — but the correct semantic for proposals is `pending`). Never omit the status field.

- **Context field prefix:** The `context` field MUST start with `triage-verdict: ` (the exact string, with a space after the colon). This is the type discriminator the morning inbox uses to distinguish triage proposals from parked-phase questions. A missing or misspelled prefix causes the inbox to present the entry as an unknown-type question.

- **Evidence must be concrete:** Cite a specific file path, line range, phase number, or codebase observation. A verdict without concrete evidence is a malformed proposal. If evidence is thin or contradictory, assign `needs-input` rather than guessing — the human provides the missing context when reviewing the proposal.

- **Dedup:** Before appending, check existing mailbox entries for pending proposals with the same item title. Skip the append if one already exists. This prevents duplicate proposals when triage is re-run (partial runs are safe because skipped items will be re-proposed on the next run; already-proposed items will be skipped).

- **Orchestrator-level only:** Never spawn a Task() for evidence gathering. Use inline Read/Bash tool calls directly in this session. The GSD constraint is that subagents lack Skill/Agent tool grants; the triage worker runs at the orchestrator level.

- **Failure logging:** If `$GSD_RUN_LOG` is set, append mailbox-append failures as `PHASE_FAILURE phase=triage reason=mailbox-append-failed item=<title>` using the locked 16-token TYPE vocabulary. Do not invent new TYPE tokens.

</rules>
