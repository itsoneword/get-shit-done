/**
 * Verify — Verification suite, consistency, and health validation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { safeReadFile, loadConfig, normalizePhaseName, execGit, findPhaseInternal, getMilestoneInfo, stripShippedMilestones, extractCurrentMilestone, output, error, phasesDir, relPhasesPath } = require('./core.cjs');
const { extractFrontmatter, parseMustHavesBlock } = require('./frontmatter.cjs');
const { writeStateMd } = require('./state.cjs');

// ─── Verify-loop primitives (Phase 4) ─────────────────────────────────────────

const VERIFY_VALID_TYPES = new Set(['unit', 'integration', 'e2e', 'ui']);
const VERIFY_ACTUAL_MAX_CHARS = 1024;
const VERIFY_CMD_TIMEOUT_MS = 30 * 1000;

/**
 * Parse must_haves.truths[].verify[] entries from a PLAN.md frontmatter.
 * Returns: [{ truth, cmd, expect, type }] — one entry per verify command,
 * with the parent truth string carried for traceability.
 *
 * Why this is separate from parseMustHavesBlock:
 *   parseMustHavesBlock only handles a single nesting level. The verify
 *   sub-block is one level deeper (must_haves > truths > [{verify: [...]}]),
 *   and changing parseMustHavesBlock risks breaking verify-artifacts and
 *   verify-key-links callers.
 */
function parseVerifyCommands(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!fmMatch) return [];
  const yaml = fmMatch[1];
  const lines = yaml.split(/\r?\n/);

  // Locate `truths:` block header. Indentation in real-world plans is
  // 2-space (must_haves > truths). Tolerate any indent — we lock the
  // truthsIndent at first sight and use it as the block boundary.
  let truthsIdx = -1;
  let truthsIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)truths:\s*$/);
    if (m) { truthsIdx = i; truthsIndent = m[1].length; break; }
  }
  if (truthsIdx === -1) return [];

  const out = [];
  let currentTruth = null;
  let inVerifyBlock = false;
  let pendingEntry = null;
  let dashIndent = -1; // indent of the leading "- cmd:" dash inside a verify block

  for (let i = truthsIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const indent = (line.match(/^(\s*)/) || [''])[1].length;

    // Any line indented <= the truths header ends the truths block
    if (indent <= truthsIndent) break;

    // New truth item: dash at truthsIndent + 2 (sibling level), starts with "- truth:"
    // Use a permissive indent check (any "- truth:" deeper than truthsIndent counts).
    const truthMatch = line.match(/^(\s*)-\s+truth:\s*(.*)$/);
    if (truthMatch && truthMatch[1].length === truthsIndent + 2) {
      if (pendingEntry) { out.push(pendingEntry); pendingEntry = null; }
      let raw = truthMatch[2].trim();
      raw = raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      currentTruth = raw;
      inVerifyBlock = false;
      dashIndent = -1;
      continue;
    }

    // `verify:` header — sibling of `artifacts:` under a truth (truthsIndent + 4)
    const verifyHeader = line.match(/^(\s*)verify:\s*$/);
    if (verifyHeader && verifyHeader[1].length === truthsIndent + 4) {
      if (pendingEntry) { out.push(pendingEntry); pendingEntry = null; }
      inVerifyBlock = true;
      dashIndent = -1;
      continue;
    }

    // Any other key at the same level as `verify:` ends a verify block
    // (e.g., `      artifacts:`, `      contains:`)
    if (line.match(/^(\s*)\w+:\s*$/) && indent === truthsIndent + 4) {
      if (pendingEntry) { out.push(pendingEntry); pendingEntry = null; }
      inVerifyBlock = false;
      continue;
    }

    if (!inVerifyBlock || !currentTruth) continue;

    // First dash inside a verify list — captures dash indent
    if (line.trim().startsWith('- ')) {
      const dashKv = line.match(/^(\s*)-\s+(\w+):\s*(.*)$/);
      if (dashKv) {
        const ind = dashKv[1].length;
        if (dashIndent === -1) dashIndent = ind;
        if (ind === dashIndent) {
          if (pendingEntry) { out.push(pendingEntry); pendingEntry = null; }
          pendingEntry = { truth: currentTruth };
          let val = dashKv[3].trim();
          val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
          pendingEntry[dashKv[2]] = val;
          continue;
        }
      }
    }

    // Continuation key (deeper than the dash)
    if (pendingEntry && dashIndent !== -1 && indent > dashIndent) {
      const kvMatch = line.match(/^\s*(\w+):\s*(.*)$/);
      if (kvMatch) {
        let val = kvMatch[2].trim();
        val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        pendingEntry[kvMatch[1]] = val;
      }
    }
  }
  if (pendingEntry) out.push(pendingEntry);

  return out.filter(e => e && e.cmd !== undefined);
}

/**
 * Compare captured stdout against an `expect` value.
 * - If expect is wrapped in /.../ → regex match against actual.
 * - Else → string equality on trimmed actual.
 * Returns { passed: bool, mode: 'regex'|'string' }.
 */
function matchExpect(actual, expect) {
  if (typeof expect !== 'string') return { passed: false, mode: 'string' };
  if (expect.length >= 2 && expect.startsWith('/') && expect.endsWith('/')) {
    try {
      const rx = new RegExp(expect.slice(1, -1));
      return { passed: rx.test(actual), mode: 'regex' };
    } catch {
      return { passed: false, mode: 'regex' };
    }
  }
  return { passed: actual.trim() === expect, mode: 'string' };
}

