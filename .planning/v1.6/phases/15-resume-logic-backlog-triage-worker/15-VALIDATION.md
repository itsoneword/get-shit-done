---
phase: 15
slug: resume-logic-backlog-triage-worker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node 20+) |
| **Config file** | none — scripts/run-tests.cjs discovers tests/*.test.cjs |
| **Quick run command** | `node --test tests/triage.test.cjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~3 seconds (quick), ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/triage.test.cjs`
- **After every plan wave:** Run `npm test`
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | TRIAGE-01 | unit | `node --test tests/triage.test.cjs` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | TRIAGE-01 | unit | `node --test tests/triage.test.cjs` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | TRIAGE-01 | unit | `node --test tests/triage.test.cjs` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | TRIAGE-02 | workflow-prose | `grep -q 'triage-verdict:' get-shit-done/workflows/inbox.md` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | TRIAGE-02 | workflow-prose | `grep -qE 'print.*routing|routing command' get-shit-done/workflows/inbox.md` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 2 | PARK-03 (resume) | unit | `node --test tests/triage.test.cjs` | ❌ W0 | ⬜ pending |
| 15-03-02 | 03 | 2 | PARK-03 (resume) | integration | `node --test tests/triage.test.cjs` | ❌ W0 | ⬜ pending |
| 15-03-03 | 03 | 2 | PARK-03 (resume) | unit (existing) | `node --test tests/park.test.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Plan/task IDs are indicative — the planner finalizes the exact breakdown; the requirement→test mapping below is the binding contract.*

---

## Requirement → Observable Map (binding)

Derived from 15-AGENT-SPEC.md test contracts and 15-RESEARCH.md Validation Architecture.

### TRIAGE-01 — triage emits six-verdict proposals to the mailbox
- `parseRoadmapBacklog` extracts `### B\d+:` items from ROADMAP.md (unit)
- `parseRoadmapBacklog` returns `[]` when the Backlog section is absent (unit)
- `buildTriageProposal` produces required fields with a `triage-verdict:` prefix in `context` (unit)
- Triage mailbox entry has `status: "pending"` (NOT the `cmdMailboxAppend` default `"open"`) (unit)
- Triage writes ONLY to MAILBOX.jsonl — no ROADMAP.md or todo-file mutation (unit; propose-never-dispose)
- **TC-triage-1:** `mailbox list --raw` returns N new entries whose `context` starts `triage-verdict:`, each `status: "pending"`, with no todo/ROADMAP modification

### TRIAGE-02 — routing executes only on human acceptance; inbox stays thin
- Inbox detects the `triage-verdict:` prefix in the `context` field (workflow-prose grep)
- Inbox prints the routing command and does NOT execute it (workflow-prose grep)
- **TC-inbox-1:** `mailbox answer` called with `"accepted: <verdict>"`; routing command printed to stdout; todo file and ROADMAP.md NOT modified

### PARK-03 (resume) — parked branch replays through current state with staleness surfaced
- `checkStaleness` proceed path: `changed=[]`, `missing=[]` (unit, existing tests/park.test.cjs)
- Resume detection: snapshot present + mailbox question `status === "answered"` → resume route (integration)
- Drift re-park: `changed` non-empty → new mailbox `pending` entry, NO CONTEXT.md write, NO ledger append (integration)
- Idempotency: a superseding ledger record present (`supersedes === q-NNN`) → skip the CONTEXT.md + ledger write, proceed straight to replay (unit)
- CONTEXT.md write failure → abort, NO ledger write (unit)
- **TC-resume-1:** `park staleness --raw` returns `changed: []`; CONTEXT.md `<decisions>` updated before any discuss/plan step; `ledger append` carries `supersedes: "q-NNN"`; discuss-phase NOT invoked from scratch; `PHASE RESULT:` is `completed` or `parked q=q-NEW`
- **TC-resume-2:** `park staleness --raw` returns `changed: ["ROADMAP.md"]`; new mailbox entry `status: "pending"` with "state moved since park" in context; `PHASE RESULT: parked phase=N q=q-NEW`; `ledger append` NOT called; CONTEXT.md NOT modified
- **TC-resume-3:** staleness parse error → run.log contains `PHASE_FAILURE phase=N reason=staleness-parse-error`; no CONTEXT.md write; no ledger append

---

## Wave 0 Requirements

- [ ] `tests/triage.test.cjs` — stubs for TRIAGE-01, TRIAGE-02, resume idempotency, drift re-park, staleness-parse-error (follows tests/ledger.test.cjs + tests/park.test.cjs conventions: tempProject fixture, runGsdTools helper, describe/test/beforeEach/afterEach)
- [ ] `get-shit-done/bin/lib/triage.cjs` — new module skeleton with exported pure functions (`parseRoadmapBacklog`, `buildTriageProposal`, dedup check) + `cmd*` dispatch
- [ ] Workflow-prose targets must exist to grep: `workflows/autonomous.md` (resume branch), `workflows/overnight.md` (triage step), `workflows/inbox.md` (triage-entry detection), new `workflows/triage.md` + `commands/gsd2/triage.md`

*Existing infrastructure (node:test, scripts/run-tests.cjs) covers the runner — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end resume on a real overnight run (park → answer → next-run replay) | PARK-03 | Requires a live multi-phase headless run with a genuine parked-then-answered question | After an overnight run parks a phase and the question is answered in `/gsd2:inbox`, launch the next run and confirm the phase replays from the blocked step with the staleness diff shown |
| Triage verdict quality (correct verdict per real backlog item) | TRIAGE-01 | Verdict assignment is LLM judgment over codebase evidence — correctness is semantic, not grep-checkable | Run `/gsd2:triage`; confirm the two pending todos + B1 receive defensible verdicts with evidence strings that cite real code/roadmap state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
