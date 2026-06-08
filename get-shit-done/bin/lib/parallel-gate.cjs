/**
 * Parallel Gate — deterministic safety check for concurrent GSD unit execution
 *
 * Decides whether two units (phases OR todos) can run concurrently:
 *   - axis_b_coupled (depends_on edge in either direction) → decision: "refuse", safe: false
 *   - axis_a_overlap only (shared files_modified, no axis-B edge)  → decision: "warn",  safe: false
 *   - neither                                                        → decision: "greenlight", safe: true
 *
 * Same-unit (A == B): greenlight/skip — continuing one unit is not a new parallel set (Pitfall 4).
 *
 * Reads:
 *   - Phase depends_on: via `gsd-tools roadmap analyze --raw` JSON (shells out — cmd fns call process.exit)
 *   - Phase files_modified: via `gsd-tools phase-plan-index <N> --raw` JSON (shells out)
 *   - Todo edges: reads .planning/todos/pending/<slug>.md or completed/<slug>.md frontmatter directly
 *
 * Resolution order (pitfall 2 from advisory):
 *   1. If slug matches an existing todo file → treat as todo (date-prefixed slugs start with digit)
 *   2. Otherwise → treat as phase number
 *
 * related_to on todos: context-only, does NOT trigger axis-B coupling (documented choice).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error, planningPaths } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Shell out to gsd-tools and parse JSON output.
 * Returns null if command fails or output isn't parseable JSON.
 */
