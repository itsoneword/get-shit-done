/**
 * Graph — Normalized planning-graph model (Phase 16, Part A)
 *
 * Pure module: reads phase/plan planning artifacts and builds a single
 * `{ nodes, edges }` model. No network, no process.exit — CLI dispatch
 * (`cmdGraphAnalyze`/`cmdGraphExport`) lands in Plan 16-02.
 *
 * REUSE rule (LOCKED, 16-CONTEXT.md): all ROADMAP phase-heading and
 * dependency-prose parsing goes through roadmap.cjs's exported
 * `parsePhaseSections`/`parseDependsOnPhaseRefs` — this file never
 * duplicates either regex.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { extractFrontmatter, parseMustHavesBlock } = require('./frontmatter.cjs');
const { phasesDir, planningPaths, extractCurrentMilestone } = require('./core.cjs');
const { parsePhaseSections, parseDependsOnPhaseRefs } = require('./roadmap.cjs');

/**
 * Resolve a free-form string that MAY start with a phase or plan reference
 * into a node id, or `null` if unresolvable.
 *
 * Used for `Phase N` prose and bare `NN-NN`/`NN-NN-slug` forms. NOT used for
 * todo references — todo slugs are date-prefixed and this pattern misparses
 * them (see Plan 16-02).
 *
 * @param {string} str
 * @returns {string|null}
 */
function refToNodeId(str) {
  if (typeof str !== 'string') return null;
  const m = str.trim().match(/^(?:Phase\s+)?(\d+[A-Z]?(?:\.\d+)*)(?:-(\d{2}))?/i);
  if (!m) return null;
  return m[2] ? `plan:${m[1]}-${m[2]}` : `phase:${m[1]}`;
}

/**
 * Resolve one PLAN frontmatter `depends_on` array item into a plan node id.
 *
 * PLAN frontmatter `depends_on` arrays contain EITHER a cross-phase `"NN-NN"`
 * string OR a bare same-phase `"NN"` string/number (e.g. `depends_on: [01]`
 * in a phase-04 plan means "this phase's own plan 01" -> `plan:04-01`).
 *
 * @param {string|number} item
 * @param {string} currentPhaseNum
 * @returns {string|null}
 */
function resolvePlanDepRef(item, currentPhaseNum) {
  if (typeof item !== 'string' && typeof item !== 'number') return null;
  const s = String(item).trim();
  const full = s.match(/^(\d+[A-Z]?(?:\.\d+)*)-(\d+)$/);
  if (full) return `plan:${full[1]}-${full[2].padStart(2, '0')}`;
  const bare = s.match(/^(\d+)$/);
  if (bare) return `plan:${currentPhaseNum}-${bare[1].padStart(2, '0')}`;
  return null;
}

/** Extract the leading phase number from a PLAN frontmatter `phase` slug (e.g. "16-planning-graph-model-cli" -> "16"). */
function phaseNumFromSlug(slug) {
  if (typeof slug !== 'string') return null;
  const m = slug.match(/^(\d+[A-Z]?(?:\.\d+)*)/);
  return m ? m[1] : null;
}

/**
 * Parse one PLAN `must_haves.key_links` item into a `{from, to}` pair, or
 * `null` if the item has no discernible from/to shape.
 *
 * Real items come in two shapes: a structured `{from, to}` object, or a
 * free-text arrow string (the majority shape in this repo's real PLAN.md
 * files) with an optional trailing `(broken = ...)` parenthetical to strip.
 *
 * @param {string|{from: string, to: string}} item
 * @returns {{from: string, to: string}|null}
 */
