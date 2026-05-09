# Phase 2: AGENT-SPEC - Research

**Researched:** 2026-04-17
**Domain:** Agentic system spec template, researcher/checker orchestration, workflow integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- AGENT-SPEC.md is a separate file in the phase directory, not folded into CONTEXT.md [STRONG]
- Follows same lifecycle as UI-SPEC: researcher produces it, checker validates it, planner reads it [STRONG]
- Researcher educates on tradeoffs, pushes back on overcomplicated approaches, draws from topology pattern reference [STRONG]
- 10 design dimensions grouped into three handling modes (design decisions, cross-cutting concerns, lightweight capture) [STRONG]
- Observability as first-class concern — spec must force tracing/logging decisions at design time [STRONG]
- Spec captures WHY, not just WHAT — each decision includes rationale for future debugging [STRONG]
- Exact template field design and structure are research territory [WEAK]

### Claude's Discretion

- Exact AGENT-SPEC.md field names, frontmatter keys, section headers
- Checker dimension definitions and scoring rubric
- Topology pattern catalog scope and depth
- Config key naming (following `workflow.ui_phase` pattern)
- Test contract format details (must align with TEST-SPEC.md)

### Deferred Ideas (OUT OF SCOPE)

- Error handling contracts section in AGENT-SPEC (SPECX-01 — future iteration)
- Config flag for domain router globally (SPECX-02 — future)
- DATA-SPEC template (separate milestone)
- Framework-specific integrations (spec is framework-agnostic by design)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPEC-01 | AGENT-SPEC template with core fields: agent roster, communication contracts, topology pattern, permission boundaries, test contracts, observability | Template structure section — 10-dimension field design with frontmatter and checker sign-off |
| SPEC-02 | Agent researcher gathers context through adaptive questioning | Researcher agent registration, orchestration pattern from ui-phase.md, educator-not-form-filler character |
| SPEC-03 | Checker validates AGENT-SPEC quality against defined dimensions | Checker agent registration, 10 validation dimensions mapped from spec fields |
| SPEC-04 | Test contracts in AGENT-SPEC compatible with TEST-SPEC.md format | TEST-SPEC.md format analyzed — scenario + observables structure maps cleanly |
| SPEC-05 | Framework pattern reference doc with chain/graph/orchestrator/parallel topologies | Topology catalog structure, Anthropic + Andrew Ng pattern sources |
| SPEC-06 | AGENT-SPEC integrates into plan-phase via init.cjs — planner reads spec as input | init.cjs `cmdInitPlanPhase` file discovery pattern, plan-phase prompt construction |

</phase_requirements>

---

## Summary

Phase 2 delivers AGENT-SPEC: a structured architecture contract for agentic system phases, following the established UI-SPEC lifecycle. The codebase makes this straightforward to implement — the researcher/checker orchestration pattern, agent registration system, plan-phase integration hook, and template conventions are all already proven. The primary design work is in (a) the AGENT-SPEC template itself — which 10 fields, which are required vs optional, and how to structure them for debuggability — and (b) the researcher agent's consultant-mode character, which differs from the UI researcher in that it actively challenges overcomplicated approaches.

The TEST-SPEC.md format (Scenario → Observables → Pass criteria) maps cleanly to agentic test contracts. AGENT-SPEC test contracts should use the same scenario/observable/pass-criteria structure but scoped to agent boundaries: each scenario tests what a specific agent does given an input, and what observable outputs/state changes must follow. This means SPEC-04 (format compatibility) is architectural reuse, not a translation problem.

Plan-phase integration (SPEC-06) is already stubbed from Phase 1. The AGENT-SPEC file-existence check is live in plan-phase step 5.6 (`*-AGENT-SPEC.md` check). What remains is teaching init.cjs to surface `has_agent_spec` and `agent_spec_path` in the phase context JSON, and updating the planner prompt to include AGENT-SPEC path when present.

