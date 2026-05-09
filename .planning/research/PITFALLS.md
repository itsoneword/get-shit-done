# Domain Pitfalls: Domain-Aware Planning for GSD v1.4
**Domain:** Adding domain classification to an existing structured workflow framework
**Date:** 2026-04-12
**Confidence:** HIGH (codebase read directly; patterns verified against live workflow code)

---

## Critical Pitfalls

### 1. Domain Router False Positives Make the Problem Worse Than the Status Quo

**What goes wrong:** The UI-SPEC trigger today is a yes/no question — annoying, but at least it is explicit. A classification router that silently makes the wrong call is worse: the user gets AGENT-SPEC questions for a backend refactor, or misses them entirely for an agentic pipeline phase, with no obvious reason why.

**Why it happens:** Phase names and descriptions are written by humans, not machines. They are often ambiguous. "Add orchestration layer" could be a UI component, an agent pipeline, or an infrastructure abstraction. Keyword matching ("agent", "pipeline", "workflow") has both false positive and false negative failure modes. LLM classification is better but still fails on novel or hybrid phases.

**How it fails in GSD specifically:** The `discuss-phase` workflow already classifies phase content via the "Domain-aware gray areas" section in `discuss-phase.md` — it infers domain from the phase description to generate relevant questions. A second classification step that routes to a specialized spec must agree with what discuss-phase already inferred, or the user sees contradictory signals.

**Prevention:**
- Make classification visible, not invisible. After routing, emit: `Detected domain: [agentic systems] — loading AGENT-SPEC questionnaire. Correct? (yes / no / override)`. One line, not a full interruption.
- Use a confidence threshold. HIGH confidence (multiple signals agree) → route silently. LOW confidence → show detected domain and offer override.
- Define classification signals explicitly in the workflow: phase name keywords + phase goal description keywords + prior CONTEXT.md decisions (if prior phases involved agents, this phase likely does too). Cross-phase notes are already in the workflow — use them as a classification signal.
- Treat "override" as a first-class path, not an edge case. The router must degrade gracefully to "no specialized spec" when classification fails, which is exactly the current behavior. Net effect of failure must never be worse than today.

**Detection:** If users report AGENT-SPEC questions appearing for clearly non-agentic phases, or never appearing for agentic phases, the confidence threshold needs tuning. Log classification decisions to `.planning/cross-phase-notes.md` so patterns are visible.

**Phase that must address this:** Domain router phase (Phase 1 of v1.4).

---

### 2. Replacing the UI-SPEC Trigger Breaks Existing Users Who Rely on the Question

**What goes wrong:** Some users want to run UI-SPEC manually via `/gsd2:ui-phase` and use the yes/no question as a reminder that the workflow exists. Replacing the question with silent classification removes their control point. Worse, if the router classifies a phase as non-UI when the user intended to create a UI-SPEC, the `/gsd2:ui-phase` command still works — but the user has no idea they need to invoke it.

**Why it happens:** The UI-SPEC currently triggers via a conversational question in `discuss-phase.md`. The router replaces this with automatic inference. The gap is discoverability: users who learned the flow via the prompt will no longer see it.

**How it fails in GSD specifically:** The `ui-phase.md` workflow is a separate command, not embedded in `discuss-phase`. The router only needs to auto-invoke it (or suggest it) when confidence is HIGH. When confidence is LOW, the current behavior (offer the user a choice) is correct and should be preserved. The key constraint from PROJECT.md is: "Must not break existing UI-SPEC workflow — router subsumes it." "Subsumes" means the router does what the question currently does, plus more — it does not eliminate the question for ambiguous cases.

**Prevention:**
- Preserve the explicit offer path: when domain is detected as UI with LOW confidence, show the same "Would you like a UI-SPEC?" question. The router only auto-invokes on HIGH confidence.
- Keep `/gsd2:ui-phase` as a standalone command. Router is an automation convenience, not a gate.
- After the router runs, show which spec workflow was (or was not) triggered in the discuss-phase output. Users learn the pattern by seeing it.