function parseKeyLinkItem(item) {
  if (item && typeof item === 'object' && item.from && item.to) {
    return { from: String(item.from).trim(), to: String(item.to).trim() };
  }
  if (typeof item === 'string') {
    const parts = item.split(/->|→/);
    if (parts.length >= 2) {
      const from = parts[0].trim().replace(/^["'`]|["'`]$/g, '');
      let to = parts.slice(1).join('->').trim();
      to = to.replace(/\s*\([^)]*\)\s*$/, ''); // strip trailing "(broken = ...)" parenthetical
      to = to.replace(/^["'`]|["'`]$/g, '').replace(/["'`]$/g, '');
      return { from, to };
    }
  }
  return null;
}

/**
 * Build the normalized planning-graph model for the current milestone.
 *
 * Part A slice (this plan): phase nodes, plan nodes, phase-to-phase
 * `depends_on` edges (ROADMAP prose), plan-to-plan `depends_on` edges (PLAN
 * frontmatter, cross-phase and bare same-phase forms), and undirected
 * plan-to-plan `depends_on` edges from `files_modified` overlap.
 *
 * @param {string} cwd
 * @returns {{ nodes: Array<{id: string, type: string}>, edges: Array<{from: string, to: string, type: string, source: string}> }}
 */
function buildGraph(cwd) {
  const nodeMap = new Map();
  const edgeSet = new Set();
  const edges = [];

  function addNode(id, type) {
    if (!nodeMap.has(id)) nodeMap.set(id, { id, type });
  }

  function addEdge(from, to, type, source) {
    const key = `${from}|${to}|${type}|${source}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ from, to, type, source });
  }

  // ── Phase nodes + phase depends_on edges (ROADMAP prose) ──────────────
  const roadmapPath = planningPaths(cwd).roadmap;
  let phaseSections = [];
  if (fs.existsSync(roadmapPath)) {
    const rawContent = fs.readFileSync(roadmapPath, 'utf-8');
    const content = extractCurrentMilestone(rawContent, cwd);
    phaseSections = parsePhaseSections(content);
  }

  for (const sec of phaseSections) {
    const phaseId = `phase:${sec.number}`;
    addNode(phaseId, 'phase');
    const depNodeIds = parseDependsOnPhaseRefs(sec.depends_on);
    for (const depId of depNodeIds) {
      addEdge(phaseId, depId, 'depends_on', 'roadmap_depends_on');
    }
  }

  // ── Plan nodes + plan depends_on edges (PLAN frontmatter) + files_modified overlap ──
  const dir = phasesDir(cwd);
  const planFiles = []; // { id, phaseNum, planNum, dependsOn, files: Set }

  let phaseDirEntries = [];
  try {
    phaseDirEntries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory());
  } catch { /* no phases dir yet */ }

  for (const entry of phaseDirEntries) {
    const phaseDirPath = path.join(dir, entry.name);
    let files = [];
    try {
      files = fs.readdirSync(phaseDirPath).filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
    } catch { /* unreadable phase dir */ }

    for (const file of files) {
      const fullPath = path.join(phaseDirPath, file);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch { continue; }

      const fm = extractFrontmatter(content);
      const phaseNum = phaseNumFromSlug(fm.phase);
      if (!phaseNum || fm.plan === undefined || fm.plan === null) continue;
      const planNum = String(fm.plan).padStart(2, '0');
      const planId = `plan:${phaseNum}-${planNum}`;

      addNode(planId, 'plan');

      const dependsOn = Array.isArray(fm.depends_on) ? fm.depends_on : [];
      const filesModified = Array.isArray(fm.files_modified) ? fm.files_modified : [];

      planFiles.push({
        id: planId,
        dependsOn,
        currentPhaseNum: phaseNum,
        files: new Set(filesModified),
      });

      // ── Source 2: PLAN must_haves.key_links -> wires edges + artifact nodes ──
      const keyLinkItems = parseMustHavesBlock(content, 'key_links');
      for (const item of keyLinkItems) {
        const link = parseKeyLinkItem(item);
        if (!link) continue;
        const fromId = `artifact:${link.from}`;
        const toId = `artifact:${link.to}`;
        addNode(fromId, 'artifact');
        addNode(toId, 'artifact');
        addEdge(fromId, toId, 'wires', 'plan_key_links');
      }
    }

    // ── Source 1: SUMMARY requires/affects -> provides/affects edges ──
    let summaryFiles = [];
    try {
      summaryFiles = fs.readdirSync(phaseDirPath).filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
    } catch { /* unreadable phase dir */ }

    for (const file of summaryFiles) {
      const fullPath = path.join(phaseDirPath, file);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch { continue; }

      const fm = extractFrontmatter(content);
      const phaseNum = phaseNumFromSlug(fm.phase);
      if (!phaseNum || fm.plan === undefined || fm.plan === null) continue;
      const planNum = String(fm.plan).padStart(2, '0');
      const thisPlanId = `plan:${phaseNum}-${planNum}`;

      const dg = fm.dependency_graph || fm;

      const requiresList = Array.isArray(dg.requires) ? dg.requires : [];
      for (const item of requiresList) {
        let ref = typeof item === 'string' ? item : (item && item.phase);
        // extractFrontmatter flattens `- phase: X` dash-list items (with a
        // `provides:` continuation line) into a bare "phase: X" string
        // rather than a real {phase, provides} object — normalize that
        // shape here rather than special-casing it at every call site.
        // NOTE: unrelated to the block-selection bug fixed in
        // frontmatter.cjs by the 16-03 gap-closure plan — this is a
        // separate, still-present per-item YAML-parsing limitation.
        if (typeof ref === 'string') {
          const m = ref.match(/^phase:\s*(.+)$/i);
          if (m) ref = m[1];
        }
        const target = refToNodeId(ref);
        if (target) {
          addEdge(target, thisPlanId, 'provides', 'summary_requires');
        }
      }

      const affectsList = Array.isArray(dg.affects) ? dg.affects : [];
      for (const item of affectsList) {
        const target = refToNodeId(item);
        if (target) {
          addEdge(thisPlanId, target, 'affects', 'summary_affects');
        }
      }
    }
  }

  // Plan depends_on edges
  for (const plan of planFiles) {
    for (const item of plan.dependsOn) {
      const target = resolvePlanDepRef(item, plan.currentPhaseNum);
      if (target) {
        addEdge(plan.id, target, 'depends_on', 'plan_depends_on');
      }
    }
  }

  // files_modified overlap edges (undirected — one ordered edge per pair)
  for (let i = 0; i < planFiles.length; i++) {
    for (let j = i + 1; j < planFiles.length; j++) {
      const a = planFiles[i];
      const b = planFiles[j];
      if (a.id === b.id) continue;
      let overlaps = false;
      for (const f of a.files) {
        if (b.files.has(f)) { overlaps = true; break; }
      }
      if (!overlaps) continue;
      const [from, to] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      addEdge(from, to, 'depends_on', 'files_modified');
    }
  }

  // ── Source 3: REQUIREMENTS.md traceability -> requirement nodes + satisfies edges ──
  const requirementsPath = planningPaths(cwd).requirements;
  if (fs.existsSync(requirementsPath)) {
    const reqContent = fs.readFileSync(requirementsPath, 'utf-8');
    const rowRe = /^\|\s*([A-Z][A-Z0-9-]*)\s*\|\s*([^|]+?)\s*\|/gm;
    let m;
    while ((m = rowRe.exec(reqContent)) !== null) {
      const reqId = m[1];
      if (reqId === 'Requirement') continue; // header row
      const phaseRef = refToNodeId(m[2]);
      addNode(`requirement:${reqId}`, 'requirement');
      if (phaseRef) {
        addEdge(`requirement:${reqId}`, phaseRef, 'satisfies', 'requirements_traceability');
      }
    }
  }

  // ── Source 4: todo depends_on/related_to -> todo nodes + depends_on edges ──
  const todoDirs = [
    path.join(cwd, '.planning', 'todos', 'pending'),
    path.join(cwd, '.planning', 'todos', 'done'),
  ];
  const todoFiles = []; // { id, dependsOn, relatedTo }
  for (const todoDir of todoDirs) {
    let entries = [];
    try {
      entries = fs.readdirSync(todoDir).filter(f => f.endsWith('.md'));
    } catch { continue; }
    for (const file of entries) {
      const slug = file.slice(0, -3);
      const todoId = `todo:${slug}`;
      addNode(todoId, 'todo');
      const fullPath = path.join(todoDir, file);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch { continue; }
      const fm = extractFrontmatter(content);
      todoFiles.push({
        id: todoId,
        dependsOn: Array.isArray(fm.depends_on) ? fm.depends_on : [],
        relatedTo: Array.isArray(fm.related_to) ? fm.related_to : [],
      });
    }
  }
  for (const todo of todoFiles) {
    for (const item of todo.dependsOn) {
      const target = `todo:${item}`;
      addEdge(todo.id, target, 'depends_on', 'todo_depends_on');
    }
    for (const item of todo.relatedTo) {
      const target = `todo:${item}`;
      addEdge(todo.id, target, 'depends_on', 'todo_related_to');
    }
  }

  const nodes = [...nodeMap.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  edges.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    return 0;
  });

  return { nodes, edges };
}

