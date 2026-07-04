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

module.exports = {
  buildGraph,
  refToNodeId,
  resolvePlanDepRef,
  parseKeyLinkItem,
  cmdGraphAnalyze,
  cmdGraphExport,
};
