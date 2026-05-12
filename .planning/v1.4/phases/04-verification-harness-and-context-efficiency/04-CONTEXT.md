# Phase 4: Verification harness and context efficiency - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Two-track phase, single milestone deliverable:

1. **Context efficiency** — fix token waste in `/gsd2:progress` workflow (data scoping, slug bloat, double @-include of workflow file). Mechanical, localized to `progress.md` and `gsd-tools.cjs`.
2. **Verification harness** — add a self-healing three-agent loop (verifier → investigator → fixer, each in fresh context, max 3 iterations) that fires at planner-marked testable boundaries during `execute-phase`. Closes the seam where executor claims "done" but the user has to manually check whether the feature actually works.

**Out of scope:** UI/browser-based verification (deferred to v2 — Playwright MCP). Workflow-as-tool restructuring (separate concern). Changes to test-phase / TEST-SPEC.md authoring (this phase only consumes verification commands; plan-phase and test-phase remain as-is).

**Detected domain:** Agentic
**Evidence:** multi-agent loop with role specialization (verifier/investigator/fixer), fresh-context handoffs to prevent bias, iteration ceiling, structured failure reports between agents, orchestration glue inside execute-phase
**Confirmed by user:** yes (initial framing came from user; confirmation implicit through architectural agreement)

</domain>

<established>
## Established Patterns (from codebase)

- **Agent definitions live in `agents/*.md`** — frontmatter (name, description, tools, color) + role/process body. 22 agents currently.
- **gsd-verifier already does goal-backward verification** — outputs structured `gaps:` YAML in VERIFICATION.md frontmatter for downstream consumption. Uses 3-level artifact check (exists → substantive → wired).
- **gsd-fixer already does dependency-aware fixing** — classifies issues (current-phase / regression / not-yet-built / unrelated), greps for usages before changing shared interfaces.
- **gsd-debugger already does scientific-method investigation** — phased process (gathering → investigating → fixing → verifying), persistent debug file at `.planning/debug/{slug}.md` for context-reset recovery, knowledge base at `.planning/debug/knowledge-base.md`.
- **gsd-executor already has TDD support** — `<tdd_execution>` block runs RED/GREEN/REFACTOR when a task has `tdd="true"` attribute. Currently opt-in per task.
- **PLAN.md frontmatter supports `must_haves:`** — already consumed by gsd-verifier (truths, artifacts, key_links). Schema is the right home for verification commands.
- **Workflows are markdown at `.claude/get-shit-done/workflows/*.md`** — loaded via @-include in `<execution_context>` blocks. The double-injection issue stems from this pattern combined with Read tool system-reminders.
- **Phase directories use slug naming** — `.planning/phases/{NN}-{slug}/`. Slug currently derived from full description (no truncation), causing the bloat documented in this phase's discussion.
- **`gsd-tools.cjs` is the JSON/state oracle** — workflows shell out for state reads, returns either inline JSON or `@file:path` for large payloads. The data-scoping fix lives at this layer.
- **Checkpoint protocol** — agents return structured `## CHECKPOINT REACHED` blocks (type: human-verify | decision | human-action). The ceiling-reached handoff for the verifier loop will reuse this format with a new type or extended human-verify variant.

</established>

<decisions>
## Implementation Decisions

### Plan Structure
- **3-4 plans total** [STRONG — derived from architectural conversation]
  - Plan 4-1: Context efficiency fix (progress.md token waste)
  - Plan 4-2: Agent/workflow dependency graph (discovery only — output: structured map)
  - Plan 4-3: Verifier-loop primitives (adapt verifier/debugger/fixer + define verify schema)
  - Plan 4-4 (possibly fold into 4-3): Executor integration + testable-boundary marker
- Tracks are independent — 4-1 ships separately from 4-2/3/4. No execution-order coupling between them beyond same phase.

### Loop Architecture
- **Three agents in fresh contexts:** verifier → investigator → fixer [STRONG]
  - verifier: runs `verify:` commands from must_haves, produces structured pass/fail report
  - investigator: reads failure report only, produces hypothesis (NOT a fix)
  - fixer: reads hypothesis + plan + diff, applies minimal fix, commits
  - back to verifier in NEW fresh context (critical — re-using verifier context defeats the purpose)
