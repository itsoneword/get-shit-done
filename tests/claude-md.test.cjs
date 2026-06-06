/**
 * CLAUDE.md generation and new-project workflow tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');
const { summarizeSidecar } = require('../get-shit-done/bin/lib/profile-output.cjs');

describe('generate-claude-md', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates CLAUDE.md with workflow enforcement section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Test Project\n\n## What This Is\n\nA small test project.\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'created');
    assert.strictEqual(output.sections_total, 5);
    assert.ok(output.sections_generated.includes('workflow'));

    const claudePath = path.join(tmpDir, 'CLAUDE.md');
    const content = fs.readFileSync(claudePath, 'utf-8');
    assert.ok(content.includes('## GSD Workflow Enforcement'));
    assert.ok(content.includes('/gsd2:fix'));
    assert.ok(content.includes('/gsd2:debug'));
    assert.ok(content.includes('/gsd2:execute-phase'));
    assert.ok(content.includes('Do not make direct repo edits outside a GSD workflow'));
  });

  test('adds workflow enforcement section when updating an existing CLAUDE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Test Project\n\n## What This Is\n\nA small test project.\n'
    );
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '## Local Notes\n\nKeep this intro.\n');

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'updated');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('## Local Notes'));
    assert.ok(content.includes('## GSD Workflow Enforcement'));
  });
});

describe('new-project workflow includes CLAUDE.md generation', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-project.md');

  test('new-project workflow generates CLAUDE.md before final commit', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('generate-claude-md'));
    assert.ok(content.includes('--files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md CLAUDE.md'));
  });

  test('new-project artifacts mention CLAUDE.md', () => {
    // docs/COMMANDS.md was retired (df0c60f, legacy docs/ tree retirement); the
    // workflow artifact manifest remains the source of truth for CLAUDE.md.
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');

    assert.ok(workflowContent.includes('| Project guide  | `CLAUDE.md`'));
    assert.ok(workflowContent.includes('- `CLAUDE.md`'));
  });
});

describe('map-codebase workflow auto-syncs CLAUDE.md', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'map-codebase.md');

  test('map-codebase invokes generate-claude-md --auto when CLAUDE.md exists', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('generate-claude-md --auto'),
      'workflow should call generate-claude-md --auto after mapping'
    );
    // Guarded by existence check so fresh projects don't get CLAUDE.md implicitly.
    assert.ok(
      /if \[ -f CLAUDE\.md \]/.test(content),
      'sync must be guarded by CLAUDE.md existence'
    );
  });

  test('map-codebase commits CLAUDE.md alongside sidecars when it changed', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      /commit "docs: map existing codebase" --files \.planning\/codebase\/\*\.md CLAUDE\.md/.test(content),
      'commit step should include CLAUDE.md'
    );
  });
});

describe('summarizeSidecar markdown-aware filter', () => {
  test('strips empty-valued bullets (label with no body)', () => {
    const out = summarizeSidecar('- **Service design:**\n- **Auth:** JWT in middleware');
    assert.ok(!out.includes('Service design'), 'empty-label bullet should be dropped');
    assert.ok(out.includes('**Auth:** JWT in middleware'), 'bullet with a body is kept');
  });

  test('strips placeholder-body bullets ([..] and TBD)', () => {
    const out = summarizeSidecar('- Pattern: [Patterns observed]\n- Strategy: TBD\n- Real: actual value');
    assert.ok(!out.includes('Patterns observed'), '[..] placeholder body dropped');
    assert.ok(!/Strategy: TBD/.test(out), 'TBD placeholder body dropped');
    assert.ok(out.includes('Real: actual value'), 'real bullet kept');
  });

  test('drops headings with no content before next heading / EOF', () => {
    const out = summarizeSidecar('## Import Organization\n\n## Error Handling\n\nWrap in Result type.');
    assert.ok(!out.includes('Import Organization'), 'empty heading dropped');
    assert.ok(out.includes('Error Handling'), 'heading with content kept');
    assert.ok(out.includes('Wrap in Result type.'));
  });

  test('preserves fenced code block contents verbatim', () => {
    const src = '## Data Flow\n\n```js\nconst x = 1;\nfoo(x);\n```';
    const out = summarizeSidecar(src);
    assert.ok(out.includes('const x = 1;'), 'fence content preserved');
    assert.ok(out.includes('foo(x);'), 'all fence lines preserved');
    assert.ok(out.includes('```'), 'fence markers kept');
  });

  test('demotes heading levels one step, capped at 6', () => {
    const out = summarizeSidecar('## Architecture\n\ntext\n\n### Subsection\n\nmore\n\n###### Deep\n\nx');
    assert.ok(/^### Architecture$/m.test(out), '## demoted to ###');
    assert.ok(/^#### Subsection$/m.test(out), '### demoted to ####');
    assert.ok(/^###### Deep$/m.test(out), '###### stays capped at 6');
  });

  test('strips H1 and Analysis Date metadata line', () => {
    const out = summarizeSidecar('# STACK\n\n**Analysis Date:** 2026-01-01\n\n- Node 20');
    assert.ok(!/^# STACK/m.test(out), 'H1 dropped');
    assert.ok(!/Analysis Date/.test(out), 'Analysis Date metadata dropped');
    assert.ok(out.includes('- Node 20'), 'real content kept');
  });

  test('caps content lines and appends pointer when requested', () => {
    const src = ['- a', '- b', '- c', '- d', '- e'].join('\n');
    const out = summarizeSidecar(src, { maxContentLines: 2, pointerPath: '.planning/codebase/STACK.md' });
    const bullets = out.split('\n').filter(l => /^- /.test(l));
    assert.equal(bullets.length, 2, 'capped to 2 content lines');
    assert.ok(out.includes('> For current detail: `.planning/codebase/STACK.md`'), 'pointer appended');
  });

  test('returns empty string for empty input', () => {
    assert.equal(summarizeSidecar(''), '');
    assert.equal(summarizeSidecar(null), '');
  });
});
