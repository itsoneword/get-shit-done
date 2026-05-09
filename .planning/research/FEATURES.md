# Feature Landscape: Domain-Aware Planning (v1.4)

**Domain:** AI-assisted developer tooling — structured planning framework
**Researched:** 2026-04-12
**Downstream consumer:** Roadmap phase definition — table stakes vs differentiators vs anti-features, complexity, dependencies

---

## Feature 1: Domain Router (classify, don't ask)

### What it does
Analyzes a phase description and codebase signals during `discuss-phase` to classify the domain (e.g., "frontend", "agentic", "API", "CLI"), then activates the appropriate spec workflow. Replaces the current yes/no gate pattern ("would you like a UI spec?") with automatic inference.

### Table Stakes

These are required for the feature to work at all:

| Feature | Why Required | Complexity |
|---------|-------------|------------|
| Phase description classification | Core routing mechanism — without this, the feature is manual | Low |
| Codebase signal scanning | Phase description alone is weak signal; file patterns confirm it | Low |
| Route to correct spec workflow | Classification is pointless without an action | Low |
| Subsume existing UI-SPEC trigger | Current trigger fires on non-UI work; router must replace it without breaking it | Low–Medium |
| No new per-domain yes/no gates | Design constraint from PROJECT.md — must scale as domains grow | Structural |

### Differentiators

These add value but aren't blockers for v1:

| Feature | Value Proposition | Complexity |
|---------|------------------|------------|
| Confidence scoring with fallback | Router says "classified as: agentic (high confidence)" or falls back gracefully | Medium |
| Multi-domain detection | A phase may be both frontend and agentic (e.g., an agent UI) | Medium |
| Classification rationale in context | Documents WHY domain was inferred — downstream agents can challenge it | Low |

### Anti-Features (do NOT build)

- Separate command for domain detection (`/gsd2:classify-domain`) — defeats the purpose of transparent routing
- User-configurable domain taxonomy — domain definitions should be opinionated defaults, not a framework to configure
- ML-based embedding classifier — LLM zero-shot with concrete examples achieves 90%+ accuracy for 3-4 domains; embedding infrastructure is unjustified overhead
- Per-project domain overrides stored in config — adds state complexity, classification should be per-phase

### Classification Approach

**Recommended:** Zero-shot LLM classification with few-shot examples embedded in the workflow prompt. This is the correct approach for 3-4 domains at planning time where every call is already an LLM call.

Evidence: The intent recognition gist (mkbctrl) documents that LLM-based classification is "slow and expensive" in high-throughput systems — but `discuss-phase` runs once per phase, so cost and latency are irrelevant. Semantic routing's advantage (speed) doesn't apply here.

Signals to classify on:
1. Phase name and description from ROADMAP.md
2. File extensions present in codebase scout (`.tsx`/`.jsx` → frontend; `agent`, `tool`, `orchestrat` patterns → agentic)
3. Keywords in REQUIREMENTS.md (`agent`, `pipeline`, `model`, `chain` → agentic; `component`, `layout`, `screen` → frontend)
4. Prior CONTEXT.md decisions (if Phase 1 established "this is an agent pipeline", later phases inherit that)

**Decision classes for v1:**
- `frontend` → triggers UI-SPEC workflow
- `agentic` → triggers AGENT-SPEC workflow
- `generic` → no spec, standard discuss flow (current behavior)

### Dependencies on Existing GSD Workflows

- Reads from: ROADMAP.md phase description, codebase scout output (already done in `discuss-phase` step 4)
- Writes to: CONTEXT.md domain field (new field, backward-compatible)
- Modifies: `discuss-phase` step 3 (currently static; becomes router dispatch point)
- Must not break: `ui-phase.md` workflow — router calls it exactly as today, just automatically instead of via user prompt
- Config integration: should respect a `workflow.domain_router: false` escape hatch for projects that want manual control

### Complexity Assessment

**Low overall.** The classification logic fits entirely within the existing `discuss-phase` workflow step 3 ("analyze phase"). It's a prompt addition plus a dispatch branch, not a new command or new infrastructure.

---

## Feature 2: AGENT-SPEC Template and Questionnaire

### What it does
An AGENT-SPEC.md is a planning contract for agentic phases — analogous to UI-SPEC.md for frontend. It captures: what agents exist, how they communicate, what tools they use, security boundaries, observability contracts, and test behaviors. A `gsd-agent-researcher` sub-agent produces it; a `gsd-agent-checker` validates it. Output consumed by `plan-phase`.

