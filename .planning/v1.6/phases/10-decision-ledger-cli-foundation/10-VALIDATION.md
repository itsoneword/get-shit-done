---
phase: 10
slug: decision-ledger-cli-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-11
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node built-in, no config file) |
| **Config file** | none — runner is `scripts/run-tests.cjs` |
| **Quick run command** | `node scripts/run-tests.cjs 2>&1 \| grep -iE 'pass\|fail\|ledger\|mailbox'` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (full suite, ~960 tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | LEDGER-01, LEDGER-02, LEDGER-03 | unit (RED) | `node scripts/run-tests.cjs 2>&1 \| grep -iE 'ledger\|run init'; node --test tests/ledger.test.cjs 2>&1 \| tail -5` | ❌ W0 (task creates tests/ledger.test.cjs) | ⬜ pending |
| 10-01-02 | 01 | 1 | LEDGER-01, LEDGER-02, LEDGER-03 | unit (GREEN) | `npm test 2>&1 \| tail -15` | ✅ tests/ledger.test.cjs | ⬜ pending |
| 10-02-01 | 02 | 2 | LEDGER-01, LEDGER-02, LEDGER-03 | unit (RED) | `node --test tests/mailbox.test.cjs 2>&1 \| tail -5` | ❌ W0 (task creates tests/mailbox.test.cjs) | ⬜ pending |
| 10-02-02 | 02 | 2 | LEDGER-01, LEDGER-02, LEDGER-03 | unit (GREEN) | `npm test 2>&1 \| tail -15` | ✅ tests/mailbox.test.cjs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Both plans are TDD. The RED task in each plan creates the test file the GREEN task makes pass; "File Exists ❌ W0" means the test file is authored by that task itself, not pre-existing.*

---

## Wave 0 Requirements

- [ ] `tests/ledger.test.cjs` — covers LEDGER-01, LEDGER-02, LEDGER-03 (authored by task 10-01-01, model: `tests/lesson.test.cjs`)
- [ ] `tests/mailbox.test.cjs` — covers mailbox append + list (authored by task 10-02-01, model: `tests/lesson.test.cjs`)
- [ ] `tests/helpers.cjs` — `env` forwarding option added by task 10-01-01

*No framework install needed — node:test is built in and `npm test` / `scripts/run-tests.cjs` already exist.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

The smoke-test commands in each plan's `<verification>` block (e.g. `gsd-tools run init … && GSD_RUN_ID=… gsd-tools ledger/mailbox append …`) are optional confirmations; the corresponding behaviors are already covered by the unit tests above.

---

## Validation Sign-Off

- [x] All tasks have an automated verify command (or are the Wave 0 task that authors the test)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test files authored by the RED tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-11
