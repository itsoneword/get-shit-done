<purpose>
Morning inbox session for the GSD autonomous supervision harness. Opens with the run's morning report (via `gsd-tools run report`) so the session starts with what happened overnight. Presents every unanswered parked question with full context, evidence, and staleness state inline — one session, no tab-switching. Records answers via the mailbox CLI. Prints per-phase resume handoffs.

**THIN constraint:** This skill reads the mailbox and records answers. It does NOT resume branches, replan, or execute — the resume handoff is printed, not performed (branch replay is Phase 15; runner orchestration is Phase 13).
</purpose>

<process>

<step name="resolve_run">
**Determine which run to work with.**

Priority order:

1. `$ARGUMENTS` (passed by the command stub) — if non-empty, use it as the run-id.
2. `GSD_RUN_ID` environment variable — if set, use it.
3. Directory scan — list available runs:

```bash
ls .planning/run/ 2>/dev/null
```

- If no `.planning/run/` directory or it is empty: report "no harness runs found — start a run with `gsd-tools run init`" and stop.
- If exactly one directory: use it; announce "Using run: {run-id}".
- If multiple: for each, show pending question count (`gsd-tools mailbox list <run-id>` filtered to unanswered) and ask which to use:

  ```
  Multiple runs found:
  - run-abc123 — 3 pending questions
  - run-def456 — 0 pending questions (all answered)

  Which run-id would you like to work with?
  ```

  Use AskUserQuestion with each run-id as an option, or accept free-form input.
</step>

<step name="run_report_header">
**Print the morning report as the session header.**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run report <run-id>
```

- Exit 0: surface the report output VERBATIM before walking any questions — this is the run's summary (decisions made, phases completed, questions parked) computed from the ledger artifacts alone.
- Non-zero exit (run not initialized / no RUN-META.json — e.g. a mailbox-only fixture): skip the header silently and continue to load_questions. The header is additive; its absence must never block the inbox.
</step>

<step name="load_questions">
**Load unanswered questions from the mailbox.**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox list <run-id> --raw
```

Parse the JSONL output line by line. Each line is a JSON object.

Unanswered questions are those where `status !== 'answered'` — both `status: "pending"` (parked by the harness) and `status: "open"` (manually appended) count as unanswered.

**If zero unanswered questions:**

Count the already-answered ones and report:

```
Inbox zero — no parked questions for run <run-id>.
<N> question(s) already answered.
```

Stop here.

**If one or more unanswered questions:** proceed to present_and_discuss with the full list.
</step>

<step name="present_and_discuss">
**For EACH unanswered question, one at a time:**

This is a DISCUSSION, not a form. Present everything the user needs inline — they must never need to open another file.

**Entry type detection:**

Before presenting an entry, check whether its `context` field starts with `triage-verdict:`.

**If context starts with triage-verdict: — Triage Proposal presentation:**

Parse the context field to extract: the `verdict` token (the word after `triage-verdict: ` up to the first space or ` target=`) and the `target` value (after `target=`, if present). If the verdict token is not one of the six valid tokens (`already-done`, `obsolete`, `fold-into-phase`, `new-phase`, `needs-input`, `defer`), set `verdict = 'needs-input'` and note an unknown verdict token warning.

Present the proposal using this template:

```
---
Triage Proposal {q-NNN}
Verdict: <verdict>  Target: <target>
<warning if applicable: "(unknown verdict token in triage entry — treating as needs-input)">

Item: <entry.question with "Triage proposal: " prefix stripped for display>
Evidence: <entry.evidence>

Options:
  A. accept - record accepted verdict and print routing command
  B. defer  - leave for a future triage session (mark answered with "deferred")
```

**On accept:** call `gsd-tools mailbox answer <run-id> --id <q-NNN> --answer "accepted: <verdict>"`. Then print the routing command for the accepted verdict using the six-verdict routing table below. Print it verbatim; do NOT execute it.

Routing commands (print only, never execute):

