---
phase: 1
slug: domain-router
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in assertions (existing pattern from tests/*.test.cjs) |
| **Config file** | none — tests run directly via node |
| **Quick run command** | `node tests/*.test.cjs 2>&1` |
| **Full suite command** | `node tests/*.test.cjs 2>&1` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tests/*.test.cjs 2>&1`
- **After every plan wave:** Run `node tests/*.test.cjs 2>&1`
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DRTR-01 | manual behavioral | Run discuss-phase on agentic phase, verify "Detected: Agentic" line | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | DRTR-02 | manual behavioral | Inspect discuss-phase output for "Detected:" line with evidence signals | N/A | ⬜ pending |
| 01-01-03 | 01 | 1 | DRTR-03 | manual behavioral | Run discuss-phase on ambiguous phase, verify generic fallback | N/A | ⬜ pending |
| 01-02-01 | 02 | 1 | DRTR-04 | manual behavioral | Run plan-phase after discuss-phase for UI phase, verify no keyword grep gate | N/A | ⬜ pending |
| 01-02-02 | 02 | 1 | DRTR-05 | manual behavioral | Run discuss-phase on UI+agentic phase, verify both domains triggered | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — domain router changes are to markdown workflow files, verified by behavioral testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agentic domain detection | DRTR-01 | LLM-orchestrated workflow, not unit-testable | Run `/gsd2:discuss-phase` on a phase with agentic signals, verify "Detected: Agentic" in output |
| Classification evidence display | DRTR-02 | Output format is LLM-generated | Verify "Detected:" line includes signal evidence list |
| Generic fallback on ambiguous | DRTR-03 | LLM classification decision | Run discuss-phase on generic phase, verify no domain prompt |
| UI-SPEC gate uses CONTEXT.md | DRTR-04 | Workflow integration test | Run plan-phase after discuss-phase for UI phase, verify artifact check replaces keyword grep |
| Multi-domain activation | DRTR-05 | LLM multi-signal classification | Run discuss-phase on phase with both UI and agentic signals, verify both workflows trigger |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
