# Phase 4: Verification Harness and Context Efficiency — Research

**Researched:** 2026-05-05
**Domain:** Agentic orchestration, GSD internal tooling
**Confidence:** HIGH (all findings sourced directly from codebase)

---

## 1. Adaptation Surface for the Trio

### gsd-verifier (`.claude/agents/gsd-verifier.md`)

**Frontmatter** (lines 1–11):
- `name: gsd-verifier`, `description`, `tools: Read, Write, Bash, Grep, Glob`, `color: green`
- No `modes:` field. No invocation-mode support.

**Process structure** (Steps 0–10 + output):
- Entry: check prior VERIFICATION.md; if found, enter re-verification mode
- Core: load context → establish must_haves → verify truths (3 levels) → key links → requirements → anti-patterns → human items → determine status → structure `gaps:` YAML → write VERIFICATION.md
- Exit: returns structured `## Verification Complete` block; explicitly says "Do not commit"

**What must change for loop mode:**
- Add `mode: loop | standalone` frontmatter flag (or read from `<files_to_read>` block)
- In loop mode: consume `verify:` commands from must_haves instead of deriving truths from goal
- Output: structured `## LOOP VERIFY RESULT` block with `status: pass|fail`, per-command results, not a full VERIFICATION.md file
- The `## Return to Orchestrator` section (lines 319–350) is the right shape; extend, don't replace
- Current re-verification mode (Step 0) is reusable as the iteration-N re-run path

### gsd-debugger (`.claude/agents/gsd-debugger.md`)

**Frontmatter** (lines 1–11):
- `name: gsd-debugger`, `description`, `tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch`, `color: orange`
- `modes:` block (lines 441–450): `symptoms_prefilled: true`, `goal: find_root_cause_only`, `goal: find_and_fix`

**Process structure:**
- Entry: check active sessions, create debug file, gather symptoms (unless `symptoms_prefilled`)
- Core: investigation_loop (Phase 0 knowledge base → Phase 1 gather → Phase 2 hypothesize → Phase 3 test → Phase 4 evaluate)
- Exit paths: `return_diagnosis` (for `find_root_cause_only`), `fix_and_verify`, checkpoint
- Debug file at `.planning/debug/{slug}.md` with append-only Evidence/Eliminated sections

**What must change for loop mode (investigator role):**
- Add `goal: find_root_cause_only` to the Task prompt — this already exists and suppresses fix
- `symptoms_prefilled: true` already skips symptom gathering — use it; pass verifier failure report as symptoms
- Output format: `## ROOT CAUSE FOUND` block (lines 238–250) is already right shape; investigator returns this directly to orchestrator
- The `## INVESTIGATION INCONCLUSIVE` return is the non-recoverable signal the ceiling handler needs
- No structural changes required — just correct invocation flags

### gsd-fixer (`.claude/agents/gsd-fixer.md`)

**Frontmatter** (lines 1–11):
- `name: gsd-fixer`, `description`, `tools: Read, Write, Edit, Bash, Grep, Glob`, `color: orange`
- No `modes:` field. No invocation-mode support.

**Process structure:**
- Entry: load context from `<files_to_read>`
- Core: per-issue loop: locate → classify → skip or fix → map dependencies → choose approach → apply → verify → commit
- Exit: `## FIXES COMPLETE` or `## FIXES PARTIAL`

**What must change for loop mode:**
- Add loop-fixer input contract: read investigator's `## ROOT CAUSE FOUND` block from a passed file; treat `root_cause` + `files_involved` as the issue list
- Classification is reused: "not-yet-built" maps to non-recoverable; loop orchestrator must catch this signal
- Output: extend `## FIXES COMPLETE` with `loop_iteration: N` field so ceiling handler can track
- Do not commit in loop mode — or commit with a distinct message prefix `verify-loop/fix/attempt-N:` for auditability; pick one convention in AGENT-SPEC and wire it through

---

## 2. Execute-Phase Hook Point

**File:** `.claude/get-shit-done/workflows/execute-phase.md`

### Task-loop structure (lines 158–316)

The relevant execution sequence per wave:

