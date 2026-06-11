# Phase 12: Park-Don't-Block Mailbox - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A park-and-ask verdict parks the blocked branch (MAILBOX.jsonl question + `parked/phase-{N}.json` snapshot) without stopping the run; the human resolves all parked questions in one inbox session (`gsd-tools mailbox review` CLI + thin `/gsd2:inbox` skill); resume re-reads current planning state with a visible staleness diff before replay; and stuck runs are flagged via identical ledger hashes across consecutive phase snapshots. The overnight runner that *consumes* parking (Phase 13) and the autonomous.md replay wiring (Phase 15) are NOT in this phase — Phase 12 ships the primitives and the human-facing inbox.

**Detected domain:** Generic
**Evidence:** Deliverable is CLI extensions (mailbox review/answer, staleness + stuck primitives) plus workflow prose edits and one thin skill — consistent with Phases 10/11; agentic orchestration consuming these is Phase 13
**Confirmed by user:** not contested (offered, no objection)

</domain>

<established>
## Established Patterns (from codebase + Phases 10/11)

- `GSD_RUN_ID` env var is THE run signal — never a config key [STRONG, locked Phase 10; supersedes ARCHITECTURE.md's `config-set harness.run_id` mentions]
- Ledger is write-once append-only; revisions are superseding records referencing the original id — no patch [STRONG, locked Phase 10]
- `mailbox.cjs` ships append/list primitives with the full schema already carrying `status`, `answer`, `answered_ts` — review/answer build on it, schema needs no migration
- Phase 11: in interactive calibration mode, a park-and-ask verdict still asks the human directly — parking activates in this phase for autonomous contexts only [STRONG, locked Phase 11]
- Borderline tie-break: proceed-and-log except irreversibility/security borderlines park [STRONG, locked Phase 11]
- Interactive sessions without `GSD_RUN_ID`: zero behavior change (run-context gate errors loudly on out-of-run writes) [locked Phase 10]
- Orchestrator-level only — parking/resume logic lives in workflow prose + CLI, never a Task() spawn (subagents lack Skill/Agent grants)
- Source→runtime: edits in `get-shit-done/` and `commands/gsd2/`, synced via `npm run dev`

</established>

<decisions>
## Implementation Decisions

### Branch-parking state machine (PARK-01)
- A park writes BOTH artifacts: MAILBOX.jsonl question entry (status `pending`) AND `parked/phase-{N}.json` context snapshot — mailbox entry is human-facing, snapshot is machine-facing resume context [STRONG, specialist-backed — ARCHITECTURE.md Component 3; matches PARK-01 "question + context snapshot" verbatim; offered with override, user accepted]
- Parked state is derivable, not separately tracked: pending mailbox entry + snapshot file present = parked. No third state file [STRONG, specialist-backed]
- Parking fires only under `GSD_RUN_ID` + autonomous mode (e.g. `--auto` / autonomous.md context); interactive sessions — including calibration runs with a run id — keep asking the human directly per the Phase 11 decision [STRONG — consistency with locked Phase 11 behavior]
- When a phase parks, the phase halts with a clear PARKED outcome; "run continues other work" is runner behavior (Phase 13) — Phase 12 only guarantees parking is non-blocking from the phase's perspective

### Context snapshot contents (PARK-03 staleness substrate)
- Snapshot fields: phase, blocked-at step, question id, phase_dir, resume instruction, content hashes of `STATE.md` / `ROADMAP.md` / `cross-phase-notes.md` / the phase's CONTEXT.md, git HEAD at park time, timestamp [STRONG, specialist-backed — cheap, deterministic; extends ARCHITECTURE.md's sketch with the hash set PARK-03 needs]
- Staleness check at resume: re-hash the same files, list which changed since park, show the git range (`<park-HEAD>..HEAD`) — diff is VISIBLE before replay, it does not auto-block [STRONG — "visible before replay" is the roadmap success criterion 3 wording; resume happens during/after morning review so the human is present]

