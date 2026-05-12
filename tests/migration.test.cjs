/**
 * Tests for migrate-to-milestone-partition subcommand.
 *
 * Covers SC-2 (dry-run + prompt), SC-3 (full migration, git mv, ref rewrite),
 * SC-4 (STATE.md milestone source-of-truth), and B4 (crash-recovery atomicity).
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  createLegacyGitFixture,
  createTempGitProject,
  runGsdTools,
  runGsdToolsWithInput,
  cleanup,
} = require('./helpers.cjs');

describe('migrate-to-milestone-partition: refusal cases', () => {
  test('missing STATE.md milestone field → exit 1, clear error', () => {
    const tmp = createTempGitProject();
    // Note: createTempGitProject writes a PROJECT.md but no STATE.md milestone
    try {
      const r = runGsdTools(['migrate-to-milestone-partition', '--dry-run'], tmp);
      assert.strictEqual(r.success, false);
      assert.match(r.error + r.output, /milestone.*frontmatter|STATE\.md/i);
    } finally { cleanup(tmp); }
  });

  test('corrupt STATE.md frontmatter (no `milestone:` line) → exit 1, clear error', () => {
    const tmp = createTempGitProject();
    fs.writeFileSync(path.join(tmp, '.planning', 'STATE.md'), '---\nstatus: broken\n---\n# State\n');
    try {
      const r = runGsdTools(['migrate-to-milestone-partition', '--dry-run'], tmp);
      assert.strictEqual(r.success, false);
      assert.match(r.error + r.output, /milestone/i);
    } finally { cleanup(tmp); }
  });

  test('already-partitioned project → exit 0, prints "nothing to migrate"', () => {
    const tmp = createLegacyGitFixture('v1.4');
    // Pre-migrate by moving the dir manually
    fs.mkdirSync(path.join(tmp, '.planning', 'v1.4'), { recursive: true });
    execSync(`mv "${path.join(tmp, '.planning', 'phases')}" "${path.join(tmp, '.planning', 'v1.4', 'phases')}"`, { stdio: 'pipe' });
    // Also remove path-shaped refs to legacy phases/ so there's nothing to rewrite either
    for (const f of ['STATE.md', 'PROJECT.md', 'ROADMAP.md', 'cross-phase-notes.md']) {
      const p = path.join(tmp, '.planning', f);
      let c = fs.readFileSync(p, 'utf-8');
      c = c.replace(/\.planning\/phases\//g, `.planning/v1.4/phases/`);
      fs.writeFileSync(p, c, 'utf-8');
    }
    for (const td of [
      path.join(tmp, '.planning', 'todos', 'pending', 'todo-1.md'),
      path.join(tmp, '.planning', 'quick', '260507-u0a-test', 'PLAN.md'),
    ]) {
      if (fs.existsSync(td)) {
        let c = fs.readFileSync(td, 'utf-8');
        c = c.replace(/\.planning\/phases\//g, `.planning/v1.4/phases/`);
        c = c.replace(/(^|[^a-zA-Z./_])phases\//g, `$1v1.4/phases/`);
        fs.writeFileSync(td, c, 'utf-8');
      }
    }
    execSync('git add -A && git commit -m "manual pre-migrate"', { cwd: tmp, stdio: 'pipe' });
    try {
      const r = runGsdTools(['migrate-to-milestone-partition', '--dry-run'], tmp);
      assert.strictEqual(r.success, true);
      assert.match(r.output, /(nothing to migrate|already partitioned)/i);
    } finally { cleanup(tmp); }
  });

  test('stale manifest from prior crash → exit 1, instructs user to recover', () => {
    const tmp = createLegacyGitFixture('v1.4');
    fs.writeFileSync(path.join(tmp, '.planning', '.migration-manifest.json'), '{"status":"in-progress"}');
    try {
      const r = runGsdTools(['migrate-to-milestone-partition', '--dry-run'], tmp);
      assert.strictEqual(r.success, false);
      assert.match(r.error + r.output, /manifest|previous.*incomplete|recover/i);
    } finally { cleanup(tmp); }
  });
});

describe('migrate-to-milestone-partition: dry-run', () => {
  test('--dry-run prints plan with dir-move list and ref-rewrite counts; does NOT mutate', () => {
    const tmp = createLegacyGitFixture('v1.4', ['01-foo', '02-bar']);
    try {
      const r = runGsdTools(['migrate-to-milestone-partition', '--dry-run'], tmp);
      assert.strictEqual(r.success, true, r.error);
      assert.match(r.output, /(would move|MIGRATION PLAN|PHASE DIRECTORIES TO MOVE)/i);
      assert.match(r.output, /01-foo/);
      assert.match(r.output, /02-bar/);
      assert.match(r.output, /v1\.4/);
      // Verify no mutation
      assert.ok(fs.existsSync(path.join(tmp, '.planning', 'phases', '01-foo')));
      assert.ok(!fs.existsSync(path.join(tmp, '.planning', 'v1.4', 'phases', '01-foo')));
      // Verify STATE.md unchanged
      const state = fs.readFileSync(path.join(tmp, '.planning', 'STATE.md'), 'utf-8');
      assert.match(state, /\.planning\/phases\/01-foo/);
    } finally { cleanup(tmp); }
  });
});

describe('migrate-to-milestone-partition: confirmation gate', () => {
  test('answers `n` to [y/N] → aborts without changes', () => {
    const tmp = createLegacyGitFixture('v1.4');
    try {
      const r = runGsdToolsWithInput(['migrate-to-milestone-partition'], tmp, 'n\n');
      // Either exits 0 with "aborted" or exits non-zero — both acceptable, as long as no mutation
      assert.ok(fs.existsSync(path.join(tmp, '.planning', 'phases', '01-foo')));
      assert.ok(!fs.existsSync(path.join(tmp, '.planning', 'v1.4', 'phases', '01-foo')));
      assert.match(r.output + r.error, /(abort|cancel)/i);
    } finally { cleanup(tmp); }
  });

  test('--yes flag bypasses prompt and runs full migration', () => {
    const tmp = createLegacyGitFixture('v1.4');
    try {
      const r = runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      assert.strictEqual(r.success, true, r.error);
      // Old path gone, new path exists
      assert.ok(!fs.existsSync(path.join(tmp, '.planning', 'phases', '01-foo')));
      assert.ok(fs.existsSync(path.join(tmp, '.planning', 'v1.4', 'phases', '01-foo')));
    } finally { cleanup(tmp); }
  });
});

describe('migrate-to-milestone-partition: full migration (SC-3)', () => {
  test('git mv preserves history (git log --follow shows pre-migration commit)', () => {
    const tmp = createLegacyGitFixture('v1.4');
    try {
      const r = runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      assert.strictEqual(r.success, true, r.error);
      const log = execSync('git log --follow --format=%s .planning/v1.4/phases/01-foo/01-PLAN.md',
        { cwd: tmp, encoding: 'utf-8' });
      assert.match(log, /initial/);
    } finally { cleanup(tmp); }
  });

  test('STATE.md path-shaped refs rewritten to .planning/v1.4/phases/...', () => {
    const tmp = createLegacyGitFixture('v1.4');
    try {
      runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      const state = fs.readFileSync(path.join(tmp, '.planning', 'STATE.md'), 'utf-8');
      assert.match(state, /\.planning\/v1\.4\/phases\/01-foo/);
      assert.doesNotMatch(state, /\.planning\/phases\/01-foo/);
    } finally { cleanup(tmp); }
  });

  test('PROJECT.md and ROADMAP.md and cross-phase-notes.md all rewritten', () => {
    const tmp = createLegacyGitFixture('v1.4');
    try {
      runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      for (const f of ['PROJECT.md', 'ROADMAP.md', 'cross-phase-notes.md']) {
        const txt = fs.readFileSync(path.join(tmp, '.planning', f), 'utf-8');
        assert.match(txt, /\.planning\/v1\.4\/phases/, `${f} should reference partition`);
        assert.doesNotMatch(txt, /(?<!v1\.4\/)phases\/01-foo/, `${f} should not retain legacy ref`);
      }
    } finally { cleanup(tmp); }
  });

  test('todos/**/*.md path-shaped refs rewritten; bare phases/NN refs in path context rewritten; free prose untouched', () => {
    const tmp = createLegacyGitFixture('v1.4');
    try {
      runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      const todoText = fs.readFileSync(path.join(tmp, '.planning', 'todos', 'pending', 'todo-1.md'), 'utf-8');
      // Path-shaped refs rewritten
      assert.match(todoText, /\.planning\/v1\.4\/phases\/01-foo/);
      assert.match(todoText, /v1\.4\/phases\/02-bar/);  // bare phases/NN-slug rewritten
      // Free-prose "see phases 1-3 for context" must remain untouched
      assert.match(todoText, /phases 1-3/);
    } finally { cleanup(tmp); }
  });

  test('quick/**/*.md path-shaped refs rewritten', () => {
    const tmp = createLegacyGitFixture('v1.4');
    try {
      runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      const quickText = fs.readFileSync(path.join(tmp, '.planning', 'quick', '260507-u0a-test', 'PLAN.md'), 'utf-8');
      assert.match(quickText, /\.planning\/v1\.4\/phases\/01-foo/);
    } finally { cleanup(tmp); }
  });

  test('single commit captures the entire migration (one new commit after migration)', () => {
    const tmp = createLegacyGitFixture('v1.4');
    const before = execSync('git log --oneline | wc -l', { cwd: tmp, encoding: 'utf-8' }).trim();
    try {
      runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      const after = execSync('git log --oneline | wc -l', { cwd: tmp, encoding: 'utf-8' }).trim();
      assert.strictEqual(parseInt(after, 10), parseInt(before, 10) + 1);
      const lastMsg = execSync('git log -1 --format=%s', { cwd: tmp, encoding: 'utf-8' }).trim();
      assert.match(lastMsg, /(migrate|partition|chore)/i);
    } finally { cleanup(tmp); }
  });

  test('working tree is clean after migration (no untracked / unstaged changes)', () => {
    const tmp = createLegacyGitFixture('v1.4');
    try {
      runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      const status = execSync('git status --porcelain', { cwd: tmp, encoding: 'utf-8' });
      assert.strictEqual(status, '', 'working tree should be clean after migration');
    } finally { cleanup(tmp); }
  });
});