### Table Stakes

Required to make the spec actually useful at planning time:

| Field/Section | Why Required | Source/Evidence |
|--------------|-------------|-----------------|
| Agent inventory (name, role, mandate) | Planner must know what agents to scaffold | GSA-TTS template Part I; agile-lab spec identity fields |
| Tool manifest per agent | Planner needs to know what tools to wire | GSA-TTS Part III; agile-lab Tool component |
| Communication contracts (input/output schemas) | This is what makes inter-agent testing possible | A2A protocol; GSA-TTS Part IV Core_Data_Contracts |
| Topology declaration (chain, graph, orchestrator-worker) | Determines wiring pattern the planner generates | Framework comparison research; LangGraph/CrewAI patterns |
| Permission boundaries (what each agent can/cannot do) | Security decisions made at planning not implementation | GSA-TTS Part III Resource_Permissions; Osmani "never do" tier |
| Human-in-the-loop (HITL) triggers | Identifies which decisions require human approval | GSA-TTS Part IV HITL_Triggers; agent security research |
| Test contracts (behavior assertions, not unit tests) | GSD constraint: TDD for agentic work; test contracts at planning time | latent.space TDD article; spec-driven dev sources |
| Observability declarations (what to log, trace, alert) | GSD requirement: "observability in spec, not implementation" | GSA-TTS Part VI Observability_Requirements |

Fields NOT required in v1 (push to later or omit entirely):

| Field | Why Excluded |
|-------|-------------|
| Memory architecture (episodic, semantic, procedural) | Implementation detail, not planning contract |
| Performance benchmarks / SLAs | Premature at planning time; no baseline data |
| Learning mechanism / fine-tuning | Out of scope for this milestone |
| GDPR/compliance flags | Future DATA-SPEC domain |
| Framework-specific config (LangGraph nodes, CrewAI roles) | Design constraint: spec is framework-agnostic |

### Differentiators

