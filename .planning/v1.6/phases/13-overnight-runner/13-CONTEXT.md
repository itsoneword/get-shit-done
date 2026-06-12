# Phase 13: Overnight Runner - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

`/gsd2:overnight` runs remaining phases unattended — worktree-isolated, ledger-wired, mailbox-integrated, with a startup health check and a morning report. Wraps `/gsd2:autonomous`; all scheduling via system cron (documented, not installed); zero new npm dependencies. Requirements: RUN-01, RUN-02, RUN-03, RUN-04.

**Detected domain:** Agentic
**Evidence:** phase goal keywords (autonomous, runner, orchestration, headless agent runs); structural (`agents/`, `workflows/` are the codebase itself)
**Confirmed by user:** yes

</domain>

<established>
## Established Patterns (from codebase + prior phases)

- `GSD_RUN_ID` env var is the run signal, NOT config — locked Phase 10 ([STRONG, specialist-backed]); evaluator/ledger/mailbox/park all gate on it
- ESC-03 calibration gate: case-SENSITIVE `grep -q "PASS"` on `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CALIBRATION.md` before any overnight run — locked Phase 11; template pre-contains zero uppercase occurrences
- Merge conflicts route to mailbox, never swallowed: `cmdWorktreeMerge` exits 0 on conflict by design — runner MUST parse `--raw` JSON and check `clean:false` (RUN-02 verbatim)
- Stuck detection: runner OWNS calling `gsd-tools run snapshot` at every phase boundary and writing the flag to run.log — Phase 12 boundary decision
- Park-and-ask bifurcation: autonomous mode writes mailbox `pending` + park snapshot + PHASE PARKED halt — shipped Phase 12; the runner gets non-blocking parking for free
- `/gsd2:inbox` exists (Phase 12) — the single morning review surface; do not invent a second one
- Ledger write-once: verdict computed before append; revisions are superseding records — Phase 10/11
- `appendFileSync` telemetry writes are POSIX-atomic under 4096 bytes — no mutex, no per-run trace files needed for parallel worktree writes
- Worktree machinery: `gsd-tools worktree add/merge/remove` (Phase 7), including `{ok:false, fallback:"in-place"}` sandbox fallback the runner must handle
- Zero new npm dependencies; system cron, no resident daemon — REQUIREMENTS.md explicit

</established>

<decisions>
## Implementation Decisions

### Wave-0 constraint record (empirical — gates scheduling logic, per roadmap success criterion 4)
- **Auth:** OAuth expiry is NOT treated as a blocker — no `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN` mandate in the design. Safety net = startup health check + loud `AUTH_FAILURE` logging in run.log + run stops (RUN-03). If a real run hits expiry, run.log shows it and the prescription is revisited. [STRONG, user-override] — user's own overnight sessions sustain auth; trust-ladder empiricism over preemptive complexity
- **Permissioning:** sandbox-first, NOT blanket `bypassPermissions`. Sandboxed bash + auto-allow runs promptless headless; the runner's settings profile must pre-allow network (`sandbox.network.allowedDomains` + `permissions.allow` rules for `WebFetch(domain:...)`/`WebSearch`) since per-domain prompts are the known pain point. [STRONG, user-override]
- **Would-prompt tool calls in `-p` mode AUTO-DENY, do NOT abort** — probed live 2026-06-12: temp project with `{"permissions":{"ask":["Bash(touch:*)"]}}`, `claude -p` exit 0, run continued, model saw "the command was denied", result JSON carried structured `permission_denials[]` (tool_name, tool_input). Two routable signals: model writes the mailbox entry mid-session; runner checks `permission_denials` in result JSON as backstop. Mailbox routing of permission needs is therefore fully viable. [STRONG, specialist-backed] confidence: HIGH source: live probe this session <!-- resolved inline by resolution loop -->

### Morning flow (RUN-04)
- Inbox-first composition: `/gsd2:inbox` is THE morning command — it prints the run report summary (decisions made, phases completed, parked count) then walks the questions. [STRONG, specialist-backed] — confirms Phase 12's "single morning entry point" note
- `gsd-tools run report <run-id>` still ships as a standalone CLI subcommand (RUN-04 requires it); inbox embeds/reuses it rather than duplicating
- Report reads RUN-META.json + DECISIONS.jsonl + MAILBOX.jsonl only — no transcript replay (RUN-04 verbatim)

### Launch & scheduling (v1 posture)
- Manual-first: user launches `/gsd2:overnight` themselves (interactive session or a single `claude -p` line). [STRONG, specialist-backed] — trust ladder
- Crontab entry convention DOCUMENTED in the workflow (copy-paste line), NOT installed by the phase; no install helper

### Run scope + failure posture
- Default scope: all remaining phases; `--from N` override supported
- Skip-to-independent on park/failure: when a phase parks or fails (non-auth), record it (ledger/mailbox + run.log), then continue to the next phase that does not `depends_on` the blocked one; stop when nothing independent remains. [STRONG, specialist-backed] — park-don't-block applied to the run loop
- Auth failure is the exception: ALWAYS stops the run, loudly, no silent retry (RUN-03); `permission failures` likewise logged loudly
- Phases execute sequentially in v1 (one at a time, each in its own worktree); concurrent independent phases deferred

### autonomous.md touch-ups (while in there)
- Align `autonomous.md:255` ("3-4 grey areas with ~4 questions each") and `:276` (4-question cadence) with the adaptive triage-first depth style — carried from Phase 10 note [STRONG]
- Invocation shape: overnight wraps autonomous as a sub-skill call (`Skill(skill="gsd2:autonomous", ...)`); the autonomous phase loop itself is not rewritten inline

