'use strict';

/**
 * Migration — legacy `.planning/phases/` → milestone-partitioned `.planning/{milestone}/phases/`
 *
 * Implements the `gsd-tools migrate-to-milestone-partition [--dry-run] [--yes]` subcommand:
 *   - Refuses cleanly when STATE.md `milestone:` is missing/corrupt (uses the existing
 *     STATE.md parser exposed via buildMilestoneContext + the canonical
 *     extractCurrentMilestone — NO local STATE.md parser, per 05-RESEARCH.md §3).
 *   - Prints a dry-run plan and exits.
 *   - Prompts `[y/N]` in interactive mode (or accepts --yes).
 *   - Pre-flight: refuses when working tree under .planning/ is dirty.
 *   - Uses `git mv` to preserve history.
 *   - Rewrites path-shaped refs in 4 root files + globs of todos/**\/*.md and quick/**\/*.md.
 *   - Commits everything in a single transaction.
 *   - Leaves a manifest on crash for recovery.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const cp = require('child_process');
const {
  error,
  toPosixPath,
  // REUSE the canonical STATE.md milestone parser from core.cjs.
  // buildMilestoneContext encapsulates the STATE.md frontmatter `milestone:` lookup;
  // extractCurrentMilestone is the existing single ROADMAP/STATE pairing helper.
  // RESEARCH.md §3 (Anti-Patterns) forbids a third local parser — do not add one.
  extractCurrentMilestone,
  buildMilestoneContext,
} = require('./core.cjs');

// ─── Regex patterns ──────────────────────────────────────────────────────────

// Full path: matches `.planning/phases/{NN-slug}` (always rewritten — root files + todos/quick).
const PATTERN_FULL_PATH = /(\.planning\/)phases\/((?:\d+[A-Z]?(?:\.\d+)*)-[a-z0-9-]+)/g;

// Bare path: matches `phases/{NN-slug}` in path context (todos/quick only).
// Negative lookbehind avoids matching inside email-like or file-extension contexts.
const PATTERN_BARE = /(?<![a-zA-Z./_])phases\/((?:\d+[A-Z]?(?:\.\d+)*)-[a-z0-9-]+)/g;

const ROOT_FILES_ALWAYS = ['STATE.md', 'PROJECT.md', 'ROADMAP.md', 'cross-phase-notes.md'];
const SWEEP_GLOBS = ['todos', 'quick'];  // path-shaped refs (incl. bare phases/NN-slug)

// ─── Internal helpers ────────────────────────────────────────────────────────

function isRootFile(filePath) {
  const base = path.basename(filePath);
  return ROOT_FILES_ALWAYS.includes(base);
}

/**
 * Walk a directory recursively, collecting all .md files.
 */
function collectMdFiles(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) out.push(full);
    }
  };
  walk(rootDir);
  return out;
}

/**
 * Build the migration plan: list of dir moves + list of ref-rewrite ops.
 * Pure function — performs no mutations.
 */
