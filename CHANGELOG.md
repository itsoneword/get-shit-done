# Changelog — GSD2

Experimental fork of [get-shit-done](https://github.com/gsd-build/get-shit-done). Forked from v1.26.0.

## [1.6.2] - 2026-07-03

Token-cut cleanup: dedupe executor prompt blocks, shared project-context reference for 7 agents, ui-brand trimmed to cheat sheet, removed dead template.cjs CLI verb and orphaned phase-prompt.md template

## [1.6.1] - 2026-06-22

fix: phase add no longer creates stray milestone dirs from stale STATE.md frontmatter feat: gsd2:health detects & repairs stale STATE.md milestone (W010)

## [1.6.0] - 2026-06-18

Autonomous Supervision Harness milestone (phases 10-15): append-only decision ledger + mailbox CLI, written escalation contract with discuss-phase evaluator, park-don't-block mailbox with staleness-checked resume, overnight runner (/gsd2:overnight) with worktree isolation + morning report, multi-lens discussion loop (/gsd2:discuss-loop), and backlog triage worker (/gsd2:triage) emitting propose-only six-verdict proposals to the morning inbox.

## [1.5.2] - 2026-06-11

- Fix stale MODEL_ALIAS_MAP: retired claude-haiku-3-5 and deprecated claude-opus-4-0 replaced with current aliases; fable added
- Document `fable` as a `model_overrides` value with cost guidance (verbatim pass-through to the Task call)
- Fix model-profile-resolution doc drift: `gsd-tools resolve-model` is canonical; opus-tier never resolved to inherit

## [1.5.1] - 2026-06-08

Patch: fix stale-hooks false warning. Installs/updates now delete the v1.5-renamed legacy gsd-*.js hook files from disk (previously only their settings.json registrations were cleaned), and the update checker's stale-hook scan targets the current gsd2-* hooks instead of the orphaned legacy gsd-* set.

## [1.5.0] - 2026-06-08

Milestone **v1.5** complete — all 9 phases executed. Theme: GSD becomes more autonomous, self-sufficient, observable, and self-improving. (Supersedes the 1.4.7 dev checkpoint; consolidates phases 1–9.)

### Added

- **Security guard hooks** (Phase 1) — 3 standalone advisory guard hooks ported under `gsd2-*` naming, config-gated, no build dependency.
- **Autonomous technical-resolution loop** (Phase 2) — research→self-critique confidence loop wired into discuss/plan so technical/domain unknowns resolve without bouncing to the human; resolved decisions written back to CONTEXT.md with confidence + source tags.
- **Anti-pattern / bug-pattern references** (Phase 3) — universal-anti-patterns and common-bug-patterns docs (incl. Python), hybrid-loaded into planner/verifier.
- **Agent observability & telemetry** (Phase 4) — `PostToolUse(Task|Agent)` hook logs every gsd-* subagent spawn + scraped confidence verdict to `.planning/telemetry/agent-trace.jsonl`, with a `gsd-tools trace` reader. Zero prompt-file changes.
- **Skill self-sufficiency** (Phase 6) — audited all 14 superpowers skills vs GSD coverage; ported the genuine gaps as native artifacts: TDD execution discipline (Iron Law + watch-it-fail), receiving-code-review rigor, artifact-authoring guidance, and a git-worktree technique reference — dropping the external plugin dependency.
- **Parallel multi-session safety** (Phase 7) — worktree-isolated execution + merge so concurrent sessions / quick-fixes stop silently overwriting each other (axis A); a parallel-safety gate combining `depends_on` (axis B) + file-scope disjointness that hard-refuses parallel discussion of dependent phases and warns on file overlap; `depends_on`/`related_to` on todo frontmatter; a source↔runtime symmetry-check folded into `/gsd2:health` (`diff -rq` + settings.json hook/statusLine parity) and run post-merge.
- **Validated Example Corpus** (Phase 8) — curated corpus of validated handwritten code examples, indexed by pattern with per-example commentary, replacing plausible-but-untested LLM-generated examples; serves as the reference substrate for Phase 9.
- **Self-improving skills** (Phase 9) — `/gsd2:teach` captures a lesson from a real failure, attributes the culprit prose artifact via Phase 4 telemetry, proposes a *bounded* edit gated on human ratification, and commits to source; lessons persist in a `.planning/lessons/` ledger.

### Changed

- **Plan-loop convergence** (Phase 5) — stall-detection in the plan revision loop (STALL DETECTED vs Max-iterations branches) plus a `parseMustHavesBlock` 2-space-indent fix.
- **Backlog ID scheme** (Phase 7) — migrated `999.x` → B-prefixed IDs (`B1, B2…`) outside the phase-number space, allocated by `phase next-backlog-id`; items receive a real phase number only on promotion into a milestone.

### Notes

- Outstanding human-run UAT remains for phases 02, 06, and 09 (live-behavior checks; not code gaps). Milestone archival via `/gsd2:complete-milestone` is a separate follow-up.

## [1.4.7] - 2026-06-06

Development checkpoint for in-progress milestone v1.5. Bumps version to keep `package.json`, hook `dist` headers, and runtime `VERSION` in lockstep (previously desynced at 1.4.6). Captures v1.5 work landed so far: standalone security guard hooks, the autonomous technical-resolution loop wired into discuss/plan, anti-pattern/bug-pattern reference docs, and the agent-observability telemetry hook + `gsd-tools trace` reader.

## [1.4.6] - 2026-05-13

Phase 05 of milestone v1.4 — milestone-versioned phase IDs, partition-aware layout, migration tool, and distillation artifacts. No breaking changes for projects on the legacy layout (auto-detect + one-time migration prompt).

### Added

- **Milestone-partitioned `.planning/` layout** — phases now live under `.planning/{milestone}/phases/` (e.g. `.planning/v1.4/phases/01-…/`). Root files (PROJECT/ROADMAP/STATE/cross-phase-notes/todos/quick) stay at `.planning/` root. Each milestone is a self-contained phase tree that resets numbering to 01, 02, 03…
- **`gsd-tools migrate-to-milestone-partition` subcommand** — one-time migration of a legacy `.planning/phases/` layout:
  - Prints a dry-run manifest of every `git mv` + reference rewrite before touching anything
  - Prompts `[y/N]` (or `--yes` flag) before mutating; `--dry-run` exits after the preview
  - Pre-flight checks clean working tree (scoped to `.planning/`) so no in-progress WIP is lost
  - Rewrites full-path refs in STATE.md, PROJECT.md, ROADMAP.md, cross-phase-notes.md and bare-path refs inside `todos/**/*.md` and `quick/**/*.md`
- **`migration_hint` auto-detect** — every `gsd-tools init` call checks for the legacy layout and surfaces a one-line hint when detected; no auto-mutation (explicit migration command required)
- **`init` JSON contract additions** — `milestone_root`, `partition_root`, `legacy_layout_detected`, `prior_milestones[]` emitted alongside existing fields (purely additive; no existing keys changed)
- **`/gsd2:complete-milestone` distillation artifact** — produces `.planning/{milestone}/SUMMARY.md` with machine-parseable typed-tag sections: `decisions[]` (phase-linked, typed), `requirements_validated[]`, `open_blockers[]`, `entry_points[]` (file:symbol), `public_api[]`

### Changed

- **`phasesDir(cwd)` / `planningPaths().phases`** — now partition-aware: resolves to `{milestone_root}/phases/` when the active milestone's partition exists; falls back to legacy root phases dir when partition absent (safe for migration-in-progress states)
- **`/gsd2:progress` context loading** — loads active milestone phases + root docs + prior closed milestone SUMMARY files, not the entire phase tree regardless of milestone count

### Fixed

- **Empty legacy `phases/` dir cleanup** — after `git mv` completes, `migration.cjs` calls `rmdirSync` (best-effort) on the now-empty legacy dir so it doesn't linger in the repo

### Design Notes

- `STATE.md` `milestone:` frontmatter is the single source of truth for active milestone; a missing/corrupt value causes a clear refusal-and-prompt error, not a path-guess fallback
- Decimal-phase resolution (`2.1`, `1.1`) and existing workflow placeholders (`{padded_phase}`, `{phase_dir}`, `{phase_number}`) continue to resolve correctly inside the partitioned tree
- Migration pre-flight scoped to `.planning/` only — users may have unrelated WIP in `src/`

## [1.4.5] - 2026-05-07

Phase 04 of milestone v1.4 — verifier-loop harness and `/gsd2:progress` token savings. Patch release; no breaking changes. Some items are wired but not yet dogfooded — see "Deferred" below.

### Added

- **Verifier-loop primitives** — three role-modes for the new auto-verify loop:
  - `gsd-verifier` and `gsd-fixer` adapted with a "loop" invocation mode while preserving their standalone paths. Each verifier→fixer cycle uses fresh contexts and commits with a `verify-loop/fix:` prefix.
  - `gsd-debugger` `find_root_cause_only` mode confirmed sufficient for the investigator role (no source change needed).
- **`must_haves.verify:` schema** — plans can now declare per-truth assertion commands with `cmd:` / `expect:` / `type:` fields. `expect` supports `/regex/` mode (regex test) or bare-string mode (trim + equality). Static `artifacts.contains` checks still apply alongside.
- **`gsd-tools verify commands {plan}` subcommand** — runs the verify block of a PLAN.md and returns structured pass/fail JSON.
- **`verify_after` task attribute and `auto_verify` plan flag** — when a task completes, if marked `verify_after: true`, the orchestrator fires the verify loop (verifier → investigator → fixer) with a 3-iteration ceiling. Ceiling-reached returns a structured CHECKPOINT to the user.
- **`<sub_flow name="verify_loop">` block in `execute-phase.md`** — splices the loop after the task spot-check and before failure handling. Documents fresh-context invariant per role and parallel-wave serialization rule.
- **`verify_loop` config in `init execute-phase` JSON** — surfaces `default_enabled`, `max_iterations`, `debug_dir`, and per-plan `verify_after_tasks` parsed from PLAN frontmatter.
- **Dependency graph artifact** for `.claude/get-shit-done/` — JSON + markdown maps of every caller/callee (22 agents, 51 workflows, 87 tool subcommands). Used by Plan 04-03 to confirm in-place adapter changes did not break standalone callers.

### Changed

- **`/gsd2:progress` token cost cut by ~13k per invocation:**
  - `init progress` and `roadmap analyze` accept `--scoped` flag returning current ±1 / next ±1 phase slice.
  - `generateSlugInternal` caps new phase slugs at 45 chars with no trailing hyphen.
  - Removed duplicate `@-include` of `workflows/progress.md` from the `/gsd2:progress` command file (was being injected twice — once via the @-include, once via the Read tool).

### Fixed

- **`get-shit-done/workflows/execute-phase.md` path placeholders restored** — the verify-loop splice in 04-04 accidentally copied resolved absolute paths (`/Users/.../...`) from the runtime mirror back into the source tree (21 occurrences). Restored to `~/.claude/...` and `$HOME/.claude/...` placeholders so install-time path replacement substitutes per-user. Caught by `tests/path-replacement.test.cjs` in the regression gate.

### Deferred (tracked, not in this release)

- **Verifier-loop end-to-end dogfood** (TC-LOOP-PASS / TC-LOOP-CEILING / TC-LOOP-RECOVER). Harness is wired and statically verified; live-fire scenarios on a synthetic plan are intentionally deferred. Tracked in `.planning/phases/04-verification-harness-and-context-efficiency/04-HUMAN-UAT.md` (status: `deferred`). Will dogfood organically when a future phase authors a `verify_after: true` task. Reason: GSD's self-verification UX is itself an unsolved workflow problem — warrants a dedicated future phase that designs reusable harness fixtures rather than one-off manual runs.
- **`workflows/document.md` does not pass `*-AGENT-SPEC.md` files to `gsd-document-mapper`** despite the persona's input contract declaring them as input (DOCS-04 partial wiring from milestone v1.4 audit). Fixable in <1 hour by extending `discover_subsystems` glob; postponed to v1.5.
- **`verify.cjs` parser does not unescape YAML escape sequences** (`\"`, `\n`). Plans using `node -e "..."` cmds with embedded quotes cannot be expressed. Workaround: use string-equality `expect` (matcher trims) and avoid embedded-quote cmds.
- **`verify.cjs` matcher regex mode does not trim trailing newlines** before `rx.test(actual)`. `^...$` regexes never match `cmd | jq ...` output. Workaround: use string-equality mode (which trims).

### Process notes (visible in commits / planning artifacts)

- Caught a recurring failure mode where the executor mirror-edits both the gitignored `.claude/` runtime tree and the tracked `get-shit-done/` source tree, allowing resolved absolute paths to leak from runtime back into source. Future executors should edit source first with placeholders and run `npm run dev` to refresh runtime — never copy runtime → source.

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
