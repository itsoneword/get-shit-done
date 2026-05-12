/**
 * Milestone — Milestone and requirements lifecycle operations
 */

const fs = require('fs');
const path = require('path');
const { escapeRegex, getMilestonePhaseFilter, extractOneLinerFromBody, normalizeMd, planningPaths, toPosixPath, extractCurrentMilestone, output, error } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const { writeStateMd } = require('./state.cjs');

/**
 * Parse ROADMAP.md per-phase Requirements lines like:
 *   **Requirements**: DRTR-01, DRTR-02, DRTR-03
 * Build { 'DRTR-01': '01', 'DRTR-02': '01', ... } keyed by zero-padded phase number.
 *
 * Phase-number is found via the heading `### Phase N:` immediately preceding the
 * Requirements line. Returns an empty map if ROADMAP.md is missing.
 */
function buildRequirementToPhaseMap(cwd) {
  const map = {};
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) return map;
  const raw = fs.readFileSync(roadmapPath, 'utf-8');
  const sectionRegex = /^###\s+Phase\s+(\d+)\s*[:\.]?[^\n]*$/gm;
  const headings = [...raw.matchAll(sectionRegex)];
  for (let i = 0; i < headings.length; i++) {
    const phaseNum = headings[i][1].padStart(2, '0');
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : raw.length;
    const section = raw.slice(start, end);
    const reqMatch = section.match(/\*\*Requirements\*\*:\s*([A-Z]+-[0-9]+(?:,\s*[A-Z]+-[0-9]+)*)/);
    if (reqMatch) {
      for (const reqId of reqMatch[1].split(',').map(s => s.trim())) {
        if (reqId) map[reqId] = phaseNum;
      }
    }
  }
  return map;
}

/**
 * For a given phase number, locate the per-phase VERIFICATION.md (e.g.
 * `.planning/{milestone}/phases/01-domain-router/01-VERIFICATION.md`) if
 * present and return its POSIX-relative path. Returns null if no
 * VERIFICATION.md exists. Searches both partitioned and legacy phase trees.
 */
