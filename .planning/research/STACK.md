# Technology Stack: Domain-Aware Planning — Pattern Research
**Domain:** GSD framework extension — v1.4 milestone
**Research Date:** 2026-04-12
**Scope:** Patterns for AGENT-SPEC template structure, documentation generation, and domain classification. No new runtime dependencies — GSD is a prompt/workflow framework.

---

## What This Document Covers

Three design questions for the v1.4 milestone:

1. **AGENT-SPEC template structure** — What patterns from agentic frameworks (LangGraph, CrewAI, Pydantic AI, AutoGen) should inform the 7-section AGENT-SPEC template?
2. **Documentation generation** — What patterns exist for producing architecture maps from planning artifacts and code?
3. **Domain classification** — What LLM-based classification techniques should inform the domain router?

This is not a "what to install" document. GSD has no new dependencies. This document extracts patterns that inform prompt and template design.

---

## Part 1: AGENT-SPEC Template Patterns

### What the Frameworks Reveal

Four frameworks were examined: LangGraph, CrewAI, Pydantic AI, and AutoGen. Each structures agent definitions differently, but a consistent set of concerns emerges across all four. These concerns map directly to AGENT-SPEC sections.

#### LangGraph: State as the Communication Contract

LangGraph structures multi-agent systems as directed graphs where every node is a function that accepts and returns a shared typed state (TypedDict or dataclass). The key insight for AGENT-SPEC is that **the state schema is the communication contract** — it defines what agents can send and receive, what fields are required at each node boundary, and what the retry/failure shape looks like.

LangGraph's production guidance adds an ACP-style message bus schema with mandatory fields: `intent`, `task_id`, `constraints`, `expected_output_format`. This mirrors a typed API contract — every inter-agent message has a declared shape.

**Pattern to adopt:** AGENT-SPEC's "Communication Contracts" section should require a per-agent schema: input fields (typed), output fields (typed), failure shape. Not just "agent A sends result to agent B" — the schema at the boundary.

#### CrewAI: Task as a Spec Unit

CrewAI structures work as `Task` objects with three required fields: `description` (what the agent must do), `expected_output` (the deliverable standard, not a vague description — a concrete format/schema), and `agent` (who executes it). Tasks can depend on prior task outputs via a `context` attribute — this creates an explicit dependency graph.

The `TaskOutput` pattern enforces a single validated output format per task (raw, JSON, or Pydantic model). The rule: only one output type per task, validated at definition time.

**Pattern to adopt:** AGENT-SPEC's "Agent Boundaries" section should require, for each agent: (a) single stated responsibility, (b) input schema, (c) expected_output with format declaration, (d) context dependencies. The checker validates that no agent has "TBD" output format.

#### Pydantic AI: Output Type as Ground Truth

Pydantic AI makes output_type the primary design decision for any agent. You declare the Pydantic model, the framework generates the JSON schema from it, and the LLM is constrained to produce data that validates against it. If validation fails, the framework retries with the error message.

This is important for AGENT-SPEC: **the output schema is not documentation, it is a contract that drives runtime behavior**. When AGENT-SPEC declares an output type, it should be specific enough to write a Pydantic model from it — not "returns analysis results" but "returns `{ confidence: float, domain: str, evidence: list[str] }`."

**Pattern to adopt:** AGENT-SPEC Communication Contracts must be schema-level, not description-level. The checker should reject schemas that could not be expressed as a TypedDict or Pydantic model.

#### AutoGen: Structured Outputs with Nested Models

AutoGen's structured output pattern uses GPT-4o function calling with nested Pydantic models (e.g., a `MathReasoning` model containing a list of `Step` objects). The nesting is deliberate — it forces decomposition of complex outputs into verifiable sub-structures.

**Pattern to adopt:** For multi-step agents, AGENT-SPEC should distinguish between intermediate state schemas (what gets passed between steps) and terminal output schema (what leaves the agent). Both should be declared.

### Topology Patterns for AGENT-SPEC Section 1

Google Cloud's agentic architecture guidance identifies six topology patterns with distinct structural decisions:

