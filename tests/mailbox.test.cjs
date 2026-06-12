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
const { runGsdTools, createTempProject, cleanup, runGsdToolsWithInput } = require('./helpers.cjs');

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

// ── mailbox answer ────────────────────────────────────────────────────────────

describe('mailbox answer - targeted record update', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('exits 0, prints q-001, sets status=answered/answer/answered_ts, leaves q-002 unchanged', () => {
    const runId = 'mb-ans-01';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q one?', phase: 3 })], tmp);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q two?', phase: 4 })], tmp);

    const result = runGsdTools(['mailbox', 'answer', runId, '--id', 'q-001', '--answer', 'Use Redis'], tmp);
    assert.ok(result.success, `mailbox answer failed: ${result.error}`);
    assert.ok(result.output.includes('q-001'), `stdout should contain q-001, got: ${result.output}`);

    const records = readMailboxRaw(tmp, runId);
    assert.strictEqual(records.length, 2, 'file should still have exactly 2 lines');
    assert.strictEqual(records[0].id, 'q-001', 'first record should be q-001');
    assert.strictEqual(records[0].status, 'answered');
    assert.strictEqual(records[0].answer, 'Use Redis');
    assert.match(records[0].answered_ts, /^\d{4}-\d{2}-\d{2}T/);
    // q-002 untouched
    assert.strictEqual(records[1].id, 'q-002');
    assert.strictEqual(records[1].status, 'open');
    assert.strictEqual(records[1].answer, null);
  });

  test('nonexistent id exits 1, stderr contains "not found"', () => {
    const runId = 'mb-ans-02';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q?' })], tmp);

    const result = runGsdTools(['mailbox', 'answer', runId, '--id', 'q-999', '--answer', 'X'], tmp);
    assert.ok(!result.success, 'should exit non-zero for unknown id');
    assert.ok(result.error.includes('not found'), `stderr should contain "not found", got: ${result.error}`);
  });

  test('missing --id or --answer exits 1, stderr contains usage text', () => {
    const runId = 'mb-ans-03';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q?' })], tmp);

    const res1 = runGsdTools(['mailbox', 'answer', runId, '--answer', 'X'], tmp);
    assert.ok(!res1.success, 'should fail without --id');
    assert.ok(
      res1.error.includes('--id') && res1.error.includes('--answer'),
      `stderr should contain --id and --answer usage, got: ${res1.error}`
    );

    const res2 = runGsdTools(['mailbox', 'answer', runId, '--id', 'q-001'], tmp);
    assert.ok(!res2.success, 'should fail without --answer');
    assert.ok(
      res2.error.includes('--id') && res2.error.includes('--answer'),
      `stderr should contain --id and --answer usage, got: ${res2.error}`
    );
  });

  test('no run-id arg and no GSD_RUN_ID env exits 1, stderr contains "no run context"', () => {
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;

    const result = runGsdTools(['mailbox', 'answer', '--id', 'q-001', '--answer', 'X'], tmp, { env: envWithout });
    assert.ok(!result.success, 'should fail without run context');
    assert.ok(result.error.includes('no run context'), `stderr should contain "no run context", got: ${result.error}`);
  });

  test('GSD_RUN_ID env fallback: exits 0 when run dir initialized and no run-id arg', () => {
    const runId = 'mb-ans-env-01';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Env Q?' })], tmp);

    const envWith = { ...process.env, GSD_RUN_ID: runId };
    const result = runGsdTools(['mailbox', 'answer', '--id', 'q-001', '--answer', 'via env'], tmp, { env: envWith });
    assert.ok(result.success, `env fallback should succeed: ${result.error}`);
  });

  test('re-answering an already-answered question exits 1, stderr contains "already answered"', () => {
    const runId = 'mb-ans-04';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q?' })], tmp);
    runGsdTools(['mailbox', 'answer', runId, '--id', 'q-001', '--answer', 'First'], tmp);

    const result = runGsdTools(['mailbox', 'answer', runId, '--id', 'q-001', '--answer', 'Second'], tmp);
    assert.ok(!result.success, 'should exit non-zero when re-answering');
    assert.ok(result.error.includes('already answered'), `stderr should contain "already answered", got: ${result.error}`);
  });
});

// ── mailbox review ────────────────────────────────────────────────────────────

