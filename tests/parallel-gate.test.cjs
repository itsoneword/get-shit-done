/**
 * GSD Tools Tests - Parallel Gate (SC2 + SC3 read-half)
 *
 * Tests for gsd-tools parallel-safe <A> <B>
 * Verifies axis-B (depends_on edge → refuse) and axis-A (files overlap → warn)
 * decision rules, including todo edge reading (SC3).
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup, withStateMilestone } = require('./helpers.cjs');

// ── Fixture helpers ────────────────────────────────────────────────────────────

/**
 * Write a minimal ROADMAP.md with the given phases into a temp project.
 * phases: [{ number, name, dependsOn, sequenceAfter }]
 *   dependsOn: string like "Phase 6" or null
 *   sequenceAfter: string like "Phase 3" or null (soft ordering line, optional)
 */
function writeRoadmap(tmpDir, phases) {
  const lines = ['# Roadmap v1.5\n\n## Phases\n'];
  for (const p of phases) {
    lines.push(`### Phase ${p.number}: ${p.name || 'Phase ' + p.number}`);
    if (p.dependsOn) {
      lines.push(`**Depends on**: ${p.dependsOn}`);
    } else {
      lines.push(`**Depends on**: Nothing`);
    }
    if (p.sequenceAfter) {
      lines.push(`**Sequence after**: ${p.sequenceAfter}`);
    }
    lines.push(`**Goal**: Test phase ${p.number}\n`);
  }
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), lines.join('\n'));
}

/**
 * Write a minimal PLAN.md for a phase, with given files_modified.
 */
function writePhasePlan(tmpDir, phaseNum, planNum, filesModified) {
  const phasesDir = path.join(tmpDir, '.planning', 'phases');
  const paddedPhase = String(phaseNum).padStart(2, '0');
  const paddedPlan = String(planNum).padStart(2, '0');
  const phaseDir = path.join(phasesDir, `${paddedPhase}-test-phase-${phaseNum}`);
  fs.mkdirSync(phaseDir, { recursive: true });

  const files = Array.isArray(filesModified) ? filesModified : [];
  const filesYaml = files.length > 0
    ? 'files_modified:\n' + files.map(f => `  - ${f}`).join('\n')
    : 'files_modified: []';

  const content = `---
phase: ${paddedPhase}
plan: ${paddedPlan}
type: execute
wave: 1
autonomous: true
depends_on: []
${filesYaml}
---

<objective>Test plan</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
</task>
</tasks>
`;
  fs.writeFileSync(path.join(phaseDir, `${paddedPhase}-${paddedPlan}-PLAN.md`), content);
}

/**
 * Write a todo file with optional depends_on/related_to fields.
 */
