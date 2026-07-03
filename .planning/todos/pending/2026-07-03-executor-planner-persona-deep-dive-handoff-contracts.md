---
created: 2026-07-03T15:09:09.716Z
title: Executor+planner persona deep-dive and inter-agent handoff contracts
area: workflows
files:
  - agents/gsd-executor.md
  - agents/gsd-planner.md
  - get-shit-done/workflows/execute-phase.md
  - get-shit-done/workflows/plan-phase.md
depends_on: []
related_to: []
---

## Problem

From the 2026-07-02 usability discussion (user pain point #3, "agent characteristics not optimal"):

1. **Too-generic actions during task assessment/execution.** The user observes agents doing generic assess/execute moves rather than context-specific ones. Needs a joint walkthrough (user + Claude) of what gsd-executor.md and gsd-planner.md actually instruct, to identify which passages produce generic behavior.

2. **Inter-agent context handoffs are not standardized.** Context passed between agents (orchestrator → planner → executor → verifier) is prose-in-markdown with no validated contracts. Only the discuss-loop lens envelopes have mechanical validation (schema + anchor substring checks). The user's framing: if this were LangGraph, each pipeline step would have a tracked, validated contract ensuring the step completed as expected.

## Solution

Session plan (do together with the user, not solo):
- Read gsd-executor.md + gsd-planner.md side by side; list each instruction that is generic ("assess the task", "review context") vs mechanical (greppable rule, threshold, schema).
- Map every handoff (what file/prompt block crosses each agent boundary) and mark which have validation today.
- Sketch a contract layer: per-handoff JSON schema + a gsd-tools `validate-handoff` verb, generalizing the discuss-loop envelope pattern.
- Candidate v1.7 milestone theme. Related: self-audit Topic 3 (instruction quality), lens-protocol dedup rec.
