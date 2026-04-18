# Subsystem: Hooks

**Updated:** 2026-04-17 by /gsd2:document (full run)
**Sources:** `.planning/codebase/ARCHITECTURE.md:96-104`, `hooks/gsd-context-monitor.js`, `hooks/gsd-statusline.js`, `hooks/gsd-workflow-guard.js`, `hooks/gsd-check-update.js`, `scripts/build-hooks.js`

## Shape

```mermaid
sequenceDiagram
    participant CC as Claude Code Runtime
    participant SL as gsd-statusline.js<br/>(PostToolUse)
    participant Bridge as /tmp/claude-ctx-{session}.json
    participant CM as gsd-context-monitor.js<br/>(PostToolUse)
    participant WG as gsd-workflow-guard.js<br/>(PreToolUse)
    participant CU as gsd-check-update.js<br/>(SessionStart)
    participant Cache as ~/.claude/cache/gsd-update-check.json

    CC->>SL: stdin JSON (tool event + context_window)
    SL->>Bridge: write metrics {remaining_percentage, used_pct, timestamp}
    SL->>CC: stdout (ANSI statusline string)

    CC->>CM: stdin JSON (same PostToolUse event)
    CM->>Bridge: read metrics
    CM-->>CC: stdout additionalContext (WARNING or CRITICAL advisory)

    CC->>WG: stdin JSON (PreToolUse Write/Edit event)
    WG->>CC: stdout additionalContext (advisory) or exit 0

    CC->>CU: SessionStart trigger
    CU->>Cache: spawn detached child; write update result
    SL->>Cache: read on next PostToolUse (update badge display)
```

## How It Works

### Overview

The hooks subsystem is a set of four standalone Node.js scripts that attach to Claude Code lifecycle events. They are read-only observers and soft advisory tools — none of them block or alter tool execution (source: `.planning/codebase/ARCHITECTURE.md:98`).

All four hooks are authored in `hooks/` and deployed to `hooks/dist/` via the build step. The installed copies on user machines live in the runtime's hook directory (e.g., `~/.claude/hooks/`), written by `bin/install.js` (source: `.planning/codebase/ARCHITECTURE.md:26`).

### gsd-statusline.js (PostToolUse)

Fires after every tool use. It reads the Claude Code event payload from stdin, normalizes the raw `remaining_percentage` from `data.context_window.remaining_percentage` against a 16.5% autocompact buffer, and emits an ANSI-colored progress bar to stdout (source: `hooks/gsd-statusline.js:27-65`).

The normalized `used` value is computed as:

```
usableRemaining = max(0, (remaining - 16.5) / (100 - 16.5) * 100)
used = max(0, min(100, round(100 - usableRemaining)))
```

(source: `hooks/gsd-statusline.js:33-35`)

Color thresholds: green below 50%, yellow below 65%, orange below 80%, blinking red skull at 80%+ (source: `hooks/gsd-statusline.js:57-66`).

As a side-effect, it writes a bridge file at `/tmp/claude-ctx-{session_id}.json` containing `{ session_id, remaining_percentage, used_pct, timestamp }`. This bridge is the sole data channel to the context monitor hook (source: `hooks/gsd-statusline.js:38-51`).

The statusline also reads `~/.claude/cache/gsd-update-check.json` (or equivalent runtime cache path) to display an update-available badge or stale-hooks warning (source: `hooks/gsd-statusline.js:96-109`).

A 3-second stdin timeout exits silently to avoid hanging the runtime on slow pipes (source: `hooks/gsd-statusline.js:14`).

### gsd-context-monitor.js (PostToolUse)

Fires after every tool use, after `gsd-statusline.js`. Reads the bridge file at `/tmp/claude-ctx-{session_id}.json` and injects a natural-language advisory into the agent's context when thresholds are crossed (source: `hooks/gsd-context-monitor.js:1-20`).

