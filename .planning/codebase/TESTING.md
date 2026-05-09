# Testing Patterns
**Analysis Date:** 2026-03-21

## Framework and Commands
- **Runner:** Node.js built-in `node:test` (no external framework), requires Node 20+
- **Config:** `scripts/run-tests.cjs` — custom cross-platform runner that globs `tests/*.test.cjs` and runs them via `--test` flag
- **Coverage:** `c8` v11.0.0

```bash
npm test                  # run all tests
npm run test:coverage     # run with 70% line coverage enforcement
```

Coverage command: `c8 --check-coverage --lines 70 --reporter text --include 'get-shit-done/bin/lib/*.cjs' --exclude 'tests/**' --all node scripts/run-tests.cjs`

## File Organization
- **Location:** Separate `tests/` directory — not co-located beside source
- **Naming:** `<module-name>.test.cjs` — mirrors the source module name exactly
  - `core.test.cjs` tests `get-shit-done/bin/lib/core.cjs`
  - `frontmatter.test.cjs` tests `get-shit-done/bin/lib/frontmatter.cjs`
  - `commands.test.cjs` tests `get-shit-done/bin/lib/commands.cjs`
- **Count:** 28 test files covering 15 source modules; some tests cover workflow markdown files (e.g., `quick-branching.test.cjs`, `quick-research.test.cjs`, `agent-frontmatter.test.cjs`)
- **Shared helpers:** `tests/helpers.cjs` — three helper functions used by nearly every test file

## Test Structure

```js
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('feature under test', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('specific behavior described in plain language', () => {
    // Arrange: set up files in tmpDir
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');

    // Act: invoke CLI command
    const result = runGsdTools('phases list', tmpDir);

    // Assert
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 1, 'count should be 1');
    assert.deepStrictEqual(output.directories, ['01-test']);
  });
});
```

## Two Testing Modes

### Mode 1: CLI Integration (Dominant Pattern)
Tests invoke `gsd-tools.cjs` as a real subprocess and parse JSON output. Used for all command-level tests:

```js
const result = runGsdTools('history-digest', tmpDir);
assert.ok(result.success, `Command failed: ${result.error}`);
const digest = JSON.parse(result.output);
assert.deepStrictEqual(digest.phases, {});
```

### Mode 2: Direct Function Import (Unit Tests)
Some test files import library functions directly and call them as pure functions. Used for `core.cjs` and `frontmatter.cjs` which have testable pure logic:

```js
const {
  loadConfig,
  normalizePhaseName,
  comparePhaseNum,
  normalizeMd,
} = require('../get-shit-done/bin/lib/core.cjs');

test('returns defaults when config.json is missing', () => {
  const config = loadConfig(tmpDir);
  assert.strictEqual(config.model_profile, 'balanced');
});
```

Only use Mode 2 for pure utility functions with no side effects. For anything that calls `output()` or `process.exit()`, use Mode 1 via `runGsdTools`.

## Assertion Style
- **Library:** Node.js built-in `assert` only — no chai, expect, or jest matchers
- **Always provide a message as the last argument** to every assertion
- Methods used:

```js
assert.ok(value, 'message')                             // truthy check
assert.strictEqual(actual, expected, 'message')         // ===
assert.deepStrictEqual(actual, expected, 'message')     // deep equality
assert.throws(() => fn(), /pattern/, 'message')         // exception check
```

Always include the error message when asserting `result.success`:
```js
assert.ok(result.success, `Command failed: ${result.error}`);
```

## Mocking
No mocking framework. No sinon, jest.mock, or proxyquire. Tests use real I/O everywhere:

- **File system:** Real `fs.mkdirSync` / `fs.writeFileSync` in temp directories
- **Git:** Real git commands via `execSync` in real git repos
- **CLI:** Real subprocess spawning via `execFileSync`

This is a deliberate philosophy — integration confidence over isolation speed.

## Fixtures and Test Data

### `createTempProject()` — Standard Fixture
```js
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}
```
Use when: any test that reads/writes `.planning/` files but does not need git history.

### `createTempGitProject()` — Git-Aware Fixture
```js
function createTempGitProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\n\nTest project.\n');
  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}
```
Use when: test exercises `cmdCommit`, git hash verification, `isGitIgnored`, or any command that calls `execGit`.

### `cleanup(tmpDir)` — Always Required in `afterEach`
```js
function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```
Every test suite with `createTempProject` or `createTempGitProject` in `beforeEach` must call `cleanup(tmpDir)` in `afterEach`.

### `runGsdTools(args, cwd)` — CLI Invocation Helper
```js
// String arg: passed via shell (shell-interpolated)
runGsdTools('phases list', tmpDir)

// Array arg: passed via execFileSync (safe for JSON, dollar signs, special chars)
runGsdTools(['phases', 'find', '01', '--include-archived'], tmpDir)
```

Returns `{ success: boolean, output: string, error?: string }`. Output is always trimmed. Use array form when arguments contain special characters.

### Writing Fixture Files
Tests build fixture content inline in the test body:

```js
// YAML frontmatter in markdown (phase summary fixture)
const summaryContent = `---
phase: "01"
name: "Foundation Setup"
dependency-graph:
  provides:
    - "Database schema"
    - "Auth system"
tech-stack:
  added:
    - "prisma"
key-decisions:
  - "Use Prisma over Drizzle: Better DX than raw SQL"
---

# Summary content here
`;
fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), summaryContent);
```

