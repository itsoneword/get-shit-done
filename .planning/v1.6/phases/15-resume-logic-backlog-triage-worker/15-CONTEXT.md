# Phase 15: Resume Logic + Backlog Triage Worker - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables that close the v1.6 autonomous-supervision loop:

1. **Resume logic (PARK-03 / SC1):** A parked branch restarts correctly. `autonomous.md` (inherited by `overnight.md`) gains a resume branch in its existing phase loop — when a phase has a `parked/phase-N.json` snapshot whose mailbox question is now `answered`, it re-reads STATE.md / ROADMAP.md / cross-phase-notes.md, surfaces the staleness diff, then replays the blocked step with the human's answer injected (rather than starting the phase fresh).

2. **Triage worker (TRIAGE-01 / TRIAGE-02 / SC2):** `/gsd2:triage` reads pending todos + ROADMAP backlog against codebase + roadmap and emits six-verdict proposals (already-done / obsolete / fold-into-phase / new-phase / needs-input / defer) with evidence into `MAILBOX.jsonl`. Folded into the overnight run as a post-phase step so proposals surface in the same morning inbox. Nothing is promoted, folded, marked done, or deleted until the human accepts — and acceptance records + prints the routing command rather than executing disposal inside the inbox.

**NOT in scope:** redesigning the park snapshot contract (fixed Phase 12), the mailbox/ledger schema (Phase 10), the inbox's thin read-and-record nature (Phase 12), or the overnight phase loop itself (Phase 13). Phase 15 wires resume + triage onto the existing primitives.

**Detected domain:** Agentic
**Evidence:** phase-goal keywords (autonomous replay, worker, mailbox orchestration, propose-only); structural (`workflows/`, `agents/`, `commands/gsd2/` are the codebase)
**Confirmed by user:** yes (whole-system orientation discussion confirmed the autonomous overnight → morning-inbox → resume framing)

</domain>

<established>
## Established Patterns (from codebase + Phases 10–14)

