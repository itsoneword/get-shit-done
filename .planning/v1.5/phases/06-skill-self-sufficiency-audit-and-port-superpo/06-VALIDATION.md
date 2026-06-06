---
phase: 6
slug: skill-self-sufficiency-audit-and-port-superpo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Nature:** Phase 6 edits are exclusively prompt/reference/workflow/agent text files. No executable code, no unit-testable functions. Validation is **structural** (grep / file-exists / load-point assertions), not behavioral — this is the CONTEXT.md TDD agent-change exemption applied to validation itself.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash assertions (`grep -q`, `test -f`) |
| **Config file** | none — no install needed |
| **Quick run command** | `test -f get-shit-done/references/receiving-code-review.md && echo PASS \|\| echo FAIL` |
| **Full suite command** | run all grep/file assertions in the Per-Task Verification Map below |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** `test -f {created-or-edited-file} && echo PASS`
- **After every plan wave:** run all grep/file assertions for that wave's files
- **Before `/gsd2:verify-work`:** full grep suite green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

These are structural assertions (grep/file-exists), keyed to the four ported gaps + the audit. Plan tasks map onto these; the planner fills Task IDs when waves are assigned.

| Behavior | Gap | Test Type | Automated Command |
|----------|-----|-----------|-------------------|
| 14-skill audit table exists, all skills mapped | Audit | grep | `grep -cE "COVERED\|GAP\|N/A" {audit-file}` ≥ 14 |
| tdd.md contains Iron Law | 1 | grep | `grep -qi "no production code without a failing test" get-shit-done/references/tdd.md` |
| tdd.md contains rationalization/red-flag counters | 1 | grep | `grep -qi "too simple to test" get-shit-done/references/tdd.md` |
| tdd.md contains agent/prompt/workflow exemption | 1 | grep | `grep -qiE "agent.*prompt.*workflow\|prompt.*workflow.*reference" get-shit-done/references/tdd.md` |
| gsd-executor `<tdd_execution>` hardened (watch-it-fail) | 1 | grep | `grep -qi "watch.*fail\|STOP before continuing" agents/gsd-executor.md` |
| gsd-planner TDD Detection exemption | 1 | grep | `grep -qi "exempt" agents/gsd-planner.md` |
| receiving-code-review.md created | 2 | file | `test -f get-shit-done/references/receiving-code-review.md` |
| receiving-code-review.md has response pattern + forbidden list | 2 | grep | `grep -qiE "verify before\|you'?re absolutely right" get-shit-done/references/receiving-code-review.md` |
| review.md wired to load the reference | 2 | grep | `grep -q "receiving-code-review" get-shit-done/workflows/review.md` |
| ship.md wired to load the reference | 2 | grep | `grep -q "receiving-code-review" get-shit-done/workflows/ship.md` |
| artifact-authoring guide created | 3 | file | `test -f get-shit-done/references/artifact-authoring.md` |
| artifact-authoring.md has CSO description rule | 3 | grep | `grep -qiE "description.*when\|when to use.*not.*workflow" get-shit-done/references/artifact-authoring.md` |
| git-worktree technique reference created | 4 | file | `test -f get-shit-done/references/git-worktree.md` |
| git-worktree.md has detect-isolation step | 4 | grep | `grep -qE "GIT_COMMON\|GIT_DIR\|detect.*isolation" get-shit-done/references/git-worktree.md` |
| runtime twins exist (source↔runtime mirror) | all | file | `for f in receiving-code-review artifact-authoring git-worktree; do test -f .claude/get-shit-done/references/$f.md \|\| echo MISSING; done` |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

None — no test framework install needed. All validation is grep/file-check assertions runnable immediately after each file is created or edited.

*Existing infrastructure (bash) covers all phase verification.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Ported behavior is actually *exercised* in a plan→execute run with no superpowers skill present (Success Criterion #3) | Requires a representative end-to-end workflow run and human judgment that the agent followed the ported discipline; not reducible to a grep | Run a representative `plan-phase → execute-phase` on a TDD-worthy slice; confirm the executor enforced watch-it-fail and that the review/worktree references loaded at their wiring points, with the superpowers plugin disabled. |
| Faithfulness of each port to its superpowers source | Semantic fidelity (did the port preserve the Iron Law intent, forbidden-response list, technique ordering) needs reading, not pattern-matching | Diff each ported reference against its source SKILL.md; confirm the load-bearing rules survived. |

---

## Validation Sign-Off

- [ ] Every plan task has a structural assertion (grep/file-exists) or is listed under Manual-Only
- [ ] Sampling continuity: no wave of file edits without a verification assertion
- [ ] Source↔runtime mirror verified for all new/edited files
- [ ] Audit artifact maps all 14 skills
- [ ] `nyquist_compliant: true` set in frontmatter once plans bind tasks to these assertions

**Approval:** pending
