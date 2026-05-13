---
milestone: v1.4
name: Domain-Aware Planning
shipped: 2026-05-13
phases: [01, 02, 03, 04, 05]
schema_version: 1
# --- (end frontmatter)

# Milestone v1.4 — Domain-Aware Planning Summary

Distilled artifact. Machine-parseable typed-tag sections (Phase 6 graph-indexable).

## decisions[]

- id: "dec-1"
  text: "Domain classification router inserted into discuss-phase Step 5.5 as inline LLM logic -- no new agent or CLI command"
  phase: "01-domain-router"
  type: "design"
  rationale: null
- id: "dec-2"
  text: "CONTEXT.md domain fields (Detected domain/Evidence/Confirmed by user) are the Phase 2 stub -- no additional config or state files needed"
  phase: "01-domain-router"
  type: "design"
  rationale: null
- id: "dec-3"
  text: "Domain classification reads Detected domain from CONTEXT.md in plan-phase step 5.6 rather than re-running keyword grep"
  phase: "01-domain-router"
  type: "design"
  rationale: null
- id: "dec-4"
  text: "Agentic stub in plan-phase is an active AGENT-SPEC.md check that skips silently when file missing"
  phase: "01-domain-router"
  type: "design"
  rationale: "clean hook for Phase 2"
- id: "dec-5"
  text: "[Phase 02-01]: Test contract format mirrors TEST-SPEC.md exactly (Action/Observables/Pass criteria) for SPEC-04 structural reuse"
  phase: "02-agent-spec"
  type: "design"
  rationale: null
- id: "dec-6"
  text: "[Phase 02-01]: Observability section uses three required subsections (Tracing, Boundary Logging, Failure Diagnosis) so checker can validate concretely"
  phase: "02-agent-spec"
  type: "design"
  rationale: null
- id: "dec-7"
  text: "[Phase 02-01]: AGENTIC-PATTERNS.md uses GSD's own workflows (discuss/plan/execute pipeline, domain router, wave executor) as concrete real-world examples"
  phase: "02-agent-spec"
  type: "design"
  rationale: null
- id: "dec-8"
  text: "Used Node:test runner for new test (Jest not a project dependency)"
  phase: "02-agent-spec"
  type: "design"
  rationale: null
- id: "dec-9"
  text: "AGENT-SPEC discovery added to both init plan-phase and execute-phase for symmetry"
  phase: "02-agent-spec"
  type: "design"
  rationale: null
- id: "dec-10"
  text: "[Phase 02-03] Researcher and checker personas defined inline in agent-spec-phase.md prompts (no separate agent .md files), matching ui-phase.md convention"
  phase: "02-agent-spec"
  type: "design"
  rationale: null
- id: "dec-11"
  text: "[Phase 02-03] Checker uses binary PASS/FLAG/FAIL criteria; Observability dimension treats TBD or standard logging as automatic FAIL"
  phase: "02-agent-spec"
  type: "design"
  rationale: null
- id: "dec-12"
  text: "[Phase 02-03] discuss-phase change is additive one-line (agent-spec-phase shown alongside ui-phase, not replacing)"
  phase: "02-agent-spec"
  type: "design"
  rationale: null
- id: "dec-13"
  text: "[Phase 03-02] .claude/ runtime copy is gitignored; commit only commands/gsd2/*.md source"
  phase: "03-documentation-agent"
  type: "design"
  rationale: "install.js propagates to runtime"
- id: "dec-14"
  text: "existing_subsystems filter excludes both _gaps.md and _proposed.md (updater scratch file)"
  phase: "03-documentation-agent"
  type: "design"
  rationale: null
- id: "dec-15"
  text: "completed_phases_since returns all [x] phases (not date-filtered)"
  phase: "03-documentation-agent"
  type: "design"
  rationale: "orchestrator diffs against prior map"
- id: "dec-16"
  text: "document-mapper/updater profile = sonnet/sonnet/haiku (higher balanced than codebase-mapper since narrative writing needs more reasoning)"
  phase: "03-documentation-agent"
  type: "design"
  rationale: null
- id: "dec-17"
  text: "[Phase 04-02] File-level granularity (no line numbers) for the dependency graph"
  phase: "04-verification-harness-and-context-efficiency"
  type: "design"
  rationale: "keeps it readable and stable across edits"