```
1. Describe plans (line 163)
2. Spawn executor agents via Task() (lines 180–232)
3. Wait for all agents in wave to complete (lines 235–247)
4. Post-wave hook validation (lines 249–256)
5. Spot-check SUMMARY.md claims (lines 258–278)   ← verify_after fires HERE
6. Handle failures (lines 284–288)
7. Pre-wave dependency check (lines 290–311)
8. Execute checkpoint plans between waves (line 313)
9. Proceed to next wave (line 315)
```

**Exact splice location:** Between steps 5 and 6 (after spot-check passes, before proceeding to next wave or failure handling).

Concretely: after the orchestrator reads SUMMARY.md and confirms tasks completed, it should parse the PLAN.md for tasks with `verify_after: true`, identify which tasks just completed, and if any are marked, fire the verifier sub-flow before continuing.

**The splice in prose** (after line 278, "If all pass, report what was built"):
```
After spot-checks pass for each plan in the wave:
  For each completed plan: read PLAN.md task list
  For each task with verify_after: true that was just completed:
    → fire verify loop sub-flow (see <verify_loop> block)
  If any verify loop iteration ceiling reached → surface structured report, pause execution
  Otherwise → continue to step 6
```

**Wave/parallel interaction:** In parallel waves, multiple executors run simultaneously. The hook fires per-plan after that plan's spot-check passes, not per-wave. This means parallel plans can each trigger a loop. Orchestrator must serialize loop execution (run one loop at a time) to avoid context contention on shared files. The simplest approach: run all parallel plan spot-checks first, collect the `verify_after` trigger list, then run verify loops sequentially before advancing to the next wave.

**Existing verify_phase_goal step (lines 473–499):** This fires once at end of all waves, using gsd-verifier in standalone mode. The loop fires mid-execution at task granularity. These are distinct and complementary — do not remove verify_phase_goal.

---

## 3. must_haves Schema Extension

### Current shape (`.claude/get-shit-done/templates/phase-prompt.md`, lines 27–31 and 553–578)

```yaml
must_haves:
  truths: []                # Observable behaviors
  artifacts: []             # Files that must exist
  key_links: []             # Critical connections
```

Artifact sub-fields: `path`, `provides`, `min_lines?`, `exports?`, `contains?`
Key-link sub-fields: `from`, `to`, `via`, `pattern?`

### Proposed `verify:` extension (minimal, additive)

```yaml
must_haves:
  truths:
    - truth: "API returns user data for valid ID"
      artifacts: [src/api/users.ts]
      verify:
        - cmd: "curl -s http://localhost:3000/api/users/1 | jq '.id'"
          expect: "1"
          type: integration
  artifacts: []
  key_links: []
```

**Schema fields for `verify:` item:**
- `cmd` (required): shell command to run
- `expect` (required): string or regex the output must match
- `type` (required): `unit | integration | e2e | ui` — `ui` deferred to v2 but schema-safe

**Backward compatibility:** The `verify:` block is nested inside each truth entry, not a new top-level key. Plans without `verify:` entries remain valid. gsd-verifier's existing truth-parsing logic (Step 2) falls back to its current derivation paths when `verify:` is absent. No breaking change.

**gsd-tools change needed:** `verify artifacts` and `verify key-links` subcommands already exist. A new `verify commands` subcommand parses the `verify:` block and runs `cmd` assertions — returns `{ all_passed, results: [{cmd, expect, actual, passed}] }`.

---

## 4. Discovery Graph (Plan 4-2)

- **Output format:** JSON stored at `.planning/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.json`. Structured as: `{ agents: {name: {callers: [...], spawned_by: [...]}}, workflows: {name: {callers: [...], includes: [...]}}, tools: {subcommand: {callers: [...]}} }`
- **Grep patterns for agents:**
  - `grep -rn "subagent_type=\"gsd-" .claude/get-shit-done/workflows/` — finds Task() spawns
  - `grep -rn "gsd-verifier\|gsd-debugger\|gsd-fixer\|gsd-executor\|gsd-planner" .claude/get-shit-done/` — finds references
- **Grep patterns for workflows:**
  - `grep -rn "@.*workflows/" .claude/get-shit-done/` — finds @-includes of workflow files
  - `grep -rn "workflows/execute-plan\|workflows/execute-phase\|workflows/progress" .claude/` — finds direct refs
