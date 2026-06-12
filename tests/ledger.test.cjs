/**
 * GSD Tools Tests — Decision Ledger (ledger + run subcommands)
 *
 * Tests for: run init, ledger append, ledger list, ledger filter
 * RED phase: lib/ledger.cjs and the dispatch cases do not yet exist.
 *
 * Requirements: LEDGER-01 (schema at write), LEDGER-02 (list/filter), LEDGER-03 (run-context gate)
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

function decisionsFile(tmp, runId) {
  return path.join(tmp, '.planning', 'run', runId, 'DECISIONS.jsonl');
}

function mailboxFile(tmp, runId) {
  return path.join(tmp, '.planning', 'run', runId, 'MAILBOX.jsonl');
}

function metaFile(tmp, runId) {
  return path.join(tmp, '.planning', 'run', runId, 'RUN-META.json');
}

/**
 * Initialize a run directory directly with fs (bypassing CLI) for seeding tests.
 */
function initRunDir(tmp, runId) {
  const dir = runDir(tmp, runId);
  fs.mkdirSync(path.join(dir, 'parked'), { recursive: true });
  fs.writeFileSync(decisionsFile(tmp, runId), '', 'utf8');
  fs.writeFileSync(mailboxFile(tmp, runId), '', 'utf8');
  fs.writeFileSync(
    metaFile(tmp, runId),
    JSON.stringify({ run_id: runId, started_ts: new Date().toISOString(), phases: [], status: 'running' }, null, 2) + '\n',
    'utf8'
  );
}

/**
 * Write decision records directly into DECISIONS.jsonl (for list/filter tests).
 */
function writeDecisions(tmp, runId, records) {
  initRunDir(tmp, runId);
  const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(decisionsFile(tmp, runId), lines, 'utf8');
}

function readDecisionsRaw(tmp, runId) {
  const f = decisionsFile(tmp, runId);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8')
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => JSON.parse(l));
}

const VALID_RECORD = JSON.stringify({
  decision: 'use appendFileSync',
  alternatives: ['writeFileSync', 'streams'],
  evidence: 'append-only guarantees audit trail',
  confidence: 'STRONG',
  escalated: false,
});

// ── run init ─────────────────────────────────────────────────────────────────

describe('run init', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('creates DECISIONS.jsonl, MAILBOX.jsonl, RUN-META.json, and parked/ dir', () => {
    const runId = 'test-run-001';
    const result = runGsdTools(['run', 'init', runId], tmp);
    assert.ok(result.success, `run init failed: ${result.error}`);

    // DECISIONS.jsonl exists (empty file)
    assert.ok(fs.existsSync(decisionsFile(tmp, runId)), 'DECISIONS.jsonl should exist');

    // MAILBOX.jsonl exists (empty file)
    assert.ok(fs.existsSync(mailboxFile(tmp, runId)), 'MAILBOX.jsonl should exist');

    // RUN-META.json exists and has valid JSON
    assert.ok(fs.existsSync(metaFile(tmp, runId)), 'RUN-META.json should exist');
    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.strictEqual(meta.run_id, runId);
    assert.ok(meta.started_ts, 'started_ts should be set');
    assert.ok(!isNaN(Date.parse(meta.started_ts)), 'started_ts should be valid ISO date');
    assert.deepStrictEqual(meta.phases, []);
    assert.strictEqual(meta.status, 'running');

    // parked/ subdir exists
    assert.ok(fs.existsSync(path.join(runDir(tmp, runId), 'parked')), 'parked/ dir should exist');
    assert.ok(fs.statSync(path.join(runDir(tmp, runId), 'parked')).isDirectory(), 'parked/ should be a directory');
  });

  test('exits non-zero with stderr mentioning run-id required when no run-id arg', () => {
    // No run-id arg, no GSD_RUN_ID env
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;
    const result = runGsdTools(['run', 'init'], tmp, { env: envWithout });
    assert.ok(!result.success, 'should fail with no run-id');
    assert.ok(
      result.error.toLowerCase().includes('run-id') || result.error.toLowerCase().includes('required'),
      `stderr should mention run-id required, got: ${result.error}`
    );
  });
});