**Phase that must address this:** Domain router phase. Must include a backward compatibility test: run discuss-phase on a clearly UI-heavy phase and verify UI-SPEC is triggered; run on a backend phase and verify it is not triggered.

---

### 3. AGENT-SPEC Template Bloat from "Comprehensive" Thinking

**What goes wrong:** The template designer lists every field that could possibly matter for an agentic system — topology, communication protocol, message schema, retry policy, circuit breaker config, observability stack, tracing format, test contracts, security boundaries, escalation paths, human-in-the-loop configuration, memory type, tool list — and ends up with a 15-field questionnaire. Users answer 3 fields carefully and skim the rest, which defeats the point.

**Why it happens:** Agentic systems are genuinely complex and the temptation is to make the spec comprehensive. The UI-SPEC avoids this because UI has a well-scoped domain (visual contracts). Agentic systems span infra, design, testing, and security, so every field feels justified.

**How it fails in GSD specifically:** The planner reads AGENT-SPEC to know what's locked vs what to decide. If the spec has 15 fields and 12 are answered with "TBD" or vague defaults, the planner gets the same information as having no spec at all — except now there is a false sense of completeness. The downstream risk is worse: the planner assumes locked decisions that were never actually made.

**Prevention:**
- Cap the questionnaire at 6-7 fields. Start from the planner's perspective: what decisions would cause a fundamentally different plan if made differently? Only those fields belong in AGENT-SPEC.
- Core field candidates (based on what drives plan divergence): topology pattern (chain / graph / orchestrator-worker / hybrid), communication contract (how agents hand off), observability strategy (what gets traced and where), test contract format (what a passing test looks like for each agent boundary), and security boundary (what agents can and cannot do). That is five fields. Optional: escalation behavior (human-in-the-loop or not). That is six.
- Remove fields that the planner can decide without user input: retry policies, circuit breaker thresholds, specific logging formats. These are implementation details, not planning decisions.
- Mark fields as required vs optional. The questionnaire must produce a usable spec even if optional fields are skipped.

**Phase that must address this:** AGENT-SPEC template phase. Validate against a real agentic phase: after filling the spec, can a planner produce a non-trivial plan without asking the user any more questions? If not, the spec is missing something. If the spec took more than 10 minutes to fill, it has too many fields.

---

### 4. Observability Gets Deferred to the Executor and Never Happens

**What goes wrong:** The spec has an "observability" field, but it is filled with vague answers like "use OpenTelemetry" or "log agent calls." The planner creates tasks that say "add logging" as the last task in the plan. The executor writes print statements and calls the phase done. The agentic system ships with no structured traces, no span boundaries, and no way to debug a failed pipeline run.

**Why it happens:** Observability in agentic systems requires design decisions that affect every component: span boundaries, trace propagation across agent handoffs, which decisions get logged vs which are implicit. These cannot be retrofitted cleanly because the agent boundaries themselves need to carry trace context. When observability is a field in the spec rather than a constraint that shapes all other fields, planners treat it as additive work, not architectural work.

**How it fails in GSD specifically:** The PROJECT.md decision "Observability in spec, not implementation" is correct in intent but incomplete as a rule. The risk is that the spec has an observability section that is filled in, but the topology and communication contract sections are designed without observability in mind. Then observability becomes a task that modifies the communication contract — which breaks the spec's authority as a locked document.

**Prevention:**
- The AGENT-SPEC template must embed observability as a constraint on other fields, not a standalone field. The communication contract field should include: "What context does each agent pass to the next that enables trace correlation?" The topology field should include: "At which handoff points does a trace span begin/end?" Observability is a property of the design, not a separate concern.
- The questionnaire for the "test contract" field should ask: "How would you tell if this agent made the right decision?" — which forces the user to name observable behavior, not just output format.
- In the plan, observability tasks should appear in the same wave as the agents they instrument, not as a final wave. The planner reads AGENT-SPEC wave structure, so the spec should make this explicit.