describe('migrate-to-milestone-partition: pre-flight checks', () => {
  test('uncommitted .planning/ changes → refuse with clear error', () => {
    const tmp = createLegacyGitFixture('v1.4');
    fs.writeFileSync(path.join(tmp, '.planning', 'phases', '01-foo', 'extra.md'), 'untracked');
    try {
      const r = runGsdTools(['migrate-to-milestone-partition', '--yes'], tmp);
      assert.strictEqual(r.success, false);
      assert.match(r.error + r.output, /(uncommitted|clean|stash)/i);
    } finally { cleanup(tmp); }
  });
});

describe('migrate-to-milestone-partition: crash recovery (B4 — CONTEXT.md atomicity requirement)', () => {
  test('crash-mid-migration leaves recoverable state: manifest persisted + git reset --hard HEAD restores original layout', () => {
    const tmp = createLegacyGitFixture('v1.4', ['01-foo', '02-bar', '03-baz']);
    try {
      // Strategy: monkey-patch child_process.execSync to throw on the second `git mv` call.
      // We do this by spawning a child node process that:
      //   1. Patches cp.execSync
      //   2. require()s the migration module
      //   3. Calls cmdMigrateToMilestonePartition()
      const migrationModule = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'migration.cjs').replace(/\\/g, '/');
      const tmpPosix = tmp.replace(/\\/g, '/');
      const bootstrap = `
        const cp = require('child_process');
        const origExecSync = cp.execSync;
        let movesSeen = 0;
        cp.execSync = function(cmd, opts) {
          if (typeof cmd === 'string' && cmd.startsWith('git mv ')) {
            movesSeen++;
            if (movesSeen >= 2) {
              throw new Error('simulated crash mid-migration on move #' + movesSeen);
            }
          }
          return origExecSync.call(this, cmd, opts);
        };
        const { cmdMigrateToMilestonePartition } = require('${migrationModule}');
        process.chdir('${tmpPosix}');
        const result = cmdMigrateToMilestonePartition(process.cwd(), { dryRun: false, yes: true }, true);
        if (result && typeof result.catch === 'function') {
          result.catch(() => process.exit(99));
        }
      `;
      // Run from project root so the require path resolves; pass tmp as cwd via opts.
      const result = require('child_process').spawnSync(
        process.execPath, ['-e', bootstrap],
        { cwd: tmp, encoding: 'utf-8' }
      );
      // Either crash exit code OR migration's own non-zero exit — both indicate failure
      assert.notStrictEqual(result.status, 0, 'expected crash exit, got success');

      // Manifest persisted (B4 AC1)
      const manifestPath = path.join(tmp, '.planning', '.migration-manifest.json');
      assert.ok(fs.existsSync(manifestPath), 'manifest should persist after crash');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.strictEqual(manifest.status, 'in-progress');
      assert.ok(Array.isArray(manifest.plan?.moves) || Array.isArray(manifest.moves),
        'manifest should record planned moves');

      // git status shows partially-moved state (B4 AC2)
      const status = execSync('git status --porcelain', { cwd: tmp, encoding: 'utf-8' });
      assert.notStrictEqual(status.trim(), '', 'expected dirty working tree after crash');

      // git reset --hard HEAD restores original layout (B4 AC2)
      // First delete the manifest (it's untracked, reset won't remove it)
      fs.unlinkSync(manifestPath);
      execSync('git clean -fd .planning/', { cwd: tmp, stdio: 'pipe' });
      execSync('git reset --hard HEAD', { cwd: tmp, stdio: 'pipe' });
      // Original layout restored: legacy dir back, partitioned dir gone
      assert.ok(fs.existsSync(path.join(tmp, '.planning', 'phases', '01-foo')),
        'after reset, legacy 01-foo should be present');
      assert.ok(!fs.existsSync(path.join(tmp, '.planning', 'v1.4', 'phases', '01-foo'))
        || !fs.existsSync(path.join(tmp, '.planning', 'v1.4')),
        'after reset, partitioned tree should be gone');
    } finally { cleanup(tmp); }
  });
});
