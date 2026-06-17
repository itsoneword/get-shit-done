/**
 * GSD Tools Tests — Triage module (triage subcommand)
 *
 * Tests for: parseRoadmapBacklog, buildTriageProposal, pendingProposalExists,
 *            supersedingRecordExists, gsd-tools triage run dispatch
 *
 * Requirements: TRIAGE-01 (backlog parser + proposal builder), TRIAGE-02 (dedup + idempotency)
 *
 * RED phase: lib/triage.cjs does not yet exist — tests are loaded defensively
 * via try/catch in beforeEach so import failure produces RED, not runner crash.
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
 * Mirrors the layout that `run init` creates.
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

// ── parseRoadmapBacklog ──────────────────────────────────────────────────────

describe('parseRoadmapBacklog', () => {
  let tmp;
  let triage;
  beforeEach(() => {
    tmp = createTempProject();
    try { triage = require('../get-shit-done/bin/lib/triage.cjs'); } catch (_) { triage = null; }
  });
  afterEach(() => { cleanup(tmp); });

  test('returns B-items with id/title/goal from ROADMAP.md ## Backlog section', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    const roadmapPath = path.join(tmp, '.planning', 'ROADMAP.md');
    fs.mkdirSync(path.join(tmp, '.planning'), { recursive: true });
    fs.writeFileSync(roadmapPath, [
      '## Backlog',
      '',
      '### B1: Terse output default + verbose opt-in (BACKLOG)',
      '',
      '**Goal:** GSD defaults to minimal terse form.',
      '**Requirements:** TBD',
      '**Plans:** 0/0',
      '',
      '### B2: Another item (BACKLOG)',
      '',
      '**Goal:** Second goal.',
    ].join('\n'), 'utf8');

    const result = triage.parseRoadmapBacklog(tmp);
    assert.ok(Array.isArray(result), 'result should be an array');
    assert.strictEqual(result.length, 2, `expected 2 items, got ${result.length}`);
    assert.strictEqual(result[0].id, 'B1');
    assert.strictEqual(result[0].title, 'Terse output default + verbose opt-in');
    assert.strictEqual(result[0].goal, 'GSD defaults to minimal terse form.');
    assert.strictEqual(result[1].id, 'B2');
  });

  test('returns [] when ROADMAP.md has no ## Backlog section', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    const roadmapPath = path.join(tmp, '.planning', 'ROADMAP.md');
    fs.mkdirSync(path.join(tmp, '.planning'), { recursive: true });
    fs.writeFileSync(roadmapPath, '## Phases\n\n- Phase 1: done\n', 'utf8');

    const result = triage.parseRoadmapBacklog(tmp);
    assert.deepStrictEqual(result, []);
  });

  test('returns [] when ROADMAP.md does not exist', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    // Do not create ROADMAP.md
    const result = triage.parseRoadmapBacklog(tmp);
    assert.deepStrictEqual(result, []);
  });

  test('strips (BACKLOG) suffix from title', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    const roadmapPath = path.join(tmp, '.planning', 'ROADMAP.md');
    fs.mkdirSync(path.join(tmp, '.planning'), { recursive: true });
    fs.writeFileSync(roadmapPath, [
      '## Backlog',
      '',
      '### B1: My Feature (BACKLOG)',
      '',
      '**Goal:** Do something.',
    ].join('\n'), 'utf8');

    const result = triage.parseRoadmapBacklog(tmp);
    assert.strictEqual(result.length, 1);
    assert.ok(!result[0].title.includes('(BACKLOG)'), `title should not include (BACKLOG), got: ${result[0].title}`);
    assert.strictEqual(result[0].title, 'My Feature');
  });
});

// ── buildTriageProposal ──────────────────────────────────────────────────────

describe('buildTriageProposal', () => {
  let triage;
  beforeEach(() => {
    try { triage = require('../get-shit-done/bin/lib/triage.cjs'); } catch (_) { triage = null; }
  });

  test('produces required mailbox fields', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    const result = triage.buildTriageProposal(
      { id: 'B1', title: 'Terse output' },
      'fold-into-phase',
      'Found in phase 15',
      'phase-15'
    );
    assert.strictEqual(result.question, 'Triage proposal: Terse output');
    assert.strictEqual(result.phase, null);
    assert.strictEqual(result.status, 'pending');
    assert.strictEqual(result.decision_id, null);
    assert.deepStrictEqual(result.options, ['accept', 'defer']);
  });

  test('context field starts with triage-verdict: prefix', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    const result = triage.buildTriageProposal(
      { id: 'B1', title: 'Terse output' },
      'fold-into-phase',
      'Found in phase 15',
      'phase-15'
    );
    assert.ok(result.context.startsWith('triage-verdict:'), `context should start with "triage-verdict:", got: ${result.context}`);
  });

  test('context field contains verdict and target', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    const result = triage.buildTriageProposal(
      { id: 'B1', title: 'Terse output' },
      'fold-into-phase',
      'Found in phase 15',
      'phase-15'
    );
    assert.ok(result.context.includes('fold-into-phase'), `context should contain verdict, got: ${result.context}`);
    assert.ok(result.context.includes('phase-15'), `context should contain target, got: ${result.context}`);
  });

  test('evidence field is preserved', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    const result = triage.buildTriageProposal(
      { id: 'B1', title: 'Terse output' },
      'fold-into-phase',
      'Found in phase 15',
      'phase-15'
    );
    assert.strictEqual(result.evidence, 'Found in phase 15');
  });
});

// ── pendingProposalExists ────────────────────────────────────────────────────

describe('pendingProposalExists', () => {
  let tmp;
  let triage;
  beforeEach(() => {
    tmp = createTempProject();
    try { triage = require('../get-shit-done/bin/lib/triage.cjs'); } catch (_) { triage = null; }
  });
  afterEach(() => { cleanup(tmp); });

  test('returns false when mailbox is empty', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    initRunDir(tmp, 'r1');
    const result = triage.pendingProposalExists(tmp, 'r1', 'My Todo');
    assert.strictEqual(result, false);
  });

  test('returns true when pending proposal for same title exists', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    initRunDir(tmp, 'r1');
    const line = JSON.stringify({
      id: 'q-001',
      question: 'Triage proposal: My Todo',
      status: 'pending',
      ts: new Date().toISOString(),
      run_id: 'r1',
    });
    fs.appendFileSync(mailboxFile(tmp, 'r1'), line + '\n', 'utf8');

    const result = triage.pendingProposalExists(tmp, 'r1', 'My Todo');
    assert.strictEqual(result, true);
  });

  test('returns false when matching proposal is already answered', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    initRunDir(tmp, 'r1');
    const line = JSON.stringify({
      id: 'q-001',
      question: 'Triage proposal: My Todo',
      status: 'answered',
      answer: 'accept',
      ts: new Date().toISOString(),
      run_id: 'r1',
    });
    fs.appendFileSync(mailboxFile(tmp, 'r1'), line + '\n', 'utf8');

    const result = triage.pendingProposalExists(tmp, 'r1', 'My Todo');
    assert.strictEqual(result, false);
  });
});

// ── supersedingRecordExists ──────────────────────────────────────────────────

describe('supersedingRecordExists', () => {
  let tmp;
  let triage;
  beforeEach(() => {
    tmp = createTempProject();
    try { triage = require('../get-shit-done/bin/lib/triage.cjs'); } catch (_) { triage = null; }
  });
  afterEach(() => { cleanup(tmp); });

  test('returns false when ledger is empty', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    initRunDir(tmp, 'r1');
    const result = triage.supersedingRecordExists(tmp, 'r1', 'q-001');
    assert.strictEqual(result, false);
  });

  test('returns true when a record has supersedes === questionId', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    initRunDir(tmp, 'r1');
    const line = JSON.stringify({
      id: 'dec-001',
      decision: 'proceed',
      alternatives: [],
      evidence: 'manual check',
      confidence: 'HIGH',
      escalated: null,
      supersedes: 'q-001',
      ts: new Date().toISOString(),
    });
    fs.appendFileSync(decisionsFile(tmp, 'r1'), line + '\n', 'utf8');

    const result = triage.supersedingRecordExists(tmp, 'r1', 'q-001');
    assert.strictEqual(result, true);
  });

  test('returns true when a record evidence contains questionId', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    initRunDir(tmp, 'r1');
    const line = JSON.stringify({
      id: 'dec-002',
      decision: 'proceed',
      alternatives: [],
      evidence: 'Resumed after q-001 answered: yes',
      confidence: 'HIGH',
      escalated: null,
      ts: new Date().toISOString(),
    });
    fs.appendFileSync(decisionsFile(tmp, 'r1'), line + '\n', 'utf8');

    const result = triage.supersedingRecordExists(tmp, 'r1', 'q-001');
    assert.strictEqual(result, true);
  });

  test('returns false when no matching record exists', () => {
    if (!triage) { assert.fail('triage.cjs not found'); }
    initRunDir(tmp, 'r1');
    const line = JSON.stringify({
      id: 'dec-001',
      decision: 'proceed',
      alternatives: [],
      evidence: 'something about q-002',
      confidence: 'HIGH',
      escalated: null,
      supersedes: 'q-002',
      ts: new Date().toISOString(),
    });
    fs.appendFileSync(decisionsFile(tmp, 'r1'), line + '\n', 'utf8');

    const result = triage.supersedingRecordExists(tmp, 'r1', 'q-001');
    assert.strictEqual(result, false);
  });
});

// ── gsd-tools triage run dispatch ────────────────────────────────────────────

describe('gsd-tools triage run dispatch', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('exits 1 with helpful message when no run context', () => {
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;
    const result = runGsdTools(['triage', 'run'], tmp, { env: envWithout });
    assert.ok(!result.success, `should exit non-zero, got success`);
    assert.ok(
      result.error.includes('run context') || result.error.includes('GSD_RUN_ID') || result.error.includes('run-id'),
      `stderr should mention run context, got: ${result.error}`
    );
  });

  test('exits 0 with "triage complete" message when run dir initialized', () => {
    const runId = 'r1';
    initRunDir(tmp, runId);
    // Write empty ROADMAP.md
    fs.mkdirSync(path.join(tmp, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'), '## Phases\n\nNo backlog.\n', 'utf8');
    // Write empty todos pending dir
    fs.mkdirSync(path.join(tmp, '.planning', 'todos', 'pending'), { recursive: true });

    const result = runGsdTools(['triage', 'run', runId], tmp);
    assert.ok(result.success, `should exit 0, got: ${result.error}`);
    assert.ok(
      result.output.includes('triage complete'),
      `stdout should include "triage complete", got: ${result.output}`
    );
  });
});
