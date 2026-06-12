---
phase: 13
slug: overnight-runner
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-12
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node 20+) — no external test framework |
| **Config file** | none — runner is `scripts/run-tests.cjs` via `npm test` |
| **Quick run command** | `node --test tests/ledger.test.cjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | quick ~5s; full suite ~60–90s |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/ledger.test.cjs` (covers the run report / record-phase / status surface this phase adds)
- **After every plan wave:** Run `npm test` (full suite — guards ledger/mailbox/park/worktree regressions)
- **Before `/gsd2:verify-work`:** Full suite must be green AND the 13-03 Task 3 seeded smoke must have produced matching report counts
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | RUN-04 | unit (TDD) | `node --test tests/ledger.test.cjs` (describe: run record-phase, run status) | ❌ W0 — authored in RED step of this task | ⬜ pending |
| 13-01-02 | 01 | 1 | RUN-04 | unit (TDD, TC-5) | `node --test tests/ledger.test.cjs` (describe: run report) + `npm test` | ❌ W0 — authored in RED step of this task | ⬜ pending |
| 13-02-01 | 02 | 1 | RUN-01 | structural grep | `grep -q "PHASE RESULT:" get-shit-done/workflows/autonomous.md && grep -q 'discuss-phase", args="${PHASE_NUM} --auto"' get-shit-done/workflows/autonomous.md` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 1 | RUN-01 | structural grep | `grep -q "never AskUserQuestion" get-shit-done/workflows/autonomous.md && grep -q "reason=gaps_found" get-shit-done/workflows/autonomous.md` | ✅ | ⬜ pending |
| 13-02-03 | 02 | 1 | RUN-01 | structural grep | `! grep -q "3-4 grey areas" get-shit-done/workflows/autonomous.md && grep -q -- "--phase N" commands/gsd2/autonomous.md` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 2 | RUN-01, RUN-02, RUN-03 | structural grep (TC-1/2/3/6) | 16-token vocabulary loop + `grep -q 'grep -q "PASS"' get-shit-done/workflows/overnight.md` + clean-field check greps (see plan verify block) | ✅ (file created by task) | ⬜ pending |
| 13-03-02 | 03 | 2 | RUN-04 | structural grep | `grep -q "run_report_header" get-shit-done/workflows/inbox.md && grep -q "gsd2:overnight" commands/gsd2/overnight.md` | ✅ | ⬜ pending |
| 13-03-03 | 03 | 2 | RUN-01..04 | integration smoke (TC-5 end-to-end) | seeded `run init → ledger/mailbox append → record-phase → status → run report` against `.claude/` runtime binary; `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] **Empirical Wave-0 (roadmap success criterion 4) — COMPLETE before planning:** headless session lifespan (W0-1), `bypassPermissions` behavior (W0-2), auth failure surface (W0-3), `--max-turns` (W0-4), and the user constraint record + live ask-rule auto-deny probe (W0-5, probed 2026-06-12) are recorded in `13-RESEARCH.md` and locked into `13-CONTEXT.md` decisions. No scheduling logic precedes this record.
- [ ] `tests/ledger.test.cjs` — new describe blocks (run report, run record-phase, run status) are authored in the RED step of plan 13-01 Tasks 1–2; no separate Wave 0 scaffold task needed (test file and helpers already exist).

Otherwise: existing infrastructure (node:test + tests/helpers.cjs `runGsdTools`/`createTempProject`) covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full unattended overnight run end-to-end | RUN-01 | Workflow prose driving a live multi-hour Claude session cannot be unit-tested; first real run is the trust-ladder step itself | After ESC-03 calibration shows the PASS token: launch `claude -p "/gsd2:overnight --from <N>"` on an evening with remaining phases; next morning check `.planning/run/<run-id>/run.log` reads linearly (RUN_START → HEALTH_PASS → PHASE_* → RUN_COMPLETE/RUN_STOP) and `/gsd2:inbox <run-id>` opens with the report header |
| Live merge-conflict routing (TC-2 full) | RUN-02 | Requires a seeded conflicting worktree branch during a real run | Create branch `overnight-phase-<N>` with a deliberate conflict vs main; run the runner's merge step; confirm MAILBOX.jsonl gains a pending entry with conflict_files and run.log has `CONFLICT_ROUTED phase=<N> q=q-NNN` |
| Auth-failure hard stop (TC-3 live) | RUN-03 | Needs a real auth error mid-run | In a throwaway env, unset auth and trigger a phase invocation; confirm `AUTH_FAILURE` then `RUN_STOP` in run.log with no subsequent `PHASE_START` |
| Park bifurcation under the runner (TC-4) | RUN-01 | Depends on a real park-and-ask verdict from a live discuss-phase --auto | During the first supervised run, confirm a parked phase yields `PHASE RESULT: parked` + `PHASE_PARKED` line + pending mailbox entry + skip-to-independent continuation |
| ESC-03 fail-closed gate (TC-1 live) | RUN-03 | The gate is social — the human writes the token | With 11-CALIBRATION.md still in PENDING state (zero uppercase tokens), launch `/gsd2:overnight`; confirm HEALTH_FAIL + RUN_STOP and no PHASE_START |

---

## Validation Sign-Off

- [x] All tasks have `<verify>` commands or Wave 0 dependencies (13-01 tests authored in RED steps)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task carries a grep/test command)
- [x] Wave 0 covers all MISSING references (only the 13-01 RED-phase test blocks; empirical Wave-0 already complete)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready — pending execution
