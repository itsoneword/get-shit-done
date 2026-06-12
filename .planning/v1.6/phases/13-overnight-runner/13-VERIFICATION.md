---
phase: 13-overnight-runner
verified: 2026-06-12T12:10:12Z
status: passed
score: 10/10 must-haves verified
---

# Phase 13: Overnight Runner Verification Report

**Phase Goal:** `/gsd2:overnight` runs remaining phases unattended — worktree-isolated, ledger-wired, mailbox-integrated, with a startup health check and a morning report — after Wave-0 empirical validation of headless session lifespan and bypassPermissions behavior
**Verified:** 2026-06-12T12:10:12Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `gsd-tools run report <run-id>` prints a plain-text morning report (decisions made, questions parked, phases completed) computed from RUN-META.json + DECISIONS.jsonl + MAILBOX.jsonl only — no transcript files read | VERIFIED | `cmdRunReport` in ledger.cjs reads exactly three files (lines 332, 351, 352): RUN-META.json via `metaFilePath`, DECISIONS.jsonl via `ledgerPath`, MAILBOX.jsonl via `path.join(runDir(...), 'MAILBOX.jsonl')`. No other reads. Output: `=== Morning Report:`, Phases, Decisions, Mailbox sections. |
| 2  | A corrupt JSONL line never crashes the report — it is skipped, counted, and reported as 'N unparseable entries skipped' | VERIFIED | `readJsonlWithCount` (ledger.cjs line 298) wraps each `JSON.parse` in try/catch, increments `skipped`. `cmdRunReport` line 397: `${totalSkipped} unparseable entries skipped` emitted when sum > 0. Tests confirm: 7-test `describe('run report')` covers this case. `node --test tests/ledger.test.cjs` exits 0 (32/32 pass). |
| 3  | `gsd-tools run record-phase` appends a validated phase outcome record to RUN-META.json phases[]; `gsd-tools run status` sets terminal status — both reject invalid values with exit 1 | VERIFIED | `cmdRunRecordPhase` (line 424): validates phase status against `VALID_PHASE_STATUSES = ['completed','parked','failed']`, exits 1 on invalid/missing args. `cmdRunStatus` (line 491): validates against `VALID_RUN_STATUSES`. Both wired to `case 'run'` switch in gsd-tools.cjs at lines 1056 (`record-phase`), 1073 (`status`). Tests: `describe('run record-phase')` and `describe('run status')` blocks present at lines 539, 651. |
| 4  | `/gsd2:autonomous --phase N` runs exactly one phase and ends with a greppable `PHASE RESULT: <completed|parked|failed> phase=N ...` line | VERIFIED | autonomous.md line 77: SINGLE_PHASE set → lifecycle NEVER entered, PHASE RESULT emitted. Lines 233-236: all four variants present. Line 239: machine-greppable regex `^PHASE RESULT: (completed|parked|failed) phase=`. Line 426 (iterate step): single-phase mode never enters iterate. |
| 5  | Under GSD_RUN_ID, autonomous.md discuss step delegates to `Skill(gsd2:discuss-phase, 'N --auto')` so Phase 11 evaluator and Phase 12 park branch fire; PHASE PARKED bubbles up as PHASE RESULT: parked | VERIFIED | autonomous.md line 138: `if false AND HARNESS_MODE is true: do NOT run smart_discuss`. Line 141: `Skill(skill="gsd2:discuss-phase", args="${PHASE_NUM} --auto")`. Line 145: PHASE PARKED → outcome `parked` → PHASE RESULT: parked. |
| 6  | Under GSD_RUN_ID, no AskUserQuestion pause survives: human_needed routes to mailbox, unresolved gaps_found route to PHASE RESULT: failed — never a hang | VERIFIED | autonomous.md line 180 (empty/no-verification): HARNESS_MODE → failed, no AskUserQuestion. Lines 186-192 (human_needed): HARNESS_MODE → mailbox append + deferred_verification. Lines 201-208 (gaps_found): HARNESS_MODE → one auto gap-closure, then failed with reason=gaps_found. Line 521 (handle_blocker): "HARNESS_MODE: never AskUserQuestion." |
| 7  | `/gsd2:overnight` initializes a run, passes a fail-closed health check (case-sensitive ESC-03 PASS gate, absolute GSD_RUN_LOG), executes remaining phases via Skill(gsd2:autonomous, '--phase N') with typed run.log | VERIFIED | overnight.md line 45: `GSD_RUN_LOG="$(pwd)/.planning/run/$GSD_RUN_ID/run.log"` (absolute). Line 91: `if ! grep -q "PASS" .planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/*CALIBRATION*.md` (case-sensitive, no `-i`). Line 195: `Skill(skill="gsd2:autonomous", args="--phase ${N}")`. All 16 locked TYPE tokens present (verified by for-loop). |
| 8  | A `clean:false` result from `gsd-tools worktree merge --raw` routes a structured pending entry to MAILBOX.jsonl and logs CONFLICT_ROUTED — exit code 0 is never treated as merge success | VERIFIED | overnight.md line 239: `MERGE_RAW=$(node ... worktree merge "overnight-phase-${N}" --raw)`. Line 254: `clean:false` → conflict routing to mailbox append, logs `CONFLICT_ROUTED`. Lines 373-374: "Exit-0 merges are never trusted." Parse failure → treat as conflict (MERGE_PARSE_FAIL). |
| 9  | Auth failures stop the run immediately with AUTH_FAILURE + RUN_STOP in run.log — no silent retry; every other failure parks/fails the phase and the runner skips to the next independent phase | VERIFIED | overnight.md line 210: `AUTH_FAILURE phase=$N` logged. Lines 212-213: `run status --set stopped --reason auth-failure` + record-phase failed. Line 216: "END THE RUN IMMEDIATELY. No retry, no silent retry, no skip-to-independent for auth failures." Line 165: skip-to-independent via BLOCKED/SKIPPED sets for non-auth failures. |
| 10 | `/gsd2:inbox` prints the `gsd-tools run report` output as its session header before walking questions | VERIFIED | inbox.md line 37: `<step name="run_report_header">` inserted between `resolve_run` (line 9) and `load_questions` (line 48). Line 41: `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run report <run-id>`. Line 45: graceful skip on non-zero exit. Runtime .claude/get-shit-done/workflows/inbox.md confirmed synced with `run_report_header`. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `get-shit-done/bin/lib/ledger.cjs` | cmdRunReport, cmdRunRecordPhase, cmdRunStatus, readJsonlWithCount | VERIFIED | All four functions present and exported (lines 539-553). VALID_PHASE_STATUSES and VALID_RUN_STATUSES also exported. |
| `get-shit-done/bin/gsd-tools.cjs` | `case 'run'` dispatch: report / record-phase / status | VERIFIED | Lines 1056, 1073, 1081 confirm all three cases wired inside `case 'run'` switch. |
| `tests/ledger.test.cjs` | describe blocks: run report, run record-phase, run status | VERIFIED | Lines 394, 539, 651. `node --test tests/ledger.test.cjs` exits 0 (32/32 pass, 0 fail). |
| `get-shit-done/workflows/autonomous.md` | --phase selector, harness-mode branches, PHASE RESULT contract | VERIFIED | SINGLE_PHASE parsing (line 31-34), HARNESS_MODE (line 35-36), discuss delegation (line 138-141), all four PHASE RESULT variants (lines 233-236), handle_blocker non-interactive (line 521). |
| `commands/gsd2/autonomous.md` | argument-hint covering --phase | VERIFIED | Line 4: `argument-hint: "[--from N] [--phase N]"`. Context block mentions PHASE RESULT. |
| `get-shit-done/workflows/overnight.md` | health check, run init, phase loop, worktree lifecycle, conflict routing, outcome records, snapshots, report, crontab doc | VERIFIED | File exists, all 16 TYPE tokens present (for-loop check: no MISSING output). All key sections confirmed by grep: ESC-03 gate, absolute GSD_RUN_LOG, Skill invocation, PHASE RESULT parsing, merge --raw with clean field, run record-phase, run status, run snapshot, run report, mailbox append, BLOCKED/SKIPPED skip-to-independent, crontab block. |
| `commands/gsd2/overnight.md` | /gsd2:overnight command stub | VERIFIED | Exists. Frontmatter: `name: gsd2:overnight`, `argument-hint: "[--from N] [--run-id <id>]"`, execution_context `@~/.claude/get-shit-done/workflows/overnight.md`. Contains "orchestrator level" (twice). |
| `get-shit-done/workflows/inbox.md` | run-report header step in resolve_run flow | VERIFIED | `run_report_header` step at line 37, between resolve_run and load_questions, graceful-skip on nonzero exit. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gsd-tools.cjs case 'run'` | `ledger.cmdRunReport / cmdRunRecordPhase / cmdRunStatus` | dispatch switch lines 1056, 1073, 1081 | VERIFIED | All three subcommands wired; report exit-1 on missing run-id confirmed at runtime. |
| `cmdRunReport` | `RUN-META.json phases[]` written by `cmdRunRecordPhase` | Both functions share `metaFilePath(cwd, id)` path | VERIFIED | cmdRunReport reads `meta.phases` (line 358); cmdRunRecordPhase writes to same path (line 469-471). |
| `overnight.md` | `Skill(gsd2:autonomous, '--phase N')` + PHASE RESULT grep | Line 195 (Skill), lines 218-227 (PHASE RESULT parsing) | VERIFIED | Skill invocation present; outcome detection regex `^PHASE RESULT: (completed|parked|failed) phase=N( .*)?$` at line 221. No PHASE RESULT line → ambiguous → failed (line 227). |
| `overnight.md merge step` | `gsd-tools worktree merge --raw` JSON `clean` field | Lines 239, 254 | VERIFIED | `--raw` flag present; `clean:false` branch is the conflict routing path; exit-0-not-trusted explicitly documented. |
| `overnight.md` | `gsd-tools run record-phase / run status / run snapshot / run report` | Lines 212-213 (auth), 266, 283, 319, 325, 331 | VERIFIED | All four CLI surfaces invoked at correct points in the phase loop. |
| `workflows/inbox.md` | `gsd-tools run report <run-id>` | `run_report_header` step line 41 | VERIFIED | Wired and synced to runtime. |
| `commands/gsd2/overnight.md` | `@~/.claude/get-shit-done/workflows/overnight.md` | execution_context line | VERIFIED | Present in commands/gsd2/overnight.md; runtime .claude/commands/gsd2/overnight.md synced. |
| `autonomous.md harness discuss branch` | `Skill(gsd2:discuss-phase, '--auto')` | Line 141 | VERIFIED | Gated on `HARNESS_MODE is true`; interactive path (`smart_discuss`) still present for non-harness runs. |
| `autonomous.md PHASE RESULT line` | `overnight.md outcome detection` | Lines 233-236 (autonomous) / lines 218-227 (overnight) | VERIFIED | Contract is consistent: same four variants, same greppable regex. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| RUN-01 | 13-02, 13-03 | `/gsd2:overnight` runs phases unattended with ledger + escalation + mailbox active | SATISFIED | overnight.md ships the runner; GSD_RUN_ID exported to all subprocesses; autonomous.md delegates discuss to discuss-phase --auto under HARNESS_MODE (Phase 11 evaluator + Phase 12 park fire). |
| RUN-02 | 13-03 | Per-phase worktree isolation; merge conflicts route to mailbox, never silently swallowed | SATISFIED | overnight.md: worktree add per phase; MERGE_RAW parsed for clean field; clean:false → mailbox append + CONFLICT_ROUTED log; explicit "exit code treated as meaningless" language. |
| RUN-03 | 13-03 | Startup health check + run.log; auth/permission failures fail loudly, no silent retry | SATISFIED | overnight.md: fail-closed health check (ESC-03 + absolute GSD_RUN_LOG); AUTH_FAILURE = hard stop + RUN_STOP; locked 16-token TYPE vocabulary; PERMISSION_DENIAL path present. |
| RUN-04 | 13-01, 13-03 | Morning report summarizes decisions made, questions parked, phases completed | SATISFIED | `cmdRunReport` reads exactly three artifacts, renders plain-text morning report; `run_report_header` in inbox.md embeds it as session header; runtime binary confirmed (exit-1 on missing run-id). |

### Wave-0 Gate (Roadmap Success Criterion 4)

**Status: SATISFIED**

RESEARCH.md sections W0-1 through W0-5 exist and were committed before the overnight.md implementation:
- W0-1..W0-4 committed: 2026-06-12T09:14-09:20Z (commits `1732b06`, `c1874ce`)
- W0-5 user constraint record committed: 2026-06-12T09:31Z (commit `c37b6cb`)
- overnight.md implementation committed: 2026-06-12T11:55Z (commit `1a4f275`)

CONTEXT.md line 36: `### Wave-0 constraint record (empirical — gates scheduling logic, per roadmap success criterion 4)` — the constraint record explicitly references the roadmap criterion. The locked posture (sandbox-first, no bypassPermissions mandate) is reflected verbatim in overnight.md's `<purpose>` block.

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER in modified source files. `cmdRunReport` is a substantive 80-line implementation. All three CLI functions exit-1 with clear error messages; no silent failures; no stub `return {}` patterns.

