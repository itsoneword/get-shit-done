---
phase: 4
slug: agent-observability-telemetry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` §Validation Architecture. The planner fills the task map once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in `node --test`) — Jest is not a project dependency (see STATE.md Phase 02 decision) |
| **Config file** | none — node:test needs no config |
| **Quick run command** | `node --test test/<telemetry-test>.js` |
| **Full suite command** | `node --test test/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched test file
- **After every plan wave:** Run the full suite
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

> Filled by the planner. Note: the two empirical unknowns (runtime `tool_name` = "Task" vs "Agent"; `tool_response` shape) are **Wave-0 empirical-confirmation tasks**, not unit tests — they require a throwaway echo-stdin hook run against a real spawn, captured to a fixture. Downstream scraper/parse tests consume that fixture.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| _TBD by planner_ | | 0 | OBS-01/02 | empirical fixture capture | `node --test test/...` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Empirical hook-payload fixture** — a no-matcher debug hook captures the real stdin JSON for an `Agent`/`Task` spawn (resolves `tool_name` string + `tool_response` shape). Saved as a test fixture.
- [ ] Confidence-scraper unit tests asserting both literal strings parse: `**Confidence:** HIGH` (prose) and `"confidence": "HIGH"` (JSON), plus a null case.
- [ ] node:test reachable (no install needed — built-in).

*The scraper/schema implementation MUST NOT precede Wave-0 fixture capture (per RESEARCH.md — two empirical unknowns gate the scraper).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hook fires on a real subagent spawn end-to-end in live Claude Code | OBS-01 | Hook execution requires the live Claude Code runtime; not reproducible in node:test | Run a GSD command that spawns a gsd-* agent; confirm a line appended to `.planning/telemetry/agent-trace.jsonl` |
| LOW→re-research correlation visible across two spawns | OBS-02 | Requires the live resolution loop to actually re-spawn | Trigger a LOW-confidence resolution; grep the log for two correlated entries with confidence LOW then HIGH/MEDIUM |
| Clean degradation in a runtime without hook support | OBS-02 (SC#3) | Copilot/Gemini runtimes unavailable in CI | Confirm hook absence causes no error; run never blocks |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the empirical hook-payload fixture)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