Thresholds:
- **WARNING**: `remaining_percentage <= 35%` (source: `hooks/gsd-context-monitor.js:25`)
- **CRITICAL**: `remaining_percentage <= 25%` (source: `hooks/gsd-context-monitor.js:26`)

Debounce: a separate state file `/tmp/claude-ctx-{session_id}-warned.json` tracks `callsSinceWarn` and `lastLevel`. Warnings fire immediately on first threshold breach, then are suppressed for 5 subsequent tool calls. Severity escalation (WARNING → CRITICAL) bypasses debounce and fires immediately (source: `hooks/gsd-context-monitor.js:100-112`).

Advisory messages are GSD-context-aware: if `.planning/STATE.md` exists in the working directory, the message references `/gsd2:pause-work`; otherwise it gives generic low-context guidance. Messages explicitly avoid imperative commands that could override user preferences (source: `hooks/gsd-context-monitor.js:119-142`).

Context warnings can be suppressed per-project by setting `hooks.context_warnings: false` in `.planning/config.json` (source: `hooks/gsd-context-monitor.js:50-58`).

The hook emits via `hookSpecificOutput.additionalContext` with `hookEventName` set to `"AfterTool"` when `GEMINI_API_KEY` is present, otherwise `"PostToolUse"` (source: `hooks/gsd-context-monitor.js:146-149`).

A 10-second stdin timeout exits silently (source: `hooks/gsd-context-monitor.js:35`).

### gsd-workflow-guard.js (PreToolUse)

Fires before `Write` or `Edit` tool calls. Checks whether the edit is happening outside a GSD workflow context and, if the guard is enabled, injects an advisory suggesting the user use `/gsd2:fix` or a GSD command instead (source: `hooks/gsd-workflow-guard.js:1-10`).

Guard is **opt-in** — it only activates when `.planning/config.json` exists with `hooks.workflow_guard: true`. Without that flag, the hook exits 0 immediately (source: `hooks/gsd-workflow-guard.js:60-74`).

Bypass conditions (hook exits 0 silently):
- Tool is not `Write` or `Edit` (source: `hooks/gsd-workflow-guard.js:28-30`)
- `data.tool_input.is_subagent` is truthy or `data.session_type === 'task'` (source: `hooks/gsd-workflow-guard.js:34-36`)
- File path is inside `.planning/` (source: `hooks/gsd-workflow-guard.js:43-45`)
- File matches allowed patterns: `.gitignore`, `.env*`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `settings.json` (source: `hooks/gsd-workflow-guard.js:48-56`)

Advisory text includes the target filename and names both `/gsd2:fix` and generic GSD commands as alternatives (source: `hooks/gsd-workflow-guard.js:81-86`).

### gsd-check-update.js (SessionStart)

Fires once at session start. Detects the runtime config directory by searching for a `get-shit-done/VERSION` file under `.config/opencode`, `.opencode`, `.gemini`, `.claude` (in that order), with `CLAUDE_CONFIG_DIR` env override taking priority (source: `hooks/gsd-check-update.js:16-28`).

The actual version check runs as a detached background child process to avoid blocking session startup (source: `hooks/gsd-check-update.js:45-130`). The child:
1. Reads the installed version from the `VERSION` file (project-local first, then global) (source: `hooks/gsd-check-update.js:55-65`)
2. Scans installed hook files for `// gsd-hook-version:` headers and flags any whose version does not match the installed `VERSION` as stale (source: `hooks/gsd-check-update.js:68-91`)
3. Skips the npm fetch if `package.json` in cwd has `name === 'gsd2'` or `'get-shit-done-cc'` (dev mode) (source: `hooks/gsd-check-update.js:93-103`)
4. Fetches `https://raw.githubusercontent.com/itsoneword/get-shit-done/main/package.json` via `curl` to compare versions (source: `hooks/gsd-check-update.js:109`)
5. Writes `{ update_available, installed, latest, checked, stale_hooks, dev_mode }` to `~/.claude/cache/gsd-update-check.json` (source: `hooks/gsd-check-update.js:114-123`)

