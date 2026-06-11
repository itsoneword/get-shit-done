# Phase 10: Decision Ledger + CLI Foundation - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the shared persistence layer every other v1.6 harness component calls: `lib/ledger.cjs` + `lib/mailbox.cjs` (unit-tested, lesson.cjs pattern), `gsd-tools` subcommands for append/read/filter, and the `.planning/run/{run-id}/` directory layout enforced at run-init time. Schema enforced at write time. Interactive sessions see zero behavior change. The escalation evaluator (Phase 11), mailbox interactivity (Phase 12), and the runner (Phase 13) are NOT in this phase.

**Detected domain:** Generic
**Evidence:** Deliverable is CLI persistence modules + subcommands — no UI, no agent orchestration built in this phase (evaluator wiring is Phase 11)
**Confirmed by user:** not prompted (Generic, low-signal per workflow rules)

</domain>

<established>
## Established Patterns (from codebase)

- JSONL ledger module pattern: `get-shit-done/bin/lib/lesson.cjs` / `trace.cjs` — `readX`/`filterX`/`cmdX` handlers, `appendFileSync` one-line-per-record, malformed-line skip on read, plain-text table formatter + `--raw` JSON mode
- CLI dispatch: `get-shit-done/bin/gsd-tools.cjs` delegates to `bin/lib/*.cjs` modules with exported pure functions for unit testing
- Config machinery: `config-get`/`config-set` exists (NOT used for run signaling — see decisions)
- Zero new npm dependencies (locked, REQUIREMENTS.md Out of Scope)
- Orchestrator-level only — subagents lack Skill/Agent grants (locked, PROJECT.md constraint)
- Gitignored operational data precedent: `.planning/telemetry/agent-trace.jsonl`

</established>

<decisions>
## Implementation Decisions

### Run-id signaling (LEDGER-03)
- Active harness run is signaled by the `GSD_RUN_ID` environment variable, NOT a config key [STRONG, specialist-backed — config key is a tree-global mutable flag; a parallel interactive session in the shared working tree would see it and ledger-write, violating zero-behavior-change; env var is process-scoped] <!-- supersedes ARCHITECTURE.md's config-set harness.run_id assumption -->
- Trust-ladder interactive calibration (Phase 11) runs via `GSD_RUN_ID=<id> claude`
- `RUN-META.json` is the run's *record* (start time, phase list, status), never the detection signal

### Ledger mutability (LEDGER-01)
- Records are write-once: the Phase 11 evaluator runs inline in the same orchestrator step, so the record is appended once with verdict fields included [STRONG, specialist-backed — crash mid-rewrite corrupts a rewritten file; an audit ledger must keep "append-only" literally true]
- No `ledger patch` command. If a verdict ever needs revision, append a superseding record referencing the original id
- Full-file rewrite (lesson.cjs update pattern) is NOT acceptable for DECISIONS.jsonl

### Out-of-run behavior (LEDGER-03)
- `gsd-tools ledger append` with no `GSD_RUN_ID` (and no explicit run-id arg resolving to an initialized run): loud error, exit 1 [STRONG, specialist-backed — "never silently writes to an undefined run"; silent no-op makes wiring bugs indistinguishable from success]
- Workflows guard with the env check before calling, so interactive sessions never hit the error

### Git posture
- `.planning/run/` is gitignored, same as `.planning/telemetry/` [WEAK, specialist-backed — user accepted casually; flip to committed if durability/PR-review of runs becomes wanted]

### Schema (LEDGER-01)
- Required at write time, rejected with clear error if missing: `decision`, `alternatives`, `evidence`, `confidence`, `escalated` [STRONG — verbatim from roadmap success criterion 1]
- Auto-filled by the CLI: `id`, `ts`; caller-supplied context fields: `phase`, `context`, `question`
- `escalation_verdict` / `escalation_reason` optional in Phase 10 (Phase 11 populates them); `escalated` may be `null` only if no evaluator ran — but the field itself must be present
- Mailbox schema follows ARCHITECTURE.md sketch: `id, ts, run_id, phase, decision_id, question, context, options, evidence, status, answer, answered_ts`

### Command surface (LEDGER-02)
- Ships in Phase 10: `ledger append <run-id|env>`, `ledger list <run-id>`, `ledger filter <run-id> --phase N --escalated`; `mailbox append`, `mailbox list` (write/read primitives only); `run init <run-id>` creating + enforcing the directory layout
- Deferred: `mailbox review` / `mailbox answer` interactivity → Phase 12 (PARK-02)

### Claude's Discretion
- Record id format (e.g. `dec-NNN`), run-id slug format (research suggests `{date}-{slug}`), table columns, exact filter flag names, error message wording, test file structure
- Whether `ledger list`/`filter` are one command or two — collapse if simpler