function writeTodo(tmpDir, slug, { title = 'Test todo', area = 'tooling', dependsOn, relatedTo } = {}) {
  const todosDir = path.join(tmpDir, '.planning', 'todos', 'pending');
  fs.mkdirSync(todosDir, { recursive: true });

  const depLine = dependsOn ? `depends_on:\n${dependsOn.map(d => `  - ${d}`).join('\n')}` : '';
  const relLine = relatedTo ? `related_to:\n${relatedTo.map(r => `  - ${r}`).join('\n')}` : '';

  const content = `---
created: 2026-06-08T00:00:00Z
title: ${title}
area: ${area}
${depLine}
${relLine}
---

# ${title}

This is a test todo.
`;
  fs.writeFileSync(path.join(todosDir, `${slug}.md`), content);
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('parallel-safe gate', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Use legacy layout (no milestone partition) for simplicity
    withStateMilestone(tmpDir, 'v1.5');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('refuses when A depends on B (axis-B coupling)', () => {
    // Phase 7 depends_on Phase 6 → hard refuse
    writeRoadmap(tmpDir, [
      { number: '6', name: 'Foundation' },
      { number: '7', name: 'Next', dependsOn: 'Phase 6' },
    ]);
    writePhasePlan(tmpDir, 6, 1, ['src/foo.js']);
    writePhasePlan(tmpDir, 7, 1, ['src/bar.js']);

    const result = runGsdTools(['parallel-safe', '6', '7'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decision, 'refuse', 'should refuse on axis-B coupling');
    assert.strictEqual(output.safe, false, 'should not be safe');
    assert.strictEqual(output.axis_b_coupled, true, 'should flag axis_b_coupled');
  });

  test('refuses when B depends on A (reverse direction)', () => {
    // Phase 6 depends_on Phase 7 (reverse edge)
    writeRoadmap(tmpDir, [
      { number: '6', name: 'Foundation', dependsOn: 'Phase 7' },
      { number: '7', name: 'Next' },
    ]);
    writePhasePlan(tmpDir, 6, 1, ['src/foo.js']);
    writePhasePlan(tmpDir, 7, 1, ['src/bar.js']);

    const result = runGsdTools(['parallel-safe', '6', '7'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decision, 'refuse', 'should refuse on reverse axis-B coupling');
    assert.strictEqual(output.axis_b_coupled, true, 'should flag axis_b_coupled');
  });

  test('warns on file overlap (axis-A only, no depends_on edge)', () => {
    // Two phases share files_modified but no depends_on
    writeRoadmap(tmpDir, [
      { number: '3', name: 'Alpha' },
      { number: '4', name: 'Beta' },
    ]);
    writePhasePlan(tmpDir, 3, 1, ['src/shared.js', 'src/alpha.js']);
    writePhasePlan(tmpDir, 4, 1, ['src/shared.js', 'src/beta.js']);

    const result = runGsdTools(['parallel-safe', '3', '4'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decision, 'warn', 'should warn on axis-A overlap only');
    assert.strictEqual(output.safe, false, 'should not be safe');
    assert.strictEqual(output.axis_a_overlap, true, 'should flag axis_a_overlap');
    assert.ok(output.overlap_files.includes('src/shared.js'), 'overlap_files should list shared file');
  });

  test('greenlights truly disjoint phases (no edge, no file overlap)', () => {
    writeRoadmap(tmpDir, [
      { number: '1', name: 'Alpha' },
      { number: '2', name: 'Beta' },
    ]);
    writePhasePlan(tmpDir, 1, 1, ['src/alpha.js']);
    writePhasePlan(tmpDir, 2, 1, ['src/beta.js']);

    const result = runGsdTools(['parallel-safe', '1', '2'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decision, 'greenlight', 'should greenlight disjoint phases');
    assert.strictEqual(output.safe, true, 'should be safe');
    assert.strictEqual(output.axis_b_coupled, false, 'no axis_b coupling');
    assert.strictEqual(output.axis_a_overlap, false, 'no axis_a overlap');
  });

  test('greenlights same unit (A == B, Pitfall 4 — N/A case)', () => {
    writeRoadmap(tmpDir, [
      { number: '5', name: 'Solo' },
    ]);
    writePhasePlan(tmpDir, 5, 1, ['src/solo.js']);

    const result = runGsdTools(['parallel-safe', '5', '5'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decision, 'greenlight', 'same unit → greenlight (N/A for parallelism)');
    assert.strictEqual(output.safe, true, 'same unit is safe');
  });

  test('refuses when todo depends_on a phase (SC3 — gate reads todo edges)', () => {
    // Todo with depends_on: [phase:6] vs phase 6 → axis-B refuse
    writeRoadmap(tmpDir, [
      { number: '6', name: 'Foundation' },
    ]);
    writePhasePlan(tmpDir, 6, 1, ['src/foundation.js']);
    // Date-prefixed slug (realistic case — starts with digit, advisor pitfall 2)
    writeTodo(tmpDir, '260508-u0b-my-task', {
      title: 'My task',
      area: 'tooling',
      dependsOn: ['phase:6'],
    });

    const result = runGsdTools(['parallel-safe', '260508-u0b-my-task', '6'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decision, 'refuse', 'todo with phase depends_on → refuse');
    assert.strictEqual(output.axis_b_coupled, true, 'should flag axis_b_coupled for todo edge');
  });

  test('greenlights phases coupled only by sequence_after (soft edge, no hard depends_on)', () => {
    // Phase 4 sequence_after Phase 3 — soft ordering only, no depends_on edge, disjoint files
    writeRoadmap(tmpDir, [
      { number: '3', name: 'Foundation' },
      { number: '4', name: 'Next', sequenceAfter: 'Phase 3' },
    ]);
    writePhasePlan(tmpDir, 3, 1, ['src/foo.js']);
    writePhasePlan(tmpDir, 4, 1, ['src/bar.js']);

    const result = runGsdTools(['parallel-safe', '3', '4'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decision, 'greenlight', 'sequence_after-only coupling must not refuse');
    assert.strictEqual(output.safe, true, 'should be safe');
    assert.strictEqual(output.axis_b_coupled, false, 'sequence_after must not trigger axis_b_coupled');
  });

  test('refuses on hard depends_on even when an unrelated sequence_after is also present', () => {
    // Phase 8 depends_on Phase 7 (hard) AND sequence_after Phase 9 (soft, unrelated) — hard edge must still refuse
    writeRoadmap(tmpDir, [
      { number: '7', name: 'Foundation' },
      { number: '8', name: 'Next', dependsOn: 'Phase 7', sequenceAfter: 'Phase 9' },
      { number: '9', name: 'Unrelated' },
    ]);
    writePhasePlan(tmpDir, 7, 1, ['src/foo.js']);
    writePhasePlan(tmpDir, 8, 1, ['src/bar.js']);
    writePhasePlan(tmpDir, 9, 1, ['src/baz.js']);

    const result = runGsdTools(['parallel-safe', '7', '8'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decision, 'refuse', 'hard depends_on must still refuse regardless of unrelated sequence_after');
    assert.strictEqual(output.axis_b_coupled, true, 'hard edge should flag axis_b_coupled');
  });

  test('output always contains required JSON fields', () => {
    writeRoadmap(tmpDir, [
      { number: '1', name: 'A' },
      { number: '2', name: 'B' },
    ]);
    writePhasePlan(tmpDir, 1, 1, []);
    writePhasePlan(tmpDir, 2, 1, []);

    const result = runGsdTools(['parallel-safe', '1', '2'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}\nOutput: ${result.output}`);

    const output = JSON.parse(result.output);
    assert.ok('safe' in output, 'output should have safe field');
    assert.ok('axis_b_coupled' in output, 'output should have axis_b_coupled field');
    assert.ok('axis_a_overlap' in output, 'output should have axis_a_overlap field');
    assert.ok('overlap_files' in output, 'output should have overlap_files field');
    assert.ok('decision' in output, 'output should have decision field');
    assert.ok('reason' in output, 'output should have reason field');
  });
});
