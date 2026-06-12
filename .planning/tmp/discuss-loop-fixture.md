# Planning Context — GSD Daily Workflow

## Overview

This document describes the standard operating model for GSD-assisted development sessions.
All sessions begin with a morning review, proceed through planning, and end with an execution
phase. Every developer is expected to follow this sequence without deviation.

## Session Initialization

Before any work begins, the developer must initialize a run context by setting GSD_RUN_ID
in every session. This identifier links all decisions, phases, and ledger entries for the
session to a single auditable run. Without GSD_RUN_ID set in every session, decisions will
not be recorded and the ledger will be incomplete.

## Discussion Phase

During the discussion phase, every question is re-asked at each phase boundary to ensure
the planning context reflects current understanding. Decisions made in earlier phases are
re-evaluated at each new phase to catch any drift. This ensures maximum freshness of
decision context, though it does add re-discussion overhead at each transition.

## Planning Phase

Plans are generated after the discussion phase completes. Each plan references the current
CONTEXT.md. Plans are considered stable once approved.

## Execution Phase

Execution agents receive a plan and execute tasks atomically. Each task commit references
the plan. Verification gates run after each wave. The execution agent may not modify the
plan — if a task is impossible as written, the agent must stop and surface the blocker.

## Success Criteria

A phase is complete when all plan tasks have been committed, the test suite passes, and the
SUMMARY.md has been written and committed. The human reviews the SUMMARY before the phase
is marked done in ROADMAP.md.