function callGsdTools(cwd, args) {
  const toolsPath = path.join(__dirname, '..', 'gsd-tools.cjs');
  try {
    const stdout = execFileSync(process.execPath, [toolsPath, ...args, '--cwd', cwd], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const trimmed = stdout.trim();
    // Handle @file: response (large payloads written to tmpfile)
    if (trimmed.startsWith('@file:')) {
      const tmpPath = trimmed.slice(6);
      return JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    }
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Resolve a unit string to { type: 'phase'|'todo', identifier, data }.
 *
 * Resolution order:
 *   1. Check if a todo file exists at .planning/todos/pending/<slug>.md
 *      or .planning/todos/completed/<slug>.md → type = 'todo'
 *   2. Otherwise → type = 'phase', identifier = the string as-is
 *
 * This order is critical: date-prefixed slugs (e.g. '260508-u0b-task') start with
 * a digit and would falsely match a phase-number pattern if checked first.
 */
function resolveUnit(cwd, unitStr) {
  const planningDir = planningPaths(cwd).root || path.join(cwd, '.planning');

  // Candidate todo paths
  const pendingPath = path.join(planningDir, 'todos', 'pending', `${unitStr}.md`);
  const completedPath = path.join(planningDir, 'todos', 'completed', `${unitStr}.md`);

  if (fs.existsSync(pendingPath)) {
    const content = fs.readFileSync(pendingPath, 'utf-8');
    return { type: 'todo', identifier: unitStr, filePath: pendingPath, frontmatter: extractFrontmatter(content) };
  }
  if (fs.existsSync(completedPath)) {
    const content = fs.readFileSync(completedPath, 'utf-8');
    return { type: 'todo', identifier: unitStr, filePath: completedPath, frontmatter: extractFrontmatter(content) };
  }

  // Fall back to phase
  return { type: 'phase', identifier: unitStr };
}

/**
 * Get the set of files_modified for a phase (union across all plans).
 * Returns a Set<string>.
 */
function getPhaseFiles(cwd, phaseNum) {
  const index = callGsdTools(cwd, ['phase-plan-index', phaseNum]);
  if (!index || !Array.isArray(index.plans)) return new Set();
  const files = [];
  for (const plan of index.plans) {
    if (Array.isArray(plan.files_modified)) {
      files.push(...plan.files_modified);
    }
  }
  return new Set(files);
}

/**
 * Get files listed in a todo's frontmatter `files` field.
 * Returns a Set<string>.
 */
function getTodoFiles(todoFrontmatter) {
  const files = todoFrontmatter.files;
  if (!files) return new Set();
  if (Array.isArray(files)) return new Set(files);
  return new Set([files]);
}

/**
 * Get all phases from roadmap analyze output.
 * Returns [] on failure.
 */
function getRoadmapPhases(cwd) {
  const data = callGsdTools(cwd, ['roadmap', 'analyze']);
  if (!data || !Array.isArray(data.phases)) return [];
  return data.phases;
}

/**
 * Check if there is an axis-B depends_on edge between two phases.
 * Reads from roadmap analyze output.
 *
 * Note: depends_on is a raw string like "Phase 6, Phase 3" or null.
 * We check if phaseA's string mentions phaseB or vice versa.
 *
 * Limitation: uses string .includes() so "Phase 1" would match "Phase 10".
 * Acceptable for current phase numbering (single/double digit); document here.
 */
function hasPhaseDecisionCoupling(allPhases, phaseNumA, phaseNumB) {
  const normA = String(phaseNumA);
  const normB = String(phaseNumB);

  const phaseA = allPhases.find(p => String(p.number) === normA);
  const phaseB = allPhases.find(p => String(p.number) === normB);

  // A depends on B
  if (phaseA && phaseA.depends_on) {
    if (phaseA.depends_on.includes(`Phase ${normB}`)) return true;
  }
  // B depends on A
  if (phaseB && phaseB.depends_on) {
    if (phaseB.depends_on.includes(`Phase ${normA}`)) return true;
  }
  return false;
}

/**
 * Check if a todo unit is axis-B coupled to a phase or another unit.
 *
 * A todo's depends_on field may contain:
 *   - "phase:N" → axis-B coupling to phase N
 *   - todo slug  → axis-B coupling to that todo (treated as coupling)
 *
 * related_to: context-only, NOT axis-B coupling (documented choice).
 */
function hasTodoDecisionCoupling(todoFrontmatter, otherIdentifier, otherType) {
  const dependsOn = todoFrontmatter.depends_on;
  if (!dependsOn) return false;

  const deps = Array.isArray(dependsOn) ? dependsOn : [dependsOn];
  for (const dep of deps) {
    if (otherType === 'phase') {
      // dep like "phase:6" couples to phase 6
      const m = String(dep).match(/^phase:(\S+)$/i);
      if (m && String(m[1]) === String(otherIdentifier)) return true;
    } else {
      // dep is a todo slug
      if (String(dep) === String(otherIdentifier)) return true;
    }
  }
  return false;
}

// ── Main command ──────────────────────────────────────────────────────────────

/**
 * cmdParallelSafe — determine whether unitA and unitB can run concurrently.
 *
 * @param {string} cwd   - Project root
 * @param {string} unitA - Phase number string or todo slug
 * @param {string} unitB - Phase number string or todo slug
 * @param {boolean} raw  - If true, emit raw text (same as JSON for this command)
 */
function cmdParallelSafe(cwd, unitA, unitB, raw) {
  if (!unitA || !unitB) {
    error('parallel-safe requires two unit identifiers: <A> <B>');
  }

  // Pitfall 4: same unit is N/A (greenlight)
  if (unitA === unitB) {
    output({
      safe: true,
      axis_b_coupled: false,
      axis_a_overlap: false,
      overlap_files: [],
      decision: 'greenlight',
      reason: 'Same unit — parallelism is N/A for a single unit.',
    }, raw);
    return;
  }

  const resolvedA = resolveUnit(cwd, unitA);
  const resolvedB = resolveUnit(cwd, unitB);

  // ── Axis B: decision coupling check ──────────────────────────────────────

  let axisBCoupled = false;

  if (resolvedA.type === 'phase' && resolvedB.type === 'phase') {
    // Phase↔phase: check roadmap depends_on in either direction
    const allPhases = getRoadmapPhases(cwd);
    axisBCoupled = hasPhaseDecisionCoupling(allPhases, resolvedA.identifier, resolvedB.identifier);
  } else if (resolvedA.type === 'todo') {
    // Todo A depends_on Phase/Todo B
    axisBCoupled = hasTodoDecisionCoupling(resolvedA.frontmatter, resolvedB.identifier, resolvedB.type);
  } else if (resolvedB.type === 'todo') {
    // Todo B depends_on Phase/Todo A
    axisBCoupled = hasTodoDecisionCoupling(resolvedB.frontmatter, resolvedA.identifier, resolvedA.type);
  }

  // ── Axis A: file overlap check ────────────────────────────────────────────

  let filesA = new Set();
  let filesB = new Set();

  if (resolvedA.type === 'phase') {
    filesA = getPhaseFiles(cwd, resolvedA.identifier);
  } else {
    filesA = getTodoFiles(resolvedA.frontmatter);
  }

  if (resolvedB.type === 'phase') {
    filesB = getPhaseFiles(cwd, resolvedB.identifier);
  } else {
    filesB = getTodoFiles(resolvedB.frontmatter);
  }

  const overlapFiles = [...filesA].filter(f => filesB.has(f));
  const axisAOverlap = overlapFiles.length > 0;

  // ── Decision ──────────────────────────────────────────────────────────────

  let decision;
  let reason;

  if (axisBCoupled) {
    decision = 'refuse';
    reason = `Axis-B decision coupling detected: ${unitA} and ${unitB} have a depends_on edge. Running in parallel risks building on stale decisions. Sequence them instead.`;
  } else if (axisAOverlap) {
    decision = 'warn';
    reason = `Axis-A file overlap detected: ${unitA} and ${unitB} share ${overlapFiles.length} file(s) (${overlapFiles.slice(0, 3).join(', ')}${overlapFiles.length > 3 ? '...' : ''}). Worktree isolation makes conflicts reviewable at merge — proceed with caution.`;
  } else {
    decision = 'greenlight';
    reason = `No coupling detected: ${unitA} and ${unitB} have no depends_on edge and disjoint file scopes. Safe to run concurrently.`;
  }

  output({
    safe: decision === 'greenlight',
    axis_b_coupled: axisBCoupled,
    axis_a_overlap: axisAOverlap,
    overlap_files: overlapFiles,
    decision,
    reason,
  }, raw);
}

module.exports = { cmdParallelSafe };