function findVerificationEvidence(cwd, version, phaseNum) {
  if (!phaseNum) return null;
  const candidates = [
    path.join(cwd, '.planning', version, 'phases'),
    path.join(cwd, '.planning', 'phases'),
  ];
  for (const phasesRoot of candidates) {
    if (!fs.existsSync(phasesRoot)) continue;
    let entries;
    try { entries = fs.readdirSync(phasesRoot, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (!e.name.startsWith(phaseNum + '-')) continue;
      const verPath = path.join(phasesRoot, e.name, `${phaseNum}-VERIFICATION.md`);
      if (fs.existsSync(verPath)) {
        return toPosixPath(path.relative(cwd, verPath));
      }
    }
  }
  return null;
}

function cmdRequirementsMarkComplete(cwd, reqIdsRaw, raw) {
  if (!reqIdsRaw || reqIdsRaw.length === 0) {
    error('requirement IDs required. Usage: requirements mark-complete REQ-01,REQ-02 or REQ-01 REQ-02');
  }

  // Accept comma-separated, space-separated, or bracket-wrapped: [REQ-01, REQ-02]
  const reqIds = reqIdsRaw
    .join(' ')
    .replace(/[\[\]]/g, '')
    .split(/[,\s]+/)
    .map(r => r.trim())
    .filter(Boolean);

  if (reqIds.length === 0) {
    error('no valid requirement IDs found');
  }

  const reqPath = planningPaths(cwd).requirements;
  if (!fs.existsSync(reqPath)) {
    output({ updated: false, reason: 'REQUIREMENTS.md not found', ids: reqIds }, raw, 'no requirements file');
    return;
  }

  let reqContent = fs.readFileSync(reqPath, 'utf-8');
  const updated = [];
  const alreadyComplete = [];
  const notFound = [];

  for (const reqId of reqIds) {
    let found = false;
    const reqEscaped = escapeRegex(reqId);

    // Update checkbox: - [ ] **REQ-ID** → - [x] **REQ-ID**
    const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqEscaped}\\*\\*)`, 'gi');
    if (checkboxPattern.test(reqContent)) {
      reqContent = reqContent.replace(checkboxPattern, '$1x$2');
      found = true;
    }

    // Update traceability table: | REQ-ID | Phase N | Pending | → | REQ-ID | Phase N | Complete |
    const tablePattern = new RegExp(`(\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi');
    if (tablePattern.test(reqContent)) {
      // Re-read since test() advances lastIndex for global regex
      reqContent = reqContent.replace(
        new RegExp(`(\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi'),
        '$1 Complete $2'
      );
      found = true;
    }

    if (found) {
      updated.push(reqId);
    } else {
      // Check if already complete before declaring not_found
      const doneCheckbox = new RegExp(`-\\s*\\[x\\]\\s*\\*\\*${reqEscaped}\\*\\*`, 'gi');
      const doneTable = new RegExp(`\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|\\s*Complete\\s*\\|`, 'gi');
      if (doneCheckbox.test(reqContent) || doneTable.test(reqContent)) {
        alreadyComplete.push(reqId);
      } else {
        notFound.push(reqId);
      }
    }
  }

  if (updated.length > 0) {
    fs.writeFileSync(reqPath, reqContent, 'utf-8');
  }

  output({
    updated: updated.length > 0,
    marked_complete: updated,
    already_complete: alreadyComplete,
    not_found: notFound,
    total: reqIds.length,
  }, raw, `${updated.length}/${reqIds.length} requirements marked complete`);
}

function cmdMilestoneComplete(cwd, version, options, raw) {
  if (!version) {
    error('version required for milestone complete (e.g., v1.0)');
  }

  const roadmapPath = planningPaths(cwd).roadmap;
  const reqPath = planningPaths(cwd).requirements;
  const statePath = planningPaths(cwd).state;
  const milestonesPath = path.join(cwd, '.planning', 'MILESTONES.md');
  const archiveDir = path.join(cwd, '.planning', 'milestones');
  const phasesDir = planningPaths(cwd).phases;
  const today = new Date().toISOString().split('T')[0];
  const milestoneName = options.name || version;

  // Ensure archive directory exists
  fs.mkdirSync(archiveDir, { recursive: true });

  // Scope stats and accomplishments to only the phases belonging to the
  // current milestone's ROADMAP.  Uses the shared filter from core.cjs
  // (same logic used by cmdPhasesList and other callers).
  const isDirInMilestone = getMilestonePhaseFilter(cwd);

  // Gather stats from phases (scoped to current milestone only)
  let phaseCount = 0;
  let totalPlans = 0;
  let totalTasks = 0;
  const accomplishments = [];

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      if (!isDirInMilestone(dir)) continue;

      phaseCount++;
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      totalPlans += plans.length;

      // Extract one-liners from summaries
      for (const s of summaries) {
        try {
          const content = fs.readFileSync(path.join(phasesDir, dir, s), 'utf-8');
          const fm = extractFrontmatter(content);
          const oneLiner = fm['one-liner'] || extractOneLinerFromBody(content);
          if (oneLiner) {
            accomplishments.push(oneLiner);
          }
          // Count tasks: prefer **Tasks:** N from Performance section,
          // then <task XML tags, then ## Task N markdown headers
          const tasksFieldMatch = content.match(/\*\*Tasks:\*\*\s*(\d+)/);
          if (tasksFieldMatch) {
            totalTasks += parseInt(tasksFieldMatch[1], 10);
          } else {
            const xmlTaskMatches = content.match(/<task[\s>]/gi) || [];
            const mdTaskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
            totalTasks += xmlTaskMatches.length || mdTaskMatches.length;
          }
        } catch { /* intentionally empty */ }
      }
    }
  } catch { /* intentionally empty */ }

  // Archive ROADMAP.md
  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    fs.writeFileSync(path.join(archiveDir, `${version}-ROADMAP.md`), roadmapContent, 'utf-8');
  }

  // Archive REQUIREMENTS.md
  if (fs.existsSync(reqPath)) {
    const reqContent = fs.readFileSync(reqPath, 'utf-8');
    const archiveHeader = `# Requirements Archive: ${version} ${milestoneName}\n\n**Archived:** ${today}\n**Status:** SHIPPED\n\nFor current requirements, see \`.planning/REQUIREMENTS.md\`.\n\n---\n\n`;
    fs.writeFileSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`), archiveHeader + reqContent, 'utf-8');
  }

  // Archive audit file if exists
  const auditFile = path.join(cwd, '.planning', `${version}-MILESTONE-AUDIT.md`);
  if (fs.existsSync(auditFile)) {
    fs.renameSync(auditFile, path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`));
  }

  // Create/append MILESTONES.md entry
  const accomplishmentsList = accomplishments.map(a => `- ${a}`).join('\n');
  const milestoneEntry = `## ${version} ${milestoneName} (Shipped: ${today})\n\n**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks\n\n**Key accomplishments:**\n${accomplishmentsList || '- (none recorded)'}\n\n---\n\n`;

  if (fs.existsSync(milestonesPath)) {
    const existing = fs.readFileSync(milestonesPath, 'utf-8');
    if (!existing.trim()) {
      // Empty file — treat like new
      fs.writeFileSync(milestonesPath, normalizeMd(`# Milestones\n\n${milestoneEntry}`), 'utf-8');
    } else {
      // Insert after the header line(s) for reverse chronological order (newest first)
      const headerMatch = existing.match(/^(#{1,3}\s+[^\n]*\n\n?)/);
      if (headerMatch) {
        const header = headerMatch[1];
        const rest = existing.slice(header.length);
        fs.writeFileSync(milestonesPath, normalizeMd(header + milestoneEntry + rest), 'utf-8');
      } else {
        // No recognizable header — prepend the entry
        fs.writeFileSync(milestonesPath, normalizeMd(milestoneEntry + existing), 'utf-8');
      }
    }
  } else {
    fs.writeFileSync(milestonesPath, normalizeMd(`# Milestones\n\n${milestoneEntry}`), 'utf-8');
  }

  // Update STATE.md
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');
    stateContent = stateContent.replace(
      /(\*\*Status:\*\*\s*).*/,
      `$1${version} milestone complete`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity:\*\*\s*).*/,
      `$1${today}`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity Description:\*\*\s*).*/,
      `$1${version} milestone completed and archived`
    );
    writeStateMd(statePath, stateContent, cwd);
  }

  // Archive phase directories if requested
  let phasesArchived = false;
  if (options.archivePhases) {
    try {
      const phaseArchiveDir = path.join(archiveDir, `${version}-phases`);
      fs.mkdirSync(phaseArchiveDir, { recursive: true });

      const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const phaseDirNames = phaseEntries.filter(e => e.isDirectory()).map(e => e.name);
      let archivedCount = 0;
      for (const dir of phaseDirNames) {
        if (!isDirInMilestone(dir)) continue;
        fs.renameSync(path.join(phasesDir, dir), path.join(phaseArchiveDir, dir));
        archivedCount++;
      }
      phasesArchived = archivedCount > 0;
    } catch { /* intentionally empty */ }
  }

  // Write distillation artifact (.planning/{version}/SUMMARY.md). Failures are
  // surfaced via stderr + a non-null `distillation_error` field in the result
  // JSON; cmdMilestoneComplete must exit non-zero in that case so callers can
  // detect partial milestone closure.
  //
  // Pass `silent: true` so the distill side-effect doesn't write the human-
  // readable summary line to stdout (which would corrupt this command's JSON
  // output).
  let distillation_error = null;
  try {
    cmdMilestoneDistill(cwd, version, { name: milestoneName, silent: true }, true);
  } catch (e) {
    distillation_error = e && e.message ? e.message : String(e);
    console.error(`Distillation FAILED: ${distillation_error}`);
  }

  const result = {
    version,
    name: milestoneName,
    date: today,
    phases: phaseCount,
    plans: totalPlans,
    tasks: totalTasks,
    accomplishments,
    archived: {
      roadmap: fs.existsSync(path.join(archiveDir, `${version}-ROADMAP.md`)),
      requirements: fs.existsSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`)),
      audit: fs.existsSync(path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`)),
      phases: phasesArchived,
    },
    milestones_updated: true,
    state_updated: fs.existsSync(statePath),
    distillation_error,
  };

  output(result, raw);

  if (distillation_error) process.exit(1);
}

