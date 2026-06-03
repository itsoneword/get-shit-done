# Requirements: GSD v1.5 Capability Port

**Defined:** 2026-06-03
**Core Value:** Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

**Input analysis:** `.planning/reference/COMPARISON.md` (gsd2-vs-gsd-core), `.planning/reference/NEXT-MILESTONE-SEED.md`, `.planning/reference/IDEAS.md`.

**Guiding principle:** Adopt by *understanding*, not by *copying*. Each capability is ported through the normal discuss → plan → execute → verify loop — selectively, not wholesale.

## v1.5 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Security Hooks (SEC)

- [ ] **SEC-01**: The 4 standalone guard hooks (`prompt-guard`, `read-injection-scanner`, `read-guard`, `worktree-path-guard`) are ported into `hooks/` under the `gsd2:` namespace
- [ ] **SEC-02**: Hooks build via `build-hooks.js` and register through `install.js` settings wiring
- [ ] **SEC-03**: Each hook is config-gated, with on-by-default vs opt-in and advisory (soft) vs hard-block behavior decided per hook
- [ ] **SEC-04**: Hooks run with no TypeScript/build/core-lib dependency (pure standalone JS)

### Research Roster (RSCH)

- [ ] **RSCH-01**: A general technical/domain researcher agent exists, distinct from the narrow `gsd-agent-researcher` (which authors AGENT-SPEC)
- [ ] **RSCH-02**: The general researcher is wired into discuss/plan so technical questions get researched, not guessed
- [ ] **RSCH-03**: The researcher honors the fork's signal-strength ethos — it does not re-ask what CONTEXT.md already marks decided

### Execution Enrichment — References (GUIDE)

- [ ] **GUIDE-01**: Anti-pattern / bug-pattern reference docs exist and are read by the planner/verifier ("what good and bad code looks like")
- [ ] **GUIDE-02**: Good-practices guidance includes Python-specific content (idea #3)

### Execution Enrichment — Context Budget (CTX)

- [ ] **CTX-01**: Context-window degradation tiers + read-depth rules are codified (port of core's `context-budget` reference)
- [ ] **CTX-02**: A context-utilization classifier (healthy / warning / critical) is wired into `gsd-health`

### Execution Enrichment — Plan Convergence (CONV)

- [ ] **CONV-01**: Stall-detection in the existing plan revision loop — escalate when BLOCKER+WARNING counts stop decreasing across cycles

### Verify Fix (FIX)

- [ ] **FIX-01**: `parseMustHavesBlock` handles 2-space indentation so `verify artifacts` / `verify key-links` work on real plans (v1.4 carry-over blocker)

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Knowledge Graph (idea #1)

- **GRAPH-01**: `analyze-dependencies` phase-dependency graph (cheap first step, no external binary)
- **GRAPH-02**: Bug/feature knowledge graph at levels 1/2/3 (reuses core's graph *scaffold*; node/edge schema needs rework)

### Cross-AI Convergence (idea #4)

- **CONVX-01**: Cross-AI plan convergence with external reviewer CLIs (Codex/Gemini/Claude) — feasibility-gated by external dependencies

### Learning Loop (idea #2, #3)

- **LEARN-01**: `extract-learnings` + per-project intel store feeding decisions/lessons into future phases

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Graphify code knowledge graph (full) | Schema needs rework for bug/feature links; depends on external AST binary — backlog |
| Skills system / clusters / surface | Medium surface; revisit after curation need is concrete |
| Workstreams / workspaces / manager | Parallel-execution surface; off the fork's discussion-first direction |
| Cross-AI external-reviewer convergence | High value but feasibility-gated by external CLIs — deferred to future |
| Extra phase modes (mvp/spec/ultraplan/eval/spike) | Each is a command to maintain; tension with prune goal — niche |
| Observability telemetry port | GSD's own telemetry, not user-code logging guidance — low value for this milestone |
| `secure-phase` + security-auditor | Bigger surface than the standalone hooks; hooks first, auditor later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| RSCH-01 | Phase 2 | Pending |
| RSCH-02 | Phase 2 | Pending |
| RSCH-03 | Phase 2 | Pending |
| GUIDE-01 | Phase 3 | Pending |
| GUIDE-02 | Phase 3 | Pending |
| CTX-01 | Phase 3 | Pending |
| CTX-02 | Phase 3 | Pending |
| CONV-01 | Phase 4 | Pending |
| FIX-01 | Phase 4 | Pending |

**Coverage:**
- v1.5 requirements: 13 total
- Mapped to phases: 13 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 — traceability filled, roadmap created*
