/**
 * GSD Tools Tests - Graph (Phase 16 Plan 01: planning-graph model, Part A)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const {
  buildGraph, refToNodeId, resolvePlanDepRef, parseKeyLinkItem,
  topoSort, detectCycles, findDanglingEdges, findAffectsContradictions,
  computeGraphIntegrity, blastRadius,
} = require('../get-shit-done/bin/lib/graph.cjs');

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
    - phase: 01-01
      provides: some helper
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

// ─────────────────────────────────────────────────────────────────────────
// Plan 17-01: graph algorithms + integrity checks
// ─────────────────────────────────────────────────────────────────────────

describe('graph.cjs topoSort', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  function writePlan(phaseDir, planNum, dependsOn) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDir);
    fs.mkdirSync(dir, { recursive: true });
    const depsYaml = dependsOn.length > 0
      ? 'depends_on:\n' + dependsOn.map(d => `  - ${d}`).join('\n')
      : 'depends_on: []';
    fs.writeFileSync(path.join(dir, `${phaseDir}-${planNum}-PLAN.md`), `---
phase: ${phaseDir}
plan: "${planNum}"
type: auto
wave: 1
${depsYaml}
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
  }

  test('order places dependencies before dependents (Kahn), residual empty for acyclic graph', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 1: Foo
**Goal:** Foo goal

### Phase 2: Bar
**Goal:** Bar goal
**Depends on:** Phase 1
`);
    writePlan('01-foo', '01', []);
    writePlan('02-bar', '01', ['01-01']);
    writePlan('02-bar', '02', [1]);

    const graph = buildGraph(tmpDir);
    const { order, residual } = topoSort(graph);

    assert.ok(order.indexOf('phase:1') < order.indexOf('phase:2'), 'phase:1 before phase:2');
    assert.ok(order.indexOf('plan:01-01') < order.indexOf('plan:02-01'), 'plan:01-01 before plan:02-01');
    assert.ok(order.indexOf('plan:02-01') < order.indexOf('plan:02-02'), 'plan:02-01 before plan:02-02');
    assert.deepStrictEqual(residual, []);
  });
});

describe('graph.cjs detectCycles', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('precise cycle participants only - node merely downstream of a cycle never appears in any cycle', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 3: Foo
**Goal:** g
**Depends on:** Phase 4

### Phase 4: Bar
**Goal:** g
**Depends on:** Phase 3

### Phase 5: Baz
**Goal:** g
**Depends on:** Phase 4
`);
    const graph = buildGraph(tmpDir);
    const cycles = detectCycles(graph);

    assert.strictEqual(cycles.length, 1, 'exactly one cycle detected');
    assert.deepStrictEqual(cycles[0], ['phase:3', 'phase:4']);
    assert.ok(!cycles.some(c => c.includes('phase:5')), 'phase:5 (downstream of cycle, not a member) must never appear in a reported cycle');
  });
});

describe('graph.cjs findDanglingEdges', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  function writePlan(phaseDir, planNum, dependsOn) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDir);
    fs.mkdirSync(dir, { recursive: true });
    const depsYaml = dependsOn.length > 0
      ? 'depends_on:\n' + dependsOn.map(d => `  - "${d}"`).join('\n')
      : 'depends_on: []';
    fs.writeFileSync(path.join(dir, `${phaseDir}-${planNum}-PLAN.md`), `---
phase: ${phaseDir}
plan: "${planNum}"
type: auto
wave: 1
${depsYaml}
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
  }

  test('dangling plan depends_on ref is structural, not advisory', () => {
    writePlan('01-foo', '01', ['99-01']);
    const graph = buildGraph(tmpDir);
    const { structural, advisory } = findDanglingEdges(graph);
    assert.ok(structural.some(e => e.from === 'plan:01-01' && e.to === 'plan:99-01' && e.type === 'depends_on'));
    assert.ok(!advisory.some(e => e.to === 'plan:99-01'));
  });

  test('dangling SUMMARY affects ref (no matching ROADMAP phase) is advisory, not structural', () => {
    const dir = path.join(tmpDir, '.planning', 'phases', '01-foo');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '01-01-SUMMARY.md'), `---
phase: 01-foo
plan: "01"
subsystem: infra
tags: []
affects:
  - "Phase 42"
duration: 5min
completed: 2026-07-04
---

# Summary
`);
    const graph = buildGraph(tmpDir);
    const { structural, advisory } = findDanglingEdges(graph);
    assert.ok(advisory.some(e => e.to === 'phase:42' && e.type === 'affects'));
    assert.ok(!structural.some(e => e.to === 'phase:42'));
  });

  test('dangling nested requires ref produces a dangling provides edge, tiered advisory (never gates but must be surfaced)', () => {
    const dir = path.join(tmpDir, '.planning', 'phases', '01-foo');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '01-01-SUMMARY.md'), `---
phase: 01-foo
plan: "01"
subsystem: infra
tags: []
dependency_graph:
  requires:
    - phase: Phase 42
      provides: something
duration: 5min
completed: 2026-07-04
---

# Summary
`);
    const graph = buildGraph(tmpDir);
    const { structural, advisory } = findDanglingEdges(graph);
    assert.ok(advisory.some(e => e.from === 'phase:42' && e.to === 'plan:01-01' && e.type === 'provides'));
    assert.ok(!structural.some(e => e.from === 'phase:42'));
  });
});

describe('graph.cjs findAffectsContradictions', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  function writePlan(phaseDir, planNum, filesModified) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDir);
    fs.mkdirSync(dir, { recursive: true });
    const filesYaml = filesModified.length > 0
      ? 'files_modified:\n' + filesModified.map(f => `  - ${f}`).join('\n')
      : 'files_modified: []';
    fs.writeFileSync(path.join(dir, `${phaseDir}-${planNum}-PLAN.md`), `---
phase: ${phaseDir}
plan: "${planNum}"
type: auto
wave: 1
depends_on: []
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
`);
  }

  function writeSummaryAffects(phaseDir, planNum, affectsList) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${phaseDir}-${planNum}-SUMMARY.md`), `---
phase: ${phaseDir}
plan: "${planNum}"
subsystem: infra
tags: []
affects:
${affectsList.map(a => `  - "${a}"`).join('\n')}
duration: 5min
completed: 2026-07-04
---

# Summary
`);
  }

  test('file-overlap-undeclared: shared files_modified with no affects edge between the pair', () => {
    writePlan('10-foo', '01', ['shared.cjs']);
    writePlan('10-foo', '02', ['shared.cjs']);
    const graph = buildGraph(tmpDir);
    const contradictions = findAffectsContradictions(graph);
    assert.ok(contradictions.some(c =>
      c.kind === 'file-overlap-undeclared' && [c.from, c.to].sort().join('|') === 'plan:10-01|plan:10-02'
    ));
  });

  test('declared-unsupported: affects declared with no files_modified overlap', () => {
    writePlan('11-foo', '01', []);
    writePlan('11-foo', '02', []);
    writeSummaryAffects('11-foo', '01', ['11-02']);
    const graph = buildGraph(tmpDir);
    const contradictions = findAffectsContradictions(graph);
    assert.ok(contradictions.some(c =>
      c.kind === 'declared-unsupported' && c.from === 'plan:11-01' && c.to === 'plan:11-02'
    ));
  });

  test('no contradiction when both files_modified overlap AND affects edge exist for the same pair (regression guard)', () => {
    writePlan('12-foo', '01', ['shared12.cjs']);
    writePlan('12-foo', '02', ['shared12.cjs']);
    writeSummaryAffects('12-foo', '01', ['12-02']);
    const graph = buildGraph(tmpDir);
    const contradictions = findAffectsContradictions(graph);
    assert.ok(!contradictions.some(c => [c.from, c.to].sort().join('|') === 'plan:12-01|plan:12-02'));
  });
});

describe('graph.cjs computeGraphIntegrity', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('combines cycles + tiered dangling refs + contradictions into one object', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 6: Foo
**Goal:** g
**Depends on:** Phase 7

### Phase 7: Bar
**Goal:** g
**Depends on:** Phase 6
`);

    const dir08 = path.join(tmpDir, '.planning', 'phases', '08-baz');
    fs.mkdirSync(dir08, { recursive: true });
    fs.writeFileSync(path.join(dir08, '08-01-PLAN.md'), `---
phase: 08-baz
plan: "01"
type: auto
wave: 1
depends_on:
  - "99-01"
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
    fs.writeFileSync(path.join(dir08, '08-01-SUMMARY.md'), `---
phase: 08-baz
plan: "01"
subsystem: infra
tags: []
affects:
  - "Phase 42"
duration: 5min
completed: 2026-07-04
---

# Summary
`);

    const dir09 = path.join(tmpDir, '.planning', 'phases', '09-qux');
    fs.mkdirSync(dir09, { recursive: true });
    for (const n of ['01', '02']) {
      fs.writeFileSync(path.join(dir09, `09-${n}-PLAN.md`), `---
phase: 09-qux
plan: "${n}"
type: auto
wave: 1
depends_on: []
files_modified:
  - shared09.cjs
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
    }

    const graph = buildGraph(tmpDir);
    const integrity = computeGraphIntegrity(graph);

    assert.ok('cycles' in integrity && 'danglingStructural' in integrity && 'danglingAdvisory' in integrity && 'contradictions' in integrity);
    assert.ok(integrity.cycles.some(c => JSON.stringify(c.nodes) === JSON.stringify(['phase:6', 'phase:7'])));
    assert.ok(integrity.danglingStructural.some(e => e.from === 'plan:08-01' && e.to === 'plan:99-01'));
    assert.ok(integrity.danglingAdvisory.some(e => e.to === 'phase:42'));
    assert.ok(integrity.contradictions.some(c =>
      c.kind === 'file-overlap-undeclared' && [c.from, c.to].sort().join('|') === 'plan:09-01|plan:09-02'
    ));
  });
});

describe('graph.cjs blastRadius', () => {
  function makeChainGraph() {
    return {
      nodes: [
        { id: 'plan:A', type: 'plan' },
        { id: 'plan:B', type: 'plan' },
        { id: 'plan:C', type: 'plan' },
        { id: 'plan:D', type: 'plan' },
      ],
      edges: [
        { from: 'plan:A', to: 'plan:B', type: 'affects', source: 'summary_affects' },
        { from: 'plan:B', to: 'plan:C', type: 'affects', source: 'summary_affects' },
        { from: 'plan:C', to: 'plan:D', type: 'affects', source: 'summary_affects' },
      ],
    };
  }

  test('unbounded (no depth) returns the full closure grouped by hop level', () => {
    const graph = makeChainGraph();
    const result = blastRadius(graph, 'plan:A');
    assert.deepStrictEqual(result.levels, [['plan:B'], ['plan:C'], ['plan:D']]);
    assert.deepStrictEqual(result.closure, ['plan:B', 'plan:C', 'plan:D']);
  });

  test('depth: 1 bounds output to level 1 only', () => {
    const graph = makeChainGraph();
    const result = blastRadius(graph, 'plan:A', { depth: 1 });
    assert.strictEqual(result.levels.length, 1);
    assert.deepStrictEqual(result.levels[0], ['plan:B']);
  });

  test('depth: 2 bounds output to levels 1-2, excludes level 3', () => {
    const graph = makeChainGraph();
    const result = blastRadius(graph, 'plan:A', { depth: 2 });
    assert.strictEqual(result.levels.length, 2);
    assert.deepStrictEqual(result.levels[1], ['plan:C']);
  });

  test('unrecognized node argument returns found:false, never crashes', () => {
    const graph = makeChainGraph();
    const result = blastRadius(graph, 'plan:does-not-exist');
    assert.deepStrictEqual(result, { found: false, node: 'plan:does-not-exist' });
  });
});

describe('gsd-tools graph validate/blast-radius CLI', () => {
  let tmpDir;

  afterEach(() => { cleanup(tmpDir); });

  function writePlan(phaseDir, planNum, dependsOn = [], filesModified = []) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDir);
    fs.mkdirSync(dir, { recursive: true });
    const depsYaml = dependsOn.length > 0
      ? 'depends_on:\n' + dependsOn.map(d => `  - "${d}"`).join('\n')
      : 'depends_on: []';
    const filesYaml = filesModified.length > 0
      ? 'files_modified:\n' + filesModified.map(f => `  - ${f}`).join('\n')
      : 'files_modified: []';
    fs.writeFileSync(path.join(dir, `${phaseDir}-${planNum}-PLAN.md`), `---
phase: ${phaseDir}
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
`);
  }

  function writeSummaryAffects(phaseDir, planNum, affectsList) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${phaseDir}-${planNum}-SUMMARY.md`), `---
phase: ${phaseDir}
plan: "${planNum}"
subsystem: infra
tags: []
affects:
${affectsList.map(a => `  - "${a}"`).join('\n')}
duration: 5min
completed: 2026-07-04
---

# Summary
`);
  }

  test('validate on acyclic graph exits 0 and prints Result: PASS', () => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 1: Foo
**Goal:** g

### Phase 2: Bar
**Goal:** g
**Depends on:** Phase 1
`);
    writePlan('01-foo', '01');
    writePlan('02-bar', '01', ['01-01']);
    const result = runGsdTools(['graph', 'validate'], tmpDir);
    assert.strictEqual(result.success, true, result.error);
    assert.ok(result.output.includes('Result: PASS'));
  });

  test('validate --raw on acyclic graph reports status clean and structural_count 0', () => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 1: Foo
**Goal:** g
`);
    writePlan('01-foo', '01');
    const result = runGsdTools(['graph', 'validate', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, result.error);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.status, 'clean');
    assert.strictEqual(parsed.structural_count, 0);
  });

  test('validate on cyclic graph exits non-zero and names the actual cycle members', () => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 3: Foo
**Goal:** g
**Depends on:** Phase 4

### Phase 4: Bar
**Goal:** g
**Depends on:** Phase 3
`);
    const result = runGsdTools(['graph', 'validate'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.output.includes('phase:3'));
    assert.ok(result.output.includes('phase:4'));
  });

  test('--strict promotes an advisory-only finding to fatal (plain validate stays exit-zero)', () => {
    tmpDir = createTempProject();
    writePlan('10-foo', '01', [], ['shared.cjs']);
    writePlan('10-foo', '02', [], ['shared.cjs']);
    const plain = runGsdTools(['graph', 'validate'], tmpDir);
    assert.strictEqual(plain.success, true, plain.error);
    const strict = runGsdTools(['graph', 'validate', '--strict'], tmpDir);
    assert.strictEqual(strict.success, false);
  });

  test('blast-radius prints leveled output for a known node', () => {
    tmpDir = createTempProject();
    writePlan('13-foo', '01');
    writePlan('13-foo', '02');
    writeSummaryAffects('13-foo', '01', ['13-02']);
    const result = runGsdTools(['graph', 'blast-radius', 'plan:13-01'], tmpDir);
    assert.strictEqual(result.success, true, result.error);
    assert.ok(result.output.includes('Level 1'));
  });

  test('blast-radius --raw returns JSON with a levels array', () => {
    tmpDir = createTempProject();
    writePlan('14-foo', '01');
    writePlan('14-foo', '02');
    writeSummaryAffects('14-foo', '01', ['14-02']);
    const result = runGsdTools(['graph', 'blast-radius', 'plan:14-01', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, result.error);
    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.levels));
  });

  test('blast-radius on an unrecognized node exits non-zero, never a crash', () => {
    tmpDir = createTempProject();
    const result = runGsdTools(['graph', 'blast-radius', 'plan:does-not-exist'], tmpDir);
    assert.strictEqual(result.success, false);
  });
});
