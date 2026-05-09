# Architecture Patterns: Domain-Aware Planning Integration
**Domain:** GSD framework extension — v1.4 milestone
**Analysis Date:** 2026-04-12

---

## What This Document Covers

Three new features need to integrate into the existing GSD architecture:

1. **Domain router** — classify phase domain and auto-trigger appropriate spec workflows
2. **AGENT-SPEC** — spec template and workflow for agentic system phases (mirrors UI-SPEC)
3. **Documentation agent** — on-demand `/gsd2:document` command that reads all artifacts and produces a system map

This document maps each feature's integration points, lists new vs modified files, and calls out dependencies between them.

---

## Feature 1: Domain Router

### Problem Statement

The current `discuss-phase.md` workflow ends with a static next-step suggestion:
```
- `/gsd2:ui-phase ${PHASE}` — generate UI design contract (if frontend work)
```
This is manual and hint-based — the user has to know it applies. It also fires for all phases, meaning non-UI phases see irrelevant guidance. The domain router replaces this with automatic classification: after discuss-phase completes, the orchestrator classifies the phase and routes to the right spec workflow without asking.

### Where the Domain Router Lives

The router belongs **inside `discuss-phase.md`**, specifically at the end of the `confirm_creation` step, replacing the static hint. It does not belong in a separate reference file because it needs access to the phase context already in orchestrator memory (the ROADMAP description, the CONTEXT.md just written, the codebase scout results). Extracting it to a reference file would require re-reading what's already parsed.

It does not belong as a separate workflow step either, because it is not a standalone command — it is a routing decision that happens after every discuss-phase run. A separate file creates unnecessary indirection and makes the routing logic invisible to someone reading discuss-phase.

**Implementation:** Add a `<step name="domain_classify">` step between `confirm_creation` and `git_commit` in `discuss-phase.md`. The step uses a classification heuristic against phase content already in context, then conditionally suggests the appropriate spec command (or nothing if domain is `generic`).

### Classification Logic

The router classifies against the phase goal (from ROADMAP.md) and any `<domain>` block in CONTEXT.md that was just written. It does not ask the user — it infers.

```
Domain signals (check in order — first match wins):
  UI/FRONTEND:   phase goal contains UI keywords (component, page, layout, screen, form, view, modal, dashboard)
                 OR CONTEXT.md <domain> references frontend framework (React, Vue, Next, Tailwind, shadcn)
  AGENTIC:       phase goal contains agent keywords (agent, pipeline, workflow, orchestrator, tool-use, LLM, chain, graph)
                 OR CONTEXT.md <domain> mentions agent frameworks or inter-agent communication
  GENERIC:       neither of the above → no spec workflow triggered
```

Classification is done inline by the orchestrator (no subagent spawn needed — this is pattern matching against content already in context).

### Interaction With Existing UI-SPEC Trigger

Currently `discuss-phase.md` suggests `/gsd2:ui-phase` passively in its next-steps text. The domain router replaces that passive suggestion with an active conditional suggestion in `confirm_creation`:

- If domain = `UI/FRONTEND` → suggest `/gsd2:ui-phase ${PHASE}` (same as today, but now shown only when appropriate)
- If domain = `AGENTIC` → suggest `/gsd2:agent-phase ${PHASE}` (new)
- If domain = `GENERIC` → show only `/gsd2:plan-phase ${PHASE}` (no spec step)

The existing `/gsd2:ui-phase` command and `ui-phase.md` workflow are **not modified** by this feature. The router adds specificity to when the suggestion appears; the UI-SPEC machinery is unchanged.

### Backward Compatibility

If `discuss-phase.md` is called on a phase that was already discussed (update path), the router re-classifies from updated content and updates the suggestion accordingly. This is safe because the suggestion is informational — it does not auto-invoke.

The router does **not** auto-invoke spec workflows. It only changes what appears in the next-steps section. This preserves user control and avoids breaking existing `.planning/` state for projects that discussed phases before this feature shipped.

