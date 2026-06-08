/**
 * GSD Tools Tests — Lessons Ledger (lesson subcommand)
 *
 * Tests for: lesson append, list, update, bump-recurrence, attribute, scan
 * RED phase: lib/lesson.cjs and the lesson dispatch case do not yet exist.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ── Fixture helpers ──────────────────────────────────────────────────────────

function lessonsDir(tmp) {
  return path.join(tmp, '.planning', 'lessons');
}

function lessonsFile(tmp) {
  return path.join(tmp, '.planning', 'lessons', 'lessons.jsonl');
}

function writeLessons(tmp, records) {
  const dir = lessonsDir(tmp);
  fs.mkdirSync(dir, { recursive: true });
  const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(lessonsFile(tmp), lines, 'utf8');
}

function readLessonsRaw(tmp) {
  const f = lessonsFile(tmp);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8')
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => JSON.parse(l));
}

function writeAgentTrace(tmp, records) {
  const dir = path.join(tmp, '.planning', 'telemetry');
  fs.mkdirSync(dir, { recursive: true });
  const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'agent-trace.jsonl'), lines, 'utf8');
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('lesson append', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('creates lessons.jsonl with one line and returns assigned id', () => {
    const result = runGsdTools(
      ['lesson', 'append', '{"description":"executor missed endpoint","disposition":"proposed"}'],
      tmp
    );
    assert.ok(result.success, `command failed: ${result.error}`);

    // File exists
    assert.ok(fs.existsSync(lessonsFile(tmp)), 'lessons.jsonl should exist');

    // Exactly 1 line
    const records = readLessonsRaw(tmp);
    assert.strictEqual(records.length, 1, 'should have exactly 1 record');

    // id format
    const rec = records[0];
    assert.match(rec.id, /^LSN-\d{3}$/, 'id should match LSN-NNN');
    assert.strictEqual(rec.id, 'LSN-001');

    // ts is ISO string
    assert.ok(rec.ts, 'ts should be present');
    assert.ok(!isNaN(Date.parse(rec.ts)), 'ts should be valid ISO date');

    // output contains the id
    assert.ok(result.output.includes('LSN-001'), `output should include 'LSN-001', got: ${result.output}`);
  });

  test('second append assigns LSN-002 (monotonic) and file has 2 lines', () => {
    runGsdTools(['lesson', 'append', '{"description":"first"}'], tmp);
    const result = runGsdTools(['lesson', 'append', '{"description":"second"}'], tmp);
    assert.ok(result.success, `second append failed: ${result.error}`);

    const records = readLessonsRaw(tmp);
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].id, 'LSN-001');
    assert.strictEqual(records[1].id, 'LSN-002');
    assert.ok(result.output.includes('LSN-002'));
  });
});

describe('lesson list', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('filters by --agent returns only matching rows', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'exec error', attributed_agent: 'gsd-executor', disposition: 'proposed', recurrence: 1 },
      { id: 'LSN-002', ts: new Date().toISOString(), description: 'plan gap', attributed_agent: 'gsd-planner', disposition: 'proposed', recurrence: 1 },
      { id: 'LSN-003', ts: new Date().toISOString(), description: 'exec missed', attributed_agent: 'gsd-executor', disposition: 'applied', recurrence: 2 },
    ]);

    const result = runGsdTools(['lesson', 'list', '--agent', 'gsd-executor', '--raw'], tmp);
    assert.ok(result.success, `list --agent failed: ${result.error}`);

    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.ok(lines.length >= 1, 'should have at least 1 result');
    for (const line of lines) {
      const rec = JSON.parse(line);
      assert.ok(rec.attributed_agent.startsWith('gsd-executor'), `unexpected agent: ${rec.attributed_agent}`);
    }
    assert.strictEqual(lines.length, 2, 'should return 2 executor records');
  });

  test('filters by --disposition returns only matching rows', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'a', attributed_agent: 'gsd-executor', disposition: 'proposed', recurrence: 1 },
      { id: 'LSN-002', ts: new Date().toISOString(), description: 'b', attributed_agent: 'gsd-planner', disposition: 'applied', recurrence: 1 },
      { id: 'LSN-003', ts: new Date().toISOString(), description: 'c', attributed_agent: 'gsd-verifier', disposition: 'proposed', recurrence: 1 },
    ]);

    const result = runGsdTools(['lesson', 'list', '--disposition', 'applied', '--raw'], tmp);
    assert.ok(result.success, `list --disposition failed: ${result.error}`);

    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 1);
    const rec = JSON.parse(lines[0]);
    assert.strictEqual(rec.disposition, 'applied');
    assert.strictEqual(rec.id, 'LSN-002');
  });

  test('--last 1 returns only 1 row', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'a', attributed_agent: 'gsd-executor', disposition: 'proposed', recurrence: 1 },
      { id: 'LSN-002', ts: new Date().toISOString(), description: 'b', attributed_agent: 'gsd-planner', disposition: 'proposed', recurrence: 1 },
      { id: 'LSN-003', ts: new Date().toISOString(), description: 'c', attributed_agent: 'gsd-verifier', disposition: 'proposed', recurrence: 1 },
    ]);

    const result = runGsdTools(['lesson', 'list', '--last', '1', '--raw'], tmp);
    assert.ok(result.success, `list --last failed: ${result.error}`);

    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 1);
    const rec = JSON.parse(lines[0]);
    assert.strictEqual(rec.id, 'LSN-003', 'last 1 should be the most recent');
  });
});

describe('lesson update', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('mutates disposition and commit in-place without changing line count', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'executor missed', attributed_agent: 'gsd-executor', disposition: 'proposed', recurrence: 1, commit: null },
    ]);

    const result = runGsdTools(
      ['lesson', 'update', 'LSN-001', '--disposition', 'applied', '--commit', 'abc1234'],
      tmp
    );
    assert.ok(result.success, `update failed: ${result.error}`);

    const records = readLessonsRaw(tmp);
    assert.strictEqual(records.length, 1, 'line count should be unchanged');
    assert.strictEqual(records[0].disposition, 'applied');
    assert.strictEqual(records[0].commit, 'abc1234');
    assert.strictEqual(records[0].id, 'LSN-001');
  });

  test('errors when id not found', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'x', disposition: 'proposed', recurrence: 1 },
    ]);

    const result = runGsdTools(['lesson', 'update', 'LSN-999', '--disposition', 'applied'], tmp);
    assert.ok(!result.success, 'should fail for missing id');
  });
});

describe('lesson bump-recurrence', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('increments recurrence counter in place', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'x', attributed_agent: 'gsd-executor', disposition: 'proposed', recurrence: 1 },
    ]);

    const result = runGsdTools(['lesson', 'bump-recurrence', 'LSN-001'], tmp);
    assert.ok(result.success, `bump-recurrence failed: ${result.error}`);

    const records = readLessonsRaw(tmp);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].recurrence, 2);
  });
});

describe('lesson attribute', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('resolves gsd-executor agent to agents/gsd-executor.md and path never starts with .claude/', () => {
    writeAgentTrace(tmp, [
      { ts_return: new Date().toISOString(), event: 'spawn', agent_type: 'gsd-executor', confidence: 'HIGH', seq: 1 },
    ]);

    const result = runGsdTools(['lesson', 'attribute', '--agent', 'gsd-executor', '--raw'], tmp);
    assert.ok(result.success, `attribute failed: ${result.error}`);

    const obj = JSON.parse(result.output);
    assert.strictEqual(obj.attributed_file, 'agents/gsd-executor.md');
    assert.ok(!obj.attributed_file.startsWith('.claude/'), 'attributed_file must NOT start with .claude/');
  });

  test('null/unknown agent resolves to common-bug-patterns.md', () => {
    writeAgentTrace(tmp, [
      { ts_return: new Date().toISOString(), event: 'spawn', agent_type: 'unknown-agent', confidence: 'LOW', seq: 1 },
    ]);

    const result = runGsdTools(['lesson', 'attribute', '--agent', 'unknown-xyz', '--raw'], tmp);
    assert.ok(result.success, `attribute fallback failed: ${result.error}`);

    const obj = JSON.parse(result.output);
    assert.strictEqual(obj.attributed_file, 'get-shit-done/references/common-bug-patterns.md');
    assert.ok(!obj.attributed_file.startsWith('.claude/'), 'fallback file must NOT start with .claude/');
  });

  test('writes nothing to lessons.jsonl (no file side-effects)', () => {
    writeAgentTrace(tmp, [
      { ts_return: new Date().toISOString(), event: 'spawn', agent_type: 'gsd-executor', confidence: 'HIGH', seq: 1 },
    ]);

    // lessons.jsonl should not exist before or after
    const lessonsBefore = fs.existsSync(lessonsFile(tmp));
    runGsdTools(['lesson', 'attribute', '--agent', 'gsd-executor', '--raw'], tmp);
    const lessonsAfter = fs.existsSync(lessonsFile(tmp));
    assert.strictEqual(lessonsBefore, false);
    assert.strictEqual(lessonsAfter, false, 'attribute should not create lessons.jsonl');
  });
});

describe('lesson scan', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('nominates records with recurrence>=3 and disposition!=applied only', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'executor keeps skipping validation step', attributed_agent: 'gsd-executor', disposition: 'proposed', recurrence: 3 },
      { id: 'LSN-002', ts: new Date().toISOString(), description: 'planner missing section already fixed', attributed_agent: 'gsd-planner', disposition: 'applied', recurrence: 1 },
    ]);

    const result = runGsdTools(['lesson', 'scan'], tmp);
    assert.ok(result.success, `scan failed: ${result.error}`);

    // Should contain LSN-001's description
    assert.ok(
      result.output.includes('executor keeps skipping validation step'),
      `scan should nominate high-recurrence non-applied record; got: ${result.output}`
    );
    // Should NOT contain the applied/low-recurrence record's description
    assert.ok(
      !result.output.includes('planner missing section already fixed'),
      `scan should NOT nominate applied record; got: ${result.output}`
    );
  });

  test('writes nothing to lessons.jsonl (ledger is byte-identical)', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'recurring issue', attributed_agent: 'gsd-executor', disposition: 'proposed', recurrence: 3 },
    ]);

    const before = fs.readFileSync(lessonsFile(tmp));
    runGsdTools(['lesson', 'scan'], tmp);
    const after = fs.readFileSync(lessonsFile(tmp));
    assert.ok(before.equals(after), 'scan should not modify lessons.jsonl');
  });

  test('prints no-nomination message when no records meet threshold', () => {
    writeLessons(tmp, [
      { id: 'LSN-001', ts: new Date().toISOString(), description: 'minor issue', attributed_agent: 'gsd-executor', disposition: 'proposed', recurrence: 1 },
    ]);

    const result = runGsdTools(['lesson', 'scan'], tmp);
    assert.ok(result.success, `scan failed: ${result.error}`);
    assert.ok(result.output.includes('No nominations'), `expected 'No nominations' message, got: ${result.output}`);
  });
});