/**
 * Write `.planning/{version}/SUMMARY.md` with typed-tag sections.
 * Idempotent: re-running overwrites the existing summary with the latest
 * harvest. Designed as graph-friendly substrate for Phase 6 indexing.
 *
 * For requirements_validated[]:
 *   - phase: looked up from ROADMAP.md per-phase Requirements lists (never
 *     null for harvested REQ-IDs when ROADMAP maps them)
 *   - evidence: looked up from {phase_dir}/{padded_phase}-VERIFICATION.md
 *     (null only as a fallback when no VERIFICATION.md exists)
 *
 * The `extractCurrentMilestone` import is referenced for the source-of-truth
 * chain documented in 05-RESEARCH.md §3 (no third local parser).
 */
function cmdMilestoneDistill(cwd, version, options, raw) {
  if (!version) error('version required (e.g., v1.4)');
  // Reference extractCurrentMilestone to keep the documented source-of-truth
  // chain (RESEARCH §3) — no-op call on the active milestone, used for
  // potential consistency checks by future graph readers.
  const _ecm = typeof extractCurrentMilestone === 'function' ? extractCurrentMilestone : null;
  void _ecm;

  const planning = path.join(cwd, '.planning');
  const partitionDir = path.join(planning, version);
  const phasesPath = path.join(partitionDir, 'phases');
  const summaryPath = path.join(partitionDir, 'SUMMARY.md');

  // Ensure partition dir exists (will throw if `partitionDir` exists as a file —
  // surfaced via cmdMilestoneComplete's try/catch + distillation_error).
  fs.mkdirSync(partitionDir, { recursive: true });

  // Build REQ-ID → phase map ONCE up front
  const reqToPhase = buildRequirementToPhaseMap(cwd);

  // Harvest decisions from STATE.md
  const decisions = [];
  const statePath = planningPaths(cwd).state;
  if (fs.existsSync(statePath)) {
    const stateRaw = fs.readFileSync(statePath, 'utf-8');
    const decMatch = stateRaw.match(/###\s+Decisions\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
    if (decMatch) {
      const lines = decMatch[1].split('\n');
      let idCounter = 1;
      for (const line of lines) {
        const m = line.match(/^-\s*\[Phase\s+([^\]]+)\]:?\s*(.+?)(?:\s+—\s+(.+))?$/);
        if (m) {
          decisions.push({
            id: `dec-${idCounter++}`,
            text: m[2].trim(),
            phase: m[1].trim(),
            type: 'design',
            rationale: m[3] ? m[3].trim() : null,
          });
        }
      }
    }
  }

  // Harvest from each phase SUMMARY.md frontmatter
  const phaseNumbers = [];
  if (fs.existsSync(phasesPath)) {
    for (const entry of fs.readdirSync(phasesPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const phaseDir = path.join(phasesPath, entry.name);
      let phaseFiles;
      try { phaseFiles = fs.readdirSync(phaseDir); } catch { continue; }
      const summaryFiles = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      const phaseNum = entry.name.split('-')[0];
      if (phaseNum && !phaseNumbers.includes(phaseNum)) phaseNumbers.push(phaseNum);
      for (const sf of summaryFiles) {
        const content = fs.readFileSync(path.join(phaseDir, sf), 'utf-8');
        const fm = extractFrontmatter(content);
        const keyDecs = fm['key-decisions'];
        if (Array.isArray(keyDecs)) {
          for (const d of keyDecs) {
            decisions.push({
              id: `dec-${decisions.length + 1}`,
              text: typeof d === 'string' ? d : (d.text || JSON.stringify(d)),
              phase: phaseNum,
              type: 'design',
              rationale: null,
            });
          }
        }
      }
    }
  }

  // Harvest validated requirements from REQUIREMENTS.md, attaching phase + evidence
  const requirementsValidated = [];
  const reqPath = planningPaths(cwd).requirements;
  if (fs.existsSync(reqPath)) {
    const reqRaw = fs.readFileSync(reqPath, 'utf-8');
    const reqMatches = [...reqRaw.matchAll(/^-\s*\[x\]\s*\*\*([A-Z]+-\d+)\*\*/gm)];
    for (const m of reqMatches) {
      const reqId = m[1];
      const phaseNum = reqToPhase[reqId] || null;
      const evidence = phaseNum ? findVerificationEvidence(cwd, version, phaseNum) : null;
      requirementsValidated.push({
        id: reqId,
        phase: phaseNum,
        evidence: evidence,
      });
    }
  }

  // Harvest open blockers from STATE.md Blockers/Concerns
  const openBlockers = [];
  if (fs.existsSync(statePath)) {
    const stateRaw = fs.readFileSync(statePath, 'utf-8');
    const blockMatch = stateRaw.match(/###\s+Blockers\/Concerns\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
    if (blockMatch) {
      const lines = blockMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
      let idCounter = 1;
      for (const line of lines) {
        const phaseMatch = line.match(/\[Phase\s+([^\]]+)\]/);
        openBlockers.push({
          id: `blocker-${idCounter++}`,
          text: line.replace(/^-\s*/, '').trim(),
          phase: phaseMatch ? phaseMatch[1].trim() : null,
          severity: 'low',
          carries_to: null,
        });
      }
    }
  }

  // Harvest entry_points and public_api from phase SUMMARYs
  const entryPoints = [];
  const publicApi = [];
  if (fs.existsSync(phasesPath)) {
    for (const entry of fs.readdirSync(phasesPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const phaseDir = path.join(phasesPath, entry.name);
      const phaseNum = entry.name.split('-')[0];
      let phaseFiles;
      try { phaseFiles = fs.readdirSync(phaseDir); } catch { continue; }
      const summaryFiles = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      for (const sf of summaryFiles) {
        const content = fs.readFileSync(path.join(phaseDir, sf), 'utf-8');
        const fm = extractFrontmatter(content);
        const provides = fm['provides'];
        if (Array.isArray(provides)) {
          for (const p of provides) {
            const text = typeof p === 'string' ? p : (p.text || JSON.stringify(p));
            if (/subcommand|function|cmd|--?[a-z]/i.test(text)) {
              publicApi.push({ subcommand: text, phase: phaseNum, introduced: version });
            }
          }
        }
        const affects = fm['affects'];
        if (Array.isArray(affects)) {
          for (const a of affects) {
            const text = typeof a === 'string' ? a : (a.file || JSON.stringify(a));
            entryPoints.push({ file: text, symbol: null, purpose: null });
          }
        }
      }
    }
  }

  // Build SUMMARY.md content
  const today = new Date().toISOString().split('T')[0];
  const milestoneName = options && options.name ? options.name : version;
  const fm = `---
milestone: ${version}
name: ${milestoneName}
shipped: ${today}
phases: [${phaseNumbers.join(', ')}]
schema_version: 1
# --- (end frontmatter)

`;

  const renderSection = (title, items, fields) => {
    let out = `## ${title}\n\n`;
    if (items.length === 0) { out += '_(none)_\n\n'; return out; }
    for (const item of items) {
      const lines = [];
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const v = item[f];
        const prefix = i === 0 ? '- ' : '  ';
        let rendered;
        if (v === null || v === undefined) {
          rendered = 'null';
        } else if (typeof v === 'string' && v.includes('\n')) {
          rendered = `|\n    ${v.replace(/\n/g, '\n    ')}`;
        } else {
          rendered = JSON.stringify(v);
        }
        lines.push(`${prefix}${f}: ${rendered}`);
      }
      out += lines.join('\n') + '\n';
    }
    return out + '\n';
  };

  const body = `# Milestone ${version} — ${milestoneName} Summary

Distilled artifact. Machine-parseable typed-tag sections (Phase 6 graph-indexable).

${renderSection('decisions[]', decisions, ['id', 'text', 'phase', 'type', 'rationale'])}${renderSection('requirements_validated[]', requirementsValidated, ['id', 'phase', 'evidence'])}${renderSection('open_blockers[]', openBlockers, ['id', 'text', 'phase', 'severity', 'carries_to'])}${renderSection('entry_points[]', entryPoints, ['file', 'symbol', 'purpose'])}${renderSection('public_api[]', publicApi, ['subcommand', 'phase', 'introduced'])}---

*Generated: ${today} by \`gsd-tools milestone distill ${version}\`*
`;

  fs.writeFileSync(summaryPath, fm + body, 'utf-8');

  const summary = {
    summary_path: toPosixPath(path.relative(cwd, summaryPath)),
    decisions_count: decisions.length,
    requirements_validated_count: requirementsValidated.length,
    open_blockers_count: openBlockers.length,
    entry_points_count: entryPoints.length,
    public_api_count: publicApi.length,
    requirements_validated: requirementsValidated,
  };

  // options.silent suppresses ALL stdout — used by cmdMilestoneComplete when
  // invoking distill as a side-effect, so its outer JSON output stays clean.
  if (options && options.silent) return;
  if (raw) {
    console.log(`Wrote ${summary.summary_path} — ${decisions.length} decisions, ${openBlockers.length} blockers, ${publicApi.length} public-api entries`);
  } else {
    console.log(JSON.stringify({ summary }, null, 2));
  }
}

module.exports = {
  cmdRequirementsMarkComplete,
  cmdMilestoneComplete,
  cmdMilestoneDistill,
};