**Primary recommendation:** Build all five deliverables (discuss-phase workflow trigger, agent-researcher agent + prompt, agent-checker agent + prompt, AGENT-SPEC.md template, topology reference doc) as distinct files following exact UI-SPEC structural patterns. One new workflow file (`agent-spec-phase.md`) orchestrates researcher → checker → revision loop.

---

## Standard Stack

This phase is pure markdown/workflow authoring — no npm packages, no language runtimes. "Stack" here means the existing GSD infrastructure components to reuse.

### Core Infrastructure (Reuse, Don't Rebuild)

| Component | Location | Purpose | Pattern |
|-----------|----------|---------|---------|
| ui-phase.md workflow | `get-shit-done/workflows/ui-phase.md` | Orchestration pattern: spawn researcher → checker → revision loop | Copy structure, rename agents |
| UI-SPEC.md template | `get-shit-done/templates/UI-SPEC.md` | Template conventions: frontmatter + sections + checker sign-off | Copy format, replace fields |
| model-profiles.cjs | `get-shit-done/bin/lib/model-profiles.cjs` | Agent model registration (quality/balanced/budget profiles) | Add 2 entries following existing rows |
| config.cjs VALID_CONFIG_KEYS | `get-shit-done/bin/lib/config.cjs` | Allowlist for `config-get`/`config-set` | Add `workflow.agent_spec` key |
| init.cjs `cmdInitPlanPhase` | `get-shit-done/bin/lib/init.cjs` | Phase context JSON bundling for plan-phase | Add `has_agent_spec` + `agent_spec_path` fields using same file-discovery pattern as `context_path` |
| plan-phase.md step 5.6 | `get-shit-done/workflows/plan-phase.md` | AGENT-SPEC file-existence check — Phase 1 already stubbed this | Expand stub: when AGENT-SPEC.md found, set `AGENT_SPEC_PATH` and include in planner prompt |
| discuss-phase.md | `get-shit-done/workflows/discuss-phase.md` | Domain-aware routing — agentic domain triggers AGENT-SPEC workflow | Insert trigger after domain router classifies "Agentic" |
| TEST-SPEC.md template | `get-shit-done/get-shit-done/templates/TEST-SPEC.md` | Scenario/observable format for test contracts | AGENT-SPEC test contract section mirrors this structure |

### New Files to Create

| File | Location | Purpose |
|------|----------|---------|
| agent-spec-phase.md | `get-shit-done/workflows/agent-spec-phase.md` | Full workflow: init → check existing → spawn researcher → checker → revision loop → commit |
| AGENT-SPEC.md template | `get-shit-done/templates/AGENT-SPEC.md` | Spec schema with frontmatter + 10-dimension sections + checker sign-off |
| gsd-agent-researcher.md | `get-shit-done/` (agents dir or inline) | Researcher persona: senior agentic systems consultant, educator role |
| gsd-agent-checker.md | `get-shit-done/` (agents dir or inline) | Checker persona: validates 10 dimensions, returns APPROVED or BLOCKED |
| AGENTIC-PATTERNS.md | `get-shit-done/references/AGENTIC-PATTERNS.md` | Topology pattern catalog: chain, routing, parallel, orchestrator-worker, evaluator-optimizer, autonomous |

---

## Architecture Patterns

### How UI-SPEC Maps to AGENT-SPEC (Direct Analogy)

| UI-SPEC component | AGENT-SPEC equivalent |
|-------------------|-----------------------|
| `ui-phase.md` | `agent-spec-phase.md` |
| `templates/UI-SPEC.md` | `templates/AGENT-SPEC.md` |
| `gsd-ui-researcher` | `gsd-agent-researcher` |
| `gsd-ui-checker` | `gsd-agent-checker` |
| `workflow.ui_phase` config key | `workflow.agent_spec` config key |
| `workflow.ui_safety_gate` config key | `workflow.agent_spec_gate` config key |
| 6 checker dimensions (copy/visual/color/type/spacing/registry) | 10 checker dimensions (roster/topology/contracts/hitl/memory/observability/reflection/security/errors/reasoning) |