| Topology | Structure | When to Use | Key Risk |
|----------|-----------|-------------|----------|
| Single agent | One LLM, multiple tools | Simple multi-step tasks | Tool complexity ceiling |
| Sequential (chain) | A → B → C, each step feeds next | Structured repeatable processes | Brittle to dynamic conditions |
| Parallel | A, B, C run simultaneously, outputs merged | Independent information gathering | Cost, synthesis complexity |
| Loop | Repeats until termination condition | Iterative refinement | Infinite loop without exit condition |
| Coordinator (orchestrator-workers) | Manager agent decomposes, dispatches to specialists | Complex ambiguous tasks | Latency, manager hallucination |
| Swarm (hierarchical) | All-to-all or multi-level hierarchy | Creative, highly complex problems | Most complex, highest cost |

**Pattern to adopt:** AGENT-SPEC Section 1 (Topology) must name the pattern from this taxonomy and justify the choice. The justification prevents the coordinator pattern being chosen by default for everything — it is the most expensive and should not be the default.

### Security Boundary Patterns (AGENT-SPEC Section 4)

Vercel's security boundary analysis identifies four actors in every agentic system with distinct trust levels:

1. **Agent (LLM runtime)** — Untrusted for credential access; subject to prompt injection
2. **Agent secrets** — Must never be directly accessible to the agent
3. **Generated code** — Potentially hostile; must run in isolated context
4. **Filesystem/environment** — Infrastructure; separate trust boundary from agent runtime

The critical vulnerability: when agent, generated code, and secrets share the same security context. The canonical prevention: the agent accesses capabilities through scoped tool invocations, not direct credential access.

**Pattern to adopt in AGENT-SPEC Section 4:** For each agent, declare: (a) what tools it can invoke (by name, not category), (b) what credentials it cannot access directly, (c) whether it generates code (requires isolation declaration), (d) prompt injection surface (what untrusted input reaches this agent). This is actionable — the planner can write tool scope constraints directly from this section.

### Observability Patterns (AGENT-SPEC Section 5)

The InfoQ agentic development playbook frames observability as: "Which spans to trace, what to log, what the success criteria are, and how to trace LLM calls vs tool calls vs decision points."

The distinction between LLM calls and tool calls matters for instrumentation cost: LLM call tracing is expensive (full token logging), tool call tracing is cheap (structured JSON). AGENT-SPEC should make this explicit.

**Pattern to adopt in AGENT-SPEC Section 5:** Require: (a) named spans (e.g., "classify_intent", "fetch_context"), (b) log level per span (debug / info / warn), (c) sampling strategy (100% for error paths, sampled for success paths), (d) explicit flag for whether LLM input/output is logged (compliance/cost implication).

### Test Contract Patterns (AGENT-SPEC Section 6)

The InfoQ playbook explicitly recommends defining input/output contracts, success criteria, and tracing strategy for each agentic component before implementation. This is the TDD hook for agentic work.

CrewAI's TaskOutput validation pattern provides the unit test shape: given a specific input, the output must validate against the declared schema. For AGENT-SPEC, this means each test scenario has three parts: (a) fixture input (concrete, not abstract), (b) expected output schema compliance, (c) observable assertion (what can be checked in the response without inspecting LLM internals).

**Pattern to adopt in AGENT-SPEC Section 6:** Each agent gets: one unit scenario (isolated, mock dependencies), one integration scenario (real dependencies, check data shape at boundary), one failure injection (what happens when upstream sends malformed input or a tool returns an error). The checker validates that each scenario has a concrete observable — "should return analysis" fails; "should return `{ domain: 'agentic', confidence > 0.7 }`" passes.

---

## Part 2: Documentation Generation Patterns

### The Diagram-as-Code Pattern

The 2026 state of documentation generation has consolidated around two approaches:

**Mermaid** is the de facto standard for diagrams that live in Git. It renders in GitHub, GitLab, Notion, and Obsidian without plugins. The syntax is readable as plain text. It supports flowcharts, sequence diagrams, and architecture diagrams. It diffs meaningfully in PRs.

**Structurizr DSL** is the serious option for C4-model architecture documentation. One model produces multiple diagram views (context, container, component, code). It is more expressive than Mermaid for large systems. The drawback: it requires a Structurizr renderer and the DSL has a learning curve.

**Why this matters for gsd-documenter:** The output format should be Mermaid, not Structurizr. GSD is a CLI tool used in various environments. Mermaid renders in GitHub (where users will view the output) without additional tooling. Structurizr requires a separate server or plugin.