</decisions>

<expected_outcome>
## Expected Outcome

User's north star (stated 2026-06-11, [STRONG]): the harness eventually runs over a whole milestone for hours, sorting research and knowledge-creation autonomously, surfacing only the genuinely important questions — "longer runs, more autonomous, higher quality of delivered product."

- **End state for this phase:** the persistence layer exists and is trustworthy — `gsd-tools run init` + `ledger append/list/filter` + mailbox primitives work against `.planning/run/{run-id}/`, unit-tested, with schema rejection proven
- **Success signal:** a malformed append is rejected with a clear error; a valid append lands as one JSONL line; `ledger filter --phase N --escalated` returns the right subset; running any ledger command in a plain interactive session (no `GSD_RUN_ID`) errors loudly and changes nothing
- **Flow:** runner (future) sets `GSD_RUN_ID` → workflows append decisions → human reads one filtered ledger instead of replaying transcripts. Phase 10 must make a hundreds-of-decisions run reviewable in minutes via filtering — that is the property the north star depends on

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Harness architecture + schema
- `.planning/research/ARCHITECTURE.md` §Component 1 + §Component 3 — DECISIONS.jsonl schema sketch, `.planning/run/{run-id}/` layout, MAILBOX.jsonl schema, command surface (note: its `config-set harness.run_id` assumption is SUPERSEDED by the GSD_RUN_ID env-var decision above)
- `.planning/research/SUMMARY.md` — stack confirmation (zero deps), phase rationale, open gaps
- `.planning/research/PITFALLS.md` — Pitfall 5 (tool-grant confusion), Pitfall 6 (unverifiable decisions)

### Requirements + success criteria
- `.planning/ROADMAP.md` §Phase 10 — four success criteria (schema rejection, list/filter, run-context gate, unit-tested modules + documented layout)
- `.planning/REQUIREMENTS.md` — LEDGER-01/02/03

### Pattern template
- `get-shit-done/bin/lib/lesson.cjs` — the module shape to mirror (read/filter/cmd handlers, JSONL conventions) with the one deviation: no full-file rewrite for the ledger

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lesson.cjs`: `readLessons` (malformed-line-skipping JSONL reader), `filterLessons`, `formatTable`, `nextId` padding scheme, `cmdList --raw` — all directly portable
- `trace.cjs`: second JSONL reference implementation (read/filter shape)
- Existing unit-test suite conventions (959 tests) — ledger/mailbox tests follow the same structure

### Established Patterns
- One `bin/lib/{name}.cjs` module per subcommand family, pure functions exported for tests, `cmd*` handlers doing process I/O
- `gsd-tools.cjs` (903 lines) is a thin dispatcher — new `ledger`/`mailbox`/`run` cases route to the lib modules

### Integration Points
- `gsd-tools.cjs` dispatch table — add `ledger`, `mailbox`, `run init`
- `.gitignore` — add `.planning/run/`
- Future consumers (do NOT wire now): Phase 11 `discuss-phase.md` question_triage (evaluator + ledger write), Phase 12 mailbox review, Phase 13 `overnight.md` (sets `GSD_RUN_ID`, calls `run init`)
- Source→runtime: edits live in `get-shit-done/bin/`, synced to `.claude/` via `npm run dev`

</code_context>

<specifics>
## Specific Ideas

- "Having it running over whole milestone for several hours... solving everything else with other agents, only spotting important questions to a user — this is how it should look like. Longer runs, more autonomous, higher quality of delivered product" — the ledger is the trust substrate for that vision
- Session meta-lesson applied mid-discussion: fixed question quotas push toward human validation; the discuss-phase command prompt was fixed (commit 4b21af1) to triage-first adaptive depth — Phase 10's own decisions were made in that style (specialist auto-decide + override offer)

</specifics>

<deferred>
## Deferred Ideas

- `mailbox review`/`answer` interactive inbox — Phase 12 (PARK-02)
- Escalation evaluator + verdict write — Phase 11 (ESC-02)
- `autonomous.md:255/276` still carries "~4 questions each" grey-area directives — align with adaptive triage-first style when Phase 13 touches that file
- Per-run `agent-trace.jsonl` isolation (parallel worktree writes) — Phase 13 scoping decision (research gap)

### Reviewed Todos (not folded)
- "Add user sync checkpoints to plan-phase subagent chains" (match 0.6) — plan-phase workflow concern, unrelated to persistence layer
- "Update command should sync project-local hooks" (match 0.2) — tooling/install concern, unrelated

</deferred>

---

*Phase: 10-decision-ledger-cli-foundation*
*Context gathered: 2026-06-11*
