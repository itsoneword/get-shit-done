/**
 * Roadmap — Roadmap parsing and update operations
 */

const fs = require('fs');
const path = require('path');
const { escapeRegex, normalizePhaseName, planningPaths, output, error, findPhaseInternal, stripShippedMilestones, extractCurrentMilestone, replaceInCurrentMilestone } = require('./core.cjs');
const { getPhaseFiles } = require('./parallel-gate.cjs');

function cmdRoadmapGetPhase(cwd, phaseNum, raw) {
  const roadmapPath = planningPaths(cwd).roadmap;

  if (!fs.existsSync(roadmapPath)) {
    output({ found: false, error: 'ROADMAP.md not found' }, raw, '');
    return;
  }

  try {
    const content = extractCurrentMilestone(fs.readFileSync(roadmapPath, 'utf-8'), cwd);

    // Escape special regex chars in phase number, handle decimal
    const escapedPhase = escapeRegex(phaseNum);

    // Match "## Phase X:", "### Phase X:", or "#### Phase X:" with optional name
    const phasePattern = new RegExp(
      `#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`,
      'i'
    );
    const headerMatch = content.match(phasePattern);

    if (!headerMatch) {
      // Fallback: check if phase exists in summary list but missing detail section
      const checklistPattern = new RegExp(
        `-\\s*\\[[ x]\\]\\s*\\*\\*Phase\\s+${escapedPhase}:\\s*([^*]+)\\*\\*`,
        'i'
      );
      const checklistMatch = content.match(checklistPattern);

      if (checklistMatch) {
        // Phase exists in summary but missing detail section - malformed ROADMAP
        output({
          found: false,
          phase_number: phaseNum,
          phase_name: checklistMatch[1].trim(),
          error: 'malformed_roadmap',
          message: `Phase ${phaseNum} exists in summary list but missing "### Phase ${phaseNum}:" detail section. ROADMAP.md needs both formats.`
        }, raw, '');
        return;
      }

      output({ found: false, phase_number: phaseNum }, raw, '');
      return;
    }

    const phaseName = headerMatch[1].trim();
    const headerIndex = headerMatch.index;

    // Find the end of this section (next ## or ### phase header, or end of file)
    const restOfContent = content.slice(headerIndex);
    const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeaderMatch
      ? headerIndex + nextHeaderMatch.index
      : content.length;

    const section = content.slice(headerIndex, sectionEnd).trim();

    // Extract goal if present (supports both **Goal:** and **Goal**: formats)
    const goalMatch = section.match(/\*\*Goal(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    // Extract success criteria as structured array
    const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
    const success_criteria = criteriaMatch
      ? criteriaMatch[1].trim().split('\n').map(line => line.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean)
      : [];

    // Extract hard/soft dependency fields (additive, backward compatible)
    const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const depends_on = dependsMatch ? dependsMatch[1].trim() : null;
    const sequenceMatch = section.match(/\*\*Sequence after(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const sequence_after = sequenceMatch ? sequenceMatch[1].trim() : null;

    output(
      {
        found: true,
        phase_number: phaseNum,
        phase_name: phaseName,
        goal,
        depends_on,
        sequence_after,
        success_criteria,
        section,
      },
      raw,
      section
    );
  } catch (e) {
    error('Failed to read ROADMAP.md: ' + e.message);
  }
}

/**
 * Extract phase headings and their sections from ROADMAP.md content.
 *
 * Pure refactor of the phase-heading/section-slice/depends_on-prose scan that
 * used to live inline in `analyzeRoadmapData`. Both `analyzeRoadmapData` and
 * `graph.cjs` call this so there is exactly one copy of the phase-heading
 * regex and the `**Depends on**:` regex (LOCKED reuse rule — see
 * `16-CONTEXT.md`).
 *
 * @param {string} content - ROADMAP.md content (already milestone-scoped by the caller)
 * @returns {Array<{number: string, name: string, section: string, depends_on: string|null}>}
 */
function parsePhaseSections(content) {
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
  const sections = [];
  let match;
  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].replace(/\(INSERTED\)/i, '').trim();
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
    const section = content.slice(sectionStart, sectionEnd);
    const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const depends_on = dependsMatch ? dependsMatch[1].trim() : null;
    sections.push({ number: phaseNum, name: phaseName, section, depends_on });
  }
  return sections;
}

/**
 * Parse a phase's raw `**Depends on**:` prose string into a normalized array
 * of node-id-form phase references (e.g. `["phase:11", "phase:12"]`).
 *
 * Reuses the exact `/Phase\s+(\d+(\.\d+)?)/g` extraction already used by
 * `overnight.md` (workflows/overnight.md:143) — GRAPH-01 (additive; the raw
 * `depends_on` string field is unchanged for every existing caller).
 *
 * "Nothing (first phase)", null, or any string with zero "Phase N" matches
 * -> `[]`.
 *
 * @param {string|null} rawDependsOn
 * @returns {string[]}
 */
function parseDependsOnPhaseRefs(rawDependsOn) {
  if (!rawDependsOn) return [];
  const matches = [...rawDependsOn.matchAll(/Phase\s+(\d+(\.\d+)?)/g)];
  return matches.map(m => `phase:${m[1]}`);
}

/**
 * Non-exiting analyzer — builds the same result object as `cmdRoadmapAnalyze`
 * without calling `output()` (which exits the process). Callers that need to
 * consume `phases[]` in-process (e.g. `cmdRoadmapFrontier`) should use this.
 *
 * Returns `{ error, milestones, phases, current_phase, ... }` — see
 * `cmdRoadmapAnalyze` for the full shape. On a missing ROADMAP.md, returns
 * `{ error: 'ROADMAP.md not found', milestones: [], phases: [], current_phase: null }`.
 */
function analyzeRoadmapData(cwd, opts = {}) {
  const scoped = opts && opts.scoped === true;
  const roadmapPath = planningPaths(cwd).roadmap;

  if (!fs.existsSync(roadmapPath)) {
    return { error: 'ROADMAP.md not found', milestones: [], phases: [], current_phase: null };
  }

  const rawContent = fs.readFileSync(roadmapPath, 'utf-8');
  const content = extractCurrentMilestone(rawContent, cwd);
  const phasesDir = planningPaths(cwd).phases;

  // Extract all phase headings: ## Phase N: Name or ### Phase N: Name
  const phaseSections = parsePhaseSections(content);
  const phases = [];

  for (const sec of phaseSections) {
    const phaseNum = sec.number;
    const phaseName = sec.name;
    const section = sec.section;
    const depends_on = sec.depends_on;
    const depends_on_parsed = parseDependsOnPhaseRefs(depends_on);

    const goalMatch = section.match(/\*\*Goal(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    const sequenceMatch = section.match(/\*\*Sequence after(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const sequence_after = sequenceMatch ? sequenceMatch[1].trim() : null;

    // Check completion on disk
    const normalized = normalizePhaseName(phaseNum);
    let diskStatus = 'no_directory';
    let planCount = 0;
    let summaryCount = 0;
    let hasContext = false;
    let hasResearch = false;

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const dirMatch = dirs.find(d => d.startsWith(normalized + '-') || d === normalized);

      if (dirMatch) {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dirMatch));
        planCount = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
        summaryCount = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
        hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
        hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

        if (summaryCount >= planCount && planCount > 0) diskStatus = 'complete';
        else if (summaryCount > 0) diskStatus = 'partial';
        else if (planCount > 0) diskStatus = 'planned';
        else if (hasResearch) diskStatus = 'researched';
        else if (hasContext) diskStatus = 'discussed';
        else diskStatus = 'empty';
      }
    } catch { /* intentionally empty */ }

    // Check ROADMAP checkbox status
    const checkboxPattern = new RegExp(`-\\s*\\[(x| )\\]\\s*.*Phase\\s+${escapeRegex(phaseNum)}[:\\s]`, 'i');
    const checkboxMatch = content.match(checkboxPattern);
    const roadmapComplete = checkboxMatch ? checkboxMatch[1] === 'x' : false;

    // If roadmap marks phase complete, trust that over disk file structure.
    // Phases completed before GSD tracking (or via external tools) may lack
    // the standard PLAN/SUMMARY pairs but are still done.
    if (roadmapComplete && diskStatus !== 'complete') {
      diskStatus = 'complete';
    }

    phases.push({
      number: phaseNum,
      name: phaseName,
      goal,
      depends_on,
      depends_on_parsed,
      sequence_after,
      plan_count: planCount,
      summary_count: summaryCount,
      has_context: hasContext,
      has_research: hasResearch,
      disk_status: diskStatus,
      roadmap_complete: roadmapComplete,
    });
  }

  // Extract milestone info
  const milestones = [];
  const milestonePattern = /##\s*(.*v(\d+(?:\.\d+)+)[^(\n]*)/gi;
  let mMatch;
  while ((mMatch = milestonePattern.exec(content)) !== null) {
    milestones.push({
      heading: mMatch[1].trim(),
      version: 'v' + mMatch[2],
    });
  }

  // Find current and next phase
  const currentPhase = phases.find(p => p.disk_status === 'planned' || p.disk_status === 'partial') || null;
  const nextPhase = phases.find(p => p.disk_status === 'empty' || p.disk_status === 'no_directory' || p.disk_status === 'discussed' || p.disk_status === 'researched') || null;

  // Aggregated stats
  const totalPlans = phases.reduce((sum, p) => sum + p.plan_count, 0);
  const totalSummaries = phases.reduce((sum, p) => sum + p.summary_count, 0);
  const completedPhases = phases.filter(p => p.disk_status === 'complete').length;

  // Detect phases in summary list without detail sections (malformed ROADMAP)
  const checklistPattern = /-\s*\[[ x]\]\s*\*\*Phase\s+(\d+[A-Z]?(?:\.\d+)*)/gi;
  const checklistPhases = new Set();
  let checklistMatch;
  while ((checklistMatch = checklistPattern.exec(content)) !== null) {
    checklistPhases.add(checklistMatch[1]);
  }
  const detailPhases = new Set(phases.map(p => p.number));
  const missingDetails = [...checklistPhases].filter(p => !detailPhases.has(p));

  // Apply scoped trimming: keep current ±1 / next ±1 (≤4 entries)
  let scopedPhases = phases;
  if (scoped && phases.length > 0) {
    const anchor = currentPhase || nextPhase || phases[0];
    const anchorIdx = phases.findIndex(p => p.number === anchor.number);
    if (anchorIdx !== -1) {
      const start = Math.max(0, anchorIdx - 1);
      const end = Math.min(phases.length, anchorIdx + 3); // anchor + 2 ahead
      scopedPhases = phases.slice(start, end);
    } else {
      scopedPhases = phases.slice(0, 4);
    }
  }

  return {
    milestones,
    phases: scopedPhases,
    phase_count: phases.length,
    completed_phases: completedPhases,
    total_plans: totalPlans,
    total_summaries: totalSummaries,
    progress_percent: totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0,
    current_phase: currentPhase ? currentPhase.number : null,
    next_phase: nextPhase ? nextPhase.number : null,
    missing_phase_details: missingDetails.length > 0 ? missingDetails : null,
  };
}

function cmdRoadmapAnalyze(cwd, raw, opts = {}) {
  output(analyzeRoadmapData(cwd, opts), raw);
}

/**
 * `gsd-tools roadmap frontier` — the scheduling brain.
 *
 * Computes the runnable frontier: incomplete phases whose EVERY hard
 * `depends_on` phase is complete. `sequence_after` (soft ordering) is never
 * read here — that is the whole point of the hard/soft split (see
 * `.planning/reference/2026-07-04-parallel-phase-execution.md`).
 *
 * The frontier is then split via the axis-A (file-overlap) co-schedule
 * filter reused from `parallel-gate.cjs`: two frontier phases can never be
 * axis-B coupled (if A hard-depends on B and A is in the frontier, B must
 * already be complete — so B is not in the frontier), so only axis-A file
 * overlap needs checking here.
 *
 * Emits `{ frontier: string[], coschedulable: string[], serialized: [{phase, conflicts_with, overlap_files}] }`.
 */
function extractDepPhaseNums(str) {
  if (!str) return [];
  // Parenthetical asides are prose commentary, not dependency declarations
  // (e.g. "Nothing (independent of Phase 01)", "Phase 04 (bridge patterns proven)").
  // Strip them before extracting so a phase mentioned in passing isn't read as a hard dep.
  const stripped = str.replace(/\([^)]*\)/g, ' ');
  // "Nothing" / "None" / "N/A" / "-" (once asides are removed) means no hard dependency.
  if (/^\s*(nothing|none|n\/a|-)?\s*$/i.test(stripped)) return [];
  const nums = [];
  const pattern = /Phase\s+(\d+[A-Z]?(?:\.\d+)*)/gi;
  let m;
  while ((m = pattern.exec(stripped)) !== null) {
    nums.push(m[1]);
  }
  return nums;
}

function cmdRoadmapFrontier(cwd, raw) {
  const { phases } = analyzeRoadmapData(cwd, { scoped: false });

  const isComplete = (p) => p.disk_status === 'complete';
  const byNumber = new Map((phases || []).map(p => [String(p.number), p]));

  const frontierPhases = (phases || []).filter(p => {
    if (isComplete(p)) return false;
    const depNums = extractDepPhaseNums(p.depends_on);
    if (depNums.length === 0) return true;
    return depNums.every(depNum => {
      const depPhase = byNumber.get(String(depNum));
      return depPhase ? isComplete(depPhase) : false;
    });
  });

  const coschedulable = [];
  const serialized = [];
  const selectedFiles = []; // [{ number, files: Set }]

  for (const candidate of frontierPhases) {
    const candidateFiles = getPhaseFiles(cwd, candidate.number);
    let conflictsWith = null;
    let overlapFiles = [];

    for (const selected of selectedFiles) {
      const overlap = [...candidateFiles].filter(f => selected.files.has(f));
      if (overlap.length > 0) {
        conflictsWith = selected.number;
        overlapFiles = overlap;
        break;
      }
    }

    if (conflictsWith) {
      serialized.push({ phase: candidate.number, conflicts_with: conflictsWith, overlap_files: overlapFiles });
    } else {
      coschedulable.push(candidate.number);
      selectedFiles.push({ number: candidate.number, files: candidateFiles });
    }
  }

  output({
    frontier: frontierPhases.map(p => p.number),
    coschedulable,
    serialized,
  }, raw);
}

function cmdRoadmapUpdatePlanProgress(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for roadmap update-plan-progress');
  }

  const roadmapPath = planningPaths(cwd).roadmap;

  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) {
    error(`Phase ${phaseNum} not found`);
  }

  const planCount = phaseInfo.plans.length;
  const summaryCount = phaseInfo.summaries.length;

  if (planCount === 0) {
    output({ updated: false, reason: 'No plans found', plan_count: 0, summary_count: 0 }, raw, 'no plans');
    return;
  }

  const isComplete = summaryCount >= planCount;
  const status = isComplete ? 'Complete' : summaryCount > 0 ? 'In Progress' : 'Planned';
  const today = new Date().toISOString().split('T')[0];

  if (!fs.existsSync(roadmapPath)) {
    output({ updated: false, reason: 'ROADMAP.md not found', plan_count: planCount, summary_count: summaryCount }, raw, 'no roadmap');
    return;
  }

  let roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
  const phaseEscaped = escapeRegex(phaseNum);

  // Progress table row: update Plans/Status/Date columns (handles 4 or 5 column tables)
  const tableRowPattern = new RegExp(
    `^(\\|\\s*${phaseEscaped}\\.?\\s[^|]*(?:\\|[^\\n]*))$`,
    'im'
  );
  const dateField = isComplete ? ` ${today} ` : '  ';
  roadmapContent = roadmapContent.replace(tableRowPattern, (fullRow) => {
    const cells = fullRow.split('|').slice(1, -1); // drop leading/trailing empty from split
    if (cells.length === 5) {
      // 5-col: Phase | Milestone | Plans | Status | Completed
      cells[2] = ` ${summaryCount}/${planCount} `;
      cells[3] = ` ${status.padEnd(11)}`;
      cells[4] = dateField;
    } else if (cells.length === 4) {
      // 4-col: Phase | Plans | Status | Completed
      cells[1] = ` ${summaryCount}/${planCount} `;
      cells[2] = ` ${status.padEnd(11)}`;
      cells[3] = dateField;
    }
    return '|' + cells.join('|') + '|';
  });

  // Update plan count in phase detail section
  const planCountPattern = new RegExp(
    `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:\\*\\*\\s*)[^\\n]+`,
    'i'
  );
  const planCountText = isComplete
    ? `${summaryCount}/${planCount} plans complete`
    : `${summaryCount}/${planCount} plans executed`;
  roadmapContent = replaceInCurrentMilestone(roadmapContent, planCountPattern, `$1${planCountText}`);

  // If complete: check checkbox
  if (isComplete) {
    const checkboxPattern = new RegExp(
      `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseEscaped}[:\\s][^\\n]*)`,
      'i'
    );
    roadmapContent = replaceInCurrentMilestone(roadmapContent, checkboxPattern, `$1x$2 (completed ${today})`);
  }

  // Mark completed plan checkboxes (e.g. "- [ ] 50-01-PLAN.md" or "- [ ] 50-01:")
  for (const summaryFile of phaseInfo.summaries) {
    const planId = summaryFile.replace('-SUMMARY.md', '').replace('SUMMARY.md', '');
    if (!planId) continue;
    const planEscaped = escapeRegex(planId);
    const planCheckboxPattern = new RegExp(
      `(-\\s*\\[) (\\]\\s*${planEscaped})`,
      'i'
    );
    roadmapContent = roadmapContent.replace(planCheckboxPattern, '$1x$2');
  }

  fs.writeFileSync(roadmapPath, roadmapContent, 'utf-8');

  output({
    updated: true,
    phase: phaseNum,
    plan_count: planCount,
    summary_count: summaryCount,
    status,
    complete: isComplete,
  }, raw, `${summaryCount}/${planCount} ${status}`);
}

module.exports = {
  cmdRoadmapGetPhase,
  cmdRoadmapAnalyze,
  cmdRoadmapUpdatePlanProgress,
  cmdRoadmapFrontier,
  analyzeRoadmapData,
  parsePhaseSections,
  parseDependsOnPhaseRefs,
};