### Inbox review (PARK-02)
- `gsd-tools mailbox review <run-id>` ships as the CLI primitive: presents each pending question with context/options/evidence, accepts an answer, records it (status `answered`, `answered_ts`) [STRONG — verbatim roadmap success criterion 2]
- PLUS a thin `/gsd2:inbox` skill layered on top: Claude presents each parked question with its context, evidence, and staleness state, discusses it with the user, records the answer via `mailbox answer` [STRONG, specialist-backed — user chose this over CLI-only and over deferring to Phase 13; it embodies the thrice-restated "one meaningful ~1-hour morning discussion" vision]
- The skill is THIN: it reads the mailbox and records answers — it does not resume branches, replan, or execute (resume handoff is printed, not performed)
- Mailbox answers are recorded in MAILBOX.jsonl only; the ledger gets its superseding record when the branch acts on the answer at resume (Phase 15 wiring) — preserves write-once ledger

### Resume handoff at the prompt level (PARK-03, boundary with Phase 15)
- Phase 12 ships primitives: snapshot format, staleness-diff command surface, and the inbox (CLI + skill) printing a concrete per-phase resume handoff once its question is answered [STRONG, specialist-backed — Phase 15 explicitly owns wiring replay into autonomous.md; building it here would duplicate]
- Resume instruction in the snapshot is concrete enough for a human or Phase 15 to act on (which workflow to re-enter, at which step, with the answer injected)

### Stuck detection (PARK-04)
- Mechanism: hash of DECISIONS.jsonl recorded at phase-boundary snapshots; two consecutive identical hashes → flagged as stuck [STRONG — threshold 2 is verbatim in roadmap success criterion 4, not a dial]
- Phase 12 ships the primitive (snapshot-hash recording + comparison) and surfaces the flag in `gsd-tools ledger list` output and `run.log`; Phase 13's runner calls it at phase boundaries [STRONG, specialist-backed]

### Folded Todos
None — both matched todos reviewed and not folded (see Deferred).

### Claude's Discretion
- Exact command names/flags for staleness + stuck primitives (e.g. `run staleness`, `run check-stuck` vs flags on existing commands); where boundary-snapshot hashes are stored (RUN-META.json field vs snapshots file)
- Inbox answer semantics beyond record-answer (skip/defer handling — keep pending vs explicit status), table/output formatting
- `/gsd2:inbox` skill prose, question-presentation format, whether staleness shows per-question or per-session
- parked/phase-{N}.json exact field names; hash algorithm (sha256 via node crypto is the obvious default)
- Test structure (follows Phase 10 unit-test conventions)

</decisions>

<expected_outcome>
## Expected Outcome

User's north star (restated again this session, fourth consistent occurrence, [STRONG]): GSD becomes self-sufficient phase-by-phase — runs all night through phases in parallel, researches everything researchable, raises and SAVES questions where needed instead of blocking, then the human has one meaningful ~1-hour morning discussion answering all of them, and the run resumes to execute what was decided. Phase 12 is the middle of that loop: the save-questions path and the morning-answer path.

- **End state:** an autonomous-context park-and-ask verdict lands a question in MAILBOX.jsonl + a resume snapshot in parked/, the phase halts cleanly; the human opens one inbox session (`/gsd2:inbox` or `gsd-tools mailbox review`), sees every parked question with context, answers them all in one sitting; each answered phase has a printed resume handoff with a visible staleness diff; a run whose ledger stopped growing is flagged stuck
- **Success signal:** all parked questions resolvable in a single session without switching tabs; staleness diff correctly shows planning files changed since park; identical consecutive ledger hashes produce a visible stuck flag in `ledger list` and `run.log`; interactive sessions without `GSD_RUN_ID` byte-identical to today
- **Flow:** evaluator emits park-and-ask (autonomous context) → mailbox question + snapshot written, phase halts, run moves on → morning: human runs inbox, discusses and answers everything → inbox prints resume handoffs with staleness diffs → (Phase 15) branches replay against current state

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Parking + mailbox design
- `.planning/research/ARCHITECTURE.md` §Component 3 — `.planning/run/` layout, MAILBOX.jsonl schema, parked/phase-{N}.json sketch, mailbox command surface, resume flow (note: any `config-set harness.run_id` mention is SUPERSEDED by GSD_RUN_ID)
- `.planning/research/PITFALLS.md` — Pitfall 6 (unverifiable decisions)

