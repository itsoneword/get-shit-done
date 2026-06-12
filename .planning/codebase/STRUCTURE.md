# Codebase Structure
**Analysis Date:** 2026-06-12

## Directory Layout

```
get-shit-done/                        # Repository root
├── bin/
│   └── install.js                    # npm binary entry point — installs GSD into AI runtimes
├── agents/                           # Agent persona definitions (*.md, 25 agents)
│   ├── gsd-executor.md
│   ├── gsd-planner.md
│   ├── gsd-phase-researcher.md
│   ├── gsd-verifier.md
│   ├── gsd-plan-checker.md
│   ├── gsd-debugger.md
│   ├── gsd-fixer.md
│   ├── gsd-codebase-mapper.md
│   ├── gsd-nyquist-auditor.md
│   ├── gsd-integration-checker.md
│   ├── gsd-roadmapper.md
│   ├── gsd-research-synthesizer.md
│   ├── gsd-project-researcher.md
│   ├── gsd-agent-researcher.md
│   ├── gsd-document-mapper.md
│   ├── gsd-document-updater.md
│   ├── gsd-test-designer.md
│   ├── gsd-agent-checker.md
│   ├── gsd-lens-skeptic.md             # Phase 14+: Multi-lens judgment
│   ├── gsd-lens-user-advocate.md       # Phase 14+: Multi-lens judgment
│   ├── gsd-lens-architect.md           # Phase 14+: Multi-lens judgment
│   ├── gsd-ui-researcher.md
│   ├── gsd-ui-checker.md
│   ├── gsd-ui-auditor.md
│   └── gsd-user-profiler.md
├── commands/
│   └── gsd2/                         # Claude slash-command stubs (60+ commands)
│       ├── plan-phase.md
│       ├── execute-phase.md
│       ├── discuss-phase.md
│       ├── discuss-loop.md             # Phase 14+
│       ├── new-project.md
│       ├── verify-work.md
│       ├── overnight.md                # Phase 13+: Autonomous runner
│       ├── inbox.md                    # Phase 10+: Morning review
│       └── ...
├── get-shit-done/                    # Runtime assets — installed to ~/.claude/get-shit-done/
│   ├── bin/
│   │   ├── gsd-tools.cjs             # CLI router — the tool entrypoint called by all workflows
│   │   └── lib/                      # Domain logic modules (25 modules)
│   │       ├── core.cjs              # Shared utilities, config, git, phase lookup, markdown normalization
│   │       ├── state.cjs             # STATE.md read/write and progression
│   │       ├── phase.cjs             # Phase CRUD and lifecycle
│   │       ├── roadmap.cjs           # ROADMAP.md parse and update
│   │       ├── milestone.cjs         # Milestone completion and archival
│   │       ├── commands.cjs          # Utility commands (slug, timestamp, todos, progress)
│   │       ├── config.cjs            # config.json CRUD
│   │       ├── template.cjs          # Template selection and fill
│   │       ├── verify.cjs            # Verification suite
│   │       ├── init.cjs              # Compound init commands (workflow bootstrap)
│   │       ├── frontmatter.cjs       # YAML frontmatter parse/serialize/CRUD
│   │       ├── model-profiles.cjs    # Agent-to-model mapping
│   │       ├── profile-pipeline.cjs  # Session scanning for user profiling
│   │       ├── profile-output.cjs    # User profile structured output
│   │       ├── uat.cjs               # UAT/VERIFICATION.md cross-phase scanner
│   │       ├── ledger.cjs            # Phase 10+: Append-only decision ledger
│   │       ├── mailbox.cjs           # Phase 10+: Escalated question mailbox
│   │       ├── park.cjs              # Phase 12+: Phase snapshots and stuck detection
│   │       ├── discuss-loop.cjs      # Phase 14+: Multi-lens loop primitives
│   │       ├── worktree.cjs          # Phase 13+: Worktree lifecycle
│   │       ├── parallel-gate.cjs     # Phase 13+: Concurrency safety
│   │       ├── trace.cjs             # Tracing utilities
│   │       ├── lesson.cjs            # Lesson recording (deprecated, for compatibility)
│   │       ├── migration.cjs         # Migration utilities
│   │       └── install-transform.cjs # Path token replacement helper
│   ├── workflows/                    # Workflow orchestration instructions (55+ files)
│   │   ├── execute-phase.md
│   │   ├── plan-phase.md
│   │   ├── discuss-phase.md
│   │   ├── discuss-loop.md             # Phase 14+: Multi-lens judgment loop
│   │   ├── new-project.md
│   │   ├── verify-work.md
│   │   ├── overnight.md                # Phase 13+: Unattended runner with harness
│   │   ├── autonomous.md               # Phase 13+: Per-phase autonomous loop
│   │   ├── inbox.md                    # Phase 10+: Morning review and question answer
│   │   └── ...
│   ├── references/                   # Behavioral reference documents loaded by agents
│   │   ├── model-profiles.md
│   │   ├── ui-brand.md
│   │   ├── continuation-format.md
│   │   ├── verification-patterns.md
│   │   ├── questioning.md
│   │   ├── escalation-contract.md     # Phase 11+: Autonomous decision gating
│   │   └── ...
│   └── templates/                    # Document templates for project artifacts
│       ├── state.md
│       ├── project.md
│       ├── roadmap.md
│       ├── phase-prompt.md
│       ├── UAT.md
│       ├── VALIDATION.md
│       ├── summary-standard.md
│       ├── summary-minimal.md
│       ├── summary-complex.md
│       ├── claude-md.md
│       └── ...
├── hooks/                            # Claude Code lifecycle hooks (Node.js)
│   ├── gsd-context-monitor.js        # PostToolUse: context warning injector
│   ├── gsd-statusline.js             # PostToolUse: context metrics writer
│   ├── gsd-workflow-guard.js         # PreToolUse: out-of-workflow edit advisor
│   ├── gsd-check-update.js           # Version update checker
│   └── dist/                         # Built hooks (deployed to users via npm files)
├── tests/                            # Test suite (*.cjs files)
│   ├── antigravity-install.test.cjs
│   ├── claude-md.test.cjs
│   ├── codex-config.test.cjs
│   ├── copilot-install.test.cjs
│   ├── cursor-conversion.test.cjs
│   ├── discuss-loop.test.cjs          # Phase 14+: Discuss-loop contract tests
│   ├── quick-branching.test.cjs
│   └── quick-research.test.cjs
├── scripts/
│   ├── build-hooks.js                # Validates hook syntax and copies to hooks/dist/
│   └── run-tests.cjs                 # Test runner script
├── docs/                             # User-facing documentation
├── assets/                           # Static assets
├── package.json                      # npm package config, scripts, engines
└── .planning/                        # GSD's own project state (uses itself)
    ├── codebase/                     # Codebase analysis documents
    ├── config.json
    ├── STATE.md
    ├── discuss-loop/                 # Phase 14+: Discussion loop runtime artifacts
    │   └── loop-<id>/                # One directory per loop execution
    │       └── TRANSCRIPT.jsonl       # Position blocks and deltas per round
    ├── run/                          # Phase 10+: Harness run directories (gitignored)
    │   └── run-<id>/
    │       ├── DECISIONS.jsonl       # Append-only ledger of decisions
    │       ├── MAILBOX.jsonl         # Parked questions and answers
    │       ├── RUN-META.json         # Run metadata and phase tracking
    │       ├── run.log               # Timestamped event stream
    │       └── parked/               # Phase 12+: Phase snapshot hashes
    │           ├── phase-1.json
    │           ├── phase-2.json
    │           └── ...
    └── ...
```

