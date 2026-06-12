<purpose>
Morning inbox session for the GSD autonomous supervision harness. Presents every unanswered parked question with full context, evidence, and staleness state inline — one session, no tab-switching. Records answers via the mailbox CLI. Prints per-phase resume handoffs.

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
- Do not hardcode decision-type-only assumptions about mailbox entries — Phase 15 adds triage-type entries flowing through this same inbox; the workflow must handle any question shape.
- The single-sitting rule: everything the user needs to answer must be presented inline. If a field is missing from the mailbox record, note the gap and proceed — do not ask the user to look up source files.
</rules>
