# Codebase Structure
**Analysis Date:** 2026-03-21

## Directory Layout

```
get-shit-done/                        # Repository root
├── bin/
│   └── install.js                    # npm binary entry point — installs GSD into AI runtimes
├── agents/                           # Agent persona definitions (*.md, 16 agents)
│   ├── gsd-executor.md
│   ├── gsd-planner.md
│   ├── gsd-phase-researcher.md
│   ├── gsd-verifier.md
│   ├── gsd-plan-checker.md
│   ├── gsd-debugger.md
│   ├── gsd-codebase-mapper.md
│   ├── gsd-nyquist-auditor.md
│   ├── gsd-integration-checker.md
│   ├── gsd-roadmapper.md
│   ├── gsd-research-synthesizer.md
│   ├── gsd-project-researcher.md
│   ├── gsd-ui-researcher.md
│   ├── gsd-ui-checker.md
│   ├── gsd-ui-auditor.md
│   └── gsd-user-profiler.md
├── commands/
│   └── gsd2/                         # Claude slash-command stubs (50 commands)
│       ├── plan-phase.md
│       ├── execute-phase.md
│       ├── discuss-phase.md
│       ├── new-project.md
│       ├── verify-work.md
│       └── ...
├── get-shit-done/                    # Runtime assets — installed to ~/.claude/get-shit-done/
│   ├── bin/
│   │   ├── gsd-tools.cjs             # CLI router — the tool entrypoint called by all workflows
│   │   └── lib/                      # Domain logic modules
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
│   │       └── uat.cjs               # UAT/VERIFICATION.md cross-phase scanner
│   ├── workflows/                    # Workflow orchestration instructions (49 files)
│   │   ├── execute-phase.md
│   │   ├── plan-phase.md
│   │   ├── new-project.md
│   │   ├── discuss-phase.md
│   │   ├── verify-work.md
│   │   └── ...
│   ├── references/                   # Behavioral reference documents loaded by agents
│   │   ├── model-profiles.md
│   │   ├── ui-brand.md
│   │   ├── continuation-format.md
│   │   ├── verification-patterns.md
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
    └── ...
```

---

## Key File Locations

**Entry points:**

- `bin/install.js` — npm binary, user runs `npx gsd2` or `npx gsd2 --claude --global`
- `get-shit-done/bin/gsd-tools.cjs` — tool CLI, called by every workflow via bash: `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" <command>`
- `commands/gsd2/<name>.md` — user-facing slash commands, e.g. `/gsd2:plan-phase 3`

**Core logic:**

- `get-shit-done/bin/lib/core.cjs` — the shared foundation; all other lib modules import from here
- `get-shit-done/bin/lib/init.cjs` — compound init commands that bundle all workflow context into a single JSON response (primary way orchestrators load state)
- `get-shit-done/bin/lib/state.cjs` — STATE.md is read first in every workflow; this module owns all STATE.md operations

**Configuration:**

- `package.json` — npm package metadata, build scripts, test commands, engines (Node >=20)
- `.planning/config.json` (per user project, not in this repo) — project-level GSD config loaded by `loadConfig(cwd)` in `core.cjs`

**Installed location (on user machines):**

- `~/.claude/get-shit-done/bin/gsd-tools.cjs` — tool CLI (global install)
- `~/.claude/agents/gsd-*.md` — agent definitions
- `~/.claude/commands/gsd2/*.md` — slash commands
- `~/.claude/get-shit-done/workflows/*.md` — workflow orchestration
- `~/.claude/get-shit-done/templates/*.md` — document templates

---

## Naming Conventions

**Files:**

- Library modules: `kebab-case.cjs` — e.g., `model-profiles.cjs`, `profile-pipeline.cjs`
- Agent definitions: `gsd-<role>.md` — e.g., `gsd-executor.md`, `gsd-plan-checker.md`
- Command stubs: `kebab-case.md` matching the workflow name — e.g., `execute-phase.md`, `plan-phase.md`
- Workflow files: `kebab-case.md` matching the command — e.g., `execute-phase.md`
- Test files: `kebab-case.test.cjs` — e.g., `claude-md.test.cjs`
- Hook scripts: `gsd-<purpose>.js` — e.g., `gsd-context-monitor.js`

**Functions (in lib/*.cjs):**

- Internal helpers: camelCase prefixed with `cmd` for top-level command functions — e.g., `cmdPhasesList`, `cmdStateLoad`, `cmdVerifySummary`
- Internal utilities: camelCase without prefix — e.g., `loadConfig`, `findPhaseInternal`, `normalizeMd`
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