- **Grep patterns for gsd-tools subcommands:**
  - `grep -rn "gsd-tools.cjs" .claude/get-shit-done/ | grep -oE '"(init|roadmap|phase|state|commit|verify) [a-z-]+"'` — extracts subcommand call sites
- **Scope:** only `.claude/get-shit-done/` tree (not worktrees, not `.planning/`)
- **Output granularity:** file-level callers only (not line numbers) — keeps graph readable
- **Consumer:** Plan 4-3 implementer reads this before modifying verifier/debugger/fixer to know all call sites that depend on current return shapes

---

## 5. Context Efficiency (Plan 4-1)

### Data scoping: `init progress` and `roadmap analyze`

- **`cmdInitProgress`** is at `.claude/get-shit-done/bin/lib/init.cjs`, line 799
  - Returns full `phases[]` array (all phases in current milestone) at line 923
  - The progress workflow uses `current_phase` and `next_phase` scalars from this result (progress.md lines 19–20) but the full `phases[]` is also returned and loaded into context
  - Fix: add a `--scoped` flag that returns only `current_phase`, `next_phase`, `phases` trimmed to [current-1, current, next, next+1]; the workflow passes this flag, reducing payload from ~34-phase arrays to ~4-phase slices

- **`cmdRoadmapAnalyze`** is at `.claude/get-shit-done/bin/lib/roadmap.cjs`, line 93
  - Returns full `phases[]` array at line 212 — all phases with plan/summary counts, disk status, goals
  - progress.md step `load_and_analyze` calls this at line 32 for the full phase table, but only needs current/next for the "What's Next" section and routing logic
  - Fix: same `--scoped` flag pattern, or a separate `roadmap current-context` subcommand that returns only {current, next, prev} phase objects

### Slug bloat: `phase add`

- **`generateSlugInternal`** is at `.claude/get-shit-done/bin/lib/core.cjs`, line 704
  - Current implementation: `text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')`
  - No length cap — a 200-char description produces a 200-char slug
  - Fix: add `.slice(0, 45)` then re-strip trailing hyphens: `slug.slice(0, 45).replace(/-+$/, '')`
  - **`cmdPhaseAdd`** calls `generateSlugInternal` at `.claude/get-shit-done/bin/lib/phase.cjs`, line 324 — this is the only integration point to change
  - New phases only: existing phase dirs are not renamed

### Double @-include: progress.md

- **progress.md line 15:** `INIT=$(node ... init progress)` — runs the CLI to get JSON
- **progress.md lines 40–42:** the workflow's `execution_context` at the call site in execute-phase.md (line 200–204) uses @-include to inject workflow files into executor context
- **Actual double-include:** progress.md is loaded via the `/gsd2:progress` command definition at `.claude/commands/gsd2/progress.md` (check with `grep -rn "progress.md" .claude/commands/`); when the command file @-includes the workflow, AND the system-reminder Read-tool injection also surfaces the workflow, the same ~300-line file appears twice in context
- **Fix:** Remove the @-include from the command file; rely solely on the Read tool injection (the workflow already has `<required_reading>` at line 5–7 that instructs the agent to read referenced files). Estimated savings: ~3k tokens/call

---

## 6. Loop Debug File

**Location:** `.planning/debug/{plan-slug}-verify-loop.md`

**`.planning/debug/` status:** Directory does NOT currently exist in this repo (confirmed via `ls .planning/`). Wave 0 must create it.

**Schema reuse from gsd-debugger:**

The debugger's debug file schema (lines 98–151) is directly reusable with two additions:

```markdown
---
status: gathering | investigating | fixing | verifying | awaiting_human_verify | resolved
trigger: "verify_after task: {task_name}, plan: {plan_slug}"
created: [ISO timestamp]
updated: [ISO timestamp]
iteration: 1          # NEW — current loop iteration (1-3)
max_iterations: 3     # NEW — ceiling value
---
```

The `## Evidence` (APPEND) and `## Eliminated` (APPEND) sections work unchanged — they accumulate across iterations within the same session file. The `## Resolution` section captures the final state after ceiling-reached or pass.

`status` transitions for loop context:
```
verifying -> investigating -> fixing -> verifying (repeat per iteration)
           -> ceiling_reached (new terminal status, maps to human-verify checkpoint)
           -> resolved (pass on any re-verify)
```

