/**
 * GSD Tools Tests - Graph (Phase 16 Plan 01: planning-graph model, Part A)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const { buildGraph, refToNodeId, resolvePlanDepRef, parseKeyLinkItem } = require('../get-shit-done/bin/lib/graph.cjs');

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

// ─────────────────────────────────────────────────────────────────────────
// Plan 16-02: remaining buildGraph edge sources + graph CLI
// ─────────────────────────────────────────────────────────────────────────

describe('graph.cjs parseKeyLinkItem', () => {
  test('structured {from,to} object passes through', () => {
    assert.deepStrictEqual(parseKeyLinkItem({ from: 'a.cjs', to: 'b.cjs' }), { from: 'a.cjs', to: 'b.cjs' });
  });

  test('arrow-string form splits on -> and strips trailing parenthetical', () => {
    assert.deepStrictEqual(
      parseKeyLinkItem('plan-phase step 5.6 grep -> UI-SPEC check (broken = ignores domain classification)'),
      { from: 'plan-phase step 5.6 grep', to: 'UI-SPEC check' }
    );
  });

  test('no arrow returns null', () => {
    assert.strictEqual(parseKeyLinkItem('no arrow here'), null);
  });
});

describe('graph.cjs buildGraph (Source 1: SUMMARY requires/affects)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('nested dependency_graph form: requires -> provides edge, affects -> affects edge', () => {
    const dir = path.join(tmpDir, '.planning', 'phases', '02-bar');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '02-02-SUMMARY.md'), `---
phase: 02-bar
plan: "02"
subsystem: infra
tags: []
dependency_graph:
  requires:
    - phase: "01-01"
      provides: "some helper"
  affects:
    - "02-01"
duration: 5min
completed: 2026-07-04
---

# Summary
`);
    const { edges } = buildGraph(tmpDir);
    assert.ok(edges.some(e => e.from === 'plan:01-01' && e.to === 'plan:02-02' && e.type === 'provides' && e.source === 'summary_requires'));
    assert.ok(edges.some(e => e.from === 'plan:02-02' && e.to === 'plan:02-01' && e.type === 'affects' && e.source === 'summary_affects'));
  });

  test('flat top-level form: requires string form resolves; unresolvable affects entry produces no edge', () => {
    const dir = path.join(tmpDir, '.planning', 'phases', '03-baz');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '03-01-SUMMARY.md'), `---
phase: 03-baz
plan: "01"
subsystem: infra
tags: []
requires:
  - "01-01 (helper)"
affects:
  - "add-backlog"
duration: 5min
completed: 2026-07-04
---

# Summary
`);
    const { nodes, edges } = buildGraph(tmpDir);
    assert.ok(edges.some(e => e.from === 'plan:01-01' && e.to === 'plan:03-01' && e.type === 'provides' && e.source === 'summary_requires'));
    const affectsEdges = edges.filter(e => e.source === 'summary_affects');
    assert.strictEqual(affectsEdges.length, 0, 'unresolvable affects entry produces no edge');
    assert.ok(!nodes.some(n => n.id.includes('add-backlog')), 'no fabricated node for unresolvable affects entry');
  });
});

describe('graph.cjs buildGraph (Source 2: PLAN key_links wires)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('structured and arrow-string key_links both produce wires edges + artifact nodes', () => {
    const dir = path.join(tmpDir, '.planning', 'phases', '04-qux');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '04-01-PLAN.md'), `---
phase: 04-qux
plan: "01"
type: auto
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  key_links:
    - from: "x.cjs"
      to: "y.cjs"
    - "z.cjs -> w.cjs (broken = ...)"
---

<objective>Test plan</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
</task>
</tasks>
`);
    const { nodes, edges } = buildGraph(tmpDir);
    assert.ok(edges.some(e => e.from === 'artifact:x.cjs' && e.to === 'artifact:y.cjs' && e.type === 'wires' && e.source === 'plan_key_links'));
    assert.ok(edges.some(e => e.from === 'artifact:z.cjs' && e.to === 'artifact:w.cjs' && e.type === 'wires' && e.source === 'plan_key_links'));
    for (const id of ['artifact:x.cjs', 'artifact:y.cjs', 'artifact:z.cjs', 'artifact:w.cjs']) {
      assert.ok(nodes.some(n => n.id === id), `${id} node present`);
    }
  });
});

describe('graph.cjs buildGraph (Source 3: REQUIREMENTS.md traceability)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('requirement rows produce requirement nodes + satisfies edges to phase', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), `# Requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRAPH-01 | Phase 16 | Pending |
| GRAPH-02 | Phase 16 | Pending |
`);
    const { nodes, edges } = buildGraph(tmpDir);
    assert.ok(nodes.some(n => n.id === 'requirement:GRAPH-01' && n.type === 'requirement'));
    assert.ok(nodes.some(n => n.id === 'requirement:GRAPH-02' && n.type === 'requirement'));
    assert.ok(edges.some(e => e.from === 'requirement:GRAPH-01' && e.to === 'phase:16' && e.type === 'satisfies' && e.source === 'requirements_traceability'));
  });
});

describe('graph.cjs buildGraph (Source 4: todo depends_on/related_to)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  function writeTodo(name, extraFrontmatter) {
    const dir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.md`), `---
created: 2026-07-04T00:00:00.000Z
title: ${name}
area: tooling
${extraFrontmatter}
---

## Problem
`);
  }

  test('depends_on and related_to both produce todo->todo depends_on edges (distinct source)', () => {
    writeTodo('todo-a', '');
    writeTodo('todo-b', 'depends_on:\n  - todo-a\nrelated_to: []');
    writeTodo('todo-c', 'related_to:\n  - todo-a');

    const { edges } = buildGraph(tmpDir);
    assert.ok(edges.some(e => e.from === 'todo:todo-b' && e.to === 'todo:todo-a' && e.type === 'depends_on' && e.source === 'todo_depends_on'));
    assert.ok(edges.some(e => e.from === 'todo:todo-c' && e.to === 'todo:todo-a' && e.type === 'depends_on' && e.source === 'todo_related_to'));
  });

  test('date-prefixed dangling todo reference is retained as a dangling edge, never misparsed via refToNodeId', () => {
    writeTodo('2026-07-04-real-slug-example', "depends_on:\n  - '2026-01-01-nonexistent-slug-that-was-never-created'");

    const { nodes, edges } = buildGraph(tmpDir);
    assert.ok(edges.some(e =>
      e.from === 'todo:2026-07-04-real-slug-example' &&
      e.to === 'todo:2026-01-01-nonexistent-slug-that-was-never-created' &&
      e.type === 'depends_on' &&
      e.source === 'todo_depends_on'
    ), 'dangling todo depends_on edge retained');
    assert.ok(!nodes.some(n => n.id === 'todo:2026-01-01-nonexistent-slug-that-was-never-created'), 'target node absent (genuinely dangling)');
    assert.ok(!nodes.some(n => /^plan:2026-/.test(n.id)), 'no fabricated plan: node from date-prefixed slug misparse');
  });
});

describe('gsd-tools graph CLI', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const dir = path.join(tmpDir, '.planning', 'phases', '01-foo');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '01-01-PLAN.md'), `---
phase: 01-foo
plan: "01"
type: auto
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>Test plan</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
</task>
</tasks>
`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('graph analyze exits 0 and prints Nodes/Edges summary', () => {
    const result = runGsdTools(['graph', 'analyze'], tmpDir);
    assert.strictEqual(result.success, true, result.error);
    assert.ok(result.output.includes('Nodes:'));
    assert.ok(result.output.includes('Edges:'));
  });

  test('graph export exits 0 and prints parseable JSON with array nodes/edges', () => {
    const result = runGsdTools(['graph', 'export'], tmpDir);
    assert.strictEqual(result.success, true, result.error);
    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.nodes));
    assert.ok(Array.isArray(parsed.edges));
  });

  test('graph bogus subcommand exits non-zero', () => {
    const result = runGsdTools(['graph', 'bogus'], tmpDir);
    assert.strictEqual(result.success, false);
  });
});
