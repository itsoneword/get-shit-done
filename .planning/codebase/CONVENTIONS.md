# Coding Conventions
**Analysis Date:** 2026-03-21

## Module System
All runtime code uses CommonJS (`require`/`module.exports`). Files carry `.cjs` extension for explicitness. No ES module syntax anywhere in library or test code. Hook scripts (`hooks/*.js`) also use CommonJS.

## Naming

### Files
- Library modules: `kebab-case.cjs` — e.g., `core.cjs`, `frontmatter.cjs`, `model-profiles.cjs`, `profile-pipeline.cjs`
- Test files: `<module-name>.test.cjs` mirroring library name, placed flat in `tests/`
- Hook scripts: `gsd-<purpose>.js` — e.g., `gsd-workflow-guard.js`, `gsd-context-monitor.js`
- All source files in `get-shit-done/bin/lib/` and all tests in `tests/` are flat (no subdirectories)

### Functions
- **CLI command handlers:** `cmd` prefix + PascalCase — e.g., `cmdGenerateSlug`, `cmdListTodos`, `cmdHistoryDigest`, `cmdTodoMatchPhase`
- **Internal helpers not exported:** plain `camelCase` — e.g., `stateExtractField`, `isInsideFencedBlock`
- **Internal helpers shared across modules:** `camelCase` suffixed with `Internal` — e.g., `findPhaseInternal`, `resolveModelInternal`, `generateSlugInternal`, `getRoadmapPhaseInternal`
- No underscore prefix for private functions; privacy is enforced by non-export

### Variables and Object Keys
- Local variables and parameters: `camelCase` — e.g., `tmpDir`, `phaseDir`, `mentionedFiles`
- Module-level constants: `UPPER_SNAKE_CASE` — e.g., `MODEL_PROFILES`, `TOOLS_PATH`, `MODEL_ALIAS_MAP`
- JSON/API response object keys: `snake_case` — e.g., `current_phase`, `phase_req_ids`, `commits_exist`
- Config fields: `snake_case` — e.g., `model_profile`, `branching_strategy`, `context_window`

## Formatting and Linting
- No ESLint or Prettier configured
- Indentation: 2 spaces (consistent across all files)
- Semicolons required on all statements
- Line width approximately 80–100 characters (not enforced)
- All GSD-generated markdown files pass through `normalizeMd()` in `core.cjs` before being written, which enforces markdownlint rules: MD022 (blank lines around headings), MD031 (fenced code blocks), MD032 (lists), MD012 (max 2 consecutive blank lines), MD047 (trailing newline)

## Import Organization

Three implicit groups in this order, separated by blank lines:

1. Node.js built-ins
2. Internal sibling modules via relative path
3. Pure-data constant modules (e.g., `model-profiles.cjs`)

```js
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const { safeReadFile, loadConfig, output, error } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');

const { MODEL_PROFILES } = require('./model-profiles.cjs');
```

- Destructuring used heavily — functions imported by name, not namespaced
- Full relative paths like `require('./core.cjs')` — no path aliases
- Zero runtime npm dependencies; all imports are built-ins or internal

## Module Dependency Hierarchy

The following hierarchy is strictly maintained. Lower modules cannot import higher ones:

```
model-profiles.cjs  ← pure data, no imports
core.cjs            ← built-ins only (fs, path, child_process, os)
frontmatter.cjs     ← imports core.cjs
state.cjs           ← imports core.cjs, frontmatter.cjs
verify.cjs          ← imports core.cjs, frontmatter.cjs, state.cjs
commands.cjs        ← imports core.cjs, frontmatter.cjs, model-profiles.cjs
phase.cjs           ← imports core.cjs, frontmatter.cjs
```

## Output Pattern

Every CLI command terminates through one of two functions from `core.cjs` — never via `return` or direct `process.exit()`:

```js
// Success — JSON by default, raw text when raw=true
output(result, raw, rawValue);   // calls process.exit(0) internally

// Failure — writes to stderr and exits 1
error('message');                // calls process.exit(1) internally
```

Large JSON payloads (>50KB) are written to a temp file; stdout receives `@file:/path/to/file` so callers can detect and read it.

When `--raw` is passed, `output()` uses the third argument as plain text instead of JSON. This is the universal pattern:

```js
function cmdVerifyPathExists(cwd, targetPath, raw) {
  if (!targetPath) {
    error('path required for verification');
  }
  // ...
  const result = { exists: true, type: 'file' };
  output(result, raw, 'true');
}
```

## Error Handling