### Claude's Discretion
- Exact morning report fields/layout (plain text, terminal-friendly — research MEDIUM)
- Health check exact check list and ordering (anchors: ESC-03 gate, auth verification, git tree state; root-check only relevant if bypassPermissions is ever used — it isn't in v1 posture)
- Mechanism for computing phase independence (`depends_on` parse from ROADMAP.md)
- `overnight.md` internal step structure; run.log line format; `GSD_RUN_LOG` absolute-path export
- `--run-id` override and other minor flags

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** User launches `/gsd2:overnight` in the evening; in the morning, one `/gsd2:inbox` session shows what happened (decisions, phases completed, questions parked) and walks every parked question in a single sitting
- **Success signal:** A run.log exists per run that explains itself — including any failure — without transcript replay; merge conflicts and permission needs appear as mailbox entries, never as silent breakage
- **Flow:** evening launch → health check gates (ESC-03, auth) → phases run worktree-isolated, parking instead of blocking, skipping to independent work → morning: inbox-first review → answers recorded (resume itself is Phase 15)

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Wave-0 + phase research
- `.planning/v1.6/phases/13-overnight-runner/13-RESEARCH.md` — W0-1..W0-5 findings (incl. user constraint record §W0-5), patterns, pitfalls, validation architecture

### Requirements + gates
- `.planning/REQUIREMENTS.md` — RUN-01..RUN-04 (lines 37–40); zero-dependency and cron constraints
- `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CALIBRATION.md` — ESC-03 gate witness file (case-sensitive PASS token)
- `get-shit-done/references/escalation-contract.md` — park/proceed verdict semantics the runner inherits

### Primitives consumed (read before wiring)
- `get-shit-done/workflows/autonomous.md` — phase loop being wrapped; prompt-alignment targets at :255/:276
- `get-shit-done/bin/lib/ledger.cjs` — `cmdRunInit`, RUN-META.json, ledger append; `run report` lands here
- `get-shit-done/bin/lib/mailbox.cjs` — append/list/answer, q-NNN allocation
- `get-shit-done/bin/lib/park.cjs` — `runLogPath()`, park create/staleness, stuck flag
- `get-shit-done/bin/lib/worktree.cjs` — `clean:false` exit-0 contract (source comment line ~16), in-place fallback
- `get-shit-done/workflows/inbox.md` and `commands/gsd2/inbox.md` — morning entry point to extend; command-stub convention to copy

### Prior-phase boundaries
- `.planning/cross-phase-notes.md` — Phase 10/11/12/14 entries addressed "For Phase 13" (run-signal, calibration gate, stuck-detection ownership, inbox composition, discuss-loop wiring option)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-tools run init <id>`: creates run directory layout + RUN-META.json with `phases[]` ready to populate (probe-verified exit 0)
- `gsd-tools worktree merge --raw`: JSON with `clean` + `conflict_files[]` — the RUN-02 conflict check is a field read, not git parsing
- `gsd-tools park create` / `run snapshot`: parking snapshots and stuck detection already implemented — runner just calls them at boundaries
- `permission_denials[]` in `claude -p` result JSON: structured denial backstop (probe-confirmed)

### Established Patterns
- Command stubs follow `commands/gsd2/inbox.md` shape (frontmatter + execution_context @-ref + $ARGUMENTS)
- `run report` joins the existing `case 'run'` dispatch in gsd-tools.cjs, implemented in ledger.cjs next to run-meta helpers

### Integration Points
- `overnight.md` (new workflow) → `Skill(gsd2:autonomous)` → existing discuss/plan/execute loop with `GSD_RUN_ID` inherited from env
- `/gsd2:inbox` gains the report header (reads same run-id artifacts) — extend, don't fork
- run.log path must be exported absolute (`GSD_RUN_LOG`) so worktree-CWD phases write to the main tree's `.planning/run/{run-id}/run.log`

</code_context>

<specifics>
## Specific Ideas

- Morning ritual is ONE sitting: "overnight parallel phase runs → questions saved → one ~1-hour morning discussion answering everything → run resumes" — user's vision, restated three times (Phases 11/12 notes)
- run.log entries timestamped UTC ISO; failures recorded as typed lines (`AUTH_FAILURE`, `PHASE_FAILURE`, `HEALTH_FAIL`, conflict routing) so the log greps cleanly
- Probe artifact for the record: `claude -p` with ask-rule denial completed in ~2.3 min, exit 0, `num_turns:2`, denial visible in both prose result and `permission_denials[]`

</specifics>

<deferred>
## Deferred Ideas

- Cron install helper (auto-write crontab entry) — manual-first v1; revisit after supervised runs succeed
- Concurrent execution of independent phases (parallel worktrees) — v1 is sequential skip-to-independent; full parallelism is a later trust-ladder rung
- Parked-branch resume / replay into autonomous.md — Phase 15 territory (snapshot contract fixed in Phase 12; do not redesign)
- Runner-invoked discuss-loop on project-level open questions — Phase 14 shipped the command standalone; wiring it into overnight runs is optional 13/15 scope, not committed here

### Reviewed Todos (not folded)
- "Add user sync checkpoints to plan-phase subagent chains" — interactive planning ergonomics; orthogonal to (and in tension with) the autonomy push of this phase
- "Update command should sync project-local hooks" — tooling maintenance, unrelated to the runner

</deferred>

---

*Phase: 13-overnight-runner*
*Context gathered: 2026-06-12*