| Feature | Value Proposition | Complexity |
|---------|------------------|------------|
| Topology diagram (text-based) | Makes agent wiring visible before code exists; Mermaid or ASCII | Low |
| Failure mode declaration per agent | What happens when agent X fails? Retry, skip, escalate? | Low |
| Security boundary table (read/write access matrix) | One glance shows which agents touch what | Medium |
| Cross-agent state contract | Documents what shared state looks like (not how it's implemented) | Medium |

### Anti-Features (do NOT build)

- Framework-specific AGENT-SPEC variants (LangGraph AGENT-SPEC vs CrewAI AGENT-SPEC) — GSD is framework-agnostic; spec patterns reference topology, not vendor
- Executable spec (spec that runs agents) — spec is a planning document, not a runtime artifact; this is scope creep toward a different tool category
- Automatic agent code scaffolding from spec — that's the planner's job, not the spec's
- Agent registry/catalog for cross-project reuse — massive scope expansion; single-project scope only
- Real observability integration (OpenTelemetry wiring) — spec declares what to observe; implementation is executor's job

### AGENT-SPEC Template Structure (recommended)

```
# Phase [X]: [Name] - Agent Specification

## Topology
[chain | graph | orchestrator-worker | hybrid]
[Mermaid or ASCII diagram showing agent connections]

## Agent Roster
For each agent:
- Name, role, mandate (1 sentence)
- Tool manifest (list of tools, read/write scope)
- Input contract (what it receives, schema)
- Output contract (what it produces, schema)
- HITL triggers (conditions requiring human approval)
- Error behavior (retry / skip / escalate / halt)

## Communication Contracts
[Data shapes flowing between agents — what's passed, not how]

## Permission Matrix
[Table: Agent × Resource → allowed operations]

## Observability Declarations
[What to log per agent, what to trace across agents, alert conditions]

## Test Contracts
[Behavior assertions: "When agent X receives Y, it must produce Z"]
[Edge cases: what happens with malformed input, tool failure, timeout]

## Design Decisions
[Key choices made during discuss-phase that are locked for this spec]
```

### Questionnaire Strategy

The AGENT-SPEC questionnaire (asked during `discuss-phase` for agentic domains) should surface only what can't be inferred:

**Ask the user:**
- How many agents? (roster size determines topology complexity)
- What tools does each agent need? (can't infer business logic tool needs)
- What are the critical failure points? (user knows domain risks)
- What requires human approval? (HITL is a product decision, not technical)

**Infer without asking:**
- Topology from agent count and interaction patterns
- Permission boundaries from tool manifest (if agent only reads, say so)
- Observability baseline (standard: log inputs/outputs per agent, trace full pipeline)
- Test contract skeleton from communication contracts

### Dependencies on Existing GSD Workflows

- Triggers when: domain router classifies phase as `agentic`
- Position in workflow: between `discuss-phase` and `plan-phase`, same position as `ui-phase`
- Parallel pattern: spawns `gsd-agent-researcher` + `gsd-agent-checker` (same pattern as UI-SPEC)
- Feeds: `plan-phase` reads AGENT-SPEC.md as context (same as UI-SPEC.md today)
- New template needed: `.claude/get-shit-done/templates/AGENT-SPEC.md`
- New agents needed: `gsd-agent-researcher.md`, `gsd-agent-checker.md`
- New workflow needed: `workflows/agent-phase.md` (mirrors `ui-phase.md` structure)

### Complexity Assessment

**Medium.** The pattern is established (copy/adapt UI-SPEC pattern). Complexity is in the template design — specifically the communication contracts and test contracts sections, which require careful thought to be useful without being over-specified. The researcher/checker agents need domain knowledge baked in (e.g., knowing what makes a good permission boundary). Execution is straightforward scaffolding once template is right.

---

## Feature 3: Documentation Agent (/gsd2:document)

### What it does
On-demand command that reads all existing GSD planning artifacts (specs, CONTEXT.md files, ROADMAP.md, git log) and produces a system map: architecture overview, component registry, decision log, and data flow documentation. Does not maintain inline docs; one agent reads everything and synthesizes.

### Table Stakes

| Feature | Why Required | Complexity |
|---------|-------------|------------|
| Read all planning artifacts in one pass | Core value prop — single coherent view from fragmented docs | Low |
| Architecture overview section | Most valuable output for a new team member or context refresh | Low |
| Component inventory (what exists and why) | Answers "what is this system made of" | Low |
| Key decisions summary (from CONTEXT.md files) | Decisions are buried per-phase; surfacing them is high value | Low |
| On-demand invocation (`/gsd2:document`) | Design requirement — not inline, not automatic, user-triggered | Low |
| Output to a single navigable file | `.planning/SYSTEM-MAP.md` — one file, one truth | Low |

### Differentiators

| Feature | Value Proposition | Complexity |
|---------|------------------|------------|
| Phase-level data flow narrative | Explains how phases connect, not just what each does | Low |
| Changelog from git log | Shows what changed between phase completions without manual upkeep | Medium |
| "What's incomplete" section | Surfaces in-progress phases, unresolved decisions | Low |
| AGENT-SPEC summary (if present) | For agentic projects: renders agent topology in the system map | Low (reads existing spec) |
| UI-SPEC summary (if present) | For frontend projects: includes design decisions in the map | Low (reads existing spec) |

### Anti-Features (do NOT build)

- Automatic doc generation on every commit or phase transition — noise; doc agent should run when the user wants it
- Inline docs maintained by executor agents during phase execution — GSD PROJECT.md explicitly rules this out ("replaced by on-demand doc agent")
- Dependency graph generation (call graphs, import trees) — requires code analysis tools beyond what Claude reads; false accuracy risk
- Living docs with auto-update hooks — maintenance burden exceeds value; on-demand is the right model
- Multiple output formats (HTML, PDF, wiki) — solve the content problem first; format is cosmetic
- Public API documentation generation — different problem, different audience, different tools

### What Makes Generated Docs Useful vs Noise

Research finding (Kinde article, ScienceDirect paper) is consistent: AI generates volume, humans ensure quality. The key differentiators for the GSD doc agent:

**Useful:**
- Synthesizes across artifacts (not just restates individual files)
- Explains WHY decisions were made (CONTEXT.md captures reasoning; doc agent surfaces it)
- Shows relationships between components, not just lists them
- Flags gaps and unknowns explicitly (incomplete phases, unresolved decisions)
- Human-readable narrative, not machine-structured catalog

**Noise:**
- Restating ROADMAP.md phase list verbatim
- Generating architecture diagrams that can't be verified (hallucinated dependencies)
- Documenting implementation details that will change (function signatures, DB schemas)
- Producing docs that are accurate but don't answer "so what?"

### SYSTEM-MAP.md Structure (recommended)

```
# System Map: [Project Name]

**Generated:** [date]
**From:** [list of source artifacts read]
**Phases complete:** X/Y

## What This System Does
[2-3 sentence synthesis from PROJECT.md + phase completions]

## Architecture Overview
[Narrative: key components, how they fit together, why this structure]

## Component Registry
[Table: Component | Phase it appeared | Purpose | Key decisions]

## Data Flow
[How data moves through the system — from source artifacts, not inferred]

## Key Decisions
[Consolidated from all CONTEXT.md files — decision + phase + signal strength]

## What's In Progress
[Incomplete phases, unresolved decisions, open questions]

## Agent Topology (if AGENT-SPEC exists)
[Reference to AGENT-SPEC sections]

## Sources Read
[List of files used to generate this map]
```

### Dependencies on Existing GSD Workflows

- Reads: all `.planning/` artifacts (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, all phase CONTEXT.md files, AGENT-SPEC.md and UI-SPEC.md if present, git log)
- Writes: `.planning/SYSTEM-MAP.md`
- New command: `/gsd2:document` (new `.claude/commands/gsd2/document.md`)
- New workflow: `workflows/document.md`
- No new sub-agents needed: single agent reads all artifacts and writes output (unlike UI-SPEC/AGENT-SPEC which have researcher + checker; doc generation doesn't need a checker — human reads the output)
- Config: `commit_docs` flag (same as other workflows) to optionally commit SYSTEM-MAP.md after generation

### Complexity Assessment

**Low.** Reading artifacts and synthesizing is a pure LLM writing task — no tool calls beyond Read and Write. The main work is defining the SYSTEM-MAP.md template well so the agent produces consistently structured output. The git log parsing adds minor complexity (bash call + formatting) but is trivial.

---

## Feature Dependencies

```
Domain Router → AGENT-SPEC (router must exist to trigger agent-phase workflow)
Domain Router → UI-SPEC (router subsumes existing trigger — must not regress)
AGENT-SPEC → plan-phase (planner reads AGENT-SPEC.md as context)
/gsd2:document → all planning artifacts (reads but doesn't depend on any specific one existing)
```

Domain router is the enabling dependency for AGENT-SPEC. Document agent is independent — it can be built in any order.

---

## MVP Recommendation

**Phase order:**

1. **Domain Router** — enables everything else, lowest complexity, highest leverage. One wrong classification silently skips a spec workflow, so testing against real phase descriptions is critical.

2. **AGENT-SPEC** — highest value for the stated use case (user builds agent pipelines). Pattern is established from UI-SPEC; main work is template design.

3. **/gsd2:document** — independent, lower urgency, high polish value. Build last.

**Minimum viable AGENT-SPEC:** Roster + communication contracts + test contracts. Skip topology diagram, permission matrix, and observability declarations for a v1. These can be added after the basic spec pattern is validated.

**Minimum viable domain router:** Two domains (frontend, agentic) + generic fallback. Don't generalize the taxonomy before it's been used.

---

## Sources

- [AI Agent Specification Template (GSA-TTS/devCrew_s1)](https://github.com/GSA-TTS/devCrew_s1/blob/master/docs/templates/AI%20Agent%20Specification%20Template.md) — GSA government template, 6-part structure
- [Intent Recognition and Auto-Routing in Multi-Agent Systems](https://gist.github.com/mkbctrl/a35764e99fe0c8e8c00b2358f55cd7fa) — classification patterns, hybrid approach recommendation
- [Agent-Specification spec.md (agile-lab-dev)](https://github.com/agile-lab-dev/Agent-Specification/blob/main/spec.md) — OpenAPI-based agent descriptor with 5 component types
- [How to Write a Good Spec for AI Agents (Addy Osmani)](https://addyosmani.com/blog/good-spec/) — 6 essential areas from analysis of 2,500+ agent configs; three-tier boundary system
- [AI Agents, meet Test Driven Development (Latent Space)](https://www.latent.space/p/anita-tdd) — TDD adaptations for non-deterministic agents
- [Building AI-Enhanced Documentation (Kinde)](https://www.kinde.com/learn/ai-for-software-engineering/best-practice/building-ai-enhanced-documentation-from-code-comments-to-living-architecture-docs/) — useful vs noise in generated docs; human-oversight requirement
- [Generative AI for Software Architecture (ScienceDirect)](https://www.sciencedirect.com/article/pii/S0164121225002766) — AI generates volume, humans ensure quality; UML + RAG patterns
- [CNCF Cloud Native Agentic Standards](https://www.cncf.io/blog/2026/03/23/cloud-native-agentic-standards/) — emerging standards for agent identity, permissions, observability
- [A2A Protocol](https://a2a-protocol.org/latest/) — inter-agent communication standard
