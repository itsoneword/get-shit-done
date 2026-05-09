---
phase: 2
slug: agent-spec
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing project test framework) |
| **Config file** | `jest.config.cjs` (existing) |
| **Quick run command** | `npx jest --testPathPattern agent-spec` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern agent-spec`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SPEC-01 | unit | `npx jest --testPathPattern agent-spec-template` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | SPEC-02 | unit | `npx jest --testPathPattern agent-researcher` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | SPEC-03 | unit | `npx jest --testPathPattern agent-checker` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | SPEC-04 | unit | `npx jest --testPathPattern test-contract` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 1 | SPEC-05 | manual | N/A — reference doc review | N/A | ⬜ pending |
| 02-06-01 | 06 | 2 | SPEC-06 | unit | `npx jest --testPathPattern init-agent-spec` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/agent-spec-template.test.cjs` — stubs for SPEC-01 template structure validation
- [ ] `tests/agent-researcher.test.cjs` — stubs for SPEC-02 researcher behavior
- [ ] `tests/agent-checker.test.cjs` — stubs for SPEC-03 checker dimensions
- [ ] `tests/test-contract.test.cjs` — stubs for SPEC-04 TEST-SPEC compatibility
- [ ] `tests/init-agent-spec.test.cjs` — stubs for SPEC-06 init.cjs integration

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Topology pattern catalog content accuracy | SPEC-05 | Reference document review — content quality, not code behavior | Review topology-patterns.md for completeness: all 6 patterns documented, each has description, tradeoffs, failure modes, real examples |
| Researcher consultant character quality | SPEC-02 | Conversational behavior emerges at runtime | Run discuss-phase on a test agentic phase, verify researcher pushes back on overcomplicated choices and educates on tradeoffs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
