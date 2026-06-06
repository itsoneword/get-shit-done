# Phase 6: 14-Skill Coverage Audit

**Purpose:** Map each of the 14 superpowers skills to existing GSD coverage or a concrete port target, so the superpowers plugin can be dropped without capability loss. Rows are derived from direct inspection of the GSD file tree, agent files, workflow files, and reference docs — not inferred from names. Each skill maps to one of three verdicts: COVERED (GSD already has a mechanism delivering this capability), GAP n (a real capability gap — ported in this phase), or N/A (not applicable — the skill was a plugin meta-skill).

**Date:** 2026-06-06

---

## Coverage Table

| # | superpowers skill | GSD coverage | Verdict | Notes |
|---|-------------------|--------------|---------|-------|
| 1 | brainstorming | discuss-phase (explore-options, signal-strength tagging) | COVERED | — |
| 2 | writing-plans | plan-phase + gsd-planner agent | COVERED | — |
| 3 | executing-plans | execute-plan + gsd-executor agent | COVERED | — |
| 4 | subagent-driven-development | wave-based parallel executor spawning | COVERED | — |
| 5 | dispatching-parallel-agents | execute-phase wave→gsd-executor spawning | COVERED | — |
| 6 | verification-before-completion | gsd2:verify-work + gsd-verifier + must_haves | COVERED | — |
| 7 | requesting-code-review | gsd2:review → REVIEWS.md (cross-AI external CLIs) | COVERED | producer side only |
| 8 | finishing-a-development-branch | gsd2:ship + pr-branch workflow | COVERED | — |
| 9 | systematic-debugging | gsd-debugger: hypothesis→test→root-cause-before-fix, persistent debug session | COVERED | verified this session; no port needed |
| 10 | using-superpowers | plugin meta-skill — irrelevant once plugin disabled | N/A | — |
| 11 | test-driven-development | tdd.md + gsd-executor `<tdd_execution>` — plan-time only; execution-time discipline absent | GAP 1 | port: Iron Law + watch-it-fail + rationalization/red-flags + agent-change exemption |
| 12 | receiving-code-review | no consumer-side reference exists; only REVIEWS.md producer | GAP 2 | port: verify-before-implement, no performative agreement, YAGNI check, push-back rules |
| 13 | writing-skills | no GSD-authoring guide exists; artifact decisions left implicit | GAP 3 | port: CSO rule, when-to-create, loophole-closing, one-good-example |
| 14 | using-git-worktrees | no technique reference exists; Phase 7 will need it for parallelization | GAP 4 | port: detect-isolation, native-first, git-fallback, ignore-check, baseline test, sandbox-fallback |

---

## Verdict Summary

- **9 COVERED** — brainstorming, writing-plans, executing-plans, subagent-driven-development, dispatching-parallel-agents, verification-before-completion, requesting-code-review (producer side), finishing-a-development-branch, systematic-debugging
- **1 N/A** — using-superpowers (plugin meta-skill; inapplicable once plugin disabled)
- **4 GAPs ported in Phase 6:**
  - GAP 1 (test-driven-development): execution-time Iron Law + watch-it-fail + rationalization table + red flags + agent/prompt/workflow/reference exemption — ported by plan 06-01 (edits to `get-shit-done/references/tdd.md`, `agents/gsd-executor.md`, `agents/gsd-planner.md`, `get-shit-done/workflows/execute-plan.md`)
  - GAP 2 (receiving-code-review): verify-before-implement, no performative agreement, YAGNI check, push-back rules — ported by plan 06-02 (`get-shit-done/references/receiving-code-review.md` + wiring in `review.md` and `ship.md`)
  - GAP 3 (writing-skills → artifact-authoring): CSO rule, when/when-not-to-create, authoring discipline, GSD form-factor decision — ported by plan 06-03 (`get-shit-done/references/artifact-authoring.md`)
  - GAP 4 (using-git-worktrees → git-worktree technique): detect-isolation, native-first, git fallback, ignore-check, baseline test, sandbox fallback — ported by plan 06-03 (`get-shit-done/references/git-worktree.md`)

Each gap's port target is delivered by plans 06-01, 06-02, and 06-03 respectively. With these four ports complete, GSD is self-contained: the superpowers plugin can be fully disabled without losing the capabilities it provided.
