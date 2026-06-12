/**
 * GSD Tools Tests — Discuss Loop (discuss-loop subcommand)
 *
 * Tests for: discuss-loop validate, discuss-loop delta, discuss-loop survivors,
 *            discuss-loop loop-id, discuss-loop transcript
 *
 * RED phase: lib/discuss-loop.cjs and the discuss-loop dispatch case do not yet exist.
 *
 * Requirements: LOOP-01 (grounding, referential integrity), LOOP-02 (no-synthesis,
 *               deterministic convergence)
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ── Fixture helpers ──────────────────────────────────────────────────────────

/**
 * A valid skeptic round-1 position block per the locked schema.
 * The anchor "the loop spawns three lenses" must be a verbatim substring
 * of the artifact file written by writeArtifact().
 */
function validBlock(overrides) {
  const base = {
    lens: 'skeptic',
    round: 1,
    position: 'reject',
    modification: null,
    blocking: true,
    summary: 'The design has significant risks that need addressing.',
    constraints: [
      {
        id: 'skeptic-r1-c1',
        statement: 'Spawning three lenses without independent context isolation may cause contamination.',
        anchor: 'the loop spawns three lenses',
        severity: 'blocking',
        status: 'new',
        carries: null,
      },
    ],
  };
  return Object.assign({}, base, overrides);
}

/**
 * Write an artifact file into the temp project.
 * The content contains "the loop spawns three lenses" so anchors can be verified.
 */
function writeArtifact(tmp, filename) {
  filename = filename || 'artifact.md';
  const content = [
    '# Design Document',
    '',
    'This document describes the multi-lens discussion loop.',
    'In the proposed design, the loop spawns three lenses in parallel.',
    'Each lens judges the artifact independently.',
    '',
    'The orchestrator computes convergence between rounds.',
  ].join('\n');
  const filePath = path.join(tmp, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// ── discuss-loop validate ─────────────────────────────────────────────────────

describe('discuss-loop validate - valid block', () => {
  let tmp;
  let artifactPath;

  beforeEach(() => {
    tmp = createTempProject();
    artifactPath = writeArtifact(tmp);
  });
  afterEach(() => { cleanup(tmp); });

  test('TC-1: valid round-1 block with --artifact → exit 0, stdout contains "valid"', () => {
    const block = validBlock();
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block), '--artifact', artifactPath],
      tmp
    );
    assert.ok(result.success, `validate should succeed: ${result.error}`);
    assert.ok(result.output.includes('valid'), `output should contain "valid", got: ${result.output}`);
  });
});

describe('discuss-loop validate - anchor checks (LOOP-01)', () => {
  let tmp;
  let artifactPath;

  beforeEach(() => {
    tmp = createTempProject();
    artifactPath = writeArtifact(tmp);
  });
  afterEach(() => { cleanup(tmp); });

  test('TC-2: anchor="" → exit 1, output mentions "anchor"', () => {
    const block = validBlock({
      constraints: [
        { id: 'skeptic-r1-c1', statement: 'some statement', anchor: '', severity: 'blocking', status: 'new', carries: null },
      ],
    });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block), '--artifact', artifactPath],
      tmp
    );
    assert.ok(!result.success, 'should fail for empty anchor');
    assert.ok(
      result.output.includes('anchor') || result.error.includes('anchor'),
      `output should mention anchor, got stdout: ${result.output}, stderr: ${result.error}`
    );
  });

  test('TC-3: anchor not a substring of artifact content → exit 1, output mentions "anchor"', () => {
    const block = validBlock({
      constraints: [
        {
          id: 'skeptic-r1-c1',
          statement: 'some statement',
          anchor: 'this text is definitely not in the artifact file at all',
          severity: 'blocking',
          status: 'new',
          carries: null,
        },
      ],
    });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block), '--artifact', artifactPath],
      tmp
    );
    assert.ok(!result.success, 'should fail when anchor not found in artifact');
    assert.ok(
      result.output.includes('anchor') || result.error.includes('anchor'),
      `output should mention anchor, got stdout: ${result.output}, stderr: ${result.error}`
    );
  });
});