// ── ledger append — LEDGER-01 (schema at write) ───────────────────────────────

describe('ledger append - valid record', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('exits 0, prints dec-NNN id, and DECISIONS.jsonl gains exactly one line', () => {
    const runId = 'test-run-append-01';
    initRunDir(tmp, runId);

    const result = runGsdTools(['ledger', 'append', runId, '--data', VALID_RECORD], tmp);
    assert.ok(result.success, `ledger append failed: ${result.error}`);

    // Output matches dec-NNN
    assert.match(result.output, /^dec-\d{3}$/, `output should be dec-NNN, got: ${result.output}`);

    // Exactly one line in the file
    const records = readDecisionsRaw(tmp, runId);
    assert.strictEqual(records.length, 1, 'should have exactly 1 record');
  });

  test('written record has auto-filled id (dec-NNN), ISO ts, and correct required fields', () => {
    const runId = 'test-run-append-02';
    initRunDir(tmp, runId);

    const input = JSON.parse(VALID_RECORD);
    runGsdTools(['ledger', 'append', runId, '--data', VALID_RECORD], tmp);

    const records = readDecisionsRaw(tmp, runId);
    assert.strictEqual(records.length, 1);
    const rec = records[0];

    // id format
    assert.match(rec.id, /^dec-\d{3}$/, `id should match dec-NNN, got: ${rec.id}`);

    // ts is valid ISO date
    assert.ok(rec.ts, 'ts should be set');
    assert.ok(!isNaN(Date.parse(rec.ts)), 'ts should be a valid ISO date');

    // required fields match input
    assert.strictEqual(rec.decision, input.decision);
    assert.deepStrictEqual(rec.alternatives, input.alternatives);
    assert.strictEqual(rec.evidence, input.evidence);
    assert.strictEqual(rec.confidence, input.confidence);
    assert.strictEqual(rec.escalated, input.escalated);
  });

  test('second append assigns dec-002 (monotonic) and file has 2 lines', () => {
    const runId = 'test-run-append-03';
    initRunDir(tmp, runId);

    runGsdTools(['ledger', 'append', runId, '--data', VALID_RECORD], tmp);
    const result2 = runGsdTools(['ledger', 'append', runId, '--data', VALID_RECORD], tmp);
    assert.ok(result2.success, `second append failed: ${result2.error}`);

    const records = readDecisionsRaw(tmp, runId);
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].id, 'dec-001');
    assert.strictEqual(records[1].id, 'dec-002');
  });

  test('record with escalated: null is accepted (null is allowed)', () => {
    const runId = 'test-run-append-null';
    initRunDir(tmp, runId);

    const withNull = JSON.stringify({
      decision: 'proceed',
      alternatives: [],
      evidence: 'no evaluator ran',
      confidence: 'MEDIUM',
      escalated: null,
    });

    const result = runGsdTools(['ledger', 'append', runId, '--data', withNull], tmp);
    assert.ok(result.success, `append with escalated:null should succeed: ${result.error}`);

    const records = readDecisionsRaw(tmp, runId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].escalated, null);
  });
});

// ── ledger append — LEDGER-01 required-field validation ──────────────────────

describe('ledger append - missing required fields', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('missing decision field: exits non-zero, stderr contains "missing required fields" and "decision", file unchanged', () => {
    const runId = 'test-run-missing-decision';
    initRunDir(tmp, runId);
    const linesBefore = readDecisionsRaw(tmp, runId).length;

    const noDecision = JSON.stringify({
      alternatives: [],
      evidence: 'something',
      confidence: 'STRONG',
      escalated: false,
    });

    const result = runGsdTools(['ledger', 'append', runId, '--data', noDecision], tmp);
    assert.ok(!result.success, 'should fail for missing decision');
    assert.ok(
      result.error.includes('missing required fields'),
      `stderr should contain "missing required fields", got: ${result.error}`
    );
    assert.ok(
      result.error.includes('decision'),
      `stderr should name the missing field "decision", got: ${result.error}`
    );

    const linesAfter = readDecisionsRaw(tmp, runId).length;
    assert.strictEqual(linesAfter, linesBefore, 'file should gain zero lines');
  });

  test('missing confidence field: exits non-zero, stderr mentions "confidence", file unchanged', () => {
    const runId = 'test-run-missing-confidence';
    initRunDir(tmp, runId);

    const noConfidence = JSON.stringify({
      decision: 'do something',
      alternatives: [],
      evidence: 'yes',
      escalated: false,
    });

    const result = runGsdTools(['ledger', 'append', runId, '--data', noConfidence], tmp);
    assert.ok(!result.success, 'should fail for missing confidence');
    assert.ok(
      result.error.includes('missing required fields'),
      `stderr should contain "missing required fields", got: ${result.error}`
    );
    assert.ok(
      result.error.includes('confidence'),
      `stderr should name the missing field "confidence", got: ${result.error}`
    );

    const records = readDecisionsRaw(tmp, runId);
    assert.strictEqual(records.length, 0, 'file should gain zero lines');
  });
});

