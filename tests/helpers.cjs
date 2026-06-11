/**
 * GSD Tools Test Helpers
 */

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOLS_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

/**
 * Run gsd-tools command.
 *
 * @param {string|string[]} args - Command string (shell-interpreted) or array
 *   of arguments (shell-bypassed via execFileSync, safe for JSON and dollar signs).
 * @param {string} cwd - Working directory.
 * @param {object} [opts] - Optional options. opts.env overrides the child-process env.
 */
function runGsdTools(args, cwd = process.cwd(), opts = {}) {
  const childEnv = opts.env !== undefined ? opts.env : { ...process.env };
  try {
    let result;
    if (Array.isArray(args)) {
      result = execFileSync(process.execPath, [TOOLS_PATH, ...args], {
        cwd,
        env: childEnv,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      result = execSync(`node "${TOOLS_PATH}" ${args}`, {
        cwd,
        env: childEnv,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Create temp directory structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

// Create temp directory with initialized git repo and at least one commit
function createTempGitProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });

  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    '# Project\n\nTest project.\n'
  );

  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });

  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

/**
 * Create a minimal git repo with a single seed commit.
 * Returns { dir, cleanup } — caller must call cleanup() when done.
 * Suitable for worktree tests: has an initial commit, gpg signing disabled.
 */
function createTempGitRepo() {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-wt-'));
  execSync('git init -q', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed\n');
  execSync('git add -A', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -q -m "init"', { cwd: dir, stdio: 'pipe' });
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

// Write minimal STATE.md frontmatter with milestone: <version>
function withStateMilestone(tmpDir, version) {
  const statePath = path.join(tmpDir, '.planning', 'STATE.md');
  const content = `---\nmilestone: ${version}\nmilestone_name: test\nstatus: unknown\n---\n\n# State\n`;
  fs.writeFileSync(statePath, content, 'utf-8');
  return statePath;
}

// Create temp project in LEGACY layout: .planning/phases/<NN-slug>/...
// (i.e. pre-Phase-5 shape — no milestone partition)
function createLegacyLayoutFixture(milestone = 'v1.0') {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  withStateMilestone(tmpDir, milestone);
  return tmpDir;
}

// Create temp project in PARTITIONED layout: .planning/<milestone>/phases/<NN-slug>/...
function createPartitionedFixture(milestone = 'v1.4') {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', milestone, 'phases'), { recursive: true });
  withStateMilestone(tmpDir, milestone);
  return tmpDir;
}

// Create a temp project on the LEGACY layout WITH git history + a populated phase tree.
// Used as the standard fixture for migrate-to-milestone-partition tests.
function createLegacyGitFixture(milestone = 'v1.4', phaseSlugs = ['01-foo', '02-bar']) {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-mig-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });

  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config commit.gpgsign false', { cwd: tmpDir, stdio: 'pipe' });

  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
    `---\nmilestone: ${milestone}\nstatus: active\n---\n\n# State\n\nSee .planning/phases/01-foo/01-PLAN.md\n`);
  fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'),
    `# Project\n\nRefs: .planning/phases/01-foo/ and .planning/phases/02-bar/\n`);
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap ${milestone}\n\nPhase 01: .planning/phases/01-foo\nPhase 02: .planning/phases/02-bar\n`);
  fs.writeFileSync(path.join(tmpDir, '.planning', 'cross-phase-notes.md'),
    `# Cross-phase notes\n\nNote: see .planning/phases/01-foo/01-SUMMARY.md\n`);

  for (const slug of phaseSlugs) {
    const dir = path.join(tmpDir, '.planning', 'phases', slug);
    fs.mkdirSync(dir, { recursive: true });
    const phaseNum = slug.split('-')[0];
    fs.writeFileSync(path.join(dir, `${phaseNum}-PLAN.md`),
      `# Plan ${phaseNum}\n\nSee .planning/phases/${slug}/${phaseNum}-PLAN.md\n`);
  }

  // todos and quick — path-shaped refs
  fs.mkdirSync(path.join(tmpDir, '.planning', 'todos', 'pending'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'todos', 'pending', 'todo-1.md'),
    `# TODO\n\nLinked from .planning/phases/01-foo. Also see phases/02-bar/02-PLAN.md for context.\nFree prose: see phases 1-3 for context.\n`);
  fs.mkdirSync(path.join(tmpDir, '.planning', 'quick', '260507-u0a-test'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'quick', '260507-u0a-test', 'PLAN.md'),
    `# Quick\n\nSee .planning/phases/01-foo for prior art.\n`);

  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}

// Helper: feed stdin to runGsdTools by using a string input via spawnSync
function runGsdToolsWithInput(args, cwd, stdinInput = '') {
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, [TOOLS_PATH, ...args], {
    cwd, input: stdinInput, encoding: 'utf-8',
  });
  return {
    success: result.status === 0,
    output: (result.stdout || '').trim(),
    error: (result.stderr || '').trim(),
    code: result.status,
  };
}

module.exports = {
  runGsdTools,
  createTempProject,
  createTempGitProject,
  createTempGitRepo,
  createLegacyLayoutFixture,
  createPartitionedFixture,
  createLegacyGitFixture,
  runGsdToolsWithInput,
  withStateMilestone,
  cleanup,
  TOOLS_PATH,
};
