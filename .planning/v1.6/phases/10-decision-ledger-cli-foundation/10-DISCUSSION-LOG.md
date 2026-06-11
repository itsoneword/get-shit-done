# Phase 10: Decision Ledger + CLI Foundation - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-11
**Phase:** 10-decision-ledger-cli-foundation
**Decisions captured:** 7 (5 strong, 1 weak, 1 discretion block)

---

## Conversation Summary

### Expected outcome (north star)
**User's perspective:** The harness should eventually run over a whole milestone for hours, resolving research/knowledge-creation autonomously and surfacing only genuinely important questions. "Longer runs, more autonomous, higher quality of delivered product."
**Decision:** Captured as Expected Outcome; Phase 10's contribution is a ledger that makes hundreds of decisions reviewable in minutes via filtering.
**Signal:** [STRONG] — detailed, unprompted vision statement.

### Meta: question style of the discussion itself
**User's perspective:** A 4-option AskUserQuestion batch felt like the GSD prompt pushing toward human validation — suspected a "ask 3-5 questions" directive in the prompts. Asked to verify.
**Finding:** Confirmed — `commands/gsd2/discuss-phase.md:49,70` mandated "4 questions per area," contradicting both the workflow's anti-pattern list and the file's own "Do NOT ask about technical implementation" rule. `autonomous.md:255/276` carries similar (less harmful, pre-selected) directives.
**Decision:** User chose direct source fix over workaround. Command file edited to adaptive triage-first depth; runtime synced (`npm run dev`); committed as `4b21af1`. autonomous.md alignment deferred to Phase 13.
**Signal:** [STRONG] — explicit instruction, reasoned.

### The four foundation decisions (auto-decided, override offered)
**User's perspective:** "You know better... the end goal and expected feeling did not change" — deferred technical sufficiency to Claude + downstream checkers.
**Decisions:**
- `GSD_RUN_ID` env var as run signal (supersedes research's config-key assumption; parallel-session safety) — [STRONG, specialist-backed]
- Write-once ledger records, no patch command, superseding records for revisions — [STRONG, specialist-backed]
- Out-of-run `ledger append` = loud error exit 1 — [STRONG, specialist-backed]
- `.planning/run/` gitignored (telemetry precedent) — [WEAK, specialist-backed — casual acceptance, explicitly flagged as flippable]
**Signal rationale:** Specialist analysis at HIGH confidence from codebase evidence; user confirmed without elaboration.

### Schema + command surface
**Decision:** Required fields verbatim from roadmap success criterion 1; mailbox schema per ARCHITECTURE.md; Phase 10 ships ledger append/list/filter + mailbox append/list + run init; mailbox review/answer stays Phase 12.
**Signal:** [STRONG] — derived from written success criteria, not preference.

## Established (Not Discussed)
- lesson.cjs/trace.cjs JSONL module pattern, gsd-tools dispatch, zero-deps, orchestrator-level constraints, unit-test conventions.

## Deferred Ideas
- autonomous.md fixed-question-count alignment → Phase 13
- Per-run agent-trace.jsonl isolation → Phase 13
- Two low-score todo matches reviewed, not folded.