- **Iteration ceiling: 3** [STRONG]
- **Ceiling-reached behavior:** surface to human via single structured markdown report containing chronological narrative of all 3 attempts (original failure → fix attempts with diffs → re-verify results → final state) [STRONG, user-confirmed]
- **Why fresh contexts at every step:** the executor that wrote the code is biased ("remembers writing the if-statement"). The verifier reading only the contract + outputs is more honest. Same separation between investigator (diagnoses) and fixer (acts) — different cognitive jobs, bundling produces sloppy fixes.

### Agent Reuse Strategy
- **Reuse trio with adaptation** [STRONG, user-insisted]
  - Don't write three new agents — adapt gsd-verifier (verify), gsd-debugger (investigate), gsd-fixer (fix).
  - Adaptation level: rewrite portions where current agent surface doesn't match loop semantics. Notably: structured `report → next_agent` handoff format, fresh-context invocation contract, trimmed scope (current agents are designed for standalone use; loop variants need tighter input/output contracts).
  - Result: existing standalone usage still works (no breaking changes); loop adds a new invocation mode.
- **Discovery-first: build dependency graph before writing the harness** [STRONG, user-insisted]
  - Plan 4-2 produces a structured map of "who calls whom" across agents → workflows → tools (gsd-tools.cjs subcommands). Becomes the input for plan 4-3 so harness changes are informed by actual usage, not assumed usage.
  - Why: agents/workflows have grown organically. Rewriting verifier/debugger/fixer prompts without understanding callers risks breaking standalone use.

### Verification Trigger
- **Per testable part, not per plan or per phase** [STRONG, user-insisted]
- **Marker:** planner adds `verify_after: true` to specific tasks in PLAN.md task list [STRONG, user-confirmed]
  - When executor finishes a marked task, loop fires automatically.
  - Tasks without the marker continue as normal.
- **Fallback:** plan with zero markers gets verified at end-of-plan [WEAK — derived default]
- **Locality:** loop fires inline within execute-phase, not as a separate user-invoked command. The point is to remove the human seam.

### Verification Spec Format
- **Extend `must_haves:` in PLAN.md frontmatter with `verify:` block** [STRONG, claude-discretion]
- Schema:
  ```yaml
  must_haves:
    - truth: "API returns user data for valid ID"
      artifacts: [src/api/users.ts]
      verify:
        - cmd: "curl -s http://localhost:3000/api/users/1 | jq '.id'"
          expect: "1"
          type: integration
  ```
- **`type:` field values:** `unit | integration | e2e | ui` [STRONG]
  - Future-proofs for Playwright MCP (`type: ui`) without schema changes
  - v1 supports unit/integration/e2e (any shell-executable)
- **Why frontmatter not separate file:** verifier already reads must_haves; "what must be true → how I check it's true" belong together. Frontmatter bloat is bounded and acceptable.

### Default Behavior
- **Default ON: loop runs unless opted out per plan** [STRONG]
- Opt-out via plan frontmatter flag (e.g., `auto_verify: false`)
- Reasoning per user: easier to spot when verification isn't running than when it's silently skipped.

### Context Efficiency Fix (Plan 4-1)
- **Three concrete fixes** [STRONG — derived from telemetry analysis]
  1. **Data scoping:** `init progress` and `roadmap analyze` return overlapping full phase lists (all 34 phases). Reduce to current/next phase data only when called from progress.md. Estimated savings: ~8k tokens/call.
  2. **Slug bloat:** phase directory slugs currently derived from full title with no length cap (worst case: 200+ chars). Add 40-50 char cap at slug-generation time in `gsd-tools.cjs phase add`. Existing phases: don't rename retroactively (breaks history); only new phases use the cap. Estimated savings: ~2-3k tokens/call.
  3. **Double @-include:** `progress.md` is injected once via `<execution_context>` @-reference and again via Read tool system-reminder. Remove the @-include and rely on the Read result alone (or vice versa — pick one path). Estimated savings: ~3k tokens/call.
- **Total expected savings:** ~13k tokens on every `/gsd2:progress` call (over half of current usage).

### Out-of-Scope Decisions (Documented)
- **UI verification deferred to v2** [STRONG] — Playwright MCP integration is exciting but breaks the "small phase" promise. Schema accommodates `type: ui` so v2 is a config change, not architecture change.
- **No new agents** — only adapt existing ones. Adding agents without retiring any grows the surface area.
- **No changes to test-phase / TEST-SPEC.md** — verification commands authored in must_haves, not test-spec, for v1.

</decisions>

<expected_outcome>
## Expected Outcome

**End state — context efficiency:**
- Running `/gsd2:progress` consumes ~13k fewer tokens per call than today.
- Phase slugs created going forward are bounded in length.
- The progress workflow document is not duplicated in agent context.