```js
// PLAN.md with required frontmatter (helper function pattern in verify.test.cjs)
function validPlanContent({ wave = 1, dependsOn = '[]', autonomous = 'true' } = {}) {
  return [
    '---',
    'phase: 01-test',
    'plan: 01',
    'type: execute',
    `wave: ${wave}`,
    `depends_on: ${dependsOn}`,
    'files_modified: [some/file.ts]',
    `autonomous: ${autonomous}`,
    'must_haves:',
    '  truths:',
    '    - "something is true"',
    '---',
    '',
    '<tasks>',
    '<task type="auto">',
    '  <name>Task 1</name>',
    '  <files>some/file.ts</files>',
    '  <action>Do the thing</action>',
    '  <verify><automated>echo ok</automated></verify>',
    '  <done>Thing is done</done>',
    '</task>',
    '</tasks>',
  ].join('\n');
}
```

Use helper builder functions in test files when multiple tests need variants of the same complex fixture.

## Coverage
- **Target:** 70% line coverage enforced on `get-shit-done/bin/lib/*.cjs`
- **Tool:** c8 v11.0.0
- **Excluded:** `tests/**` directory
- **Report:** `text` to stdout
- Enforced via `npm run test:coverage` — this runs the full suite through c8

## Test Types Present

### Unit (Pure Function)
Tests that import and call functions directly. Used for pure utility logic in `core.cjs` and `frontmatter.cjs`:
- `core.test.cjs` — `loadConfig`, `normalizePhaseName`, `comparePhaseNum`, `normalizeMd`, `getMilestoneInfo`
- `frontmatter.test.cjs` — `extractFrontmatter`, `reconstructFrontmatter`, `spliceFrontmatter`, `parseMustHavesBlock`
- `model-profiles.test.cjs` — `MODEL_PROFILES` data shape

### Integration (CLI Subprocess)
Tests that invoke `gsd-tools.cjs` and assert on JSON output. The dominant pattern — covers all `cmd*` functions:
- `phase.test.cjs`, `commands.test.cjs`, `state.test.cjs`, `milestone.test.cjs`, `verify.test.cjs`, `init.test.cjs`, `roadmap.test.cjs`

### Contract / Schema Tests
Tests that validate markdown file structure and frontmatter conventions across the agent and workflow corpus — no code execution, just file content assertions:
- `agent-frontmatter.test.cjs` — validates all `agents/*.md` files have required fields, no `skills:` key, anti-heredoc instruction in file-writing agents
- `quick-branching.test.cjs` — validates `workflows/quick.md` contains specific step text and ordering
- `quick-research.test.cjs` — validates `workflows/quick.md` and `commands/gsd/quick.md` advertise `--research` flag and include correct workflow steps

### E2E
Not present. No tests orchestrate complete multi-phase GSD workflows.

## Notable Test Patterns

### Regression Documentation Pattern
```js
test('handles quoted commas in inline arrays — REG-04 known limitation', () => {
  // REG-04: The split(',') does NOT respect quotes inside inline arrays.
  // This test documents the CURRENT (buggy) behavior.
  const content = '---\nkey: ["a, b", c]\n---\n';
  const result = extractFrontmatter(content);
  assert.ok(result.key.length > 2, 'REG-04: split produces more items than intended');
});
```

Document known bugs with REG-NN identifiers and assert on the broken behavior. Do not suppress the test — it tracks the regression.

### Error Condition as Success Pattern
Commands that gracefully handle missing files return a JSON error field rather than a non-zero exit:

```js
test('missing STATE.md returns error', () => {
  const result = runGsdTools('state-snapshot', tmpDir);
  assert.ok(result.success, `Command should succeed: ${result.error}`);  // exits 0
  const output = JSON.parse(result.output);
  assert.strictEqual(output.error, 'STATE.md not found');
});
```

Not all failures are exit code 1. Test `result.success` AND inspect `output.error` when testing graceful error paths.

### Sorted Output Validation
Phase sorting (numeric, decimal, letter suffix) is a critical invariant tested directly:

```js
test('handles decimal phases in sort order', () => {
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.1-hotfix'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.2-patch'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-ui'), { recursive: true });

  const result = runGsdTools('phases list', tmpDir);
  const output = JSON.parse(result.output);
  assert.deepStrictEqual(
    output.directories,
    ['02-api', '02.1-hotfix', '02.2-patch', '03-ui'],
    'decimal phases should sort correctly between whole numbers'
  );
});
```

### Local Helper Functions Within Test Files
When multiple tests in the same file need config setup or complex fixture construction, define a local helper inside the `describe` block:

```js
describe('loadConfig', () => {
  // ...
  function writeConfig(obj) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(obj, null, 2)
    );
  }

  test('reads model_profile from config.json', () => {
    writeConfig({ model_profile: 'quality' });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'quality');
  });
});
```

### Workflow File Content Tests
Tests that validate workflow markdown use string search and regex extraction, not HTML parsing:

```js
test('step 4.75 research phase exists', () => {
  content = fs.readFileSync(workflowPath, 'utf-8');
  assert.ok(content.includes('Step 4.75'), 'workflow should contain Step 4.75');
});

test('research step spawns gsd-phase-researcher', () => {
  const researchSection = content.substring(
    content.indexOf('Step 4.75'),
    content.indexOf('Step 5:')
  );
  assert.ok(
    researchSection.includes('subagent_type="gsd-phase-researcher"'),
    'research step should spawn gsd-phase-researcher agent'
  );
});
```
