# Phase 2: AGENT-SPEC - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Full agentic system spec template (AGENT-SPEC.md) with researcher agent, checker agent, test contracts, topology pattern reference, and plan-phase integration. Follows the UI-SPEC pattern: separate file, researcher fills it through discussion, checker validates quality, plan-phase reads it as input context.

</domain>

<established>
## Established Patterns (from codebase)

- **UI-SPEC orchestration pattern**: `ui-phase.md` workflow spawns `gsd-ui-researcher` → produces `UI-SPEC.md` → `gsd-ui-checker` validates against 6 dimensions → revision loop (max 2 iterations). AGENT-SPEC follows this exact pattern.
- **Template location**: `templates/UI-SPEC.md` defines spec schema with frontmatter + sections. AGENT-SPEC template goes in `templates/AGENT-SPEC.md`.
- **Model profile system**: `model-profiles.cjs` has entries for `gsd-ui-researcher` and `gsd-ui-checker`. New `gsd-agent-researcher` and `gsd-agent-checker` agents follow same registration pattern.
- **Plan-phase step 5.6**: Currently does keyword grep for frontend indicators + UI-SPEC file check. AGENT-SPEC needs equivalent hook — check for `AGENT-SPEC.md` when domain is agentic (Phase 1 already classifies this).
- **init.cjs compound commands**: `init phase-op` and `init plan-phase` bundle context JSON. SPEC-06 requires plan-phase to read AGENT-SPEC.md when present.
- **Domain router (Phase 1)**: discuss-phase classifies domain, CONTEXT.md records detected domain. Plan-phase reads domain from CONTEXT.md. Agentic classification already works — this phase delivers what happens after classification.
- **Config system**: `config.cjs` has `workflow.ui_phase` and `workflow.ui_safety_gate`. AGENT-SPEC may need equivalent config keys.

</established>

<decisions>
## Implementation Decisions

### AGENT-SPEC as separate artifact
- AGENT-SPEC.md is a separate file in the phase directory, not folded into CONTEXT.md [STRONG — user explicitly voted for separation, same reasoning as UI-SPEC: keeps researcher/checker pattern clean, plan-phase can check existence]
- Follows same lifecycle as UI-SPEC: researcher produces it, checker validates it, planner reads it [STRONG — established pattern]