// ── ledger append — LEDGER-03 run-context gate ────────────────────────────────

describe('ledger append - run-context gate', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('no GSD_RUN_ID env and no run-id arg: exits non-zero, stderr names missing context, file not created', () => {
    // Strip GSD_RUN_ID from env
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;

    const result = runGsdTools(['ledger', 'append', '--data', VALID_RECORD], tmp, { env: envWithout });
    assert.ok(!result.success, 'should fail with no run context');
    assert.ok(
      result.error.includes('GSD_RUN_ID') || result.error.includes('run context') || result.error.includes('run-id'),
      `stderr should name the missing context, got: ${result.error}`
    );

    // No run dir should have been created
    const runDirBase = path.join(tmp, '.planning', 'run');
    const runDirExists = fs.existsSync(runDirBase);
    if (runDirExists) {
      // There might be no subdirs; ensure no DECISIONS.jsonl was created
      const subdirs = fs.readdirSync(runDirBase);
      assert.strictEqual(subdirs.length, 0, 'no run subdirs should have been created');
    }
  });

  test('uninitialized run-id: exits non-zero, stderr contains "not initialized", writes nothing', () => {
    const runId = 'nonexistent-run-xyz';
    const result = runGsdTools(['ledger', 'append', runId, '--data', VALID_RECORD], tmp);
    assert.ok(!result.success, 'should fail for uninitialized run');
    assert.ok(
      result.error.includes('not initialized'),
      `stderr should contain "not initialized", got: ${result.error}`
    );

    // Run dir should not exist
    assert.ok(!fs.existsSync(runDir(tmp, runId)), 'run dir should not have been created');
  });

  test('GSD_RUN_ID env fallback: succeeds when run dir is initialized and no explicit run-id arg given', () => {
    const runId = 'env-run-001';
    initRunDir(tmp, runId);

    // Pass GSD_RUN_ID via env, no run-id as CLI arg
    const envWith = { ...process.env, GSD_RUN_ID: runId };
    const result = runGsdTools(['ledger', 'append', '--data', VALID_RECORD], tmp, { env: envWith });
    assert.ok(result.success, `env fallback should succeed: ${result.error}`);
    assert.match(result.output, /^dec-\d{3}$/, `output should be dec-NNN, got: ${result.output}`);

    const records = readDecisionsRaw(tmp, runId);
    assert.strictEqual(records.length, 1);
  });
});

// ── ledger list / filter — LEDGER-02 ─────────────────────────────────────────