- id: "dec-18"
  text: "[Phase 04-02] Subcommand caller regex tolerates quoted absolute path (gsd-tools.cjs[\"]? <verb>) since workflows wrap paths in double quotes"
  phase: "04-verification-harness-and-context-efficiency"
  type: "design"
  rationale: null
- id: "dec-19"
  text: "[Phase 04-02] Distinguish callers (any reference) from spawned_by (Task() invocations) so Risk Surface for 04-03 cleanly identifies what loop-mode adapter must preserve"
  phase: "04-verification-harness-and-context-efficiency"
  type: "design"
  rationale: null
- id: "dec-20"
  text: "[Phase 04-01] Scoped phase slice anchors on currentPhase || nextPhase || phases[0] with [anchor-1, anchor+2] window"
  phase: "04-verification-harness-and-context-efficiency"
  type: "design"
  rationale: null
- id: "dec-21"
  text: "[Phase 04-01] Slug cap order: slice(0, 45) THEN strip trailing hyphen"
  phase: "04-verification-harness-and-context-efficiency"
  type: "design"
  rationale: "handles edge cases where slice lands on a separator"
- id: "dec-22"
  text: "[Phase 04-01] All edits mirrored in source (get-shit-done/, commands/) AND runtime (.claude/)"
  phase: "04-verification-harness-and-context-efficiency"
  type: "design"
  rationale: "only source committed since runtime is gitignored"
- id: "dec-23"
  text: "[Phase 04-03] gsd-debugger needed no source change"
  phase: "04"
  type: "design"
  rationale: "find_root_cause_only mode + symptoms_prefilled flag pre-existed; verified by grep, no commit"
- id: "dec-24"
  text: "[Phase 04-03] verify expect: regex requires /pattern/ wrapping"
  phase: "04"
  type: "design"
  rationale: "bare strings treated as equality (matches plan template documentation)"
- id: "dec-25"
  text: "[Phase 04-03] cmdVerifyCommands always emits JSON regardless of --raw"
  phase: "04"
  type: "design"
  rationale: "loop verifier and jq pipelines need parseable output unconditionally"
- id: "dec-26"
  text: "[Phase 04-03] Loop verifier Step LOOP-1 calls 'verify commands <plan_path>'"
  phase: "04"
  type: "design"
  rationale: "plan file is source of truth; inline verify_commands in contract is redundancy/shape-validation only"
- id: "dec-27"
  text: "[Phase 04-03] Wrote new parseVerifyCommands instead of extending parseMustHavesBlock"
  phase: "04"
  type: "design"
  rationale: "latter has latent 4-space-indent bug; reused by other verify subcommands; risk-isolated new helper"
- id: "dec-28"
  text: "Deferred Task 4 (manual harness dogfood)"
  phase: "04"
  type: "design"
  rationale: "GSD self-verification needs its own workflow design"
- id: "dec-29"
  text: "[Phase 05-01] phasesDir(cwd) is the single chokepoint; planningPaths().phases is a getter that delegates to it, cascading partition-awareness to ~13 indirect callers"
  phase: "05-milestone-versioned-phase-ids"
  type: "design"
  rationale: null
- id: "dec-30"
  text: "[Phase 05-01] phasesDir back-compat fallback: when STATE.md milestone is set but partitioned dir doesn't exist AND legacy dir exists, return legacy (lets retrofit migration run without breakage)"
  phase: "05-milestone-versioned-phase-ids"
  type: "design"
  rationale: null
- id: "dec-31"
  text: "[Phase 05-01] Init JSON contract: milestone_root/partition_root/legacy_layout_detected/prior_milestones[] are additive fields spread into result objects"
  phase: "05-milestone-versioned-phase-ids"
  type: "design"
  rationale: "existing fields unchanged"
- id: "dec-32"
  text: "Manifest deletion happens BEFORE git add"
  phase: "05-02"
  type: "design"
  rationale: "manifest is a recovery scratch file, not a commit artifact"
- id: "dec-33"
  text: "migration.cjs reuses buildMilestoneContext(cwd).milestone_root for STATE.md milestone lookup; also references extractCurrentMilestone"
  phase: "05-02"
  type: "design"
  rationale: "no third local parser (RESEARCH.md §3 anti-pattern)"