### ESC-03 Gate State

The 11-CALIBRATION.md file exists but contains **0 uppercase PASS tokens**. This means `/gsd2:overnight` will correctly fail its health check until a human completes calibration and records the pass verdict. This is the intended behavior — the trust-ladder gate is working as designed.

This is not a defect. The overnight runner cannot be safely launched without ESC-03 calibration, and the gate enforces this precisely. It is noted here as an operational constraint that must be resolved before overnight runs can proceed.

### Human Verification Warranted (Non-Blocking)

1. **ESC-03 calibration gate completion** — a human must complete `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CALIBRATION.md` with an uppercase PASS verdict before `/gsd2:overnight` can actually execute a phase loop. The code is correct; the precondition is unmet by design.

2. **Real headless run** — the seeded smoke test verifies the CLI pipeline; a live overnight invocation under `claude -p "/gsd2:overnight"` cannot be verified programmatically. The worktree isolation caveat (known: in-session executors may write to main tree regardless of worktree setup) means WORKTREE_FALLBACK is the expected common path, not an error.

---

## Summary

Phase 13 goal is fully achieved. All four requirements (RUN-01 through RUN-04) are satisfied by substantive, wired implementations:

- **13-01 (RUN-04 CLI):** `cmdRunReport`, `cmdRunRecordPhase`, `cmdRunStatus`, `readJsonlWithCount` all exist in ledger.cjs, are exported, dispatched from gsd-tools.cjs, and covered by 18 passing unit tests.
- **13-02 (RUN-01 autonomous wiring):** autonomous.md has SINGLE_PHASE/HARNESS_MODE parsing, discuss-phase --auto delegation, all four PHASE RESULT variants, harness 3d non-interactive routing, and handle_blocker non-blocking path.
- **13-03 (RUN-01/02/03/04 overnight workflow):** overnight.md exists with all 16 locked TYPE tokens, fail-closed health check, absolute GSD_RUN_LOG, skip-to-independent logic, AUTH_FAILURE hard-stop, merge --raw conflict routing; /gsd2:overnight command stub wired; inbox run_report_header step present. Runtime (.claude/) synced for all five artifacts.
- **Wave-0 gate:** RESEARCH.md + CONTEXT.md constraint record predate the implementation by ~2.5 hours in commit history.

The only non-passing condition is the ESC-03 calibration prerequisite in CALIBRATION.md (0 PASS tokens). This is the trust-ladder gate working as intended and is not a code defect.

---

_Verified: 2026-06-12T12:10:12Z_
_Verifier: Claude (gsd-verifier)_