const NODE_TYPE_ORDER = ['phase', 'plan', 'requirement', 'todo', 'artifact'];
const EDGE_TYPE_ORDER = ['depends_on', 'provides', 'affects', 'satisfies', 'wires'];

const STRUCTURAL_EDGE_TYPES = ['depends_on', 'satisfies'];
const ADVISORY_EDGE_TYPES = ['provides', 'affects', 'wires'];

/**
 * `depends_on`-typed edges that do NOT encode a genuine ordering constraint
 * and must therefore be excluded from topoSort/detectCycles' traversal —
 * currently just `files_modified` (buildGraph's own docstring calls this
 * source "undirected plan-to-plan depends_on edges from files_modified
 * overlap": co-occurrence in the same files is not a dependency direction,
 * it is an arbitrary lexicographic pick to avoid a mirrored duplicate edge).
 * Treating it as a real ordering constraint produces false-positive cycles
 * whenever that arbitrary direction runs opposite a real declared
 * `plan_depends_on` edge between the same pair (discovered live-repo case:
 * plan:16-01/plan:16-02). Dangling-ref tiering (findDanglingEdges) is
 * unaffected — files_modified edges can never dangle (both endpoints come
 * from existing plans) so this exclusion has no bearing there.
 */
const NON_ORDERING_DEPENDS_ON_SOURCES = ['files_modified'];