describe('mailbox review - interactive loop', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('answers 2 questions, skips 1 empty-stdin, ignores pre-answered; summary says answered:2 skipped:1', () => {
    const runId = 'mb-rev-01';
    initRunDir(tmp, runId);
    // Two open via plain append
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Open one?' })], tmp);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Open two?' })], tmp);
    // One pending via explicit status
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Pending three?', status: 'pending' })], tmp);
    // One pre-answered: write directly
    const answeredRec = {
      id: 'q-004', ts: new Date().toISOString(), run_id: runId,
      phase: null, decision_id: null, context: null, options: null, evidence: null,
      status: 'answered', question: 'Already answered?', answer: 'yes', answered_ts: new Date().toISOString(),
    };
    fs.appendFileSync(mailboxFile(tmp, runId), JSON.stringify(answeredRec) + '\n', 'utf8');

    const result = runGsdToolsWithInput(['mailbox', 'review', runId], tmp, 'first answer\nsecond answer\n\n');
    assert.ok(result.success, `mailbox review failed: ${result.error}`);

    // Presented 3 unanswered, not the pre-answered
    assert.ok(result.output.includes('Open one?'), 'stdout should contain first question');
    assert.ok(result.output.includes('Open two?'), 'stdout should contain second question');
    assert.ok(result.output.includes('Pending three?'), 'stdout should contain pending question');
    assert.ok(!result.output.includes('Already answered?'), 'stdout should NOT contain pre-answered question');

    // Records updated correctly
    const records = readMailboxRaw(tmp, runId);
    assert.strictEqual(records[0].status, 'answered');
    assert.strictEqual(records[0].answer, 'first answer');
    assert.strictEqual(records[1].status, 'answered');
    assert.strictEqual(records[1].answer, 'second answer');
    // q-003 (empty line = skip) keeps its prior status
    assert.notStrictEqual(records[2].status, 'answered');
    // q-004 still answered
    assert.strictEqual(records[3].status, 'answered');

    // Summary line
    assert.ok(result.output.includes('answered: 2'), `stdout should contain "answered: 2", got: ${result.output}`);
    assert.ok(result.output.includes('skipped: 1'), `stdout should contain "skipped: 1", got: ${result.output}`);
  });

  test('context, options, evidence are presented inline', () => {
    const runId = 'mb-rev-ctx-01';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({
      question: 'Which db?',
      context: 'We need a relational store',
      options: ['postgres', 'sqlite'],
      evidence: 'Benchmarks show postgres wins',
    })], tmp);

    const result = runGsdToolsWithInput(['mailbox', 'review', runId], tmp, 'postgres\n');
    assert.ok(result.success, `review with context failed: ${result.error}`);
    assert.ok(result.output.includes('We need a relational store'), 'context should appear');
    assert.ok(result.output.includes('postgres'), 'options should appear');
    assert.ok(result.output.includes('sqlite'), 'options should appear');
    assert.ok(result.output.includes('Benchmarks show postgres wins'), 'evidence should appear');
  });

  test('zero unanswered questions exits 0, stdout contains "no pending questions"', () => {
    const runId = 'mb-rev-empty-01';
    initRunDir(tmp, runId);
    // All answered
    const rec = {
      id: 'q-001', ts: new Date().toISOString(), run_id: runId,
      phase: null, decision_id: null, context: null, options: null, evidence: null,
      status: 'answered', question: 'Done?', answer: 'yes', answered_ts: new Date().toISOString(),
    };
    fs.appendFileSync(mailboxFile(tmp, runId), JSON.stringify(rec) + '\n', 'utf8');

    const result = runGsdToolsWithInput(['mailbox', 'review', runId], tmp, '');
    assert.ok(result.success, `review with no pending should succeed: ${result.error}`);
    assert.ok(result.output.includes('no pending questions'), `stdout should say no pending, got: ${result.output}`);
  });

  test('both open and pending statuses are presented (explicit assertion on pending)', () => {
    const runId = 'mb-rev-statuses-01';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Open question?' })], tmp);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Pending question?', status: 'pending' })], tmp);

    const result = runGsdToolsWithInput(['mailbox', 'review', runId], tmp, 'ans1\nans2\n');
    assert.ok(result.success, `review should handle open+pending: ${result.error}`);
    assert.ok(result.output.includes('Pending question?'), 'pending status question should appear in review');
    assert.ok(result.output.includes('Open question?'), 'open status question should appear in review');
  });
});

// ── Resume handoff ────────────────────────────────────────────────────────────