**End state — verification harness:**
- A plan author marks specific tasks with `verify_after: true` and authors `verify:` commands inside the plan's `must_haves:` block.
- During `/gsd2:execute-phase`, when the executor finishes a marked task, the verifier loop fires automatically:
  - **Pass:** loop closes silently, executor continues to next task.
  - **Fail (1st attempt):** investigator runs in fresh context, produces hypothesis. Fixer runs in fresh context, applies fix and commits. Verifier re-runs in NEW fresh context.
  - **Fail (after 3 iterations):** loop surfaces to user via structured markdown report showing all attempts, executor pauses.
- The user's previously-manual cycle of "executor says done → I click button → broken → I run /fix → repeat" is replaced by the harness running that cycle autonomously up to 3 times before involving the user.

**Success signal:**
- A real phase where the executor claims "done," the verifier catches a real failure (e.g., API returns 500 instead of expected payload), the loop autonomously diagnoses and fixes it within ≤3 iterations, and proceeds to the next task without user intervention.
- User-perceived effect: fewer "looks done but isn't" surprises; more confidence in autonomous mode.

**Flow (typical pass case):**
- User runs `/gsd2:execute-phase N` → executor implements task with `verify_after: true` → loop runs verifier (fresh context) → all `verify:` commands pass → executor proceeds → next task → ... → phase complete → user verifies UI/UX-level acceptance only (the parts genuinely needing human judgment).

**Flow (ceiling-reached case):**
- Same start → verifier fails → investigator (fresh) hypothesizes → fixer (fresh) fixes → verifier (fresh) re-runs → still failing → repeat → after 3 iterations → executor pauses, presents structured report → user reads chronological narrative of all 3 attempts → decides whether to take over manually, redesign, or override and continue.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent definitions to adapt (the loop primitives)
- `agents/gsd-verifier.md` — current verifier; will be adapted to support loop invocation mode with structured handoff format
- `agents/gsd-debugger.md` — current debugger; will be adapted as investigator (hypothesis-only, no fix)
- `agents/gsd-fixer.md` — current fixer; will be adapted to consume hypothesis from investigator and produce structured fix report

### Workflows to integrate with
- `.claude/get-shit-done/workflows/execute-phase.md` — primary integration point; loop fires from here
- `.claude/get-shit-done/workflows/progress.md` — target of the context efficiency fix (Plan 4-1)
- `.claude/get-shit-done/workflows/verify-work.md` — existing user-invoked verification; loop is its automated cousin, may share infrastructure

### Tooling
- `.claude/get-shit-done/bin/gsd-tools.cjs` — CLI/oracle; data-scoping fix lives here. Specifically: `init progress`, `roadmap analyze`, `phase add` subcommands.

### Reference patterns (don't change, but study)
- `docs/superpowers/skills/systematic-debugging/SKILL.md` — pressure-resistant 4-phase scientific method; inform investigator adaptation, particularly the "3+ fixes failed → question architecture" rule (Phase 4.5)
- `docs/superpowers/skills/test-driven-development/SKILL.md` — TDD discipline; informs `type: unit` verification semantics
- `docs/superpowers/ENHANCEMENT-IDEAS.md` — origin document of this phase's framing; documents the gaps that motivated this work

### Plan template / state schema
- `.claude/get-shit-done/templates/plan.md` (if present) — must_haves schema lives here; verify: block extension goes here
- `.claude/get-shit-done/templates/summary.md` (if present) — loop iterations should be reflected in SUMMARY.md "Deviations" section as auto-recovered failures

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **gsd-verifier's structured `gaps:` YAML output** — already designed for downstream consumption (`/gsd2:plan-phase --gaps`). The loop's verifier role can produce the same shape; investigator consumes it directly.
- **gsd-debugger's persistent debug file** (`.planning/debug/{slug}.md`) — survives context resets. Loop investigator can reuse this pattern for cross-iteration evidence accumulation when the loop runs ≥2 iterations.
- **gsd-fixer's classification logic** (current-phase / regression / not-yet-built / unrelated) — already filters out-of-scope issues. Loop fixer keeps this; "not-yet-built" failures should bubble up as a non-recoverable ceiling reach since the loop can't build the future feature.
- **PLAN.md `must_haves:` frontmatter** — extension point for `verify:` block; no new file format needed.
- **`gsd-tools.cjs commit`** — existing CLI for atomic commits; loop fixer reuses this so iterations produce auditable commit history.
- **Checkpoint return format** (`## CHECKPOINT REACHED` markdown block) — reuse for ceiling-reached handoff with `type: ceiling-reached` (or extended `human-verify` variant).