describe('ledger list and filter', () => {
  let tmp;
  const runId = 'list-test-run';

  beforeEach(() => {
    tmp = createTempProject();
    // Seed 3 records: phase 1 escalated:true, phase 2 escalated:false, phase 1 escalated:null
    writeDecisions(tmp, runId, [
      {
        id: 'dec-001', ts: new Date().toISOString(),
        decision: 'first', alternatives: [], evidence: 'e1',
        confidence: 'STRONG', escalated: true, phase: 1,
        context: null, question: null, escalation_verdict: null, escalation_reason: null,
      },
      {
        id: 'dec-002', ts: new Date().toISOString(),
        decision: 'second', alternatives: [], evidence: 'e2',
        confidence: 'MEDIUM', escalated: false, phase: 2,
        context: null, question: null, escalation_verdict: null, escalation_reason: null,
      },
      {
        id: 'dec-003', ts: new Date().toISOString(),
        decision: 'third', alternatives: [], evidence: 'e3',
        confidence: 'WEAK', escalated: null, phase: 1,
        context: null, question: null, escalation_verdict: null, escalation_reason: null,
      },
    ]);
  });

  afterEach(() => { cleanup(tmp); });

  test('ledger list <run-id> --raw prints 3 JSON lines', () => {
    const result = runGsdTools(['ledger', 'list', runId, '--raw'], tmp);
    assert.ok(result.success, `ledger list failed: ${result.error}`);

    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 3, `expected 3 records, got ${lines.length}`);
    for (const line of lines) {
      const obj = JSON.parse(line); // must be valid JSON
      assert.ok(obj.id, 'each line should have an id');
    }
  });

  test('ledger filter <run-id> --phase 1 --raw returns only the 2 phase-1 records', () => {
    const result = runGsdTools(['ledger', 'filter', runId, '--phase', '1', '--raw'], tmp);
    assert.ok(result.success, `ledger filter --phase failed: ${result.error}`);

    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 2, `expected 2 phase-1 records, got ${lines.length}`);
    for (const line of lines) {
      const obj = JSON.parse(line);
      assert.strictEqual(obj.phase, 1, `all returned records should have phase=1, got: ${obj.phase}`);
    }
  });

  test('ledger filter <run-id> --escalated --raw returns only the 1 escalated:true record', () => {
    const result = runGsdTools(['ledger', 'filter', runId, '--escalated', '--raw'], tmp);
    assert.ok(result.success, `ledger filter --escalated failed: ${result.error}`);

    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 1, `expected 1 escalated record, got ${lines.length}`);
    const obj = JSON.parse(lines[0]);
    assert.strictEqual(obj.escalated, true, 'only escalated:true should be returned (not null or false)');
    assert.strictEqual(obj.id, 'dec-001');
  });
});

// ── run report ───────────────────────────────────────────────────────────────

