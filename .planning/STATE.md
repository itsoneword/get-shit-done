---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Planning-Graph Layer
status: unknown
stopped_at: Completed 17-01-PLAN.md
last_updated: "2026-07-05T20:33:14.175Z"
progress:
  total_phases: 22
  completed_phases: 1
  total_plans: 5
  completed_plans: 4
---

## Current Position

Phase: 17 (graph-algorithms-integrity-check) — EXECUTING
Plan: 2 of 2

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.
**Current focus:** Phase 17 — graph-algorithms-integrity-check

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.7)
- Average duration: -
- Total execution time: 0 hours

## Accumulated Context

### Roadmap Evolution

- Phases 20–22 added (2026-07-04): closed-loop verification thread from the Anthropic agent-harness lecture — 20 Execution-Grounded Verification, 21 Contract Negotiation, 22 Verdict-Only Feedback + Restart Valve. Independent of the graph chain (16–19); 20 and 21 have no deps, 22 depends on 20. Bundled into v1.7 per user decision (thematic-orphan tradeoff accepted).

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Advisory before authoritative — graph ships read-only (Phases 16-17), earns trust via integrity-check numbers, only then repoints consumers (Phase 18) and goes authoritative (Phase 19) — same rollout pattern as the symmetry-check
- Advisory foundation split across two phases (16: model+CLI, 17: algorithms+integrity) rather than one — six GRAPH requirements is too large for a single phase per granularity guidance
- Strict linear dependency chain for v1.7: 16 → 17 → 18 → 19 — no parallel phases; each tier gates the next
- Phase 17's integrity check (dangling refs, cycles, affects-vs-files_modified contradictions) is the explicit mitigation for the key risk: requires/provides/affects are author-supplied and often sloppy — a graph on bad edges gives confident wrong answers
- Harness proposes, never disposes — all autonomous decisions auditable from ledger alone, no transcript replay
- Orchestrator-level only — subagents lack Skill/Agent grants; runner + evaluator run at top-level session
- Zero new npm dependencies — JSONL via fs, headless claude -p, system cron; all primitives confirmed present
- [Phase 10]: Append-only ledger: no writeLedger/cmdUpdate/patch exports; audit guarantee requires immutable JSONL
- [Phase 10]: Required-field validation uses 'in' operator so escalated:null passes (field present, value nullable)
- [Phase 10]: Run-context gate enforces GSD_RUN_ID or explicit arg; interactive sessions always hit exit 1 (never silent write)
- [Phase 10]: Mailbox append-only: no writeMailbox/cmdUpdate export; question is sole required field; run_id always forced to effectiveRunId
- [Phase 11-escalation-contract-discuss-phase-wiring]: Contract is self-contained (embeds tier definitions) rather than referencing REQUIREMENTS.md — matches resolution-loop.md pattern
- [Phase 11-escalation-contract-discuss-phase-wiring]: Tie-break default is proceed-and-log; irreversibility/security exception is park-and-ask — asymmetric by design (wrong scope/ambiguity call is reviewable; wrong security/irreversible call is not)
- [Phase 11-02]: Golden set uses 14 scenarios (above 10-floor): 2 per hard criterion, 2 per soft criterion, 2 proceed, 3 proceed-and-log, plus both tie-break directions
- [Phase 11-02]: CALIBRATION.md avoids uppercase PASS entirely by describing the token by letter spelling rather than writing it
- [Phase 12-park-don-t-block-mailbox]: park.cjs never touches MAILBOX.jsonl — boundary between park and mailbox is strictly enforced
- [Phase 12-park-don-t-block-mailbox]: STUCK FLAG header suppressed in --raw mode to keep raw output machine-parseable JSONL
- [Phase 12-park-don-t-block-mailbox]: Collect all stdin lines via readline close event before iterating questions — rl.question in async loop drops questions on piped-stdin EOF
- [Phase 12-park-don-t-block-mailbox]: writeMailbox used once per review session (after the loop) — one full-file rewrite for N answers, not per-question
- [Phase 12]: Autonomous park-and-ask bifurcates: interactive asks directly (Phase 11 behavior), autonomous writes mailbox pending + park snapshot + PHASE PARKED halt
- [Phase 14]: Three separate lens agent files (not one parameterized agent) — persona + schema versioned in source, per 14-RESEARCH recommendation
- [Phase 14-multi-lens-discussion-loop]: loop-id format includes Z from ISO timestamp — replace only /[:.]/g, Z stays in id
- [Phase 14-multi-lens-discussion-loop]: validate errors written to stdout not stderr — matches plan spec pattern
- [Phase 13]: readJsonlWithCount is a distinct function from readLedger — report needs the skipped count
- [Phase 13]: cmdRunReport reads exactly three files: RUN-META.json, DECISIONS.jsonl, MAILBOX.jsonl — RUN-04 locked constraint
- [Phase 13]: HARNESS_MODE gates are additive — interactive behavior is byte-equivalent when GSD_RUN_ID is unset
- [Phase 13]: PHASE RESULT is the outcome contract for autonomous.md in single-phase mode — machine-greppable final line, ambiguous=failed per AGENT-SPEC
- [Phase 13-03]: Sandbox-first posture locked: overnight.md NEVER uses bypassPermissions; denials auto-route to mailbox
- [Phase 13-03]: AUTH_FAILURE = hard stop, zero silent retries; all other failures use skip-to-independent
- [Phase 13-03]: run.log TYPE vocabulary locked to 16 tokens — the grep contract IS the observability API
- [Phase 13-03]: ESC-03 gate PASS count = 0 at build; overnight health check fails closed until human completes calibration
- [Phase 14-03]: Transcript exit-code failure aborts loop immediately — unauditable loop violates trust constraint
- [Phase 14-03]: Interactive sessions never write MAILBOX.jsonl; bifurcation (--auto AND GSD_RUN_ID) is the first branch in escalation_path
- [Phase 14-03]: mailbox append status must be explicitly "pending" — CLI default is "open", wrong for parked harness questions
- [Phase 14-03]: Escalation-contract gating scoped to converged-modify on tracked committed files only
- [Phase 14-03 smoke]: Hard-wrapped artifacts cause frequent anchor-validation failures (5/9 in smoke run) — one-retry ladder absorbs it but burns retries; consider whitespace normalization in anchor matching
- [Phase 14-03 smoke]: survivors --data requires NESTED array (array of rounds, each an array of blocks) — flat input throws "round is not iterable"; workflow prose reads as flat, needs clarification
- [Phase 15-resume-logic-backlog-triage-worker]: Resume detection fires at step 3a.0 before has_context check — short-circuits to replay rather than re-running discuss from scratch
- [Phase 15-resume-logic-backlog-triage-worker]: CONTEXT.md write happens strictly before ledger append (write-before-replay invariant); idempotency check (EXISTING_SUPER) runs before any write to prevent duplicate ledger entries on re-run
- [Phase 15-resume-logic-backlog-triage-worker]: cmdTriageRun emits 'needs-input' as structural default; LLM assigns real verdicts in workflow prose
- [Phase 15-resume-logic-backlog-triage-worker]: context field prefix 'triage-verdict:' enables inbox-triage-presenter discrimination; inline require for mailbox/ledger in functions avoids circular deps
- [Phase 15-03]: propose-never-dispose: inbox accept path calls mailbox answer then prints routing command verbatim; never executes it — human runs routing command as separate explicit step
- [Phase 15-03]: unknown verdict tokens degrade to needs-input with warning; corrupt triage entry must not block inbox session
- [Phase 15-03]: step 6.5 positioned after RUN_COMPLETE/RUN_STOP determination and before run report; triage failure logs PHASE_FAILURE phase=triage but does not abort morning report
- [Phase 16-01-planning-graph-model-cli]: wave frontmatter stays descriptive-only in Phase 16 — no wave-derived graph edge or node property
- [Phase 16]: [16-02] Normalized extractFrontmatter's dash-list continuation-line flattening for SUMMARY requires items inline in graph.cjs rather than patching the shared YAML parser
- [Phase 16]: [16-02] Todo depends_on/related_to resolved directly ('todo:' + item), never via refToNodeId, to avoid misparsing date-prefixed todo slugs into fabricated plan: nodes
- [Phase 16-03-gap-closure]: Fixed extractFrontmatter's shared block-selection bug at the root (not a graph.cjs workaround) — anchors to file-start, preserves CRLF-stacking recovery intent
- [Phase 17-01]: Excluded files_modified-sourced depends_on edges from topoSort/detectCycles traversal - they are documented-undirected file-overlap markers, not ordering constraints; fixes a real false-positive cycle (plan:16-01/16-02) found on the live repo

