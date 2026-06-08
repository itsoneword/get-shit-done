/**
 * Worktree — Git worktree lifecycle helpers for parallel executor isolation.
 *
 * Implements SC1: conflicts surface as reviewable merges instead of silent overwrites.
 * Consumes the Phase 6 git-worktree technique reference (detect-existing, ignore-check,
 * sandbox fallback). Does NOT re-derive those semantics.
 *
 * API:
 *   cmdWorktreeAdd(cwd, dir, branch, opts)    — create linked worktree
 *   cmdWorktreeMerge(cwd, branch, opts)        — merge branch; per-merge clean check
 *   cmdWorktreeRemove(cwd, dir, opts)          — remove worktree + delete branch
 *   cmdWorktreePrune(cwd)                      — git worktree prune
 *
 * Exit-code semantics: all functions emit JSON via output() and exit 0 except on
 * hard command errors (which call error() and exit 1). A conflict is a detected
 * state ({clean:false}) — NOT a hard error — so cmdWorktreeMerge exits 0 on conflict.
 * On conflict, leave the reviewable state for humans — do NOT abort the merge.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { output, error } = require('./core.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Run a git command; return { ok, stdout, stderr, code }.
 * Never throws.
 */
function git(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    code: result.status,
  };
}

/**
 * Check whether cwd is already inside a linked worktree (not a submodule).
 * Returns true if already isolated.
 */
function isAlreadyInWorktree(cwd) {
  const gitDir = git(['rev-parse', '--git-dir'], cwd);
  const gitCommon = git(['rev-parse', '--git-common-dir'], cwd);
  if (!gitDir.ok || !gitCommon.ok) return false;
  if (gitDir.stdout === gitCommon.stdout) return false;
  // Submodule guard
  const superproject = git(['rev-parse', '--show-superproject-working-tree'], cwd);
  if (superproject.ok && superproject.stdout) return false; // in submodule, not worktree
  return true;
}

/**
 * Ensure .worktrees/ is in .gitignore for project-local worktree dirs.
 * Only fires when the worktree dir is under cwd.
 */