### Files Modified

| File | Change |
|------|--------|
| `get-shit-done/workflows/discuss-phase.md` | Add `domain_classify` step; replace static UI-SPEC hint in `confirm_creation` with conditional domain-aware suggestion |

### Files Created

None. The router is inline logic in an existing workflow.

---

## Feature 2: AGENT-SPEC

### Pattern Mapping (UI-SPEC → AGENT-SPEC)

The UI-SPEC pattern has these components:
- `templates/UI-SPEC.md` — output document template
- `agents/gsd-ui-researcher.md` — writes the spec
- `agents/gsd-ui-checker.md` — validates the spec
- `workflows/ui-phase.md` — orchestrates researcher → checker → revision loop
- `commands/gsd2/ui-phase.md` — user-facing entry point (`/gsd2:ui-phase`)
- `references/ui-brand.md` — loaded as required reading by the orchestrator

AGENT-SPEC needs the same components with agentic-system specifics.

### New Files Required

| File | Role | Mirror Of |
|------|------|-----------|
| `get-shit-done/templates/AGENT-SPEC.md` | Output document template | `templates/UI-SPEC.md` |
| `agents/gsd-agent-researcher.md` | Writes the AGENT-SPEC | `agents/gsd-ui-researcher.md` |
| `agents/gsd-agent-checker.md` | Validates AGENT-SPEC | `agents/gsd-ui-checker.md` |
| `get-shit-done/workflows/agent-phase.md` | Orchestrates the flow | `workflows/ui-phase.md` |
| `commands/gsd2/agent-phase.md` | Slash command entry point | `commands/gsd2/ui-phase.md` |
| `get-shit-done/references/agent-patterns.md` | Required reading for researcher | `references/ui-brand.md` |

No new `lib/*.cjs` module is needed — `init plan-phase` already provides all necessary context (phase dir, paths, model resolution). The `agent-phase.md` workflow calls `init plan-phase` exactly as `ui-phase.md` does.

### AGENT-SPEC Template Content

The AGENT-SPEC is a contract for agentic system phases. It locks decisions that the planner and executor otherwise make ad-hoc. Sections should cover:

```
1. Topology — Which pattern? (chain, graph, orchestrator-workers, pipeline). One topology per phase.
2. Agent Boundaries — Each agent's single responsibility, input/output contract (schema-level), failure mode.
3. Communication Contracts — Message format (JSON schema or typed dict), transport (in-process vs queue), retries.
4. Security Boundaries — What each agent can/cannot call, credential scope, prompt injection surface.
5. Observability — Which spans to trace, what to log, structured vs unstructured, sampling.
6. Test Contracts — For each agent: unit scenario (input → expected output), integration scenario, failure injection.
7. Checker Sign-Off — (mirrors UI-SPEC dimensions, checked by gsd-agent-checker)
```

The test contracts section is what makes AGENT-SPEC different from UI-SPEC — it produces TDD scaffolding at spec time, before any code is written.

### gsd-agent-researcher Agent

The agent answers: "What communication, security, observability, and test contracts does this agentic phase need?"

Key differences from `gsd-ui-researcher`:
- Codebase scout looks for existing agent patterns, not design tokens
- No "design system gate" equivalent — instead, a "topology gate" that asks what pattern if not inferrable
- Produces test stubs as part of the spec, not just visual contracts

Model profile entry needed in `get-shit-done/bin/lib/model-profiles.cjs` for both `gsd-agent-researcher` and `gsd-agent-checker`.

### gsd-agent-checker Agent

