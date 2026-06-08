---
phase: 9
slug: skillopt-style-self-improving-skills
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node-based custom runner (`scripts/run-tests.cjs` over `tests/*.test.cjs`) |
| **Config file** | none — runner discovers `tests/*.test.cjs` |
| **Quick run command** | `node scripts/run-tests.cjs <pattern>` (e.g. `lesson`) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/run-tests.cjs <relevant-pattern>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | TEACH-03/01/04 | unit (RED) | `node scripts/run-tests.cjs lesson` | ❌ W0 (this task creates it) | ⬜ pending |
| 09-01-02 | 01 | 1 | TEACH-03 | unit (GREEN) | `node scripts/run-tests.cjs lesson` | ✅ (after 09-01-01) | ⬜ pending |
| 09-01-03 | 01 | 1 | TEACH-01/04 | unit (GREEN) | `node scripts/run-tests.cjs lesson` then `npm test` | ✅ (after 09-01-01) | ⬜ pending |
| 09-02-01 | 02 | 2 | TEACH-01/05 | structural grep | `grep -q "lesson attribute\|20 lines\|npm run dev\|git revert\|y/N\|gsd-local-patches" get-shit-done/workflows/teach.md` | ❌ W0 (this task creates it) | ⬜ pending |
| 09-02-02 | 02 | 2 | TEACH-01 | structural grep | `grep -q "name: gsd2:teach" commands/gsd2/teach.md` | ❌ W0 (this task creates it) | ⬜ pending |
| 09-02-03 | 02 | 2 | TEACH-02/05 (SC2+SC3) | manual checkpoint | human-verify (see Manual-Only Verifications) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lesson.test.cjs` — failing stubs for the lessons-ledger CLI (`gsd-tools lesson` append/list/recurrence/disposition) before `lib/lesson.cjs` exists
- [ ] Any shared fixture for a sample `agent-trace.jsonl` if attribution logic is unit-tested

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real lesson lands as a committed, ratified, bounded edit to the correct `get-shit-done/` source file | SC3 | Requires human ratification of a proposed diff — the gate is non-automatable by design | Run `/gsd2:teach` against a real observed failure; confirm the proposed target + diff; verify the commit touches only `get-shit-done/` source and the ledger records the commit hash |
| Nothing touches `get-shit-done/` source without ratification | SC2 | The "no auto-apply" guarantee is a negative behavioral property best confirmed by inspection | Decline a proposed edit; verify no source file changed and the ledger disposition is `rejected` |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-06-08 — map derived from 09-01/09-02 task breakdown; all tasks have automated verify or are the explicit Wave-0 creator; 09-02-03 is the manual ratify-gate checkpoint (SC2/SC3, non-automatable by design)
