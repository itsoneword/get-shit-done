/**
 * GSD Tools Tests - Graph (Phase 16 Plan 01: planning-graph model, Part A)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');

const { buildGraph, refToNodeId, resolvePlanDepRef } = require('../get-shit-done/bin/lib/graph.cjs');

describe('graph.cjs refToNodeId', () => {
  test('resolves "Phase 16" to phase:16', () => {
    assert.strictEqual(refToNodeId('Phase 16'), 'phase:16');
  });

  test('resolves bare "05-01" to plan:05-01', () => {
    assert.strictEqual(refToNodeId('05-01'), 'plan:05-01');
  });

  test('resolves "07-05-parallel-safety-gate" to plan:07-05 (slug suffix dropped)', () => {
    assert.strictEqual(refToNodeId('07-05-parallel-safety-gate'), 'plan:07-05');
  });

  test('returns null for unresolvable "existing"', () => {
    assert.strictEqual(refToNodeId('existing'), null);
  });

  test('returns null for unresolvable "add-backlog"', () => {
    assert.strictEqual(refToNodeId('add-backlog'), null);
  });

  test('returns null for unresolvable "future agentic phases"', () => {
    assert.strictEqual(refToNodeId('future agentic phases'), null);
  });
});

describe('graph.cjs resolvePlanDepRef', () => {
  test('cross-phase "05-01" with currentPhaseNum "05" resolves to plan:05-01', () => {
    assert.strictEqual(resolvePlanDepRef('05-01', '05'), 'plan:05-01');
  });

  test('bare same-phase "01" with currentPhaseNum "04" resolves to plan:04-01', () => {
    assert.strictEqual(resolvePlanDepRef('01', '04'), 'plan:04-01');
  });

  test('numeric frontmatter value 1 with currentPhaseNum "04" resolves to plan:04-01', () => {
    assert.strictEqual(resolvePlanDepRef(1, '04'), 'plan:04-01');
  });

  test('unresolvable "bogus" returns null', () => {
    assert.strictEqual(resolvePlanDepRef('bogus', '04'), null);
  });
});

describe('graph.cjs buildGraph (Part A: phase/plan nodes + depends_on edges)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function writePlan(phaseDir, phaseSlug, planNum, dependsOn, filesModified) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDir);
    fs.mkdirSync(dir, { recursive: true });
    const depsYaml = dependsOn.length > 0
      ? 'depends_on:\n' + dependsOn.map(d => `  - ${d}`).join('\n')
      : 'depends_on: []';
    const filesYaml = filesModified.length > 0
      ? 'files_modified:\n' + filesModified.map(f => `  - ${f}`).join('\n')
      : 'files_modified: []';
    const content = `---
phase: ${phaseSlug}
plan: "${planNum}"
type: auto
wave: 1
${depsYaml}
${filesYaml}
autonomous: true
---

<objective>Test plan</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
</task>
</tasks>
`;
    fs.writeFileSync(path.join(dir, `${phaseDir}-${planNum}-PLAN.md`), content);
  }

  function setupFixture() {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foo
**Goal:** Foo goal

### Phase 2: Bar
**Goal:** Bar goal
**Depends on:** Phase 1
`
    );
    writePlan('01-foo', '01-foo', '01', [], ['a.cjs', 'b.cjs']);
    writePlan('02-bar', '02-bar', '01', ['01-01'], ['b.cjs', 'c.cjs']);
    writePlan('02-bar', '02-bar', '02', [1], ['d.cjs']);
  }

  test('nodes include every phase and every plan found', () => {
    setupFixture();
    const { nodes } = buildGraph(tmpDir);
    const ids = nodes.map(n => n.id);
    assert.ok(ids.includes('phase:1'), 'phase:1 node present');
    assert.ok(ids.includes('phase:2'), 'phase:2 node present');
    assert.ok(ids.includes('plan:01-01'), 'plan:01-01 node present');
    assert.ok(ids.includes('plan:02-01'), 'plan:02-01 node present');
    assert.ok(ids.includes('plan:02-02'), 'plan:02-02 node present');
    const phase1 = nodes.find(n => n.id === 'phase:1');
    assert.strictEqual(phase1.type, 'phase');
    const plan0101 = nodes.find(n => n.id === 'plan:01-01');
    assert.strictEqual(plan0101.type, 'plan');
  });

  test('phase depends_on edge (roadmap_depends_on) produced from ROADMAP prose', () => {
    setupFixture();
    const { edges } = buildGraph(tmpDir);
    const found = edges.find(e => e.from === 'phase:2' && e.to === 'phase:1' && e.type === 'depends_on' && e.source === 'roadmap_depends_on');
    assert.ok(found, 'phase:2 -> phase:1 depends_on edge via roadmap_depends_on');
  });

  test('cross-phase plan_depends_on edge produced from PLAN frontmatter', () => {
    setupFixture();
    const { edges } = buildGraph(tmpDir);
    const found = edges.find(e => e.from === 'plan:02-01' && e.to === 'plan:01-01' && e.type === 'depends_on' && e.source === 'plan_depends_on');
    assert.ok(found, 'plan:02-01 -> plan:01-01 depends_on edge via plan_depends_on');
  });

  test('bare same-phase plan_depends_on edge resolves against the plan\'s own phase number', () => {
    setupFixture();
    const { edges } = buildGraph(tmpDir);
    const found = edges.find(e => e.from === 'plan:02-02' && e.to === 'plan:02-01' && e.type === 'depends_on' && e.source === 'plan_depends_on');
    assert.ok(found, 'plan:02-02 -> plan:02-01 depends_on edge via bare-form resolution');
  });

  test('files_modified overlap produces exactly one ordered edge, no mirrored duplicate', () => {
    setupFixture();
    const { edges } = buildGraph(tmpDir);
    const filesModifiedEdges = edges.filter(e => e.type === 'depends_on' && e.source === 'files_modified');
    assert.strictEqual(filesModifiedEdges.length, 1, 'exactly one files_modified edge (01-01/02-01 share b.cjs)');
    const e = filesModifiedEdges[0];
    assert.strictEqual(e.from, 'plan:01-01');
    assert.strictEqual(e.to, 'plan:02-01');
    assert.ok(e.from < e.to, 'from < to lexicographically');
  });

  test('nodes sorted ascending by id, edges sorted by (from,to,type,source) - deterministic output', () => {
    setupFixture();
    const g1 = buildGraph(tmpDir);
    const g2 = buildGraph(tmpDir);
    assert.strictEqual(JSON.stringify(g1), JSON.stringify(g2), 'buildGraph is deterministic (byte-identical across calls)');

    const ids = g1.nodes.map(n => n.id);
    const sortedIds = [...ids].sort();
    assert.deepStrictEqual(ids, sortedIds, 'nodes sorted ascending by id');

    const edgeKeys = g1.edges.map(e => `${e.from}|${e.to}|${e.type}|${e.source}`);
    const sortedEdgeKeys = [...edgeKeys].sort();
    assert.deepStrictEqual(edgeKeys, sortedEdgeKeys, 'edges sorted by (from,to,type,source)');
  });
});