---

## Key File Locations

**Entry points:**

- `bin/install.js` — npm binary, user runs `npx gsd2` or `npx gsd2 --claude --global`
- `get-shit-done/bin/gsd-tools.cjs` — tool CLI, called by every workflow via bash: `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" <command>`
- `commands/gsd2/<name>.md` — user-facing slash commands, e.g. `/gsd2:plan-phase 3`, `/gsd2:overnight`, `/gsd2:discuss-loop`

**Core logic:**

- `get-shit-done/bin/lib/core.cjs` — the shared foundation; all other lib modules import from here
- `get-shit-done/bin/lib/init.cjs` — compound init commands that bundle all workflow context into a single JSON response (primary way orchestrators load state)
- `get-shit-done/bin/lib/state.cjs` — STATE.md is read first in every workflow; this module owns all STATE.md operations
- `get-shit-done/bin/lib/ledger.cjs` — Run context ledger operations; `run init`, `ledger append`, `ledger list`, `run record-phase`, `run status`, `run report` (Phase 10+)
- `get-shit-done/bin/lib/mailbox.cjs` — Run context question mailbox; `mailbox append`, `mailbox list`, `mailbox answer` (Phase 10+)
- `get-shit-done/bin/lib/discuss-loop.cjs` — Loop primitives; `discuss-loop loop-id`, `discuss-loop validate`, `discuss-loop delta`, `discuss-loop survivors`, `discuss-loop transcript` (Phase 14+)

