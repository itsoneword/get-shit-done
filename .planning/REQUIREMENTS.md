# Requirements: GSD v1.4 Domain-Aware Planning

**Defined:** 2026-04-15
**Core Value:** Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

## v1.4 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Domain Router

- [x] **DRTR-01**: Router classifies phase domain (UI, agentic, generic) from phase description and codebase context
- [x] **DRTR-02**: Classification output is always visible — one line showing detected domain and evidence signals
- [x] **DRTR-03**: Confidence below threshold falls back to generic silently, with override option
- [x] **DRTR-04**: Router replaces existing hardcoded UI-SPEC trigger in discuss-phase
- [x] **DRTR-05**: Router detects multi-domain phases (e.g., UI + agentic) and activates both spec workflows

### AGENT-SPEC

- [x] **SPEC-01**: AGENT-SPEC template with core fields: agent roster, communication contracts (typed), topology pattern, permission boundaries, test contracts, observability (cross-cutting)
- [ ] **SPEC-02**: Agent researcher agent gathers agentic system context through adaptive questioning
- [ ] **SPEC-03**: Agent checker agent validates AGENT-SPEC quality against defined dimensions
- [x] **SPEC-04**: Test contracts in AGENT-SPEC are compatible with existing TEST-SPEC.md format
- [x] **SPEC-05**: Framework pattern reference document showing chain, graph, orchestrator, and parallel topology patterns with examples
- [ ] **SPEC-06**: AGENT-SPEC integrates into plan-phase via init.cjs (planner reads spec as input)

### Documentation Agent

- [ ] **DOCS-01**: `/gsd2:document` command generates system map from planning artifacts, git history, and code
- [ ] **DOCS-02**: System map includes Mermaid diagrams for component relationships and boundaries
- [ ] **DOCS-03**: All documentation claims cite source artifacts — gaps marked as [undocumented]
- [ ] **DOCS-04**: Works for new projects with no milestones (reads code and git history only)
- [ ] **DOCS-05**: Milestone completion workflow suggests running documentation agent
- [ ] **DOCS-06**: Cumulative updates — diffs against existing SYSTEM-MAP.md and updates incrementally

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Additional Domain Specs

- **DATA-01**: DATA-SPEC template for database/performance domain
- **DATA-02**: Domain router recognizes data/performance phases

### AGENT-SPEC Extensions

- **SPECX-01**: Error handling contracts section in AGENT-SPEC
- **SPECX-02**: Config flag to disable domain routing globally

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| DATA-SPEC template | Future domain — same pattern, separate milestone |
| Framework-specific integrations | Spec is framework-agnostic by design |
| Executor agent changes | Existing execution machinery sufficient |
| Inline documentation by executors | Replaced by on-demand doc agent |
| Error handling contracts in AGENT-SPEC | Deferred — can add in follow-on iteration |
| Config flag for domain router | Not needed until more domains exist |
| Router on non-phase actions | Quick fix, todo, debug are domain-agnostic tactical actions |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DRTR-01 | Phase 1 | Complete |
| DRTR-02 | Phase 1 | Complete |
| DRTR-03 | Phase 1 | Complete |
| DRTR-04 | Phase 1 | Complete |
| DRTR-05 | Phase 1 | Complete |
| SPEC-01 | Phase 2 | Complete |
| SPEC-02 | Phase 2 | Pending |
| SPEC-03 | Phase 2 | Pending |
| SPEC-04 | Phase 2 | Complete |
| SPEC-05 | Phase 2 | Complete |
| SPEC-06 | Phase 2 | Pending |
| DOCS-01 | Phase 3 | Pending |
| DOCS-02 | Phase 3 | Pending |
| DOCS-03 | Phase 3 | Pending |
| DOCS-04 | Phase 3 | Pending |
| DOCS-05 | Phase 3 | Pending |
| DOCS-06 | Phase 3 | Pending |

**Coverage:**
- v1.4 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 — traceability filled after roadmap creation*
