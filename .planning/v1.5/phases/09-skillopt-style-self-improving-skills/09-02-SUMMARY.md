---
phase: 09-skillopt-style-self-improving-skills
plan: 02
subsystem: workflows
tags: [teach, slash-command, skill-evolution, advisor-critic, ratify-gate, dogfood]

# Dependency graph
requires:
  - phase: 09-skillopt-style-self-improving-skills
    provides: 09-01 lesson ledger CRUD + attribute + scan (gsd-tools lesson)
provides:
  - /gsd2:teach slash command (commands/gsd2/teach.md)
  - get-shit-done/workflows/teach.md online skill-evolution loop
  - source-only-apply + separate-ledger-commit pattern (clean git revert undo)
affects:
  - future phases that observe failures and want to teach GSD a bounded prose fix

# Tech tracking
tech-stack:
  added: []
  patterns:
    - command+workflow pattern mirroring note.md (standalone command @-refs ~/.claude workflow)
    - human ratify gate [y/N] as the primary bloat guard (no auto-apply path)
    - source-only apply commit + separate ledger commit (keeps git revert conflict-free)
    - advisor tool invoked inline for the reflect/critic step

key-files:
  created:
    - get-shit-done/workflows/teach.md
    - commands/gsd2/teach.md
  modified:
    - .planning/v1.5/phases/09-skillopt-style-self-improving-skills/09-02-PLAN.md (SC3 reconciliation)

key-decisions:
  - "Command + workflow committed as SOURCE only; npm run dev required to go live in .claude/ runtime"
  - "Bounded-edit cap = <=20 lines / one contiguous section — planner ASSUMPTION (no published SkillOpt number)"
  - "Apply = source-only commit, then update ledger applied + commit ledger SEPARATELY — required so git revert {source_hash} never conflicts with the ledger line"
  - "Reject (N) path also commits the rejected ledger record for a clean tree (symmetric)"
  - "Undo = git revert {source_hash} + lesson update {LSN} --disposition reverted + npm run dev"
  - "Used ~/.claude/ path token in command @-ref per runtime-path convention; install.js/npm run dev propagates"

requirements: [TEACH-01, TEACH-02, TEACH-05]
---

# 09-02: /gsd2:teach command + online skill-evolution loop

## What shipped

- `get-shit-done/workflows/teach.md` — the full teach loop. Path A (`scan`) prints
  `lesson scan` nominations and writes nothing. Path B (failure description): telemetry →
  `lesson attribute` → user confirm/redirect → advisor-critic reflect → bounded edit draft
  (<=20 lines, one section) → append proposed lesson → `[y/N]` ratify gate → apply (source-only
  commit + separate ledger commit) or reject (ledger committed) → confirm with npm-run-dev +
  git-revert undo lines. All six pitfall guards encoded as hard constraints.
- `commands/gsd2/teach.md` — standalone slash command, `argument-hint: "<failure description> | scan"`,
  allowed-tools Read/Write/Edit/Bash/Grep/Glob, `@~/.claude/get-shit-done/workflows/teach.md`.

## Verification (checkpoint Task 3 — done at orchestrator level on the gsd repo itself)

The behavioral guarantees were exercised against this repo (gsd dogfoods /teach because it
edits gsd's own source):

- npm run dev propagation: lesson subcommand + teach command/workflow live in runtime. ✓
- scan / no-edit path: "No nominations (threshold=3)"; recurrence-3 record → nominated, no write. ✓
- attribution writes nothing; gsd-executor→agents/gsd-executor.md; unknown→common-bug-patterns.md; never .claude/. ✓
- SC2 no-auto-apply: ratify [y/N] (Step 6) precedes Apply (Step 7); verified by prose ordering + a run where N left source clean and ledger=rejected. ✓
- SC3 source-only apply: apply commit `git show --stat` = source only, zero .claude/. ✓
- TEACH-05 reversibility: after the fix, `git revert {source_hash}` exits 0 and restores source cleanly. ✓

## Dogfood finding + fix (discovered during checkpoint validation)

The original Step 7 committed source + ledger together, then ran `lesson update --disposition
applied` AFTER the commit. Two real bugs:
1. The committed ledger record stayed `proposed` (applied + commit-hash lived only in the working tree).
2. `git revert {hash}` (the documented TEACH-05 undo) ABORTED — the post-commit ledger
   mutation left lessons.jsonl dirty on the same line the revert tried to reverse-patch.

Fixed in commit `3db6a3b`: apply = **source-only** commit; then `lesson update applied` +
**separate** ledger commit. Reject path commits its ledger record too. Step 8 undo now also
flips the ledger to `reverted`. Plan 09-02 SC3 wording reconciled to match (apply commit is
source-only; ledger in a follow-up commit). Empirically re-proven: clean revert, exit 0.

## ASSUMPTIONS / flags for the human

- **Bounded-edit cap (<=20 lines / one section)** is a GSD-chosen number — SkillOpt publishes
  no specific cap. Tune if it proves too tight/loose in real use.
- **LEARN-01 reconciliation:** Phase 9 materializes LEARN-01's intent ("GSD learns from
  failures") under the TEACH- requirement namespace (TEACH-01..05). Decide whether to mark
  LEARN-01 satisfied in REQUIREMENTS.md or keep it as a tracking umbrella.
- **Interactive UX not exhaustively exercised:** the advisor-critic dialogue feel is best
  judged in a real working session; mechanical guarantees (gate, source-only, reversibility)
  are confirmed here.

## Self-Check: PASSED
