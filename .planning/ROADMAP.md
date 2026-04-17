# Roadmap: GSD v1.4 Domain-Aware Planning

## Overview

v1.4 makes GSD planning domain-aware. Phase 1 builds the router that classifies what kind of system a phase is targeting. Phase 2 delivers AGENT-SPEC — a structured planning template for agentic systems, the primary new domain. Phase 3 adds an on-demand documentation agent that generates a living system map from existing artifacts. Each phase delivers a complete, independently usable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (1.1, 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Domain Router** - Automatic domain classification replaces hardcoded UI-SPEC trigger in discuss-phase (completed 2026-04-17)
- [ ] **Phase 2: AGENT-SPEC** - Full agentic system spec template, questionnaire, checker, and plan-phase integration
- [ ] **Phase 3: Documentation Agent** - `/gsd2:document` generates a sourced system map from artifacts, code, and git history

## Phase Details

### Phase 1: Domain Router
**Goal**: discuss-phase automatically classifies the domain of a phase and routes to the appropriate spec workflow — no gates, no yes/no prompts
**Depends on**: Nothing (first phase)
**Requirements**: DRTR-01, DRTR-02, DRTR-03, DRTR-04, DRTR-05
**Discussion focus**: Classification heuristics (what signals identify UI vs agentic vs generic), threshold tuning, override mechanism UX, multi-domain phase behavior
**Success Criteria** (what must be TRUE):
  1. Running discuss-phase on a clearly agentic phase description triggers AGENT-SPEC workflow without any prompt to the user
  2. Running discuss-phase on a UI phase triggers UI-SPEC workflow (existing behavior preserved, now via router)
  3. Running discuss-phase on an ambiguous phase description silently falls back to generic workflow; user can override with an explicit flag or keyword
  4. For a phase with both UI and agentic signals, both spec workflows activate
  5. A single visible line in discuss-phase output shows the detected domain and the evidence signals used
**Plans**: 01-01 (Wave 1: discuss-phase router), 01-02 (Wave 2: plan-phase gate simplification)

### Phase 2: AGENT-SPEC
**Goal**: Users planning agentic system phases have a structured spec template with researcher and checker agents, test contracts, and automatic handoff to plan-phase
**Depends on**: Phase 1
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, SPEC-06
**Discussion focus**: AGENT-SPEC field design (what's required vs optional), test contract format alignment with TEST-SPEC.md, researcher questioning strategy, checker validation dimensions, topology pattern catalog scope
**Success Criteria** (what must be TRUE):
  1. After discuss-phase completes for an agentic phase, an AGENT-SPEC.md exists in the phase folder with all core fields populated: agent roster, communication contracts, topology pattern, permission boundaries, test contracts, observability notes
  2. The researcher agent asks targeted questions about the agentic system and fills spec fields from answers — user does not need to know the spec schema
  3. The checker agent surfaces a quality report against defined dimensions; a spec with critical gaps is not silently accepted
  4. Test contracts in the generated AGENT-SPEC are structurally compatible with TEST-SPEC.md (no manual reformatting needed)
  5. plan-phase reads AGENT-SPEC.md as input context when it exists in the phase folder (via init.cjs)
**Plans**: 02-01 (Wave 1: AGENT-SPEC template + AGENTIC-PATTERNS reference), 02-02 (Wave 1: agent registration + config + init.cjs + plan-phase integration), 02-03 (Wave 2: agent-spec-phase workflow + command + discuss-phase trigger)

### Phase 3: Documentation Agent
**Goal**: Users can generate a sourced, up-to-date system map at any point — from a new project with only code, or a mature one with planning artifacts and milestone history
**Depends on**: Phase 2
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06
**Discussion focus**: System map structure and section order, Mermaid diagram types (component, sequence, or both), [undocumented] marker behavior, diff strategy for incremental updates, milestone completion hook placement
**Success Criteria** (what must be TRUE):
  1. `/gsd2:document` runs without error and produces SYSTEM-MAP.md — on a project with no .planning/ directory (code + git only) and on a project with full planning artifacts
  2. SYSTEM-MAP.md contains at least one Mermaid diagram showing component relationships or boundaries
  3. Every claim in SYSTEM-MAP.md cites its source artifact; anything without a traceable source is marked [undocumented]
  4. Running `/gsd2:document` a second time updates SYSTEM-MAP.md incrementally — sections with no changes are preserved, changed sections are updated with a diff note
  5. After milestone completion, the transition workflow surfaces a prompt suggesting the user run `/gsd2:document`
**Plans**: 03-01 (Wave 1: init document + model profiles + mapper/updater agent personas), 03-02 (Wave 1: /gsd2:document command stub), 03-03 (Wave 2: document.md workflow + complete-milestone hook + E2E verification)

## Progress

**Execution Order:** 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Domain Router | 2/2 | Complete   | 2026-04-17 |
| 2. AGENT-SPEC | 0/3 | Planning complete | - |
| 3. Documentation Agent | 0/3 | Planning complete | - |
