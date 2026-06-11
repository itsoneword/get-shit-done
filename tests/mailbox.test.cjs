/**
 * GSD Tools Tests — Mailbox (mailbox subcommand)
 *
 * Tests for: mailbox append, mailbox list
 * RED phase: lib/mailbox.cjs and the mailbox dispatch case do not yet exist.
 *
 * Requirements: LEDGER-01 (mailbox sibling), LEDGER-02 (mailbox sibling), LEDGER-03
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ── Fixture helpers ──────────────────────────────────────────────────────────

function runDir(tmp, runId) {
  return path.join(tmp, '.planning', 'run', runId);
}

function mailboxFile(tmp, runId) {
  return path.join(tmp, '.planning', 'run', runId, 'MAILBOX.jsonl');
}

/**
 * Initialize a run directory directly with fs (bypassing CLI) for seeding tests.
 * Mirrors the layout that `run init` creates.
 */
function initRunDir(tmp, runId) {
  const dir = runDir(tmp, runId);
  fs.mkdirSync(path.join(dir, 'parked'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'DECISIONS.jsonl'), '', 'utf8');
  fs.writeFileSync(mailboxFile(tmp, runId), '', 'utf8');
  fs.writeFileSync(
    path.join(dir, 'RUN-META.json'),
    JSON.stringify({ run_id: runId, started_ts: new Date().toISOString(), phases: [], status: 'running' }, null, 2) + '\n',
    'utf8'
  );
}

function readMailboxRaw(tmp, runId) {
  const f = mailboxFile(tmp, runId);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8')
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => JSON.parse(l));
}

// ── mailbox append — write & schema ─────────────────────────────────────────

describe('mailbox append - valid record', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('exits 0, prints q-NNN id, and MAILBOX.jsonl gains exactly one line', () => {
    const runId = 'mb-run-append-01';
    initRunDir(tmp, runId);

    const result = runGsdTools(
      ['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Proceed with X?' })],
      tmp
    );
    assert.ok(result.success, `mailbox append failed: ${result.error}`);

    // Output matches q-NNN
    assert.match(result.output, /^q-\d{3}$/, `output should be q-NNN, got: ${result.output}`);

    // Exactly one line in the file
    const records = readMailboxRaw(tmp, runId);
    assert.strictEqual(records.length, 1, 'should have exactly 1 record');
  });

  test('written record has auto-filled id (q-NNN), ISO ts, status open, run_id, and question', () => {
    const runId = 'mb-run-append-02';
    initRunDir(tmp, runId);

    const questionText = 'Proceed with X?';
    runGsdTools(
      ['mailbox', 'append', runId, '--data', JSON.stringify({ question: questionText })],
      tmp
    );

    const records = readMailboxRaw(tmp, runId);
    assert.strictEqual(records.length, 1);
    const rec = records[0];

    // id format q-NNN
    assert.match(rec.id, /^q-\d{3}$/, `id should match q-NNN, got: ${rec.id}`);

    // ts is valid ISO date
    assert.ok(rec.ts, 'ts should be set');
    assert.ok(!isNaN(Date.parse(rec.ts)), 'ts should be a valid ISO date');

    // status defaults to 'open'
    assert.strictEqual(rec.status, 'open', 'status should default to open');

    // run_id matches arg
    assert.strictEqual(rec.run_id, runId, 'run_id should match the run-id arg');

    // question matches input
    assert.strictEqual(rec.question, questionText, 'question should match input');
  });

  test('second append assigns q-002 (monotonic) and file has 2 lines', () => {
    const runId = 'mb-run-append-03';
    initRunDir(tmp, runId);

    runGsdTools(
      ['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'First question?' })],
      tmp
    );
    const result2 = runGsdTools(
      ['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Second question?' })],
      tmp
    );
    assert.ok(result2.success, `second append failed: ${result2.error}`);

    const records = readMailboxRaw(tmp, runId);
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].id, 'q-001');
    assert.strictEqual(records[1].id, 'q-002');
  });
});

// ── mailbox append — missing required fields ─────────────────────────────────

describe('mailbox append - missing required fields', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('missing question field: exits non-zero, stderr contains "missing required fields" and "question", file gains zero lines', () => {
    const runId = 'mb-run-missing-question';
    initRunDir(tmp, runId);
    const linesBefore = readMailboxRaw(tmp, runId).length;

    const result = runGsdTools(
      ['mailbox', 'append', runId, '--data', JSON.stringify({ context: 'some context' })],
      tmp
    );
    assert.ok(!result.success, 'should fail for missing question');
    assert.ok(
      result.error.includes('missing required fields'),
      `stderr should contain "missing required fields", got: ${result.error}`
    );
    assert.ok(
      result.error.includes('question'),
      `stderr should name the missing field "question", got: ${result.error}`
    );

    const linesAfter = readMailboxRaw(tmp, runId).length;
    assert.strictEqual(linesAfter, linesBefore, 'file should gain zero lines');
  });

  test('missing question with empty object: exits non-zero, stderr mentions "question", file unchanged', () => {
    const runId = 'mb-run-empty-data';
    initRunDir(tmp, runId);

    const result = runGsdTools(
      ['mailbox', 'append', runId, '--data', '{}'],
      tmp
    );
    assert.ok(!result.success, 'should fail for empty data (missing question)');
    assert.ok(
      result.error.includes('missing required fields'),
      `stderr should contain "missing required fields", got: ${result.error}`
    );
    assert.ok(
      result.error.includes('question'),
      `stderr should name "question", got: ${result.error}`
    );

    const records = readMailboxRaw(tmp, runId);
    assert.strictEqual(records.length, 0, 'file should gain zero lines');
  });
});

