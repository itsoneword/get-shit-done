/**
 * Unit tests for summarizeSidecar — markdown-aware filter for CLAUDE.md generation.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { summarizeSidecar } = require('../get-shit-done/bin/lib/profile-output.cjs');

describe('summarizeSidecar', () => {
  test('strips H1 heading and "Analysis Date" metadata', () => {
    const input = [
      '# Technology Stack',
      '**Analysis Date:** 2026-01-15',
      '',
      '## Languages',
      '- TypeScript 5.4',
    ].join('\n');
    const out = summarizeSidecar(input);
    assert.ok(!out.includes('# Technology Stack'));
    assert.ok(!out.includes('Analysis Date'));
    assert.ok(out.includes('TypeScript 5.4'));
  });

  test('demotes ## to ### and ### to ####', () => {
    const input = [
      '## Languages',
      '- Go 1.21',
      '',
      '### Subsection',
      'body',
    ].join('\n');
    const out = summarizeSidecar(input);
    assert.ok(out.includes('### Languages'), 'expected ### Languages');
    assert.ok(out.includes('#### Subsection'), 'expected #### Subsection');
    assert.ok(!/^## /m.test(out), 'no ## should remain');
  });

  test('preserves fenced code block contents', () => {
    const input = [
      '## Data Flow',
      '',
      '```',
      'Request → Controller → Service → Repo',
      'Response ← Controller ← Service ← Repo',
      '```',
    ].join('\n');
    const out = summarizeSidecar(input);
    assert.ok(out.includes('Request → Controller → Service → Repo'),
      'fence content must be preserved');
    assert.ok(out.includes('Response ← Controller ← Service ← Repo'),
      'fence content must be preserved');
    // fences themselves remain
    assert.match(out, /```/);
  });

  test('drops empty-valued bullets (label with no body)', () => {
    const input = [
      '## Patterns',
      '- **Service design:**',
      '- **Error handling:** try/catch with structured logger',
      '- **Agent class contract:**   ',
    ].join('\n');
    const out = summarizeSidecar(input);
    assert.ok(!out.includes('Service design'), 'empty label should be dropped');
    assert.ok(!out.includes('Agent class contract'), 'whitespace-only body should be dropped');
    assert.ok(out.includes('Error handling'), 'labeled bullet with body must remain');
  });

  test('drops bullets whose body is placeholder text', () => {
    const input = [
      '## Naming',
      '- Files: kebab-case.ts',
      '- Variables: [Pattern]',
      '- Types: TBD',
    ].join('\n');
    const out = summarizeSidecar(input);
    assert.ok(out.includes('Files: kebab-case.ts'));
    assert.ok(!out.includes('[Pattern]'), 'placeholder [..] should be dropped');
    assert.ok(!/- Types: TBD/.test(out), 'TBD placeholder should be dropped');
  });

  test('drops headings with no content beneath them', () => {
    const input = [
      '## Import Organization',
      '',
      '## Conventions',
      '- camelCase functions',
    ].join('\n');
    const out = summarizeSidecar(input);
    assert.ok(!out.includes('Import Organization'), 'empty heading must be removed');
    assert.ok(out.includes('Conventions'), 'heading with content must remain');
    assert.ok(out.includes('camelCase functions'));
  });

  test('preserves tables', () => {
    const input = [
      '## Frameworks',
      '| Framework | Version |',
      '|-----------|---------|',
      '| React | 18.2 |',
    ].join('\n');
    const out = summarizeSidecar(input);
    assert.ok(out.includes('| React | 18.2 |'));
  });

  test('does not demote headings past level 6', () => {
    const input = '###### Already level six\nbody';
    const out = summarizeSidecar(input);
    // Should remain at 6, not become 7 hashes
    assert.ok(!/^#{7} /m.test(out));
  });

  test('caps output to maxContentLines (non-blank content lines) when provided', () => {
    const input = Array.from({ length: 40 }, (_, i) => `- item ${i + 1}`).join('\n');
    const out = summarizeSidecar(input, { maxContentLines: 10 });
    const contentLines = out.split('\n').filter((l) => l.trim() !== '');
    assert.ok(contentLines.length <= 10, `expected ≤10 content lines, got ${contentLines.length}`);
    assert.ok(out.includes('- item 1'));
    assert.ok(!out.includes('- item 40'), 'late content should be trimmed');
  });

  test('does not leave a trailing orphan heading after cap', () => {
    // Long list followed by a heading whose content lies past the cap boundary
    const input = [
      '## Top',
      ...Array.from({ length: 12 }, (_, i) => `- item ${i + 1}`),
      '## Layers',
      'body of layers',
    ].join('\n');
    const out = summarizeSidecar(input, { maxContentLines: 10, pointerPath: 'x.md' });
    // "Layers" body was cut by the cap; heading should not remain orphan
    assert.ok(!/###\s+Layers/.test(out), 'orphan heading must be stripped');
  });

  test('appends pointer line when pointerPath option provided', () => {
    const input = '## Section\n- a\n- b';
    const out = summarizeSidecar(input, { pointerPath: '.planning/codebase/STACK.md' });
    assert.ok(
      out.includes('> For current detail: `.planning/codebase/STACK.md`'),
      'pointer line must be appended'
    );
    // pointer should be at the end
    const lines = out.trim().split('\n');
    assert.match(lines[lines.length - 1], /> For current detail:/);
  });
});