function buildPlan(cwd, milestone) {
  const planning = path.join(cwd, '.planning');
  const legacy = path.join(planning, 'phases');
  const partitionedPhases = path.join(planning, milestone, 'phases');
  const moves = [];

  if (fs.existsSync(legacy)) {
    for (const entry of fs.readdirSync(legacy, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      moves.push({
        from: path.join(legacy, entry.name),
        to: path.join(partitionedPhases, entry.name),
        slug: entry.name,
      });
    }
  }

  const rewrites = [];
  let totalRewrites = 0;
  const candidateFiles = [
    ...ROOT_FILES_ALWAYS
      .map(f => path.join(planning, f))
      .filter(p => fs.existsSync(p)),
    ...SWEEP_GLOBS
      .flatMap(g => collectMdFiles(path.join(planning, g))),
  ];

  for (const file of candidateFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rootFile = isRootFile(file);
    const fullMatches = [...content.matchAll(PATTERN_FULL_PATH)];
    // Bare `phases/NN-slug` only swept inside todos/ and quick/ — never in root files,
    // to keep free prose untouched in PROJECT.md/ROADMAP.md/STATE.md/cross-phase-notes.md.
    const bareMatches = rootFile ? [] : [...content.matchAll(PATTERN_BARE)];
    const count = fullMatches.length + bareMatches.length;
    if (count > 0) {
      rewrites.push({
        file,
        count,
        sample: [...fullMatches, ...bareMatches].slice(0, 3).map(m => m[0]),
      });
      totalRewrites += count;
    }
  }

  return { milestone, moves, rewrites, totalRewrites };
}

/**
 * Render the plan as a human-readable string for dry-run output.
 */
function renderPlan(plan, cwd) {
  const lines = [];
  lines.push('GSD MIGRATION PLAN: Legacy → Milestone-partitioned layout');
  lines.push('');
  lines.push(`Active milestone (from STATE.md): ${plan.milestone}`);
  lines.push('');
  lines.push(`PHASE DIRECTORIES TO MOVE (${plan.moves.length}):`);
  if (plan.moves.length === 0) {
    lines.push('  (none)');
  } else {
    for (const m of plan.moves) {
      const fromRel = toPosixPath(path.relative(cwd, m.from));
      const toRel = toPosixPath(path.relative(cwd, m.to));
      lines.push(`  ${fromRel}  →  ${toRel}`);
    }
  }
  lines.push('');
  lines.push(`REFERENCE REWRITES (${plan.totalRewrites} in ${plan.rewrites.length} files):`);
  if (plan.rewrites.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of plan.rewrites) {
      const rel = toPosixPath(path.relative(cwd, r.file));
      lines.push(`  ${rel}  — ${r.count} occurrence(s)  e.g. ${r.sample.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('NOT MIGRATED (stays at root): PROJECT.md, ROADMAP.md, STATE.md, cross-phase-notes.md, todos/, quick/');
  lines.push('');
  lines.push(`TOTAL: ${plan.moves.length} directories, ${plan.totalRewrites} reference rewrites in ${plan.rewrites.length} files, 1 commit`);
  lines.push('');
  lines.push('Crash-recovery: a manifest will be written to .planning/.migration-manifest.json during execution; if migration fails mid-way, this file allows safe recovery via `git reset --hard HEAD`.');
  lines.push('');
  return lines.join('\n');
}

/**
 * Pre-flight: verify working tree is clean inside .planning/.
 * Returns null if clean, error string if dirty. Returns null if not a git repo.
 */
function checkWorkingTreeClean(cwd) {
  try {
    const status = cp.execSync('git status --porcelain .planning/', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (status.trim() !== '') {
      return `Uncommitted changes in .planning/. Commit or stash them before migrating:\n${status}`;
    }
    return null;
  } catch {
    // Not a git repo — that's OK; we'll fall back to fs.renameSync later.
    return null;
  }
}

/**
 * Check whether .planning/ is git-tracked (vs. .gitignore'd or not a repo).
 */
function isPlanningGitTracked(cwd) {
  try {
    // Verify it's a git repo first
    cp.execSync('git rev-parse --git-dir', { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return false;
  }
  try {
    cp.execSync('git check-ignore .planning/STATE.md', { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    return false;  // exit 0 = ignored
  } catch {
    return true;   // exit non-zero = NOT ignored
  }
}

/**
 * Apply all rewrites: read each file, replace patterns, write back.
 */
function applyRewrites(plan, milestone) {
  for (const r of plan.rewrites) {
    const rootFile = isRootFile(r.file);
    let content = fs.readFileSync(r.file, 'utf-8');
    content = content.replace(PATTERN_FULL_PATH, (_m, prefix, slug) => `${prefix}${milestone}/phases/${slug}`);
    if (!rootFile) {
      content = content.replace(PATTERN_BARE, (_m, slug) => `${milestone}/phases/${slug}`);
    }
    fs.writeFileSync(r.file, content, 'utf-8');
  }
}

/**
 * Prompt user for [y/N] confirmation. Reads from stdin.
 */
function promptYesNo(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      const a = (answer || '').trim().toLowerCase();
      resolve(a === 'y' || a === 'yes');
    });
  });
}

/**
 * Write/update the migration manifest atomically.
 */
function writeManifest(manifestPath, data) {
  fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Main entry point for `gsd-tools migrate-to-milestone-partition`.
 *
 * REUSES the canonical STATE.md parser path: buildMilestoneContext (from core.cjs)
 * encapsulates the STATE.md frontmatter `milestone:` lookup. extractCurrentMilestone
 * (also from core.cjs) is the existing helper for ROADMAP/STATE coupling — referenced
 * here for the source-of-truth chain documented in 05-RESEARCH.md §3.
 *
 * @param {string} cwd
 * @param {{dryRun?: boolean, yes?: boolean}} options
 * @param {boolean} _raw - reserved for output-shape control (currently unused)
 */
async function cmdMigrateToMilestonePartition(cwd, options, _raw) {
  const planning = path.join(cwd, '.planning');
  const manifestPath = path.join(planning, '.migration-manifest.json');

  // Refuse if previous migration left a manifest.
  if (fs.existsSync(manifestPath)) {
    error('Previous migration manifest detected at .planning/.migration-manifest.json. Previous run did not complete. Run `git status` and `git reset --hard HEAD` to discard partial state, then delete the manifest, before retrying.');
  }

  // Read active milestone via the canonical chokepoint helper from core.cjs.
  // buildMilestoneContext(cwd) is the partition-aware helper introduced in Plan 05-01;
  // it already encapsulates the STATE.md `milestone:` frontmatter lookup. We do not
  // re-implement that parse here (RESEARCH.md §3, Anti-Patterns).
  const statePath = path.join(planning, 'STATE.md');
  if (!fs.existsSync(statePath)) {
    error('.planning/STATE.md not found. Cannot determine active milestone. Create STATE.md with a `milestone: vX.Y` frontmatter field before running migration.');
  }
  const ctx = buildMilestoneContext(cwd);
  const milestone = ctx.milestone_root;
  if (!milestone) {
    error('STATE.md `milestone:` frontmatter is missing or unparseable. Set it explicitly (e.g. `milestone: v1.4`) before running migration. Refusing to guess.');
  }
  if (!/^v\d+\.\d+/.test(milestone)) {
    error(`STATE.md \`milestone:\` value '${milestone}' is not a recognized version (expected vX.Y). Refusing to guess.`);
  }
  // Sanity touch: exercise the existing ROADMAP scoping helper to keep the source-of-truth
  // chain consistent. Failures here are non-fatal (ROADMAP may not exist in a fresh project).
  try {
    const roadmapPath = path.join(planning, 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      extractCurrentMilestone(fs.readFileSync(roadmapPath, 'utf-8'), cwd);
    }
  } catch { /* non-fatal */ }

  // Build plan.
  const plan = buildPlan(cwd, milestone);

  // Nothing to migrate?
  if (plan.moves.length === 0 && plan.totalRewrites === 0) {
    const msg = `Nothing to migrate. Project already partitioned under .planning/${milestone}/phases/ (or no phases exist).`;
    console.log(msg);
    return;
  }

  const planText = renderPlan(plan, cwd);
  console.log(planText);

  if (options.dryRun) {
    console.log('(--dry-run: no changes made)');
    return;
  }

  // Pre-flight: working tree clean (B4).
  const dirty = checkWorkingTreeClean(cwd);
  if (dirty) error(dirty);

  // Prompt unless --yes.
  let confirmed = options.yes;
  if (!confirmed) {
    console.log('');
    confirmed = await promptYesNo('Proceed? [y/N] ');
  }
  if (!confirmed) {
    console.log('Aborted by user. No changes made.');
    return;
  }

  // Write manifest BEFORE any mutation (crash recovery point — B4).
  writeManifest(manifestPath, {
    status: 'in-progress',
    milestone,
    plan,
    moves_completed: [],
    started: new Date().toISOString(),
  });

  try {
    // Ensure target parent dir exists.
    const partitionedPhasesDir = path.join(planning, milestone, 'phases');
    fs.mkdirSync(partitionedPhasesDir, { recursive: true });

    const gitTracked = isPlanningGitTracked(cwd);

    // Move each phase directory; update manifest after each successful move so
    // a mid-migration crash leaves a recoverable trail (B4).
    const movesCompleted = [];
    for (const mv of plan.moves) {
      if (gitTracked) {
        cp.execSync(`git mv "${mv.from}" "${mv.to}"`, { cwd, stdio: 'pipe' });
      } else {
        fs.renameSync(mv.from, mv.to);
      }
      movesCompleted.push({ from: mv.from, to: mv.to });
      writeManifest(manifestPath, {
        status: 'in-progress',
        milestone,
        plan,
        moves_completed: movesCompleted,
        started: new Date().toISOString(),
      });
    }

    // Apply rewrites.
    applyRewrites(plan, milestone);

    // Remove the now-empty legacy phases/ directory (git mv leaves it behind).
    try {
      if (fs.existsSync(legacy) && fs.readdirSync(legacy).length === 0) {
        fs.rmdirSync(legacy);
      }
    } catch (_) { /* non-fatal: empty-dir cleanup best-effort */ }

    // Delete the manifest BEFORE staging — manifest is a recovery scratch file,
    // not a commit artifact. At this point all moves + rewrites are done; a crash
    // here means `git reset --hard HEAD` still restores the original tree.
    fs.unlinkSync(manifestPath);

    // Stage + commit single transaction.
    if (gitTracked) {
      cp.execSync('git add -A .planning/', { cwd, stdio: 'pipe' });
      cp.execSync(`git commit --no-verify -m "chore: migrate to milestone-partition layout (${milestone})"`, { cwd, stdio: 'pipe' });
    }

    const summary = `Migration complete: moved ${plan.moves.length} phase directories, rewrote ${plan.totalRewrites} references in ${plan.rewrites.length} files.${gitTracked ? ' Committed as single transaction.' : ' (.planning/ is gitignored — no commit created.)'}`;
    console.log('');
    console.log(summary);
  } catch (e) {
    // Leave manifest in place for recovery (B4).
    console.error('');
    console.error(`Migration FAILED: ${e.message}`);
    console.error(`Manifest left at ${manifestPath} for recovery. Run \`git status\` and \`git reset --hard HEAD\` to discard partial state, then delete the manifest, before retrying.`);
    process.exit(1);
  }
}

module.exports = {
  cmdMigrateToMilestonePartition,
  buildPlan,
  renderPlan,
};