**Phase that must address this:** AGENT-SPEC template phase. This is the highest-stakes design decision in the whole milestone.

---

### 5. Documentation Agent Generates Readable Summaries of What Already Exists

**What goes wrong:** The `/gsd2:document` command runs, reads all specs and PLAN.md files, produces a system map that accurately describes what was built as of the last plan. Two phases later, half of it is wrong. Nobody updates it because it was generated, not authored — it feels like running the command again is the fix. The command is never run again.

**Why it happens:** Generated documentation creates a responsibility vacuum. Authored documentation has an implicit owner (whoever wrote it). Generated documentation belongs to the tool. When it goes stale, the question "who fixes this?" has no answer because the tool cannot self-trigger.

**How it fails in GSD specifically:** GSD already has this problem with SUMMARY.md files. Each executor writes a SUMMARY.md. Nobody reads the old ones. The docs agent faces the same fate if it produces a static output that is not tied to a workflow trigger.

**Prevention:**
- Do not generate a document. Generate a delta-aware report. The doc agent should read the last generated system map (if any), compare it against current artifacts, and produce: "What changed since last generation: [list]. What is consistent: [summary]. What is missing coverage: [list]." This makes the output useful even when run repeatedly.
- Tie generation to a trigger that makes sense: milestone completion, not ad-hoc. The `/gsd2:complete-milestone` workflow already exists. A `--with-docs` flag or a post-milestone hook that suggests running `/gsd2:document` gives the command a natural home in the workflow.
- Constrain the output format. A "system map" should be a structured artifact (agent inventory, communication contract table, test coverage summary), not a prose narrative. Structured output stays accurate longer, fails visibly when stale, and is skimmable.
- Never let the doc agent invent context. It reads artifacts only: specs, PLAN.md files, SUMMARY.md files, git log. No inference about intent or architecture. "I found no observability contract in AGENT-SPEC" is more useful than a generated paragraph about best practices.

**Phase that must address this:** Documentation agent phase.

---

## Moderate Pitfalls

### 6. Per-Domain Flags in Config Recreate the Scaling Problem

**What goes wrong:** The router is implemented as a set of `config.json` flags: `workflow.ui_phase: true/false`, `workflow.agent_phase: true/false`, `workflow.data_phase: true/false`. Each new domain requires a new flag. Users who want to disable one domain must hand-edit config. The `VALID_CONFIG_KEYS` whitelist in `config.cjs` must be updated for each new domain.

**Why it happens:** The existing `workflow.ui_phase` flag in `ui-phase.md` is already this pattern. It was fine for one domain. It does not scale.

**Prevention:**
- A single `workflow.domain_router: enabled/disabled` flag controls the router. Domain classification is internal to the router logic, not user-facing config.
- Per-domain overrides can live in the phase description itself if needed: `domain: agent` frontmatter in ROADMAP.md phase entries. This is more explicit and does not require a new config key per domain.
- The config key whitelist problem in `VALID_CONFIG_KEYS` (already noted in CONCERNS.md) must not be made worse. Adding new config keys requires updating the whitelist, which is currently incomplete. Minimize new config keys.

**Phase:** Domain router phase.

---

### 7. The Router Runs at discuss-phase but the Spec Is Needed at plan-phase

**What goes wrong:** The domain router fires during discuss-phase and produces AGENT-SPEC. The user then runs plan-phase in a separate session. The planner reads CONTEXT.md (from discuss-phase), RESEARCH.md (from research-phase), but does not know that AGENT-SPEC also exists and should constrain its decisions.

**Why it happens:** The UI-SPEC workflow has this solved: `/gsd2:ui-phase` is a distinct step that produces a named artifact (`{N}-UI-SPEC.md`), and the plan-phase workflow is expected to read it. But the planner's `init plan-phase` command bundles context via JSON and does not automatically include new artifact types that did not exist when the `init` command was written.

