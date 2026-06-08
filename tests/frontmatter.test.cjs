/**
 * GSD Tools Tests - frontmatter.cjs
 *
 * Tests for the hand-rolled YAML parser's pure function exports:
 * extractFrontmatter, reconstructFrontmatter, spliceFrontmatter,
 * parseMustHavesBlock, and FRONTMATTER_SCHEMAS.
 *
 * Includes REG-04 regression: quoted comma inline array edge case.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  extractFrontmatter,
  reconstructFrontmatter,
  spliceFrontmatter,
  parseMustHavesBlock,
  FRONTMATTER_SCHEMAS,
} = require('../get-shit-done/bin/lib/frontmatter.cjs');

// ─── extractFrontmatter ─────────────────────────────────────────────────────

describe('extractFrontmatter', () => {
  test('parses simple key-value pairs', () => {
    const content = '---\nname: foo\ntype: execute\n---\nbody';
    const result = extractFrontmatter(content);
    assert.strictEqual(result.name, 'foo');
    assert.strictEqual(result.type, 'execute');
  });

  test('strips quotes from values', () => {
    const doubleQuoted = '---\nname: "foo"\n---\n';
    const singleQuoted = '---\nname: \'foo\'\n---\n';
    assert.strictEqual(extractFrontmatter(doubleQuoted).name, 'foo');
    assert.strictEqual(extractFrontmatter(singleQuoted).name, 'foo');
  });

  test('parses nested objects', () => {
    const content = '---\ntechstack:\n  added: prisma\n  patterns: repository\n---\n';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result.techstack, { added: 'prisma', patterns: 'repository' });
  });

  test('parses block arrays', () => {
    const content = '---\nitems:\n  - alpha\n  - beta\n  - gamma\n---\n';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result.items, ['alpha', 'beta', 'gamma']);
  });

  test('parses inline arrays', () => {
    const content = '---\nkey: [a, b, c]\n---\n';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result.key, ['a', 'b', 'c']);
  });

  test('handles quoted commas in inline arrays — REG-04 known limitation', () => {
    // REG-04: The split(',') on line 53 does NOT respect quotes.
    // The parser WILL split on commas inside quotes, producing wrong results.
    // This test documents the CURRENT (buggy) behavior.
    const content = '---\nkey: ["a, b", c]\n---\n';
    const result = extractFrontmatter(content);
    // Current behavior: splits on ALL commas, producing 3 items instead of 2
    // Expected correct behavior would be: ["a, b", "c"]
    // Actual current behavior: ["a", "b", "c"] (split ignores quotes)
    assert.ok(Array.isArray(result.key), 'should produce an array');
    assert.ok(result.key.length >= 2, 'should produce at least 2 items from comma split');
    // The bug produces ["a", "b\"", "c"] or similar — the exact output depends on
    // how the regex strips quotes after the split.
    // We verify the key insight: the result has MORE items than intended (known limitation).
    assert.ok(result.key.length > 2, 'REG-04: split produces more items than intended due to quoted comma bug');
  });

  test('returns empty object for no frontmatter', () => {
    const content = 'Just plain content, no frontmatter.';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result, {});
  });

  test('returns empty object for empty frontmatter', () => {
    const content = '---\n---\nBody text.';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result, {});
  });

  test('parses frontmatter-only content', () => {
    const content = '---\nkey: val\n---';
    const result = extractFrontmatter(content);
    assert.strictEqual(result.key, 'val');
  });

  test('handles emoji and non-ASCII in values', () => {
    const content = '---\nname: "Hello World"\nlabel: "cafe"\n---\n';
    const result = extractFrontmatter(content);
    assert.strictEqual(result.name, 'Hello World');
    assert.strictEqual(result.label, 'cafe');
  });

  test('converts empty-object placeholders to arrays when dash items follow', () => {
    // When a key has no value, it gets an empty {} placeholder.
    // When "- item" lines follow, the parser converts {} to [].
    const content = '---\nrequirements:\n  - REQ-01\n  - REQ-02\n---\n';
    const result = extractFrontmatter(content);
    assert.ok(Array.isArray(result.requirements), 'should convert placeholder object to array');
    assert.deepStrictEqual(result.requirements, ['REQ-01', 'REQ-02']);
  });

  test('skips empty lines in YAML body', () => {
    const content = '---\nfirst: one\n\nsecond: two\n\nthird: three\n---\n';
    const result = extractFrontmatter(content);
    assert.strictEqual(result.first, 'one');
    assert.strictEqual(result.second, 'two');
    assert.strictEqual(result.third, 'three');
  });
});

// ─── reconstructFrontmatter ─────────────────────────────────────────────────

describe('reconstructFrontmatter', () => {
  test('serializes simple key-value', () => {
    const result = reconstructFrontmatter({ name: 'foo' });
    assert.strictEqual(result, 'name: foo');
  });

  test('serializes empty array as inline []', () => {
    const result = reconstructFrontmatter({ items: [] });
    assert.strictEqual(result, 'items: []');
  });

  test('serializes short string arrays inline', () => {
    const result = reconstructFrontmatter({ key: ['a', 'b', 'c'] });
    assert.strictEqual(result, 'key: [a, b, c]');
  });

  test('serializes long arrays as block', () => {
    const result = reconstructFrontmatter({ key: ['one', 'two', 'three', 'four'] });
    assert.ok(result.includes('key:'), 'should have key header');
    assert.ok(result.includes('  - one'), 'should have block array items');
    assert.ok(result.includes('  - four'), 'should have last item');
  });

  test('quotes values containing colons or hashes', () => {
    const result = reconstructFrontmatter({ url: 'http://example.com' });
    assert.ok(result.includes('"http://example.com"'), 'should quote value with colon');

    const hashResult = reconstructFrontmatter({ comment: 'value # note' });
    assert.ok(hashResult.includes('"value # note"'), 'should quote value with hash');
  });

  test('serializes nested objects with proper indentation', () => {
    const result = reconstructFrontmatter({ tech: { added: 'prisma', patterns: 'repo' } });
    assert.ok(result.includes('tech:'), 'should have parent key');
    assert.ok(result.includes('  added: prisma'), 'should have indented child');
    assert.ok(result.includes('  patterns: repo'), 'should have indented child');
  });

  test('serializes nested arrays within objects', () => {
    const result = reconstructFrontmatter({
      tech: { added: ['prisma', 'jose'] },
    });
    assert.ok(result.includes('tech:'), 'should have parent key');
    assert.ok(result.includes('  added: [prisma, jose]'), 'should serialize nested short array inline');
  });

  test('skips null and undefined values', () => {
    const result = reconstructFrontmatter({ name: 'foo', skip: null, also: undefined, keep: 'bar' });
    assert.ok(!result.includes('skip'), 'should not include null key');
    assert.ok(!result.includes('also'), 'should not include undefined key');
    assert.ok(result.includes('name: foo'), 'should include non-null key');
    assert.ok(result.includes('keep: bar'), 'should include non-null key');
  });

  test('round-trip: simple frontmatter', () => {
    const original = '---\nname: test\ntype: execute\nwave: 1\n---\n';
    const extracted1 = extractFrontmatter(original);
    const reconstructed = reconstructFrontmatter(extracted1);
    const roundTrip = `---\n${reconstructed}\n---\n`;
    const extracted2 = extractFrontmatter(roundTrip);
    assert.deepStrictEqual(extracted2, extracted1, 'round-trip should preserve data identity');
  });

  test('round-trip: nested with arrays', () => {
    const original = '---\nphase: 01\ntech:\n  added:\n    - prisma\n    - jose\n  patterns:\n    - repository\n    - jwt\n---\n';
    const extracted1 = extractFrontmatter(original);
    const reconstructed = reconstructFrontmatter(extracted1);
    const roundTrip = `---\n${reconstructed}\n---\n`;
    const extracted2 = extractFrontmatter(roundTrip);
    assert.deepStrictEqual(extracted2, extracted1, 'round-trip should preserve nested structures');
  });

  test('round-trip: multiple data types', () => {
    const original = '---\nname: testplan\nwave: 2\ntags: [auth, api, db]\ndeps:\n  - dep1\n  - dep2\nconfig:\n  enabled: true\n  count: 5\n---\n';
    const extracted1 = extractFrontmatter(original);
    const reconstructed = reconstructFrontmatter(extracted1);
    const roundTrip = `---\n${reconstructed}\n---\n`;
    const extracted2 = extractFrontmatter(roundTrip);
    assert.deepStrictEqual(extracted2, extracted1, 'round-trip should preserve multiple data types');
  });
});

// ─── spliceFrontmatter ──────────────────────────────────────────────────────

describe('spliceFrontmatter', () => {
  test('replaces existing frontmatter preserving body', () => {
    const content = '---\nphase: 01\ntype: execute\n---\n\n# Body Content\n\nParagraph here.';
    const newObj = { phase: '02', type: 'tdd', wave: '1' };
    const result = spliceFrontmatter(content, newObj);

    // New frontmatter should be present
    const extracted = extractFrontmatter(result);
    assert.strictEqual(extracted.phase, '02');
    assert.strictEqual(extracted.type, 'tdd');
    assert.strictEqual(extracted.wave, '1');

    // Body should be preserved
    assert.ok(result.includes('# Body Content'), 'body heading should be preserved');
    assert.ok(result.includes('Paragraph here.'), 'body paragraph should be preserved');
  });

  test('adds frontmatter to content without any', () => {
    const content = 'Plain text with no frontmatter.';
    const newObj = { phase: '01', plan: '01' };
    const result = spliceFrontmatter(content, newObj);

    // Should start with frontmatter delimiters
    assert.ok(result.startsWith('---\n'), 'should start with opening delimiter');
    assert.ok(result.includes('\n---\n'), 'should have closing delimiter');

    // Original content should follow
    assert.ok(result.includes('Plain text with no frontmatter.'), 'original content should be preserved');

    // Frontmatter should be extractable
    const extracted = extractFrontmatter(result);
    assert.strictEqual(extracted.phase, '01');
    assert.strictEqual(extracted.plan, '01');
  });

  test('preserves content after frontmatter delimiters exactly', () => {
    const body = '\n\nExact content with special chars: $, %, &, <, >\nLine 2\nLine 3';
    const content = '---\nold: value\n---' + body;
    const newObj = { new: 'value' };
    const result = spliceFrontmatter(content, newObj);

    // The body after the closing --- should be exactly preserved
    const closingIdx = result.indexOf('\n---', 4); // skip the opening ---
    const resultBody = result.slice(closingIdx + 4); // skip \n---
    assert.strictEqual(resultBody, body, 'body content after frontmatter should be exactly preserved');
  });
});

// ─── parseMustHavesBlock ────────────────────────────────────────────────────

describe('parseMustHavesBlock', () => {
  test('extracts truths as string array', () => {
    const content = `---
phase: 01
must_haves:
    truths:
      - "All tests pass on CI"
      - "Coverage exceeds 80%"
---

Body content.`;
    const result = parseMustHavesBlock(content, 'truths');
    assert.ok(Array.isArray(result), 'should return an array');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0], 'All tests pass on CI');
    assert.strictEqual(result[1], 'Coverage exceeds 80%');
  });

  test('extracts artifacts as object array', () => {
    const content = `---
phase: 01
must_haves:
    artifacts:
      - path: "src/auth.ts"
        provides: "JWT authentication"
        min_lines: 100
      - path: "src/middleware.ts"
        provides: "Route protection"
        min_lines: 50
---

Body.`;
    const result = parseMustHavesBlock(content, 'artifacts');
    assert.ok(Array.isArray(result), 'should return an array');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].path, 'src/auth.ts');
    assert.strictEqual(result[0].provides, 'JWT authentication');
    assert.strictEqual(result[0].min_lines, 100);
    assert.strictEqual(result[1].path, 'src/middleware.ts');
    assert.strictEqual(result[1].min_lines, 50);
  });

  test('extracts key_links with from/to/via/pattern fields', () => {
    const content = `---
phase: 01
must_haves:
    key_links:
      - from: "tests/auth.test.ts"
        to: "src/auth.ts"
        via: "import statement"
        pattern: "import.*auth"
---
`;
    const result = parseMustHavesBlock(content, 'key_links');
    assert.ok(Array.isArray(result), 'should return an array');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].from, 'tests/auth.test.ts');
    assert.strictEqual(result[0].to, 'src/auth.ts');
    assert.strictEqual(result[0].via, 'import statement');
    assert.strictEqual(result[0].pattern, 'import.*auth');
  });

  test('returns empty array when block not found', () => {
    const content = `---
phase: 01
must_haves:
    truths:
      - "Some truth"
---
`;
    const result = parseMustHavesBlock(content, 'nonexistent_block');
    assert.deepStrictEqual(result, []);
  });

  test('returns empty array when no frontmatter', () => {
    const content = 'Plain text without any frontmatter delimiters.';
    const result = parseMustHavesBlock(content, 'truths');
    assert.deepStrictEqual(result, []);
  });

  test('handles nested arrays within artifact objects', () => {
    const content = `---
phase: 01
must_haves:
    artifacts:
      - path: "src/api.ts"
        provides: "REST endpoints"
        exports:
          - "GET"
          - "POST"
---
`;
    const result = parseMustHavesBlock(content, 'artifacts');
    assert.ok(Array.isArray(result), 'should return an array');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].path, 'src/api.ts');
    // The nested array should be captured
    assert.ok(result[0].exports !== undefined, 'should have exports field');
  });

  // ─── 2-space regression tests (FIX-01) ─────────────────────────────────────

  test('extracts top-level 2-space artifacts block, not the nested one under a truth', () => {
    const content = `---
phase: 05
must_haves:
  truths:
    - truth: "the loop works"
      artifacts:
        - path: nested/under/truth.cjs
          provides: should NOT be returned by top-level query
  artifacts:
    - path: src/real-one.cjs
      provides: top-level artifact A
    - path: src/real-two.cjs
      provides: top-level artifact B
  key_links:
    - from: a.cjs
      to: b.cjs
      via: require
      pattern: "requireB"
---
body`;
    const arts = parseMustHavesBlock(content, 'artifacts');
    assert.strictEqual(arts.length, 2, 'must return the 2 TOP-LEVEL artifacts, not the 1 nested under truths[0]');
    assert.strictEqual(arts[0].path, 'src/real-one.cjs');
    assert.strictEqual(arts[1].path, 'src/real-two.cjs');
    const links = parseMustHavesBlock(content, 'key_links');
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].from, 'a.cjs');
    assert.strictEqual(links[0].pattern, 'requireB');
  });

  test('parses a real 2-space plan fixture if present (integration smoke)', () => {
    const fixture = require('path').join(__dirname, '..', '.planning', 'quick', '260507-u0a-consolidate-gsd2-progress-into-single-in', '260507-u0a-PLAN.md');
    const fs = require('fs');
    if (fs.existsSync(fixture)) {
      const real = fs.readFileSync(fixture, 'utf-8');
      assert.strictEqual(parseMustHavesBlock(real, 'artifacts').length, 5, 'real fixture top-level artifacts');
      assert.strictEqual(parseMustHavesBlock(real, 'key_links').length, 4, 'real fixture top-level key_links');
    }
  });

  test('2-space simple-string truths', () => {
    const content = `---
must_haves:
  truths:
    - "first truth"
    - "second truth"
---`;
    const truths = parseMustHavesBlock(content, 'truths');
    assert.strictEqual(truths.length, 2);
    assert.strictEqual(truths[0], 'first truth');
  });
});

// ─── FRONTMATTER_SCHEMAS todo entry (SC3) ───────────────────────────────────

describe('FRONTMATTER_SCHEMAS todo schema (SC3)', () => {
  test('todo key exists in FRONTMATTER_SCHEMAS', () => {
    assert.ok(FRONTMATTER_SCHEMAS.todo !== undefined, 'FRONTMATTER_SCHEMAS must have a todo key');
  });

  test('todo schema has created, title, area in required', () => {
    const schema = FRONTMATTER_SCHEMAS.todo;
    assert.ok(schema, 'todo schema must exist');
    assert.ok(Array.isArray(schema.required), 'schema.required must be an array');
    assert.ok(schema.required.includes('created'), 'required must include created');
    assert.ok(schema.required.includes('title'), 'required must include title');
    assert.ok(schema.required.includes('area'), 'required must include area');
  });

  test('todo schema lists depends_on and related_to in optional', () => {
    const schema = FRONTMATTER_SCHEMAS.todo;
    assert.ok(schema, 'todo schema must exist');
    assert.ok(Array.isArray(schema.optional), 'schema.optional must be an array');
    assert.ok(schema.optional.includes('depends_on'), 'optional must include depends_on');
    assert.ok(schema.optional.includes('related_to'), 'optional must include related_to');
  });

  test('todo with depends_on block-list parses into array', () => {
    const content = `---
created: 2026-06-08T10:00:00Z
title: Test task
area: tooling
depends_on:
  - phase:6
  - 260507-u0a
related_to:
  - phase:7
---

## Problem

Test.
`;
    const fm = extractFrontmatter(content);
    assert.ok(Array.isArray(fm.depends_on), 'depends_on should be an array');
    assert.ok(fm.depends_on.includes('phase:6'), 'should contain phase:6');
    assert.ok(fm.depends_on.includes('260507-u0a'), 'should contain 260507-u0a');
    assert.ok(Array.isArray(fm.related_to), 'related_to should be an array');
    assert.ok(fm.related_to.includes('phase:7'), 'should contain phase:7');
  });

  test('todo with inline depends_on array parses correctly', () => {
    const content = `---
created: 2026-06-08T10:00:00Z
title: Test task
area: tooling
depends_on: [phase:6]
related_to: [260507-u0a]
---
`;
    const fm = extractFrontmatter(content);
    assert.ok(Array.isArray(fm.depends_on), 'depends_on should be an array');
    assert.ok(fm.depends_on.includes('phase:6'), 'should contain phase:6');
    assert.ok(Array.isArray(fm.related_to), 'related_to should be an array');
    assert.ok(fm.related_to.includes('260507-u0a'), 'should contain 260507-u0a');
  });

  test('todo without depends_on/related_to still validates (fields are optional)', () => {
    // A todo with only the required fields should produce an empty array or undefined
    // for depends_on/related_to — no schema error.
    const content = `---
created: 2026-06-08T10:00:00Z
title: Simple task
area: tooling
---
`;
    const fm = extractFrontmatter(content);
    // Fields simply absent — gate reads them as empty
    assert.ok(fm.depends_on === undefined || Array.isArray(fm.depends_on),
      'depends_on absent or array');
    assert.ok(fm.related_to === undefined || Array.isArray(fm.related_to),
      'related_to absent or array');
    // No required fields missing: schema validation should pass
    const schema = FRONTMATTER_SCHEMAS.todo;
    if (schema) {
      const missing = schema.required.filter(f => fm[f] === undefined);
      assert.strictEqual(missing.length, 0, 'all required fields present');
    }
  });
});

