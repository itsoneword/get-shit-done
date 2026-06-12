---
phase: 12-park-don-t-block-mailbox
plan: "03"
subsystem: agentic-workflows
tags: [park-dont-block, mailbox, inbox, discuss-phase, autonomous-harness]
dependency_graph:
  requires: [12-01, 12-02]
  provides: [PARK-01-trigger, PARK-02-skill, PARK-03-staleness-surface]
  affects: [discuss-phase.md, /gsd2:inbox command]
tech_stack:
  added: []
  patterns: [command-stub-plus-workflow, discussion-not-form]
key_files:
  created:
    - commands/gsd2/inbox.md
    - get-shit-done/workflows/inbox.md
  modified:
    - get-shit-done/workflows/discuss-phase.md
decisions:
  - "Interactive sessions (no --auto) ask the human directly — Phase 11 behavior preserved byte-for-byte"
  - "Autonomous context (--auto + GSD_RUN_ID): mailbox append (pending) + park create + PHASE PARKED halt"
  - "PHASE PARKED block uses indented markdown (not a nested fence) to avoid fence-collision with surrounding bash blocks"
  - "/gsd2:inbox is a discussion skill, not a form — recommendation + pushback + iterate until settled"
  - "Runtime (.claude/) is gitignored; task 3 sync verified via file checks, not committed"
metrics:
  duration_minutes: 25
  completed_date: "2026-06-12"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
  files_created: 2
requirements: [PARK-01, PARK-02, PARK-03]
---

# Phase 12 Plan 03: Wire Parking Primitives + /gsd2:inbox Skill Summary

**One-liner:** Park-and-ask verdict bifurcated in discuss-phase (interactive unchanged; autonomous writes mailbox+snapshot, halts PHASE PARKED) and thin /gsd2:inbox discussion skill ships (resolve_run → load_questions → present_and_discuss with inline staleness → INBOX SESSION COMPLETE).

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Splice park branch into discuss-phase question_triage | d85b49e | get-shit-done/workflows/discuss-phase.md |
| 2 | Create /gsd2:inbox thin skill (command stub + workflow) | fc2d9f4 | commands/gsd2/inbox.md, get-shit-done/workflows/inbox.md |
| 3 | Sync runtime and verify zero regression | (no commit — .claude/ gitignored) | (runtime verified: all three files present) |

## What Was Built

### Task 1: discuss-phase.md park branch

Replaced the Phase 11 placeholder step 5 in `question_triage`'s escalation evaluator with a bifurcated branch:

- **Interactive (no `--auto`):** ask the human directly — Phase 11 behavior preserved unchanged.
- **Autonomous (`--auto` + `GSD_RUN_ID`):** 3-step halt sequence:
  1. `mailbox append --data '{...,"status":"pending"}'` — captures q-NNN id
  2. `park create --phase <N> --question <q-NNN> --blocked-at "discuss-phase --auto: question_triage" --resume "..." --phase-dir ... --context-path ...`
  3. Return structured `## PHASE PARKED` block (phase, q-NNN, snapshot path, why) — stops immediately, no CONTEXT.md finalization, no plan-phase advance, no mailbox polling.

The PHASE PARKED block is rendered as indented markdown rather than a nested fenced block to avoid fence-collision with the surrounding bash blocks — the plan explicitly allowed formatting adaptation.

### Task 2: /gsd2:inbox skill

Two files per the command-stub convention:

**`commands/gsd2/inbox.md`** — thin stub with frontmatter (`name: gsd2:inbox`, `argument-hint: "[run-id]"`, `allowed-tools`), `execution_context` pointing at `@~/.claude/get-shit-done/workflows/inbox.md`, and a `<process>` block.

**`get-shit-done/workflows/inbox.md`** — four-step workflow prose:
- `resolve_run`: arg > GSD_RUN_ID env > directory scan (exact-one auto-select, multiple = ask with pending counts, none = stop)
- `load_questions`: `mailbox list --raw` → parse JSONL; unanswered = status !== 'answered' (both pending + open); zero unanswered = inbox-zero report + stop
- `present_and_discuss`: for each question — question text, phase, why-parked context, options, evidence, decision_id; staleness check via `park staleness` if snapshot exists; discussion (recommendation + iterate); AskUserQuestion for discrete options; skip/defer left pending; on settled answer: `mailbox answer` → surface CLI output verbatim
- `session_summary`: `## INBOX SESSION COMPLETE` table + resume handoffs block + "NOT resumed by this skill" notice

Rule block forbids: DECISIONS.jsonl writes, planning file edits, marking answered without explicit settled answer, hardcoding decision-type-only assumptions (triage entries come in Phase 15).

### Task 3: Runtime sync

`npm run dev` synced source to `.claude/` without errors (build:hooks + install.js --local). Verified:
- `.claude/commands/gsd2/inbox.md` contains `gsd2:inbox`
- `.claude/get-shit-done/workflows/inbox.md` contains `INBOX SESSION COMPLETE`
- `.claude/get-shit-done/workflows/discuss-phase.md` contains `PHASE PARKED` and zero matches for the old placeholder
- `node .claude/get-shit-done/bin/gsd-tools.cjs park` returns `park: unknown subcommand: undefined` (park dispatch confirmed)
- `npm test`: 1042 pass, 5 fail (same 5 EROFS pre-existing failures unrelated to this work — writing to read-only $HOME/.claude/ in sandbox)

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes

The PHASE PARKED return block in task 1 uses indented markdown rather than a nested fence block. The plan's note ("if nesting causes fence ambiguity, use indentation consistent with surrounding step formatting") explicitly permitted this. Content matches the spec exactly.

Task 3 produced no standalone commit because `.claude/` is gitignored — the runtime files are generated artifacts; source commits (d85b49e, fc2d9f4) are the canonical record.

## Success Criteria Check

- [x] PARK-01: park-and-ask under GSD_RUN_ID + --auto writes question (pending) + snapshot via 12-01/12-02 CLI, halts with PHASE PARKED
- [x] PARK-02: human resolves all parked questions in one sitting via /gsd2:inbox (discussion), full context inline, no tab-switching
- [x] PARK-03 (Phase 12 scope): staleness diff visible inline at answer time and in printed resume handoffs
- [x] Interactive sessions without GSD_RUN_ID remain byte-identical to today

## Self-Check: PASSED

Files exist:
- get-shit-done/workflows/discuss-phase.md: FOUND (contains PHASE PARKED, park create, mailbox append, status pending)
- commands/gsd2/inbox.md: FOUND (contains gsd2:inbox, argument-hint, execution_context ref)
- get-shit-done/workflows/inbox.md: FOUND (contains mailbox list, mailbox answer, park staleness, INBOX SESSION COMPLETE, DECISIONS.jsonl rule)
- Placeholder "do not write to the mailbox here": GONE (grep count = 0)

Commits:
- d85b49e: FOUND
- fc2d9f4: FOUND