function ensureWorktreeDirIgnored(cwd, wtDir) {
  // Only check project-local paths
  const rel = path.relative(cwd, wtDir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return; // outside project

  // Check if already ignored
  const check = spawnSync('git', ['check-ignore', '-q', '.worktrees'], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (check.status === 0) return; // already ignored

  // Add .worktrees/ to .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  let existing = '';
  try { existing = fs.readFileSync(gitignorePath, 'utf-8'); } catch {}
  if (!existing.split('\n').some(l => l.trim() === '.worktrees/')) {
    const sep = existing.endsWith('\n') || existing === '' ? '' : '\n';
    fs.writeFileSync(gitignorePath, existing + sep + '.worktrees/\n', 'utf-8');
  }
  // Commit the .gitignore change
  const addR = git(['add', '.gitignore'], cwd);
  if (addR.ok) {
    git(['commit', '-q', '-m', 'chore: add .worktrees/ to .gitignore'], cwd);
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * gsd-tools worktree add <dir> <branch> [--base <branch>]
 *
 * Creates a linked worktree at <dir> on a new branch <branch> forked from <base>
 * (defaults to HEAD). Runs Step 0 detect-existing and the ignore-check.
 * On sandbox failure, returns {ok:false, fallback:"in-place"} without throwing.
 */
function cmdWorktreeAdd(cwd, dir, branch, opts, raw) {
  if (!dir) { error('worktree add: <dir> is required'); return; }
  if (!branch) { error('worktree add: <branch> is required'); return; }

  const base = opts.base || 'HEAD';

  // Step 0: detect existing isolation
  if (isAlreadyInWorktree(cwd)) {
    output({ ok: true, skipped: true, reason: 'already-in-worktree', dir, branch }, raw);
    return;
  }

  // Ignore check for project-local dirs
  ensureWorktreeDirIgnored(cwd, dir);

  // Create the worktree directory's parent if needed
  const wtParent = path.dirname(dir);
  if (!fs.existsSync(wtParent)) {
    fs.mkdirSync(wtParent, { recursive: true });
  }

  const result = git(['worktree', 'add', dir, '-b', branch, base], cwd);
  if (!result.ok) {
    // Sandbox / permission fallback
    const reason = result.stderr || result.stdout;
    const isSandboxError = /permission denied|operation not permitted|sandbox/i.test(reason);
    if (isSandboxError) {
      output({ ok: false, fallback: 'in-place', reason }, raw);
      return;
    }
    output({ ok: false, reason }, raw);
    return;
  }

  output({ ok: true, dir, branch, base }, raw);
}

/**
 * gsd-tools worktree merge <branch>
 *
 * Merges <branch> into the current branch using --no-ff.
 * Checks exit code PER-CALL (Pitfall 2 guard).
 * Returns {clean:bool, conflict_files:[]}.
 * NEVER aborts a conflicting merge — leaves conflict state for human review.
 */
function cmdWorktreeMerge(cwd, branch, _opts, raw) {
  if (!branch) { error('worktree merge: <branch> is required'); return; }

  const mergeResult = git(['merge', branch, '--no-ff'], cwd);

  if (mergeResult.ok) {
    // Clean merge
    output({ clean: true, branch, conflict_files: [] }, raw);
    return;
  }

  // Conflict — parse unmerged paths
  const unmergedResult = git(['diff', '--name-only', '--diff-filter=U'], cwd);
  const conflictFiles = unmergedResult.ok && unmergedResult.stdout
    ? unmergedResult.stdout.split('\n').filter(Boolean)
    : [];

  // Leave conflict state reviewable — do NOT abort
  output({ clean: false, branch, conflict_files: conflictFiles }, raw);
}

/**
 * gsd-tools worktree remove <dir> [--branch <branch>] [--force]
 *
 * Removes the linked worktree at <dir> and deletes the associated branch.
 * Force-removes on explicit --force flag.
 */
function cmdWorktreeRemove(cwd, dir, opts, raw) {
  if (!dir) { error('worktree remove: <dir> is required'); return; }

  const forceFlag = opts.force ? ['--force'] : [];
  const removeResult = git(['worktree', 'remove', dir, ...forceFlag], cwd);

  if (!removeResult.ok && !opts.force) {
    // Retry with force
    git(['worktree', 'remove', dir, '--force'], cwd);
  }

  // Delete the associated branch if provided
  if (opts.branch) {
    const delResult = git(['branch', '-d', opts.branch], cwd);
    if (!delResult.ok) {
      git(['branch', '-D', opts.branch], cwd); // force-delete on failure path
    }
  }

  output({ ok: true, dir, branch: opts.branch || null }, raw);
}

/**
 * gsd-tools worktree prune
 *
 * Cleans up stale worktree administrative files (e.g., from crashed orchestrators).
 */
function cmdWorktreePrune(cwd, raw) {
  const result = git(['worktree', 'prune'], cwd);
  output({ ok: result.ok, stderr: result.stderr || null }, raw);
}

// ─── Router entry point ───────────────────────────────────────────────────────

/**
 * Dispatch gsd-tools worktree <subcommand> [args...]
 * Called from gsd-tools.cjs case 'worktree' block.
 */
function cmdWorktree(cwd, args, raw) {
  const sub = args[1];

  switch (sub) {
    case 'add': {
      const dir = args[2];
      const branch = args[3];
      const baseIdx = args.indexOf('--base');
      const opts = { base: baseIdx !== -1 ? args[baseIdx + 1] : undefined };
      cmdWorktreeAdd(cwd, dir, branch, opts, raw);
      break;
    }
    case 'merge': {
      const branch = args[2];
      cmdWorktreeMerge(cwd, branch, {}, raw);
      break;
    }
    case 'remove': {
      const dir = args[2];
      const branchIdx = args.indexOf('--branch');
      const opts = {
        branch: branchIdx !== -1 ? args[branchIdx + 1] : undefined,
        force: args.includes('--force'),
      };
      cmdWorktreeRemove(cwd, dir, opts, raw);
      break;
    }
    case 'prune': {
      cmdWorktreePrune(cwd, raw);
      break;
    }
    default:
      error(`Unknown worktree subcommand: ${sub}. Available: add, merge, remove, prune`);
  }
}

module.exports = {
  cmdWorktreeAdd,
  cmdWorktreeMerge,
  cmdWorktreeRemove,
  cmdWorktreePrune,
  cmdWorktree,
};