**Knowledge base:** Loop sessions that resolve should append to `.planning/debug/knowledge-base.md` using the same format as debugger sessions. This cross-pollinates "common verify loop failure patterns" into future debugger investigations.

---

## Validation Architecture

### Validation Scenarios for the Harness

**Scenario 1: Fresh-context invariant**
- What to check: Verifier spawned in loop mode has no access to executor's prior conversation state; it reads only what's in `<files_to_read>` and runs `verify:` commands against live system
- How: Spawn verifier as isolated Task() with only plan file + must_haves path; confirm result is identical when run twice in separate contexts on same codebase state
- Command: manual inspection — compare two Task() invocations' `verify:` command outputs

**Scenario 2: Iteration ceiling enforcement**
- What to check: Loop stops after exactly 3 iterations; does not attempt iteration 4 even if fixer returns FIXES COMPLETE
- How: Author a `verify:` command that always fails (`cmd: "false"`, `expect: "true"`); confirm orchestrator surfaces ceiling-reached report after iteration 3, not after 4
- Command: manual check with a deliberately broken verify command in a test plan

**Scenario 3: Non-recoverable classification short-circuit**
- What to check: When gsd-fixer classifies an issue as `not-yet-built`, loop surfaces ceiling-reached immediately (does not consume remaining iterations)
- How: Author a `verify:` command that fails due to a feature in a future phase; confirm fixer's `not-yet-built` classification propagates to orchestrator as early termination signal
- Command: inspect fixer return for `classification: not-yet-built` and confirm orchestrator exits loop

**Scenario 4: Pass-on-first-verify silent continuation**
- What to check: When all `verify:` commands pass on first run, no checkpoint is surfaced to user; executor continues to next task
- How: Author a `verify:` command that always passes (`cmd: "echo ok"`, `expect: "ok"`); confirm no user-visible output between tasks
- Command: automated — check no `## CHECKPOINT REACHED` block appears in orchestrator output

**Scenario 5: Context efficiency token measurement (Plan 4-1)**
- What to check: Token count for `/gsd2:progress` call before and after the three fixes; target ≥13k reduction
- How: Use Claude's token counter (via telemetry or by counting characters in the init/roadmap JSON payloads before vs after scoping)
  - Before: `node gsd-tools.cjs roadmap analyze | wc -c` (full payload size)
  - After: `node gsd-tools.cjs roadmap analyze --scoped | wc -c` (scoped payload size)
- Command: `node .claude/get-shit-done/bin/gsd-tools.cjs roadmap analyze --raw | wc -c` vs scoped variant

**Scenario 6: Backward compatibility for plans without verify:**
- What to check: Existing PLAN.md files with `must_haves:` but no `verify:` field continue to work through execute-phase without errors; gsd-verifier falls back to current 3-level artifact check
- How: Run execute-phase on a plan without `verify:` entries; confirm VERIFICATION.md is produced normally
- Command: existing verify artifacts/key-links tooling unchanged — confirmed by gsd-verifier Step 2 fallback path

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `.claude/agents/gsd-verifier.md` — full agent source (all 365 lines)
- `.claude/agents/gsd-debugger.md` — full agent source (all 452 lines)
- `.claude/agents/gsd-fixer.md` — full agent source (all 178 lines)
- `.claude/get-shit-done/workflows/execute-phase.md` — task-loop and verify_phase_goal sections
- `.claude/get-shit-done/workflows/progress.md` — full workflow (all 312 lines)
- `.claude/get-shit-done/templates/phase-prompt.md` — must_haves schema (lines 27–31, 547–608)
- `.claude/get-shit-done/bin/lib/init.cjs` — `cmdInitProgress` (line 799)
- `.claude/get-shit-done/bin/lib/roadmap.cjs` — `cmdRoadmapAnalyze` (line 93)
- `.claude/get-shit-done/bin/lib/phase.cjs` — `cmdPhaseAdd` (line 311), `generateSlugInternal` call (line 324)
- `.claude/get-shit-done/bin/lib/core.cjs` — `generateSlugInternal` (line 704)

---

## RESEARCH COMPLETE