Validates the AGENT-SPEC against these dimensions (analogous to UI-SPEC's 6 dimensions):
1. Topology declared and justified
2. All agent boundaries defined with input/output schemas
3. Communication contracts complete (no "TBD" fields)
4. Security boundaries explicit (not "assume safe")
5. Observability plan actionable (named spans, log levels specified)
6. Test contracts executable (each scenario has a concrete action + observable)

### agent-phase.md Workflow

Exactly mirrors `ui-phase.md`:
1. Initialize via `init plan-phase`
2. Check existing AGENT-SPEC
3. Spawn `gsd-agent-researcher` with phase context
4. Spawn `gsd-agent-checker`
5. Revision loop (max 2 iterations)
6. Present final status with next steps (`/gsd2:plan-phase`)
7. Commit + update state

The `required_reading` block loads `references/agent-patterns.md` (same role as `ui-brand.md` for UI workflows).

### agent-phase.md Command Stub

```markdown
---
name: gsd2:agent-phase
description: Generate agent system contract (AGENT-SPEC.md) for agentic phases
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
Create an agent system contract (AGENT-SPEC.md) for an agentic phase.
Orchestrates gsd-agent-researcher and gsd-agent-checker.
Flow: Validate → Research Contracts → Verify AGENT-SPEC → Done
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/agent-phase.md
@~/.claude/get-shit-done/references/agent-patterns.md
</execution_context>

<context>
Phase number: $ARGUMENTS — optional, auto-detects next unplanned phase if omitted.
</context>

<process>
Execute @~/.claude/get-shit-done/workflows/agent-phase.md end-to-end.
Preserve all workflow gates.
</process>
```

### Modified Files for AGENT-SPEC

| File | Change |
|------|--------|
| `get-shit-done/bin/lib/model-profiles.cjs` | Add `gsd-agent-researcher` and `gsd-agent-checker` entries to all three profiles (quality/balanced/budget) |
| `bin/install.js` | Add new agents to `CODEX_AGENT_SANDBOX` map; add new agent files to install copy list |

### How gsd-planner Consumes AGENT-SPEC

The planner already reads all files in its `<files_to_read>` block that exist in the phase directory. `init plan-phase` does not currently surface `has_agent_spec` in its JSON — the planner would need to discover the AGENT-SPEC file via glob or the orchestrator would need to pass the path explicitly.

Two options:
1. Add `agent_spec_path` to `cmdInitPlanPhase` in `init.cjs` (preferred — mirrors how `context_path`, `research_path`, `uat_path` are resolved)
2. Have the `plan-phase.md` workflow glob for `*-AGENT-SPEC.md` before building the planner prompt

Option 1 is cleaner and consistent with the existing pattern. Add to `cmdInitPlanPhase`:
```javascript
const agentSpecFile = files.find(f => f.endsWith('-AGENT-SPEC.md') || f === 'AGENT-SPEC.md');
if (agentSpecFile) {
  result.agent_spec_path = toPosixPath(path.join(phaseInfo.directory, agentSpecFile));
}
```

Then `plan-phase.md` includes `{agent_spec_path}` in the planner's `<files_to_read>` block when non-null.

---

## Feature 3: Documentation Agent

### Design Decision: New Command, Not Extension of Existing Workflows

The documentation agent is on-demand, not phase-lifecycle-bound. It does not fit into discuss → plan → execute → verify. It reads existing artifacts and synthesizes a system map. It should be a standalone command: `/gsd2:document`.

This is the same pattern as `/gsd2:map-codebase` — a standalone command that reads artifacts and produces a snapshot. The documentation agent is the planning-level equivalent.

### New Files Required

| File | Role |
|------|------|
| `agents/gsd-documenter.md` | Agent persona — reads all planning artifacts, writes system map |
| `get-shit-done/workflows/document.md` | Orchestration workflow |
| `commands/gsd2/document.md` | Slash command entry point |
| `get-shit-done/templates/SYSTEM-MAP.md` | Output document template |

No new `lib/*.cjs` module needed. The workflow calls existing `init` commands for context.

### What the Documentation Agent Reads

The agent synthesizes from all existing artifacts. The orchestrator (`document.md` workflow) gathers paths and passes them in the agent prompt:

**Planning artifacts (from `.planning/`):**
- `PROJECT.md` — Vision, requirements, key decisions
- `ROADMAP.md` — Phase structure and goals
- `STATE.md` — Current progress, blockers, decisions
- `REQUIREMENTS.md` — Full requirement set

**Phase artifacts (per phase, from `.planning/phases/NN-slug/`):**
- `*-CONTEXT.md` — User decisions per phase
- `*-PLAN.md` — Implementation plans (tasks, waves)
- `*-SUMMARY.md` — What was built per phase
- `*-UI-SPEC.md` — UI contracts (if exist)
- `*-AGENT-SPEC.md` — Agent contracts (if exist)
- `*-VERIFICATION.md` — Verification results

**Codebase context (from `.planning/codebase/`):**
- `ARCHITECTURE.md`, `STRUCTURE.md`, etc. (if generated by `/gsd2:map-codebase`)

**Git history:**
- The workflow calls `history-digest` from gsd-tools to get a structured summary of all SUMMARY.md data

### Output: SYSTEM-MAP.md

Written to `.planning/SYSTEM-MAP.md` (not in a phase directory — it is a project-level artifact).

Template sections:
```
1. System Overview — one paragraph, what this system does end-to-end
2. Architecture Summary — components, boundaries, how they connect
3. Phase Build History — what each shipped phase delivered (from SUMMARYs)
4. Current State — active phase, progress, open decisions
5. Domain Contracts — index of all specs (UI-SPECs, AGENT-SPECs) with links
6. Key Decisions Log — decisions from STATE.md + PROJECT.md consolidated
7. Open Questions — unresolved blockers, deferred ideas across all phases
```

The agent does NOT generate new decisions or recommendations — it reads and synthesizes only. This is explicit in the agent definition to prevent scope creep.

### document.md Workflow

```
1. Initialize — call `init progress` for project-level context
2. Gather artifact index — find all phase dirs and their artifact files
3. Gather git history — call `history-digest` for SUMMARY data
4. Spawn gsd-documenter with full file list
5. Handle return
6. Write .planning/SYSTEM-MAP.md
7. Commit (if commit_docs)
8. Update state
```

The orchestrator passes the full file list to the agent, but the agent reads them. This is the same division as ui-phase (orchestrator gathers paths, researcher reads and writes). The gsd-documenter does the reading and synthesis; the orchestrator handles state updates.

### gsd-tools.cjs Changes

The documentation workflow needs to discover all phase artifact files. The existing `history-digest` command already aggregates SUMMARY.md data. What's missing is a command to list all spec files (UI-SPEC, AGENT-SPEC) across phases.

**Option A (no gsd-tools change):** The `document.md` workflow uses a bash glob directly:
```bash
find .planning/phases -name "*-UI-SPEC.md" -o -name "*-AGENT-SPEC.md" 2>/dev/null
```
This works but is fragile (bash glob in a workflow).

**Option B (add to gsd-tools):** Add `init document` compound command to `init.cjs` that returns all relevant artifact paths in one JSON call. Follows the established pattern.

Option B is preferred for consistency. The `init document` command would return:
```json
{
  "project_path": ".planning/PROJECT.md",
  "roadmap_path": ".planning/ROADMAP.md",
  "state_path": ".planning/STATE.md",
  "requirements_path": ".planning/REQUIREMENTS.md",
  "codebase_maps": [".planning/codebase/ARCHITECTURE.md", ...],
  "phases": [
    {
      "phase_number": "1",
      "phase_name": "...",
      "phase_dir": ".planning/phases/01-slug",
      "context_path": "...",
      "plan_paths": [...],
      "summary_paths": [...],
      "ui_spec_path": "...",
      "agent_spec_path": "...",
      "verification_path": "..."
    },
    ...
  ]
}
```

This is one new function `cmdInitDocument` in `init.cjs`, registered in the `switch` block in `gsd-tools.cjs`. Moderate scope — roughly 60 lines of new code following existing patterns.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `discuss-phase.md` (modified) | Discussion + domain classification | Writes CONTEXT.md, suggests spec command |
| `agent-phase.md` (new workflow) | Orchestrates AGENT-SPEC creation | Spawns gsd-agent-researcher, gsd-agent-checker |
| `gsd-agent-researcher` (new agent) | Writes AGENT-SPEC.md from phase context | Reads CONTEXT.md, RESEARCH.md, ROADMAP section |
| `gsd-agent-checker` (new agent) | Validates AGENT-SPEC.md | Reads AGENT-SPEC.md, CONTEXT.md |
| `document.md` (new workflow) | Gathers artifacts, spawns documenter | Calls `init document`, spawns gsd-documenter |
| `gsd-documenter` (new agent) | Reads all artifacts, writes SYSTEM-MAP.md | Reads all phase dirs, PROJECT.md, ROADMAP.md |
| `init.cjs` (modified) | Compound init commands | Add `cmdInitDocument`; add `agent_spec_path` to `cmdInitPlanPhase` |
| `model-profiles.cjs` (modified) | Agent-to-model mapping | Add entries for gsd-agent-researcher, gsd-agent-checker, gsd-documenter |
| `plan-phase.md` (modified) | Phase planning orchestration | Add `agent_spec_path` to planner's files_to_read |
| `bin/install.js` (modified) | GSD installation | Add new agents to sandbox map and copy list |

---

## Data Flow: Domain-Aware Discuss → Plan

```
/gsd2:discuss-phase N
  → discuss-phase.md
    → [conversation + codebase scout]
    → [domain_classify step]
      → domain = UI/FRONTEND → suggest /gsd2:ui-phase N
      → domain = AGENTIC    → suggest /gsd2:agent-phase N
      → domain = GENERIC    → suggest /gsd2:plan-phase N (no spec step)
    → writes NN-CONTEXT.md

/gsd2:agent-phase N       (if agentic domain)
  → agent-phase.md
    → init plan-phase N (gets all context paths)
    → spawn gsd-agent-researcher
      → reads CONTEXT.md, ROADMAP section, REQUIREMENTS.md
      → writes NN-AGENT-SPEC.md
    → spawn gsd-agent-checker
      → validates 6 dimensions
    → revision loop (max 2)
    → suggests /gsd2:plan-phase N

/gsd2:plan-phase N
  → plan-phase.md
    → init plan-phase N (now includes agent_spec_path)
    → spawn gsd-planner
      → reads CONTEXT.md, RESEARCH.md, AGENT-SPEC.md (if present), REQUIREMENTS.md
      → writes N-PLAN.md files with test contracts from AGENT-SPEC
```

```
/gsd2:document
  → document.md
    → init document (new) → returns all artifact paths
    → history-digest → SUMMARY data
    → spawn gsd-documenter
      → reads all phase artifacts
      → writes .planning/SYSTEM-MAP.md
```

---

## Build Order and Dependencies

The three features have a dependency chain:

```
Feature 1 (Domain Router)
  → No dependencies on 2 or 3
  → Can be built first
  → Only modifies discuss-phase.md

Feature 2 (AGENT-SPEC)
  → Depends on Feature 1 to be routed correctly (but can work independently — /gsd2:agent-phase is a direct command)
  → Requires model-profiles.cjs changes before agents can be spawned
  → Requires init.cjs change (agent_spec_path) before planner can consume AGENT-SPEC

Feature 3 (Documentation Agent)
  → Depends on Feature 2 to document AGENT-SPEC contracts (but degrades gracefully without them)
  → Requires init.cjs change (cmdInitDocument) — independent from Feature 2's init change
  → Can consume AGENT-SPEC.md files if they exist; skips if not
```

**Recommended build order:**
1. Feature 1 — domain router in discuss-phase.md (pure text edit, no code changes, lowest risk)
2. Feature 2 — AGENT-SPEC (most new files, but each file is independent; test with a real agentic phase)
3. Feature 3 — Documentation agent (consumes outputs of both; easiest to verify once 1+2 exist)

Feature 2 and 3 share one init.cjs change (both add new compound commands). This is not a conflict — they are separate functions in the same file. They can be developed in parallel but should be merged carefully.

---

## What Changes in Each Existing File

### `get-shit-done/workflows/discuss-phase.md`
- Add `<step name="domain_classify">` between `confirm_creation` and `git_commit`
- Replace static UI-SPEC hint in `confirm_creation`'s next-steps block with conditional domain-aware routing text

### `get-shit-done/workflows/plan-phase.md`
- In the planner's `<files_to_read>` block, add conditional line: `- {agent_spec_path} (Agent System Contract — if agentic phase)`

### `get-shit-done/bin/lib/init.cjs`
- `cmdInitPlanPhase`: add `agent_spec_path` detection (5 lines, follows `uat_path` pattern)
- Add `cmdInitDocument` function (new compound command, ~60 lines)

### `get-shit-done/bin/gsd-tools.cjs`
- Add `require` for any new lib module (none needed — init.cjs handles everything)
- Register `init document` in the `switch` block for `init` commands

### `get-shit-done/bin/lib/model-profiles.cjs`
- Add entries for `gsd-agent-researcher`, `gsd-agent-checker`, `gsd-documenter` to quality/balanced/budget profile objects

### `bin/install.js`
- Add `gsd-agent-researcher.md`, `gsd-agent-checker.md`, `gsd-documenter.md` to agent install list
- Add entries in `CODEX_AGENT_SANDBOX` for sandbox level assignment

---

## Anti-Patterns to Avoid

**Do not add a per-domain yes/no gate in discuss-phase.md.** The PROJECT.md explicitly states "classify, don't ask." Adding `AskUserQuestion("Is this an agentic system?")` defeats the purpose and breaks the scalability of the pattern as more domains are added.

**Do not modify ui-phase.md or the UI-SPEC agents.** The domain router only changes what gets suggested after discuss-phase; the UI-SPEC machinery is unchanged.

**Do not invoke agent-phase or ui-phase automatically from discuss-phase.** The domain router suggests; it does not auto-invoke. This preserves user control and avoids the nested AskUserQuestion bug documented in plan-phase.md (#1009).

**Do not put AGENT-SPEC sections in CONTEXT.md.** CONTEXT.md captures user decisions. AGENT-SPEC captures system contracts. These are different documents for different audiences (user vs planner/executor). Mixing them creates ambiguity about signal strength.

**Do not have gsd-documenter make recommendations.** Its role is synthesis, not analysis. Adding recommendations creates output that can't be traced to a source artifact and pollutes the system map with untraceable suggestions.

---

## Sources

- `/Users/itsoneword/Downloads/devProjects/GSD/get-shit-done/.planning/PROJECT.md` — v1.4 requirements and constraints
- `/Users/itsoneword/Downloads/devProjects/GSD/get-shit-done/.planning/codebase/ARCHITECTURE.md` — layer definitions and patterns
- `/Users/itsoneword/Downloads/devProjects/GSD/get-shit-done/.planning/codebase/STRUCTURE.md` — file locations and naming conventions
- `get-shit-done/workflows/discuss-phase.md` — existing discuss workflow (direct inspection)
- `get-shit-done/workflows/ui-phase.md` — UI-SPEC orchestration pattern (direct inspection)
- `agents/gsd-ui-researcher.md` — UI-SPEC researcher agent pattern (direct inspection)
- `get-shit-done/templates/UI-SPEC.md` — UI-SPEC template structure (direct inspection)
- `get-shit-done/bin/lib/init.cjs` — `cmdInitPlanPhase` artifact resolution pattern (direct inspection)
- `get-shit-done/bin/gsd-tools.cjs` — command registry structure (direct inspection)