**Configuration:**

- `package.json` — npm package metadata, build scripts, test commands, engines (Node >=20)
- `.planning/config.json` (per user project, not in this repo) — project-level GSD config loaded by `loadConfig(cwd)` in `core.cjs`

**Installed location (on user machines):**

- `~/.claude/get-shit-done/bin/gsd-tools.cjs` — tool CLI (global install)
- `~/.claude/agents/gsd-*.md` — agent definitions
- `~/.claude/commands/gsd2/*.md` — slash commands
- `~/.claude/get-shit-done/workflows/*.md` — workflow orchestration
- `~/.claude/get-shit-done/templates/*.md` — document templates

**Phase 10+ run artifacts (per user project, `.planning/run/<run-id>/` gitignored):**

- `DECISIONS.jsonl` — Ledger of autonomously resolved decisions; each line is a JSON record with `{id: "dec-NNN", decision, alternatives, evidence, confidence, escalated, escalation_verdict, escalation_reason, phase, context}` (append-only, write-once per decision)
- `MAILBOX.jsonl` — Escalated questions and answers; each line is a JSON record with `{id: "q-NNN", question, phase, evidence, status, answer}` (append-only for questions, in-place answer updates)
- `RUN-META.json` — Run metadata including phase boundary snapshots, git HEAD hashes, completion status
- `run.log` — Timestamped event stream for parsing; lines match format: `YYYY-MM-DDTHH:MM:SSZ <EVENT> key1=val1 key2=val2`

**Phase 14+ discuss-loop artifacts (per user project, `.planning/discuss-loop/<loop-id>/`):**

- `TRANSCRIPT.jsonl` — One JSON record per round (up to 3 rounds × 3 lenses); each record contains all position blocks for that round plus `delta` array of new/modified constraints

---

## Naming Conventions

**Files:**

- Library modules: `kebab-case.cjs` — e.g., `model-profiles.cjs`, `profile-pipeline.cjs`, `discuss-loop.cjs`
- Agent definitions: `gsd-<role>.md` — e.g., `gsd-executor.md`, `gsd-plan-checker.md`, `gsd-lens-skeptic.md`
- Command stubs: `kebab-case.md` matching the workflow name — e.g., `execute-phase.md`, `discuss-loop.md`
- Workflow files: `kebab-case.md` matching the command — e.g., `execute-phase.md`, `overnight.md`
- Test files: `kebab-case.test.cjs` — e.g., `claude-md.test.cjs`, `discuss-loop.test.cjs`
- Hook scripts: `gsd-<purpose>.js` — e.g., `gsd-context-monitor.js`

