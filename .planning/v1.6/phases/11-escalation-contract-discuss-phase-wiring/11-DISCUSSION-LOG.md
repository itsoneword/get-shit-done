# Phase 11: Escalation Contract + discuss-phase Wiring - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-11
**Phase:** 11-escalation-contract-discuss-phase-wiring
**Decisions captured:** 6 areas (most STRONG or STRONG/specialist-backed; gate threshold digits WEAK/specialist-backed)

---

## Conversation Summary

### Expected outcome (north star)
**User's perspective:** Restated the milestone vision unprompted — GSD becomes self-sufficient phase-by-phase: overnight parallel runs, autonomous research, only genuinely necessary questions saved up, one ~1-hour morning discussion, then re-run to execute the answers. Phase 11 framed as the trust lever for that.
**Decision:** Recorded in Expected Outcome; consistent with Phase 10's north star.
**Signal:** [STRONG] — unprompted, detailed, consistent across sessions.

### Contract location / criteria precision / golden set
**User's perspective:** Did not contest — resolved autonomously by triage (evidence-based convention questions, not preference).
**Decision:** `references/escalation-contract.md` (framework-shipped); criteria hardened to discrete condition lists from ARCHITECTURE.md drafts; golden set handcrafted ≥10 (≥2 park-and-ask per criterion + proceed/proceed-and-log cases), lives in phase dir.
**Signal:** [STRONG, specialist-backed] — offered with override, accepted via "Capture it".

### Tie-break bias + gate threshold
**User's perspective:** Pushed back on the initial strict zero-miss/park-biased proposal: "we need a balance between ask 10 questions instead of 1 bad decision and make working code based on self-performed research and discuss it later... start with something neutral and see where it goes."
**Decision:** Borderline → proceed-and-log (the neutral tier), EXCEPT irreversibility/security borderlines still park. Gate: zero hard-criteria misses; soft-criteria miss into proceed-and-log tolerated, into proceed ≤1; false parks ≤3/10; human records PASS/FAIL in 11-CALIBRATION.md which Phase 13 checks.
**Signal:** [STRONG] on the neutral posture and the hard/soft asymmetry (explicit user reasoning); [WEAK, specialist-backed] on the specific digits (user accepted posture, not numbers — planner may adjust digits, not structure).

## Established (Not Discussed)
- GSD_RUN_ID env signaling, write-once verdict-at-append, evaluator inline-not-subagent, zero-behavior-change for interactive sessions — all locked in Phase 10 CONTEXT/cross-phase notes; presented as established, not re-asked.
- `ledger.cjs` already passes through `escalation_verdict`/`escalation_reason` — no lib changes needed (verified in code during scout).

## Deferred Ideas
- Mailbox parking on park-and-ask → Phase 12
- autonomous.md smart_discuss wiring + question-count alignment → Phase 13
- Threshold tuning → post-calibration
- Reviewed todo not folded: "user sync checkpoints in plan-phase chains" (unrelated, also reviewed-out in Phase 10)
