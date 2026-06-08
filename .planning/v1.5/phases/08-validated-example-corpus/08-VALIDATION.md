---
phase: 8
slug: validated-example-corpus
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-08
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

This phase ships **reference documents + a `gsd-planner.md` prompt edit**. Per the
TDD Agent/Prompt/Workflow/Reference Exemption (`tdd.md`), no TDD plans are required —
behavior is not unit-testable. Validation is **structural shell checks** that live in
each plan's `must_haves.truths[].verify[]` blocks, not a test framework.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — structural shell checks (`test`, `grep`, glob loops) |
| **Config file** | none |
| **Quick run command** | `bash .planning/v1.5/phases/08-validated-example-corpus/checks.sh` (or run the verify lines inline) |
| **Full suite command** | same — structural checks are fast and complete |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run that task's structural verify line(s)
- **After every plan wave:** Re-run all corpus structural checks
- **Before `/gsd2:verify-work`:** All structural checks must pass
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (assigned by planner) | — | — | ROADMAP SC1–3 | structural | `test -f .../INDEX.md`; front-matter grep; `grep -q 'validated-examples/INDEX.md' agents/gsd-planner.md` | ❌ W0 (created this phase) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- None — no test framework needed. All validations are shell commands (`test`, `grep`, glob loops) embedded directly in `must_haves.truths[].verify[]`.

*Existing references mechanism + install propagation cover all phase requirements.*

---

## Structural Validations (the substantive checks)

| What to verify | Command | Type |
|----------------|---------|------|
| INDEX.md exists and is non-empty | `test -f get-shit-done/references/validated-examples/INDEX.md && test -s get-shit-done/references/validated-examples/INDEX.md` | unit |
| Every entry file has required front matter (`pattern_id`, `counters`, `license`) | `for f in get-shit-done/references/validated-examples/*.md; do grep -q 'pattern_id:' "$f" && grep -q 'counters:' "$f" && grep -q 'license:' "$f" || echo "MISSING: $f"; done` | unit |
| `pattern_id`s in INDEX map to real entry files | glob check — each INDEX row's file path exists | unit |
| gsd-planner.md contains the validated-examples pointer | `grep -q 'validated-examples/INDEX.md' agents/gsd-planner.md` | unit |
| Runtime copy propagated by install | `test -d .claude/get-shit-done/references/validated-examples` | integration |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Excerpts are short, attributed, accurate to source | ROADMAP SC1 | Quotation-fidelity & licensing judgment not scriptable | Spot-check each entry's excerpt against its cited permalink/line range; confirm license tag matches source repo |
| Commentary states what it solves + what NOT to cargo-cult | ROADMAP SC1 | Editorial quality not grep-checkable | Read each entry; confirm both clauses present and substantive |
| `counters:` values are exact `common-bug-patterns.md` section titles | ROADMAP SC3 (Phase 9 join) | Semantic match to canonical vocabulary | Cross-check each `counters:` value against actual `## ` headers in `common-bug-patterns.md` |

---

## Validation Sign-Off

- [x] All tasks have structural verify commands or are Wave 0 (none needed)
- [x] Sampling continuity: structural checks run per task
- [x] Wave 0 covers all MISSING references (none — corpus is created this phase)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-08