- `GSD_RUN_ID` env var is THE run signal, never a config key — locked Phase 10; resume/triage gate on it the same way
- Park snapshot contract is FIXED (Phase 12, "do not redesign"): `parked/phase-{N}.json` carries `phase`, `blocked_at`, `question_id`, `phase_dir`, `context_path`, `resume_instruction`, `content_hashes` (STATE/ROADMAP/cross-phase-notes/CONTEXT), `git_head`, `ts`
- `park staleness <run-id> --phase N [--raw]` already computes the diff: `changed` / `unchanged` / `missing` + `git_range` + `resume_instruction`. Resume consumes it; does not re-implement
- `mailbox answer` already prints the resume handoff (`printResumeHandoff`) when a snapshot exists — the handoff text is the resume entry contract
- Inbox is THIN (locked Phase 12): reads mailbox, records answers, prints handoffs — never resumes/replans/executes/mutates planning files. Already future-proofed for triage-type entries ("do not hardcode decision-type-only assumptions")
- Ledger is write-once append-only; the superseding record is written when the branch ACTS on the answer at resume (Phase 12 boundary decision — this is Phase 15's job)
- `PHASE RESULT: (completed|parked|failed) phase=N` is autonomous.md's machine-greppable outcome contract consumed by overnight.md
- overnight.md run.log TYPE vocabulary is locked to 16 tokens — any new resume/triage logging must reuse existing tokens, not invent new ones
- Skip-to-independent: overnight continues past parked/failed phases to independent work; resume re-enters those skipped/parked phases on a later run
- Orchestrator-level only — resume + triage logic lives in workflow prose + CLI, never a Task() spawn (subagents lack Skill/Agent grants)
- Propose-never-dispose is load-bearing for trust (REQUIREMENTS Out-of-Scope: "Autonomous disposal of todos/backlog")
- Source→runtime: edits in `get-shit-done/` + `commands/gsd2/`, synced via `npm run dev`; zero new npm dependencies

</established>

<decisions>
## Implementation Decisions

### Resume entry point (SC1)
- Resume is a **branch inside the existing phase loop** in `autonomous.md` (inherited by `overnight.md`), NOT a new top-level command [STRONG, specialist-backed — fits Phase 13 single-phase `--phase N` contract + Phase 12 snapshot]
- Trigger condition: a phase has a `parked/phase-N.json` snapshot AND its mailbox question `status === "answered"`. On `--phase N` (manual re-run or the next overnight pass), the loop detects this and enters resume instead of starting the phase fresh
- Detection happens before the discuss/plan/execute sub-steps — resume short-circuits to "continue the blocked step," it does not re-run smart-discuss from scratch

### Replay granularity (SC1 — the ROADMAP-flagged crux)
- Resume replays **from the blocked step**, not a full-phase restart [STRONG, specialist-backed — the snapshot was purpose-built for this with `blocked_at` + `resume_instruction`; full restart discards the parking apparatus's entire purpose]
- The snapshot's `resume_instruction` (e.g. "re-enter question_triage with the answer to q-NNN applied as the decision for '<topic>'") is the literal replay directive — resume reads it and re-enters that workflow at that step with the answer injected as the decision
- The answer is applied as a locked decision (written into the phase CONTEXT.md `<decisions>` and the ledger superseding record) so the replayed step does not re-ask

### Pre-replay sequence (the literal SC1 contract)
- Before replaying, ALWAYS: (1) re-read STATE.md / ROADMAP.md / cross-phase-notes.md, (2) run `park staleness <run-id> --phase N`, (3) **surface the staleness diff to the human**, (4) then replay [STRONG — SC1 wording "the staleness diff ... is surfaced to the human before execution continues" is verbatim]
- The primitive (`park staleness`) already exists — resume wires it as a mandatory gate, does not reimplement the diff

### Drift handling (interactive vs headless)
- **Interactive morning path** (human present during/after `/gsd2:inbox`): the human just answered the question and is watching — answering-and-continuing IS the proceed signal; the diff is shown, no separate confirm prompt needed
- **Headless auto-resume** (a fresh overnight pass re-enters a previously parked-and-now-answered phase): if staleness shows planning files changed since park, **re-park with a "state moved since park" note** rather than replaying blind against drift [STRONG — fail-safe matches propose-never-dispose; a wrongly-replayed phase against moved state poisons downstream]

### Triage input scope (TRIAGE-01)
- Reads BOTH pending todos (`todos/pending/` via existing `list-todos`) AND ROADMAP `## Backlog` items (B-prefixed) [STRONG — TRIAGE-01 says "pending todos/backlog" verbatim]
- Each item is analyzed against the codebase AND the current roadmap to choose its verdict (e.g. "already-done" requires finding the implementing code; "obsolete" requires a roadmap/code reason; "fold-into-phase" requires naming the target phase)

### Triage output + verdict schema (TRIAGE-01)
- Each item gets exactly one of the six verdicts — already-done / obsolete / fold-into-phase / new-phase / needs-input / defer — with an evidence string, appended to `MAILBOX.jsonl` as a triage-type entry [STRONG — six verdicts verbatim in TRIAGE-01]
- Same mailbox schema; distinguishable as a triage proposal (a `type` field or proposal-shaped question) so the inbox can present it as a proposal rather than a parked-phase question; inbox is already built not to assume decision-only entries
- One `mailbox append` per proposal — mailbox append is per-line atomic (`appendFileSync`), so no batch-atomicity machinery is needed [STRONG, specialist-backed — resolves the "batch-to-mailbox write atomicity" discussion-focus item: it's a non-issue given the append-only primitive]
- Evidence format mirrors the ledger/decision record shape (verdict + supporting evidence + target phase where applicable) [WEAK, specialist-backed — exact field names are planner discretion]

### Triage run posture (folded into overnight)
- `/gsd2:triage` is **folded into the overnight run** as a step after the phase loop (before/with the morning report) so the morning inbox shows phase questions + backlog proposals in one sitting [STRONG — user chose "Fold into overnight" explicitly against standalone-only; this is the choice that makes triage match the "one trigger → one morning review" concept]
- ALSO available as a standalone `/gsd2:triage` command for ad-hoc invocation when the todo pile feels stale (manual-first, mirrors Phase 13's overnight-launch posture)
- This adds a triage step to `overnight.md` — a Phase 15 edit to the Phase 13 workflow

### Acceptance routing (TRIAGE-02 — "executes only on human acceptance in the inbox")
- The inbox stays **THIN** (locked Phase 12). Accepting a triage proposal **records the accepted verdict (`mailbox answer`) and prints the routing command/handoff** — it does NOT itself promote / fold / mark-done / delete [STRONG — trust constraint + thin-inbox lock; user confirmed they want the safe two-step shape over one-click after the trade-off was explained]
- Disposal runs as a separate explicit, auditable step, symmetric with resume being a separate step. The human's accept is the authorization; the disposal is never a side-effect of reading the inbox (no "accept" silently rewrites ROADMAP.md)
- The routing commands triage hands off to should reuse existing GSD verbs where they exist (e.g. promote-to-phase / fold / mark-todo-done / remove) — planner identifies the exact command surface per verdict

### Claude's Discretion
- Exact triage-entry `type`/marker field name and proposal-presentation format in the inbox
- Whether resume detection lives in `discover_phases` filtering vs a check at the top of `execute_phase`
- Exact routing command for each of the six verdicts (reuse existing skills/CLI; planner maps verdict → command)
- run.log line wording for resume/triage events (MUST reuse the 16 locked TYPE tokens — likely `PHASE_START`/`PHASE_COMPLETE` for resume, no new token for triage unless one of the 16 fits)
- Triage's per-item codebase-evidence-gathering method (grep/agent-read depth)
- Test structure (follows Phase 10+ unit-test conventions)

</decisions>

<expected_outcome>
## Expected Outcome

User's north star (restated and confirmed this session): one evening trigger runs the whole milestone unattended — discuss (multi-lens panel) → plan → execute across all remaining phases, resolving everything resolvable and parking only genuine human-judgment questions; the human has one ~1-hour morning session answering every parked question AND every backlog proposal in one place; then the run resumes the parked phases to execute what was decided. Phase 15 is the two pieces that close this loop: **resume** (answers actually continue the work) and **triage** (the backlog pile becomes another stream of morning questions).

- **End state:** After the morning inbox session, each answered parked phase **resumes from its blocked step** — re-reading current state, showing what changed overnight, replaying with the answer applied — and runs to completion (or re-parks on drift). The overnight run also surfaced six-verdict proposals about the todo/backlog pile, which the human accepted/deferred in the same session; accepted ones printed a routing command to run.
- **Success signal:** A parked-then-answered phase continues correctly without re-asking the answered question; the staleness diff is visibly shown before any replay; `/gsd2:triage` (standalone or inside overnight) lands evidence-backed proposals in the mailbox; nothing in the todo/backlog pile is mutated until the human explicitly accepts AND runs the printed routing step.
- **Flow:** evening `/gsd2:overnight` → phases run, parking questions, then triage proposes verdicts on the backlog → morning `/gsd2:inbox` shows phase questions + triage proposals together → human answers/accepts all → resume replays each answered phase from its blocked step against current state → milestone completes.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + success criteria
- `.planning/ROADMAP.md` §Phase 15 — two success criteria + Discussion focus line (resume splice point, replay meaning, staleness diff format, triage scope, evidence format, batch atomicity)
- `.planning/REQUIREMENTS.md` — TRIAGE-01, TRIAGE-02; PARK-03 (resume staleness check); Out-of-Scope "Autonomous disposal of todos/backlog"

### Resume primitives (read before wiring)
- `get-shit-done/bin/lib/park.cjs` — `buildParkSnapshot` (snapshot fields), `checkStaleness`, `cmdParkStaleness` (`park staleness` output the resume gate consumes); snapshot contract is FIXED
- `get-shit-done/bin/lib/mailbox.cjs` — `cmdMailboxAnswer`, `printResumeHandoff` (resume handoff text), `answerRecord`; the `status === "answered"` signal resume keys on
- `get-shit-done/workflows/autonomous.md` — the phase loop resume splices into (`execute_phase` step 3a–3d, single-phase `--phase N` mode, `PHASE RESULT:` contract)
- `get-shit-done/workflows/inbox.md` — THIN constraint (records answers, prints handoffs, never resumes); rule "Phase 15 adds triage-type entries flowing through this same inbox"
- `get-shit-done/bin/lib/ledger.cjs` — write-once append; resume writes the superseding record when the branch acts on the answer

### Triage primitives (read before wiring)
- `get-shit-done/bin/gsd-tools.cjs` §`case 'todo'` / `list-todos` — pending-todo read surface; `todo match-phase` for codebase/roadmap matching
- `.planning/ROADMAP.md` §Backlog (B1...) — backlog-item read surface
- `get-shit-done/workflows/overnight.md` — the run the triage step folds into (after the phase loop, before/with the morning report); 16-token run.log TYPE vocabulary
- `commands/gsd2/inbox.md` + `commands/gsd2/` — command-stub convention for the new `/gsd2:triage` command

### Locked upstream decisions
- `.planning/v1.6/phases/12-park-don-t-block-mailbox/12-CONTEXT.md` — snapshot contract, thin-inbox lock, "resume handoff is printed not performed (Phase 15)", "triage-type entries flow through same inbox (Phase 15)"
- `.planning/v1.6/phases/13-overnight-runner/13-CONTEXT.md` — overnight phase loop, skip-to-independent, `PHASE RESULT:` consumption, "parked-branch resume is Phase 15 territory; snapshot contract fixed, do not redesign"
- `.planning/cross-phase-notes.md` — prior-phase deferrals pointing at Phase 15

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `park staleness --raw`: returns `{changed, unchanged, missing, git_range, resume_instruction}` — the resume gate is a field read, not a re-implementation
- `mailbox answer` → `printResumeHandoff`: already prints resume instruction + staleness on answer; resume reads the same snapshot
- `list-todos` + `todo match-phase`: pending-todo enumeration and phase-matching already exist for triage input
- `mailbox append` (`appendFileSync`, per-line atomic): triage proposals append one-per-line; no batch machinery needed
- The two current pending todos ("user sync checkpoints", "hook sync") + backlog B1 are the live test corpus for triage

### Established Patterns
- One `bin/lib/{name}.cjs` per subcommand family; pure functions exported for tests, `cmd*` handlers for I/O; thin dispatch in `gsd-tools.cjs`
- Command = `commands/gsd2/{name}.md` stub + workflow prose in `get-shit-done/workflows/{name}.md`, synced via `npm run dev`
- Harness gates on `GSD_RUN_ID`; interactive (no run id) paths unchanged
- run.log lines use only the 16 locked TYPE tokens

### Integration Points
- `autonomous.md` `execute_phase` — resume branch inserted (detect answered snapshot → staleness gate → replay blocked step)
- `overnight.md` — triage step appended after the phase loop (before/with morning report)
- `inbox.md` — presents triage proposals (already non-decision-type-safe); accept records + prints routing command
- New `/gsd2:triage` command + workflow file; new triage logic in a `bin/lib/*.cjs` module (verdict assignment, evidence gathering, mailbox proposal write)
- `ledger.cjs` — resume writes the superseding decision record when a branch acts on an answer

</code_context>

<specifics>
## Specific Ideas

- The whole-system framing the user confirmed: "one command, goes through all phases overnight — discussion (skeptic / user-advocate / architect panel, token-heavy) → planning → execute — parks questions it can't answer, and in the morning the human answers everything from all phases in one sitting, then it resumes to execute what was decided." Resume is the piece that makes the morning answers actually continue the work.
- Triage was initially confusing because it operates on a different input (the todo/backlog pile) than the overnight phase loop (roadmap phases). The resolution that made it fit the concept: fold it into overnight so it becomes a second stream of morning-inbox questions, not a separate ritual.
- "Involve the human only where it is really needed" — the user's explicit operating rule this session; drove resolving every technical fork autonomously and surfacing only the triage-fit and accept-routing decisions.

</specifics>

<deferred>
## Deferred Ideas

- Auto-running triage on a schedule independent of overnight — v1 is overnight-folded + manual standalone
- One-click accept-and-execute in the inbox — rejected for v1 (breaks the thin-inbox lock + propose-never-dispose); disposal stays a separate explicit step
- Resuming MORE than the blocked step (e.g. re-planning when staleness is large) — v1 re-parks on drift instead; smarter drift-reconciliation is a future trust-ladder rung

### Reviewed Todos (folded as triage test corpus, not folded into phase scope)
- "Add user sync checkpoints to plan-phase subagent chains" and "Update command should sync project-local hooks" — reviewed-out of Phases 12/13; here they serve as the live input corpus for testing `/gsd2:triage`, not as phase-15 implementation work

</deferred>

---

*Phase: 15-resume-logic-backlog-triage-worker*
*Context gathered: 2026-06-17*
