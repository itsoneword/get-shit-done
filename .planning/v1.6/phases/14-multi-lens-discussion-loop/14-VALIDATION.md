---
phase: 14
slug: multi-lens-discussion-loop
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-12
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node 20+) — established GSD convention |
| **Config file** | none — runner is `scripts/run-tests.cjs` |
| **Quick run command** | `node --test tests/discuss-loop.test.cjs` |
| **Full suite command** | `node scripts/run-tests.cjs` |
| **Estimated runtime** | ~30 seconds (full suite) / ~3 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/discuss-loop.test.cjs`
- **After every plan wave:** Run `node scripts/run-tests.cjs`
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | LOOP-01, LOOP-02 | unit (RED — TC-LENS-*, TC-ORCH-1/2 contracts) | `node --test tests/discuss-loop.test.cjs` (expected red) | ❌ W0 (this task creates it) | ✅ green |
| 14-01-02 | 01 | 1 | LOOP-01, LOOP-02 | unit (GREEN) | `node --test tests/discuss-loop.test.cjs` + `node scripts/run-tests.cjs` | ✅ after 14-01-01 | ✅ green |
| 14-02-01 | 02 | 1 | LOOP-01 | structural grep | `grep -l "tools: Read, Grep, Glob" agents/gsd-lens-*.md \| wc -l` → 3 | ✅ (grep, no test file) | ✅ green |
| 14-02-02 | 02 | 1 | LOOP-01 | structural grep | `grep -q "name: gsd2:discuss-loop" commands/gsd2/discuss-loop.md` | ✅ | ✅ green |
| 14-03-01 | 03 | 2 | LOOP-01, LOOP-02 | structural grep (record types, no-synthesis guardrail, pending status, bifurcation) | grep criteria in 14-03-PLAN Task 1 | ✅ | ✅ green |
| 14-03-02 | 03 | 2 | LOOP-01, LOOP-02 | install + full suite | `npm run dev && node scripts/run-tests.cjs` | ✅ | ✅ green |
| 14-03-03 | 03 | 2 | LOOP-01, LOOP-02 | manual (live smoke, TC-ORCH-interactive) | n/a — human-verify checkpoint | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/discuss-loop.test.cjs` — created as the RED task (14-01-01) of the TDD plan; covers validate / delta / survivors / loop-id / transcript contracts (TC-LENS-1, TC-LENS-carried, TC-ORCH-1, TC-ORCH-2 no-synthesis data layer)
- [x] No framework install needed — `node:test` + `tests/helpers.cjs` already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live lens spawns produce distinct, artifact-grounded positions (TC-LENS-1/2 live half) | LOOP-01 | Requires real Task() spawns of LLM agents — non-deterministic output, not unit-testable | 14-03 Task 3 smoke run: fixture with planted hidden assumption + workflow regression; confirm distinct positions with verbatim anchors |
| Interactive bifurcation: no mailbox write on non-convergence (TC-ORCH-interactive) | LOOP-02 | End-to-end loop requires a live Claude session executing workflow prose | 14-03 Task 3: run without GSD_RUN_ID, compare MAILBOX.jsonl checksums before/after |
| Autonomous escalation end-to-end (TC-ORCH-2 live half) and degraded-round ladder (TC-ORCH-degraded) | LOOP-02 | Requires `--auto` + GSD_RUN_ID harness run; runner wiring is Phase 13/15 territory | Deterministic pieces unit-tested in 14-01 (delta, survivors no-synthesis, mailbox gate in tests/mailbox.test.cjs); full path exercised at runner integration (Phase 15) and at `/gsd2:verify-work` if a run context is available |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies (Task 14-03-03 is an explicit human-verify checkpoint)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (single missing test file is created by the RED task itself)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-12 (planner)