The orchestration flow in `agent-spec-phase.md` is structurally identical to `ui-phase.md`:
1. Initialize (read config, resolve models)
2. Check config gate (`workflow.agent_spec`)
3. Check for existing AGENT-SPEC.md (update/view/skip)
4. Spawn `gsd-agent-researcher`
5. Handle researcher return
6. Spawn `gsd-agent-checker`
7. Handle checker return
8. Revision loop (max 2 iterations)
9. Present final status
10. Commit + update state

### AGENT-SPEC.md Template Structure

The template captures all 10 design dimensions grouped as in CONTEXT.md:

```
templates/AGENT-SPEC.md
├── frontmatter (phase, slug, status, created, topology_pattern)
├── ## Agent Roster                    [design decision — researcher asks + educates]
├── ## Orchestration Pattern           [design decision — references AGENTIC-PATTERNS.md]
├── ## Communication Contracts         [design decision — typed message shapes between agents]
├── ## Human-in-the-Loop Boundaries   [design decision — approval gates, escalation]
├── ## Memory Strategy                 [design decision — short-term/persistent/retrieval]
├── ## Observability & Evaluation      [cross-cutting — researcher forces this decision]
├── ## Reflection & Self-Correction    [cross-cutting — tied to evaluation]
├── ## Security & Permission Boundaries [cross-cutting — prompt injection, scope constraints]
├── ## Error Handling & Failure Modes  [cross-cutting — what happens when agents fail]
├── ## Reasoning & Planning Approach   [lightweight — high-level task decomposition notes]
├── ## Test Contracts                  [agent I/O contracts in TEST-SPEC scenario format]
└── ## Checker Sign-Off                [10 dimensions with PASS/FLAG/FAIL status]
```

### Test Contract Format (SPEC-04 Alignment)

The existing TEST-SPEC.md format uses:
- Scenario name + type + preconditions
- Action (exact input)
- Observables (scriptable checks)
- Pass criteria

AGENT-SPEC test contracts use the same structure scoped to agent boundaries:

```markdown
### Contract: {AgentName} — {behavior description}

| Field | Value |
|-------|-------|
| Agent | {agent name from roster} |
| Input | {message type / tool call / state shape} |
| Preconditions | {system state before agent runs} |

**Action:** {exact input payload or trigger}

**Observables:**
- Output matches shape: {schema or example}
- Tool {X} is NOT called unless permission {Y} is present
- State field {Z} is updated with value matching {pattern}

**Pass criteria:** all observables true
**Failure mode covered:** {yes / no}
```

This structure is structurally compatible with TEST-SPEC.md — same columns, same pass/fail binary. It does NOT require manual reformatting to plug into the verification workflow.

### Researcher Character Definition

The `gsd-agent-researcher` persona differs from `gsd-ui-researcher` in one key way: it is an active consultant, not a neutral questioner. From CONTEXT.md:

> "User says LangGraph for a linear pipeline → researcher explains why that adds unnecessary complexity and suggests simpler chain approach"

The researcher should:
1. Open by showing the detected architecture signals from the codebase (existing agent files, framework imports, deployment patterns)
2. Map the phase goal to the closest topology pattern in AGENTIC-PATTERNS.md
3. Challenge the match if it seems overcomplicated ("This sounds like a linear chain — do you need the full graph machinery?")
4. Ask about each of the 10 dimensions, but frame as "here's what I know about your situation, here's the tradeoff, what do you want?"
5. At boundaries between agents, specifically ask: what gets logged, what state is tracked, how to diagnose failure

The agentic domain is newer than UI — the researcher's educator role is higher priority here than in the UI domain.

### Topology Pattern Catalog (SPEC-05)

`AGENTIC-PATTERNS.md` should cover six patterns sourced from Anthropic's "Building Effective Agents" and Andrew Ng's design patterns:

| Pattern | Description | When to Use | Failure Mode |
|---------|-------------|------------|--------------|
| Augmented LLM / Chain | Linear sequence, each step builds on previous | Simple transformations, extraction, summarization | Not for anything requiring retry/branching |
| Routing | Classifier routes input to specialized subagents | Diverse input types needing different handling | Misclassification cascades — needs good fallback |
| Parallel | Independent subagents run simultaneously, results merged | Tasks that don't depend on each other | Synchronization/merge errors, partial failure handling |
| Orchestrator-Workers | Central orchestrator assigns subtasks to specialized workers | Complex tasks needing dynamic decomposition | Orchestrator bottleneck, worker isolation |
| Evaluator-Optimizer | Agent generates output, evaluator scores it, loop continues | Quality-sensitive outputs where criteria are definable | Infinite loops, metric gaming |
| Autonomous/Graph | Full state machine with conditional branching | Long-horizon tasks, uncertain environments | Hard to debug, requires strong observability |

Each entry includes a real-world example, tradeoffs table, and observability requirements specific to that topology.

### Plan-Phase Integration (SPEC-06)

Two changes needed after the workflow and template are built:

**init.cjs change** — Add to `cmdInitPlanPhase` result (same pattern as `context_path` discovery):
```javascript
const agentSpecFile = files.find(f => f.endsWith('-AGENT-SPEC.md') || f === 'AGENT-SPEC.md');
if (agentSpecFile) {
  result.agent_spec_path = toPosixPath(path.join(phaseInfo.directory, agentSpecFile));
  result.has_agent_spec = true;
} else {
  result.has_agent_spec = false;
}
```

**plan-phase.md step 5.6 change** — Expand the Phase 1 stub. Currently the stub checks for `*-AGENT-SPEC.md` and skips silently. Phase 2 activates it: when found, set `AGENT_SPEC_PATH` and add to planner prompt `<files_to_read>` alongside CONTEXT.md and RESEARCH.md.

