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
const { extractFrontmatter } = require('./frontmatter.cjs');
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

module.exports = {
  buildGraph,
  refToNodeId,
  resolvePlanDepRef,
};
