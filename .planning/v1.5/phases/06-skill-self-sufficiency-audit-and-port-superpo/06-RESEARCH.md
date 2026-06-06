# Phase 6: Skill Self-Sufficiency — Audit and Port superpowers Gaps - Research

**Researched:** 2026-06-06
**Domain:** GSD meta-work (porting references and workflow/agent edits)
**Confidence:** HIGH

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- 4 confirmed gaps to port: execution-time TDD discipline, receiving-code-review, writing-skills→artifact-authoring guide, git-worktree technique.
- Form factor: references + workflow/agent edits only. No new commands. [STRONG]
- TDD discipline: default-ON where helpful (logic tasks); agent/prompt/workflow/reference edits exempt. [STRONG]
- When `tdd=true`, enforce Iron Law rigor: no production code without failing test first; watch-it-fail MANDATORY; rationalization table + red flags so agent self-checks. [STRONG]
- receiving-code-review: port as reference covering verify-before-implement, no performative agreement, push-back with technical reasoning, YAGNI check, clarify-all-unclear-before-implementing-any. [STRONG]
- writing-skills: port as reference covering (a) when a capability deserves its own artifact vs. Opus inline, and (b) how to author so model loads and obeys it (description = when-to-use, never workflow summary). [STRONG on shape; wording = Claude's discretion]
- worktree technique: port detect-existing-isolation, native-first, git-fallback, ignore-check, baseline test, sandbox-fallback. Phase 6 ships ONLY the technique reference. [STRONG on boundary]
- Phase 7 owns execute-phase worktree add→wave→merge orchestration and parallel-safety gate. Phase 6 deliberately does NOT build a gsd-tools worktree helper. [STRONG]
- Systematic-debugging: already covered by gsd-debugger (scientific method, persistent session file). No port needed. [STRONG, specialist-backed]

### Claude's Discretion

- Exact file names/locations for new references (under `get-shit-done/references/`, mirrored to runtime).
- Audit doc location and format.
- Whether TDD Iron Law lives inline in `tdd.md` or a sibling reference cross-linked from it.

### Deferred Ideas (OUT OF SCOPE)

- Worktree orchestration in execute-phase (add→wave→merge) + parallel-safety gate — Phase 7.
- Hard-removal of the superpowers plugin cache + `installed_plugins.json` — explicit follow-up after Phase 6.
- Full default-ON TDD for all production code — rejected.

---

## 14-Skill Coverage Audit

| # | superpowers skill | GSD coverage | Verdict | Notes |
|---|-------------------|--------------|---------|-------|
| 1 | brainstorming | discuss-phase (explore-options, signal-strength tagging) | COVERED | — |
| 2 | writing-plans | plan-phase + gsd-planner agent | COVERED | — |
| 3 | executing-plans | execute-plan + gsd-executor agent | COVERED | — |
| 4 | subagent-driven-development | wave-based parallel executor spawning | COVERED | — |
| 5 | dispatching-parallel-agents | execute-phase wave→gsd-executor spawning | COVERED | — |
| 6 | verification-before-completion | gsd2:verify-work + gsd-verifier + must_haves | COVERED | — |
| 7 | requesting-code-review | gsd2:review → REVIEWS.md (cross-AI external CLIs) | COVERED | producer side only |
| 8 | finishing-a-development-branch | gsd2:ship + pr-branch workflow | COVERED | — |
| 9 | systematic-debugging | gsd-debugger: hypothesis→test→root-cause-before-fix, persistent debug session | COVERED | verified this session; no port needed |
| 10 | using-superpowers | plugin meta-skill — irrelevant once plugin disabled | N/A | — |
| 11 | test-driven-development | tdd.md + gsd-executor `<tdd_execution>` — plan-time only; execution-time discipline absent | GAP 1 | port: Iron Law + watch-it-fail + rationalization/red-flags + agent-change exemption |
| 12 | receiving-code-review | no consumer-side reference exists; only REVIEWS.md producer | GAP 2 | port: verify-before-implement, no performative agreement, YAGNI check, push-back rules |
| 13 | writing-skills | no GSD-authoring guide exists; artifact decisions left implicit | GAP 3 | port: CSO rule, when-to-create, loophole-closing, one-good-example |
| 14 | using-git-worktrees | no technique reference exists; Phase 7 will need it for parallelization | GAP 4 | port: detect-isolation, native-first, git-fallback, ignore-check, baseline test, sandbox-fallback |

---

## Standard Stack

No libraries involved. This phase authors reference `.md` files and makes targeted text edits to existing workflow/agent prompt files. The "stack" is the existing GSD file tree.

---

## Architecture Patterns

### Source↔Runtime Mirror Rule

All GSD prompt files have two homes:

| Role | Path pattern | Git status | Path token style |
|------|-------------|------------|-----------------|
| Source (canonical) | `get-shit-done/…` or `agents/…` (root) | Committed | `$HOME/.claude/` or `~/.claude/` |
| Runtime (active) | `.claude/get-shit-done/…` or `.claude/agents/…` | Gitignored | Absolute `/home/cleversol/gsd2/mine/.claude/` |

Every edit to a source file must be replicated to its runtime twin (different only in path tokens). New reference files created under `get-shit-done/references/` must also appear under `.claude/get-shit-done/references/`.

**Agent source location:** root-level `agents/` directory (committed). Runtime: `.claude/agents/`. The diff between them is only path tokens (`$HOME/.claude/` vs `/home/cleversol/gsd2/mine/.claude/`). This was verified for `gsd-executor.md` and `gsd-planner.md`.

**Local patches:** `.claude/gsd-local-patches/agents/gsd-planner.md` exists as a separate diverged copy (2 extra lines behind `agents/gsd-planner.md`). Edits go to source `agents/gsd-planner.md` and must be forward-ported to both `.claude/agents/gsd-planner.md` and `.claude/gsd-local-patches/agents/gsd-planner.md`.

### Reference Loading Pattern

References are loaded via `@path` includes in agent/workflow files (eager) or read on-demand by executors. New references attach at the right consumption point, not globally. Prefer lazy load (executor reads on first need) over adding `@include` to the agent header, to avoid burdening every invocation with context that isn't always needed.

---

## Exact Edit Anchors

### Gap 1 — TDD Execution-Time Discipline

**Edit 1: `get-shit-done/references/tdd.md` (+ runtime twin)**
- Current state: defines RED-GREEN-REFACTOR, plan structure, when-to-use heuristic (264 lines). No Iron Law, no watch-it-fail, no rationalization table, no red-flags, no agent-change exemption.
- Edit: append (or insert near the top as a boxed rule) the following content. Faithful port from superpowers `test-driven-development/SKILL.md`:
  - **Iron Law (verbatim):** `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`
  - **Watch-it-fail (verbatim sense):** MANDATORY. Never skip. A test that passes immediately proves nothing — it may be testing the wrong thing, or the code may already exist.
  - **Agent/prompt/workflow/reference exemption:** Edits that change agent behavior via prompt, tools, or reference files are exempt from the Iron Law when the behavior is not unit-testable. Mark these tasks with `tdd="false"` explicitly so the planner doesn't force-tag them.
  - **Rationalization table** (11 rows from source skill — include verbatim):
    - "Too simple to test" → "Simple code breaks. Test takes 30 seconds."
    - "I'll test after" → "Tests passing immediately prove nothing."
    - "Tests after achieve same goals" → "Tests-after = 'what does this do?' Tests-first = 'what should this do?'"
    - "Already manually tested" → "Ad-hoc ≠ systematic. No record, can't re-run."
    - "Deleting X hours is wasteful" → "Sunk cost fallacy. Keeping unverified code is technical debt."
    - "Keep as reference, write tests first" → "You'll adapt it. That's testing after. Delete means delete."
    - "Need to explore first" → "Fine. Throw away exploration, start with TDD."
    - "Test hard = design unclear" → "Listen to test. Hard to test = hard to use."
    - "TDD will slow me down" → "TDD faster than debugging. Pragmatic = test-first."
    - "Manual test faster" → "Manual doesn't prove edge cases. You'll re-test every change."
    - "Existing code has no tests" → "You're improving it. Add tests for existing code."
  - **Red Flags list** (13 items — include verbatim; all mean "Delete code. Start over with TDD."):
    - Code before test
    - Test after implementation
    - Test passes immediately
    - Can't explain why test failed
    - Tests added "later"
    - Rationalizing "just this once"
    - "I already manually tested it"
    - "Tests after achieve the same purpose"
    - "It's about spirit not ritual"
    - "Keep as reference" or "adapt existing code"
    - "Already spent X hours, deleting is wasteful"
    - "TDD is dogmatic, I'm being pragmatic"
    - "This is different because..."
  - **Spirit vs. letter rule (verbatim):** "Violating the letter of the rules is violating the spirit of the rules."
- Runtime twin: `.claude/get-shit-done/references/tdd.md` (identical content, same path tokens — this file is already identical between source and runtime per prior verification)

**Edit 2: `agents/gsd-executor.md` (+ runtime twins)**
- File: `agents/gsd-executor.md` (source, committed); runtime: `.claude/agents/gsd-executor.md`
- Block: `<tdd_execution>` at L216-227 (confirmed by file read)
- Current content (L217-226):
  ```
  When a task has `tdd="true"`:

  **RED:** Write failing tests from the `<behavior>` spec. Run them — they should fail. Commit: `test({phase}-{plan}): add failing test for [feature]`

  **GREEN:** Write minimal code to pass from the `<implementation>` spec. Run — should pass. Commit: `feat({phase}-{plan}): implement [feature]`

  **REFACTOR (if needed):** Clean up, verify tests still pass. Commit only if changed: `refactor({phase}-{plan}): clean up [feature]`

  If first TDD task in plan, check test infrastructure is set up first.
  If RED doesn't fail, investigate the test. If GREEN doesn't pass, debug. If REFACTOR breaks tests, undo.
  ```
- Edit: add watch-it-fail enforcement and Iron Law reminder to the RED step. Insert after "Run them — they should fail.":
  > **STOP before continuing.** Verify the test output explicitly shows a failure. A test that passes immediately is wrong — delete code, start over. See Iron Law in `~/.claude/get-shit-done/references/tdd.md`.
  
  Also add rationalization counter at the bottom of the block: if any rationalization ("already manually tested," "too simple," "keep as reference") arises, treat it as a red flag and apply the Iron Law. The reference contains the full rationalization table.
- Also edit execution_flow step at L87: `If tdd="true", follow the TDD flow.` — extend to: `If tdd="true", follow the TDD flow and enforce the Iron Law (see tdd.md). Agent/prompt/workflow/reference edits are exempt.`
- Runtime twin: `.claude/agents/gsd-executor.md` — same edits, replace `~/.claude/` → `/home/cleversol/gsd2/mine/.claude/`

**Edit 3: `agents/gsd-planner.md` (+ runtime twins + local-patches twin)**
- File: `agents/gsd-planner.md` (source, committed); runtime: `.claude/agents/gsd-planner.md`; also `.claude/gsd-local-patches/agents/gsd-planner.md`
- Block: `## TDD Detection` at L122-124 in `<task_design>` section
- Current content (L122-124):
  ```
  ## TDD Detection

  If you can write `expect(fn(input)).toBe(output)` before writing `fn`, it's a TDD candidate. TDD features get dedicated plans (type: tdd) because RED→GREEN→REFACTOR cycles consume 40-50% context. Mark code-producing tasks with `tdd="true"` and a `<behavior>` block when appropriate.
  ```
- Edit: add exemption clause after the existing sentence:
  > **Exempt from tdd="true":** changes to agent behavior via prompt edits, tool/reference edits, and workflow-only modifications where behavior cannot be unit-tested. Mark these `tdd="false"` explicitly.
- Runtime twin: `.claude/agents/gsd-planner.md` — same edit
- Local patches: `.claude/gsd-local-patches/agents/gsd-planner.md` — same edit (this file is 2 extra lines behind source; apply the same exemption clause addition)

**Edit 4: `get-shit-done/workflows/execute-plan.md` (+ runtime twin)**
- Note: CONTEXT.md references `get-shit-done/agents/gsd-executor.md §<tdd_execution>` but the agent is at root `agents/gsd-executor.md`. Additionally, `execute-plan.md` (the workflow) has its own `<tdd_plan_execution>` block at L184-195. Both need edits:
- The `execute-plan.md` `<tdd_plan_execution>` block (L184-195) is the plan-level orchestration; the `gsd-executor.md` `<tdd_execution>` is the per-task enforcement. Gap 1 touches BOTH.
- Edit to `execute-plan.md` `<tdd_plan_execution>` step 2 (RED): add the same watch-it-fail stop point and Iron Law reference.
- Runtime twin: `.claude/get-shit-done/workflows/execute-plan.md` — same edits with absolute path tokens

### Gap 2 — Receiving Code Review

**New file: `get-shit-done/references/receiving-code-review.md` (+ runtime twin)**
- Location: `get-shit-done/references/receiving-code-review.md`
- Runtime: `.claude/get-shit-done/references/receiving-code-review.md`
- Content to port faithfully from superpowers `receiving-code-review/SKILL.md`:
  - **Response Pattern (6 steps):** READ → UNDERSTAND (restate in own words or ask) → VERIFY (check against codebase reality) → EVALUATE (technically sound for THIS codebase?) → RESPOND (technical acknowledgment or reasoned pushback) → IMPLEMENT (one item at a time, test each)
  - **Forbidden responses:** "You're absolutely right!" | "Great point!" / "Excellent feedback!" (performative) | "Let me implement that now" (before verification)
  - **Unclear items:** STOP — do not implement anything yet. "Items may be related. Partial understanding = wrong implementation."
  - **External reviewer 5-check:** (1) Technically correct for THIS codebase? (2) Breaks existing functionality? (3) Reason for current implementation? (4) Works on all platforms/versions? (5) Does reviewer understand full context?
  - **YAGNI check:** grep codebase for actual usage; if unused: "This endpoint isn't called. Remove it (YAGNI)?" Rule: "You and reviewer both report to me. If we don't need this feature, don't add it."
  - **Push back conditions:** breaks existing functionality; reviewer lacks full context; violates YAGNI; technically incorrect for this stack; legacy/compatibility reasons; conflicts with architectural decisions.
  - **Acknowledge correctly:** "Fixed. [Brief description of what changed]" | "Good catch - [specific issue]. Fixed in [location]." | just fix it — NO gratitude, DELETE "Thanks" and state the fix instead.
  - **Gracefully correcting pushback:** "You were right - I checked [X] and it does [Y]. Implementing now." — state correction factually, move on.
  - **GitHub thread:** reply in comment thread, not as top-level PR comment.

**Wiring edit 1: `get-shit-done/workflows/review.md` (+ runtime twin)**
- Consumer wiring point: `present_results` step at L156-176. Currently surfaces REVIEWS.md and tells user to run `/gsd2:plan-phase {N} --reviews`.
- Gap: no instruction exists for acting on review feedback (plan-phase.md has NO `--reviews` handler — confirmed by grep returning empty). The reference must be loaded at the moment feedback is consumed, not at review-collection time.
- Edit: add a guidance line at the end of the `present_results` step: "When acting on this feedback, load `@~/.claude/get-shit-done/references/receiving-code-review.md` before implementing any suggestion — verify each item against codebase reality first."
- Runtime twin: `.claude/get-shit-done/workflows/review.md` (absolute path tokens)

**Wiring edit 2: `get-shit-done/workflows/ship.md` (+ runtime twin)**
- Consumer wiring point: `optional_review` step at L82-95. Currently only asks whether user wants a review before merge.
- Edit: add guidance for the review-reception scenario — when external PR review comments are received after ship, load the receiving-code-review reference before responding.
- Runtime twin: `.claude/get-shit-done/workflows/ship.md` (absolute path tokens)

**Note on --reviews handler:** `plan-phase.md` has NO `--reviews` handler (grep confirmed empty). The `--reviews` flag referenced in review.md's output is aspirational — it points to a flow that doesn't exist yet. Phase 6 wiring goes into review.md's present_results step only (the reference load instruction), not into a missing plan-phase handler. The planner must NOT create tasks that add a `--reviews` handler to plan-phase.md — that is out of scope for Phase 6.

### Gap 3 — GSD Artifact-Authoring Guide

**New file: `get-shit-done/references/artifact-authoring.md` (+ runtime twin)**
- Location: `get-shit-done/references/artifact-authoring.md`
- Runtime: `.claude/get-shit-done/references/artifact-authoring.md`
- Content to port from superpowers `writing-skills/SKILL.md` + reshape for GSD context:
  - **CSO rule (Claude Search Optimization):** The `description` field = WHEN to use (triggering conditions ONLY), never a workflow summary. "Testing revealed that when a description summarizes the skill's workflow, Claude may follow the description instead of reading the full skill content." One test case: "code review between tasks" as description caused ONE review even though the flowchart showed TWO.
  - **When to create a dedicated GSD artifact** (reference / tool / agent / workflow edit):
    - Technique wasn't intuitively obvious
    - Reference across projects
    - Pattern applies broadly
    - Others benefit
    - A recurring question whose answer, if wrong, degrades quality
  - **Do NOT create when:**
    - One-off solution
    - Standard practice documented elsewhere
    - Project-specific (put in CLAUDE.md)
    - Mechanically enforceable (if a regex/validation can enforce it, automate it — save documentation for judgment calls)
  - **Authoring discipline:**
    - Close every loophole explicitly — don't just state the rule, forbid specific workarounds. Bad: "Write code before test? Delete it." Good: includes "Don't keep it as reference / Don't adapt it / Don't look at it / Delete means delete."
    - "Violating the letter of the rules is violating the spirit of the rules." — add early for discipline-enforcing artifacts.
    - One excellent example beats many mediocre ones.
    - Rationalization table for discipline-enforcing artifacts: build from anticipated pushback, not hypotheticals.
    - Red flags list for self-check: each red flag means "stop and apply the rule, not the rationalization."
  - **GSD-specific addition (not in superpowers):** the form-factor decision — reference vs. workflow edit vs. agent edit vs. new command. Bias from PROJECT.md: loops/skills over command/agent proliferation. Reserve new commands for genuinely new entry points with distinct lifecycles; prefer extending existing workflows with reference-load instructions.

### Gap 4 — Git Worktree Technique Reference

**New file: `get-shit-done/references/git-worktree.md` (+ runtime twin)**
- Location: `get-shit-done/references/git-worktree.md`
- Runtime: `.claude/get-shit-done/references/git-worktree.md`
- Content to port faithfully from superpowers `using-git-worktrees/SKILL.md`:
  - **Step 0 — Detect existing isolation (ALWAYS first):**
    ```bash
    GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
    GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
    ```
    If `GIT_DIR != GIT_COMMON`: already in linked worktree. Do NOT create another.
    Submodule guard: `git rev-parse --show-superproject-working-tree 2>/dev/null`
  - **Step 1a — Native tools first:** EnterWorktree, WorktreeCreate, /worktree command, --worktree flag. Use these if available.
  - **Step 1b — Git worktree fallback (directory priority):**
    1. Explicit user preference
    2. Existing `.worktrees/`
    3. Existing `worktrees/`
    4. Existing global `~/.config/superpowers/worktrees/$project`
    5. Default `.worktrees/`
  - **Safety (ignore check):** `git check-ignore -q .worktrees 2>/dev/null`. If NOT ignored: add to `.gitignore`, commit, THEN proceed.
  - **Sandbox fallback:** if `git worktree add` fails with permission error → work in place, run setup and baseline tests in place.
  - **Step 3 — Project setup:** `npm install` / `cargo build` / `pip install -r requirements.txt` / `poetry install` / `go mod download`
  - **Step 4 — Baseline test verification:** run tests; if fails → report, ask whether to proceed or investigate.
  - **Red flags:** never create worktree when Step 0 detects existing isolation | never use `git worktree add` when native tool exists | skip ignore verification | skip baseline test.
  - **Phase 7 boundary note:** This reference documents the technique only. The execute-phase add→wave→merge orchestration and the parallel-safety gate are Phase 7 scope. Do not extend this reference with orchestration logic.

---

## Source↔Runtime Mirror Table for All Phase 6 Files

| Action | Source (committed) | Runtime (gitignored) | Notes |
|--------|-------------------|---------------------|-------|
| EDIT | `get-shit-done/references/tdd.md` | `.claude/get-shit-done/references/tdd.md` | Both identical currently; extend both |
| EDIT | `agents/gsd-executor.md` | `.claude/agents/gsd-executor.md` | path-token diff only |
| EDIT | `agents/gsd-planner.md` | `.claude/agents/gsd-planner.md` | path-token diff only |
| EDIT (3rd copy) | — | `.claude/gsd-local-patches/agents/gsd-planner.md` | Same edit; this copy is 2 lines behind source |
| EDIT | `get-shit-done/workflows/execute-plan.md` | `.claude/get-shit-done/workflows/execute-plan.md` | path-token diff only |
| EDIT | `get-shit-done/workflows/review.md` | `.claude/get-shit-done/workflows/review.md` | path-token diff only |
| EDIT | `get-shit-done/workflows/ship.md` | `.claude/get-shit-done/workflows/ship.md` | path-token diff only |
| CREATE | `get-shit-done/references/receiving-code-review.md` | `.claude/get-shit-done/references/receiving-code-review.md` | new file |
| CREATE | `get-shit-done/references/artifact-authoring.md` | `.claude/get-shit-done/references/artifact-authoring.md` | new file |
| CREATE | `get-shit-done/references/git-worktree.md` | `.claude/get-shit-done/references/git-worktree.md` | new file |

Total: 3 new reference files (×2 for runtime = 6 new files), 5 existing files edited (×2 for runtime = 10 edits), plus 1 additional local-patches edit for gsd-planner.md.

---

## CONTEXT.md Anchor Corrections

CONTEXT.md contains two pointer inaccuracies that downstream agents (planner, executor) must use the corrected versions of:

| CONTEXT.md states | Actual (verified) | Impact |
|-------------------|------------------|--------|
| `get-shit-done/agents/gsd-executor.md` | `agents/gsd-executor.md` (root level, no `get-shit-done/` prefix) | All task file paths must use root `agents/` |
| `§<tdd_execution> (~L216)` | Block IS named `<tdd_execution>` and IS at L216 — matches exactly | No correction needed here |
| `get-shit-done/workflows/plan-phase.md` as TDD-tagging heuristic location | `agents/gsd-planner.md` L122 `<task_design>` `## TDD Detection` | plan-phase.md has ZERO tdd hits; planner agent has the heuristic |

---

## Common Pitfalls

### Pitfall 1: Editing .claude/ agent files without updating the source
The `.claude/` tree is gitignored. Edits there are lost after a reinstall. Always edit source (`agents/`, `get-shit-done/`) first; replicate to runtime with path-token substitution.

### Pitfall 2: Forgetting the gsd-local-patches twin for gsd-planner.md
`.claude/gsd-local-patches/agents/gsd-planner.md` is a third copy of gsd-planner.md. It currently lags source by 2 lines (the TECHNICAL UNKNOWN block and mid-planning-unknowns guidance). Any Gap 1 edit to gsd-planner.md must be applied to all three copies.

### Pitfall 3: Assuming plan-phase.md has the planner TDD heuristic
Grep confirms `plan-phase.md` has zero TDD references. The heuristic lives in `agents/gsd-planner.md` `<task_design>` section. Executors MUST edit the agent file, not the workflow.

### Pitfall 4: Assuming --reviews is a live handler
`plan-phase.md` has no `--reviews` handler. review.md outputs the flag as aspirational next-step guidance only. Gap 2 wiring goes only into review.md's `present_results` step (a reference-load instruction), not into a new plan-phase handler.

### Pitfall 5: Over-porting worktree content into Gap 4
Gap 4 is the technique primitive only. Do not add: gsd-tools CLI helpers, execute-phase integration, or parallel-safety gate logic. Those are Phase 7 scope.

### Pitfall 6: Porting rationalization table without the "Delete code" conclusion
The superpowers red-flags section ends with: "All red flags mean: Delete code. Start over with TDD." This conclusion must be included, not just the list. Without it, the list is descriptive, not prescriptive.

---

## Validation Architecture

Nyquist validation is ENABLED (key absent from `.planning/config.json` → treated as enabled).

### Nature of Phase 6 Work

Phase 6 edits are exclusively prompt/reference/workflow/agent text files. None of the outputs are executable code; none produce unit-testable functions. The standard unit test pattern (`expect(fn(input)).toBe(output)`) cannot be applied.

### What Can Be Validated (Load-Point Assertions)

Validation is structural, not behavioral: confirm that the ported content physically exists at the right location and that the wiring points reference the new files correctly.

### Test Framework

No test framework install needed. Validation uses bash assertions and grep.

| Property | Value |
|----------|-------|
| Framework | bash assertions (grep -q, test -f) |
| Config file | none |
| Quick run command | `bash -c 'test -f get-shit-done/references/receiving-code-review.md && echo PASS || echo FAIL'` |
| Full suite command | see Wave N verification tasks below |

### Phase Requirements → Validation Map

| Req | Behavior | Validation type | Command |
|-----|----------|----------------|---------|
| Audit table exists | 14 skills mapped in audit artifact | grep check | `grep -c "COVERED\|GAP\|N/A" {audit-file}` ≥ 14 |
| tdd.md contains Iron Law | Iron Law verbatim present | grep check | `grep -q "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST" get-shit-done/references/tdd.md` |
| tdd.md contains rationalization table | rationalization rows present | grep check | `grep -q "Too simple to test" get-shit-done/references/tdd.md` |
| tdd.md contains agent-change exemption | exemption clause present | grep check | `grep -q "agent.*prompt.*workflow.*reference\|prompt.*workflow.*reference" get-shit-done/references/tdd.md` |
| gsd-executor `<tdd_execution>` hardened | watch-it-fail STOP present | grep check | `grep -q "STOP before continuing" agents/gsd-executor.md` |
| gsd-planner TDD Detection exemption | exemption clause present | grep check | `grep -q "Exempt from tdd" agents/gsd-planner.md` |
| receiving-code-review.md exists | new reference file created | file check | `test -f get-shit-done/references/receiving-code-review.md` |
| receiving-code-review.md contains response pattern | READ→UNDERSTAND→VERIFY present | grep check | `grep -q "READ.*UNDERSTAND.*VERIFY\|UNDERSTAND.*VERIFY.*EVALUATE" get-shit-done/references/receiving-code-review.md` |
| artifact-authoring.md exists | new reference file created | file check | `test -f get-shit-done/references/artifact-authoring.md` |
| artifact-authoring.md contains CSO rule | description=WHEN language present | grep check | `grep -q "description.*WHEN\|when to use.*never.*workflow" get-shit-done/references/artifact-authoring.md` |
| git-worktree.md exists | new reference file created | file check | `test -f get-shit-done/references/git-worktree.md` |
| git-worktree.md contains Step 0 detection | GIT_DIR/GIT_COMMON detection present | grep check | `grep -q "GIT_COMMON\|GIT_DIR" get-shit-done/references/git-worktree.md` |
| review.md wired | reference load instruction present | grep check | `grep -q "receiving-code-review" get-shit-done/workflows/review.md` |
| ship.md wired | reference load instruction present | grep check | `grep -q "receiving-code-review" get-shit-done/workflows/ship.md` |
| runtime twins exist | .claude/ mirrors present | file check | `test -f .claude/get-shit-done/references/receiving-code-review.md && test -f .claude/get-shit-done/references/git-worktree.md && test -f .claude/get-shit-done/references/artifact-authoring.md` |

### Wave 0 Gaps

None — no test framework install needed. All validation is grep/file-check assertions runnable immediately after file creation.

### Sampling Rate

- Per task commit: `test -f {created-or-edited-file} && echo PASS`
- Per wave merge: run all grep assertions in the table above
- Phase gate: full grep suite green before `/gsd2:verify-work`

---

## Open Questions

1. **gsd-local-patches/agents/gsd-planner.md divergence**
   - What we know: This file is 2 lines behind `agents/gsd-planner.md` (missing the TECHNICAL UNKNOWN block). It's unclear whether it should be brought fully in sync with source or kept as a deliberate override.
   - What's unclear: The purpose of `gsd-local-patches/` is not documented — it may be a staging area for local overrides not yet ready to commit to source.
   - Recommendation: Apply ONLY the Gap 1 exemption-clause edit (the narrow change this phase owns). Do not attempt to reconcile the full divergence — that could break something intentional.

2. **Audit document location**
   - What we know: CONTEXT.md says "Audit doc location/format: Claude's discretion; a table is sufficient; phase dir."
   - Recommendation: Write the audit as a section in the SUMMARY.md (standard phase output) or as `{phase_dir}/06-AUDIT.md`. The latter is preferable — it's a standalone artifact the verifier can reference and it stays in the phase directory alongside other phase artifacts.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `agents/gsd-executor.md` (full), `agents/gsd-planner.md` (TDD Detection section), `get-shit-done/references/tdd.md` (confirmed present), `get-shit-done/workflows/execute-plan.md` `<tdd_plan_execution>` L184-195, `get-shit-done/workflows/review.md` L156-176, `.planning/v1.5/phases/06-*/06-CONTEXT.md` (full)
- Direct file reads: all 4 superpowers source skills (full content extracted for faithful port)
- git ls-files: confirmed `agents/` at root is committed source for all agent files
- diff: confirmed source↔runtime diff is path tokens only for gsd-executor.md
- grep: confirmed plan-phase.md has zero TDD references; plan-phase.md has zero reviews/REVIEWS references

### Secondary (MEDIUM confidence)
- `.gitignore` read confirming `.claude/` is fully gitignored
- `.claude/gsd-local-patches/` enumeration confirming three-copy situation for gsd-planner.md

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Audit table: HIGH — all 14 skills verified against actual GSD files
- Edit anchors: HIGH — file paths and line numbers verified by direct read
- Portable content: HIGH — source skills read in full, exact quotes extracted
- Wiring points: HIGH — review.md L156-176 and ship.md L82-95 confirmed by read; --reviews absence confirmed by grep
- Source↔runtime mirror: HIGH — gitignore and git ls-files both checked
- gsd-local-patches situation: MEDIUM — file exists and was diffed, but the purpose of the directory is inferred not documented

**Research date:** 2026-06-06
**Valid until:** stable (these are prompt files; no library version expiry)