**Prevention:**
- AGENT-SPEC must follow the same naming convention as UI-SPEC: `{NN}-AGENT-SPEC.md` in the phase directory. This makes it discoverable by glob without special logic.
- The plan-phase workflow's "read context" step should glob for all spec files in the phase dir, not hard-code the list. Current pattern: `has_context`, `has_research`, `has_plans` from `init plan-phase` JSON. Add: `has_agent_spec`, `has_ui_spec` as parallel fields, with the same non-blocking warning pattern ("No AGENT-SPEC found — running without agentic design contract").
- This requires a small change to `init.cjs` — add spec file detection to the `init plan-phase` output. Low risk, finite scope.

**Phase:** AGENT-SPEC template phase must include this integration step. Do not merge without it.

---

### 8. Test Contracts at Planning Time Become Dead Letters

**What goes wrong:** AGENT-SPEC includes a test contract section. The planner generates PLAN.md with test tasks. The executor writes tests that pass. The test contracts in AGENT-SPEC are never looked at again. If the tests are wrong, the test contracts do not help.

**Why it happens:** Test contracts work when they are the acceptance criteria for the executor, not a separate document the executor may or may not read. GSD's existing test-phase workflow (`/gsd2:test-phase`) generates verification contracts — this is the right pattern. AGENT-SPEC test contracts need to feed into that workflow, not exist as a standalone artifact.

**Prevention:**
- AGENT-SPEC's test contract section should produce output in the same format as `TEST-SPEC.md` (which the test-phase workflow already reads). If the formats diverge, the test-phase workflow will not consume AGENT-SPEC test contracts.
- The `/gsd2:test-phase` workflow should be updated to read AGENT-SPEC test contracts as an additional input source, not as a replacement for its existing TEST-SPEC.
- At the very least, the AGENT-SPEC template should include a callout: "These test contracts will be consumed by `/gsd2:test-phase`. Use the same format as TEST-SPEC.md section [X]." This is a documentation guardrail, not a technical one.

**Phase:** AGENT-SPEC template phase. Coordination with test-phase workflow is a dependency.

---

### 9. The Documentation Agent Becomes a Research Agent in Disguise

**What goes wrong:** The `/gsd2:document` command is told "generate a system map from artifacts." The agent reads artifacts, notices gaps, starts inferring architecture, and produces a document that mixes what is documented with what the agent thinks should be true. Output is 40% synthesis and 60% AI invention. Users cannot tell which is which.

**Why it happens:** Language models fill gaps. When artifact coverage is sparse (incomplete AGENT-SPEC, short PLAN.md files, SUMMARY.md files that just say "tasks completed"), the agent has insufficient signal and substitutes inference.

**Prevention:**
- The doc agent prompt must be adversarially explicit: "If a field has no source artifact, write [undocumented]. Do not infer. Do not suggest. Do not offer alternatives." This is stricter than most agent prompts in GSD, which allow discretion. The doc agent must have zero discretion on factual content.
- Output sections must cite their source artifact: "Topology: chain (source: `02-AGENT-SPEC.md`, section: topology pattern)." Any section without a source citation is flagged for human review, not filled in.
- The doc agent's allowed-tools list should be read-only: Read, Glob, Grep — no Write except for the final output file. No Bash, no WebFetch, no context7. Restricting tools prevents the agent from deciding to "research" a gap.

**Phase:** Documentation agent phase.

---

## Phase-Specific Warnings