/**
 * Kahn's algorithm topological sort over `depends_on` edges only. Edge
 * {from,to,type:'depends_on'} means "from depends on to" -> to must precede
 * from in the returned order. Dangling depends_on edges (endpoint not a real
 * node) are ignored here — dangling-ref reporting is validate's job via
 * findDanglingEdges, not topoSort's.
 *
 * @param {{nodes:Array,edges:Array}} graph
 * @returns {{order: string[], residual: string[]}} residual = nodes Kahn's
 *   could not linearize (cycle members AND anything downstream of a cycle —
 *   NOT cycle-membership-accurate; use detectCycles for that).
 */
function topoSort(graph) {
  const nodeIds = graph.nodes.map(n => n.id);
  const validIds = new Set(nodeIds);
  const adjacency = new Map(nodeIds.map(id => [id, []]));
  const inDegree = new Map(nodeIds.map(id => [id, 0]));

  for (const e of graph.edges) {
    if (e.type !== 'depends_on') continue;
    if (NON_ORDERING_DEPENDS_ON_SOURCES.includes(e.source)) continue;
    if (!validIds.has(e.from) || !validIds.has(e.to)) continue;
    adjacency.get(e.to).push(e.from);
    inDegree.set(e.from, inDegree.get(e.from) + 1);
  }

  const remaining = new Map(inDegree);
  const order = [];
  let ready = nodeIds.filter(id => remaining.get(id) === 0).sort();

  while (ready.length > 0) {
    const id = ready.shift();
    order.push(id);
    for (const next of adjacency.get(id).slice().sort()) {
      remaining.set(next, remaining.get(next) - 1);
      if (remaining.get(next) === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }

  const ordered = new Set(order);
  const residual = nodeIds.filter(id => !ordered.has(id)).sort();
  return { order, residual };
}

/**
 * Precise cycle detection over `depends_on` edges via Tarjan strongly-connected
 * components. Returns ONLY real cycle participants — a strongly-connected
 * component of size 1 is a cycle iff that node has a depends_on self-loop.
 * This deliberately does NOT use topoSort's `residual` (which over-reports
 * nodes merely downstream of a cycle).
 *
 * @param {{nodes:Array,edges:Array}} graph
 * @returns {string[][]} one array of node ids per distinct cycle, each sorted
 */
function detectCycles(graph) {
  const validIds = new Set(graph.nodes.map(n => n.id));
  const adjacency = new Map();
  for (const id of validIds) adjacency.set(id, []);
  const depEdges = graph.edges.filter(
    e => e.type === 'depends_on' && !NON_ORDERING_DEPENDS_ON_SOURCES.includes(e.source)
  );
  for (const e of depEdges) {
    if (!validIds.has(e.from) || !validIds.has(e.to)) continue;
    adjacency.get(e.from).push(e.to);
  }

  let index = 0;
  const indices = new Map();
  const lowlink = new Map();
  const onStack = new Map();
  const stack = [];
  const sccs = [];

  function strongconnect(v) {
    indices.set(v, index);
    lowlink.set(v, index);
    index += 1;
    stack.push(v);
    onStack.set(v, true);

    for (const w of adjacency.get(v).slice().sort()) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.get(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), indices.get(w)));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.set(w, false);
        component.push(w);
      } while (w !== v);
      sccs.push(component.sort());
    }
  }

  for (const id of [...validIds].sort()) {
    if (!indices.has(id)) strongconnect(id);
  }

  const selfLoops = new Set(depEdges.filter(e => e.from === e.to).map(e => e.from));
  return sccs
    .filter(c => c.length > 1 || selfLoops.has(c[0]))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/**
 * Dangling edges tiered by the edge's OWN type (not a hardcoded per-source
 * list) — every edge in the graph is checked, including `provides` edges
 * (which never gate validate's exit code but must still be surfaced).
 *
 * @param {{nodes:Array,edges:Array}} graph
 * @returns {{structural: Array, advisory: Array}} raw edge objects, tiered
 */
