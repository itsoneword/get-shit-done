---
phase: 15-resume-logic-backlog-triage-worker
plan: "03"
subsystem: workflows
tags: [triage, inbox, overnight, mailbox, propose-never-dispose]

requires:
  - phase: 15-01
    provides: triage.cjs with cmdTriageRun, buildTriageProposal, pendingProposalExists
  - phase: 15-02
    provides: autonomous.md resume branch (step 3a.0)
provides:
  - overnight.md step 6.5 triage worker (calls gsd-tools triage run after phase loop)
  - inbox.md triage-verdict detection and Triage Proposal presentation template
  - workflows/triage.md standalone workflow for /gsd2:triage LLM verdict assignment
  - commands/gsd2/triage.md command stub loading the triage workflow
affects: [phase-16, inbox-consumers, overnight-runner, triage-workflow]

tech-stack:
  added: []
  patterns:
    - "propose-never-dispose: inbox prints routing command, never executes it"
    - "triage-verdict: prefix as inbox type discriminator — context field drives presentation branch"
    - "Explicit status:pending in mailbox appends — CLI default 'open' is wrong for harness-generated entries"

key-files:
  created:
    - get-shit-done/workflows/triage.md
    - commands/gsd2/triage.md
  modified:
    - get-shit-done/workflows/overnight.md
    - get-shit-done/workflows/inbox.md

key-decisions:
  - "propose-never-dispose invariant: inbox prints routing command verbatim on accept, never modifies todo files or ROADMAP.md directly"
  - "triage-verdict: prefix (with trailing space) is the sole inbox type discriminator — unknown verdict tokens degrade to needs-input with warning, never block the session"
  - "step 6.5 placed after RUN_COMPLETE/RUN_STOP determination and before run report — triage failure logs PHASE_FAILURE phase=triage but does not abort morning report"
  - "LLM assigns real verdicts in workflow prose; cmdTriageRun emits needs-input as structural default for unclassified items"

patterns-established:
  - "Inbox type discrimination via context field prefix: triage-verdict: branches to Triage Proposal template; anything else falls through to normal phase-question presentation"
  - "Workflow-level invariant documentation: triage.md <rules> block states all three load-bearing invariants (propose-never-dispose, status:pending, triage-verdict: prefix) for LLM enforcement"

requirements-completed: [TRIAGE-01, TRIAGE-02, PARK-03]

duration: 90min
completed: 2026-06-18
---

# Phase 15 Plan 03: Triage Wiring Summary

**Overnight step 6.5 calls gsd-tools triage run, inbox.md detects triage-verdict: prefix and presents proposals via distinct Verdict/Item/Evidence template with propose-never-dispose routing**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-06-17T19:40:00Z
- **Completed:** 2026-06-18T00:00:00Z
- **Tasks:** 5 (Tasks 1-4 auto, Task 5 checkpoint:human-verify — approved)
- **Files modified:** 4

## Accomplishments

- overnight.md step 6.5 inserted between RUN_COMPLETE/RUN_STOP determination and morning report; triage failure logs PHASE_FAILURE phase=triage and continues
- inbox.md present_and_discuss extended with triage-verdict: detection, Triage Proposal template (Verdict/Item/Evidence/Options), accept path prints routing command without executing it, defer path records "deferred", unknown verdict degrades to needs-input with warning
- workflows/triage.md created: standalone /gsd2:triage workflow driving LLM verdict assignment over six verdicts, five named steps, propose-never-dispose invariant, dedup guard, explicit status:pending requirement
- commands/gsd2/triage.md stub created following inbox.md pattern, loads workflows/triage.md, passes $ARGUMENTS; synced to runtime via npm run dev

## Task Commits

1. **Task 1: Add step 6.5 triage step to overnight.md** - `1b64e7d` (feat)
2. **Task 2: Extend inbox.md present_and_discuss with triage-entry detection** - `de79bf7` (feat)
3. **Task 3: Create workflows/triage.md standalone workflow** - `650a5fc` (feat)
4. **Task 4: Create commands/gsd2/triage.md command stub** - `466e9d7` (feat)
5. **Task 5: Smoke verify triage flow end-to-end** - checkpoint:human-verify — approved by user

**Plan metadata:** (this commit)

## Files Created/Modified

- `get-shit-done/workflows/overnight.md` - Added step 6.5 triage worker block after RUN_COMPLETE/RUN_STOP, before run report
- `get-shit-done/workflows/inbox.md` - Added triage-verdict: detection, Triage Proposal template, propose-never-dispose rules
- `get-shit-done/workflows/triage.md` - New standalone triage workflow with six-verdict table and all load-bearing invariants
- `commands/gsd2/triage.md` - New command stub loading workflows/triage.md, passing $ARGUMENTS

## Decisions Made

- propose-never-dispose enforced at the inbox prose level: accept path calls mailbox answer then prints the routing command; the human runs it as a separate explicit step. Never executed inline.
- Unknown verdict tokens in triage entries degrade gracefully to needs-input with a warning — a corrupt mailbox entry must not block the inbox session.
- Step 6.5 positioned after RUN_COMPLETE/RUN_STOP determination and before run report to ensure triage proposals are appended before the morning summary is printed, even when phases fail.
- LLM assigns real verdicts in triage.md workflow prose; cmdTriageRun in Plan 01 emits needs-input as structural default for CLI-only invocations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 15 is complete. All three plans (triage module TDD, resume branch, triage wiring) are done.

The full triage pipeline is now wired: overnight step 6.5 generates proposals via cmdTriageRun, morning inbox presents them with the Triage Proposal template, and accepted verdicts print routing commands for human execution. The propose-never-dispose invariant is enforced in prose and documented in both inbox.md rules and triage.md rules.

Phase 16 (if planned) can build on: the triage-verdict: inbox discriminator pattern, the explicit status:pending convention for harness-generated mailbox entries, and the propose-never-dispose boundary.

---
*Phase: 15-resume-logic-backlog-triage-worker*
*Completed: 2026-06-18*