describe('run report', () => {
  let tmp;
  const runId = 'report-run-001';
  const STARTED_TS = '2026-06-12T22:00:00.000Z';

  function seedFixtures(dir, rId) {
    initRunDir(dir, rId);

    // Overwrite RUN-META.json with the full fixture
    const meta = {
      run_id: rId,
      started_ts: STARTED_TS,
      status: 'stopped',
      stopped_reason: 'no-independent-work',
      phases: [
        { phase: 13, status: 'completed', worktree: 'overnight-phase-13', merge_clean: true, started_ts: null, ended_ts: null, reason: null },
        { phase: 14, status: 'parked', worktree: null, merge_clean: null, started_ts: null, ended_ts: null, reason: null },
        { phase: 15, status: 'failed', worktree: null, merge_clean: null, started_ts: null, ended_ts: null, reason: 'gaps_found' },
      ],
    };
    fs.writeFileSync(path.join(dir, '.planning', 'run', rId, 'RUN-META.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

    // DECISIONS.jsonl: 5 decisions, 2 escalated
    const decisions = [
      { id: 'dec-001', ts: '2026-06-12T22:01:00.000Z', phase: 13, decision: 'use appendFileSync', alternatives: [], evidence: 'e1', confidence: 'STRONG', escalated: true },
      { id: 'dec-002', ts: '2026-06-12T22:02:00.000Z', phase: 13, decision: 'use worktrees', alternatives: [], evidence: 'e2', confidence: 'STRONG', escalated: false },
      { id: 'dec-003', ts: '2026-06-12T22:03:00.000Z', phase: 14, decision: 'park irreversible action', alternatives: [], evidence: 'e3', confidence: 'MEDIUM', escalated: true },
      { id: 'dec-004', ts: '2026-06-12T22:04:00.000Z', phase: 14, decision: 'proceed with write', alternatives: [], evidence: 'e4', confidence: 'WEAK', escalated: false },
      { id: 'dec-005', ts: '2026-06-12T22:05:00.000Z', phase: 15, decision: 'skip to independent', alternatives: [], evidence: 'e5', confidence: 'MEDIUM', escalated: false },
    ];
    fs.writeFileSync(
      path.join(dir, '.planning', 'run', rId, 'DECISIONS.jsonl'),
      decisions.map(d => JSON.stringify(d)).join('\n') + '\n',
      'utf8'
    );

    // MAILBOX.jsonl: 3 questions, 1 answered, 2 unanswered
    const questions = [
      { id: 'q-001', run_id: rId, phase: 13, question: 'Is merge clean?', context: 'phase 13 context', status: 'answered', answer: 'yes', answered_ts: '2026-06-12T23:00:00.000Z', ts: '2026-06-12T22:06:00.000Z' },
      { id: 'q-002', run_id: rId, phase: 14, question: 'Merge conflict in phase 14', context: 'phase 14 context', status: 'pending', answer: null, answered_ts: null, ts: '2026-06-12T22:07:00.000Z' },
      { id: 'q-003', run_id: rId, phase: 15, question: 'Gaps found in phase 15 — resolve before proceeding', context: 'phase 15 context', status: 'open', answer: null, answered_ts: null, ts: '2026-06-12T22:08:00.000Z' },
    ];
    fs.writeFileSync(
      path.join(dir, '.planning', 'run', rId, 'MAILBOX.jsonl'),
      questions.map(q => JSON.stringify(q)).join('\n') + '\n',
      'utf8'
    );
  }

  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('exit 0; stdout has run-id, Started, Status, 5 total, 2 escalated, 2 unanswered, 1 answered, completed/parked/failed phases, q-002 and q-003 with questions', () => {
    seedFixtures(tmp, runId);
    const result = runGsdTools(['run', 'report', runId], tmp);
    assert.ok(result.success, `run report failed: ${result.error}`);
    const out = result.output;
    assert.ok(out.includes(runId), 'output should contain run-id');
    assert.ok(out.includes('Started:'), 'output should contain "Started:"');
    assert.ok(out.includes('Status:'), 'output should contain "Status:"');
    assert.ok(out.includes('5 total'), 'output should show 5 total decisions');
    assert.ok(out.includes('2 escalated'), 'output should show 2 escalated');
    assert.ok(out.includes('2 unanswered'), 'output should show 2 unanswered');
    assert.ok(out.includes('1 answered'), 'output should show 1 answered');
    assert.ok(out.includes('completed'), 'output should show completed phase status');
    assert.ok(out.includes('parked'), 'output should show parked phase status');
    assert.ok(out.includes('failed'), 'output should show failed phase status');
    assert.ok(out.includes('q-002'), 'output should list q-002 in unanswered');
    assert.ok(out.includes('q-003'), 'output should list q-003 in unanswered');
    assert.ok(out.includes('Merge conflict in phase 14'), 'output should include q-002 question text');
  });

  test('answered q-001 is NOT in the unanswered questions list', () => {
    seedFixtures(tmp, runId);
    const result = runGsdTools(['run', 'report', runId], tmp);
    assert.ok(result.success, `run report failed: ${result.error}`);
    // Count occurrences of q-001 in unanswered section — should be absent or 0
    // The output lists unanswered questions; q-001 (answered) should not appear there
    const lines = result.output.split('\n');
    const unansweredIdx = lines.findIndex(l => l.includes('Unanswered questions'));
    if (unansweredIdx !== -1) {
      const unansweredBlock = lines.slice(unansweredIdx).join('\n');
      assert.ok(!unansweredBlock.includes('q-001'), 'q-001 should not appear in the unanswered block');
    }
    // Count total [q- occurrences — should be exactly 2 (q-002, q-003)
    const qMatches = (result.output.match(/\[q-/g) || []).length;
    assert.strictEqual(qMatches, 2, `should have exactly 2 [q- entries, got ${qMatches}`);
  });

  test('one corrupt DECISIONS.jsonl line: exit 0, count still 5 total, stdout contains "1 unparseable entries skipped"', () => {
    seedFixtures(tmp, runId);
    fs.appendFileSync(
      path.join(tmp, '.planning', 'run', runId, 'DECISIONS.jsonl'),
      'this is not json\n',
      'utf8'
    );
    const result = runGsdTools(['run', 'report', runId], tmp);
    assert.ok(result.success, `run report should still exit 0 on corrupt line: ${result.error}`);
    assert.ok(result.output.includes('5 total'), 'decision count should still be 5 after corrupt line');
    assert.ok(
      result.output.includes('1 unparseable entries skipped'),
      `stdout should contain "1 unparseable entries skipped", got: ${result.output}`
    );
  });

  test('no run-id and no GSD_RUN_ID exits 1 and stderr contains "no run context"', () => {
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;
    const result = runGsdTools(['run', 'report'], tmp, { env: envWithout });
    assert.ok(!result.success, 'should fail with no run context');
    assert.ok(
      result.error.includes('no run context'),
      `stderr should contain "no run context", got: ${result.error}`
    );
  });

  test('nonexistent run-id exits 1 and stderr contains "not initialized"', () => {
    const result = runGsdTools(['run', 'report', 'nonexistent-run-xyz'], tmp);
    assert.ok(!result.success, 'should fail for nonexistent run');
    assert.ok(
      result.error.includes('not initialized'),
      `stderr should contain "not initialized", got: ${result.error}`
    );
  });

  test('empty phases[] + empty JSONL files: exit 0, stdout contains "0 total", "0 unanswered", "none recorded"', () => {
    initRunDir(tmp, runId);
    const result = runGsdTools(['run', 'report', runId], tmp);
    assert.ok(result.success, `run report on empty run failed: ${result.error}`);
    assert.ok(result.output.includes('0 total'), 'should show 0 total decisions');
    assert.ok(result.output.includes('0 unanswered'), 'should show 0 unanswered');
    assert.ok(result.output.includes('none recorded'), 'should show "none recorded" for empty phases');
  });

  test('plain-text check: stdout contains no line starting with "#"', () => {
    seedFixtures(tmp, runId);
    const result = runGsdTools(['run', 'report', runId], tmp);
    assert.ok(result.success, `run report failed: ${result.error}`);
    const markdownHeadings = result.output.split('\n').filter(l => l.startsWith('#'));
    assert.strictEqual(markdownHeadings.length, 0, `output should have no markdown headings, found: ${markdownHeadings.join(', ')}`);
  });
});

// ── run record-phase ─────────────────────────────────────────────────────────

describe('run record-phase', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('appends one entry to phases[] with correct fields; preserves run_id and started_ts', () => {
    const runId = 'rp-run-001';
    initRunDir(tmp, runId);
    const metaBefore = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));

    const result = runGsdTools([
      'run', 'record-phase', runId,
      '--phase', '13',
      '--status', 'completed',
      '--worktree', 'overnight-phase-13',
      '--merge-clean', 'true',
    ], tmp);
    assert.ok(result.success, `record-phase failed: ${result.error}`);

    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.strictEqual(meta.run_id, metaBefore.run_id, 'run_id must be preserved');
    assert.strictEqual(meta.started_ts, metaBefore.started_ts, 'started_ts must be preserved');
    assert.strictEqual(meta.phases.length, 1, 'phases should have one entry');

    const entry = meta.phases[0];
    assert.strictEqual(entry.phase, 13);
    assert.strictEqual(entry.status, 'completed');
    assert.strictEqual(entry.worktree, 'overnight-phase-13');
    assert.strictEqual(entry.merge_clean, true);
    assert.strictEqual(entry.started_ts, null);
    assert.strictEqual(entry.ended_ts, null);
    assert.strictEqual(entry.reason, null);
  });

  test('two sequential record-phase calls append two entries in order (no overwrite)', () => {
    const runId = 'rp-run-002';
    initRunDir(tmp, runId);

    runGsdTools(['run', 'record-phase', runId, '--phase', '13', '--status', 'completed'], tmp);
    runGsdTools(['run', 'record-phase', runId, '--phase', '14', '--status', 'parked'], tmp);

    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.strictEqual(meta.phases.length, 2, 'should have 2 entries');
    assert.strictEqual(meta.phases[0].phase, 13);
    assert.strictEqual(meta.phases[0].status, 'completed');
    assert.strictEqual(meta.phases[1].phase, 14);
    assert.strictEqual(meta.phases[1].status, 'parked');
  });

  test('--status bogus exits 1 and stderr contains "record-phase: invalid status"; phases stays empty', () => {
    const runId = 'rp-run-003';
    initRunDir(tmp, runId);

    const result = runGsdTools(['run', 'record-phase', runId, '--phase', '13', '--status', 'bogus'], tmp);
    assert.ok(!result.success, 'should fail on invalid status');
    assert.ok(
      result.error.includes('record-phase: invalid status'),
      `stderr should contain "record-phase: invalid status", got: ${result.error}`
    );

    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.strictEqual(meta.phases.length, 0, 'phases should stay empty on invalid status');
  });

  test('missing --phase exits 1', () => {
    const runId = 'rp-run-004';
    initRunDir(tmp, runId);

    const result = runGsdTools(['run', 'record-phase', runId, '--status', 'completed'], tmp);
    assert.ok(!result.success, 'should fail with missing --phase');
    assert.ok(
      result.error.includes('required') || result.error.includes('--phase'),
      `stderr should mention --phase required, got: ${result.error}`
    );
  });

  test('missing --status exits 1', () => {
    const runId = 'rp-run-005';
    initRunDir(tmp, runId);

    const result = runGsdTools(['run', 'record-phase', runId, '--phase', '13'], tmp);
    assert.ok(!result.success, 'should fail with missing --status');
    assert.ok(
      result.error.includes('required') || result.error.includes('--status'),
      `stderr should mention --status required, got: ${result.error}`
    );
  });

  test('no run-id arg and no GSD_RUN_ID env exits 1 and stderr contains "no run context"', () => {
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;

    const result = runGsdTools(['run', 'record-phase', '--phase', '13', '--status', 'completed'], tmp, { env: envWithout });
    assert.ok(!result.success, 'should fail with no run context');
    assert.ok(
      result.error.includes('no run context'),
      `stderr should contain "no run context", got: ${result.error}`
    );
  });

  test('uninitialized run-id exits 1 and stderr contains "not initialized"', () => {
    const result = runGsdTools(['run', 'record-phase', 'nonexistent-run-xyz', '--phase', '13', '--status', 'completed'], tmp);
    assert.ok(!result.success, 'should fail for uninitialized run');
    assert.ok(
      result.error.includes('not initialized'),
      `stderr should contain "not initialized", got: ${result.error}`
    );
  });
});

