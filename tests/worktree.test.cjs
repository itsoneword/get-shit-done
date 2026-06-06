/**
 * Worktree tests — lifecycle + merge-back + conflict detection (SC-1)
 *
 * Wave 0 (Task 1): environment smoke test + write-isolation probe.
 * Task 2: lifecycle (add/merge/remove/prune) and conflict-detection tests.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { createTempGitRepo, runGsdTools } = require('./helpers.cjs');

// ─── Wave 0: Environment smoke tests ─────────────────────────────────────────

test('git worktree add/remove works in this environment', () => {
  const repo = createTempGitRepo();
  try {
    const wtDir = repo.dir + '-wt';
    // Must use git worktree add
    execSync(`git worktree add "${wtDir}" -b smoke HEAD`, {
      cwd: repo.dir,
      stdio: 'pipe',
    });
    assert.ok(fs.existsSync(wtDir), 'worktree dir should exist after add');
    execSync(`git worktree remove "${wtDir}"`, {
      cwd: repo.dir,
      stdio: 'pipe',
    });
    assert.ok(!fs.existsSync(wtDir), 'worktree dir should be gone after remove');
  } finally {
    repo.cleanup();
  }
});

test('writes into worktree dir land on worktree branch, not main HEAD', () => {
  const repo = createTempGitRepo();
  const wtDir = repo.dir + '-wt-probe';
  try {
    // Create a linked worktree on a new branch
    execSync(`git worktree add "${wtDir}" -b probe HEAD`, {
      cwd: repo.dir,
      stdio: 'pipe',
    });

    // Write a file into the worktree's working directory via absolute path
    const probeFile = path.join(wtDir, 'probe.txt');
    fs.writeFileSync(probeFile, 'written-in-worktree\n');

    // Commit from within the worktree directory
    execSync('git add -A', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -q -m "add probe file"', { cwd: wtDir, stdio: 'pipe' });

    // (a) File should exist on the probe branch
    const onProbeBranch = execSync(`git show probe:probe.txt`, {
      cwd: repo.dir,
      encoding: 'utf-8',
    }).trim();
    assert.equal(onProbeBranch, 'written-in-worktree', 'file should exist on probe branch');

    // (b) File should NOT exist on main branch HEAD
    let mainHasFile = false;
    try {
      execSync(`git show HEAD:probe.txt`, { cwd: repo.dir, stdio: 'pipe' });
      mainHasFile = true;
    } catch {
      // expected: path does not exist in HEAD — isolation confirmed
    }
    assert.equal(mainHasFile, false, 'probe.txt must NOT exist on main HEAD — on-disk isolation verified');

    // Cleanup worktree before repo cleanup
    execSync(`git worktree remove "${wtDir}" --force`, {
      cwd: repo.dir,
      stdio: 'pipe',
    });
  } finally {
    try { execSync(`git worktree remove "${wtDir}" --force`, { cwd: repo.dir, stdio: 'pipe' }); } catch {}
    repo.cleanup();
  }
});

// ─── Task 2: worktree CLI lifecycle tests ─────────────────────────────────────
// These tests drive the gsd-tools worktree subcommand.
// They are RED at Task 1 commit (command not yet implemented) and turn GREEN
// after Task 2 implements worktree.cjs and wires the router.

test('worktree add creates linked worktree dir and branch', () => {
  const repo = createTempGitRepo();
  const wtDir = path.join(repo.dir, '.worktrees', 'test-branch');
  try {
    const result = runGsdTools(
      ['worktree', 'add', wtDir, 'test-branch'],
      repo.dir
    );
    assert.ok(result.success, `worktree add failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.equal(parsed.ok, true, 'should return {ok:true}');
    assert.ok(fs.existsSync(wtDir), 'worktree dir should exist after add');
    const listOut = execSync('git worktree list --porcelain', {
      cwd: repo.dir,
      encoding: 'utf-8',
    });
    assert.ok(listOut.includes('test-branch'), 'branch should appear in git worktree list');
  } finally {
    try {
      execSync(`git worktree remove "${wtDir}" --force`, { cwd: repo.dir, stdio: 'pipe' });
    } catch {}
    try {
      execSync('git branch -D test-branch', { cwd: repo.dir, stdio: 'pipe' });
    } catch {}
    repo.cleanup();
  }
});

test('worktree merge: disjoint files → returns {clean:true}, both files present', () => {
  const repo = createTempGitRepo();
  const wtDir = path.join(repo.dir, '.worktrees', 'feature-a');
  try {
    // Create worktree on feature-a branch
    const addResult = runGsdTools(['worktree', 'add', wtDir, 'feature-a'], repo.dir);
    assert.ok(addResult.success, `worktree add failed: ${addResult.error}`);

    // Write a file in the worktree (disjoint — not touching seed.txt)
    fs.writeFileSync(path.join(wtDir, 'feature-a.txt'), 'feature a content\n');
    execSync('git add -A', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -q -m "add feature-a.txt"', { cwd: wtDir, stdio: 'pipe' });

    // Merge feature-a into main
    const mergeResult = runGsdTools(['worktree', 'merge', 'feature-a'], repo.dir);
    assert.ok(mergeResult.success, `worktree merge failed: ${mergeResult.error}`);
    const parsed = JSON.parse(mergeResult.output);
    assert.equal(parsed.clean, true, 'disjoint merge should be clean');
    assert.ok(
      fs.existsSync(path.join(repo.dir, 'feature-a.txt')),
      'feature-a.txt should be present after clean merge'
    );
  } finally {
    try { execSync(`git worktree remove "${wtDir}" --force`, { cwd: repo.dir, stdio: 'pipe' }); } catch {}
    try { execSync('git branch -D feature-a', { cwd: repo.dir, stdio: 'pipe' }); } catch {}
    repo.cleanup();
  }
});

test('worktree merge: conflicting same-line edit → returns {clean:false}, base file not silently overwritten', () => {
  const repo = createTempGitRepo();
  const wtDir = path.join(repo.dir, '.worktrees', 'conflict-branch');
  try {
    // Create worktree on conflict-branch
    const addResult = runGsdTools(['worktree', 'add', wtDir, 'conflict-branch'], repo.dir);
    assert.ok(addResult.success, `worktree add failed: ${addResult.error}`);

    // Both main and worktree edit seed.txt differently to create a conflict
    // Worktree edits first
    fs.writeFileSync(path.join(wtDir, 'seed.txt'), 'version-from-worktree\n');
    execSync('git add -A', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -q -m "worktree edit seed.txt"', { cwd: wtDir, stdio: 'pipe' });

    // Now edit seed.txt on main branch too (diverge)
    fs.writeFileSync(path.join(repo.dir, 'seed.txt'), 'version-from-main\n');
    execSync('git add -A', { cwd: repo.dir, stdio: 'pipe' });
    execSync('git commit -q -m "main edit seed.txt"', { cwd: repo.dir, stdio: 'pipe' });

    // Attempt to merge — should conflict
    const mergeResult = runGsdTools(['worktree', 'merge', 'conflict-branch'], repo.dir);
    // Command itself should succeed (conflict is a detected state, not a command failure)
    assert.ok(mergeResult.success, `worktree merge command itself failed unexpectedly: ${mergeResult.error}`);
    const parsed = JSON.parse(mergeResult.output);
    assert.equal(parsed.clean, false, 'conflicting merge should return clean:false');
    assert.ok(
      Array.isArray(parsed.conflict_files) && parsed.conflict_files.length > 0,
      'conflict_files should be a non-empty array'
    );

    // seed.txt must NOT be silently overwritten to either single branch's version
    const seedContent = fs.readFileSync(path.join(repo.dir, 'seed.txt'), 'utf-8');
    assert.notEqual(seedContent, 'version-from-main\n', 'seed.txt must not be main-only version (conflict markers expected)');
    assert.notEqual(seedContent, 'version-from-worktree\n', 'seed.txt must not be worktree-only version (conflict markers expected)');

    // git status should show unmerged paths
    const statusOut = execSync('git status --porcelain', {
      cwd: repo.dir,
      encoding: 'utf-8',
    });
    assert.ok(statusOut.includes('UU') || statusOut.includes('AA'), 'git status should show unmerged paths');

    // Abort the conflict for cleanup
    execSync('git merge --abort', { cwd: repo.dir, stdio: 'pipe' });
  } finally {
    try { execSync('git merge --abort', { cwd: repo.dir, stdio: 'pipe' }); } catch {}
    try { execSync(`git worktree remove "${wtDir}" --force`, { cwd: repo.dir, stdio: 'pipe' }); } catch {}
    try { execSync('git branch -D conflict-branch', { cwd: repo.dir, stdio: 'pipe' }); } catch {}
    repo.cleanup();
  }
});

test('worktree remove deletes the dir and branch', () => {
  const repo = createTempGitRepo();
  const wtDir = path.join(repo.dir, '.worktrees', 'remove-me');
  try {
    const addResult = runGsdTools(['worktree', 'add', wtDir, 'remove-me'], repo.dir);
    assert.ok(addResult.success, `worktree add failed: ${addResult.error}`);
    assert.ok(fs.existsSync(wtDir), 'worktree dir must exist before remove');

    const removeResult = runGsdTools(['worktree', 'remove', wtDir, '--branch', 'remove-me'], repo.dir);
    assert.ok(removeResult.success, `worktree remove failed: ${removeResult.error}`);
    assert.ok(!fs.existsSync(wtDir), 'worktree dir should be gone after remove');

    // Branch should be deleted too
    let branchExists = false;
    try {
      execSync('git rev-parse --verify remove-me', { cwd: repo.dir, stdio: 'pipe' });
      branchExists = true;
    } catch {}
    assert.equal(branchExists, false, 'branch should be deleted after worktree remove');
  } finally {
    try { execSync(`git worktree remove "${wtDir}" --force`, { cwd: repo.dir, stdio: 'pipe' }); } catch {}
    try { execSync('git branch -D remove-me', { cwd: repo.dir, stdio: 'pipe' }); } catch {}
    repo.cleanup();
  }
});
