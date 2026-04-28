/**
 * Cursor conversion regression tests.
 *
 * Ensures Cursor frontmatter names are emitted as plain identifiers
 * (without surrounding quotes), so Cursor does not treat quotes as
 * literal parts of skill/subagent names.
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert');

const {
  convertClaudeCommandToCursorSkill,
  convertClaudeAgentToCursorAgent,
} = require('../bin/install.js');

describe('convertClaudeCommandToCursorSkill', () => {
  test('writes unquoted Cursor skill name in frontmatter', () => {
    const input = `---
name: fix
description: Fix issues after phase execution
---

<objective>
Test body
</objective>
`;

    const result = convertClaudeCommandToCursorSkill(input, 'gsd2-fix');
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'gsd2-fix', 'skill name is plain scalar');
    assert.ok(!result.includes('name: "gsd2-fix"'), 'quoted skill name is not emitted');
  });

  test('preserves slash for slash commands in markdown body', () => {
    const input = `---
name: gsd:plan-phase
description: Plan a phase
---

Next:
/gsd2:execute-phase 17
/gsd2:help
gsd2:progress
`;

    const result = convertClaudeCommandToCursorSkill(input, 'gsd2-plan-phase');

    assert.ok(result.includes('/gsd2-execute-phase 17'), 'slash command remains slash-prefixed');
    assert.ok(result.includes('/gsd2-help'), 'existing slash command is preserved');
    assert.ok(result.includes('gsd2-progress'), 'non-slash gsd: references still normalize');
    assert.ok(!result.includes('gsd2:'), 'colon command form is fully converted');
  });
});

describe('convertClaudeAgentToCursorAgent', () => {
  test('writes unquoted Cursor agent name in frontmatter', () => {
    const input = `---
name: gsd-planner
description: Planner agent
tools: Read, Write
color: green
---

<role>
Planner body
</role>
`;

    const result = convertClaudeAgentToCursorAgent(input);
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'gsd-planner', 'agent name is plain scalar');
    assert.ok(!result.includes('name: "gsd-planner"'), 'quoted agent name is not emitted');
  });
});
