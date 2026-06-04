# Requirements: GSD v1.5 Capability Port

**Defined:** 2026-06-03
**Core Value:** Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

**Input analysis:** `.planning/reference/COMPARISON.md` (gsd2-vs-gsd-core), `.planning/reference/NEXT-MILESTONE-SEED.md`, `.planning/reference/IDEAS.md`.

**Guiding principle:** Adopt by *understanding*, not by *copying*. Each capability is ported through the normal discuss → plan → execute → verify loop — selectively, not wholesale.

## v1.5 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Security Hooks (SEC)

- [x] **SEC-01**: The 3 standalone advisory guard hooks (`prompt-guard`, `read-injection-scanner`, `read-guard`) are ported into `hooks/` under the `gsd2-*` filename convention (worktree-path-guard descoped to SEC-DEFER-01 — Phase 1 discussion 2026-06-03)
- [x] **SEC-02**: Hooks build via `build-hooks.js` and register through `install.js` settings wiring
- [x] **SEC-03**: Each hook is config-gated via `.planning/config.json` `hooks.*` keys — scanners (`prompt_guard`, `read_injection_scanner`) on-by-default, `read_guard` opt-in; all 3 advisory (no hard-block ships in Phase 1)
- [x] **SEC-04**: Hooks run with no TypeScript/build/core-lib dependency (pure standalone JS)

### Autonomous Technical Resolution (RSCH)

_Reshaped 2026-06-04 (Phase 2 discussion) from "research roster" to "resolution loop" — per the minimize-human-round-trips north-star. Loops/skills over a new specialized agent; reuse existing capability (discuss-phase micro-research + the `deep-research` skill) rather than rebuild it._

- [x] **RSCH-01**: An autonomous technical-resolution loop exists (research → self-critique → confidence verdict), composed from existing capability — **not** a new specialized agent. The loop raises a technical answer from LOW→HIGH confidence without human input where evidence allows.
- [ ] **RSCH-02**: The loop is wired into the decision points where GSD currently defers technical questions to the human — discuss-phase `question_triage` (TECHNICAL/HYBRID, incl. the LOW-confidence fallback) and plan-phase (which has **no inline research path today**). A technical question reaches the human only when confidence stays LOW after the loop exhausts, or when it is genuine preference/taste.
- [ ] **RSCH-03**: The loop honors signal strength — it does not re-open questions CONTEXT.md marks `[STRONG]`/`[STRONG, user-override]`, and it records resolved technical decisions with provenance + confidence so they are not re-asked downstream.

### Execution Enrichment — References (GUIDE)

- [ ] **GUIDE-01**: Anti-pattern / bug-pattern reference docs exist and are read by the planner/verifier ("what good and bad code looks like")
- [ ] **GUIDE-02**: Good-practices guidance includes Python-specific content (idea #3)

### Execution Enrichment — Context Budget (CTX) — RESHAPED 2026-06-04

> **Reshaped out of Phase 3 → "doctor" phase (TBD).** During Phase 3 discussion the user rejected the human-facing context-utilization classifier ("no need to inform me about it, only need to fix it") — the keep-context-tiny goal is met structurally via partitioning/distillation (already in flight), not via a token-% warning. CTX-01's read-depth tiers lose their consumer once the classifier is gone (`context_window` is a static config field, not a live usage signal). Both requirements migrate to a future agent-assisted **doctor** phase: a semantic extension of the existing `/gsd2:health` + `validate health --repair` that detects decisions documented-then-overwritten and heals docs by archiving superseded ones to prior versions. See `.planning/cross-phase-notes.md`.

- [~] **CTX-01**: ~~Context-window degradation tiers + read-depth rules codified~~ — RESHAPED → doctor phase (consumer-less without a live classifier)
- [~] **CTX-02**: ~~Context-utilization classifier wired into `gsd-health`~~ — RESHAPED → doctor phase (human-facing warning rejected; intent carries to semantic stale-decision healing)

### Execution Enrichment — Plan Convergence (CONV)

- [ ] **CONV-01**: Stall-detection in the existing plan revision loop — escalate when BLOCKER+WARNING counts stop decreasing across cycles

### Verify Fix (FIX)

- [ ] **FIX-01**: `parseMustHavesBlock` handles 2-space indentation so `verify artifacts` / `verify key-links` work on real plans (v1.4 carry-over blocker)

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Security Hooks — descoped (Phase 1 discussion 2026-06-03)

- **SEC-DEFER-01**: `worktree-path-guard` hard-block hook (PreToolUse `Write|Edit|MultiEdit`, exit 2 on absolute paths escaping a linked worktree, #260) — descoped from Phase 1; user doesn't rely on worktree isolation and no other functionality depends on it. Source: `gsd-core/hooks/gsd-worktree-path-guard.js`. Revisit if worktree-isolated execution becomes routine.
- **SEC-DEFER-02**: `gsd-validate-commit.sh` (bash, Conventional Commits hard-block) — larger security-auditor surface, not actively needed.

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
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| RSCH-01 | Phase 2 | Complete |
| RSCH-02 | Phase 2 | Pending |
| RSCH-03 | Phase 2 | Pending |
| GUIDE-01 | Phase 3 | Pending |
| GUIDE-02 | Phase 3 | Pending |
| CTX-01 | doctor (TBD) | Reshaped |
| CTX-02 | doctor (TBD) | Reshaped |
| CONV-01 | Phase 4 | Pending |
| FIX-01 | Phase 4 | Pending |

**Coverage:**
- v1.5 requirements: 13 total
- Mapped to phases: 13 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 — traceability filled, roadmap created*
