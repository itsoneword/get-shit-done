---
phase: 09-skillopt-style-self-improving-skills
verified: 2026-06-08T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Run /gsd2:teach \"<real observed failure>\" and decline with N. Confirm no source file changed and lessons.jsonl shows disposition: rejected."
    expected: "git status clean for all source paths (agents/, get-shit-done/, commands/gsd2/); ledger record for the lesson reads disposition: rejected."
    why_human: "SC2 (no-auto-apply) is a negative behavioral guarantee — the ratify gate is a human round-trip by design. Static grep proves [y/N] gate prose precedes Apply prose in teach.md, but cannot prove the orchestrator actually halts there and awaits input before any Edit call. 09-VALIDATION.md §Manual-Only marks this as a non-automatable checkpoint."
  - test: "Run /gsd2:teach \"<real observed failure>\" and confirm with y. Inspect the apply commit with git show --stat. Confirm a separate follow-up ledger commit."
    expected: "Apply commit touches ONLY a source file (agents/ or get-shit-done/ or commands/gsd2/) — zero .claude/ entries, no lessons.jsonl. Separate ledger commit shows disposition: applied with a non-null commit hash. Confirmation output includes 'npm run dev' and 'git revert {hash}' lines."
    why_human: "SC3 (real ratified bounded edit, source-only commit) requires executing the loop against an actual failure. The two-commit pattern (source-only apply, then separate ledger commit) was verified at orchestrator level in this session (commit 3db6a3b fix + subsequent dogfood) but independent re-execution is the full gate. 09-VALIDATION.md marks this Manual-Only."
  - test: "After a y-ratified apply commit, run: git revert {source_hash} && npm run dev. Verify source file is restored."
    expected: "git revert exits 0, working tree clean after revert, runtime reflects the pre-lesson state after npm run dev."
    why_human: "TEACH-05 git-reversibility was demonstrated at orchestrator level (commit 3db6a3b ensures source-only apply so revert never conflicts). Cannot be re-proven statically. The 09-VALIDATION.md §Manual-Only table covers this as part of SC3."
  - test: "Decide whether to mark LEARN-01 satisfied in REQUIREMENTS.md."
    expected: "Human marks LEARN-01 satisfied-by-TEACH or keeps it distinct (e.g. for a future cross-project intel store). Either outcome is valid; the decision just needs to be recorded."
    why_human: "LEARN-01 is a reserved requirement that Phase 9 materializes under the TEACH- namespace. Whether to retire it is a product-owner judgment, not a code-checkable fact. The 09-02 SUMMARY explicitly flags this as an open question for the human."
---

# Phase 9: Skillopt-Style Self-Improving Skills — Verification Report

**Phase Goal:** Online, feedback-driven skill evolution — GSD's skill/command/reference prose learns from real failures. A manual `/teach` (primary) + auto-miner (nominate-only) captures a lesson; the loop reads Phase 4 telemetry to attribute the culprit artifact, proposes a BOUNDED edit, the human RATIFIES, it commits to SOURCE; lessons persist in a `.planning/lessons/` ledger. Keeps SkillOpt's discipline (bounded edits, accept-gate, git-reversibility); drops its offline benchmark.
**Verified:** 2026-06-08
**Status:** human_needed — all structural/code checks pass; two by-design manual-checkpoint behaviors (SC2, SC3) pending independent human re-execution. LEARN-01 reconciliation pending human decision.
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `gsd-tools lesson append` writes one JSONL line with monotonic LSN-NNN id; `list` filters by agent/disposition/last; `update` mutates in-place; `bump-recurrence` increments counter | VERIFIED | `lib/lesson.cjs` — cmdAppend/cmdList/cmdUpdate/cmdBumpRecurrence all implemented; 6 test groups (18 assertions) in `tests/lesson.test.cjs` GREEN; `npm test` 959/959 pass, 0 failures |
| 2 | `lesson attribute --agent <type>` resolves to a repo-root source file (never starting with `.claude/`); unknown/null agent falls back to `get-shit-done/references/common-bug-patterns.md` | VERIFIED | `lesson.cjs` — `AGENT_FILE_MAP` static table present; `attributeFile()` throws on `.claude/` or `gsd-local-patches/` paths; `pickAttribution()` lazy-requires `trace.cjs`; attribution test group GREEN; orchestrator evidence: `gsd-executor→agents/gsd-executor.md`, `unknown→common-bug-patterns.md`, never `.claude/` |
| 3 | `lesson scan` nominates records with recurrence >= threshold and disposition != applied, and writes nothing | VERIFIED | `cmdScan` reads only `readLessons` (no `readTrace`, no VERIFICATION.md scan); `recurrence_threshold` read from `config.json` with default 3; scan test group GREEN; orchestrator evidence: "No nominations (threshold=3)" on empty ledger; recurrence-3 record nominated, no file write |
| 4 | `/gsd2:teach` command exists and `@`-references `~/.claude/get-shit-done/workflows/teach.md` | VERIFIED | `commands/gsd2/teach.md` — `name: gsd2:teach`; `argument-hint: "<failure description> \| scan"`; `@~/.claude/get-shit-done/workflows/teach.md` in execution_context; `$ARGUMENTS` in context block; allowed-tools: Read, Write, Edit, Bash, Grep, Glob |
| 5 | `teach.md` encodes the full loop: telemetry → attribute → confirm → advisor-critic reflect → bounded edit (<=20 lines, one section) → append proposed → [y/N] ratify gate → source-only apply commit + separate ledger commit + confirm with npm run dev + git revert reversibility line; scan path proposes no edit | VERIFIED | `get-shit-done/workflows/teach.md` — all structural acceptance criteria pass: "lesson attribute", "lesson append", "lesson update", "lesson scan", "20 lines", "y/N", "npm run dev", "git revert", "gsd-local-patches", ".claude/", "advisor" all grep-confirmed; six pitfall guards encoded in `<constraints>`; two-commit pattern (source-only + separate ledger) explicit in Step 7; orchestrator evidence: fix in commit 3db6a3b confirms clean revert path |
| 6 | All implementation committed to source (`get-shit-done/`, `agents/`, `tests/`, `commands/gsd2/`) — nothing in `.claude/` runtime committed | VERIFIED | 09-01-SUMMARY.md key-files: created/modified list is `get-shit-done/bin/lib/lesson.cjs`, `get-shit-done/bin/gsd-tools.cjs`, `tests/lesson.test.cjs`; 09-02-SUMMARY.md: `get-shit-done/workflows/teach.md`, `commands/gsd2/teach.md`; no `.claude/` entries in either summary |

