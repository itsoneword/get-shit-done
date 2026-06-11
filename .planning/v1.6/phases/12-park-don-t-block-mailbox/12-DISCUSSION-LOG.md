# Phase 12: Park-Don't-Block Mailbox - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-11
**Phase:** 12-park-don-t-block-mailbox
**Decisions captured:** 12 (10 strong, 0 weak, 2 discretion clusters)

---

## Conversation Summary

### Outcome / phase vision
**User's perspective:** Opened by restating the north star verbatim (fourth consistent occurrence across Phases 2/10/11/12): GSD evolves into a self-sufficient mechanism — overnight parallel phase runs, autonomous research everywhere possible, questions raised and SAVED where needed, then one meaningful ~1-hour morning discussion answering everything, then re-run to execute what was decided.
**Decision:** Phase 12 is the middle of that loop (save-questions path + morning-answer path); expected outcome anchored to it.
**Signal:** [STRONG] — unprompted restatement, consistent with all prior sessions.

### Inbox UX (the one preference question asked)
**User's perspective:** Chose "CLI + thin skill now" (recommended option). The roadmap locks `gsd-tools mailbox review` as CLI; the user's vision is a discussion, which raw stdin doesn't deliver.
**Decision:** Ship CLI primitive per roadmap PLUS a thin `/gsd2:inbox` skill — Claude presents each question with context/evidence/staleness, discusses, records the answer. Skill is thin: no resume execution, no replanning.
**Signal:** [STRONG, specialist-backed] — picked the recommended option; it directly operationalizes the user's own repeated vision statement.

### Technical areas resolved autonomously (override offered, none contested)
- **Parking state machine:** mailbox entry + parked/phase-{N}.json snapshot, both; parked state derivable, no third state file. [STRONG, specialist-backed — ARCHITECTURE.md Component 3 + PARK-01 verbatim]
- **Parking trigger:** only GSD_RUN_ID + autonomous mode; interactive (incl. calibration) keeps asking directly per locked Phase 11 decision. [STRONG]
- **Snapshot contents:** blocked-at metadata + content hashes (STATE.md, ROADMAP.md, cross-phase-notes.md, phase CONTEXT.md) + git HEAD; staleness = re-hash + changed-file list + git range, visible not blocking. [STRONG, specialist-backed]
- **Stuck detection:** DECISIONS.jsonl hash at phase-boundary snapshots, threshold 2 consecutive identical (verbatim roadmap SC4); primitive here, runner calls it in Phase 13. [STRONG]
- **12/15 resume boundary:** Phase 12 ships primitives + printed resume handoff; Phase 15 wires replay into autonomous.md. [STRONG, specialist-backed]
- **Ledger integrity at answer time:** answers live in MAILBOX.jsonl; superseding ledger record happens at resume (Phase 15), preserving write-once. [STRONG, specialist-backed]

## Established (Not Discussed)
- GSD_RUN_ID env-var run signal; write-once ledger; mailbox schema with status/answer/answered_ts already shipped (Phase 10)
- Park-and-ask tier semantics + tie-break asymmetry (Phase 11)
- Zero new npm deps; orchestrator-level only; source→runtime sync via npm run dev

## Deferred Ideas
- Morning report integration into /gsd2:inbox — Phase 13
- Branch replay in autonomous.md — Phase 15
- Triage-type mailbox entries through the same inbox — Phase 15