function findDanglingEdges(graph) {
  const validIds = new Set(graph.nodes.map(n => n.id));
  const structural = [];
  const advisory = [];
  for (const e of graph.edges) {
    if (validIds.has(e.from) && validIds.has(e.to)) continue;
    (STRUCTURAL_EDGE_TYPES.includes(e.type) ? structural : advisory).push(e);
  }
  return { structural, advisory };
}

/**
 * affects-vs-files_modified contradictions, both directions. Derived
 * entirely from graph.edges (files_modified overlap edges are
 * {type:'depends_on', source:'files_modified'}; affects edges are
 * {type:'affects'}) — no re-reading of PLAN/SUMMARY frontmatter.
 *
 * @param {{nodes:Array,edges:Array}} graph
 * @returns {Array<{kind:'declared-unsupported'|'file-overlap-undeclared', from:string, to:string, message:string}>}
 */
function findAffectsContradictions(graph) {
  const filesOverlapPairs = new Set(
    graph.edges
      .filter(e => e.type === 'depends_on' && e.source === 'files_modified')
      .map(e => `${e.from}|${e.to}`)
  );
  const affectsPlanEdges = graph.edges.filter(
    e => e.type === 'affects' && e.from.startsWith('plan:') && e.to.startsWith('plan:')
  );

  const contradictions = [];

  for (const e of affectsPlanEdges) {
    const [a, b] = [e.from, e.to].sort();
    if (!filesOverlapPairs.has(`${a}|${b}`)) {
      contradictions.push({
        kind: 'declared-unsupported',
        from: e.from,
        to: e.to,
        message: `${e.from} declares affects ${e.to} but files_modified shows no overlap between them`,
      });
    }
  }

  const affectsPairKeys = new Set(
    affectsPlanEdges.map(e => { const [a, b] = [e.from, e.to].sort(); return `${a}|${b}`; })
  );
  for (const key of filesOverlapPairs) {
    if (!affectsPairKeys.has(key)) {
      const [a, b] = key.split('|');
      contradictions.push({
        kind: 'file-overlap-undeclared',
        from: a,
        to: b,
        message: `${a} and ${b} share files_modified overlap but neither declares affects on the other`,
      });
    }
  }

  return contradictions;
}

/**
 * Single entry point combining cycles + tiered dangling refs + contradictions
 * — the ONE function both `cmdGraphValidate` (this plan) and Plan 17-02's
 * `/gsd2:health` integration call. Do not duplicate this detection logic
 * anywhere else.
 *
 * @param {{nodes:Array,edges:Array}} graph
 * @returns {{cycles: Array<{nodes:string[]}>, danglingStructural: Array, danglingAdvisory: Array, contradictions: Array}}
 */