**Score:** 6/6 truths verified (structural + code-checkable)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/lesson.test.cjs` | 6 test groups for all lesson subcommands (TDD contract) | VERIFIED | Exists; `grep -c "runGsdTools(\['lesson'"` = 13; LSN- assertions present; common-bug-patterns.md fallback asserted; .claude/ non-start asserted |
| `get-shit-done/bin/lib/lesson.cjs` | CRUD + attribution + scan module | VERIFIED | 381 lines; exports readLessons, filterLessons, nextId, cmdAppend, cmdList, cmdUpdate, cmdBumpRecurrence, AGENT_FILE_MAP, attributeFile, pickAttribution, cmdAttribute, cmdScan; all guards present |
| `get-shit-done/bin/gsd-tools.cjs` | `require('./lib/lesson.cjs')` + `case 'lesson'` dispatch | VERIFIED | Line 183: `const lesson = require('./lib/lesson.cjs')`; line 838: `case 'lesson'`; all 6 sub-cases wired (append/list/update/bump-recurrence/attribute/scan) |
| `get-shit-done/workflows/teach.md` | Full teach loop with all guards | VERIFIED | All acceptance-criterion strings confirmed; two-commit pattern in Step 7; six pitfall constraints; scan path (Path A) and teach loop (Path B) both present |
| `commands/gsd2/teach.md` | `/gsd2:teach` slash command registration | VERIFIED | `name: gsd2:teach`; `argument-hint: "<failure description> \| scan"`; `@~/.claude/get-shit-done/workflows/teach.md`; `$ARGUMENTS`; all 6 allowed-tools present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `commands/gsd2/teach.md` | `teach.md` workflow | `@~/.claude/get-shit-done/workflows/teach.md` @-reference | VERIFIED | Exact path token `~/.claude/get-shit-done/workflows/teach.md` in execution_context; no bare `.claude/` or repo-root path |
| `teach.md` Steps 2/5/7/8 | `gsd-tools lesson` CLI | `lesson attribute / append / update / scan` bash calls in workflow prose | VERIFIED | All four subcommand calls present in workflow steps; Step 7 uses `lesson update --disposition applied --commit {hash}` + separate ledger commit |
| `teach.md` Step 7 apply assertion | non-`.claude/` source path guard | Explicit ASSERT block before Edit call | VERIFIED | "ASSERT: The resolved target path does NOT start with `.claude/`" in Step 7 prose; "does NOT contain `gsd-local-patches/`" also present |
| `gsd-tools.cjs` case 'lesson' | `lib/lesson.cjs` handlers | `require('./lib/lesson.cjs')` + dispatch switch | VERIFIED | Line 183 require; all 6 sub-cases call `lesson.*` functions; `lesson.cmdAppend`, `lesson.cmdList`, `lesson.cmdUpdate`, `lesson.cmdBumpRecurrence`, `lesson.cmdAttribute`, `lesson.cmdScan` |
| `lesson.cjs` `pickAttribution` | `trace.cjs` telemetry | lazy `require('./trace.cjs')` inside pickAttribution | VERIFIED | Lazy-require at lesson.cjs line 281; reuses `readTrace`/`filterTrace`; no re-implementation |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| TEACH-01 | 09-01, 09-02 | `/gsd2:teach` command exists; attribution is a unit-tested pure function writing nothing | SATISFIED | `attributeFile()` pure function GREEN in tests; teach.md Steps 2–6 wire the UX flow; `commands/gsd2/teach.md` registered |
| TEACH-02 | 09-02 | Ratified edits commit to source only (never `.claude/`); applied ledger record with commit hash | SATISFIED (structural + orchestrator evidence) | teach.md Step 7 source-only commit + separate ledger commit; assert blocks guard path; 3db6a3b fix confirmed clean two-commit pattern in dogfood; SC3 manual checkpoint pending independent re-execution |
| TEACH-03 | 09-01 | Ledger lifecycle: append → list → update disposition → bump-recurrence | SATISFIED | All four operations implemented and tested GREEN (18 assertions, 959/959 suite pass) |
| TEACH-04 | 09-01 | Auto-miner nominates recurring failures (recurrence ≥ threshold, non-applied); never edits; ledger-recurrence only | SATISFIED | `cmdScan` scoped to `readLessons` only; no `readTrace` / no VERIFICATION.md scan; scan test group GREEN; orchestrator evidence confirms write-nothing behavior |
| TEACH-05 | 09-02 | Loop is git-reversible: `git revert <commit> + npm run dev` documented in confirmation output | SATISFIED (structural + orchestrator evidence) | `git revert {hash}` in Step 8 confirmation and `<constraints>` Pitfall 5; `npm run dev` after revert explicit; 3db6a3b fix ensures source-only commit so revert never conflicts; independent re-execution is the manual checkpoint |

**Orphaned requirements:** LEARN-01 is reserved in REQUIREMENTS.md but is NOT a phase requirement ID (TEACH-01..05 are). Phase 9 materializes its intent. Human decision pending (see Human Verification item 4).

---

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments in modified files. No stub implementations. `cmdScan` is correctly scoped to ledger-recurrence only (the VALIDATION.md acceptance criterion `grep -L "VERIFICATION" lesson.cjs` has a false-positive because the word appears only in the comment `Does NOT scan VERIFICATION.md BLOCKERs` — the substantive behavior is correct: `cmdScan` calls `readLessons`, not `readTrace`, and no VERIFICATION.md path appears in any code path).

---

### Human Verification Required

Per 09-VALIDATION.md §Manual-Only Verifications, three behavioral guarantees are non-automatable:

**1. SC2 — No-auto-apply gate (TEACH-02)**
- What to do: Run `/gsd2:teach "<real failure>"`. When the `[y/N]` gate appears, answer `N`.
- Expected: `git status` clean for all source paths; lessons.jsonl shows `disposition: rejected` for that LSN record.
- Why human: The ratify gate is a human round-trip by design. Static grep proves `[y/N]` prose precedes the Apply step in teach.md, but cannot prove the orchestrator actually blocks and awaits input before any Edit call fires.

**2. SC3 — Real ratified bounded edit, source-only commit (TEACH-02)**
- What to do: Run `/gsd2:teach "<real failure>"`. Answer `y`. Run `git show --stat <apply_hash>`.
- Expected: Apply commit touches ONLY a source file (agents/ or get-shit-done/ or commands/gsd2/) — zero .claude/ entries, no lessons.jsonl. A separate follow-up commit shows lessons.jsonl with `disposition: applied` and a non-null `commit` field.
- Why human: Requires executing the loop against an actual failure. Orchestrator-level evidence from this session (commit 3db6a3b + subsequent dogfood run) already satisfies this, but independent re-execution is the full gate per the VALIDATION.md Manual-Only table.

**3. TEACH-05 — git-reversibility**
- What to do: `git revert <apply_hash>` then `npm run dev`.
- Expected: `git revert` exits 0; source file restored to pre-lesson state; working tree clean; runtime reflects the revert after `npm run dev`.
- Why human: Demonstrated at orchestrator level (3db6a3b fix ensures source-only apply commit so revert never conflicts with ledger), but cannot be re-proven statically.

**4. LEARN-01 reconciliation (human product decision)**
- What to do: Decide whether to mark LEARN-01 satisfied in REQUIREMENTS.md.
- Expected: Human marks it `satisfied-by-TEACH` or keeps it distinct (e.g., for a future cross-project intel store). Record the decision in REQUIREMENTS.md.
- Why human: LEARN-01 is a reserved requirement that Phase 9 materializes under the TEACH- namespace. Whether to retire LEARN-01 is a product-owner judgment. The 09-02-SUMMARY.md explicitly flags this as an open question.

---

## Summary

All six structural must-haves are verified against committed source. The 959-test suite passes with zero failures (`npm test`). Key link wiring is complete and all five TEACH- requirements are satisfied at the structural level. The LEARN-01 flag surfaces a pending human product decision (not a gap).

The two behaviors that rest on orchestrator-level attestation rather than independent code verification (SC2 no-auto-apply gate, SC3 source-only apply commit) were demonstrated in this session against the real gsd repo (including the 3db6a3b dogfood fix that proved the two-commit pattern is required for clean `git revert`). The 09-VALIDATION.md explicitly designates these as Manual-Only because they require a live LLM-executed ratification round-trip. Status: `human_needed`.

---

_Verified: 2026-06-08_
_Verifier: Claude (gsd-verifier)_