### Established Patterns
- **Agents are spawned via Task tool with `<files_to_read>` block as primary context** — loop invocations follow the same pattern; orchestrator constructs the read list per agent role (verifier reads must_haves + recent commits; investigator reads verifier report + relevant files; fixer reads investigator report + plan).
- **Workflows mediate between user/orchestrator and agents** — execute-phase.md is the integration point; loop logic lives there, not inside the agents themselves.
- **Frontmatter-driven configuration** — both PLAN.md and agent files use frontmatter for declarative config. `verify:` block follows this convention.

### Integration Points
- **`execute-phase.md` task loop** — current code processes tasks linearly; loop hookpoint is post-task-completion check for `verify_after: true` flag, fires the verifier sub-flow before continuing to next task.
- **`gsd-tools.cjs init execute-phase`** — already returns plan metadata; extend to return verification config (default-on flag, opt-out flag).
- **`progress.md` workflow body** — the three context-efficiency fixes touch this file directly + `gsd-tools.cjs init progress` and `roadmap analyze` subcommand implementations.

</code_context>

<specifics>
## Specific Ideas

- **"Call API as webui does"** (user, on verification depth) — verifier should drive the system at integration boundaries, not just trust unit tests. Captured as `type: integration` and `type: e2e` in the verify schema.
- **"Easier to spot when testing isn't happening"** (user, on default behavior) — silent skips are worse than visible runs; informs default-ON choice.
- **"Build a graph"** (user, on agent reuse) — explicit ask to map current agent/workflow callers before rewriting. Plan 4-2 exists because of this.
- **"Per testable part"** (user, on trigger granularity) — verification triggers should be authored decisions per task, not policy decisions per plan/phase.
- **Fresh context at every step** (architectural conversation) — verifier, investigator, fixer each invoked with fresh context. Re-use breaks the bias-elimination property the loop depends on.

</specifics>

<deferred>
## Deferred Ideas

### v2 — Playwright MCP for UI verification
- Adds `type: ui` verify commands that drive a real browser via Playwright MCP server
- Needed for end-to-end verification of UI flows
- Deferred because: requires MCP installation, adds project dependency, expands phase scope significantly
- Schema designed in v1 to accommodate (`type: ui`) — adding it later is config, not architecture

### Workflow-as-tool restructuring
- Move high-frequency mechanical workflows (progress, do, next) from @-included markdown to gsd-tools.cjs subcommand orchestration
- Returns just the current step instead of the full workflow body
- Deferred because: separate concern from the verification harness; should be its own scoping conversation. Plan 4-1 fixes the worst offender (progress.md) with a smaller-scope intervention.

### Test-spec → executable verification linkage at test-phase level
- Currently TEST-SPEC.md is human-readable behavioral contract; v1 of this phase only consumes verify commands authored directly in PLAN must_haves
- Future: have test-phase produce TEST-SPEC.md whose scenarios become the source of must_haves verify entries
- Deferred because: requires changes to test-phase workflow and test-designer agent. Scope creep into a separate workflow.

### Make TDD default at executor level
- Currently `tdd="true"` is opt-in per task in gsd-executor
- Could be default-ON with opt-out, mirroring the verify_after default-ON decision
- Deferred because: separate concern from the verification harness; affects test authorship at task level vs verification at boundary level. Worth its own phase.

### Architectural-question gate in loop ("3 strikes → question architecture")
- Borrowed pattern from `docs/superpowers/skills/systematic-debugging/SKILL.md` (Phase 4.5)
- After ceiling reached, instead of just surfacing failures, prompt the user with: "is this architecture wrong, not just the implementation?"
- Could be added to Plan 4-3's ceiling-reached handoff format if scope permits; otherwise v2.

### Reviewed Todos (not folded)
- `Add user sync checkpoints to plan-phase subagent chains` — touches plan-phase, not execute-phase verification. Deferred as separate work.
- `generate-claude-md cleanup + hybrid shape + sidecar staleness mitigation` — unrelated tooling concern.
- `Update command should sync project-local hooks` — unrelated tooling concern.
- `Merge legacy docs/*.md content into docs/system/ tree` — documentation reorg, unrelated.

</deferred>

---

*Phase: 04-verification-harness-and-context-efficiency*
*Context gathered: 2026-05-05*
