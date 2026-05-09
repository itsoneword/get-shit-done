---
created: 2026-03-21T22:21:44.962Z
title: Add user sync checkpoints to plan-phase subagent chains
area: workflows
files:
  - workflows/plan-phase.md
---

## Problem

When running `/gsd2:plan-phase`, after user agrees to research, the entire chain runs fully autonomously — researcher agent, planner agent, and optionally UI-phase — without any user sync points. The user loses visibility and control over what's happening. Even if the results are acceptable, there's no opportunity to course-correct mid-flow.

Key observations:
- Research runs fully autonomously (expected, but no summary shown before planning starts)
- Planning runs fully autonomously after research completes
- UI-phase gets suggested and runs without discussion
- No intermediate checkpoints where user can review progress or redirect

## Solution

Consider adding lightweight sync points between subagent stages in plan-phase:
- After research completes: show key findings summary, confirm before proceeding to planning
- After planning completes: show plan overview before suggesting additional workflows (UI-phase)
- Not full interactive discussions — just brief status syncs so user stays informed and in control
- Could be a setting: `user_sync_checkpoints: true/false` for those who prefer fully autonomous flow