function cmdVerifyCommands(cwd, planFilePath, raw) {
  if (!planFilePath) error('plan file path required');
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) {
    output({ error: 'File not found', path: planFilePath }, raw);
    return;
  }

  const entries = parseVerifyCommands(content);
  if (entries.length === 0) {
    // Empty verify list — emit structured JSON in both raw and non-raw modes
    // so callers (verifier loop, jq pipelines) get a consistent shape.
    output({
      all_passed: true,
      passed: 0,
      total: 0,
      results: [],
      note: 'No must_haves.truths[].verify[] entries found',
    }, raw);
    return;
  }

  const results = [];
  for (const entry of entries) {
    const row = {
      truth: entry.truth || '',
      cmd: entry.cmd || '',
      expect: entry.expect !== undefined ? entry.expect : '',
      type: entry.type || '',
      actual: '',
      passed: false,
      reason: '',
    };

    // Validate type
    if (!VERIFY_VALID_TYPES.has(row.type)) {
      row.passed = false;
      row.reason = `unknown type: ${row.type || '<missing>'}`;
      results.push(row);
      continue;
    }

    // Skip ui (deferred to v2 per template note)
    if (row.type === 'ui') {
      row.passed = false;
      row.reason = 'type=ui deferred to v2';
      results.push(row);
      continue;
    }

    // Execute cmd, capture stdout
    let actual = '';
    let timedOut = false;
    let exitErr = null;
    try {
      actual = execSync(row.cmd, {
        cwd,
        encoding: 'utf-8',
        timeout: VERIFY_CMD_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: '/bin/sh',
      });
    } catch (err) {
      // execSync throws on non-zero exit OR timeout
      if (err && err.signal === 'SIGTERM') timedOut = true;
      if (err && err.code === 'ETIMEDOUT') timedOut = true;
      // Capture stdout that was emitted before failure
      if (err && err.stdout) actual = err.stdout.toString();
      exitErr = err;
    }

    // Truncate actual to mitigate prompt injection / log bloat
    if (actual.length > VERIFY_ACTUAL_MAX_CHARS) {
      actual = actual.slice(0, VERIFY_ACTUAL_MAX_CHARS);
    }
    row.actual = actual;

    if (timedOut) {
      row.passed = false;
      row.reason = 'timeout';
      results.push(row);
      continue;
    }

    const m = matchExpect(actual, row.expect);
    row.passed = m.passed;
    if (!m.passed) {
      if (exitErr && typeof exitErr.status === 'number' && exitErr.status !== 0) {
        row.reason = `exit code ${exitErr.status}`;
      } else {
        row.reason = 'output mismatch';
      }
    }
    results.push(row);
  }

  const passed = results.filter(r => r.passed).length;
  // Emit structured JSON in both raw and non-raw modes — the verifier loop
  // and jq pipelines need parseable output regardless of --raw flag.
  output({
    all_passed: passed === results.length,
    passed,
    total: results.length,
    results,
  }, raw);
}



function cmdVerifySummary(cwd, summaryPath, checkFileCount, raw) {
  if (!summaryPath) {
    error('summary-path required');
  }

  const fullPath = path.join(cwd, summaryPath);
  const checkCount = checkFileCount || 2;

  // Check 1: Summary exists
  if (!fs.existsSync(fullPath)) {
    const result = {
      passed: false,
      checks: {
        summary_exists: false,
        files_created: { checked: 0, found: 0, missing: [] },
        commits_exist: false,
        self_check: 'not_found',
      },
      errors: ['SUMMARY.md not found'],
    };
    output(result, raw, 'failed');
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const errors = [];

  // Check 2: Spot-check files mentioned in summary
  const mentionedFiles = new Set();
  const patterns = [
    /`([^`]+\.[a-zA-Z]+)`/g,
    /(?:Created|Modified|Added|Updated|Edited):\s*`?([^\s`]+\.[a-zA-Z]+)`?/gi,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const filePath = m[1];
      if (filePath && !filePath.startsWith('http') && filePath.includes('/')) {
        mentionedFiles.add(filePath);
      }
    }
  }

  const filesToCheck = Array.from(mentionedFiles).slice(0, checkCount);
  const missing = [];
  for (const file of filesToCheck) {
    if (!fs.existsSync(path.join(cwd, file))) {
      missing.push(file);
    }
  }

  // Check 3: Commits exist
  const commitHashPattern = /\b[0-9a-f]{7,40}\b/g;
  const hashes = content.match(commitHashPattern) || [];
  let commitsExist = false;
  if (hashes.length > 0) {
    for (const hash of hashes.slice(0, 3)) {
      const result = execGit(cwd, ['cat-file', '-t', hash]);
      if (result.exitCode === 0 && result.stdout === 'commit') {
        commitsExist = true;
        break;
      }
    }
  }

  // Check 4: Self-check section
  let selfCheck = 'not_found';
  const selfCheckPattern = /##\s*(?:Self[- ]?Check|Verification|Quality Check)/i;
  if (selfCheckPattern.test(content)) {
    const passPattern = /(?:all\s+)?(?:pass|✓|✅|complete|succeeded)/i;
    const failPattern = /(?:fail|✗|❌|incomplete|blocked)/i;
    const checkSection = content.slice(content.search(selfCheckPattern));
    if (failPattern.test(checkSection)) {
      selfCheck = 'failed';
    } else if (passPattern.test(checkSection)) {
      selfCheck = 'passed';
    }
  }

  if (missing.length > 0) errors.push('Missing files: ' + missing.join(', '));
  if (!commitsExist && hashes.length > 0) errors.push('Referenced commit hashes not found in git history');
  if (selfCheck === 'failed') errors.push('Self-check section indicates failure');

  const checks = {
    summary_exists: true,
    files_created: { checked: filesToCheck.length, found: filesToCheck.length - missing.length, missing },
    commits_exist: commitsExist,
    self_check: selfCheck,
  };

  const passed = missing.length === 0 && selfCheck !== 'failed';
  const result = { passed, checks, errors };
  output(result, raw, passed ? 'passed' : 'failed');
}

