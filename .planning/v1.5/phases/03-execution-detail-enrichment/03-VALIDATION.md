---
phase: 3
slug: execution-detail-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This is a docs-and-wiring phase: validation is **grep/file-existence based** — no test framework.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — grep + `test -f` verification only |
| **Config file** | none |
| **Quick run command** | individual grep/`test -f` commands (see map) |
| **Full suite command** | all commands in the verification map exit 0 |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run the grep/`test -f` command(s) for that task's requirement.
- **After every plan wave:** Run all commands in the verification map.
- **Before `/gsd2:verify-work`:** All verification-map commands must exit 0.
- **Max feedback latency:** ~1 second.

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | Status |
|-----|----------|-----------|-------------------|--------|
| GUIDE-01 | `universal-anti-patterns.md` exists (source tree) | file | `test -f get-shit-done/references/universal-anti-patterns.md` | ⬜ pending |
| GUIDE-01 | `universal-anti-patterns.md` exists (runtime tree) | file | `test -f .claude/get-shit-done/references/universal-anti-patterns.md` | ⬜ pending |
| GUIDE-01 | `common-bug-patterns.md` exists (source tree) | file | `test -f get-shit-done/references/common-bug-patterns.md` | ⬜ pending |
| GUIDE-01 | `common-bug-patterns.md` exists (runtime tree) | file | `test -f .claude/get-shit-done/references/common-bug-patterns.md` | ⬜ pending |
| GUIDE-01 | Verifier eager-loads bug-patterns (source) | grep | `grep -F 'common-bug-patterns.md' get-shit-done/workflows/verify-phase.md` | ⬜ pending |
| GUIDE-01 | Verifier eager-loads bug-patterns (runtime) | grep | `grep -F 'common-bug-patterns.md' .claude/get-shit-done/workflows/verify-phase.md` | ⬜ pending |
| GUIDE-01 | Planner on-demand pointer (source agent) | grep | `grep -F 'universal-anti-patterns.md' agents/gsd-planner.md` | ⬜ pending |
| GUIDE-01 | Planner on-demand pointer (runtime agent) | grep | `grep -F 'universal-anti-patterns.md' .claude/agents/gsd-planner.md` | ⬜ pending |
| GUIDE-02 | `common-bug-patterns.md` has Python section | grep | `grep -F '## Python' get-shit-done/references/common-bug-patterns.md` | ⬜ pending |
| GUIDE-02 | `universal-anti-patterns.md` has Python section | grep | `grep -F '## Python' get-shit-done/references/universal-anti-patterns.md` | ⬜ pending |
| GUIDE-02 | Python typing conventions present | grep | `grep -iE 'typing\|TypedDict\|Optional' get-shit-done/references/universal-anti-patterns.md` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*
*Paths are repo-relative; run from repo root. The dual-tree rule requires BOTH `get-shit-done/` (source) and `.claude/get-shit-done/` (runtime) copies to match.*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no scaffolding needed. This phase creates the docs from scratch; verification is grep/file-existence only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Doc content is high-signal / not bloated | GUIDE-01 | Token-cost/quality is a judgment call (bug-patterns doc is eager-loaded every verify run) | Read `common-bug-patterns.md`; confirm it stays tight (target ≲ the source doc's length + ~20 Python lines) |

---

## Validation Sign-Off

- [ ] All tasks have an automated grep/`test -f` verify
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — none)
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