// ── mailbox append — run-context gate ────────────────────────────────────────

describe('mailbox append - run-context gate', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('no GSD_RUN_ID env and no run-id arg: exits non-zero, stderr names missing context, writes nothing', () => {
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;

    const result = runGsdTools(
      ['mailbox', 'append', '--data', JSON.stringify({ question: 'Q?' })],
      tmp,
      { env: envWithout }
    );
    assert.ok(!result.success, 'should fail with no run context');
    assert.ok(
      result.error.includes('GSD_RUN_ID') || result.error.includes('run context') || result.error.includes('run-id'),
      `stderr should name the missing context, got: ${result.error}`
    );

    // No run dir should have been created
    const runDirBase = path.join(tmp, '.planning', 'run');
    if (fs.existsSync(runDirBase)) {
      const subdirs = fs.readdirSync(runDirBase);
      assert.strictEqual(subdirs.length, 0, 'no run subdirs should have been created');
    }
  });

  test('uninitialized run-id: exits non-zero, stderr contains "not initialized", writes nothing', () => {
    const runId = 'nonexistent-mb-run-xyz';
    const result = runGsdTools(
      ['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q?' })],
      tmp
    );
    assert.ok(!result.success, 'should fail for uninitialized run');
    assert.ok(
      result.error.includes('not initialized'),
      `stderr should contain "not initialized", got: ${result.error}`
    );

    // Run dir should not exist
    assert.ok(!fs.existsSync(runDir(tmp, runId)), 'run dir should not have been created');
  });

  test('GSD_RUN_ID env fallback: succeeds when run dir is initialized and no explicit run-id arg given', () => {
    const runId = 'mb-env-run-001';
    initRunDir(tmp, runId);

    // Pass GSD_RUN_ID via env, no run-id as CLI arg
    const envWith = { ...process.env, GSD_RUN_ID: runId };
    const result = runGsdTools(
      ['mailbox', 'append', '--data', JSON.stringify({ question: 'Env fallback question?' })],
      tmp,
      { env: envWith }
    );
    assert.ok(result.success, `env fallback should succeed: ${result.error}`);
    assert.match(result.output, /^q-\d{3}$/, `output should be q-NNN, got: ${result.output}`);

    const records = readMailboxRaw(tmp, runId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].run_id, runId);
  });
});

// ── mailbox list / filter — LEDGER-02 ────────────────────────────────────────

describe('mailbox list and filter', () => {
  let tmp;
  const runId = 'mb-list-test-run';

  beforeEach(() => {
    tmp = createTempProject();
    // Seed 3 records: 2 open, 1 answered
    initRunDir(tmp, runId);
    const records = [
      {
        id: 'q-001', ts: new Date().toISOString(), run_id: runId,
        phase: null, decision_id: null, context: null, options: null, evidence: null,
        status: 'open', question: 'First question?', answer: null, answered_ts: null,
      },
      {
        id: 'q-002', ts: new Date().toISOString(), run_id: runId,
        phase: null, decision_id: null, context: null, options: null, evidence: null,
        status: 'open', question: 'Second question?', answer: null, answered_ts: null,
      },
      {
        id: 'q-003', ts: new Date().toISOString(), run_id: runId,
        phase: null, decision_id: null, context: null, options: null, evidence: null,
        status: 'answered', question: 'Third question?', answer: 'Yes, proceed', answered_ts: new Date().toISOString(),
      },
    ];
    const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(mailboxFile(tmp, runId), lines, 'utf8');
  });

  afterEach(() => { cleanup(tmp); });

  test('mailbox list <run-id> --raw prints 3 JSON lines', () => {
    const result = runGsdTools(['mailbox', 'list', runId, '--raw'], tmp);
    assert.ok(result.success, `mailbox list failed: ${result.error}`);

    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 3, `expected 3 records, got ${lines.length}`);
    for (const line of lines) {
      const obj = JSON.parse(line); // must be valid JSON
      assert.ok(obj.id, 'each line should have an id');
    }
  });

  test('mailbox list <run-id> --status open --raw prints exactly 2 open records', () => {
    const result = runGsdTools(['mailbox', 'list', runId, '--status', 'open', '--raw'], tmp);
    assert.ok(result.success, `mailbox list --status open failed: ${result.error}`);

    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 2, `expected 2 open records, got ${lines.length}`);
    for (const line of lines) {
      const obj = JSON.parse(line);
      assert.strictEqual(obj.status, 'open', `all returned records should have status=open, got: ${obj.status}`);
    }
  });
});