| Verdict | Routing command printed |
|---------|------------------------|
| `already-done` | `gsd-tools todo complete <todo-filename>` — or for backlog items: `# manual: work is complete per evidence above` |
| `obsolete` | `# manual: delete .planning/todos/pending/<filename>` |
| `fold-into-phase` | `# manual: add this item to the target phase notes or ROADMAP.md phase section` |
| `new-phase` | `# manual: add to ROADMAP.md ## Backlog as a new ### B-item with goal and evidence` |
| `needs-input` | `# No command - provide the missing input and re-run /gsd2:triage` |
| `defer` | `# No command - item remains in pending for a future triage session` |

Surface the `mailbox answer` CLI output verbatim after printing the routing command.

**On defer:** call `gsd-tools mailbox answer <run-id> --id <q-NNN> --answer "deferred"`.

**Never modify todo files, ROADMAP.md, or any planning artifact inside this step. Print the routing command; the human runs it as a separate explicit step. This is the propose-never-dispose invariant.**

After handling the triage proposal, continue to the next inbox entry. Skip the normal phase-question presentation block for this entry.

**If context does NOT start with triage-verdict: — normal phase-question presentation:**

**Present the question block:**

```
---
Question {q-NNN}  (Phase {phase})
Decision ID: {decision_id}

{question text}

Why this parked: {context field — criterion + condition that fired}

Options:
  A. {options[0]}
  B. {options[1]}
  (additional options if present)

Evidence: {evidence field}
```

**Staleness check:** If a snapshot file exists for this question's phase (`.planning/run/<run-id>/parked/phase-{N}.json`), run:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" park staleness <run-id> --phase <N>
```

Show the staleness output inline:

```
Staleness since park:
{staleness command output — lists changed/unchanged/missing planning files, git range, resume instruction}
```

If planning files changed since the snapshot: add a framing note — "Planning state has moved since this parked — factor that into the answer."

**Discuss:** Give a recommendation with reasoning grounded in the options and evidence. Take the user's pushback and iterate. The goal is a settled, self-contained answer the resuming branch can act on without reading a transcript.

- For discrete options: use AskUserQuestion.
- For open-ended questions: free-form conversation until the user lands on a clear answer.
- The user may also say "skip" (come back later in this session) or "defer" (leave pending for another session). Both leave the question unanswered — note it in the session summary.

**On a settled answer:** record it:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox answer <run-id> --id <q-NNN> --answer "<the settled answer, self-contained>"
```

The CLI prints the resume handoff (resume instruction + staleness state). Surface that output to the user verbatim.

**Never mark a question answered without an explicit user-settled answer.** A "maybe" or "I'll think about it" is not an answer.
</step>

<step name="session_summary">
**After all questions have been presented (answered, skipped, or deferred), return:**

```markdown
## INBOX SESSION COMPLETE

**Run:** {run-id}
**Answered:** {n}  **Skipped:** {m}

| Q | Phase | Answer | Resume |
|---|-------|--------|--------|
| q-001 | 5 | {short answer} | parked/phase-5.json — {resume_instruction} |

### Resume handoffs

{per answered phase: the resume instruction + staleness one-liner}

These branches are NOT resumed by this skill. Phase 15 wires replay; until then, resume manually per the instructions above.
```

If nothing was answered (all skipped/deferred): note that — "No questions answered this session — all remain pending."
</step>

</process>

<rules>
- Never write to `DECISIONS.jsonl`. The ledger gets its superseding record when the branch acts on the answer at resume (Phase 15 wiring). Writing the ledger here would violate the write-once guarantee.
- Never edit planning files (CONTEXT.md, ROADMAP.md, STATE.md, etc.) — read them only.
- Never mark a question answered without an explicit user-settled answer.
- Never resume, replan, or execute a parked branch — print the handoff, stop there.
- Triage-type entries (context starting with `triage-verdict:`) are presented as proposals with a distinct Verdict/Item/Evidence template; the accept path prints a routing command and does NOT execute it (propose-never-dispose invariant).
- Never modify todo files, ROADMAP.md, or any planning artifact from inside the inbox — all mutations require a separate explicit human step after reviewing the printed routing command.
- An unknown verdict token in a triage entry is treated as `needs-input` with a warning (corrupt entry must not block the inbox session).
- The single-sitting rule: everything the user needs to answer must be presented inline. If a field is missing from the mailbox record, note the gap and proceed — do not ask the user to look up source files.
</rules>