// ── run status ───────────────────────────────────────────────────────────────

describe('run status', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('--set complete exits 0 and meta.status is "complete"', () => {
    const runId = 'rs-run-001';
    initRunDir(tmp, runId);

    const result = runGsdTools(['run', 'status', runId, '--set', 'complete'], tmp);
    assert.ok(result.success, `run status failed: ${result.error}`);

    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.strictEqual(meta.status, 'complete');
  });

  test('--set stopped --reason auth-failure sets status="stopped" and stopped_reason="auth-failure"', () => {
    const runId = 'rs-run-002';
    initRunDir(tmp, runId);

    const result = runGsdTools(['run', 'status', runId, '--set', 'stopped', '--reason', 'auth-failure'], tmp);
    assert.ok(result.success, `run status with reason failed: ${result.error}`);

    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.strictEqual(meta.status, 'stopped');
    assert.strictEqual(meta.stopped_reason, 'auth-failure');
  });

  test('--set bogus exits 1 and stderr contains "invalid status"', () => {
    const runId = 'rs-run-003';
    initRunDir(tmp, runId);

    const result = runGsdTools(['run', 'status', runId, '--set', 'bogus'], tmp);
    assert.ok(!result.success, 'should fail on invalid status');
    assert.ok(
      result.error.includes('invalid status'),
      `stderr should contain "invalid status", got: ${result.error}`
    );
  });

  test('missing --set exits 1', () => {
    const runId = 'rs-run-004';
    initRunDir(tmp, runId);

    const result = runGsdTools(['run', 'status', runId], tmp);
    assert.ok(!result.success, 'should fail with missing --set');
  });
});