The `gsd-documenter` agent should produce a SYSTEM-MAP.md with embedded Mermaid diagrams for:
- Component topology (what agents exist, how they connect)
- Data flow (how planning artifacts flow through phases)

This is achievable from planning artifacts alone — no AST parsing needed.

### AI-Assisted Architecture Documentation

Claude Code and similar coding agents now generate Mermaid and PlantUML diagrams by reading source files. This validates the gsd-documenter approach: an agent reading structured planning artifacts (CONTEXT.md, AGENT-SPEC.md, PLAN.md files) can synthesize an accurate architecture map.

The key pattern: the agent reads structured documents, not raw code. AGENT-SPEC files are more reliable input than scanning imports because they capture design intent, not implementation accidents.

**Recommendation:** gsd-documenter reads AGENT-SPEC files as the primary source for component topology. It reads PLAN.md files for the component-to-phase mapping. It reads PROJECT.md for the system boundary description. It writes Mermaid diagrams for topology and a narrative for everything else. It does not parse code files — that is the job of `/gsd2:map-codebase`.

### What Not To Build

Do not build automatic diagram synchronization (watching files and regenerating). This is over-engineering for an on-demand command. The user runs `/gsd2:document` when they want the map. The map is a snapshot artifact, not a live view.

Do not generate D2, PlantUML, or Structurizr — Mermaid covers 95% of the need and works in the environments GSD users already use.

---

## Part 3: Domain Classification Techniques

### Why LLM-Based Classification, Not Keyword Matching

A keyword-based domain router (check if text contains "agent", "pipeline", "component") achieves roughly 36% accuracy for intent classification in production measurements. An LLM-based classifier achieves 91%+ accuracy on the same inputs. The performance gap is too large to accept keyword matching for a production feature.

The specific failure mode of keyword matching matters for GSD: a phase goal like "build a workflow orchestration layer" contains no explicit agent-domain keywords but is clearly agentic. A phase goal like "add a pipeline CSS class" contains "pipeline" but is clearly UI work. Keywords fail on both ends.

### Zero-Shot Classification with Structured Output

The recommended technique for the domain router is zero-shot classification with structured output and chain-of-thought reasoning. This means the classification prompt:

1. Describes the domain categories with their distinguishing characteristics
2. Asks the model to reason about the phase content before deciding (CoT)
3. Requires a structured output: `{ domain: "UI_FRONTEND" | "AGENTIC" | "GENERIC", confidence: float, evidence: string[] }`

The CoT step is important: it forces the model to surface evidence before committing to a label. This makes the classification traceable ("evidence: ['phase goal mentions orchestrator', 'CONTEXT.md references LangGraph']") and debuggable when it gets it wrong.

### Confidence Thresholding for Fallback

The agentic classification literature consistently recommends a confidence threshold below which the system escalates or falls back to a safe default. For the domain router, the appropriate fallback is `GENERIC` (suggest plan-phase, no spec step), not an error or a prompt.

A threshold of 0.7 is the industry standard starting point. Below 0.7, default to GENERIC — this is always safe because the user can still run `/gsd2:agent-phase` manually.

**Pattern for domain router prompt:**

```
Given this phase goal and context, classify the domain.

Domains:
- UI_FRONTEND: Building user interfaces — components, pages, layouts, forms, design systems, visual interactions
- AGENTIC: Building AI agent systems — multi-agent pipelines, LLM orchestration, tool-use workflows, inter-agent communication
- GENERIC: Everything else — backend services, data pipelines, CLI tools, infrastructure, testing

Phase goal: {phase_goal}
Phase context summary: {context_excerpt}

Reason step by step:
1. What does the phase goal say about what's being built?
2. What signals in the context reinforce or contradict this?
3. What domain best fits?

Return: { "domain": "<domain>", "confidence": <0-1>, "evidence": ["<signal 1>", "<signal 2>"] }
```

The structured return enables the orchestrator to check confidence programmatically and make the fallback decision deterministically, not by parsing natural language.

### Hierarchical Classification Is Overkill for GSD's Current Scope

The two-tier hierarchical classifier (broad category → domain-specific sub-classifier) is appropriate when there are 10+ domains and the routing has significant consequence (e.g., customer support where wrong routing costs money). GSD v1.4 has three domains. A single zero-shot classifier with structured output is sufficient and easier to maintain.

