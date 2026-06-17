# Phase 15: Resume Logic + Backlog Triage Worker - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-17
**Phase:** 15-resume-logic-backlog-triage-worker
**Decisions captured:** 11 (9 strong, 1 weak, discretion documented)

---

## Conversation Summary

The user opened by reaffirming the milestone north star rather than introducing anything new: "nothing really changed from the previous phase, we are building automatic system, able to run over longer period of time, analyzing several phases and highlighting questions next morning for discussion with human where it is really needed." That phrase — "where it is really needed" — was taken as an explicit operating rule: resolve every technical fork autonomously, surface only genuine intent/taste.

### Resume logic
**User's perspective:** Treated as a continuation of the established design; did not contest the contract-driven approach.
**Decision:** Resume is a branch in the existing phase loop; replays from the blocked step using the fixed Phase 12 snapshot; mandatory staleness-diff gate before replay; headless auto-resume re-parks on drift.
**Signal:** [STRONG, specialist-backed] — determined by the Phase 12 snapshot contract (`blocked_at` + `resume_instruction`) and SC1 verbatim wording; full-phase-restart rejected because it discards the parking apparatus.

### Triage — orientation detour
**User's perspective:** Genuine confusion about where triage fits. Asked for a whole-system map: "highlight to me based on the current phase, the previous one and the next one ... how it's expected to look like." Their model: one command → autonomous discuss (multi-lens panel)/plan/execute across all phases → morning the human answers all parked questions → resume. They couldn't see when/why they'd ever run a separate triage command.
**Resolution:** Explained the full overnight → park → morning-inbox → resume loop, then located triage honestly: it operates on a *different input* (the todo/backlog pile), not roadmap phases, which is exactly why it felt foreign. The only integration is that it produces mailbox entries sharing the morning inbox.
**Decision:** Fold triage into the overnight run (post-phase step) so it becomes a second stream of morning questions — matching the "one trigger → one morning review" concept. Standalone `/gsd2:triage` also kept.
**Signal:** [STRONG] — user explicitly chose "Fold into overnight (Recommended)" after the orientation.

### Acceptance routing
**User's perspective:** Initially didn't understand the question (asked twice for rephrasing); ultimately the orientation discussion made the trust trade-off clear.
**Decision:** Inbox stays thin — accept records the verdict + prints the routing command; disposal is a separate explicit step. One-click accept-and-execute rejected (would break the Phase 12 thin-inbox lock and propose-never-dispose).
**Signal:** [STRONG] — determined by the locked thin-inbox constraint + trust requirement; confirmed consistent with resume also being a separate step.

### Triage input scope, verdict schema, batch atomicity
**Decision:** Reads pending todos + ROADMAP backlog (TRIAGE-01 "todos/backlog" verbatim); six verdicts with evidence; one atomic `mailbox append` per proposal (resolves the "batch atomicity" discussion-focus item as a non-issue given append-only).
**Signal:** [STRONG] / [WEAK, specialist-backed] on exact evidence field names.

## Established (Not Discussed)
- Park snapshot contract (fixed Phase 12), mailbox/ledger schema (Phase 10), thin inbox (Phase 12), overnight phase loop + 16-token run.log vocabulary (Phase 13), `PHASE RESULT:` contract, `GSD_RUN_ID` gating, orchestrator-level-only, zero new dependencies.

## Deferred Ideas
- Scheduled standalone triage independent of overnight
- One-click accept-and-execute in the inbox
- Resuming more than the blocked step / smart drift-reconciliation (v1 re-parks on drift)
- The two pending todos + B1 reused as the live triage test corpus