### Pending Todos

5 pending (see `.planning/todos/pending/`):

- Add user sync checkpoints to plan-phase subagent chains (workflows)
- Update command should sync project-local hooks (tooling)
- ESC-03 live-run confirmation (test-in-prod) — steps 2-3 of the calibration (harness)
- Executor+planner persona deep-dive and inter-agent handoff contracts (workflows)
- Add graph.cjs planning-graph layer normalizing existing edges (tooling) — consumed by this roadmap (Phases 16-19); mark resolved once v1.7 ships

Carry-over from v1.5: archival via /gsd2:complete-milestone pending; human UAT open for phases 02/06/09.
Carry-over from v1.6: archival note recorded in MILESTONES.md; deferred human-UAT on phases 11 & 14; ESC-03 live-run calibration gate still pending before first real overnight run.

### Blockers/Concerns

None for v1.7 Phase 16 (no external dependencies — first phase of the milestone).

Phase 19 (Authoritative Promotion) is gated on Phase 17's graph-integrity check reporting clean numbers on the live repo — do not start Phase 19 discussion until that gate is confirmed.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260702-kl9 | Token-cut cleanup batch from 2026-07-01 self-audit | 2026-07-03 | 3aef10f | [260702-kl9-token-cut-cleanup-batch-from-2026-07-01-](./quick/260702-kl9-token-cut-cleanup-batch-from-2026-07-01-/) |
| 260704-lbp | Hard/soft dependency distinction in roadmap (`sequence_after` field, parallel-gate proof, roadmapper guidance) | 2026-07-04 | ac7b20e | [260704-lbp-hard-soft-dependency-distinction-in-road](./quick/260704-lbp-hard-soft-dependency-distinction-in-road/) |
| 260704-m9p | Parallel-phase frontier scheduler: `roadmap frontier` command, `max_parallel_phases` config + `config-get` defaults fallback, autonomous.md per-worktree headless runner | 2026-07-04 | ecb7afb | [260704-m9p-parallel-phase-frontier-scheduler-per-wo](./quick/260704-m9p-parallel-phase-frontier-scheduler-per-wo/) |
| Phase 16 P01 | 15 | 2 tasks | 4 files |
| Phase 16 P02 | 12min | 2 tasks | 3 files |
| Phase 16 P03 | 15min | 2 tasks | 3 files |
| Phase 17-graph-algorithms-integrity-check P01 | 15min | 2 tasks | 3 files |

## Session Continuity

Last session: 2026-07-05T20:33:14.171Z
Stopped at: Completed 17-01-PLAN.md
Resume file: None