If domains expand significantly (5+), revisit. The zero-shot classifier degrades gracefully as domains increase — just extend the prompt's domain list.

### Why Not Fine-tuning or RAG

Fine-tuning requires labeled training data (GSD doesn't have it). RAG requires a vector store (a new hard dependency). Both are overkill for a classification task with 3 categories on short text (a phase goal is typically 1-3 sentences). The zero-shot LLM approach has no new dependencies and works immediately.

---

## Summary: What Each Finding Means for GSD v1.4

| Finding | Source | Implication for GSD |
|---------|--------|---------------------|
| State schema = communication contract | LangGraph | AGENT-SPEC Communication Contracts require typed schemas, not descriptions |
| Expected output is a deliverable standard | CrewAI | AGENT-SPEC Agent Boundaries require output format declaration, not just description |
| output_type drives runtime behavior | Pydantic AI | AGENT-SPEC checker rejects schemas that cannot be expressed as TypedDict |
| Four trust levels for agentic actors | Vercel | AGENT-SPEC Security Boundaries require per-agent tool scope list |
| Topology taxonomy with 6 patterns | Google Cloud | AGENT-SPEC Section 1 requires pattern name + justification |
| Trace LLM calls vs tool calls separately | InfoQ | AGENT-SPEC Observability requires per-span log level and sampling strategy |
| Unit + integration + failure injection per agent | CrewAI/InfoQ | AGENT-SPEC Test Contracts require 3 scenarios per agent with concrete observables |
| Mermaid is the right output format | 2026 docs tooling | gsd-documenter writes Mermaid diagrams embedded in SYSTEM-MAP.md |
| AGENT-SPEC files are better input than source code | AI doc generation | gsd-documenter reads planning artifacts, not code |
| LLM classifier >> keyword matching | Classification research | Domain router uses zero-shot LLM with CoT, not keyword heuristics |
| Confidence threshold → GENERIC fallback | Classification research | Router falls back to GENERIC (not error) when confidence < 0.7 |
| Structured output from classifier | LLM classification patterns | Router extracts domain + confidence + evidence programmatically |

---

## Sources

- [LangGraph multi-agent communication architecture](https://www.marktechpost.com/2026/03/01/how-to-design-a-production-grade-multi-agent-communication-system-using-langgraph-structured-message-bus-acp-logging-and-persistent-shared-state-architecture/) — Message schema fields, ACP-style contracts
- [LangGraph agent-to-agent protocol guide](https://bix-tech.com/agent-to-agent-communication-with-langgraph-protocol-based-workflows-a-practical-guide/) — Protocol-based workflow patterns
- [CrewAI tasks documentation](https://docs.crewai.com/en/concepts/tasks) — Task definition structure, TaskOutput validation
- [Pydantic AI agent documentation](https://ai.pydantic.dev/agent/) — output_type as contract, validation retry pattern
- [AutoGen structured output](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/cookbook/structured-output-agent.html) — Nested schema patterns
- [Google Cloud agentic topology patterns](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system) — Six topology patterns with structural decisions
- [Vercel security boundaries in agentic architectures](https://vercel.com/blog/security-boundaries-in-agentic-architectures) — Four-actor trust model, tool scoping, credential isolation
- [InfoQ agentic development playbook](https://www.infoq.com/articles/prompts-to-production-playbook-for-agentic-development/) — Pre-implementation checklists, capability matrices, observability strategy
- [Intent classification in agentic LLM applications](https://medium.com/@mr.murga/enhancing-intent-classification-and-error-handling-in-agentic-llm-applications-df2917d0a3cc) — Hierarchical classification, confidence thresholding
- [Intent detection with LLMs research](https://arxiv.org/abs/2410.01627) — LLM vs. keyword accuracy comparison
- [Diagram-as-code 2026 patterns](https://www.docsie.io/blog/articles/technical-diagrams-docs-as-code-2026/) — Mermaid in docs-as-code workflows
- [AI architecture diagram generation](https://www.morphllm.com/ai-architecture-diagram-generator) — AI-powered Mermaid/PlantUML generation from code/specs
- [Structurizr C4 model tooling](https://www.structurizr.com/) — Model-based architecture documentation (considered, not recommended for GSD)
