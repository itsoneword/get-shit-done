# Changelog — GSD2

Experimental fork of [get-shit-done](https://github.com/gsd-build/get-shit-done). Forked from v1.26.0.

## [1.4.2] - 2026-04-28

### Added
- **`/gsd2:quick` command restored** — slim ad-hoc executor for small tasks that don't fit a full phase. Plans, executes, and atomically commits into `.planning/quick/YYMMDD-xxx-slug/`. Tracks completion in STATE.md, never touches ROADMAP.md.
  - **Default suggest preview** — Claude shows a 4–8 line proposal (approach + files to touch) before planning, you confirm or redirect. One round-trip, no ceremony.
  - **`--clarify` flag** — Claude asks 2–3 targeted questions about real uncertainties (not all gray areas). Decisions captured in `${quick_id}-CONTEXT.md`. Replaces the old multi-domain `--discuss` flow.
  - **`--full` flag** — Adds plan-checker (max 2 revision loops) + post-execution verifier for higher-stakes ad-hoc work.
- **`git.quick_branch_template` config key** re-added to `KNOWN_CONFIG_KEYS` so users opting into auto-branching for quick tasks no longer see "unknown key" warnings.

### Changed
- **`/gsd2:do` router rewired** — split the "todo" rule into capture vs. execute paths and added a fallback for ad-hoc work:
  - *"Add a todo to refactor X"* / *"remember to update Y"* → `/gsd2:add-todo` (capture).
  - *"Do todo 3"* / *"work on the auth todo"* → `/gsd2:check-todos` (select + work).
  - Small ad-hoc work that doesn't fit a specific lifecycle command → `/gsd2:quick` (was previously dead-ending into `/gsd2:add-phase` or `/gsd2:add-todo`).
- **`/gsd2:help`** — new "Ad-hoc Tasks" section documenting `/gsd2:quick`; smart-router blurb mentions the new fallback.

### Removed (vs. pre-1.3.2 quick)
- **`--research` flag** — gone. Run `/gsd2:research-phase` first if you genuinely need ecosystem research before a quick task; the old in-line `--research` was rarely used and added complexity.
- **`--discuss` flag** — replaced by the lighter default suggest preview + the on-demand `--clarify` flag.

### Why
`/gsd2:do` was router-only, so freeform inputs like "do this small thing" dead-ended into either `/gsd2:add-phase` (overkill) or `/gsd2:add-todo` (which only captures). With `/gsd2:quick` restored as a real executor and `do` rewired to fall back to it, the freeform path now actually delivers work.

### Also fixed (test-suite drift accumulated in v1.3.5/v1.4.x)
- **Copilot installer namespace conversion** — `gsd:foo` → `gsd2-foo` rename for Copilot/Cursor/Codex/Antigravity/OpenCode runtimes (those CLIs use dashes, not colons). Test counts now derive from the source tree so adding new commands/agents doesn't break tests.
- **`gsd-agent-researcher` and `gsd-agent-checker` agents created** — `/gsd2:agent-spec-phase` workflow referenced these agents but their files were never shipped. Added concise role contracts that align with the embedded spawn prompts.
- **Anti-heredoc instruction** added to nine file-writing agents (gsd-document-mapper, gsd-document-updater, gsd-fixer, gsd-planner, gsd-research-synthesizer, gsd-test-designer, gsd-ui-auditor, gsd-ui-researcher, gsd-verifier). Test loosened to match the canonical phrasings actually used in the repo (`(not heredocs)`, `(never heredocs)`, etc.) instead of one literal sentence.
- **`# hooks:` frontmatter** added to four agents missing it (gsd-document-mapper, gsd-document-updater, gsd-test-designer, gsd-verifier) so post-write linter hooks can be opted in.
- **Path normalization** — `commands/gsd2/document.md` and `get-shit-done/workflows/document.md` had absolute `/Users/itsoneword/...` paths instead of canonical `~/.claude` / `$HOME/.claude`. Both rewritten to match the rest of the source tree.
- **Result:** test suite goes from 40 failures → 0 failures.

## [1.4.1] - 2026-04-18

Milestone **v1.4 — Domain-Aware Planning**. Three phases: domain router, AGENT-SPEC for agentic systems, and an on-demand documentation agent.

### Added

#### Phase 01 — Domain Router
- **Domain classification router in `/gsd2:discuss-phase`** — automatically classifies the phase (frontend, agentic, backend, infra, etc.) instead of asking yes/no per domain. Replaces the old "would you like a UI spec?" gate that fired even on non-UI work
- **Domain-aware artifact check in `/gsd2:plan-phase`** (step 5.6) — planner picks up domain-specific specs (UI-SPEC, AGENT-SPEC, …) without per-domain branches

#### Phase 02 — AGENT-SPEC Workflow
- **`AGENT-SPEC.md` template** — design contract for agentic systems covering communication contracts, security boundaries, observability, and test-driven scenarios
- **`AGENTIC-PATTERNS.md`** — topology reference (orchestrator/worker, router, evaluator/optimizer, etc.) consumed by the agent-spec workflow
- **`/gsd2:agent-spec-phase` command** — generates AGENT-SPEC.md before planning; triggered automatically by domain router for agentic phases
- **AGENT-SPEC discovery in init and plan-phase** — both pick up the spec when present

#### Phase 03 — Documentation Agent
- **`/gsd2:document` command** — generates or updates a layered, sourced SYSTEM-MAP in `docs/` from planning artifacts, code, and git history. Supports init (full map) and incremental update modes
- **`document-mapper` agent** — produces the SYSTEM-MAP from existing artifacts (no inline narration by executor agents)
- **`document-updater` agent** — incremental updates against prior map, diffing completed phases
- **`offer_documentation` hook** — fires before `archive_milestone` so docs stay in sync with shipped work
- **Replaced legacy `docs/*.md`** with auto-generated `docs/system/` tree

### Fixed
- **CLAUDE.md sidecar handling** — markdown-aware filter, hybrid shape, auto-sync on `/gsd2:map-codebase`

### Design Notes
- `existing_subsystems` filter excludes both `_gaps.md` and `_proposed.md` (updater scratch files)
- `completed_phases_since` returns all `[x]` phases (not date-filtered) — orchestrator diffs against prior map
- document-mapper/updater profile = sonnet/sonnet/haiku (higher balanced than codebase-mapper since narrative writing needs more reasoning)

## [1.3.5] - 2026-04-06

### Added
- **`/gsd2:test-phase` command** — generates verification contract (TEST-SPEC.md) before planning. Solves the "no objective signal that the phase actually works" problem by locking what observable behaviors prove a phase is done, before any code is written
- **`gsd-test-designer` agent** — behavior-tracing verifier that infers scenarios from REQUIREMENTS/CONTEXT/RESEARCH (no technical interrogation of user), runs internal coverage loop with 7 rules (requirement coverage, endpoint coverage, failure paths, side effects, independence, observability, scope), translates technical scenarios into plain-language digest for user approval
- **`TEST-SPEC.md` template** — dual-layer artifact with user-facing summary (plain language) and technical scenarios (preconditions, action, observables, pass criteria) plus a Coverage Map mapping each requirement ID to scenarios
- **`workflow.test_phase` config toggle** — enable/disable verification contract generation (defaults to `true`)

### Changed
- **`gsd-planner`** — now reads TEST-SPEC.md in `gather_phase_context`. Scenario observables become candidate `<verify>` commands for tasks. Every scenario must be satisfied by at least one task in resulting plans. Also picks up UI-SPEC.md (was previously missing from planner context)
- **`/gsd2:verify-work`** — TEST-SPEC.md now takes priority over SUMMARY.md as the test source. When present, scenarios are run as the verification step instead of conversational UAT extraction. Falls back to existing SUMMARY-based behavior when TEST-SPEC.md absent

### Design Notes
- Bright-line rule baked into agent prompt: every observable must be scriptable (one-line bash/curl/grep/SQL returning true/false). No "works correctly" or "user is logged in" — always concrete checks (HTTP status + body shape, DB row, file exists, exit code)
- Self-approving in v1 — no separate checker agent. Internal coverage loop capped at 3 iterations + 2 user revision rounds. May split into designer + checker if scenario quality drifts
- Auto-detects non-testable phase types (docs, research, pure design) and writes `status: not_applicable` stub instead of forcing fake scenarios
- Single-agent architecture trade-off documented: same agent writes scenarios for code that another agent will write — separation of concerns is partial. If verification rigor matters more than token cost, future v2 should split test-writer from implementation-writer

## [1.3.3] - 2026-04-01

### Fixed
- **Runtime-aware model resolution** — non-Claude runtimes (Codex, Gemini, Copilot, Cursor, Antigravity) now auto-detect and force `inherit` for all agents, preventing meaningless Claude model aliases from being passed to foreign runtimes

## [1.3.2] - 2026-03-29

### Changed
- **`/gsd2:progress` command** — now always displays a full phase table with status icons and descriptions

### Added
- **`/gsd2:fix` command** — post-execution issue fixing with dependency awareness. After executing a phase, list what's wrong and the fixer classifies each issue (current-phase / regression / not-yet-built), maps dependencies before changing code, and fixes without cascading breakage
- **`gsd-fixer` agent** — example-driven agent design based on research best practices. Four concrete naive-vs-smart examples guide behavior instead of prescriptive rules

### Removed
- **`/gsd2:fast` command** — trivial inline task execution (no longer needed; just ask directly)
- **`/gsd2:quick` command** — ad-hoc task execution with planning (replaced by phase workflow + `/gsd2:fix`)
- **`quick_branch_template` config** — removed with quick command
- Quick task tests (`quick-branching.test.cjs`, `quick-research.test.cjs`)

### Changed
- **Workflow guard hook** — now suggests `/gsd2:fix` instead of fast/quick
- **`/gsd2:do` router** — routes fix/broken/issue inputs to `/gsd2:fix`
- **Help reference** — replaced Quick Mode section with Fixing Issues section
- **CLAUDE.md template** — references `/gsd2:fix` instead of `/gsd2:quick`
- Updated all docs (COMMANDS, AGENTS, ARCHITECTURE, FEATURES, USER-GUIDE, CLI-TOOLS, CONFIGURATION)

## [1.2.1] - 2026-03-21

### Fixed
- **Update checker false positive in dev mode** — skip npm version check when running from GSD source repo
- **Stale hooks false positive** — added missing version header to workflow-guard hook
- **Build version stamping** — `build-hooks.js` now replaces `{{GSD_VERSION}}` placeholder in dist hooks

## [1.0.0] - 2026-03-20

### Changed
- **Conversation-first discuss-phase** — replaced rigid menu-driven interview (3-4 gray areas × 4 AskUserQuestion) with genuine back-and-forth conversation following questioning.md philosophy
- **Codebase-driven questions** — scout_codebase now classifies ESTABLISHED vs NEW patterns; only NEW areas get discussed
- **Adaptive depth** — no fixed question count; complex phases get deep discussion, simple phases get quick confirmation

### Added
- **Signal strength** — every decision in CONTEXT.md carries `[STRONG]`, `[WEAK]`, or `[DISCRETION]` based on user's emphasis and engagement
- **`<established>` section** in CONTEXT.md — tells planner what's already decided by existing codebase
- **Cross-phase note pollination** — insights from one phase discussion automatically saved for related phases via `.planning/cross-phase-notes.md`
- **Discussion focus hints** — roadmapper generates `**Discussion focus**:` per phase in ROADMAP.md to guide conversation priorities
- **Architecture visualizations** — `gsd-architecture.html` (pipeline analysis) and `gsd-orchestration.html` (agent spawning map)

### Removed
- Pre-generated gray area categories
- Fixed 4-question-per-area structure
- Generic AskUserQuestion as primary interaction mode