function cmdVerifyPlanStructure(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const fm = extractFrontmatter(content);
  const errors = [];
  const warnings = [];

  // Check required frontmatter fields
  const required = ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'];
  for (const field of required) {
    if (fm[field] === undefined) errors.push(`Missing required frontmatter field: ${field}`);
  }

  // Parse and check task elements
  const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks = [];
  let taskMatch;
  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const taskContent = taskMatch[1];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const taskName = nameMatch ? nameMatch[1].trim() : 'unnamed';
    const hasFiles = /<files>/.test(taskContent);
    const hasAction = /<action>/.test(taskContent);
    const hasVerify = /<verify>/.test(taskContent);
    const hasDone = /<done>/.test(taskContent);

    if (!nameMatch) errors.push('Task missing <name> element');
    if (!hasAction) errors.push(`Task '${taskName}' missing <action>`);
    if (!hasVerify) warnings.push(`Task '${taskName}' missing <verify>`);
    if (!hasDone) warnings.push(`Task '${taskName}' missing <done>`);
    if (!hasFiles) warnings.push(`Task '${taskName}' missing <files>`);

    tasks.push({ name: taskName, hasFiles, hasAction, hasVerify, hasDone });
  }

  if (tasks.length === 0) warnings.push('No <task> elements found');

  // Wave/depends_on consistency
  if (fm.wave && parseInt(fm.wave) > 1 && (!fm.depends_on || (Array.isArray(fm.depends_on) && fm.depends_on.length === 0))) {
    warnings.push('Wave > 1 but depends_on is empty');
  }

  // Autonomous/checkpoint consistency
  const hasCheckpoints = /<task\s+type=["']?checkpoint/.test(content);
  if (hasCheckpoints && fm.autonomous !== 'false' && fm.autonomous !== false) {
    errors.push('Has checkpoint tasks but autonomous is not false');
  }

  output({
    valid: errors.length === 0,
    errors,
    warnings,
    task_count: tasks.length,
    tasks,
    frontmatter_fields: Object.keys(fm),
  }, raw, errors.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyPhaseCompleteness(cwd, phase, raw) {
  if (!phase) { error('phase required'); }
  const phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo || !phaseInfo.found) {
    output({ error: 'Phase not found', phase }, raw);
    return;
  }

  const errors = [];
  const warnings = [];
  const phaseDir = path.join(cwd, phaseInfo.directory);

  // List plans and summaries
  let files;
  try { files = fs.readdirSync(phaseDir); } catch { output({ error: 'Cannot read phase directory' }, raw); return; }

  const plans = files.filter(f => f.match(/-PLAN\.md$/i));
  const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i));

  // Extract plan IDs (everything before -PLAN.md)
  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/i, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/i, '')));

  // Plans without summaries
  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));
  if (incompletePlans.length > 0) {
    errors.push(`Plans without summaries: ${incompletePlans.join(', ')}`);
  }

  // Summaries without plans (orphans)
  const orphanSummaries = [...summaryIds].filter(id => !planIds.has(id));
  if (orphanSummaries.length > 0) {
    warnings.push(`Summaries without plans: ${orphanSummaries.join(', ')}`);
  }

  output({
    complete: errors.length === 0,
    phase: phaseInfo.phase_number,
    plan_count: plans.length,
    summary_count: summaries.length,
    incomplete_plans: incompletePlans,
    orphan_summaries: orphanSummaries,
    errors,
    warnings,
  }, raw, errors.length === 0 ? 'complete' : 'incomplete');
}

