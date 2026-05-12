# Phase 1: Domain Router - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Automatic domain classification in discuss-phase that replaces the hardcoded UI-SPEC trigger in plan-phase. Router analyzes phase description and codebase context, presents classification with evidence, asks user to confirm, then routes to the appropriate spec workflow. This phase delivers the classification infrastructure — the agentic spec workflow itself is Phase 2.

</domain>

<established>
## Established Patterns (from codebase)

- **UI-SPEC workflow**: Fully built (`ui-phase.md`) with researcher/checker agents (`gsd-ui-researcher`, `gsd-ui-checker`). Works today, must keep working via the new router path.
- **Config system**: `config.cjs` already has `workflow.ui_phase` and `workflow.ui_safety_gate` as valid keys. Router may add new config keys following same pattern.
- **init.cjs compound commands**: `init phase-op` and `init plan-phase` bundle context JSON for workflows. Router classification could be added to init output.
- **Agent .md pattern**: Agents are markdown persona files in `agents/`. If router needs its own agent, follows this pattern.
- **Command → workflow chain**: Commands are thin stubs loading workflows via `@`-reference. No command layer changes expected.
- **gsd-tools.cjs CLI**: All programmatic operations go through this tool CLI. Router logic (if any) should live here or in a new `lib/` module.

</established>

<decisions>
## Implementation Decisions

### Classification mechanism
- Router analyzes phase description from ROADMAP.md + codebase context (existing files, patterns) to determine domain [STRONG — user emphasized "smart assessment" based on what's being built]
- Classification should look at: phase name/goal keywords, existing codebase structure (e.g., `src/agents/` folder), deployment patterns, and domain-specific signals [WEAK — derived from discussion, not explicitly enumerated by user]
- Router presents classification with evidence in one visible line: "Detected: [domain] — based on [evidence]" [STRONG — from DRTR-02 requirement, user confirmed]

### Confirmation UX
- Router asks user to confirm or override the detected domain before routing [STRONG — user explicitly said "better to ask than do blindly"]
- Low-confidence classifications should still present their best guess with the option to override [WEAK — follows from the confirmation pattern]

### Where router lives
- Primary classification runs in **discuss-phase** — this is where specialized questions need to happen [STRONG — user confirmed after examining the reasoning]
- Plan-phase keeps a **lightweight guard** — file-existence check for expected spec artifacts, not a full classifier [STRONG — user agreed with the split: "feels right, true"]
- The current hardcoded UI-SPEC gate in plan-phase step 5.6 becomes a generic "missing spec?" check [STRONG — direct consequence of the above]

### Domain routing behavior
- **UI domain** → triggers existing UI-SPEC questionnaire (same as today, just triggered by router instead of hardcoded gate) [STRONG — must not break existing flow]
- **Agentic domain** → Phase 1 classifies it correctly but the actual AGENT-SPEC workflow comes in Phase 2. For now: classification + stub/flag that Phase 2 will consume [STRONG — user confirmed end state]
- **Generic domain** → current discuss-phase flow continues unchanged [STRONG — implicit from "don't break what works"]
- **Multi-domain** → run both questionnaires sequentially, no special machinery [WEAK — user said it's rare, "just follow the general pattern"]

### Simplicity constraint
- Do not overcomplicate — the router is infrastructure for Phase 2 where the real value lives [STRONG — user's opening statement, strongest signal in the conversation]
- User can always shortcut heavy questionnaires by referencing existing specs or giving brief answers — the LLM interprets responses, they're not hardcoded [STRONG — user explicitly noted this as a mitigation for questionnaire weight]

### Folded Todos
None — the matched todo ("Add user sync checkpoints to plan-phase subagent chains") is about plan-phase internals, not domain routing.

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** User runs `/gsd2:discuss-phase N`, sees a one-line domain classification with evidence, confirms or overrides, and gets routed to the right spec workflow. UI phases get the existing UI-SPEC questionnaire. Agentic phases get correctly classified (actual questionnaire comes in Phase 2). Generic phases proceed as today.
- **Success signal:** Running discuss-phase on a UI phase triggers UI-SPEC without the old yes/no gate. Running it on an agentic phase description correctly identifies it as agentic. Running it on generic work proceeds without interruption. Plan-phase no longer classifies — it just checks for missing specs.
- **Flow:** discuss-phase starts → router classifies domain from phase description + codebase → shows "Detected: [domain] — [evidence]" → asks confirm/override → routes to appropriate workflow → CONTEXT.md records the detected domain for downstream use.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain routing requirements
- `.planning/REQUIREMENTS.md` — DRTR-01 through DRTR-05 define all router requirements

### Existing UI-SPEC trigger (to be replaced)
- `~/.claude/get-shit-done/workflows/plan-phase.md` §5.6 — Current hardcoded UI-SPEC gate with frontend indicator detection
- `~/.claude/get-shit-done/workflows/ui-phase.md` — Full UI-SPEC workflow the router must continue to trigger correctly

### Discuss-phase workflow (integration point)
- `~/.claude/get-shit-done/workflows/discuss-phase.md` — Where the router will be inserted

### Config system
- `~/.claude/get-shit-done/bin/lib/config.cjs` — Valid config keys including `workflow.ui_phase` and `workflow.ui_safety_gate`

### Architecture reference
- `.planning/codebase/ARCHITECTURE.md` — Layer breakdown, data flow, and cross-cutting concerns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-tools.cjs roadmap get-phase` — Already extracts phase description from ROADMAP.md
- `config.cjs` config-get/config-set — Can add new router config keys following existing pattern
- `init.cjs` compound commands — Could bundle router classification into init output

### Established Patterns
- Plan-phase step 5.6 has the grep-for-frontend-indicators pattern — shows how domain detection was done before (keyword grep on phase section). Router replaces this with smarter classification.
- UI-SPEC workflow orchestration — researcher + checker agent pattern. AGENT-SPEC (Phase 2) will follow the same pattern.

### Integration Points
- **discuss-phase.md** — Router inserts early in the workflow, after build_understanding and before conversation
- **plan-phase.md step 5.6** — Gate simplifies from classifier to file-existence check
- **CONTEXT.md** — Needs to record detected domain so plan-phase and executor know which spec to expect
- **config.json** — May need new keys for router behavior (e.g., domain override, confidence threshold)

</code_context>

<specifics>
## Specific Ideas

- User emphasized this is infrastructure for Phase 2 — keep it minimal and reliable
- "We should not overcomplicate and break what is already working" — the strongest signal in the conversation
- The LLM's ability to interpret free-text responses is a feature, not a bug — questionnaires don't need to be rigid

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-domain-router*
*Context gathered: 2026-04-15*
