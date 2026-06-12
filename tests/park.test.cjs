/**
 * GSD Tools Tests — Park primitives (park subcommand + run snapshot)
 *
 * Tests for: park create, park staleness, run snapshot, ledger list stuck header
 *
 * Requirements: PARK-01 (snapshot), PARK-03 (staleness substrate), PARK-04 (stuck detection)
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, createTempGitProject, cleanup } = require('./helpers.cjs');

// ── Fixture helpers ──────────────────────────────────────────────────────────

function runDir(tmp, runId) {
  return path.join(tmp, '.planning', 'run', runId);
}

function decisionsFile(tmp, runId) {
  return path.join(tmp, '.planning', 'run', runId, 'DECISIONS.jsonl');
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
  fs.writeFileSync(path.join(dir, 'DECISIONS.jsonl'), '', 'utf8');
  fs.writeFileSync(path.join(dir, 'MAILBOX.jsonl'), '', 'utf8');
  fs.writeFileSync(
    path.join(dir, 'RUN-META.json'),
    JSON.stringify({ run_id: runId, started_ts: new Date().toISOString(), phases: [], status: 'running' }, null, 2) + '\n',
    'utf8'
  );
}

// ── Pure function tests ──────────────────────────────────────────────────────

describe('park pure functions — hashContent + hashFile', () => {
  let tmp;
  let park;
  beforeEach(() => {
    tmp = createTempProject();
    park = require('../get-shit-done/bin/lib/park.cjs');
  });
  afterEach(() => { cleanup(tmp); });

  test('hashContent returns 64-char lowercase hex', () => {
    const h = park.hashContent('hello');
    assert.strictEqual(typeof h, 'string');
    assert.strictEqual(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  test('hashContent is deterministic — same input gives same output', () => {
    const a = park.hashContent('test data');
    const b = park.hashContent('test data');
    assert.strictEqual(a, b);
  });

  test('hashContent distinguishes different inputs', () => {
    assert.notStrictEqual(park.hashContent('a'), park.hashContent('b'));
  });

  test('hashFile returns same hex as hashContent of file body', () => {
    const filePath = path.join(tmp, 'test-file.txt');
    fs.writeFileSync(filePath, 'file content', 'utf8');
    assert.strictEqual(park.hashFile(filePath), park.hashContent('file content'));
  });

  test('hashFile returns null for nonexistent path', () => {
    assert.strictEqual(park.hashFile(path.join(tmp, 'nonexistent.txt')), null);
  });
});

describe('park pure functions — buildContentHashes', () => {
  let tmp;
  let park;
  beforeEach(() => {
    tmp = createTempProject();
    park = require('../get-shit-done/bin/lib/park.cjs');
  });
  afterEach(() => { cleanup(tmp); });

  test('returns object with exactly the four keys', () => {
    const hashes = park.buildContentHashes(tmp, null);
    const keys = Object.keys(hashes).sort();
    assert.deepStrictEqual(keys.sort(), ['CONTEXT.md', 'ROADMAP.md', 'STATE.md', 'cross-phase-notes.md'].sort());
  });

  test('hashes .planning/STATE.md under cwd', () => {
    const stateFile = path.join(tmp, '.planning', 'STATE.md');
    fs.writeFileSync(stateFile, 'state content', 'utf8');
    const hashes = park.buildContentHashes(tmp, null);
    assert.strictEqual(hashes['STATE.md'], park.hashContent('state content'));
  });

  test('missing files map to null', () => {
    const hashes = park.buildContentHashes(tmp, null);
    // .planning/STATE.md does not exist in createTempProject
    assert.strictEqual(hashes['STATE.md'], null);
    assert.strictEqual(hashes['ROADMAP.md'], null);
    assert.strictEqual(hashes['cross-phase-notes.md'], null);
  });

  test('contextPath of null maps CONTEXT.md to null', () => {
    const hashes = park.buildContentHashes(tmp, null);
    assert.strictEqual(hashes['CONTEXT.md'], null);
  });

  test('contextPath pointing to existing file hashes CONTEXT.md', () => {
    const ctxFile = path.join(tmp, 'CONTEXT.md');
    fs.writeFileSync(ctxFile, 'context content', 'utf8');
    const hashes = park.buildContentHashes(tmp, ctxFile);
    assert.strictEqual(hashes['CONTEXT.md'], park.hashContent('context content'));
  });
});

describe('park pure functions — buildParkSnapshot', () => {
  let park;
  beforeEach(() => {
    park = require('../get-shit-done/bin/lib/park.cjs');
  });

  test('returns snapshot with all expected fields', () => {
    const opts = {
      phase: 3,
      blockedAt: 'discuss-phase --auto: question_triage',
      questionId: 'q-001',
      phaseDir: '/some/phase/dir',
      contextPath: '/some/CONTEXT.md',
      resumeInstruction: 'Resume discuss-phase --auto for phase 3',
      contentHashes: { 'STATE.md': 'abc', 'ROADMAP.md': null, 'cross-phase-notes.md': null, 'CONTEXT.md': null },
      gitHead: 'a'.repeat(40),
    };
    const snap = park.buildParkSnapshot(opts);
    assert.strictEqual(snap.phase, 3);
    assert.strictEqual(snap.blocked_at, 'discuss-phase --auto: question_triage');
    assert.strictEqual(snap.question_id, 'q-001');
    assert.strictEqual(snap.phase_dir, '/some/phase/dir');
    assert.strictEqual(snap.context_path, '/some/CONTEXT.md');
    assert.strictEqual(snap.resume_instruction, 'Resume discuss-phase --auto for phase 3');
    assert.deepStrictEqual(snap.content_hashes, opts.contentHashes);
    assert.strictEqual(snap.git_head, 'a'.repeat(40));
    assert.match(snap.ts, /^\d{4}-\d{2}-\d{2}T/);
  });

  test('null phaseDir maps to null', () => {
    const snap = park.buildParkSnapshot({
      phase: 1, blockedAt: 'x', questionId: 'q-001',
      phaseDir: null, contextPath: null, resumeInstruction: 'r',
      contentHashes: {}, gitHead: null,
    });
    assert.strictEqual(snap.phase_dir, null);
    assert.strictEqual(snap.context_path, null);
    assert.strictEqual(snap.git_head, null);
  });
});

describe('park pure functions — checkStaleness', () => {
  let tmp;
  let park;
  beforeEach(() => {
    tmp = createTempProject();
    park = require('../get-shit-done/bin/lib/park.cjs');
  });
  afterEach(() => { cleanup(tmp); });

  function makeSnapshot(cwd, extraFields) {
    const hashes = park.buildContentHashes(cwd, null);
    return Object.assign({
      phase: 1, blocked_at: 'x', question_id: 'q-001',
      content_hashes: hashes, git_head: null,
    }, extraFields || {});
  }

  test('nothing changed — all four keys in unchanged, changed and missing empty', () => {
    const snap = makeSnapshot(tmp);
    const result = park.checkStaleness(tmp, snap);
    assert.ok(Array.isArray(result.changed));
    assert.ok(Array.isArray(result.unchanged));
    assert.ok(Array.isArray(result.missing));
    assert.strictEqual(result.changed.length, 0);
    assert.strictEqual(result.missing.length, 0);
    assert.strictEqual(result.unchanged.length, 4);
  });

  test('modify STATE.md — changed contains STATE.md, unchanged does not', () => {
    const stateFile = path.join(tmp, '.planning', 'STATE.md');
    fs.writeFileSync(stateFile, 'original state', 'utf8');
    const snap = makeSnapshot(tmp);
    // Modify the file after snapshot
    fs.writeFileSync(stateFile, 'modified state', 'utf8');
    const result = park.checkStaleness(tmp, snap);
    assert.ok(result.changed.includes('STATE.md'));
    assert.ok(!result.unchanged.includes('STATE.md'));
  });

  test('delete a file that was non-null at park time — key appears in missing', () => {
    const roadmapFile = path.join(tmp, '.planning', 'ROADMAP.md');
    fs.writeFileSync(roadmapFile, 'roadmap', 'utf8');
    const snap = makeSnapshot(tmp);
    // Delete the file
    fs.unlinkSync(roadmapFile);
    const result = park.checkStaleness(tmp, snap);
    assert.ok(result.missing.includes('ROADMAP.md'));
  });

  test('file was null at park and now exists — key in changed', () => {
    // STATE.md does not exist in createTempProject, so snap has null for it
    const snap = makeSnapshot(tmp);
    assert.strictEqual(snap.content_hashes['STATE.md'], null);
    // Create the file now
    fs.writeFileSync(path.join(tmp, '.planning', 'STATE.md'), 'new content', 'utf8');
    const result = park.checkStaleness(tmp, snap);
    assert.ok(result.changed.includes('STATE.md'));
  });

  test('git_range is <git_head>..HEAD when git_head is non-null', () => {
    const snap = makeSnapshot(tmp, { git_head: 'abc123' });
    const result = park.checkStaleness(tmp, snap);
    assert.strictEqual(result.git_range, 'abc123..HEAD');
  });

  test('git_range is null when git_head is null', () => {
    const snap = makeSnapshot(tmp, { git_head: null });
    const result = park.checkStaleness(tmp, snap);
    assert.strictEqual(result.git_range, null);
  });
});

describe('park pure functions — decisionsHash', () => {
  let tmp;
  let park;
  beforeEach(() => {
    tmp = createTempProject();
    park = require('../get-shit-done/bin/lib/park.cjs');
  });
  afterEach(() => { cleanup(tmp); });

  test('returns null when DECISIONS.jsonl is absent', () => {
    assert.strictEqual(park.decisionsHash(tmp, 'nonexistent-run'), null);
  });

  test('returns 64-char hex when file exists', () => {
    initRunDir(tmp, 'hash-run');
    const h = park.decisionsHash(tmp, 'hash-run');
    assert.strictEqual(typeof h, 'string');
    assert.strictEqual(h.length, 64);
  });

  test('changes when a line is appended', () => {
    initRunDir(tmp, 'hash-run-2');
    const h1 = park.decisionsHash(tmp, 'hash-run-2');
    fs.appendFileSync(decisionsFile(tmp, 'hash-run-2'), '{"decision":"go"}\n', 'utf8');
    const h2 = park.decisionsHash(tmp, 'hash-run-2');
    assert.notStrictEqual(h1, h2);
  });
});

describe('park pure functions — isStuck', () => {
  let park;
  beforeEach(() => {
    park = require('../get-shit-done/bin/lib/park.cjs');
  });

  test('false when phase_snapshots is missing', () => {
    assert.strictEqual(park.isStuck({}), false);
  });

  test('false when phase_snapshots has fewer than 2 entries', () => {
    assert.strictEqual(park.isStuck({ phase_snapshots: [{ decisions_hash: 'abc' }] }), false);
  });

  test('true when last two entries have equal non-null decisions_hash', () => {
    const meta = {
      phase_snapshots: [
        { phase: 1, decisions_hash: 'aaa' },
        { phase: 2, decisions_hash: 'bbb' },
        { phase: 3, decisions_hash: 'bbb' },
      ]
    };
    assert.strictEqual(park.isStuck(meta), true);
  });

  test('false when last two entries differ', () => {
    const meta = {
      phase_snapshots: [
        { phase: 1, decisions_hash: 'aaa' },
        { phase: 2, decisions_hash: 'bbb' },
      ]
    };
    assert.strictEqual(park.isStuck(meta), false);
  });

  test('false when last decisions_hash is null', () => {
    const meta = {
      phase_snapshots: [
        { phase: 1, decisions_hash: 'aaa' },
        { phase: 2, decisions_hash: null },
      ]
    };
    assert.strictEqual(park.isStuck(meta), false);
  });
});

describe('park pure functions — appendPhaseSnapshot', () => {
  let tmp;
  let park;
  beforeEach(() => {
    tmp = createTempProject();
    park = require('../get-shit-done/bin/lib/park.cjs');
  });
  afterEach(() => { cleanup(tmp); });

  test('appends to phase_snapshots array, sets meta.stuck, returns updated meta', () => {
    initRunDir(tmp, 'snap-run');
    const snap = { phase: 1, ts: new Date().toISOString(), decisions_hash: 'abc123' };
    const meta = park.appendPhaseSnapshot(tmp, 'snap-run', snap);
    assert.ok(Array.isArray(meta.phase_snapshots));
    assert.strictEqual(meta.phase_snapshots.length, 1);
    assert.strictEqual(meta.phase_snapshots[0].phase, 1);
    assert.strictEqual(typeof meta.stuck, 'boolean');
  });

  test('two calls with same decisions_hash sets stuck=true', () => {
    initRunDir(tmp, 'snap-run-stuck');
    const snap1 = { phase: 1, ts: new Date().toISOString(), decisions_hash: 'same-hash' };
    park.appendPhaseSnapshot(tmp, 'snap-run-stuck', snap1);
    const snap2 = { phase: 2, ts: new Date().toISOString(), decisions_hash: 'same-hash' };
    const meta = park.appendPhaseSnapshot(tmp, 'snap-run-stuck', snap2);
    assert.strictEqual(meta.stuck, true);
  });

  test('persists to RUN-META.json as pretty-printed JSON', () => {
    initRunDir(tmp, 'snap-run-persist');
    park.appendPhaseSnapshot(tmp, 'snap-run-persist', { phase: 1, ts: new Date().toISOString(), decisions_hash: 'x' });
    const content = fs.readFileSync(metaFile(tmp, 'snap-run-persist'), 'utf8');
    const parsed = JSON.parse(content);
    assert.ok(Array.isArray(parsed.phase_snapshots));
    // Pretty-printed: content should contain newlines/spaces
    assert.ok(content.includes('\n'));
  });
});

describe('park pure functions — resolveGitHead', () => {
  let park;
  beforeEach(() => {
    park = require('../get-shit-done/bin/lib/park.cjs');
  });

  test('returns 40-char hex sha in a git project', () => {
    const tmp = createTempGitProject();
    try {
      const sha = park.resolveGitHead(tmp);
      assert.ok(sha !== null, 'should return a sha, not null');
      assert.match(sha, /^[0-9a-f]{40}$/);
    } finally {
      cleanup(tmp);
    }
  });

  test('returns null in a plain (non-git) project, never throws', () => {
    const tmp = createTempProject();
    try {
      const sha = park.resolveGitHead(tmp);
      assert.strictEqual(sha, null);
    } finally {
      cleanup(tmp);
    }
  });
});

// ── CLI — park create ────────────────────────────────────────────────────────

describe('park create — happy path (git project)', () => {
  let tmp;
  const runId = 'park-create-git-01';
  beforeEach(() => {
    tmp = createTempGitProject();
    initRunDir(tmp, runId);
  });
  afterEach(() => { cleanup(tmp); });

  test('exit 0, snapshot file exists and parses correctly', () => {
    const result = runGsdTools([
      'park', 'create', runId,
      '--phase', '3',
      '--question', 'q-001',
      '--blocked-at', 'discuss-phase --auto: question_triage',
      '--resume', 'Resume discuss-phase --auto for phase 3 with answer to q-001 injected',
    ], tmp);
    assert.ok(result.success, `park create failed: ${result.error}`);

    const snapPath = path.join(tmp, '.planning', 'run', runId, 'parked', 'phase-3.json');
    assert.ok(fs.existsSync(snapPath), 'snapshot file should exist');

    const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    assert.strictEqual(snap.phase, 3);
    assert.strictEqual(snap.question_id, 'q-001');
    assert.strictEqual(snap.blocked_at, 'discuss-phase --auto: question_triage');
    assert.strictEqual(snap.resume_instruction, 'Resume discuss-phase --auto for phase 3 with answer to q-001 injected');
    assert.ok(snap.content_hashes && typeof snap.content_hashes === 'object');
    assert.ok(['STATE.md', 'ROADMAP.md', 'cross-phase-notes.md', 'CONTEXT.md'].every(k => k in snap.content_hashes));
    assert.match(snap.git_head, /^[0-9a-f]{40}$/);
    assert.match(snap.ts, /^\d{4}-\d{2}-\d{2}T/);
  });

  test('stdout contains relative path to snapshot file', () => {
    const result = runGsdTools([
      'park', 'create', runId,
      '--phase', '3', '--question', 'q-001',
      '--blocked-at', 'x', '--resume', 'y',
    ], tmp);
    assert.ok(result.success, result.error);
    assert.ok(result.output.includes('parked/phase-3.json'), `stdout should contain path, got: ${result.output}`);
  });
});

describe('park create — non-git project', () => {
  let tmp;
  const runId = 'park-create-nogit-01';
  beforeEach(() => {
    tmp = createTempProject();
    initRunDir(tmp, runId);
  });
  afterEach(() => { cleanup(tmp); });

  test('exit 0 and git_head is null in a non-git project', () => {
    const result = runGsdTools([
      'park', 'create', runId,
      '--phase', '1', '--question', 'q-001',
      '--blocked-at', 'x', '--resume', 'y',
    ], tmp);
    assert.ok(result.success, `park create failed: ${result.error}`);

    const snapPath = path.join(tmp, '.planning', 'run', runId, 'parked', 'phase-1.json');
    const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    assert.strictEqual(snap.git_head, null);
  });
});

describe('park create — error cases', () => {
  let tmp;
  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('uninitialized run-id — exit 1, stderr contains "not initialized"', () => {
    const result = runGsdTools([
      'park', 'create', 'no-such-run',
      '--phase', '1', '--question', 'q-001',
      '--blocked-at', 'x', '--resume', 'y',
    ], tmp);
    assert.ok(!result.success, 'should fail for uninitialized run');
    assert.ok(result.error.includes('not initialized'), `stderr should mention "not initialized", got: ${result.error}`);
  });

  test('no run-id arg + no GSD_RUN_ID env — exit 1, stderr contains "no run context"', () => {
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;
    const result = runGsdTools([
      'park', 'create',
      '--phase', '1', '--question', 'q-001',
      '--blocked-at', 'x', '--resume', 'y',
    ], tmp, { env: envWithout });
    assert.ok(!result.success, 'should fail with no run context');
    assert.ok(result.error.includes('no run context'), `stderr should mention "no run context", got: ${result.error}`);
  });

  test('GSD_RUN_ID env fallback — exit 0 when run is initialized', () => {
    const runId = 'park-env-run';
    initRunDir(tmp, runId);
    const envWith = { ...process.env, GSD_RUN_ID: runId };
    const result = runGsdTools([
      'park', 'create',
      '--phase', '2', '--question', 'q-001',
      '--blocked-at', 'x', '--resume', 'y',
    ], tmp, { env: envWith });
    assert.ok(result.success, `env fallback should succeed: ${result.error}`);
  });

  test('missing --phase — exit 1, stderr contains usage text', () => {
    const runId = 'park-missing-phase';
    initRunDir(tmp, runId);
    const result = runGsdTools([
      'park', 'create', runId,
      '--question', 'q-001', '--blocked-at', 'x', '--resume', 'y',
    ], tmp);
    assert.ok(!result.success, 'should fail for missing --phase');
    assert.ok(
      result.error.includes('--phase') || result.error.includes('required'),
      `stderr should mention --phase or required, got: ${result.error}`
    );
  });

  test('missing --question — exit 1, stderr contains usage text', () => {
    const runId = 'park-missing-question';
    initRunDir(tmp, runId);
    const result = runGsdTools([
      'park', 'create', runId,
      '--phase', '1', '--blocked-at', 'x', '--resume', 'y',
    ], tmp);
    assert.ok(!result.success, 'should fail for missing --question');
    assert.ok(
      result.error.includes('--question') || result.error.includes('required'),
      `stderr should mention --question or required, got: ${result.error}`
    );
  });
});

// ── CLI — park staleness ─────────────────────────────────────────────────────

describe('park staleness', () => {
  let tmp;
  const runId = 'park-staleness-run';

  beforeEach(() => {
    tmp = createTempGitProject();
    initRunDir(tmp, runId);
  });
  afterEach(() => { cleanup(tmp); });

  test('nothing changed — stdout contains unchanged, no changed label with files', () => {
    // Create snapshot first
    runGsdTools([
      'park', 'create', runId,
      '--phase', '3', '--question', 'q-001',
      '--blocked-at', 'x', '--resume', 'Resume instruction here',
    ], tmp);

    const result = runGsdTools(['park', 'staleness', runId, '--phase', '3'], tmp);
    assert.ok(result.success, `park staleness failed: ${result.error}`);
    assert.ok(result.output.includes('unchanged'), `stdout should contain "unchanged", got: ${result.output}`);
  });

  test('after modifying ROADMAP.md — stdout contains ROADMAP.md in changed section', () => {
    runGsdTools([
      'park', 'create', runId,
      '--phase', '3', '--question', 'q-001',
      '--blocked-at', 'x', '--resume', 'Resume instruction here',
    ], tmp);

    // Modify ROADMAP.md
    fs.mkdirSync(path.join(tmp, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'), '# Changed Roadmap', 'utf8');

    const result = runGsdTools(['park', 'staleness', runId, '--phase', '3'], tmp);
    assert.ok(result.success, `park staleness failed: ${result.error}`);
    assert.ok(result.output.includes('ROADMAP.md'), `stdout should contain ROADMAP.md, got: ${result.output}`);
    // Should contain resume instruction
    assert.ok(result.output.includes('Resume instruction here'), `stdout should contain resume instruction, got: ${result.output}`);
    // Should contain git range since this is a git project
    assert.ok(result.output.includes('..HEAD'), `stdout should contain git range, got: ${result.output}`);
  });

  test('--raw variant — stdout parses as JSON with required keys', () => {
    runGsdTools([
      'park', 'create', runId,
      '--phase', '3', '--question', 'q-001',
      '--blocked-at', 'x', '--resume', 'y',
    ], tmp);

    const result = runGsdTools(['park', 'staleness', runId, '--phase', '3', '--raw'], tmp);
    assert.ok(result.success, `park staleness --raw failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok('changed' in parsed, 'raw output should have "changed"');
    assert.ok('unchanged' in parsed, 'raw output should have "unchanged"');
    assert.ok('missing' in parsed, 'raw output should have "missing"');
    assert.ok('git_range' in parsed, 'raw output should have "git_range"');
    assert.ok('resume_instruction' in parsed, 'raw output should have "resume_instruction"');
    assert.ok('question_id' in parsed, 'raw output should have "question_id"');
    assert.ok('phase' in parsed, 'raw output should have "phase"');
  });

  test('no snapshot for phase — exit 1, stderr contains "no snapshot"', () => {
    const result = runGsdTools(['park', 'staleness', runId, '--phase', '99'], tmp);
    assert.ok(!result.success, 'should fail for missing snapshot');
    assert.ok(result.error.includes('no snapshot'), `stderr should mention "no snapshot", got: ${result.error}`);
  });
});

// ── CLI — run snapshot (stuck detection) ─────────────────────────────────────

describe('run snapshot — stuck detection', () => {
  let tmp;
  const runId = 'snap-run-stuck-test';

  beforeEach(() => {
    tmp = createTempProject();
    initRunDir(tmp, runId);
  });
  afterEach(() => { cleanup(tmp); });

  test('first snapshot with DECISIONS.jsonl seeded — exit 0, RUN-META has 1 entry, stuck=false, stdout contains "snapshot recorded"', () => {
    fs.appendFileSync(decisionsFile(tmp, runId), '{"decision":"go","alternatives":[],"evidence":"none","confidence":"high","escalated":false}\n', 'utf8');

    const result = runGsdTools(['run', 'snapshot', runId, '--phase', '1'], tmp);
    assert.ok(result.success, `run snapshot failed: ${result.error}`);
    assert.ok(result.output.includes('snapshot recorded'), `stdout should contain "snapshot recorded", got: ${result.output}`);

    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.ok(Array.isArray(meta.phase_snapshots));
    assert.strictEqual(meta.phase_snapshots.length, 1);
    assert.strictEqual(meta.phase_snapshots[0].phase, 1);
    assert.match(meta.phase_snapshots[0].ts, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(meta.phase_snapshots[0].decisions_hash, /^[0-9a-f]{64}$/);
    assert.strictEqual(meta.stuck, false);
  });

  test('second snapshot without touching DECISIONS.jsonl — stuck=true, stdout contains STUCK', () => {
    fs.appendFileSync(decisionsFile(tmp, runId), '{"decision":"go","alternatives":[],"evidence":"none","confidence":"high","escalated":false}\n', 'utf8');
    runGsdTools(['run', 'snapshot', runId, '--phase', '1'], tmp);

    const result = runGsdTools(['run', 'snapshot', runId, '--phase', '2'], tmp);
    assert.ok(result.success, `second run snapshot failed: ${result.error}`);
    assert.ok(result.output.includes('STUCK'), `stdout should contain STUCK, got: ${result.output}`);

    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.strictEqual(meta.stuck, true);

    // run.log should exist and contain STUCK
    const runLog = path.join(tmp, '.planning', 'run', runId, 'run.log');
    assert.ok(fs.existsSync(runLog), 'run.log should exist');
    const logContent = fs.readFileSync(runLog, 'utf8');
    assert.ok(logContent.includes('STUCK'), `run.log should contain STUCK, got: ${logContent}`);
  });

  test('third snapshot after appending to DECISIONS.jsonl — stuck=false (recovery)', () => {
    fs.appendFileSync(decisionsFile(tmp, runId), '{"decision":"go","alternatives":[],"evidence":"none","confidence":"high","escalated":false}\n', 'utf8');
    runGsdTools(['run', 'snapshot', runId, '--phase', '1'], tmp);
    runGsdTools(['run', 'snapshot', runId, '--phase', '2'], tmp);

    // Append to decisions
    fs.appendFileSync(decisionsFile(tmp, runId), '{"decision":"more","alternatives":[],"evidence":"new","confidence":"low","escalated":false}\n', 'utf8');
    const result = runGsdTools(['run', 'snapshot', runId, '--phase', '3'], tmp);
    assert.ok(result.success, `recovery run snapshot failed: ${result.error}`);
    assert.ok(!result.output.includes('STUCK'), `stdout should NOT contain STUCK, got: ${result.output}`);

    const meta = JSON.parse(fs.readFileSync(metaFile(tmp, runId), 'utf8'));
    assert.strictEqual(meta.stuck, false);
  });

  test('no run context — exit 1', () => {
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;
    const result = runGsdTools(['run', 'snapshot', '--phase', '1'], tmp, { env: envWithout });
    assert.ok(!result.success, 'should fail with no run context');
  });
});

// ── CLI — ledger list stuck surface ──────────────────────────────────────────

describe('ledger list stuck surface', () => {
  let tmp;
  const runId = 'ledger-stuck-run';

  beforeEach(() => {
    tmp = createTempProject();
    initRunDir(tmp, runId);
  });
  afterEach(() => { cleanup(tmp); });

  test('stuck=true in RUN-META — ledger list stdout contains STUCK FLAG before table', () => {
    // Seed RUN-META.json with stuck=true
    const metaPath = metaFile(tmp, runId);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    meta.stuck = true;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

    // Seed a decision record so list has something
    fs.appendFileSync(decisionsFile(tmp, runId),
      '{"id":"dec-001","ts":"2026-01-01T00:00:00Z","decision":"go","alternatives":[],"evidence":"none","confidence":"high","escalated":false}\n',
      'utf8'
    );

    const result = runGsdTools(['ledger', 'list', runId], tmp);
    assert.ok(result.success, `ledger list failed: ${result.error}`);
    assert.ok(result.output.includes('STUCK FLAG'), `stdout should contain STUCK FLAG, got: ${result.output}`);

    // STUCK FLAG should appear before the table header
    const stuckIdx = result.output.indexOf('STUCK FLAG');
    const idIdx = result.output.indexOf('id');
    assert.ok(stuckIdx < idIdx, 'STUCK FLAG should appear before table header');
  });

  test('stuck=false or missing — ledger list stdout does NOT contain STUCK FLAG', () => {
    // Default meta has no stuck field
    const result = runGsdTools(['ledger', 'list', runId], tmp);
    assert.ok(result.success, `ledger list failed: ${result.error}`);
    assert.ok(!result.output.includes('STUCK FLAG'), `stdout should NOT contain STUCK FLAG, got: ${result.output}`);
  });

  test('stuck=true + --raw — all stdout lines parse as JSON (no header pollution)', () => {
    const metaPath = metaFile(tmp, runId);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    meta.stuck = true;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

    // Seed a record
    fs.appendFileSync(decisionsFile(tmp, runId),
      '{"id":"dec-001","ts":"2026-01-01T00:00:00Z","decision":"go","alternatives":[],"evidence":"none","confidence":"high","escalated":false}\n',
      'utf8'
    );

    const result = runGsdTools(['ledger', 'list', runId, '--raw'], tmp);
    assert.ok(result.success, `ledger list --raw failed: ${result.error}`);
    const lines = result.output.split('\n').filter(l => l.trim() !== '');
    assert.ok(lines.length > 0, 'should have at least one line');
    for (const line of lines) {
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        assert.fail(`line is not valid JSON in --raw mode: ${line}`);
      }
      assert.ok(obj.id, 'each line should have an id');
    }
  });
});