**discuss-phase.md change** — After domain router classifies "Agentic" (Phase 1's output), invoke the AGENT-SPEC workflow. The trigger point is in the domain routing step, where "UI" already triggers `ui-phase.md`. "Agentic" should trigger `agent-spec-phase.md` equivalently.

### Anti-Patterns to Avoid

- **Forcing 10 questions in sequence:** The researcher should have a natural conversation, not walk through a numbered list. All 10 dimensions get covered, but order follows what the user opens with.
- **Flat templates without rationale fields:** Each section must capture WHY not just WHAT. The observability section especially must capture the tracing rationale so failures trace back to design intent.
- **Test contracts without tool permission assertions:** The user's main debugging pain is knowing which agent failed and why. Tool-permission contracts ("agent X never calls tool Y without Z") are the most valuable test type for agentic systems.
- **Treating topology as binary choice:** Most agentic systems combine patterns. The spec should allow "Orchestrator-Workers with evaluator on output" as a legitimate topology, not force one canonical choice.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Orchestration boilerplate | Custom AGENT-SPEC workflow from scratch | Copy ui-phase.md structure | 12-step flow already handles config gates, existing-spec check, revision loop, commit, state update |
| Agent persona definition | New agent identity system | New .md files read via agent prompt infrastructure | Same mechanism already drives gsd-ui-researcher; no new infrastructure needed |
| Researcher questioning logic | Rigid Q&A state machine | LLM interprets free-form responses | User confirmed: "the LLM's ability to interpret free-text is a feature, not a bug" |
| Test contract format | Custom schema | TEST-SPEC.md scenario/observable structure | Structural reuse means no reformatting for verify-work workflow |

**Key insight:** Every custom piece of infrastructure is technical debt for a markdown-based workflow system. The value is in content (spec design, researcher character, checker dimensions) — not new machinery.

---

## Common Pitfalls

### Pitfall 1: Observability as Afterthought
**What goes wrong:** Spec captures agent roster and topology, but observability section is left vague ("logs will be added").
**Why it happens:** Observability feels like an implementation detail, not a design decision.
**How to avoid:** Researcher explicitly asks "at each agent boundary: what gets logged, what state is tracked, how do you diagnose which agent failed?" Make it a required section, not optional.
**Warning signs:** AGENT-SPEC passes checker but observability section says "TBD" or "standard logging."

### Pitfall 2: Topology Mismatch
**What goes wrong:** User picks LangGraph/graph pattern for a pipeline that's genuinely linear, adding complexity with no benefit.
**Why it happens:** Users hear "agentic" and think they need the most sophisticated framework.
**How to avoid:** Researcher opens by mapping the phase goal to the simplest topology that works, then challenges the user to justify upgrading. AGENTIC-PATTERNS.md "When to Use" column should be prescriptive, not neutral.
**Warning signs:** Phase goal is "extract, transform, summarize" but user proposes full graph with conditional routing.

### Pitfall 3: Agent Roster Without Communication Contracts
**What goes wrong:** Spec lists 4 agents but doesn't define what messages pass between them (types, shapes, failure cases).
**Why it happens:** Communication contracts feel like implementation detail, and users don't naturally think in message types.
**How to avoid:** Checker validates that every agent listed in the roster has at least one communication contract defined. Contracts must include the message shape and what happens when the message is malformed.
**Warning signs:** Roster section has 3+ agents, contracts section has 0-1 entries.

### Pitfall 4: Checker Too Lenient
**What goes wrong:** Checker passes a spec with critical gaps because dimensions are loosely defined ("observability present").
**Why it happens:** Soft dimension definitions let poorly-filled sections pass.
**How to avoid:** Checker dimensions should be binary against concrete criteria. "Observability" passes if and only if: at least one tracing tool is named, at least one boundary-level log statement is described, at least one failure diagnosis path is stated.
**Warning signs:** All 10 dimensions PASS but the spec is 15 lines long.

### Pitfall 5: discuss-phase Integration Breaking UI Flow
**What goes wrong:** Adding the agentic domain trigger breaks the existing UI-SPEC trigger path.
**Why it happens:** discuss-phase domain routing code is modified without testing the UI code path.
**How to avoid:** The UI and agentic triggers are additive — "UI" triggers ui-phase.md, "Agentic" triggers agent-spec-phase.md, "UI+Agentic" triggers both sequentially. Guard each path with its own config key check so they're independently disableable.
**Warning signs:** After Phase 2, running discuss-phase on a UI-domain phase no longer triggers UI-SPEC questionnaire.

---

## Code Examples

### Model Profile Registration (verified from model-profiles.cjs)

Add to `MODEL_PROFILES` object in `get-shit-done/bin/lib/model-profiles.cjs`:
```javascript
// Source: get-shit-done/bin/lib/model-profiles.cjs
'gsd-agent-researcher': { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
'gsd-agent-checker': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
```

Rationale: Same tiers as `gsd-ui-researcher` / `gsd-ui-checker` — researcher needs reasoning power, checker is read-only validation.

Also add to `references/model-profiles.md` table to keep it in sync (file notes both are supposed to match).

### Config Key Registration (verified from config.cjs)

Add to `VALID_CONFIG_KEYS` Set in `get-shit-done/bin/lib/config.cjs`:
```javascript
// Source: get-shit-done/bin/lib/config.cjs
'workflow.agent_spec', 'workflow.agent_spec_gate',
```

Pattern mirrors `workflow.ui_phase` / `workflow.ui_safety_gate`.

### init.cjs AGENT-SPEC Discovery (follows existing file-discovery pattern)

```javascript
// Source: get-shit-done/bin/lib/init.cjs — cmdInitPlanPhase, lines 153-174
// Same file-discovery loop that finds context_path, research_path, etc.
const agentSpecFile = files.find(f => f.endsWith('-AGENT-SPEC.md') || f === 'AGENT-SPEC.md');
if (agentSpecFile) {
  result.agent_spec_path = toPosixPath(path.join(phaseInfo.directory, agentSpecFile));
  result.has_agent_spec = true;
} else {
  result.has_agent_spec = false;
}
```

### AGENT-SPEC Frontmatter

```markdown
---
phase: {N}
slug: {phase-slug}
status: draft
topology_pattern: {chain | routing | parallel | orchestrator-workers | evaluator-optimizer | autonomous | mixed}
agent_count: {N}
created: {date}
---
```

### Checker Return Format (mirrors UI-SPEC checker)

```markdown
## AGENT-SPEC VERIFIED

- [x] Dimension 1 Agent Roster: PASS
- [x] Dimension 2 Orchestration Pattern: PASS
- [x] Dimension 3 Communication Contracts: PASS
- [x] Dimension 4 Human-in-the-Loop: PASS
- [x] Dimension 5 Memory Strategy: PASS
- [x] Dimension 6 Observability: PASS
- [x] Dimension 7 Reflection: PASS
- [x] Dimension 8 Security/Permissions: PASS
- [x] Dimension 9 Error Handling: PASS
- [x] Dimension 10 Reasoning Approach: PASS

**Approval:** approved {YYYY-MM-DD}
```

Or on failure:
```markdown
## ISSUES FOUND

### Critical (must fix)
- Dimension 6 Observability: No tracing tool named, no boundary-level log statements described
- Dimension 3 Contracts: 3 agents in roster but only 1 contract defined

### Recommended (non-blocking)
- Dimension 10 Reasoning: Section is empty — lightweight capture expected
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 2 |
|--------------|------------------|-------------------|
| Hardcoded UI-SPEC keyword grep in plan-phase | Domain-aware CONTEXT.md field read + file-existence check (Phase 1) | AGENT-SPEC hook point already live; Phase 2 just activates it |
| No agentic spec workflow | AGENT-SPEC follows UI-SPEC lifecycle pattern | Full researcher/checker/revise loop proven in UI domain |
| Anthropic "Building Effective Agents" (2024) | 5 workflow patterns + augmented LLM building block | Directly maps to SPEC-05 topology catalog content |
| Andrew Ng 4 agentic design patterns | Reflection, Tool Use, Planning, Multi-Agent Collaboration | Cross-cutting concerns in AGENT-SPEC (reflection, security, memory) |

**Deprecated/outdated:**
- The previous `workflow.ui_phase` gate in plan-phase step 5.6 that ran keyword grep and asked "is this a frontend phase?": now replaced by domain-aware path reading `**Detected domain:**` from CONTEXT.md. Phase 2 adds the agentic equivalent.

---

## Open Questions

1. **Where do agent persona files live?**
   - What we know: `gsd-ui-researcher` and `gsd-ui-checker` are referenced in model-profiles.cjs and resolve-model but no `.md` persona files were found at `~/.claude/get-shit-done/agents/` — agents directory doesn't exist. The researcher/checker behavior is defined inline in the workflow prompt passed to `Task()`.
   - What's unclear: Is there an `agents/` directory in the distributed package that wasn't installed locally, or are all agent personas fully inline in workflow prompts?
   - Recommendation: Implement `gsd-agent-researcher` and `gsd-agent-checker` as inline prompt definitions inside `agent-spec-phase.md` (same approach as ui-phase.md), not as separate .md files. If the project adopts a separate agents/ convention later, it's an easy extraction.

2. **Discuss-phase domain routing integration point**
   - What we know: Phase 1 inserted domain classification in discuss-phase's `build_understanding` step (Step 5.5 in discuss-phase.md). The router writes `**Detected domain:**` to CONTEXT.md.
   - What's unclear: The exact step/position in discuss-phase.md where the AGENT-SPEC workflow trigger should fire relative to the conversation. UI-SPEC fires from plan-phase via `/gsd2:ui-phase`. Does AGENT-SPEC fire from discuss-phase directly, or is it a separate command like `/gsd2:agent-spec-phase`?
   - Recommendation: Create `/gsd2:agent-spec-phase` as a parallel to `/gsd2:ui-phase` — invocable from discuss-phase after agentic classification, and also independently. This preserves the discuss-phase → agent-spec-phase → plan-phase lifecycle flow described in CONTEXT.md.

---

## Validation Architecture

Test infrastructure for this phase: the GSD codebase uses Jest (package.json has jest config + test files at `tests/`). Tests are `.test.cjs` files in the project root `tests/` directory.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing) |
| Config file | `package.json` (jest key) |
| Quick run command | `npm test -- --testPathPattern=agent-spec` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

The deliverables are markdown workflow files, template files, and a small `init.cjs` code change. The testable surface is the init.cjs change.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPEC-06 | `init plan-phase` returns `has_agent_spec: true` when AGENT-SPEC.md present in phase dir | unit | `npm test -- --testPathPattern=agent-spec` | No — Wave 0 |
| SPEC-06 | `init plan-phase` returns `has_agent_spec: false` when no AGENT-SPEC.md | unit | `npm test -- --testPathPattern=agent-spec` | No — Wave 0 |
| SPEC-06 | `agent_spec_path` in result matches correct posix path | unit | `npm test -- --testPathPattern=agent-spec` | No — Wave 0 |

Markdown workflow files (SPEC-01 through SPEC-05) are not unit-testable but have acceptance criteria verifiable via grep:
- `grep -c "Dimension" get-shit-done/templates/AGENT-SPEC.md` returns 10
- `grep -c "gsd-agent-researcher\|gsd-agent-checker" get-shit-done/bin/lib/model-profiles.cjs` returns 2
- `grep -c "workflow.agent_spec" get-shit-done/bin/lib/config.cjs` returns at least 2

### Wave 0 Gaps
- [ ] `tests/agent-spec-init.test.cjs` — covers SPEC-06 init.cjs fields
- No framework install needed — Jest already configured

---

## Sources

### Primary (HIGH confidence)
- `get-shit-done/workflows/ui-phase.md` — full orchestration pattern, steps 1-12
- `get-shit-done/templates/UI-SPEC.md` — template conventions (frontmatter + sections + checker sign-off)
- `get-shit-done/bin/lib/model-profiles.cjs` — agent registration pattern (verified current)
- `get-shit-done/bin/lib/config.cjs` — VALID_CONFIG_KEYS, config key naming convention (verified current)
- `get-shit-done/bin/lib/init.cjs` — `cmdInitPlanPhase` file-discovery loop (lines 153-174, verified current)
- `get-shit-done/workflows/plan-phase.md` step 5.6 — Phase 1 AGENT-SPEC stub confirmed live
- `get-shit-done/get-shit-done/templates/TEST-SPEC.md` — Scenario/observable/pass-criteria format (verified)
- `.planning/phases/01-domain-router/01-02-SUMMARY.md` — confirms Phase 1 agentic stub is active, not commented out

### Secondary (MEDIUM confidence)
- Anthropic "Building Effective Agents" patterns (5 workflow patterns + augmented LLM) — training knowledge, confirmed consistent with Andrew Ng's 4 patterns
- Andrew Ng 4 Agentic Design Patterns — training knowledge, widely cited, consistent across sources

### Tertiary (LOW confidence)
- Agent persona file location — could not verify whether `agents/` directory exists in distributed package; implementation pattern inferred from workflow prompt construction

---

## Metadata

**Confidence breakdown:**
- Standard stack (infrastructure reuse): HIGH — all referenced files verified, patterns confirmed
- Architecture (AGENT-SPEC template design, researcher character): HIGH for structure (follows UI-SPEC), MEDIUM for field content (10 dimensions from user discussion, not from existing code)
- Test contract alignment (SPEC-04): HIGH — TEST-SPEC.md format read and verified, mapping is structurally clean
- Plan-phase integration (SPEC-06): HIGH — init.cjs code read, stub in plan-phase confirmed from Phase 1 summary
- Agent persona location: LOW — agents/ directory not found locally, inferred inline approach

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable GSD infrastructure, low churn)
