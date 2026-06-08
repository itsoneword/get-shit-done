---
created: 2026-06-07T13:42:15Z
title: Evaluate SkillOpt-style self-improving skills for GSD
area: research
files:
  - .planning/reference/CODE-EXAMPLES.md
  - agents/
  - commands/gsd2/
---

> **ABSORBED → v1.5 Phase 8** (2026-06-08): Skill Self-Improvement & Validated Example Corpus, scope item 1.
> Details retained below as the source capture; plan via `/gsd2:plan-phase 8`.

## Problem

GSD now has stronger native guidance for artifact authoring, review handling, and
execution discipline, but its "skills" and command guidance are still mostly static.
There is a promising direction in Microsoft's SkillOpt work:

- treat skills/prompts/instructions as artifacts that can improve over time
- learn from real failures and successful executions rather than only one-shot design
- evaluate changes against concrete tasks instead of aesthetic prompt rewrites

This matters even more because example code used in guidance is often LLM-generated.
That is convenient, but weak as a foundation: examples can look plausible while
missing the edge cases, tradeoffs, and style constraints that appear in real
production code.

## Solution

Investigate a GSD-native self-improvement loop for skills/commands/references:

- map where a SkillOpt-like loop fits best in GSD:
  - agent instructions
  - command docs / workflow prompts
  - reference artifacts
- use real execution traces, verifier failures, and revision-loop outcomes as the
  optimization signal instead of hand-wavy "better prompt" judgment
- pair optimization with a curated corpus of validated handwritten examples from
  strong open-source repos, not only synthetic examples
- decide whether this should be:
  - a research-only design note
  - a bounded workflow/command
  - a future milestone seed

Use `.planning/reference/CODE-EXAMPLES.md` as the starting note for the corpus side.