describe('discuss-loop validate - field validation', () => {
  let tmp;

  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('TC-4: position="modify" with modification=null → exit 1, output mentions "modification"', () => {
    const block = validBlock({ position: 'modify', modification: null });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block)],
      tmp
    );
    assert.ok(!result.success, 'should fail for modify with null modification');
    assert.ok(
      result.output.includes('modification') || result.error.includes('modification'),
      `output should mention modification, got stdout: ${result.output}, stderr: ${result.error}`
    );
  });

  test('TC-5: lens="optimist" → exit 1 (invalid lens enum)', () => {
    const block = validBlock({ lens: 'optimist' });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block)],
      tmp
    );
    assert.ok(!result.success, 'should fail for invalid lens');
  });

  test('TC-6: position="endorse" → exit 1 (invalid position enum)', () => {
    const block = validBlock({ position: 'endorse' });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block)],
      tmp
    );
    assert.ok(!result.success, 'should fail for invalid position');
  });

  test('TC-7: blocking="true" (string not boolean) → exit 1, output mentions "blocking"', () => {
    const block = validBlock({ blocking: 'true' });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block)],
      tmp
    );
    assert.ok(!result.success, 'should fail for blocking as string');
    assert.ok(
      result.output.includes('blocking') || result.error.includes('blocking'),
      `output should mention blocking, got stdout: ${result.output}, stderr: ${result.error}`
    );
  });

  test('TC-8: constraint status="carried" with carries=null → exit 1, output mentions "carries"', () => {
    const block = validBlock({
      constraints: [
        { id: 'skeptic-r1-c1', statement: 'stmt', anchor: 'the loop spawns three lenses', severity: 'blocking', status: 'carried', carries: null },
      ],
    });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block)],
      tmp
    );
    assert.ok(!result.success, 'should fail for carried with null carries');
    assert.ok(
      result.output.includes('carries') || result.error.includes('carries'),
      `output should mention carries, got stdout: ${result.output}, stderr: ${result.error}`
    );
  });
});

describe('discuss-loop validate - referential integrity (LOOP-01 carried)', () => {
  let tmp;

  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('TC-9: round-2 block with carries="skeptic-r1-c9" and prior=["skeptic-r1-c1"] → exit 1 (referential integrity)', () => {
    const block = {
      lens: 'skeptic',
      round: 2,
      position: 'reject',
      modification: null,
      blocking: true,
      summary: 'Still blocking.',
      constraints: [
        { id: 'skeptic-r2-c1', statement: 'stmt', anchor: 'the loop spawns three lenses', severity: 'blocking', status: 'carried', carries: 'skeptic-r1-c9' },
      ],
    };
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '2', '--data', JSON.stringify(block), '--prior', JSON.stringify(['skeptic-r1-c1'])],
      tmp
    );
    assert.ok(!result.success, 'should fail when carries id not in prior');
  });

  test('TC-10: round-2 block with carries="skeptic-r1-c1" and prior=["skeptic-r1-c1"] → exit 0 (valid carried)', () => {
    const block = {
      lens: 'skeptic',
      round: 2,
      position: 'reject',
      modification: null,
      blocking: true,
      summary: 'Still blocking.',
      constraints: [
        { id: 'skeptic-r2-c1', statement: 'stmt', anchor: 'the loop spawns three lenses', severity: 'blocking', status: 'carried', carries: 'skeptic-r1-c1' },
      ],
    };
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '2', '--data', JSON.stringify(block), '--prior', JSON.stringify(['skeptic-r1-c1'])],
      tmp
    );
    assert.ok(result.success, `should pass with valid carried ref: ${result.error}`);
  });

  test('TC-11: block.round=1 passed with --round 2 → exit 1 (round mismatch)', () => {
    const block = validBlock({ round: 1 });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '2', '--data', JSON.stringify(block)],
      tmp
    );
    assert.ok(!result.success, 'should fail for round mismatch');
  });
});