function cmdVerifyReferences(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const found = [];
  const missing = [];

  // Find @-references: @path/to/file (must contain / to be a file path)
  const atRefs = content.match(/@([^\s\n,)]+\/[^\s\n,)]+)/g) || [];
  for (const ref of atRefs) {
    const cleanRef = ref.slice(1); // remove @
    const resolved = cleanRef.startsWith('~/')
      ? path.join(process.env.HOME || '', cleanRef.slice(2))
      : path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  // Find backtick file paths that look like real paths (contain / and have extension)
  const backtickRefs = content.match(/`([^`]+\/[^`]+\.[a-zA-Z]{1,10})`/g) || [];
  for (const ref of backtickRefs) {
    const cleanRef = ref.slice(1, -1); // remove backticks
    if (cleanRef.startsWith('http') || cleanRef.includes('${') || cleanRef.includes('{{')) continue;
    if (found.includes(cleanRef) || missing.includes(cleanRef)) continue; // dedup
    const resolved = path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  output({
    valid: missing.length === 0,
    found: found.length,
    missing,
    total: found.length + missing.length,
  }, raw, missing.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyCommits(cwd, hashes, raw) {
  if (!hashes || hashes.length === 0) { error('At least one commit hash required'); }

  const valid = [];
  const invalid = [];
  for (const hash of hashes) {
    const result = execGit(cwd, ['cat-file', '-t', hash]);
    if (result.exitCode === 0 && result.stdout.trim() === 'commit') {
      valid.push(hash);
    } else {
      invalid.push(hash);
    }
  }

  output({
    all_valid: invalid.length === 0,
    valid,
    invalid,
    total: hashes.length,
  }, raw, invalid.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyArtifacts(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const artifacts = parseMustHavesBlock(content, 'artifacts');
  if (artifacts.length === 0) {
    output({ error: 'No must_haves.artifacts found in frontmatter', path: planFilePath }, raw);
    return;
  }

  const results = [];
  for (const artifact of artifacts) {
    if (typeof artifact === 'string') continue; // skip simple string items
    const artPath = artifact.path;
    if (!artPath) continue;

    const artFullPath = path.join(cwd, artPath);
    const exists = fs.existsSync(artFullPath);
    const check = { path: artPath, exists, issues: [], passed: false };

    if (exists) {
      const fileContent = safeReadFile(artFullPath) || '';
      const lineCount = fileContent.split('\n').length;

      if (artifact.min_lines && lineCount < artifact.min_lines) {
        check.issues.push(`Only ${lineCount} lines, need ${artifact.min_lines}`);
      }
      if (artifact.contains && !fileContent.includes(artifact.contains)) {
        check.issues.push(`Missing pattern: ${artifact.contains}`);
      }
      if (artifact.exports) {
        const exports = Array.isArray(artifact.exports) ? artifact.exports : [artifact.exports];
        for (const exp of exports) {
          if (!fileContent.includes(exp)) check.issues.push(`Missing export: ${exp}`);
        }
      }
      check.passed = check.issues.length === 0;
    } else {
      check.issues.push('File not found');
    }

    results.push(check);
  }

  const passed = results.filter(r => r.passed).length;
  output({
    all_passed: passed === results.length,
    passed,
    total: results.length,
    artifacts: results,
  }, raw, passed === results.length ? 'valid' : 'invalid');
}

function cmdVerifyKeyLinks(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const keyLinks = parseMustHavesBlock(content, 'key_links');
  if (keyLinks.length === 0) {
    output({ error: 'No must_haves.key_links found in frontmatter', path: planFilePath }, raw);
    return;
  }

  const results = [];
  for (const link of keyLinks) {
    if (typeof link === 'string') continue;
    const check = { from: link.from, to: link.to, via: link.via || '', verified: false, detail: '' };

    const sourceContent = safeReadFile(path.join(cwd, link.from || ''));
    if (!sourceContent) {
      check.detail = 'Source file not found';
    } else if (link.pattern) {
      try {
        const regex = new RegExp(link.pattern);
        if (regex.test(sourceContent)) {
          check.verified = true;
          check.detail = 'Pattern found in source';
        } else {
          const targetContent = safeReadFile(path.join(cwd, link.to || ''));
          if (targetContent && regex.test(targetContent)) {
            check.verified = true;
            check.detail = 'Pattern found in target';
          } else {
            check.detail = `Pattern "${link.pattern}" not found in source or target`;
          }
        }
      } catch {
        check.detail = `Invalid regex pattern: ${link.pattern}`;
      }
    } else {
      // No pattern: just check source references target
      if (sourceContent.includes(link.to || '')) {
        check.verified = true;
        check.detail = 'Target referenced in source';
      } else {
        check.detail = 'Target not referenced in source';
      }
    }

    results.push(check);
  }

  const verified = results.filter(r => r.verified).length;
  output({
    all_verified: verified === results.length,
    verified,
    total: results.length,
    links: results,
  }, raw, verified === results.length ? 'valid' : 'invalid');
}

function cmdValidateConsistency(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const phasesRoot = phasesDir(cwd);
  const errors = [];
  const warnings = [];

  // Check for ROADMAP
  if (!fs.existsSync(roadmapPath)) {
    errors.push('ROADMAP.md not found');
    output({ passed: false, errors, warnings }, raw, 'failed');
    return;
  }

  const roadmapContentRaw = fs.readFileSync(roadmapPath, 'utf-8');
  const roadmapContent = extractCurrentMilestone(roadmapContentRaw, cwd);

  // Extract phases from ROADMAP (archived milestones already stripped)
  const roadmapPhases = new Set();
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
  let m;
  while ((m = phasePattern.exec(roadmapContent)) !== null) {
    roadmapPhases.add(m[1]);
  }

  // Get phases on disk
  const diskPhases = new Set();
  try {
    const entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    for (const dir of dirs) {
      const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
      if (dm) diskPhases.add(dm[1]);
    }
  } catch { /* intentionally empty */ }

  // Check: phases in ROADMAP but not on disk
  for (const p of roadmapPhases) {
    if (!diskPhases.has(p) && !diskPhases.has(normalizePhaseName(p))) {
      warnings.push(`Phase ${p} in ROADMAP.md but no directory on disk`);
    }
  }

  // Check: phases on disk but not in ROADMAP
  for (const p of diskPhases) {
    const unpadded = String(parseInt(p, 10));
    if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
      warnings.push(`Phase ${p} exists on disk but not in ROADMAP.md`);
    }
  }

  // Check: sequential phase numbers (integers only, skip in custom naming mode)
  const config = loadConfig(cwd);
  if (config.phase_naming !== 'custom') {
    const integerPhases = [...diskPhases]
      .filter(p => !p.includes('.'))
      .map(p => parseInt(p, 10))
      .sort((a, b) => a - b);

    for (let i = 1; i < integerPhases.length; i++) {
      if (integerPhases[i] !== integerPhases[i - 1] + 1) {
        warnings.push(`Gap in phase numbering: ${integerPhases[i - 1]} → ${integerPhases[i]}`);
      }
    }
  }

  // Check: plan numbering within phases
  try {
    const entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      const phaseFiles = fs.readdirSync(path.join(phasesRoot, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md')).sort();

      // Extract plan numbers
      const planNums = plans.map(p => {
        const pm = p.match(/-(\d{2})-PLAN\.md$/);
        return pm ? parseInt(pm[1], 10) : null;
      }).filter(n => n !== null);

      for (let i = 1; i < planNums.length; i++) {
        if (planNums[i] !== planNums[i - 1] + 1) {
          warnings.push(`Gap in plan numbering in ${dir}: plan ${planNums[i - 1]} → ${planNums[i]}`);
        }
      }

      // Check: plans without summaries (completed plans)
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md'));
      const planIds = new Set(plans.map(p => p.replace('-PLAN.md', '')));
      const summaryIds = new Set(summaries.map(s => s.replace('-SUMMARY.md', '')));

      // Summary without matching plan is suspicious
      for (const sid of summaryIds) {
        if (!planIds.has(sid)) {
          warnings.push(`Summary ${sid}-SUMMARY.md in ${dir} has no matching PLAN.md`);
        }
      }
    }
  } catch { /* intentionally empty */ }

  // Check: frontmatter in plans has required fields
  try {
    const entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const dir of dirs) {
      const phaseFiles = fs.readdirSync(path.join(phasesRoot, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md'));

      for (const plan of plans) {
        const content = fs.readFileSync(path.join(phasesRoot, dir, plan), 'utf-8');
        const fm = extractFrontmatter(content);

        if (!fm.wave) {
          warnings.push(`${dir}/${plan}: missing 'wave' in frontmatter`);
        }
      }
    }
  } catch { /* intentionally empty */ }

  const passed = errors.length === 0;
  output({ passed, errors, warnings, warning_count: warnings.length }, raw, passed ? 'passed' : 'failed');
}

// ─── Check 9: Source↔runtime symmetry (SC4) ──────────────────────────────────
//
// SUB-CHECK A — file-tree: get-shit-done/ vs .claude/get-shit-done/ (excludes agents/)
// SUB-CHECK B — settings.json: hooks + statusLine registration parity
//
// Returns { fileMismatches: [], settingsMismatches: [], runtimeAbsent: bool, settingsAbsent: bool }
// so cmdValidateHealth can call addIssue per mismatch and push repair entries.
//
// PATH-TOKEN RULE: source agent files use ~/.claude/ token; runtime uses absolute path.
// Any file path containing /agents/ or starting with agents/ is excluded from file-tree diff.
//
// EXPECTED HOOKS (derived from install.js — what the framework registers):
//   SessionStart:        gsd2-check-update.js
//   PostToolUse:         gsd2-context-monitor.js (no matcher)
//   PostToolUse[Read]:   gsd2-read-injection-scanner.js
//   PostToolUse[Task|Agent]: gsd2-agent-trace.js
//   PreToolUse[Write|Edit]:  gsd2-prompt-guard.js + gsd2-read-guard.js
//   PostToolUseFailure[Task|Agent]: gsd2-agent-trace.js
//   statusLine:          gsd2-statusline.js
//
function checkSourceRuntimeSymmetry(cwd) {
  const srcRoot = path.join(cwd, 'get-shit-done');
  const runtimeRoot = path.join(cwd, '.claude', 'get-shit-done');
  const settingsPath = path.join(cwd, '.claude', 'settings.json');

  const result = {
    fileMismatches: [],    // { relPath, reason: 'missing'|'content' }
    settingsMismatches: [], // { entry: string, reason: string }
    runtimeAbsent: false,
    settingsAbsent: false,
  };

  // ── SUB-CHECK A: file-tree diff ──────────────────────────────────────────
  if (!fs.existsSync(runtimeRoot)) {
    result.runtimeAbsent = true;
    // Skip file-tree diff — not an error, just not installed yet
    // (will emit info in caller)
  } else {
    // Walk source tree recursively; for each file check runtime counterpart
    function walkDir(dir, baseDir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const srcFull = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, srcFull);

        // PATH-TOKEN RULE: exclude any path under agents/
        // Normalize to forward slashes for cross-platform safety
        const relFwd = relPath.replace(/\\/g, '/');
        if (relFwd === 'agents' || relFwd.startsWith('agents/')) continue;

        if (entry.isDirectory()) {
          walkDir(srcFull, baseDir);
        } else {
          const runtimeFull = path.join(runtimeRoot, relPath);
          if (!fs.existsSync(runtimeFull)) {
            result.fileMismatches.push({ relPath, reason: 'missing' });
          } else {
            // Byte comparison
            const srcBuf = fs.readFileSync(srcFull);
            const runtimeBuf = fs.readFileSync(runtimeFull);
            if (!srcBuf.equals(runtimeBuf)) {
              result.fileMismatches.push({ relPath, reason: 'content' });
            }
          }
        }
      }
    }
    walkDir(srcRoot, srcRoot);
  }

  // ── SUB-CHECK B: settings.json hook/statusLine parity ───────────────────
  // Expected hook script names (basename only — any command containing the name counts)
  const EXPECTED_HOOKS = [
    { event: 'SessionStart',        script: 'gsd2-check-update.js',           matcher: null },
    { event: 'PostToolUse',         script: 'gsd2-context-monitor.js',        matcher: null },
    { event: 'PostToolUse',         script: 'gsd2-read-injection-scanner.js', matcher: 'Read' },
    { event: 'PostToolUse',         script: 'gsd2-agent-trace.js',            matcher: 'Task|Agent' },
    { event: 'PreToolUse',          script: 'gsd2-prompt-guard.js',           matcher: 'Write|Edit' },
    { event: 'PreToolUse',          script: 'gsd2-read-guard.js',             matcher: 'Write|Edit' },
    { event: 'PostToolUseFailure',  script: 'gsd2-agent-trace.js',            matcher: 'Task|Agent' },
  ];
  const EXPECTED_STATUSLINE = 'gsd2-statusline.js';

  if (!fs.existsSync(settingsPath)) {
    result.settingsAbsent = true;
    // Skip settings parity check — skip cleanly (info in caller)
  } else {
    let settings;
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      // Corrupt settings.json — report as settings drift
      result.settingsMismatches.push({ entry: 'settings.json', reason: 'JSON parse error — cannot verify parity' });
      return result;
    }

    // Check each expected hook
    for (const expected of EXPECTED_HOOKS) {
      const eventEntries = (settings.hooks || {})[expected.event] || [];
      const found = eventEntries.some(entry => {
        const hooks = entry.hooks || [];
        return hooks.some(h => h.command && h.command.includes(expected.script));
      });
      if (!found) {
        result.settingsMismatches.push({
          entry: `hooks.${expected.event}[${expected.script}]`,
          reason: `${expected.script} not registered in settings.json hooks.${expected.event}`,
        });
      }
    }

    // Check statusLine
    const sl = settings.statusLine;
    if (!sl || !sl.command || !sl.command.includes(EXPECTED_STATUSLINE)) {
      result.settingsMismatches.push({
        entry: 'statusLine',
        reason: `settings.json statusLine not pointing to ${EXPECTED_STATUSLINE}`,
      });
    }
  }

  return result;
}

function cmdValidateHealth(cwd, options, raw) {
  // Guard: detect if CWD is the home directory (likely accidental)
  const resolved = path.resolve(cwd);
  if (resolved === os.homedir()) {
    output({
      status: 'error',
      errors: [{ code: 'E010', message: `CWD is home directory (${resolved}) — health check would read the wrong .planning/ directory. Run from your project root instead.`, fix: 'cd into your project directory and retry' }],
      warnings: [],
      info: [{ code: 'I010', message: `Resolved CWD: ${resolved}` }],
      repairable_count: 0,
    }, raw);
    return;
  }

  const planningDir = path.join(cwd, '.planning');
  const projectPath = path.join(planningDir, 'PROJECT.md');
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const statePath = path.join(planningDir, 'STATE.md');
  const configPath = path.join(planningDir, 'config.json');
  const phasesRoot = phasesDir(cwd);

  const errors = [];
  const warnings = [];
  const info = [];
  const repairs = [];

  // Helper to add issue
  const addIssue = (severity, code, message, fix, repairable = false) => {
    const issue = { code, message, fix, repairable };
    if (severity === 'error') errors.push(issue);
    else if (severity === 'warning') warnings.push(issue);
    else info.push(issue);
  };

  // ─── Check 1: .planning/ exists ───────────────────────────────────────────
  if (!fs.existsSync(planningDir)) {
    addIssue('error', 'E001', '.planning/ directory not found', 'Run /gsd2:new-project to initialize');
    output({
      status: 'broken',
      errors,
      warnings,
      info,
      repairable_count: 0,
    }, raw);
    return;
  }

  // ─── Check 2: PROJECT.md exists and has required sections ─────────────────
  if (!fs.existsSync(projectPath)) {
    addIssue('error', 'E002', 'PROJECT.md not found', 'Run /gsd2:new-project to create');
  } else {
    const content = fs.readFileSync(projectPath, 'utf-8');
    const requiredSections = ['## What This Is', '## Core Value', '## Requirements'];
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        addIssue('warning', 'W001', `PROJECT.md missing section: ${section}`, 'Add section manually');
      }
    }
  }

  // ─── Check 3: ROADMAP.md exists ───────────────────────────────────────────
  if (!fs.existsSync(roadmapPath)) {
    addIssue('error', 'E003', 'ROADMAP.md not found', 'Run /gsd2:new-milestone to create roadmap');
  }

  // ─── Check 4: STATE.md exists and references valid phases ─────────────────
  if (!fs.existsSync(statePath)) {
    addIssue('error', 'E004', 'STATE.md not found', 'Run /gsd2:health --repair to regenerate', true);
    repairs.push('regenerateState');
  } else {
    const stateContent = fs.readFileSync(statePath, 'utf-8');
    // Extract phase references from STATE.md
    const phaseRefs = [...stateContent.matchAll(/[Pp]hase\s+(\d+(?:\.\d+)*)/g)].map(m => m[1]);
    // Get disk phases
    const diskPhases = new Set();
    try {
      const entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          const m = e.name.match(/^(\d+(?:\.\d+)*)/);
          if (m) diskPhases.add(m[1]);
        }
      }
    } catch { /* intentionally empty */ }
    // Check for invalid references
    for (const ref of phaseRefs) {
      const normalizedRef = String(parseInt(ref, 10)).padStart(2, '0');
      if (!diskPhases.has(ref) && !diskPhases.has(normalizedRef) && !diskPhases.has(String(parseInt(ref, 10)))) {
        // Only warn if phases dir has any content (not just an empty project)
        if (diskPhases.size > 0) {
          addIssue(
            'warning',
            'W002',
            `STATE.md references phase ${ref}, but only phases ${[...diskPhases].sort().join(', ')} exist`,
            'Review STATE.md manually before changing it; /gsd2:health --repair will not overwrite an existing STATE.md for phase mismatches'
          );
        }
      }
    }
  }

  // ─── Check 5: config.json valid JSON + valid schema ───────────────────────
  if (!fs.existsSync(configPath)) {
    addIssue('warning', 'W003', 'config.json not found', 'Run /gsd2:health --repair to create with defaults', true);
    repairs.push('createConfig');
  } else {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      // Validate known fields
      const validProfiles = ['quality', 'balanced', 'budget', 'inherit'];
      if (parsed.model_profile && !validProfiles.includes(parsed.model_profile)) {
        addIssue('warning', 'W004', `config.json: invalid model_profile "${parsed.model_profile}"`, `Valid values: ${validProfiles.join(', ')}`);
      }
    } catch (err) {
      addIssue('error', 'E005', `config.json: JSON parse error - ${err.message}`, 'Run /gsd2:health --repair to reset to defaults', true);
      repairs.push('resetConfig');
    }
  }

  // ─── Check 5b: Nyquist validation key presence ──────────────────────────
  if (fs.existsSync(configPath)) {
    try {
      const configRaw = fs.readFileSync(configPath, 'utf-8');
      const configParsed = JSON.parse(configRaw);
      if (configParsed.workflow && configParsed.workflow.nyquist_validation === undefined) {
        addIssue('warning', 'W008', 'config.json: workflow.nyquist_validation absent (defaults to enabled but agents may skip)', 'Run /gsd2:health --repair to add key', true);
        if (!repairs.includes('addNyquistKey')) repairs.push('addNyquistKey');
      }
    } catch { /* intentionally empty */ }
  }

  // ─── Check 6: Phase directory naming (NN-name format) ─────────────────────
  try {
    const entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.match(/^\d{2}(?:\.\d+)*-[\w-]+$/)) {
        addIssue('warning', 'W005', `Phase directory "${e.name}" doesn't follow NN-name format`, 'Rename to match pattern (e.g., 01-setup)');
      }
    }
  } catch { /* intentionally empty */ }

  // ─── Check 7: Orphaned plans (PLAN without SUMMARY) ───────────────────────
  try {
    const entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const phaseFiles = fs.readdirSync(path.join(phasesRoot, e.name));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      const summaryBases = new Set(summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '')));

      for (const plan of plans) {
        const planBase = plan.replace('-PLAN.md', '').replace('PLAN.md', '');
        if (!summaryBases.has(planBase)) {
          addIssue('info', 'I001', `${e.name}/${plan} has no SUMMARY.md`, 'May be in progress');
        }
      }
    }
  } catch { /* intentionally empty */ }

  // ─── Check 7b: Nyquist VALIDATION.md consistency ────────────────────────
  try {
    const phaseEntries = fs.readdirSync(phasesRoot, { withFileTypes: true });
    for (const e of phaseEntries) {
      if (!e.isDirectory()) continue;
      const phaseFiles = fs.readdirSync(path.join(phasesRoot, e.name));
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md'));
      const hasValidation = phaseFiles.some(f => f.endsWith('-VALIDATION.md'));
      if (hasResearch && !hasValidation) {
        const researchFile = phaseFiles.find(f => f.endsWith('-RESEARCH.md'));
        const researchContent = fs.readFileSync(path.join(phasesRoot, e.name, researchFile), 'utf-8');
        if (researchContent.includes('## Validation Architecture')) {
          addIssue('warning', 'W009', `Phase ${e.name}: has Validation Architecture in RESEARCH.md but no VALIDATION.md`, 'Re-run /gsd2:plan-phase with --research to regenerate');
        }
      }
    }
  } catch { /* intentionally empty */ }

  // ─── Check 8: Run existing consistency checks ─────────────────────────────
  // Inline subset of cmdValidateConsistency
  if (fs.existsSync(roadmapPath)) {
    const roadmapContentRaw = fs.readFileSync(roadmapPath, 'utf-8');
    const roadmapContent = extractCurrentMilestone(roadmapContentRaw, cwd);
    const roadmapPhases = new Set();
    const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
    let m;
    while ((m = phasePattern.exec(roadmapContent)) !== null) {
      roadmapPhases.add(m[1]);
    }

    const diskPhases = new Set();
    try {
      const entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          const dm = e.name.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
          if (dm) diskPhases.add(dm[1]);
        }
      }
    } catch { /* intentionally empty */ }

    // Phases in ROADMAP but not on disk
    for (const p of roadmapPhases) {
      const padded = String(parseInt(p, 10)).padStart(2, '0');
      if (!diskPhases.has(p) && !diskPhases.has(padded)) {
        addIssue('warning', 'W006', `Phase ${p} in ROADMAP.md but no directory on disk`, 'Create phase directory or remove from roadmap');
      }
    }

    // Phases on disk but not in ROADMAP
    for (const p of diskPhases) {
      const unpadded = String(parseInt(p, 10));
      if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
        addIssue('warning', 'W007', `Phase ${p} exists on disk but not in ROADMAP.md`, 'Add to roadmap or remove directory');
      }
    }
  }

  // ─── Check 9: Source↔runtime symmetry ────────────────────────────────────
  {
    const symmetry = checkSourceRuntimeSymmetry(cwd);

    if (symmetry.runtimeAbsent) {
      addIssue('info', 'I003', 'source↔runtime check: .claude/get-shit-done/ not found (not installed?)', 'Run the installer to create the runtime copy');
    } else {
      for (const m of symmetry.fileMismatches) {
        addIssue(
          'error',
          'E-DRIFT',
          `source-runtime drift: ${m.relPath} (${m.reason === 'missing' ? 'missing in runtime' : 'content differs'})`,
          'Run /gsd2:health --repair to re-sync source→runtime',
          true
        );
        if (!repairs.includes('syncSourceRuntime')) repairs.push('syncSourceRuntime');
      }
    }

    if (symmetry.settingsAbsent) {
      addIssue('info', 'I004', 'source↔runtime check: .claude/settings.json not found — skipping hook/statusLine parity check', 'Run the installer to register hooks');
    } else {
      for (const m of symmetry.settingsMismatches) {
        addIssue(
          'error',
          'E-SETTINGS-DRIFT',
          `settings.json parity drift: ${m.entry} — ${m.reason}`,
          'Re-run the GSD installer to restore hook registrations',
          false // settings.json parity is not auto-repairable (installer owns it)
        );
      }
    }
  }

  // ─── Perform repairs if requested ─────────────────────────────────────────
  const repairActions = [];
  if (options.repair && repairs.length > 0) {
    for (const repair of repairs) {
      try {
        switch (repair) {
          case 'createConfig':
          case 'resetConfig': {
            const defaults = {
              model_profile: 'balanced',
              commit_docs: true,
              search_gitignored: false,
              branching_strategy: 'none',
              phase_branch_template: 'gsd/phase-{phase}-{slug}',
              milestone_branch_template: 'gsd/{milestone}-{slug}',
              quick_branch_template: null,
              workflow: {
                research: true,
                plan_check: true,
                verifier: true,
                nyquist_validation: true,
              },
              parallelization: true,
              brave_search: false,
            };
            fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
            repairActions.push({ action: repair, success: true, path: 'config.json' });
            break;
          }
          case 'regenerateState': {
            // Create timestamped backup before overwriting
            if (fs.existsSync(statePath)) {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
              const backupPath = `${statePath}.bak-${timestamp}`;
              fs.copyFileSync(statePath, backupPath);
              repairActions.push({ action: 'backupState', success: true, path: backupPath });
            }
            // Generate minimal STATE.md from ROADMAP.md structure
            const milestone = getMilestoneInfo(cwd);
            let stateContent = `# Session State\n\n`;
            stateContent += `## Project Reference\n\n`;
            stateContent += `See: .planning/PROJECT.md\n\n`;
            stateContent += `## Position\n\n`;
            stateContent += `**Milestone:** ${milestone.version} ${milestone.name}\n`;
            stateContent += `**Current phase:** (determining...)\n`;
            stateContent += `**Status:** Resuming\n\n`;
            stateContent += `## Session Log\n\n`;
            stateContent += `- ${new Date().toISOString().split('T')[0]}: STATE.md regenerated by /gsd2:health --repair\n`;
            writeStateMd(statePath, stateContent, cwd);
            repairActions.push({ action: repair, success: true, path: 'STATE.md' });
            break;
          }
          case 'addNyquistKey': {
            if (fs.existsSync(configPath)) {
              try {
                const configRaw = fs.readFileSync(configPath, 'utf-8');
                const configParsed = JSON.parse(configRaw);
                if (!configParsed.workflow) configParsed.workflow = {};
                if (configParsed.workflow.nyquist_validation === undefined) {
                  configParsed.workflow.nyquist_validation = true;
                  fs.writeFileSync(configPath, JSON.stringify(configParsed, null, 2), 'utf-8');
                }
                repairActions.push({ action: repair, success: true, path: 'config.json' });
              } catch (err) {
                repairActions.push({ action: repair, success: false, error: err.message });
              }
            }
            break;
          }
          case 'syncSourceRuntime': {
            // Repair: copy source get-shit-done/ → .claude/get-shit-done/, excluding agents/
            const srcRoot = path.join(cwd, 'get-shit-done');
            const runtimeRoot = path.join(cwd, '.claude', 'get-shit-done');
            let syncCount = 0;
            function syncDir(dir, baseDir) {
              let entries;
              try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
              for (const entry of entries) {
                const srcFull = path.join(dir, entry.name);
                const relPath = path.relative(baseDir, srcFull);
                const relFwd = relPath.replace(/\\/g, '/');
                // PATH-TOKEN RULE: skip agents/
                if (relFwd === 'agents' || relFwd.startsWith('agents/')) continue;
                const runtimeFull = path.join(runtimeRoot, relPath);
                if (entry.isDirectory()) {
                  try { fs.mkdirSync(runtimeFull, { recursive: true }); } catch { /* ok */ }
                  syncDir(srcFull, baseDir);
                } else {
                  try {
                    fs.copyFileSync(srcFull, runtimeFull);
                    syncCount++;
                  } catch (err) {
                    repairActions.push({ action: 'syncSourceRuntime', success: false, error: err.message, file: relPath });
                  }
                }
              }
            }
            if (fs.existsSync(srcRoot)) {
              syncDir(srcRoot, srcRoot);
              repairActions.push({ action: 'syncSourceRuntime', success: true, files_synced: syncCount });
            }
            break;
          }
        }
      } catch (err) {
        repairActions.push({ action: repair, success: false, error: err.message });
      }
    }
  }

  // ─── Determine overall status ─────────────────────────────────────────────
  let status;
  if (errors.length > 0) {
    status = 'broken';
  } else if (warnings.length > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const repairableCount = errors.filter(e => e.repairable).length +
                         warnings.filter(w => w.repairable).length;

  output({
    status,
    errors,
    warnings,
    info,
    repairable_count: repairableCount,
    repairs_performed: repairActions.length > 0 ? repairActions : undefined,
  }, raw);
}

module.exports = {
  cmdVerifySummary,
  cmdVerifyPlanStructure,
  cmdVerifyPhaseCompleteness,
  cmdVerifyReferences,
  cmdVerifyCommits,
  cmdVerifyArtifacts,
  cmdVerifyKeyLinks,
  cmdVerifyCommands,
  cmdValidateConsistency,
  cmdValidateHealth,
  // Internal helpers exported for downstream tooling/tests
  parseVerifyCommands,
  // Exported for execute-phase post-merge reuse (Plan 07-06)
  checkSourceRuntimeSymmetry,
};
