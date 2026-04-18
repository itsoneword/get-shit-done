# Documentation Gaps

Un-sourced behaviors flagged during subsystem documentation runs. Each entry links to the code that prompted the claim. A human or future run should locate the source and migrate the claim to the appropriate subsystem file.

## Subsystem: hooks

- **workflow-guard subagent detection heuristic**: The guard checks `data.tool_input.is_subagent` and `data.session_type === 'task'` to decide whether it is inside a Task subagent, but neither field is documented in the Claude Code hook API reference that is visible in this codebase. It is unclear whether these fields are reliably set by the runtime or are a best-effort workaround. (`hooks/gsd-workflow-guard.js:34-36`)

- **statusline rendering contract**: `gsd-statusline.js` writes a raw ANSI string to stdout rather than a `hookSpecificOutput` JSON object. It is unclear from the source files whether this is a documented Claude Code statusline hook contract or an undocumented behavior that happens to work. (`hooks/gsd-statusline.js:127-131`)

- **`data.tool_input.is_subagent` field origin**: No source in this repository sets or documents `is_subagent` on tool input. The field may be injected by the Claude Code runtime for Task-spawned subagents, but this could not be confirmed from repository code alone. (`hooks/gsd-workflow-guard.js:35`)

## Subsystem: test-suite

- **Missing test files**: `quick-branching.test.cjs` and `quick-research.test.cjs` were listed in `.planning/codebase/STRUCTURE.md:91-92` and `.planning/codebase/TESTING.md:244-247` as in-scope but do not exist in `tests/` as of this run. Unclear whether they were renamed, deleted, or not yet created.

- **`GSD_TEST_MODE` guard location**: The env var is set at the top of all four installer test files before `require('../bin/install.js')`, preventing main CLI execution during import. The exact guard condition inside `bin/install.js` was not sourced. Pointer: `tests/antigravity-install.test.cjs:8` sets the var; consuming logic is in `bin/install.js` at an unknown line.

- **`NODE_V8_COVERAGE` propagation**: `scripts/run-tests.cjs:3` comments that it propagates `NODE_V8_COVERAGE` to the child process for `c8` coverage collection. The `execFileSync` call uses `env: { ...process.env }` (source: `scripts/run-tests.cjs:23`). Unverified whether `c8` sets this var before invoking the runner, or whether the spread is a no-op in the plain `npm test` (non-coverage) path.

## Subsystem: installer

- **Cursor MCP conversion mechanism**: The subsystem doc claims `bin/install.js` converts slash-commands into MCP protocol for Cursor installs, and points at `tests/cursor-conversion.test.cjs` for validation. The exact transformation code path in `bin/install.js` was not cited line-by-line in this run.

- **settings.json hook registration**: The installer is stated to register hooks by mutating `settings.json`/`config.toml`. The exact function in `bin/install.js` responsible for these mutations and the shape of the inserted hook entries were not sourced.

## Subsystem: tool-cli

- **init.cjs bundled-context shape**: Each workflow's `init <workflow>` call returns a JSON blob whose exact keyset is workflow-specific. The init JSON for `document` is enumerated in `get-shit-done/workflows/document.md:13-31`, but the keysets for other workflows are not consolidated anywhere sourceable.

- **`output(result, raw, rawValue)` contract**: The convention is documented in `.planning/codebase/STRUCTURE.md:170` but the actual helper's source location (likely in `core.cjs`) was not cited with a file:line pointer.

## Subsystem: agents

- **Agent count drift**: `.planning/codebase/STRUCTURE.md:14-26` lists 16 agents, but `agents/` currently contains 20 files and `MODEL_PROFILES` in `get-shit-done/bin/lib/model-profiles.cjs:9-30` contains 20 entries. The STRUCTURE.md inventory is stale relative to on-disk reality. (`agents/`, `get-shit-done/bin/lib/model-profiles.cjs:9-30`, `.planning/codebase/STRUCTURE.md:14-26`)

- **`gsd-agent-researcher` / `gsd-agent-checker` personas**: These appear in `MODEL_PROFILES` at `model-profiles.cjs:28-29` but no matching `agents/gsd-agent-researcher.md` or `agents/gsd-agent-checker.md` file exists on disk. Unclear whether the profile entries are aspirational or the personas were removed.

## Subsystem: workflows

- **Slash-command / workflow parity**: `commands/gsd2/` has 51 stubs and `get-shit-done/workflows/` has 49 workflow files. Some commands (e.g., `debug`, `fix`, `join-discord`, `reapply-patches`, `resume-work`, `review-backlog`, `set-profile`, `thread`, `add-backlog`) exist without a 1:1 workflow name match. The inclusion path for these commands was not fully sourced — some likely `@`-include helper workflows under different names.

## Subsystem: templates-references

- **`template.cjs` type coverage**: The subsystem doc claims templates are filled by either `template.cjs` programmatically or by agents reading the file directly. The exact set of template kinds handled programmatically by `template.cjs` versus read-and-filled manually by agents was not enumerated with a file:line citation.
