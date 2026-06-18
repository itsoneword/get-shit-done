---
created: 2026-06-18T00:00:00.000Z
title: ESC-03 live-run confirmation (test-in-prod) — steps 2-3 of the calibration
area: harness
files:
  - .planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CALIBRATION.md
---

## Problem

ESC-03 was marked PASS on 2026-06-18 on the strength of a perfect blind golden-set
score (14/14, 0 misses across all thresholds) plus the static wiring verification
from the v1.6 integration audit. But steps 2-3 of the calibration procedure — a
**live confirmation run** (real `/gsd2:discuss-phase` on a genuine upcoming phase
under `GSD_RUN_ID`) followed by a **ledger review** — were deferred because v1.6
was already complete and no upcoming phase existed at calibration time.

## Follow-up

On the next real project work (expected within a day):

1. Run a real phase under a run-id: `node bin/gsd-tools.cjs run init <run-id>`, then
   `GSD_RUN_ID=<run-id> claude` and run one full `/gsd2:discuss-phase` on a genuine
   upcoming phase. Let the question_triage evaluator resolve >= 5 questions autonomously.
2. Review the populated ledger: `node bin/gsd-tools.cjs ledger list <run-id>` — check
   each `escalation_verdict` / `escalation_reason` against `escalation-contract.md`.
3. Update `11-CALIBRATION.md` Notes/Run ID with the live-run outcome. If any hard miss
   (irreversibility/security park missed) appears, revisit the PASS — the zero-hard-miss
   rule is non-negotiable.

This closes the one un-run portion of the trust ladder before the harness is relied on
for unattended overnight runs.