function computeGraphIntegrity(graph) {
  const cycles = detectCycles(graph).map(nodes => ({ nodes }));
  const dangling = findDanglingEdges(graph);
  const contradictions = findAffectsContradictions(graph);
  return {
    cycles,
    danglingStructural: dangling.structural,
    danglingAdvisory: dangling.advisory,
    contradictions,
  };
}

/**
 * Forward BFS over affects/provides edges from `nodeId`. Level N (1-indexed)
 * = nodes reachable within N hops. `options.depth` bounds the number of
 * levels returned (unset/non-positive = unbounded = full closure).
 * `options.edgeTypes` overrides the traversed edge-type set (kept
 * parameterizable so Phase 18/19 consumers can reuse this for other edge
 * combinations).
 *
 * @param {{nodes:Array,edges:Array}} graph
 * @param {string} nodeId
 * @param {{depth?: number, edgeTypes?: string[]}} [options]
 * @returns {{found: boolean, node: string, levels?: string[][], closure?: string[]}}
 */
function blastRadius(graph, nodeId, options = {}) {
  const edgeTypes = options.edgeTypes || ['affects', 'provides'];
  const maxDepth = Number.isInteger(options.depth) && options.depth > 0 ? options.depth : Infinity;
  const validIds = new Set(graph.nodes.map(n => n.id));
  if (!validIds.has(nodeId)) return { found: false, node: nodeId };

  const adjacency = new Map();
  for (const id of validIds) adjacency.set(id, []);
  for (const e of graph.edges) {
    if (!edgeTypes.includes(e.type)) continue;
    if (!adjacency.has(e.from)) continue;
    adjacency.get(e.from).push(e.to);
  }

  const visited = new Set([nodeId]);
  const levels = [];
  let frontier = [nodeId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const next = new Set();
    for (const cur of frontier) {
      for (const nb of adjacency.get(cur) || []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          next.add(nb);
        }
      }
    }
    if (next.size === 0) break;
    depth += 1;
    levels.push([...next].sort());
    frontier = [...next];
  }

  return { found: true, node: nodeId, levels, closure: levels.flat() };
}

/**
 * Print a human-readable summary of the planning graph to stdout: node
 * counts by type, edge counts by type, and an adjacency listing.
 *
 * @param {string} cwd
 * @param {boolean} raw - ignored; this command IS the human-readable form.
 */
function cmdGraphAnalyze(cwd, raw) { // eslint-disable-line no-unused-vars
  const { nodes, edges } = buildGraph(cwd);

  const lines = [];
  lines.push('Planning Graph Analysis');
  lines.push('');

  lines.push(`Nodes: ${nodes.length} total`);
  for (const type of NODE_TYPE_ORDER) {
    const count = nodes.filter(n => n.type === type).length;
    if (count > 0) lines.push(`  ${type}: ${count}`);
  }
  lines.push('');

  lines.push(`Edges: ${edges.length} total`);
  for (const type of EDGE_TYPE_ORDER) {
    const count = edges.filter(e => e.type === type).length;
    if (count > 0) lines.push(`  ${type}: ${count}`);
  }
  lines.push('');

  const nodeIds = nodes.map(n => n.id).sort();
  for (const id of nodeIds) {
    const outgoing = edges.filter(e => e.from === id);
    if (outgoing.length === 0) continue;
    for (const e of outgoing) {
      lines.push(`${e.from} --${e.type}--> ${e.to} [${e.source}]`);
    }
  }

  process.stdout.write(lines.join('\n') + '\n');
}

/**
 * Print the planning graph as JSON to stdout: `{ nodes, edges }`.
 *
 * @param {string} cwd
 * @param {boolean} raw - ignored; JSON IS the machine-readable form.
 */
function cmdGraphExport(cwd, raw) { // eslint-disable-line no-unused-vars
  const { nodes, edges } = buildGraph(cwd);
  process.stdout.write(JSON.stringify({ nodes, edges }, null, 2) + '\n');
}

/**
 * Print/exit-code graph integrity validation: cycles + tiered dangling refs
 * + affects-vs-files_modified contradictions. Structural findings (cycles,
 * dangling depends_on/satisfies) are fatal; advisory findings (dangling
 * provides/affects/wires, contradictions) are reported but exit-zero unless
 * `--strict` is passed.
 *
 * @param {string} cwd
 * @param {{strict?: boolean}} options
 * @param {boolean} raw
 */
