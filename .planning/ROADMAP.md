# Roadmap: GSD v1.4 Domain-Aware Planning

## Overview

v1.4 makes GSD planning domain-aware. Phase 1 builds the router that classifies what kind of system a phase is targeting. Phase 2 delivers AGENT-SPEC — a structured planning template for agentic systems, the primary new domain. Phase 3 adds an on-demand documentation agent that generates a living system map from existing artifacts. Each phase delivers a complete, independently usable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (1.1, 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Domain Router** - Automatic domain classification replaces hardcoded UI-SPEC trigger in discuss-phase (completed 2026-04-17)
- [x] **Phase 2: AGENT-SPEC** - Full agentic system spec template, questionnaire, checker, and plan-phase integration (completed 2026-04-17)
- [x] **Phase 3: Documentation Agent** - `/gsd2:document` generates a sourced system map from artifacts, code, and git history (completed 2026-04-17, VERIFICATION.md outstanding)
- [x] **Phase 4: Verification Harness and Context Efficiency** - /gsd2:progress token savings, verifier-loop primitives, verify_after task attribute (completed 2026-05-07, dogfood deferred)

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

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Domain Router | 2/2 | Complete | 2026-04-17 |
| 2. AGENT-SPEC | 3/3 | Complete (human_needed) | 2026-04-17 |
| 3. Documentation Agent | 3/3 | Complete (VERIFICATION.md outstanding) | 2026-04-17 |
| 4. Verification Harness | 4/4 | Complete (3/4 plans full; 04-04 Task 4 deferred) | 2026-05-07 |

### Phase 4: Verification harness and context efficiency
**Goal**: Cut /gsd2:progress token cost by ~13k per call AND add a self-healing verifier→investigator→fixer loop (max 3 iterations, fresh contexts) that fires at planner-marked testable boundaries inside execute-phase
**Depends on**: Phase 3
**Requirements**: (none mapped — phase predates v1.4 requirement IDs; must_haves derived from CONTEXT Expected Outcome and AGENT-SPEC test contracts)
**Discussion focus**: Loop architecture (3-agent fresh-context chain, iteration ceiling, ceiling-reached handoff), reuse vs. new agents, verify schema in must_haves, verify_after task marker, default-on with opt-out
**Success Criteria** (what must be TRUE):
  1. Running /gsd2:progress consumes ~13k fewer tokens per call (data scoping + slug cap + double-include removal)
  2. Newly created phase slugs are bounded at ≤45 chars
  3. Author marks tasks with verify_after: true and verify: commands inside must_haves; loop fires automatically when those tasks complete
  4. Loop verifier/investigator/fixer each run in fresh contexts; loop respects max_iterations: 3
  5. Ceiling-reached handoff renders as a CHECKPOINT REACHED block with chronological narrative; executor pauses for user
  6. Standalone callers of gsd-verifier, gsd-debugger, gsd-fixer continue to work (no breaking changes)
**Plans**: 04-01 (Wave 1: context efficiency fix), 04-02 (Wave 1: agent/workflow dependency graph — discovery), 04-03 (Wave 2: loop primitives — verifier/fixer adaptation + verify schema + verify commands subcommand), 04-04 (Wave 3: execute-phase integration + verify_after docs + init verify config)

### Phase 5: Milestone-versioned phase IDs
**Goal**: GSD partitions `.planning/` by milestone so each milestone is a self-contained phase tree (resets to 01, 02, 03…); closing a milestone produces a rich, graph-friendly distillation artifact (`MILESTONE-{version}-SUMMARY.md`); GSD running on an old-layout project auto-detects and retrofits with a one-time user confirmation prompt; default context for `/gsd2:progress` loads only active milestone phases + root docs + prior milestone summaries (not the entire phase tree)
**Depends on**: Phase 4
**Requirements**: TBD (must_haves derived from CONTEXT Expected Outcome — phase predates a fresh requirement-ID batch)
**Discussion focus**: Layout (path-only milestone partitioning), distillation artifact contents (decisions + requirements + open blockers + entry_points + public_api), migration UX (one-time confirmation + dry-run), reference rewrite scope (root files + path-shaped refs in todos/quick), active milestone source (STATE.md `milestone:` field)
**Success Criteria** (what must be TRUE):
  1. After this phase lands, `.planning/v1.4/phases/...` is the canonical location for v1.4 phases; root-level files (PROJECT/ROADMAP/STATE/cross-phase-notes/todos/quick) remain at `.planning/` root
  2. Running GSD on an old-layout project (with `.planning/phases/...` at root) prints a migration plan and prompts `[y/N]` before mutating anything; `--dry-run` mode prints the plan and exits without changes
  3. After user accepts migration: `git mv` preserves history for moved phase directories; STATE.md, PROJECT.md, ROADMAP.md, cross-phase-notes.md and path-shaped refs in `todos/**/*.md` and `quick/**/*.md` are rewritten to use new paths
  4. STATE.md `milestone:` frontmatter is the single source of truth for active milestone; missing/corrupt value causes a clear refusal-and-prompt error, not a path-guess fallback
  5. `/gsd2:complete-milestone` produces `.planning/{milestone}/SUMMARY.md` with sections `decisions[]` (typed, linked to phase IDs), `requirements_validated[]`, `open_blockers[]`, `entry_points[]` (file:symbol), `public_api[]`; format is machine-parseable typed tags (graph-friendly for future Phase 06)
  6. `/gsd2:progress` (and other context-loading commands) load active milestone phases + root docs + summaries of prior closed milestones — not the entire phase tree regardless of milestone count
  7. Decimal-phase resolution (`2.1`, `1.1`) continues to work inside the new partitioned tree; existing workflow placeholders (`{padded_phase}`, `{phase_dir}`, `{phase_number}`) continue to resolve correctly via init.cjs (renaming is a non-breaking extension, not a contract break)
  8. Retrofit of the current `.planning/` (v1.4) to the new layout is performed as the integration test for this phase, committed as part of phase work
**Plans**: 05-01 (Wave 1: CLI partition-aware refactor + init JSON contract extension — SC-1, SC-6, SC-7), 05-02 (Wave 2: migrate-to-milestone-partition subcommand with manifest, dry-run, [y/N] gate, git mv, ref rewriter — SC-2, SC-3, SC-4), 05-03 (Wave 3: distillation artifact, auto-detect hook, workflow markdown refactor, dogfood retrofit on this repo — SC-5, SC-8)
