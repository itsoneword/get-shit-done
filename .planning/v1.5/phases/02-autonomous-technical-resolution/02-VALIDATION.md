---
phase: 2
slug: autonomous-technical-resolution
status: draft
nyquist_compliant: true
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

> Each task that modifies a source file maps to a structural assertion against the **committed** copy (`get-shit-done/...`, `agents/...`), never the gitignored `.claude/` runtime mirror.
> NOTE: the Wave 0 test (Plan 01) intentionally leaves the RSCH-02/RSCH-03 wiring groups RED until Plans 02/03 run. A task is "green" when its own group passes — not the whole suite.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Group expected green after | Status |
|---------|------|------|-------------|-----------|-------------------|---------------------------|--------|
| 02-01-01 | 01 | 1 | RSCH-01 | structural | `grep -c iterations_used get-shit-done/references/resolution-loop.md` | this task | ⬜ pending |
| 02-01-02 | 01 | 1 | RSCH-01 | structural | `node --test tests/02-resolution-loop.test.cjs` (RSCH-01 group) | this task | ⬜ pending |
| 02-02-01 | 02 | 2 | RSCH-03 | structural | `grep -c 'Signal-strength pre-check' get-shit-done/workflows/discuss-phase.md` | this task | ⬜ pending |
| 02-02-02 | 02 | 2 | RSCH-01, RSCH-02, RSCH-03 | structural | `node --test tests/02-resolution-loop.test.cjs` (RSCH-02 discuss-phase + RSCH-03 skip groups) | this task | ⬜ pending |
| 02-03-01 | 03 | 2 | RSCH-02 | structural | `grep -c 'TECHNICAL UNKNOWN' agents/gsd-planner.md` + Pitfall-4 negative (`grep -c 'Task(' agents/gsd-planner.md` == 0) | this task | ⬜ pending |
| 02-03-02 | 03 | 2 | RSCH-02, RSCH-03 | structural | `node --test tests/02-resolution-loop.test.cjs` (RSCH-02 plan-phase group, incl. Pitfall-4 negative) | this task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/02-resolution-loop.test.cjs` — structural test file covering RSCH-01 / RSCH-02 / RSCH-03 (created in Plan 01):
  - reads `get-shit-done/workflows/discuss-phase.md`: LOW branch contains bounded-iteration resolution-loop logic, not a bare ask-user fallback (RSCH-01, RSCH-02)
  - reads `get-shit-done/workflows/plan-phase.md`: an inline technical-resolution path exists at the orchestrator level with a Task-spawned research call (RSCH-02)
  - reads `agents/gsd-planner.md`: surfaces a distinct `## TECHNICAL UNKNOWN` return AND **does NOT** contain a research Task-spawn (the Pitfall-4 negative discriminator — guards against a loop buried where its tools can't run)
  - asserts signal-strength skip logic present (RSCH-03)
  - does NOT assert CONTEXT.md write-back tags (those are manual/dogfood — see Manual-Only)

*Caveat: structural grep proves prose presence + correct placement, not runtime behavior. The dogfood/integration check (a real plan-phase or discuss-phase run resolving a technical question without asking the human, and recording the decision) is the true RSCH-02/RSCH-03 signal — see Manual-Only Verifications.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A technical/HYBRID question in a live discuss-phase or plan-phase run resolves autonomously (LOW→HIGH/MEDIUM) without bouncing to the human | RSCH-02 | Requires a live LLM-executed workflow run with a real technical unknown; cannot be asserted by static grep | Run `/gsd2:discuss-phase` or `/gsd2:plan-phase` on a phase with a genuine technical unknown; confirm the loop resolves it and records the decision (with confidence + source) instead of asking |
| Resolved decision is written back to CONTEXT.md with a `[STRONG/WEAK, specialist-backed]` tag + confidence + source | RSCH-03 | Write-back only happens during a live run; asserting the tag statically authors a permanently-RED test | After a resolution, confirm CONTEXT.md `<decisions>` gained a `<!-- resolved inline by resolution loop -->` entry with the tag |
| Resolved decision is honored downstream and not re-asked | RSCH-03 | End-to-end across two workflow stages | After a resolution, confirm the planner/verifier reads the recorded decision and does not re-open it |

---

## Validation Sign-Off

- [x] All tasks have `<verify>` / `<acceptance_criteria>` or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tests/02-resolution-loop.test.cjs created in Plan 01)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner-populated 2026-06-04)