function cmdGraphValidate(cwd, options, raw) {
  const graphModel = buildGraph(cwd);
  const integrity = computeGraphIntegrity(graphModel);
  const strict = !!options.strict;

  const structural = [
    ...integrity.cycles.map(c => ({
      code: 'E-GRAPH-CYCLE',
      message: `Dependency cycle: ${c.nodes.join(' -> ')}`,
      nodes: c.nodes,
    })),
    ...integrity.danglingStructural.map(e => ({
      code: 'E-GRAPH-DANGLING',
      message: `Dangling ${e.type} edge (${e.source}): ${e.from} -> ${e.to}`,
      edge: e,
    })),
  ];
  const advisory = [
    ...integrity.danglingAdvisory.map(e => ({
      code: 'I-GRAPH-DANGLING',
      message: `Dangling ${e.type} edge (${e.source}): ${e.from} -> ${e.to}`,
      edge: e,
    })),
    ...integrity.contradictions.map(c => ({
      code: 'I-GRAPH-CONTRADICTION',
      message: c.message,
      kind: c.kind,
      from: c.from,
      to: c.to,
    })),
  ];

  const failingCount = strict ? structural.length + advisory.length : structural.length;
  const exitCode = failingCount > 0 ? 1 : 0;

  const result = {
    status: exitCode === 0 ? 'clean' : 'failed',
    strict,
    structural_count: structural.length,
    advisory_count: advisory.length,
    structural,
    advisory,
  };

  if (raw) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    const lines = [];
    lines.push('Graph Validate');
    lines.push('');
    lines.push(`Structural: ${structural.length} (fatal)`);
    for (const f of structural) lines.push(`  [${f.code}] ${f.message}`);
    lines.push('');
    lines.push(`Advisory: ${advisory.length}${strict ? ' (fatal — --strict active)' : ' (reported only, exit-zero)'}`);
    for (const f of advisory) lines.push(`  [${f.code}] ${f.message}`);
    lines.push('');
    lines.push(exitCode === 0 ? 'Result: PASS' : 'Result: FAIL');
    process.stdout.write(lines.join('\n') + '\n');
  }
  process.exit(exitCode);
}

/**
 * Print/exit-code the forward affects/provides transitive closure from
 * `nodeId`, grouped by hop level. Unrecognized node id exits non-zero with a
 * clear error, never a crash.
 *
 * @param {string} cwd
 * @param {string} nodeId
 * @param {{depth?: number}} options
 * @param {boolean} raw
 */
function cmdGraphBlastRadius(cwd, nodeId, options, raw) {
  const graphModel = buildGraph(cwd);
  const result = blastRadius(graphModel, nodeId, options);

  if (!result.found) {
    const message = `Unknown node: ${nodeId} — not present in the planning graph`;
    if (raw) {
      process.stdout.write(JSON.stringify({ found: false, node: nodeId, error: message }, null, 2) + '\n');
    } else {
      process.stderr.write(`Error: ${message}\n`);
    }
    process.exit(1);
  }

  if (raw) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    const lines = [];
    lines.push(`Blast Radius: ${nodeId}`);
    lines.push('');
    if (result.levels.length === 0) {
      lines.push('(no affects/provides edges reachable)');
    } else {
      result.levels.forEach((level, i) => {
        lines.push(`Level ${i + 1} (${level.length}):`);
        for (const id of level) lines.push(`  ${id}`);
      });
    }
    process.stdout.write(lines.join('\n') + '\n');
  }
  process.exit(0);
}

module.exports = {
  buildGraph,
  refToNodeId,
  resolvePlanDepRef,
  parseKeyLinkItem,
  cmdGraphAnalyze,
  cmdGraphExport,
  STRUCTURAL_EDGE_TYPES,
  ADVISORY_EDGE_TYPES,
  topoSort,
  detectCycles,
  findDanglingEdges,
  findAffectsContradictions,
  computeGraphIntegrity,
  blastRadius,
  cmdGraphValidate,
  cmdGraphBlastRadius,
};
