# Technology Stack
**Analysis Date:** 2026-03-21

## Languages
- **JavaScript (CommonJS)** — All runtime code: core library in `get-shit-done/bin/lib/*.cjs`, test files in `tests/*.cjs`, hook scripts in `hooks/*.js`, installer in `bin/install.js`, build scripts in `scripts/`
- **Markdown** — Agent prompts (`agents/*.md`), command definitions (`commands/gsd2/*.md`), workflow definitions (`get-shit-done/workflows/*.md`), templates (`get-shit-done/templates/*.md`), all `.planning/` state documents

## Runtime & Package Manager
- **Node.js** `>=20.0.0` (enforced by `engines` field in `package.json`; built-in `node:test` and `fetch` require Node 20+)
- **npm** (default package manager); Lockfile: `package-lock.json` present

## Frameworks
| Framework | Version | Purpose |
|-----------|---------|---------|
| node:test | built-in (Node 20+) | Test runner — no external test framework dependency |
| node:assert | built-in | Assertions in tests |
| c8 | ^11.0.0 | Code coverage reporting with V8 instrumentation; enforces `--check-coverage --lines 70` |
| esbuild | ^0.24.0 | Dev dependency for hook build step only (copy + syntax-validate to `hooks/dist/`) |

No application framework (Express, Fastify, etc.) is used. GSD is a pure CLI tool.

## Key Dependencies
**Zero production npm dependencies.** All runtime code uses Node.js built-in modules only:
- `fs`, `path`, `os` — file system and platform utilities throughout all modules
- `child_process` (`execSync`, `spawnSync`, `execFileSync`, `spawn`) — git operations in `core.cjs`, subprocess calls in hooks
- `readline` — interactive prompts in `bin/install.js`
- `crypto` — used in `bin/install.js`
- `vm` — JavaScript syntax validation in `scripts/build-hooks.js`
- `fetch` (Node 20+ built-in) — Brave Search API HTTP calls in `get-shit-done/bin/lib/commands.cjs`

**Dev dependencies only:**
- `c8` ^11.0.0 — coverage tool wrapping the built-in `node --test` runner
- `esbuild` ^0.24.0 — hook build pipeline; no bundling of library code

## Core Module Architecture
All business logic lives in `get-shit-done/bin/lib/*.cjs`. Every module uses CommonJS `module.exports`. The entry point routing all subcommands is `get-shit-done/bin/gsd-tools.cjs`.

| Module | Role |
|--------|------|
| `core.cjs` | Shared foundation — `loadConfig`, `output`/`error` I/O, git helpers, phase/milestone resolution; every other module depends on this |
| `commands.cjs` | Utility commands — slug generation, timestamps, todo listing, summary extraction, Brave web search (`cmdWebsearch`) |
| `config.cjs` | Config CRUD — `ensureConfigFile`, key validation, model profile display |
| `frontmatter.cjs` | YAML-like frontmatter parsing and reconstruction for `.md` plan files |
| `init.cjs` | Compound bootstrap commands — `cmdInitExecutePhase`, project initialization, session scanning |
| `milestone.cjs` | Milestone archiving and `MILESTONES.md` management |
| `model-profiles.cjs` | Agent-to-model mapping for three profiles (`quality`/`balanced`/`budget`) across 15 agents |
| `phase.cjs` | Phase add/insert/remove/complete/renumber operations against `ROADMAP.md` |
| `profile-output.cjs` | User profile formatting and output |
| `profile-pipeline.cjs` | Reads Claude Code session JSONL history from `~/.claude/projects/` for behavioral profiling |
| `roadmap.cjs` | Roadmap parsing and progress analysis |
| `state.cjs` | `STATE.md` read/write/patch/frontmatter operations |
| `uat.cjs` | UAT audit scanning across all phase directories |
| `verify.cjs` | Verification suite: summary validation, consistency checks, `.planning/` health repair |

## Model Profiles
Defined in `get-shit-done/bin/lib/model-profiles.cjs`. Three profiles map 15 agents to model aliases:

| Profile | Planner | Executor | Verifier |
|---------|---------|----------|----------|
| `quality` | opus | opus | sonnet |
| `balanced` | opus | sonnet | sonnet |
| `budget` | sonnet | sonnet | haiku |

Aliases (`opus`/`sonnet`/`haiku`) are resolved to full model IDs by the AI runtime, not by GSD. Optional `resolve_model_ids: true` config causes GSD to resolve aliases itself.

## Hook Scripts
Four Node.js scripts in `hooks/`; copied with syntax validation to `hooks/dist/` at build time:

| Hook | Trigger | Purpose |
|------|---------|---------|
| `gsd-statusline.js` | PostToolUse | Writes context metrics to `/tmp/claude-ctx-{session}.json`; renders terminal statusline |
| `gsd-context-monitor.js` | PostToolUse | Reads bridge file; injects WARNING (≤35% remaining) or CRITICAL (≤25%) into agent conversation |
| `gsd-workflow-guard.js` | PreToolUse | Soft-warns agent when editing files outside a GSD workflow context |
| `gsd-check-update.js` | SessionStart | Background-spawns `npm view get-shit-done-cc version`; caches result at `~/.claude/cache/gsd-update-check.json` |

## Configuration
- **Project config:** `.planning/config.json` — created by `gsd-tools.cjs config-ensure-section`. Key fields: `model_profile`, `commit_docs`, `branching_strategy` (`none`/`phase`/`milestone`), `parallelization`, `research`, `plan_checker`, `verifier`, `nyquist_validation`, `brave_search`, `context_window` (default 200000), `phase_naming` (`sequential`/`custom`), `text_mode`, `resolve_model_ids`.
- **Per-hook toggles:** `hooks.context_warnings` and `hooks.workflow_guard` keys in `.planning/config.json`.
- **User-level key file:** `~/.gsd/brave_api_key` (alternative to `BRAVE_API_KEY` env var).
- **Build pipeline:** `scripts/build-hooks.js` — full build in a single file, no external build config.

## Build & Test Commands
- `npm run build:hooks` — syntax-validates and copies `hooks/*.js` → `hooks/dist/`; runs automatically via `prepublishOnly`.
- `npm test` — discovers all `tests/*.test.cjs` via `scripts/run-tests.cjs`, runs with `node --test`.
- `npm run test:coverage` — wraps test runner with `c8`, enforcing 70% line coverage on `get-shit-done/bin/lib/*.cjs`.

## Platform Requirements
- **Development:** Node.js >=20.0.0; git in PATH (required for phase operations and commit commands).
- **Supported OS:** macOS, Linux, WSL with Linux-native Node.js. Windows with native Node.js is explicitly rejected at install time in `bin/install.js` (path resolution issues).
- **AI runtime install targets:** Claude Code (`~/.claude/`), OpenCode (`~/.config/opencode/`), Gemini CLI (`~/.gemini/`), Codex CLI (`~/.codex/`), GitHub Copilot (`.github/`), Antigravity (`~/.gemini/antigravity/`), Cursor (`~/.cursor/`).