### Requirements + success criteria
- `.planning/ROADMAP.md` §Phase 12 — four success criteria + Discussion focus line
- `.planning/REQUIREMENTS.md` — PARK-01, PARK-02, PARK-03, PARK-04

### Locked upstream decisions
- `.planning/v1.6/phases/10-decision-ledger-cli-foundation/10-CONTEXT.md` — run-id signaling, write-once ledger, mailbox schema, command-surface split (review/answer deferred to here)
- `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CONTEXT.md` — park-and-ask tier semantics, interactive-calibration-asks-directly decision, evaluator placement in question_triage
- `.planning/cross-phase-notes.md` §"From Phase 10/11 discussions" — run-signal lock, morning-inbox flow notes

### Integration surfaces
- `get-shit-done/bin/lib/mailbox.cjs` — append/list/filter/nextQId primitives the review/answer commands extend
- `get-shit-done/bin/lib/ledger.cjs` — `cmdRunInit` (directory layout owner), `ledger list` (stuck-flag surface)
- `get-shit-done/workflows/discuss-phase.md` §question_triage — where the park branch splices after the Phase 11 evaluator
- `commands/gsd2/` — command-file convention for the new `/gsd2:inbox` skill (workflow prose in `get-shit-done/workflows/`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mailbox.cjs`: `readMailbox` (malformed-line-skipping JSONL reader), `filterMailbox`, `nextQId`, `formatTable`, `cmdMailboxAppend`, `cmdMailboxList` — review/answer are additive handlers; schema already carries `status`/`answer`/`answered_ts`
- `ledger.cjs`: `cmdRunInit` already creates/enforces `.planning/run/{run-id}/`; extend for `parked/` subdir; `ledger list` is the stuck-flag display surface
- `lesson.cjs`/`trace.cjs` table formatters + `--raw` JSON convention for new read commands
- Phase 10 unit-test suite conventions (983+ passing) for the new pure functions (hashing, staleness compare, stuck detection)

### Established Patterns
- One `bin/lib/{name}.cjs` module per subcommand family; pure functions exported for tests, `cmd*` handlers for process I/O; `gsd-tools.cjs` thin dispatch
- Command = `commands/gsd2/{name}.md` + workflow prose in `get-shit-done/workflows/{name}.md`, synced via `npm run dev`
- Node `crypto` for hashing — zero new npm dependencies (locked)

### Integration Points
- `gsd-tools.cjs` dispatch — `mailbox review`, `mailbox answer`, staleness/stuck subcommands
- `discuss-phase.md` question_triage — park branch (autonomous context only) after the Phase 11 evaluator verdict
- New `/gsd2:inbox` command + workflow file
- Future consumers (do NOT wire now): Phase 13 runner (calls stuck-check at phase boundaries, polls mailbox before resuming, morning report links to inbox), Phase 15 autonomous.md (consumes parked/ snapshots + staleness diff for replay)

</code_context>

<specifics>
## Specific Ideas

- "Have them in the morning this meaningful discussion in an hour, let's say, answering all the questions and then run it again to execute what was decided" — the inbox session is a *discussion*, not a form; hence the thin skill over the raw CLI
- The skill must keep the single-sitting property: everything needed to answer (context, evidence, options, staleness) is presented inline — no tab-switching to source files

</specifics>

<deferred>
## Deferred Ideas

- Actual branch replay / resume execution in autonomous.md — Phase 15 (Phase 12 prints handoff only)
- Runner-side "continue other work while parked," mailbox polling, morning report — Phase 13
- Integrating the morning report into `/gsd2:inbox` as a single morning entry point — natural Phase 13 follow-up once the report exists
- Triage-type mailbox entries (six-verdict proposals) flowing through the same inbox — Phase 15 (TRIAGE-01/02); inbox skill should not hardcode decision-type-only assumptions, but triage handling is out of scope here

### Reviewed Todos (not folded)
- "Add user sync checkpoints to plan-phase subagent chains" (match 0.6) — plan-phase workflow concern, unrelated to parking/mailbox; reviewed-out in Phases 10 and 11 as well
- "Update command should sync project-local hooks" (match 0.4) — tooling/install concern, unrelated

</deferred>

---

*Phase: 12-park-don-t-block-mailbox*
*Context gathered: 2026-06-11*
