/**
 * agent-spec-init — Tests for AGENT-SPEC.md discovery in init.cjs
 *
 * Verifies that `init plan-phase` and `init execute-phase` correctly:
 *   - Set has_agent_spec: true and agent_spec_path when *-AGENT-SPEC.md exists
 *   - Set has_agent_spec: false when no AGENT-SPEC.md present
 *   - Return agent_spec_path with posix separators
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function setupPhase(tmpDir, opts = {}) {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test-phase');
  fs.mkdirSync(phaseDir, { recursive: true });

  fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context\nTest context\n');

  if (opts.agentSpec) {
    fs.writeFileSync(
      path.join(phaseDir, '01-AGENT-SPEC.md'),
      '---\nstatus: draft\n---\n# Agent Spec\n'
    );
  }

  return phaseDir;
}

describe('AGENT-SPEC discovery in init plan-phase', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns has_agent_spec: true when AGENT-SPEC.md present', () => {
    setupPhase(tmpDir, { agentSpec: true });
    const result = runGsdTools('init plan-phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_agent_spec, true);
    assert.ok(
      output.agent_spec_path && output.agent_spec_path.includes('AGENT-SPEC.md'),
      `agent_spec_path should contain "AGENT-SPEC.md", got: ${output.agent_spec_path}`
    );
  });

  test('returns has_agent_spec: false when no AGENT-SPEC.md', () => {
    setupPhase(tmpDir, { agentSpec: false });
    const result = runGsdTools('init plan-phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_agent_spec, false);
    assert.strictEqual(output.agent_spec_path, undefined);
  });

  test('agent_spec_path uses posix separators', () => {
    setupPhase(tmpDir, { agentSpec: true });
    const result = runGsdTools('init plan-phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.agent_spec_path, 'agent_spec_path must be set');
    assert.ok(
      !output.agent_spec_path.includes('\\'),
      `agent_spec_path should not contain backslashes, got: ${output.agent_spec_path}`
    );
    assert.ok(
      output.agent_spec_path.includes('/'),
      `agent_spec_path should contain forward slashes, got: ${output.agent_spec_path}`
    );
  });
});

describe('AGENT-SPEC discovery in init execute-phase', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('execute-phase also discovers AGENT-SPEC.md', () => {
    setupPhase(tmpDir, { agentSpec: true });
    const result = runGsdTools('init execute-phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_agent_spec, true);
    assert.ok(
      output.agent_spec_path && output.agent_spec_path.includes('AGENT-SPEC.md'),
      `agent_spec_path should contain "AGENT-SPEC.md", got: ${output.agent_spec_path}`
    );
  });

  test('execute-phase returns has_agent_spec: false when missing', () => {
    setupPhase(tmpDir, { agentSpec: false });
    const result = runGsdTools('init execute-phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_agent_spec, false);
    assert.strictEqual(output.agent_spec_path, undefined);
  });
});