### Validation on Entry
Required arguments are checked immediately and call `error()`:
```js
function cmdGenerateSlug(text, raw) {
  if (!text) {
    error('text required for slug generation');
  }
  // ...
}
```

### Silent Catches — Must Be Annotated
Empty catch blocks are intentional and always carry the comment `/* intentionally empty */`:
```js
try {
  fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8');
} catch { /* intentionally empty */ }
```

A silent catch without this annotation is a bug, not a pattern.

### Graceful Degradation vs Hard Failure
- Operations that can continue despite failure (iterating phase dirs, skipping malformed summaries): silent catch, continue loop
- Operations that cannot proceed (missing required arg, corrupt state): `error()` immediately

```js
// Graceful — iterating phase summaries
} catch (e) {
  // Skip malformed summaries
}

// Hard failure — command cannot proceed
} catch (e) {
  error('Failed to generate history digest: ' + e.message);
}
```

### Async Error Handling
`cmdWebsearch` is the only async function. It uses try/catch internally and calls `output()` or `error()` in all paths — no unhandled promise rejections.

## Function Signatures — Command Pattern

All `cmd*` functions follow a consistent signature:
```js
function cmdAction(cwd, arg1, arg2, ..., raw) {
  // cwd: string — current working directory
  // argN: positional command arguments
  // raw: boolean — when true, output plain text instead of JSON
  // Returns: never (terminates via output() or error())
}
```

Complex options are passed as a destructured object:
```js
function cmdPhasesList(cwd, options, raw) {
  const { type, phase, includeArchived } = options;
  // ...
}
```

## Exports

Single `module.exports` object literal at the end of each file — named exports only, no default exports:

```js
module.exports = {
  cmdGenerateSlug,
  cmdCurrentTimestamp,
  cmdListTodos,
  // ...
};
```

## Section Comments (Visual Separators)

Long files group related functions with Unicode box-drawing separators:
```js
// ─── Path helpers ────────────────────────────────────────────────────────────

// ─── Output helpers ───────────────────────────────────────────────────────────

// ─── Git utilities ────────────────────────────────────────────────────────────
```

## File Headers

Every `.cjs` file starts with a doc comment:
```js
/**
 * Module Name — Brief description of what this module does
 */
```

## JSDoc

Non-trivial functions with parameters that are ambiguous or have important behavioral edge cases get JSDoc. Simple helpers do not:

```js
/**
 * Extract the current milestone section from ROADMAP.md by positive lookup.
 *
 * Falls back to stripShippedMilestones() if:
 * - cwd is not provided
 * - STATE.md doesn't exist or has no milestone field
 * - Version can't be found in ROADMAP.md
 *
 * @param {string} content - Full ROADMAP.md content
 * @param {string} [cwd] - Working directory for reading STATE.md
 * @returns {string} Content scoped to current milestone
 */
function extractCurrentMilestone(content, cwd) { ... }
```

## Inline Comments

Used sparingly, only for non-obvious reasoning — especially git edge cases, regex logic, and cross-platform concerns:

```js
// --no-index checks .gitignore rules regardless of whether the file is tracked.
// Without it, git check-ignore returns "not ignored" for tracked files even when
// .gitignore explicitly lists them — a common source of confusion when .planning/
// was committed before being added to .gitignore.
```

## Regression Annotations

Known bugs are documented with identifiers in both test files and source. The pattern used is `REG-NN`:
- `REG-01` — `loadConfig` previously omitted `model_overrides` from return value
- `REG-02` — `getRoadmapPhaseInternal` not exported
- `REG-04` — Inline YAML array parser splits on commas inside quoted strings

In tests, the current (buggy) behavior is asserted and labeled:
```js
test('handles quoted commas in inline arrays — REG-04 known limitation', () => {
  // REG-04: The split(',') does NOT respect quotes inside arrays.
  // This test documents the CURRENT (buggy) behavior.
  assert.ok(result.key.length > 2, 'REG-04: split produces more items than intended');
});
```

## Config Defaults

Config defaults live as a `const defaults` object at the top of `loadConfig()` in `core.cjs`. All config keys are normalized with `?? defaults.key` so new keys always have a fallback. Deprecated keys are migrated on read:

```js
// Migration of deprecated "depth" key
if ('depth' in parsed && !('granularity' in parsed)) {
  const depthToGranularity = { quick: 'coarse', standard: 'standard', comprehensive: 'fine' };
  parsed.granularity = depthToGranularity[parsed.depth] || parsed.depth;
  delete parsed.depth;
  try { fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2)); } catch { /* intentionally empty */ }
}
```