The parent process calls `child.unref()` so it does not block session startup (source: `hooks/gsd-check-update.js:130`).

### Build Step (scripts/build-hooks.js)

Before hooks ship to users, `scripts/build-hooks.js` validates each hook's JavaScript syntax using `vm.Script` (parse-only, no execution), then copies valid hooks from `hooks/` to `hooks/dist/`. If the source contains `{{GSD_VERSION}}`, the placeholder is replaced with the version string from `package.json` before writing to dist (source: `scripts/build-hooks.js:29-78`).

The build was introduced after a duplicate `const` declaration in a dist file caused PostToolUse hook errors for all users (source: `scripts/build-hooks.js:1-7`, comments referencing issues #1107, #1109, #1125, #1161).

The `HOOKS_TO_COPY` array in `build-hooks.js` is the canonical list of shipped hooks; adding a new hook requires adding its filename there (source: `scripts/build-hooks.js:17-22`).

## Interfaces

### Inputs (stdin, per hook)

Each hook receives a JSON payload on stdin from the Claude Code runtime. Relevant fields:

| Field | Used by |
|---|---|
| `session_id` | statusline, context-monitor |
| `context_window.remaining_percentage` | statusline |
| `model.display_name` | statusline |
| `workspace.current_dir` | statusline |
| `cwd` | context-monitor, workflow-guard |
| `tool_name` | workflow-guard |
| `tool_input.file_path` | workflow-guard |
| `tool_input.is_subagent` | workflow-guard |
| `session_type` | workflow-guard |

(source: `hooks/gsd-statusline.js:21-25`, `hooks/gsd-context-monitor.js:42-48`, `hooks/gsd-workflow-guard.js:27-44`)

### Outputs

- **gsd-statusline.js**: raw ANSI string to stdout (rendered by Claude Code as a statusline) (source: `hooks/gsd-statusline.js:127-131`)
- **gsd-context-monitor.js**: `{ hookSpecificOutput: { hookEventName, additionalContext } }` JSON to stdout (source: `hooks/gsd-context-monitor.js:144-151`)
- **gsd-workflow-guard.js**: `{ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext } }` JSON to stdout (source: `hooks/gsd-workflow-guard.js:78-89`)
- **gsd-check-update.js**: no stdout; side-effect is writing to cache file (source: `hooks/gsd-check-update.js:114-123`)

### Shared Bridge File

`/tmp/claude-ctx-{session_id}.json` — written by `gsd-statusline.js`, read by `gsd-context-monitor.js`. Format: `{ session_id, remaining_percentage, used_pct, timestamp }`. Metrics older than 60 seconds are treated as stale and ignored by the monitor (source: `hooks/gsd-context-monitor.js:62-63`, `hooks/gsd-context-monitor.js:71-75`).

### Config Keys (`.planning/config.json`)

| Key | Hook | Default | Effect |
|---|---|---|---|
| `hooks.context_warnings` | context-monitor | `true` | Set to `false` to suppress all context advisories |
| `hooks.workflow_guard` | workflow-guard | `false` | Set to `true` to enable out-of-workflow edit advisories |

(source: `hooks/gsd-context-monitor.js:50-58`, `hooks/gsd-workflow-guard.js:60-74`)

### Installation

`bin/install.js` copies hooks from `hooks/dist/` to the runtime's hook directory during `npx gsd2` setup. The `hooks/dist/` copies are the shipped artifacts; `hooks/` are the authored sources (source: `.planning/codebase/ARCHITECTURE.md:26`, `.planning/codebase/STRUCTURE.md:83-85`).

## Related

- [[installer]] — installs hook files to runtime hook directories during `npx gsd2` setup
- [[tool-cli]] — workflows that hooks advise about (execute-phase, plan-phase, fix)
- [[workflows]] — workflow-guard advises using a workflow instead of bare Write/Edit

## Gaps

See [[_gaps#hooks]] for un-sourced behaviors.
