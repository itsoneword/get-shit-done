---
phase: 13-overnight-runner
plan: "01"
subsystem: ledger/run-cli
tags: [tdd, ledger, run-helpers, morning-report, run-04]
dependency_graph:
  requires: [10-01, 12-01]
  provides: [RUN-04-cli, run-record-phase, run-status, run-report]
  affects: [13-03-overnight-workflow]
tech_stack:
  added: []
  patterns: [tdd-red-green, append-only-jsonl, skip-and-count-reader]
key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/ledger.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - tests/ledger.test.cjs
decisions:
  - "metaFilePath helper kept local to ledger.cjs — no import of park.cjs; ledger stays sibling-free"
  - "readJsonlWithCount is a distinct function from readLedger — report needs the skipped count, existing read helper does not"
  - "cmdRunReport reads exactly three files: RUN-META.json, DECISIONS.jsonl, MAILBOX.jsonl — RUN-04 locked constraint"
  - "run report output is plain text with no '#' heading lines — terminal-friendly, inbox-embeddable"
metrics:
  duration: "~11 minutes"
  completed_date: "2026-06-12"
  tasks_completed: 2
  files_changed: 3
---

# Phase 13 Plan 01: RUN-04 CLI Primitives Summary

RUN-04 CLI half shipped via TDD: `gsd-tools run report <run-id>` renders the morning report from three run artifacts alone, plus `run record-phase` and `run status` give the overnight runner a validated tool boundary for writing phase outcome records and terminal run status.

## What Was Built

**Task 1 — run record-phase + run status (TDD)**

- `cmdRunRecordPhase(cwd, runId, opts)` — appends a validated phase outcome record `{phase, status, worktree, merge_clean, started_ts, ended_ts, reason}` to `RUN-META.json` `phases[]`; preserves all other meta fields; rejects invalid/missing args with exit 1
- `cmdRunStatus(cwd, runId, setValue, reason)` — sets `meta.status` (and `meta.stopped_reason` when `--reason` given); validates against `VALID_RUN_STATUSES`
- Both wired into `case 'run'` switch in `gsd-tools.cjs` following the existing `snapshot` arg-parsing pattern
- `VALID_PHASE_STATUSES = ['completed', 'parked', 'failed']` and `VALID_RUN_STATUSES = ['running', 'complete', 'stopped']` exported

**Task 2 — run report (TDD)**

- `readJsonlWithCount(filePath)` — JSONL reader that returns `{ records, skipped }` — the `skipped` count is what `readLedger` silently discards; needed for the report's "N unparseable entries skipped" line
- `cmdRunReport(cwd, runId)` — reads exactly three files (RUN-META.json, DECISIONS.jsonl, MAILBOX.jsonl), computes counts (decisions, escalated, unanswered/answered questions, phase statuses), renders plain-text morning report; skips-and-counts corrupt JSONL lines; never crashes on empty or malformed data
- Output format: `=== Morning Report: <run-id> ===` header, Started/Status, Phases block with "none recorded" fallback, Decisions line, Mailbox line with unanswered questions listed, `N unparseable entries skipped` (only when > 0), `Review with: /gsd2:inbox <run-id>` footer
- `case 'report':` added to `case 'run'` switch

## Test Coverage

7 test cases for `run record-phase`, 4 for `run status`, 7 for `run report` — all in `tests/ledger.test.cjs`. Full suite: 32/32 pass; zero new regressions (pre-existing 24 failures are unrelated to this plan).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `get-shit-done/bin/lib/ledger.cjs` contains `function cmdRunReport(`, `function cmdRunRecordPhase(`, `function cmdRunStatus(`, `function readJsonlWithCount(` — confirmed
- `get-shit-done/bin/gsd-tools.cjs` contains `case 'record-phase':`, `case 'status':`, `case 'report':` — confirmed
- `tests/ledger.test.cjs` contains `describe('run report'`, `describe('run record-phase'`, `describe('run status'` — confirmed
- Commits: `4593cbc`, `ca23c4b`, `54f2fd6`, `b4211dc` — all present in worktree history
- `cmdRunReport` contains `unparseable entries skipped`, `Unanswered questions`, `Review with: /gsd2:inbox`, `=== Morning Report:` — confirmed
- No `writeLedger`-style rewrite of DECISIONS.jsonl or MAILBOX.jsonl introduced — confirmed (writeFileSync calls in ledger.cjs touch only RUN-META.json paths)