- id: "dec-34"
  text: "Pre-flight clean-tree check scoped to .planning/ only (not full repo)"
  phase: "05-02"
  type: "design"
  rationale: "user may have unrelated WIP in src/"
- id: "dec-35"
  text: "PATTERN_BARE swept only inside todos/ and quick/; root files (PROJECT/ROADMAP/STATE/cross-phase-notes) only get FULL_PATH rewrites"
  phase: "05-02"
  type: "design"
  rationale: "protects free prose like 'see phases 1-3'"
- id: "dec-36"
  text: "W4: migration_hint is informational auto-detect at every init call; actual migration requires explicit --yes confirmation"
  phase: "05"
  type: "design"
  rationale: "auto-retrofit means detect+prompt not auto-mutate"
- id: "dec-37"
  text: "Empty legacy phases/ dir left by git mv is auto-removed post-moves in migration.cjs via rmdirSync (best-effort)"
  phase: "05"
  type: "design"
  rationale: null
- id: "dec-38"
  text: "Test contract format mirrors TEST-SPEC.md exactly (Action / Observables / Pass criteria) for SPEC-04 structural reuse"
  phase: "02"
  type: "design"
  rationale: null
- id: "dec-39"
  text: "Observability section uses three required subsections (Tracing, Boundary Logging, Failure Diagnosis) so checker can validate concretely instead of accepting \"TBD"
  phase: "02"
  type: "design"
  rationale: null
- id: "dec-40"
  text: "Each topology pattern except Chain has both upgrade and downgrade signals so the researcher can challenge complexity in either direction"
  phase: "02"
  type: "design"
  rationale: null
- id: "dec-41"
  text: "Pattern Selection Checklist orders questions simplest-first to bias toward simpler patterns"
  phase: "02"
  type: "design"
  rationale: null
- id: "dec-42"
  text: "existing_subsystems filter excludes both _gaps.md AND _proposed.md (not just _gaps.md as referenced in RESEARCH.md skeleton) because _proposed.md is an updater scratch file, not a subsystem"
  phase: "03"
  type: "design"
  rationale: null
- id: "dec-43"
  text: "new_todos uses git log --numstat to sum additions under .planning/todos/ — aligns with Pitfall 3 (scope inference false negative) mitigation"
  phase: "03"
  type: "design"
  rationale: null
- id: "dec-44"
  text: "completed_phases_since emits ALL [x] phases from ROADMAP (not filtered by git-blame date) — orchestrator compares against the last-run map to compute the delta"
  phase: "03"
  type: "design"
  rationale: null
- id: "dec-45"
  text: "Mapper tools: Read, Bash, Grep, Glob, Write (no Edit); Updater tools add Edit for surgical pass-2 edits"
  phase: "03"
  type: "design"
  rationale: null
- id: "dec-46"
  text: "Deferred Task 4 (manual harness dogfood) — GSD self-verification needs its own workflow design"
  phase: "04"
  type: "design"
  rationale: null
- id: "dec-47"
  text: "Per-plan verify_loop config emitted by init execute-phase (additive — no existing keys removed)"
  phase: "04"
  type: "design"
  rationale: null
- id: "dec-48"
  text: "verify_loop sub_flow spliced after execute_waves and before verify_phase_goal — preserves end-of-waves verifier"
  phase: "04"
  type: "design"
  rationale: null
- id: "dec-49"
  text: "Parallel-wave loops run sequentially to avoid debug-file races"
  phase: "04"
  type: "design"
  rationale: null

## requirements_validated[]

- id: "DRTR-01"
  phase: "01"
  evidence: ".planning/v1.4/phases/01-domain-router/01-VERIFICATION.md"
- id: "DRTR-02"
  phase: "01"
  evidence: ".planning/v1.4/phases/01-domain-router/01-VERIFICATION.md"
- id: "DRTR-03"
  phase: "01"
  evidence: ".planning/v1.4/phases/01-domain-router/01-VERIFICATION.md"
- id: "DRTR-04"
  phase: "01"
  evidence: ".planning/v1.4/phases/01-domain-router/01-VERIFICATION.md"
- id: "DRTR-05"
  phase: "01"
  evidence: ".planning/v1.4/phases/01-domain-router/01-VERIFICATION.md"
- id: "SPEC-01"
  phase: "02"
  evidence: ".planning/v1.4/phases/02-agent-spec/02-VERIFICATION.md"