| Phase | Warning | Severity | Prevention |
|-------|---------|----------|------------|
| Domain router | Classification of hybrid phases (UI + agentic) fires both routers | HIGH | Define priority order: if AGENT-SPEC and UI-SPEC are both triggered, run UI-SPEC first (it has a verification loop), then AGENT-SPEC. Document this in the router logic. |
| Domain router | Silent routing failure leaves user wondering why no AGENT-SPEC appeared | HIGH | Router must always emit one line: what was detected and why, or "domain unclear — no specialized spec loaded." |
| AGENT-SPEC template | Template is designed without checking what `gsd-planner` actually reads | HIGH | Read the planner agent prompt before finalizing template fields. If the planner does not read a field, the field is dead weight. |
| AGENT-SPEC template | Test contracts use a different schema than TEST-SPEC.md | MEDIUM | Check `get-shit-done/templates/TEST-SPEC.md` format before designing the test contract section. |
| AGENT-SPEC template | Topology pattern section requires framework knowledge the user may not have | MEDIUM | Include a topology reference card inline (chain: A→B→C, graph: A→B,C, orchestrator: A dispatches B,C,D). Users pick a pattern, not a framework. |
| Documentation agent | Agent writes output to wrong location, overwriting a PLAN.md | MEDIUM | Output path must be configurable and default to `.planning/system-map.md`, which does not collide with any existing artifact convention. |
| Documentation agent | Running twice produces conflicting versions | LOW | System map includes a `generated_at` timestamp in frontmatter. Second run either overwrites or appends a diff section — decide which and make it explicit in the workflow. |
| Backward compat | `gsd-tools init plan-phase` does not return `has_agent_spec` | HIGH | This is a code change, not just a workflow change. It must be in scope for AGENT-SPEC phase, not left for later. |

---

## Integration Risks Specific to Adding Domain Awareness to GSD

**The `gsd-workflow-guard.js` subagent detection is heuristic (from CONCERNS.md):** The guard checks `data.tool_input?.is_subagent || data.session_type === 'task'` — undocumented Claude Code hook API fields. If the domain router spawns a classification sub-agent and the hook does not recognize it as a subagent, the workflow guard may fire advisory noise during classification. This is non-blocking but noisy. Monitor after implementing the router.

**The `has_context`/`has_research`/`has_plans` pattern in `init.cjs` must be extended, not worked around:** The current init pattern returns a single JSON blob with all context flags. Adding `has_agent_spec` here is a clean, low-risk extension. The alternative — having the workflow glob for AGENT-SPEC inline — creates duplication and diverges from the established pattern. Do the right thing.

**`normalizeMd()` will run on all new spec files:** Any new template (AGENT-SPEC, system-map) must produce markdown that passes `normalizeMd()` without modification. The normalizer enforces MD022, MD031, MD032, MD012, MD047. Review template structure against these rules before finalizing. A template that fails normalization on first write will create subtle state corruption.

**The discuss-phase "Domain-aware gray areas" section already does light classification:** It infers domain from the phase goal to generate relevant questions. The router must not contradict this inference. If possible, have the router read the output of this classification step (it is ephemeral today but could be captured as a single-line note in CONTEXT.md) rather than re-classify independently.

---

## Sources

Research for this document drew on:
- Direct codebase reading: `commands/gsd2/discuss-phase.md`, `get-shit-done/workflows/discuss-phase.md`, `get-shit-done/workflows/ui-phase.md`, `get-shit-done/templates/UI-SPEC.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`
- [AI Agent Routing: Tutorial & Best Practices](https://www.patronus.ai/ai-agent-development/ai-agent-routing) — misclassification propagation in multi-agent systems
- [What's wrong with AI-generated docs](https://passo.uno/whats-wrong-ai-generated-docs/) — missing human context, hallucination risk
- [AI, Confluence Docs, and READMEs: Why AI Written Docs End Up Unread](https://dev.to/ujja/ai-confluence-docs-and-readmes-why-ai-written-docs-end-up-unread-31i8) — staleness and ownership vacuum
- [Agent-Specification/spec.md](https://github.com/agile-lab-dev/Agent-Specification/blob/main/spec.md) — existing agentic spec field patterns
- [AI Agents, meet Test Driven Development](https://www.latent.space/p/anita-tdd) — flexible test contracts for agentic work
- [Workflow Versioning and Backward Compatibility in Conductor](https://orkes.io/blog/workflow-versioning-and-backward-compatibility-in-conductor/) — conservative migration policy