**Functions (in lib/*.cjs):**

- Command handlers (exported, called from gsd-tools router): `cmd` prefix + PascalCase — e.g., `cmdPhasesList`, `cmdStateLoad`, `cmdLedgerAppend`, `cmdDiscussLoopValidate`
- Internal helpers not exported: plain `camelCase` — e.g., `loadConfig`, `findPhaseInternal`, `normalizeMd`, `validatePositionBlock`
- Exported via `module.exports = { ... }` at bottom of each file

**Planning artifacts (per user project):**

- Phase directories: `NN-slug/` where NN is zero-padded phase number — e.g., `01-authentication`, `12A-ui-polish`
- Plan files: `N-PLAN.md` — e.g., `1-PLAN.md`, `2-PLAN.md`
- Summary files: `N-SUMMARY.md` — e.g., `1-SUMMARY.md`
- Context files: `N-CONTEXT.md` (from discuss-phase)
- Research files: `N-RESEARCH.md`
- UAT files: `N-UAT.md`
- Verification files: `N-VERIFICATION.md`
- Archived milestones: `.planning/milestones/vX.Y-phases/`
- Run directories (Phase 10+): `.planning/run/<run-id>/` where `<run-id>` follows pattern `<workflow>-YYYYMMDD-HHMMSS` or user override
- Discuss-loop directories (Phase 14+): `.planning/discuss-loop/<loop-id>/` where `<loop-id>` is generated by `discuss-loop loop-id` command

---

## Where to Add New Code

**New gsd-tools command:**
Add the command function to the appropriate lib module in `get-shit-done/bin/lib/`. Register the command in the `switch` block in `get-shit-done/bin/gsd-tools.cjs`. Export the function from the lib module's `module.exports`. Follow the `output(result, raw, rawValue)` pattern for responses and `error(message)` for errors.

**New agent:**
Create `agents/gsd-<role>.md` with YAML frontmatter (`name`, `description`, `tools`, `color`) and behavioral instructions. Add the agent to the `CODEX_AGENT_SANDBOX` map in `bin/install.js` with an appropriate sandbox level. Add the agent to `model-profiles.cjs` with quality/balanced/budget model assignments. Update install logic in `bin/install.js` to copy the new agent.

**New command:**
Create `commands/gsd2/<name>.md` with frontmatter declaring `name`, `description`, `argument-hint`, `allowed-tools`. Body should load the workflow via `@~/.claude/get-shit-done/workflows/<name>.md`. Create the corresponding `get-shit-done/workflows/<name>.md` with the orchestration steps.

**New workflow:**
Create `get-shit-done/workflows/<name>.md`. Follow the pattern: `<purpose>` block → `<required_reading>` block → `<available_agent_types>` block → `<process>` block with numbered steps. Use `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init <workflow>` as the first step to load all context.

**New hook:**
Add to `hooks/` as `gsd-<purpose>.js`. Read from stdin (JSON), process, output to stdout as `additionalContext` (advisory) or exit 0 to pass through. Add to `HOOKS_TO_COPY` array in `scripts/build-hooks.js`. Install logic in `bin/install.js` must register the hook in the appropriate runtime hook config.

**New lib module:**
Create `get-shit-done/bin/lib/<name>.cjs`. Import from `core.cjs` for shared utilities. Export all public functions via `module.exports`. Import and register in `get-shit-done/bin/gsd-tools.cjs` alongside other `require` statements.

**Tests for new installer behavior:**
Add `tests/<feature>.test.cjs`. Follow the pattern in `tests/claude-md.test.cjs`. Run via `npm test` (uses `scripts/run-tests.cjs`).

**New run-context feature (Phase 10+ harness):**
If adding ledger/mailbox/park operations: add commands to appropriate lib module (`ledger.cjs`, `mailbox.cjs`, `park.cjs`), register in gsd-tools router, gate writes behind `GSD_RUN_ID` check. Never directly write `.planning/run/<run-id>/` directories outside the gsd-tools CLI — enforce single access path. All JSONL writes must be append-only (appendFileSync, no rewrites except for terminal-state mutations like answer updates).

**New discuss-loop operation (Phase 14+):**
Add to `lib/discuss-loop.cjs` as pure functions (no I/O), cmd* handlers for process I/O. All validation is deterministic membership checking (CONSTRAINT_ID_RE, VALID_LENSES, etc.) — no heuristics. Every constraint must include a verbatim `anchor` field (string from artifact). Position blocks validated with `validatePositionBlock(block, {round, priorIds, artifactContent})` before acceptance.