- id: "SPEC-02"
  phase: "02"
  evidence: ".planning/v1.4/phases/02-agent-spec/02-VERIFICATION.md"
- id: "SPEC-03"
  phase: "02"
  evidence: ".planning/v1.4/phases/02-agent-spec/02-VERIFICATION.md"
- id: "SPEC-04"
  phase: "02"
  evidence: ".planning/v1.4/phases/02-agent-spec/02-VERIFICATION.md"
- id: "SPEC-05"
  phase: "02"
  evidence: ".planning/v1.4/phases/02-agent-spec/02-VERIFICATION.md"
- id: "SPEC-06"
  phase: "02"
  evidence: ".planning/v1.4/phases/02-agent-spec/02-VERIFICATION.md"
- id: "DOCS-01"
  phase: "03"
  evidence: null
- id: "DOCS-02"
  phase: "03"
  evidence: null
- id: "DOCS-03"
  phase: "03"
  evidence: null
- id: "DOCS-04"
  phase: "03"
  evidence: null
- id: "DOCS-05"
  phase: "03"
  evidence: null
- id: "DOCS-06"
  phase: "03"
  evidence: null

## open_blockers[]

- id: "blocker-1"
  text: "[Phase 04-03 discovery] parseMustHavesBlock in frontmatter.cjs uses 4-space-indent regex; real plans use 2-space; 'verify artifacts' and 'verify key-links' silently return 'no blocks found' for ALL current plans. Surfaced while implementing parseVerifyCommands. Out of 04-03 scope — fix in follow-up plan."
  phase: "04-03 discovery"
  severity: "low"
  carries_to: null

## entry_points[]

- file: "02-02-agent-workflow"
  symbol: null
  purpose: null
- file: "02-03-plan-phase-integration"
  symbol: null
  purpose: null
- file: "future agentic phases"
  symbol: null
  purpose: null
- file: "03-02 workflow"
  symbol: null
  purpose: null
- file: "03-03 milestone-hook"
  symbol: null
  purpose: null
- file: "/gsd2:document"
  symbol: null
  purpose: null
- file: "workflows/document.md (referenced but not created here — Plan 03 lands it)"
  symbol: null
  purpose: null
- file: "install.js (propagates commands/gsd2/*.md to runtimes — no code change needed)"
  symbol: null
  purpose: null
- file: "phase-05-and-beyond-dogfood"
  symbol: null
  purpose: null
- file: "future-execute-phase-runs"
  symbol: null
  purpose: null
- file: "harness-uX"
  symbol: null
  purpose: null

## public_api[]

- subcommand: "AGENT-SPEC.md template with 10 design dimensions, test contracts, and checker sign-off"
  phase: "02"
  introduced: "v1.4"
- subcommand: "AGENTIC-PATTERNS.md topology reference catalog with 6 patterns and selection guidance"
  phase: "02"
  introduced: "v1.4"
- subcommand: "init document compound command returning 17-key state JSON"
  phase: "03"
  introduced: "v1.4"
- subcommand: "gsd-document-mapper and gsd-document-updater model profile entries (sonnet/sonnet/haiku)"
  phase: "03"
  introduced: "v1.4"
- subcommand: "gsd-document-mapper persona (parallel, single-subsystem writer)"
  phase: "03"
  introduced: "v1.4"
- subcommand: "gsd-document-updater persona (two-pass incremental editor)"
  phase: "03"
  introduced: "v1.4"
- subcommand: "verify_after task attribute documented in phase-prompt.md"
  phase: "04"
  introduced: "v1.4"
- subcommand: "auto_verify plan-frontmatter flag documented (opt-out, default ON)"
  phase: "04"
  introduced: "v1.4"
- subcommand: "verify_loop config block exposed by init execute-phase JSON"
  phase: "04"
  introduced: "v1.4"
- subcommand: "verify_loop sub_flow spliced into execute-phase.md (verifier → investigator → fixer, ceiling=3)"
  phase: "04"
  introduced: "v1.4"
- subcommand: "parallel-wave serialization rule for concurrent loops"
  phase: "04"
  introduced: "v1.4"
- subcommand: "ceiling-reached CHECKPOINT REACHED handoff shape"
  phase: "04"
  introduced: "v1.4"

---

*Generated: 2026-05-13 by `gsd-tools milestone distill v1.4`*