describe('mailbox answer/review - resume handoff', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  function writeSnapshot(tmp, runId, phase) {
    const parkedDir = path.join(tmp, '.planning', 'run', runId, 'parked');
    fs.mkdirSync(parkedDir, { recursive: true });
    const snap = {
      phase,
      blocked_at: 'x',
      question_id: 'q-001',
      phase_dir: null,
      context_path: null,
      resume_instruction: `Resume discuss-phase --auto for phase ${phase}`,
      content_hashes: { 'STATE.md': null, 'ROADMAP.md': null, 'cross-phase-notes.md': null, 'CONTEXT.md': null },
      git_head: null,
      ts: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(parkedDir, `phase-${phase}.json`),
      JSON.stringify(snap, null, 2) + '\n',
      'utf8'
    );
  }

  test('mailbox answer: snapshot present -> stdout contains "Resume handoff" and resume_instruction', () => {
    const runId = 'mb-handoff-ans-01';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Park q?', phase: 5 })], tmp);
    writeSnapshot(tmp, runId, 5);

    const result = runGsdTools(['mailbox', 'answer', runId, '--id', 'q-001', '--answer', 'Done'], tmp);
    assert.ok(result.success, `answer with snapshot failed: ${result.error}`);
    assert.ok(result.output.includes('Resume handoff'), `stdout should contain "Resume handoff", got: ${result.output}`);
    assert.ok(
      result.output.includes('Resume discuss-phase --auto for phase 5'),
      `stdout should contain resume instruction, got: ${result.output}`
    );
  });

  test('mailbox review: snapshot present -> stdout contains "Resume handoff" and resume_instruction', () => {
    const runId = 'mb-handoff-rev-01';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Park q review?', phase: 5 })], tmp);
    writeSnapshot(tmp, runId, 5);

    const result = runGsdToolsWithInput(['mailbox', 'review', runId], tmp, 'done\n');
    assert.ok(result.success, `review with snapshot failed: ${result.error}`);
    assert.ok(result.output.includes('Resume handoff'), `stdout should contain "Resume handoff", got: ${result.output}`);
    assert.ok(
      result.output.includes('Resume discuss-phase --auto for phase 5'),
      `stdout should contain resume instruction, got: ${result.output}`
    );
  });

  test('mailbox answer: no snapshot -> stdout does NOT contain "Resume handoff"', () => {
    const runId = 'mb-handoff-nosnap-01';
    initRunDir(tmp, runId);
    // Question with phase 7 but no snapshot file
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'No snap q?', phase: 7 })], tmp);

    const result = runGsdTools(['mailbox', 'answer', runId, '--id', 'q-001', '--answer', 'ok'], tmp);
    assert.ok(result.success, `answer without snapshot should succeed: ${result.error}`);
    assert.ok(!result.output.includes('Resume handoff'), `stdout should NOT contain "Resume handoff" when no snapshot, got: ${result.output}`);
  });
});

// ── Append-path invariant after rewrite ───────────────────────────────────────

describe('mailbox append-path invariant after answer rewrite', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('after answer rewrite, two further appends each add exactly one line and answered record survives', () => {
    const runId = 'mb-inv-01';
    initRunDir(tmp, runId);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q one?' })], tmp);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q two?' })], tmp);

    // Answer q-001 (triggers full-file rewrite)
    const ansResult = runGsdTools(['mailbox', 'answer', runId, '--id', 'q-001', '--answer', 'Use Redis'], tmp);
    assert.ok(ansResult.success, `answer failed: ${ansResult.error}`);

    const countAfterAnswer = readMailboxRaw(tmp, runId).length;

    // Two further appends
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q three?' })], tmp);
    runGsdTools(['mailbox', 'append', runId, '--data', JSON.stringify({ question: 'Q four?' })], tmp);

    const records = readMailboxRaw(tmp, runId);
    assert.strictEqual(records.length, countAfterAnswer + 2, `expected ${countAfterAnswer + 2} records, got ${records.length}`);

    // Answered record's fields survive intact
    const answered = records.find(r => r.id === 'q-001');
    assert.ok(answered, 'q-001 should still exist');
    assert.strictEqual(answered.status, 'answered');
    assert.strictEqual(answered.answer, 'Use Redis');
    assert.match(answered.answered_ts, /^\d{4}-\d{2}-\d{2}T/);
  });
});
