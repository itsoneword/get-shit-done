---
phase: 2
slug: autonomous-technical-resolution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> The deliverable is LLM-executed markdown prose wired into workflow/agent files, not callable JS. Tests target structural properties of the modified committed source (`get-shit-done/`, `agents/`) via grep/`node --test`, NOT function invocations. See 02-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node:test (built-in, v22+) — established in this project (Phase 02 agent-spec used it) |
| **Config file** | none — inline via `node --test` |
| **Quick run command** | `node --test tests/02-resolution-loop.test.cjs` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~5 seconds (file reads + grep assertions, no network) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/02-resolution-loop.test.cjs`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Populated by the planner. Each task that modifies a source file maps to a structural assertion against the **committed** copy (`get-shit-done/...`, `agents/...`), never the gitignored `.claude/` runtime mirror.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | RSCH-{0X} | structural | `node --test tests/02-resolution-loop.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/02-resolution-loop.test.cjs` — structural test file covering RSCH-01 / RSCH-02 / RSCH-03:
  - reads `get-shit-done/workflows/discuss-phase.md`: LOW branch contains bounded-iteration resolution-loop logic, not a bare ask-user fallback (RSCH-01, RSCH-02)
  - reads `get-shit-done/workflows/plan-phase.md`: an inline technical-resolution path exists at the orchestrator level (RSCH-02)
  - asserts signal-strength skip logic + write-back tags present (RSCH-03)
  - asserts the loop's heavy/light research runs at orchestrator scope (Task/Skill-bearing), not inside the gsd-planner subagent — guards against the "prose passes but tools can't run" gap (02-RESEARCH.md Pitfall 4)

*Caveat: structural grep proves prose presence, not runtime behavior. The dogfood/integration check (a real plan-phase or discuss-phase run resolving a technical question without asking the human) is the true RSCH-02 signal — see Manual-Only Verifications.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A technical/HYBRID question in a live discuss-phase or plan-phase run resolves autonomously (LOW→HIGH/MEDIUM) without bouncing to the human | RSCH-02 | Requires a live LLM-executed workflow run with a real technical unknown; cannot be asserted by static grep | Run `/gsd2:discuss-phase` or `/gsd2:plan-phase` on a phase with a genuine technical unknown; confirm the loop resolves it and records the decision (with confidence + source) instead of asking |
| Resolved decision is honored downstream and not re-asked | RSCH-03 | End-to-end across two workflow stages | After a resolution, confirm the planner/verifier reads the recorded decision and does not re-open it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
