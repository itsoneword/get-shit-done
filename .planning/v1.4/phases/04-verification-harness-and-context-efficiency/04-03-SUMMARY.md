---
phase: 04-verification-harness-and-context-efficiency
plan: 03
subsystem: agents
tags: [verify-loop, agents, gsd-tools, must-haves, evaluator-optimizer]

# Dependency graph
requires:
  - phase: 04-02
    provides: dependency graph identifying all standalone callers of gsd-verifier, gsd-debugger, gsd-fixer
  - phase: existing
    provides: gsd-verifier, gsd-debugger (find_root_cause_only mode), gsd-fixer, parseMustHavesBlock helper, output() core helper
provides:
  - loop-mode invocation contract on gsd-verifier (## LOOP VERIFY RESULT block)
  - loop-mode invocation contract on gsd-fixer (## FIXES COMPLETE (loop) block, verify-loop/fix commit prefix)
  - confirmation that gsd-debugger find_root_cause_only mode is investigator-ready (no source change needed)
  - must_haves verify: schema documented in phase-prompt.md template
  - `gsd-tools.cjs verify commands <plan>` subcommand executing verify: assertions
  - parseVerifyCommands helper for plan-time YAML parsing
affects: [04-04, execute-phase, plan-phase, gsd2:verify-work, gsd2:fix, gsd2:debug]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "agent loop-mode flag pattern: structured input block triggers alternate process tree; standalone path is default"
    - "regex-as-string convention for verify expect: /pattern/ wrapped value -> RegExp; bare value -> string equality"
    - "loop commit prefix convention: verify-loop/fix/attempt-<N> for git-log searchability"
    - "fresh-context invariant baked into agent prompt: loop mode does NOT load executor history"

key-files:
  created: []
  modified:
    - get-shit-done/templates/phase-prompt.md
    - get-shit-done/bin/lib/verify.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - agents/gsd-verifier.md
    - agents/gsd-fixer.md

key-decisions:
  - "gsd-debugger required no source change — find_root_cause_only mode + symptoms_prefilled flag + ROOT CAUSE FOUND / INVESTIGATION INCONCLUSIVE return blocks all pre-existed (Task 1 confirmed by grep, no commit)"
  - "verify cmds with bare regex (e.g. ^[0-4]$) treated as string equality unless wrapped in /.../ — matches plan template documentation; existing 04-01-PLAN.md verify entries fail under this rule (plan-author bug, not verifier bug)"
  - "Wrote new parseVerifyCommands helper instead of extending parseMustHavesBlock — that helper has a latent 4-space-indent bug (real plans use 2-space) and is reused by verify-artifacts/verify-key-links; new helper avoids regression risk"
  - "verify commands subcommand always emits JSON regardless of --raw flag — caller pipelines (jq, loop verifier) need parseable output unconditionally; sibling verify commands' rawValue strings ('valid'/'invalid') would break the loop contract"
  - "Loop verifier in Step LOOP-1 invokes `gsd-tools.cjs verify commands <plan_path>` rather than executing inline verify_commands from the orchestrator message — plan_path is source of truth (re-parses latest committed plan); inline list is contract redundancy for shape validation"
  - "Fixer loop output emits BOTH `iteration` (AGENT-SPEC contract field) AND `loop_iteration` (auditability/git-log marker) — intentional duplicate per plan spec"

patterns-established:
  - "Two-mode agent pattern: standalone (default, full process) + loop (signaled by structured input block, alternate steps, restricted tool surface). Both modes preserved in same .md file via Step 0.5 detection branch."
  - "Source/runtime mirror: edits to agents/{name}.md AND get-shit-done/{path} mirrored to .claude/{path}; only source committed (.claude/ is gitignored)."

requirements-completed: []  # Plan declared `requirements: []`

# Metrics
duration: ~12min
completed: 2026-05-07
---

# Phase 04 Plan 03: Loop Primitives Summary

**Adapted gsd-verifier and gsd-fixer with loop-invocation modes, added `verify commands` CLI subcommand executing must_haves verify: assertions, and extended phase-prompt.md template with the verify: schema — all four primitives needed for Plan 04-04 to wire the verify-loop into execute-phase.**

## Performance

- **Duration:** ~10 min (start 17:15:34Z, end 17:25:44Z)
- **Started:** 2026-05-07T17:15:34Z
- **Completed:** 2026-05-07T17:25:44Z
- **Tasks:** 5 (1 verification-only, 4 implementing)
- **Files modified:** 5 source files (+ mirrored to runtime, runtime gitignored)

## Accomplishments

- **Verifier loop mode:** Added Step 0.5 mode detection and Step LOOP-1/2/3 process; loop runs `gsd-tools verify commands` and emits `## LOOP VERIFY RESULT` JSON block with the AGENT-SPEC `{status, iteration, trace_id, score, total, gaps[]}` shape.
- **Fixer loop mode:** Added LOOP-1..LOOP-5 process; classification short-circuit for `not-yet-built`/`unrelated`; commits via `gsd-tools commit "verify-loop/fix/attempt-<N>: ..."`; emits `## FIXES COMPLETE (loop)` JSON with `loop_iteration` + `iteration` + `trace_id`.
- **Debugger investigator-ready:** Confirmed by grep — no source change. RESEARCH §1 claim verified.
- **Schema extension:** phase-prompt.md frontmatter snippet and `### The verify: block` subsection document `cmd`/`expect`/`type` fields, regex semantics, backward compatibility, and `verify_after` task attribute.
- **CLI subcommand:** `gsd-tools.cjs verify commands <plan>` parses must_haves > truths > verify[] entries via new `parseVerifyCommands` helper, runs each cmd (30s timeout, 1024-char actual truncation), compares against expect (regex if `/.../` wrapped, else string equality), returns `{all_passed, passed, total, results: [{truth, cmd, expect, type, actual, passed, reason}]}`.

## Task Commits

Task 1 (gsd-debugger investigator-ready confirmation) had no source change — confirmed via grep, no commit needed (note in this SUMMARY satisfies the recording requirement).

1. **Task 2: Extend must_haves schema** — `812e223` (feat)
2. **Task 3: Add cmdVerifyCommands subcommand** — `b102398` (feat)
3. **Task 4: Adapt gsd-verifier with loop mode** — `e73d6e7` (feat)
4. **Task 5: Adapt gsd-fixer with loop mode** — `1b2d176` (feat)

**Plan metadata commit:** _to follow_ (state advance + SUMMARY.md commit)

## Files Created/Modified

- `get-shit-done/templates/phase-prompt.md` — Added `verify:` block to frontmatter snippet; new `### The verify: block` subsection documenting cmd/expect/type semantics, backward-compat note, `verify_after` task attribute reference. Mirrored to `.claude/get-shit-done/templates/phase-prompt.md`.
- `get-shit-done/bin/lib/verify.cjs` — New `parseVerifyCommands(content)` helper, new `cmdVerifyCommands(cwd, planFilePath, raw)` exported function, `child_process.execSync` import, type/timeout/actual-truncation constants. Mirrored to `.claude/get-shit-done/bin/lib/verify.cjs`.
- `get-shit-done/bin/gsd-tools.cjs` — Added `commands` branch in verify subcommand dispatcher; updated help comment block. Mirrored to `.claude/get-shit-done/bin/gsd-tools.cjs`.
- `agents/gsd-verifier.md` — Added "Invocation Modes" header note, Step 0.5 mode detection, `## Loop Mode Process` section with LOOP-1/2/3, dual-mode return note in `## Return to Orchestrator`. Mirrored to `.claude/agents/gsd-verifier.md`.
- `agents/gsd-fixer.md` — Added `## Loop Mode Process` section with LOOP-1..LOOP-5, classification short-circuit logic, verify-loop/fix commit prefix convention, dual-output return paths. Mirrored to `.claude/agents/gsd-fixer.md`.

## Decisions Made

See `key-decisions` in frontmatter — captured there for STATE.md extraction. Highlights:

1. **Regex semantics literal-from-plan-template:** verify `expect` strings match per plan documentation — string equality unless wrapped in `/.../`. 04-01-PLAN's verify entries (`^[0-4]$`, `^0$`, etc.) were authored without this convention and now report `passed: false` under this strict rule. This is a pre-existing plan-author bug, not a verifier bug. The acceptance criteria for Task 3 only require JSON shape and `results.length > 0`, which both hold.
2. **New parser instead of extending existing one:** `parseMustHavesBlock` in `frontmatter.cjs` has a latent 4-space-indent assumption that doesn't match real plans (which use 2-space). It's already broken for `verify artifacts`/`verify key-links` callers — they currently return "no entries found" silently. Touching it risks breaking the silent-pass-through behavior other workflows depend on. Wrote a focused new helper (`parseVerifyCommands`) that handles the real 2-space indent and dynamically locks dash-indent on first sight.
3. **Always-JSON output for verify commands:** Sibling verify subcommands (`artifacts`, `key-links`) emit string rawValues like `'valid'`/`'invalid'` under `--raw`, but the verify-loop's downstream `jq` parsing requires JSON unconditionally. So `cmdVerifyCommands` ignores the rawValue parameter and always emits structured JSON.
4. **Plan_path as source of truth in loop mode:** AGENT-SPEC includes `verify_commands` inline in the orchestrator→verifier message, but the verifier's Step LOOP-1 calls `gsd-tools.cjs verify commands <plan_path>` to re-parse the file. The inline list is contract redundancy (shape validation, observability); the file is what runs. This is documented inline in the verifier .md so the future loop-orchestrator (Plan 04-04) doesn't get confused.

## Deviations from Plan

### Minor — `truths:` count assertion (Task 2)

Acceptance criterion read: `grep -c 'truths:' .claude/get-shit-done/templates/phase-prompt.md` is unchanged from before this task (existing docs preserved).

Pre-task count: 2. Post-task count: 4. Both pre-existing occurrences (lines 28 and 563 — the frontmatter snippet and the long-form Structure example) remain in place. The two new occurrences are: line 611 (prose mention "Each entry under `truths:`...") and line 617 (the example YAML in `### The verify: block`). The criterion's intent ("existing docs preserved") is satisfied; the literal count went up because the new subsection necessarily mentions `truths:`. No removal occurred.

**Impact:** None — additive expansion.
**Committed in:** `812e223` (Task 2 commit).

### Documented — Bare-regex `expect` values in 04-01-PLAN.md fail under string equality (Task 3)

The verify subcommand correctly reports `passed: false` for 04-01-PLAN's four verify entries because their `expect` strings (`"^[0-4]$"`, `"ok"`, `"^0$"`) are interpreted as string equality per the plan template's documented convention (regex requires `/.../` wrapping). The acceptance criteria for Task 3 only require parseable JSON with non-empty results, which both hold:

```json
{ "all_passed": false, "passed": 0, "total": 4, "results": [4 rows] }
```

**Impact:** None on Plan 04-03 acceptance. Author of 04-01 plan wrote verify entries before this convention was documented; they should be re-authored with `/.../` wrapping or string-equality expects (e.g., `expect: "1"` for "exactly one phase"). This is a Plan 04-04 concern (or a follow-up 04-01 patch), not blocking.

---

**Total deviations:** 1 minor (count assertion intent vs literal), 1 documented (bare-regex semantics).
**Impact on plan:** Zero scope creep. All five tasks acceptance criteria pass.

## AGENT-SPEC Contract Adherence

**Zero deviations from AGENT-SPEC contracts.** Quoted shapes verbatim:

- Verifier output: `{status, iteration, trace_id, score, total, gaps: [{truth, status, reason, cmd, actual_output, expected}]}` ✓
- Fixer output: `{status, commit_hash, files_changed, fix_summary, iteration, trace_id}` + extra `loop_iteration` per plan instruction ✓
- Verifier input fields documented in agent .md ✓
- Fixer input fields parsed in Step LOOP-1 ✓

## Sample Output

`node .claude/get-shit-done/bin/gsd-tools.cjs verify commands .planning/phases/04-verification-harness-and-context-efficiency/04-01-PLAN.md --raw` (truncated):

```json
{
  "all_passed": false,
  "passed": 0,
  "total": 4,
  "results": [
    {
      "truth": "init progress accepts --scoped flag and returns phases trimmed to current ±1 / next ±1 (≤4 entries)",
      "cmd": "node .claude/get-shit-done/bin/gsd-tools.cjs init progress --scoped --raw | jq '.phases | length'",
      "expect": "^[0-4]$",
      "type": "integration",
      "actual": "2\n",
      "passed": false,
      "reason": "output mismatch"
    },
    {
      "truth": "roadmap analyze accepts --scoped flag and returns trimmed phase slice",
      "cmd": "node .claude/get-shit-done/bin/gsd-tools.cjs roadmap analyze --scoped --raw | jq '.phases | length'",
      "expect": "^[0-4]$",
      "type": "integration",
      "actual": "2\n",
      "passed": false,
      "reason": "output mismatch"
    },
    { "...": "two more rows similar — full output is 51 lines" }
  ]
}
```

The shape matches the AGENT-SPEC verifier output contract (after the verifier loops over `results` to build `gaps`). `actual` field max length across all four rows is 2 chars — well under the 1024-char prompt-injection mitigation cap.

## Issues Encountered

- **Initial parser indent mismatch (Task 3):** First version of `parseVerifyCommands` assumed 4-space indent for `truths:` (matching the broken `parseMustHavesBlock` assumption). Real plans use 2-space. Caught immediately when test invocation returned `no-verify`; rewrote parser to dynamically lock indent at first `truths:` sighting and use that as the block boundary. ~5 minutes of debugging.
- **JSON output vs `--raw` rawValue:** Initial implementation passed `'valid'`/`'invalid'` rawValue to `output()`, mirroring sibling verify subcommands. Test invocation with `--raw` returned the bare string and broke the `jq` acceptance check. Fixed by always emitting structured JSON regardless of `--raw` (loop verifier needs parseable output unconditionally).

## Next Phase Readiness

- **Plan 04-04 ready:** All four primitives delivered — loop-mode verifier, loop-mode fixer, investigator (debugger) confirmed unchanged, verify schema documented, `verify commands` CLI runnable. Plan 04-04 wires these into `execute-phase.md` as the orchestrator.
- **Schema authoring guidance:** Future plans authoring `verify:` blocks should wrap regex expects in `/.../` (e.g. `expect: "/^[0-4]$/"` not `"^[0-4]$"`). 04-01-PLAN's existing entries can be patched as a non-blocking follow-up.
- **Latent issue surfaced (out of scope):** `parseMustHavesBlock` in `frontmatter.cjs` does not match real-world 2-space indents — `verify artifacts` and `verify key-links` silently return "no blocks found" for all current plans. Logged here for visibility; not in 04-03 scope. Should be addressed in a separate fix plan.

## Self-Check: PASSED

- [x] Task 1 confirmation: gsd-debugger has all four required markers (`find_root_cause_only`, `symptoms_prefilled`, `## ROOT CAUSE FOUND`, `INVESTIGATION INCONCLUSIVE`) — confirmed by grep, source unchanged.
- [x] Task 2: phase-prompt.md has `### The verify: block`, `verify_after`, `unit | integration | e2e`, ≥1 `verify:` in must_haves block, line count grew (610 → 655). Commit `812e223` exists.
- [x] Task 3: `cmdVerifyCommands` exported in verify.cjs, dispatched in gsd-tools.cjs, returns parseable JSON with `all_passed`/`results` keys, 4 result rows from 04-01-PLAN.md, max actual length 2 ≤ 1024, sibling verify subcommands still exit 0. Commit `b102398` exists.
- [x] Task 4: gsd-verifier has `LOOP VERIFY RESULT`, `verify_commands`, `Step LOOP-1`, `AGENT-SPEC.md`, `## Return to Orchestrator`, `## Verification Complete`, frontmatter ≥4 fields, line count grew (364 → 451). Commit `e73d6e7` exists.
- [x] Task 5: gsd-fixer has `loop_iteration`, `FIXES COMPLETE (loop)`, `verify-loop/fix`, `AGENT-SPEC.md`, `## Loop Mode Process`/`Step LOOP-1`, `classification`, bare `## FIXES COMPLETE` preserved, frontmatter ≥4 fields, line count grew (177 → 245). Commit `1b2d176` exists.
- [x] Files in git diff (HEAD~4..HEAD): `agents/gsd-fixer.md`, `agents/gsd-verifier.md`, `get-shit-done/bin/gsd-tools.cjs`, `get-shit-done/bin/lib/verify.cjs`, `get-shit-done/templates/phase-prompt.md`. `gsd-debugger.md` is **NOT** in the diff (Task 1 invariant).
- [x] Runtime mirror: all five edits propagated to `.claude/...` (verified by `diff -q` after each `cp`).

---
*Phase: 04-verification-harness-and-context-efficiency*
*Completed: 2026-05-07*
