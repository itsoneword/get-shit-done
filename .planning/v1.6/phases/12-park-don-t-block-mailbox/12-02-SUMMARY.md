---
phase: 12-park-don-t-block-mailbox
plan: "02"
subsystem: mailbox
tags: [mailbox, inbox, cli, readline, park, staleness, PARK-02]

requires:
  - phase: 12-01
    provides: park.cjs exports snapshotPath + checkStaleness used by printResumeHandoff

provides:
  - writeMailbox (full-file rewrite, answer path only)
  - answerRecord (pure terminal-state mutation, no re-answer)
  - printResumeHandoff (prints park snapshot resume instruction + staleness on answer)
  - cmdMailboxAnswer (gsd-tools mailbox answer — targeted single-question update)
  - cmdMailboxReview (gsd-tools mailbox review — stdin-driven loop over all pending)
  - dispatch wired: case 'answer' and case 'review' in gsd-tools.cjs mailbox switch

affects:
  - 12-03 (inbox skill calls mailbox answer for each question resolved)
  - 13 (overnight runner relies on mailbox review to surface blocked questions)

tech-stack:
  added: [node:readline (built-in), collect-then-iterate stdin pattern]
  patterns:
    - Full-file rewrite (writeMailbox) isolated to answer/update path only; append path remains appendFileSync-only
    - Collect all stdin lines via readline close event before iterating questions — required for piped stdin (spawnSync) compatibility
    - Pure answerRecord function returns error union rather than throwing; cmd handlers convert to exit(1)

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/mailbox.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - tests/mailbox.test.cjs

key-decisions:
  - "Collect all stdin lines at once via readline close event rather than rl.question in a loop — rl.question stops on EOF when stdin is a pipe (spawnSync), which would silently drop remaining questions"
  - "answerRecord is a pure function returning { error } | { records, record } — no process.exit inside library functions"
  - "printResumeHandoff writes to process.stdout by default but accepts an out param for testability"
  - "writeMailbox used once per review session (after the loop) not per-question — one rewrite for N answers"

requirements-completed: [PARK-02]

duration: 8min
completed: 2026-06-12
---

# Phase 12 Plan 02: Inbox CLI (mailbox answer/review) Summary

**stdin-driven mailbox inbox CLI with targeted-answer and interactive-review commands, resume handoffs from parked snapshots on answer, and append-path integrity invariant**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-12T08:15:58Z
- **Completed:** 2026-06-12T08:24:28Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- `gsd-tools mailbox answer <run-id> --id q-NNN --answer <text>` resolves a single parked question: terminal-state write (no re-answer), prints resume handoff with staleness state when a phase snapshot exists
- `gsd-tools mailbox review <run-id>` walks all unanswered questions (open + pending) in one stdin session: presents question/context/options/evidence inline, accepts answers from piped or interactive stdin, prints resume handoffs, writes one rewrite at end
- 14 new tests (24 total in mailbox.test.cjs); pre-existing 10 append/list tests unmodified; full suite green excluding 5 unrelated pre-existing failures

## Task Commits

1. **Task 1: RED — failing tests for answer/review** - `59131aa` (test)
2. **Task 2: GREEN — implement writeMailbox/answerRecord/printResumeHandoff/cmdMailboxAnswer/cmdMailboxReview + dispatch** - `936d270` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/mailbox.cjs` - Added writeMailbox, answerRecord, printResumeHandoff, cmdMailboxAnswer, cmdMailboxReview; updated module header; added `require('./park.cjs')`
- `get-shit-done/bin/gsd-tools.cjs` - Added case 'answer' and case 'review' in the mailbox switch
- `tests/mailbox.test.cjs` - 14 new test cases: answer contract, review loop, resume handoff (with/without snapshot), append invariant after rewrite

## Decisions Made

- Collect all stdin lines via readline `close` event before iterating over questions. `rl.question` in an async loop silently drops remaining questions when stdin is a pipe (spawnSync EOF causes readline close mid-loop). Collecting first then iterating is idempotent and works for both interactive TTYs and piped test input.
- `writeMailbox` writes `''` for empty records array (not `'\n'`) — matches test expectations for 0-length mailbox after hypothetical full-clear.
- `printResumeHandoff` wraps snapshot parse and `checkStaleness` in try/catch — corrupt snapshots print a warning and return false; never throws.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] readline rl.question drops questions when stdin is piped**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** `rl.question` in an async loop stops receiving answers after EOF when stdin is a pipe, causing q-003 and later questions to never appear in review output
- **Fix:** Replaced `rl.question` loop with upfront `readline.createInterface` + `close` event collection, then synchronous walk of collected lines matched to pending records
- **Files modified:** get-shit-done/bin/lib/mailbox.cjs
- **Verification:** Test 7 (review with 3 unanswered + 1 pre-answered) passes; all 24 mailbox tests green
- **Committed in:** 936d270 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in readline piped-stdin behavior)
**Impact on plan:** Necessary for correctness of the review loop under test conditions (spawnSync) and in CI. No scope creep.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PARK-02 (CLI half) complete: `mailbox review` presents each parked question with context/options/evidence inline, accepts stdin answers, records status=answered+answer+answered_ts
- `mailbox answer` targeted path is ready for the /gsd2:inbox skill (12-03) to call
- Resume handoff (PARK-03 visibility) prints resume instruction + staleness state when answering a parked question with a snapshot
- 12-03 (inbox skill) can proceed immediately

---
*Phase: 12-park-don-t-block-mailbox*
*Completed: 2026-06-12*
