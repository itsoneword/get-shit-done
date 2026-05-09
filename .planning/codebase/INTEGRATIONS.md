# External Integrations
**Analysis Date:** 2026-03-21

## APIs & Services

**Brave Search** — Optional web search for research commands
- SDK: Native `fetch()` HTTP calls (Node 20+ built-in); no SDK package
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Auth: `BRAVE_API_KEY` environment variable OR `~/.gsd/brave_api_key` file (checked in that order)
- Implementation: `get-shit-done/bin/lib/commands.cjs` `cmdWebsearch()` function; also checked in `get-shit-done/bin/lib/config.cjs` and `get-shit-done/bin/lib/init.cjs` during project init
- Behavior: If key not present, returns `{ available: false }` and agents fall back to built-in WebSearch tool; no errors thrown
- CLI surface: `gsd-tools websearch <query> [--limit N] [--freshness day|week|month]`

**npm Registry** — Package version checking
- SDK: `child_process.execSync('npm view get-shit-done-cc version')` — no HTTP library
- Implementation: `hooks/gsd-check-update.js`, spawned as a detached background child process during SessionStart
- Behavior: Result cached at `~/.claude/cache/gsd-update-check.json`; TTL-based; non-blocking
- Purpose: Notifies user when a newer version is available; also detects stale hooks by comparing hook `// gsd-hook-version:` headers against installed `VERSION` file

**Git CLI** — Version control integration
- SDK: Native `child_process.execSync()` and `spawnSync()` calls to system `git`
- Implementation: `get-shit-done/bin/lib/core.cjs` (`execGit`, `isGitIgnored`), `get-shit-done/bin/lib/commands.cjs` (commit command)
- Operations: Commit planning docs, check `.gitignore` status, branch creation/checkout, working tree status
- Config-driven: Branching strategy (`none`/`phase`/`milestone`) and templates (`gsd/phase-{phase}-{slug}`, `gsd/{milestone}-{slug}`) via `.planning/config.json`
- Behavior: Commits respect `.gitignore`; supports `--no-verify` flag for parallel execution scenarios; non-blocking design

**Claude Code Session History** — Local file read (no API call)
- Implementation: `get-shit-done/bin/lib/profile-pipeline.cjs`
- Access method: Direct filesystem read of `~/.claude/projects/**/*.jsonl` session transcript files
- Purpose: Extracts user messages for behavioral profiling (`gsd-user-profiler` agent)
- Auth: None — reads local files as the current user; no Claude API calls made by GSD itself
- Data: Reads `sessions-index.json` per project dir for metadata; parses JSONL for message content

## Data Storage
- **Database:** None. All state is file-based in `.planning/` within the project root.
- **File storage (per project):**
  - `.planning/config.json` — Workflow configuration and toggles
  - `.planning/STATE.md` — Active project state with YAML-like frontmatter (current phase, status, active tasks)
  - `.planning/ROADMAP.md` — Phase definitions with plan counts and progress tables
  - `.planning/REQUIREMENTS.md` — Project requirements tracking
  - `.planning/MILESTONES.md` — Shipped milestone archive
  - `.planning/phases/` — Phase directories named `{N}-{slug}/` (e.g., `1-setup/`, `2.1-auth/`)
  - Per phase: `CONTEXT.md`, `PLAN.md`, `SUMMARY.md`, `RESEARCH.md`, `VALIDATION.md`, `UAT.md`
  - `.planning/todos/pending/*.md` and `.planning/todos/completed/*.md` — Todo items as markdown files
- **Caching:** `~/.claude/cache/gsd-update-check.json` — update check result cache; TTL-based expiry
- **Temporary files:** `os.tmpdir()/gsd-{timestamp}.json` — used when JSON output exceeds 50KB (communicated to agents via `@file:` prefix in stdout)
- **Bridge file:** `/tmp/claude-ctx-{session_id}.json` — inter-hook communication for context metrics; written by `gsd-statusline.js`, read by `gsd-context-monitor.js`

## Auth
**No authentication system.** GSD is a local CLI tool:
- Runs as the current OS user within the IDE environment
- LLM API authentication is entirely handled by the AI runtime (Claude Code, Copilot, etc.); GSD never touches API keys for LLMs
- Git credentials are managed by system git config and SSH keys; GSD passes through git calls unchanged
- Only optional external credential: `BRAVE_API_KEY` for web search (gracefully degrades without it)

## CI/CD & Hosting
- **Hosting:** Not a hosted service. GSD runs locally inside developer IDEs or CI runners.
- **Package distribution:** Published as `gsd2` on npm; installed via `npm install -g gsd2` or `npx gsd2`
- **CI support:** Designed for CI environments via:
  - `CLAUDE_CONFIG_DIR` env var — override default config directory for Docker/CI/multi-account setups
  - Hooks bundled in `hooks/dist/` for use inside GitHub Actions or other CI workflows
  - Update checks spawn detached background processes to avoid blocking CI pipelines
- **No cloud deployment:** GSD has no server component

## Required Environment Variables
- `BRAVE_API_KEY` — (optional) Brave Search API key; if unset, web search gracefully falls back to built-in IDE tool
- `CLAUDE_CONFIG_DIR` — (optional) Override default `~/.claude/` config directory for Docker/CI/multi-account setups
- `NODE_V8_COVERAGE` — (internal, set automatically) Used by `c8` during `npm run test:coverage`
- `GEMINI_CONFIG_DIR`, `CODEX_HOME`, `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG`, `XDG_CONFIG_HOME`, `COPILOT_CONFIG_DIR`, `ANTIGRAVITY_CONFIG_DIR`, `CURSOR_CONFIG_DIR` — (optional) Runtime-specific config directory overrides; checked in `bin/install.js` during installation
- `WSL_DISTRO_NAME` — (detection only) Checked at install time to warn Windows-native Node.js users running under WSL

## Editor/AI Runtime Integrations
GSD installs commands, agents, and hooks into IDE-specific directories during `gsd2 --install`:

| Runtime | Install Location | Config Format |
|---------|-----------------|--------------|
| Claude Code | `~/.claude/` or `.claude/` (project) | `CLAUDE.md`, agents subdir, hooks |
| OpenCode | `~/.config/opencode/` (XDG) or `.opencode/` | `AGENTS.md`, hooks |
| GitHub Copilot | `.github/copilot-instructions.md` | Injected markdown block with markers |
| Cursor | `~/.cursor/` or `.cursor/` | `AGENTS.md`, hooks |
| Google Gemini CLI | `~/.gemini/` or `.gemini/` | `GEMINI.md`, hooks |
| Codex CLI | `~/.codex/` or `.codex/` | `config.toml` with agent sections |
| Antigravity | `~/.gemini/antigravity/` | Gemini-compatible format |

Agent prompt tool names are translated at install time from neutral GSD format to IDE-specific tool names. For example, Claude Code's `Read`/`Write`/`Bash`/`Grep`/`Glob` map to Copilot's `read`/`edit`/`execute`/`search`/`search`. This translation is implemented in `bin/install.js` via the `claudeToCopilotTools` mapping object.

Codex agents receive sandbox permission levels: `workspace-write` for agents that create files (executor, planner, researchers), `read-only` for review agents (plan-checker, integration-checker). Defined in `CODEX_AGENT_SANDBOX` constant in `bin/install.js`.