describe('discuss-loop validate - constraint field validation', () => {
  let tmp;

  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('TC-12: severity="fatal" → exit 1 (invalid severity enum)', () => {
    const block = validBlock({
      constraints: [
        { id: 'skeptic-r1-c1', statement: 'stmt', anchor: 'the loop spawns three lenses', severity: 'fatal', status: 'new', carries: null },
      ],
    });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block)],
      tmp
    );
    assert.ok(!result.success, 'should fail for invalid severity');
  });

  test('TC-13: id="skeptic-c1" (missing -rN-) → exit 1 (id format)', () => {
    const block = validBlock({
      constraints: [
        { id: 'skeptic-c1', statement: 'stmt', anchor: 'the loop spawns three lenses', severity: 'blocking', status: 'new', carries: null },
      ],
    });
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', JSON.stringify(block)],
      tmp
    );
    assert.ok(!result.success, 'should fail for invalid id format');
  });

  test('TC-14: --data "not json" → exit 1', () => {
    const result = runGsdTools(
      ['discuss-loop', 'validate', '--round', '1', '--data', 'not json'],
      tmp
    );
    assert.ok(!result.success, 'should fail for invalid JSON');
  });
});

// ── discuss-loop delta ────────────────────────────────────────────────────────

describe('discuss-loop delta - convergence logic (TC-ORCH-1)', () => {
  let tmp;

  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('TC-15: three blocks, one with blocking:true → converged:false, blocking_lenses has that lens', () => {
    const blocks = [
      { lens: 'skeptic', round: 1, position: 'reject', modification: null, blocking: true, summary: 's', constraints: [] },
      { lens: 'user-advocate', round: 1, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] },
      { lens: 'architect', round: 1, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] },
    ];
    const result = runGsdTools(
      ['discuss-loop', 'delta', '--round', '1', '--data', JSON.stringify(blocks)],
      tmp
    );
    assert.ok(result.success, `delta should succeed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.converged, false, 'should not be converged when a lens is blocking');
    assert.ok(Array.isArray(out.blocking_lenses), 'blocking_lenses should be an array');
    assert.ok(out.blocking_lenses.includes('skeptic'), 'blocking_lenses should contain skeptic');
  });

  test('TC-16: all blocking:false but one constraint status="new" → converged:false, new_constraint_ids contains that id', () => {
    const blocks = [
      {
        lens: 'skeptic', round: 1, position: 'accept', modification: null, blocking: false, summary: 's',
        constraints: [{ id: 'skeptic-r1-c1', statement: 'st', anchor: 'a', severity: 'non-blocking', status: 'new', carries: null }],
      },
      { lens: 'user-advocate', round: 1, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] },
      { lens: 'architect', round: 1, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] },
    ];
    const result = runGsdTools(
      ['discuss-loop', 'delta', '--round', '1', '--data', JSON.stringify(blocks)],
      tmp
    );
    assert.ok(result.success, `delta should succeed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.converged, false, 'should not be converged with new constraint');
    assert.ok(out.new_constraint_ids.includes('skeptic-r1-c1'), 'new_constraint_ids should include the new constraint id');
  });

  test('TC-17: all blocking:false, every constraint status="carried" → converged:true, carried_count correct, new_constraint_ids=[]', () => {
    const blocks = [
      {
        lens: 'skeptic', round: 2, position: 'accept', modification: null, blocking: false, summary: 's',
        constraints: [{ id: 'skeptic-r2-c1', statement: 'st', anchor: 'a', severity: 'non-blocking', status: 'carried', carries: 'skeptic-r1-c1' }],
      },
      {
        lens: 'user-advocate', round: 2, position: 'accept', modification: null, blocking: false, summary: 's',
        constraints: [{ id: 'user-advocate-r2-c1', statement: 'st', anchor: 'a', severity: 'non-blocking', status: 'carried', carries: 'user-advocate-r1-c1' }],
      },
      { lens: 'architect', round: 2, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] },
    ];
    const result = runGsdTools(
      ['discuss-loop', 'delta', '--round', '2', '--data', JSON.stringify(blocks)],
      tmp
    );
    assert.ok(result.success, `delta should succeed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.converged, true, 'should be converged when no blocking and no new constraints');
    assert.strictEqual(out.carried_count, 2, 'carried_count should equal total carried constraints');
    assert.deepStrictEqual(out.new_constraint_ids, [], 'new_constraint_ids should be empty');
  });

  test('TC-18: --degraded flag → degraded:true; without flag → degraded:false; type="round_delta", round matches --round', () => {
    const blocks = [
      { lens: 'skeptic', round: 1, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] },
      { lens: 'architect', round: 1, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] },
    ];

    const degradedResult = runGsdTools(
      ['discuss-loop', 'delta', '--round', '1', '--data', JSON.stringify(blocks), '--degraded'],
      tmp
    );
    assert.ok(degradedResult.success, `delta with --degraded should succeed: ${degradedResult.error}`);
    const degradedOut = JSON.parse(degradedResult.output);
    assert.strictEqual(degradedOut.degraded, true, 'degraded should be true with --degraded flag');
    assert.strictEqual(degradedOut.type, 'round_delta', 'type should be "round_delta"');
    assert.strictEqual(degradedOut.round, 1, 'round should match --round');

    const normalResult = runGsdTools(
      ['discuss-loop', 'delta', '--round', '1', '--data', JSON.stringify(blocks)],
      tmp
    );
    assert.ok(normalResult.success, `delta without --degraded should succeed: ${normalResult.error}`);
    const normalOut = JSON.parse(normalResult.output);
    assert.strictEqual(normalOut.degraded, false, 'degraded should be false without --degraded flag');
  });
});

// ── discuss-loop survivors ────────────────────────────────────────────────────

describe('discuss-loop survivors - no-synthesis and filtering (TC-ORCH-2 / LOOP-02)', () => {
  let tmp;

  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('TC-19: lens with position="accept" and zero blocking constraints excluded from output', () => {
    const acceptingLens = { lens: 'user-advocate', round: 1, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] };
    const blockingLens = { lens: 'skeptic', round: 1, position: 'reject', modification: null, blocking: true, summary: 's', constraints: [
      { id: 'skeptic-r1-c1', statement: 'st', anchor: 'a', severity: 'blocking', status: 'new', carries: null },
    ]};
    const rounds = [[acceptingLens, blockingLens]];
    const result = runGsdTools(
      ['discuss-loop', 'survivors', '--data', JSON.stringify(rounds)],
      tmp
    );
    assert.ok(result.success, `survivors should succeed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.ok(Array.isArray(out), 'output should be an array');
    const lenses = out.map(s => s.lens);
    assert.ok(!lenses.includes('user-advocate'), 'user-advocate (accept, no blocking) should be excluded');
    assert.ok(lenses.includes('skeptic'), 'skeptic (blocking) should be included');
  });

  test('TC-20: two surviving lenses ordered by divergence weight descending, each has {lens, weight, block}', () => {
    const skepticBlock = {
      lens: 'skeptic', round: 1, position: 'reject', modification: null, blocking: true, summary: 's',
      constraints: [
        { id: 'skeptic-r1-c1', statement: 'st1', anchor: 'a1', severity: 'blocking', status: 'new', carries: null },
        { id: 'skeptic-r1-c2', statement: 'st2', anchor: 'a2', severity: 'blocking', status: 'new', carries: null },
      ],
    };
    const architectBlock = {
      lens: 'architect', round: 1, position: 'reject', modification: null, blocking: true, summary: 's',
      constraints: [
        { id: 'architect-r1-c1', statement: 'st3', anchor: 'a3', severity: 'blocking', status: 'new', carries: null },
      ],
    };
    const rounds = [[skepticBlock, architectBlock]];
    const result = runGsdTools(
      ['discuss-loop', 'survivors', '--data', JSON.stringify(rounds)],
      tmp
    );
    assert.ok(result.success, `survivors should succeed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.length, 2, 'should have 2 survivors');
    assert.ok(out[0].hasOwnProperty('lens'), 'element should have lens');
    assert.ok(out[0].hasOwnProperty('weight'), 'element should have weight');
    assert.ok(out[0].hasOwnProperty('block'), 'element should have block');
    assert.ok(out[0].weight >= out[1].weight, 'should be ordered descending by weight');
    assert.strictEqual(out[0].lens, 'skeptic', 'skeptic (2 unique blocking) should be first');
    assert.strictEqual(out[1].lens, 'architect', 'architect (1 unique blocking) should be second');
  });

  test('TC-21: shared-root constraints count toward neither lens weight', () => {
    // skeptic round 1 has skeptic-r1-c1 (new)
    const skepticR1 = {
      lens: 'skeptic', round: 1, position: 'reject', modification: null, blocking: true, summary: 's',
      constraints: [
        { id: 'skeptic-r1-c1', statement: 'root st', anchor: 'a', severity: 'blocking', status: 'new', carries: null },
      ],
    };
    // skeptic round 2: carries skeptic-r1-c1
    const skepticR2 = {
      lens: 'skeptic', round: 2, position: 'reject', modification: null, blocking: true, summary: 's',
      constraints: [
        { id: 'skeptic-r2-c1', statement: 'carried st', anchor: 'a', severity: 'blocking', status: 'carried', carries: 'skeptic-r1-c1' },
      ],
    };
    // architect round 2: also carries skeptic-r1-c1 (same root — shared)
    const architectR2 = {
      lens: 'architect', round: 2, position: 'reject', modification: null, blocking: true, summary: 's',
      constraints: [
        { id: 'architect-r2-c1', statement: 'carried arch', anchor: 'b', severity: 'blocking', status: 'carried', carries: 'skeptic-r1-c1' },
      ],
    };
    const rounds = [
      [skepticR1, { lens: 'architect', round: 1, position: 'accept', modification: null, blocking: false, summary: 's', constraints: [] }],
      [skepticR2, architectR2],
    ];
    const result = runGsdTools(
      ['discuss-loop', 'survivors', '--data', JSON.stringify(rounds)],
      tmp
    );
    assert.ok(result.success, `survivors should succeed: ${result.error}`);
    const out = JSON.parse(result.output);
    // Both are survivors (blocking), but shared root means weight=0 for both
    for (const survivor of out) {
      assert.strictEqual(survivor.weight, 0, `shared-root constraint should not contribute to weight (lens: ${survivor.lens})`);
    }
  });

  test('TC-22: no-synthesis — blocks pass through verbatim (deepStrictEqual)', () => {
    const skepticBlock = {
      lens: 'skeptic', round: 1, position: 'reject', modification: null, blocking: true, summary: 'skeptic summary',
      constraints: [
        { id: 'skeptic-r1-c1', statement: 'exact statement', anchor: 'exact anchor text', severity: 'blocking', status: 'new', carries: null },
      ],
    };
    const architectBlock = {
      lens: 'architect', round: 1, position: 'reject', modification: null, blocking: true, summary: 'architect summary',
      constraints: [],
    };
    const rounds = [[skepticBlock, architectBlock]];
    const result = runGsdTools(
      ['discuss-loop', 'survivors', '--data', JSON.stringify(rounds)],
      tmp
    );
    assert.ok(result.success, `survivors should succeed: ${result.error}`);
    const out = JSON.parse(result.output);
    // Build a map for lookup
    const byLens = {};
    for (const s of out) byLens[s.lens] = s.block;

    // Each block must be structurally identical to the input final-round block
    assert.deepStrictEqual(byLens['skeptic'], skepticBlock, 'skeptic block must be verbatim (no-synthesis)');
    assert.deepStrictEqual(byLens['architect'], architectBlock, 'architect block must be verbatim (no-synthesis)');
  });
});

// ── discuss-loop loop-id ──────────────────────────────────────────────────────

describe('discuss-loop loop-id - id generation', () => {
  let tmp;

  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('TC-23: without GSD_RUN_ID → matches /^loop-...-[a-z0-9-]+$/ with sanitized slug, no "--" suffix', () => {
    const envWithout = { ...process.env };
    delete envWithout.GSD_RUN_ID;

    const result = runGsdTools(
      ['discuss-loop', 'loop-id', 'docs/PLAN v2.md'],
      tmp,
      { env: envWithout }
    );
    assert.ok(result.success, `loop-id should succeed: ${result.error}`);
    const id = result.output.trim();
    assert.match(id, /^loop-\d{4}-\d{2}-\d{2}T[\dT-]+-[a-z0-9-]+$/, `id should match pattern, got: ${id}`);
    // slug should contain sanitized version of the ref
    assert.ok(id.includes('docs-plan-v2-md') || id.includes('docs-plan') || id.includes('plan'), `id should contain slug from ref, got: ${id}`);
    // No -- suffix when no GSD_RUN_ID
    assert.ok(!id.includes('--'), `id should not contain "--" when no GSD_RUN_ID, got: ${id}`);
  });

  test('TC-24: with GSD_RUN_ID="run-test1" → stdout ends with "--run-test1"', () => {
    const envWith = { ...process.env, GSD_RUN_ID: 'run-test1' };
    const result = runGsdTools(
      ['discuss-loop', 'loop-id', 'docs/x.md'],
      tmp,
      { env: envWith }
    );
    assert.ok(result.success, `loop-id with GSD_RUN_ID should succeed: ${result.error}`);
    const id = result.output.trim();
    assert.ok(id.endsWith('--run-test1'), `id should end with "--run-test1", got: ${id}`);
  });
});

// ── discuss-loop transcript ───────────────────────────────────────────────────

describe('discuss-loop transcript - append-only JSONL', () => {
  let tmp;

  beforeEach(() => { tmp = createTempProject(); });
  afterEach(() => { cleanup(tmp); });

  test('TC-25: first append → exit 0; transcript file exists with 1 line; has type, loop_id, ISO ts', () => {
    const loopId = 'loop-test-tc25';
    const record = {
      type: 'loop_start',
      artifact: { kind: 'file', ref: 'x.md' },
      question: 'Should we proceed?',
      run_id: null,
      interactive: true,
    };
    const result = runGsdTools(
      ['discuss-loop', 'transcript', loopId, '--data', JSON.stringify(record)],
      tmp
    );
    assert.ok(result.success, `transcript append should succeed: ${result.error}`);

    const transcriptPath = path.join(tmp, '.planning', 'discuss-loop', loopId, 'transcript.jsonl');
    assert.ok(fs.existsSync(transcriptPath), `transcript file should exist at ${transcriptPath}`);

    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 1, 'should have exactly 1 line after first append');

    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.type, 'loop_start', 'type should be "loop_start"');
    assert.strictEqual(parsed.loop_id, loopId, 'loop_id should match the arg');
    assert.ok(parsed.ts, 'ts should be set');
    assert.ok(!isNaN(Date.parse(parsed.ts)), 'ts should be a valid ISO date');
  });

  test('TC-26: second append → file has 2 lines, line 1 is byte-identical to before (append-only)', () => {
    const loopId = 'loop-test-tc26';
    const record1 = { type: 'loop_start', artifact: { kind: 'file', ref: 'x.md' }, question: 'q', run_id: null, interactive: true };
    const record2 = { type: 'round_delta', round: 1, blocking_lenses: [], new_constraint_ids: [], carried_count: 0, converged: false, degraded: false };

    runGsdTools(['discuss-loop', 'transcript', loopId, '--data', JSON.stringify(record1)], tmp);

    const transcriptPath = path.join(tmp, '.planning', 'discuss-loop', loopId, 'transcript.jsonl');
    const lineAfterFirst = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(l => l.trim() !== '')[0];

    runGsdTools(['discuss-loop', 'transcript', loopId, '--data', JSON.stringify(record2)], tmp);

    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 2, 'should have exactly 2 lines after second append');
    assert.strictEqual(lines[0], lineAfterFirst, 'line 1 should be byte-identical to before (append-only)');
  });

  test('TC-27: --data missing "type" field → exit 1, no file write', () => {
    const loopId = 'loop-test-tc27';
    const record = { artifact: { kind: 'file', ref: 'x.md' }, question: 'q' };
    const result = runGsdTools(
      ['discuss-loop', 'transcript', loopId, '--data', JSON.stringify(record)],
      tmp
    );
    assert.ok(!result.success, 'should fail when type field missing');

    const transcriptPath = path.join(tmp, '.planning', 'discuss-loop', loopId, 'transcript.jsonl');
    assert.ok(!fs.existsSync(transcriptPath), 'transcript file should not be created when validation fails');
  });

  test('TC-28: --data "not json" → exit 1', () => {
    const loopId = 'loop-test-tc28';
    const result = runGsdTools(
      ['discuss-loop', 'transcript', loopId, '--data', 'not json'],
      tmp
    );
    assert.ok(!result.success, 'should fail for invalid JSON');
  });
});