### Researcher character: technical consultant, not form-filler
- Researcher educates the user on tradeoffs, explains consequences of choices, and actively pushes back on overcomplicated approaches [STRONG — user's strongest signal, multiple examples given]
- Example: user says "LangGraph for a linear pipeline" → researcher explains why that adds unnecessary complexity and suggests simpler chain approach [STRONG — user's own example]
- The agentic domain is new and less understood — the researcher's educational role is essential, not optional [STRONG — user emphasized that agentic pipelines are "pretty new" and less known]
- Researcher draws from topology pattern reference doc when educating [WEAK — logical consequence, not explicitly discussed]

### 10 design dimensions in the spec
Grouped by how the researcher handles them:

**Design decisions (researcher asks, educates on tradeoffs, user decides):**
1. Agent roster & roles — who does what, what model/profile
2. Orchestration pattern — chain, routing, parallel, orchestrator-workers, evaluator-optimizer, autonomous
3. Communication contracts — typed messages between agents, handoff protocols
4. Human-in-the-loop boundaries — approval gates, escalation, oversight
5. Memory strategy — short-term vs persistent vs retrieval, how agents share state

**Cross-cutting concerns (researcher forces a decision, explains consequences of skipping):**
6. Observability & evaluation — tracing, metrics, eval criteria, replay
7. Reflection & self-correction — how the system evaluates its own output, tied to evaluation
8. Security & permission boundaries — prompt injection defense, scope constraints, tool permissions
9. Error handling & failure modes — what happens when agents fail, retry strategies, graceful degradation

**Lightweight capture (researcher asks briefly, planner has implementation flexibility):**
10. Reasoning & planning approach — how agents decompose tasks, sequence actions

[STRONG — user reviewed grouping, pushed to elevate memory and reflection from planner-derived to spec-level, approved final structure]

### Observability as first-class concern
- The spec must force decisions about tracing/logging at design time, not as an afterthought [STRONG — user's biggest pain point, described debugging blind in production]
- At each boundary between agents: what gets logged, what state is tracked, how to diagnose which agent failed and why [STRONG — user described specific debugging frustration]
- The rationale behind architecture choices must be captured so failures can be traced back to design intent [STRONG — "better description of what should be done and WHY"]

### Spec captures WHY, not just WHAT
- Each design decision includes reasoning — "we chose X because Y, and this gives us Z for debugging" [STRONG — user explicitly said ideal situation is understanding "what exactly we are building and how we build it"]
- When something breaks, the developer opens AGENT-SPEC and can trace the failure to a specific boundary, agent, or design choice [STRONG — user's end-state description]

### Test contracts
- Test contracts in AGENT-SPEC should cover input/output contracts per agent (given this input, agent produces output matching this shape) [WEAK — derived from discussion, not strongly specified]
- Behavioral assertions: agent never calls tool X without permission Y [WEAK — proposed by assistant, user didn't push back but didn't elaborate]
- Must be structurally compatible with TEST-SPEC.md format (SPEC-04 requirement) [WEAK — requirement exists but format details are research territory]

### Template structure details
- Exact field design, required vs optional fields, and template structure are research territory [WEAK — user explicitly said "I cannot answer fully what goes into the template"]
- Research should determine best practices from Anthropic's Building Effective Agents guide, Andrew Ng's patterns, and production literature [WEAK — specialist-backed research direction]

### Topology pattern catalog
- Reference document showing chain, graph, orchestrator-worker, parallel patterns with real examples, tradeoffs, and failure modes [WEAK — from SPEC-05 requirement]
- Serves as the researcher's knowledge base when educating users on orchestration choices [WEAK — logical consequence]

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** User runs discuss-phase on an agentic phase, router detects "agentic", AGENT-SPEC workflow activates. The researcher has a genuine conversation — educating on tradeoffs, challenging overcomplicated choices, explaining consequences. User makes informed decisions across all 10 dimensions. AGENT-SPEC.md is written with full architecture, rationale, and observability design. Checker validates quality. Plan-phase reads the spec and creates tasks that include tracing and error handling from the start.
- **Success signal:** When an agentic system built through this workflow breaks, the developer opens AGENT-SPEC.md and can trace the failure to a specific boundary, agent, or design choice — instead of staring at opaque logs. The spec prevented at least one overcomplicated architecture choice during discussion.
- **Flow:** discuss-phase detects agentic domain → AGENT-SPEC workflow activates → researcher educates and questions across 10 dimensions → user makes informed choices → AGENT-SPEC.md written → checker validates → plan-phase reads spec as input context → planner creates tasks with observability built in.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AGENT-SPEC requirements
- `.planning/REQUIREMENTS.md` — SPEC-01 through SPEC-06 define all AGENT-SPEC requirements

### Existing UI-SPEC pattern (to follow)
- `~/.claude/get-shit-done/workflows/ui-phase.md` — Full UI-SPEC orchestration: researcher → checker → revision loop. AGENT-SPEC workflow follows this pattern.
- `~/.claude/get-shit-done/templates/UI-SPEC.md` — UI-SPEC template structure. AGENT-SPEC template follows same conventions.

### Domain router integration (Phase 1)
- `.planning/phases/01-domain-router/01-CONTEXT.md` — Phase 1 decisions: router classifies in discuss-phase, plan-phase reads domain from CONTEXT.md, agentic stub checks for AGENT-SPEC.md existence
- `~/.claude/get-shit-done/workflows/discuss-phase.md` — Where domain router triggers AGENT-SPEC workflow
- `~/.claude/get-shit-done/workflows/plan-phase.md` §5.6 — Where plan-phase checks for spec artifacts

### Agent registration
- `~/.claude/get-shit-done/bin/lib/model-profiles.cjs` — Model profile registration for new agents

### Research sources for template design
- Anthropic: "Building Effective Agents" — 5 workflow patterns + agent pattern, augmented LLM building block
- Andrew Ng: 4 Agentic Design Patterns — Reflection, Tool Use, Planning, Multi-Agent Collaboration

### Project context
- `.planning/PROJECT.md` — Milestone goals, constraints, key decisions
- `.planning/ROADMAP.md` — Phase 2 success criteria and discussion focus

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ui-phase.md` workflow — orchestration pattern (spawn researcher → check output → spawn checker → revision loop) to replicate for AGENT-SPEC
- `gsd-ui-researcher` / `gsd-ui-checker` agent types — registration pattern for new `gsd-agent-researcher` and `gsd-agent-checker`
- `templates/UI-SPEC.md` — template structure conventions (frontmatter, sections, checker sign-off)
- `config.cjs` config keys — `workflow.ui_phase` pattern for potential `workflow.agent_spec` toggle

### Established Patterns
- Researcher/checker agents are subagent types in the Agent tool infrastructure, not separate .md files
- Plan-phase step 5.6 does file-existence check for specs — AGENT-SPEC hooks into the same mechanism
- init.cjs bundles phase context JSON — needs to include AGENT-SPEC path when present (SPEC-06)

### Integration Points
- **discuss-phase.md** — Domain router triggers AGENT-SPEC workflow when agentic domain detected
- **plan-phase.md step 5.6** — Needs AGENT-SPEC.md existence check (parallel to UI-SPEC check)
- **init.cjs** — Needs to report `has_agent_spec` and `agent_spec_path` in phase context JSON
- **model-profiles.cjs** — Register `gsd-agent-researcher` and `gsd-agent-checker` with default models
- **templates/** — New `AGENT-SPEC.md` template file

</code_context>

<specifics>
## Specific Ideas

- User emphasized the researcher should be like a senior consultant: "this is kind of overcomplicating, instead of using the frameworks, we can just make a linear approach" — active pushback, not neutral presentation
- "Many problems I faced is that we do the system and then we need to test it... during troubleshooting you understand that this could be avoided if we think about the approach in the beginning" — observability and architecture decisions prevent debugging pain later
- The educational aspect is essential because "agentic pipelines are pretty new, and not so much known things about it" — the researcher teaches as it goes
- LangGraph state/nodes approach was cited as an example of architecture that enables easy log-based debugging — the spec should capture such traceability decisions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-agent-spec*
*Context gathered: 2026-04-17*
