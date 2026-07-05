/**
 * GSD Tools Tests - Validate Health Command
 *
 * Comprehensive tests for validate-health covering all 8 health checks
 * and the repair path.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Helpers for setting up minimal valid projects ────────────────────────────

function writeMinimalRoadmap(tmpDir, phases = ['1']) {
  const lines = phases.map(n => `### Phase ${n}: Phase ${n} Description`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n${lines}\n`
  );
}

function writeMinimalProjectMd(tmpDir, sections = ['## What This Is', '## Core Value', '## Requirements']) {
  const content = sections.map(s => `${s}\n\nContent here.\n`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    `# Project\n\n${content}`
  );
}

function writeMinimalStateMd(tmpDir, content) {
  const defaultContent = content || `# Session State\n\n## Current Position\n\nPhase: 1\n`;
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    defaultContent
  );
}

function writeValidConfigJson(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ model_profile: 'balanced', commit_docs: true }, null, 2)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// validate health command — all 8 checks
// ─────────────────────────────────────────────────────────────────────────────

describe('validate health command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ─── Check 1: .planning/ exists ───────────────────────────────────────────

  test("returns 'broken' when .planning directory is missing", () => {
    // createTempProject creates .planning/phases — remove it entirely
    fs.rmSync(path.join(tmpDir, '.planning'), { recursive: true, force: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'broken', 'should be broken');
    assert.ok(
      output.errors.some(e => e.code === 'E001'),
      `Expected E001 in errors: ${JSON.stringify(output.errors)}`
    );
  });

  // ─── Check 2: PROJECT.md exists and has required sections ─────────────────

  test('warns when PROJECT.md is missing', () => {
    // No PROJECT.md in .planning
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    // Create valid phase dir so no W007
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.code === 'E002'),
      `Expected E002 in errors: ${JSON.stringify(output.errors)}`
    );
  });

  test('warns when PROJECT.md missing required sections', () => {
    // PROJECT.md missing "## Core Value" section
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\n## What This Is\n\nFoo\n\n## Requirements\n\nBar\n'
    );
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const w001s = output.warnings.filter(w => w.code === 'W001');
    assert.ok(w001s.length > 0, `Expected W001 warnings: ${JSON.stringify(output.warnings)}`);
    assert.ok(
      w001s.some(w => w.message.includes('## Core Value')),
      `Expected W001 mentioning "## Core Value": ${JSON.stringify(w001s)}`
    );
  });

  test('passes when PROJECT.md has all required sections', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.errors.some(e => e.code === 'E002'),
      `Should not have E002: ${JSON.stringify(output.errors)}`
    );
    assert.ok(
      !output.warnings.some(w => w.code === 'W001'),
      `Should not have W001: ${JSON.stringify(output.warnings)}`
    );
  });

  // ─── Check 3: ROADMAP.md exists ───────────────────────────────────────────

  test('errors when ROADMAP.md is missing', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    // No ROADMAP.md

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.code === 'E003'),
      `Expected E003 in errors: ${JSON.stringify(output.errors)}`
    );
  });

  // ─── Check 4: STATE.md exists and references valid phases ─────────────────

  test('errors when STATE.md is missing with repairable true', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    // No STATE.md

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const e004 = output.errors.find(e => e.code === 'E004');
    assert.ok(e004, `Expected E004 in errors: ${JSON.stringify(output.errors)}`);
    assert.strictEqual(e004.repairable, true, 'E004 should be repairable');
  });

  test('warns when STATE.md references nonexistent phase', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeValidConfigJson(tmpDir);
    // STATE.md mentions Phase 99 but only 01-a dir exists
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Session State\n\nPhase 99 is the current phase.\n'
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const w002 = output.warnings.find(w => w.code === 'W002');
    assert.ok(w002, `Expected W002 in warnings: ${JSON.stringify(output.warnings)}`);
    assert.strictEqual(w002.repairable, false, 'W002 should not be auto-repairable');
  });

  // ─── Check 5: config.json valid JSON + valid schema ───────────────────────

  test('warns when config.json is missing with repairable true', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    // No config.json

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const w003 = output.warnings.find(w => w.code === 'W003');
    assert.ok(w003, `Expected W003 in warnings: ${JSON.stringify(output.warnings)}`);
    assert.strictEqual(w003.repairable, true, 'W003 should be repairable');
  });

  test('errors when config.json has invalid JSON', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      '{broken json'
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.code === 'E005'),
      `Expected E005 in errors: ${JSON.stringify(output.errors)}`
    );
  });

  test('warns when config.json has invalid model_profile', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'invalid' })
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W004'),
      `Expected W004 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('accepts inherit model_profile as valid', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        model_profile: 'inherit',
        workflow: {
          research: true,
          plan_check: true,
          verifier: true,
          nyquist_validation: true,
        },
      })
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W004'),
      `Should not warn for inherit model_profile: ${JSON.stringify(output.warnings)}`
    );
  });

  // ─── Check 6: Phase directory naming (NN-name format) ─────────────────────

  test('warns about incorrectly named phase directories', () => {
    writeMinimalProjectMd(tmpDir);
    // Roadmap with no phases to avoid W006
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\nNo phases yet.\n'
    );
    writeMinimalStateMd(tmpDir, '# Session State\n\nNo phase references.\n');
    writeValidConfigJson(tmpDir);
    // Create a badly named dir
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', 'bad_name'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W005'),
      `Expected W005 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  // ─── Check 7: Orphaned plans (PLAN without SUMMARY) ───────────────────────

  test('reports orphaned plans (PLAN without SUMMARY) as info', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    // Create 01-test phase dir with a PLAN but no matching SUMMARY
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    // No 01-01-SUMMARY.md

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.info.some(i => i.code === 'I001'),
      `Expected I001 in info: ${JSON.stringify(output.info)}`
    );
  });

  // ─── Check 8: Consistency (roadmap/disk sync) ─────────────────────────────

  test('warns about phase in ROADMAP but not on disk', () => {
    writeMinimalProjectMd(tmpDir);
    // ROADMAP mentions Phase 5 but no 05-xxx dir
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 5: Future Phase\n'
    );
    writeMinimalStateMd(tmpDir, '# Session State\n\nNo phase refs.\n');
    writeValidConfigJson(tmpDir);
    // No phase dirs

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W006'),
      `Expected W006 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('warns about phase on disk but not in ROADMAP', () => {
    writeMinimalProjectMd(tmpDir);
    // ROADMAP has no phases
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\nNo phases listed.\n'
    );
    writeMinimalStateMd(tmpDir, '# Session State\n\nNo phase refs.\n');
    writeValidConfigJson(tmpDir);
    // Orphan phase dir not in ROADMAP
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '99-orphan'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W007'),
      `Expected W007 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  // ─── Check 5b: Nyquist validation key presence (W008) ─────────────────────

  test('detects W008 when workflow.nyquist_validation absent from config', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    // Config with workflow section but WITHOUT nyquist_validation key
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced', workflow: { research: true } }, null, 2)
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W008'),
      `Expected W008 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('does not emit W008 when nyquist_validation is explicitly set', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    // Config with workflow.nyquist_validation explicitly set
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced', workflow: { research: true, nyquist_validation: true } }, null, 2)
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W008'),
      `Should not have W008: ${JSON.stringify(output.warnings)}`
    );
  });

  // ─── Check 7b: Nyquist VALIDATION.md consistency (W009) ──────────────────

  test('detects W009 when RESEARCH.md has Validation Architecture but no VALIDATION.md', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    // Create phase dir with RESEARCH.md containing Validation Architecture
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(phaseDir, '01-RESEARCH.md'),
      '# Research\n\n## Validation Architecture\n\nSome validation content.\n'
    );
    // No VALIDATION.md

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W009'),
      `Expected W009 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('does not emit W009 when VALIDATION.md exists alongside RESEARCH.md', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    // Create phase dir with both RESEARCH.md and VALIDATION.md
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(phaseDir, '01-RESEARCH.md'),
      '# Research\n\n## Validation Architecture\n\nSome validation content.\n'
    );
    fs.writeFileSync(
      path.join(phaseDir, '01-VALIDATION.md'),
      '# Validation\n\nValidation content.\n'
    );

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W009'),
      `Should not have W009: ${JSON.stringify(output.warnings)}`
    );
  });

  // ─── Check 4b: STATE.md milestone drift (W010) ───────────────────────────

  test('detects W010 when STATE.md milestone has no phases dir but a real one exists', () => {
    writeMinimalProjectMd(tmpDir);
    // ROADMAP marks v0.1.2 as the active milestone
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## v0.1.2: Tech Debt\n\n### Phase 1: Foo\n');
    // STATE.md frontmatter still points at stale v1.0
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v1.0\nmilestone_name: old\nstatus: executing\n---\n\n# Session State\n\nPhase 1.\n');
    writeValidConfigJson(tmpDir);
    // Real milestone dir exists on disk
    fs.mkdirSync(path.join(tmpDir, '.planning', 'v0.1.2', 'phases', '01-foo'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const w010 = output.warnings.find(w => w.code === 'W010');
    assert.ok(w010, `Expected W010 in warnings: ${JSON.stringify(output.warnings)}`);
    assert.strictEqual(w010.repairable, true, 'W010 should be repairable');
  });

  test('does not emit W010 when STATE.md milestone dir exists', () => {
    writeMinimalProjectMd(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## v0.1.2: Tech Debt\n\n### Phase 1: Foo\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v0.1.2\nmilestone_name: Tech Debt\nstatus: executing\n---\n\n# Session State\n\nPhase 1.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'v0.1.2', 'phases', '01-foo'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W010'),
      `Should not have W010: ${JSON.stringify(output.warnings)}`
    );
  });

  test('--repair rewrites stale STATE.md milestone frontmatter (W010)', () => {
    writeMinimalProjectMd(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## v0.1.2: Tech Debt\n\n### Phase 1: Foo\n');
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath,
      '---\nmilestone: v1.0\nmilestone_name: old\nstatus: executing\n---\n\n# Session State\n\nPhase 1.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'v0.1.2', 'phases', '01-foo'), { recursive: true });

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const rewritten = fs.readFileSync(statePath, 'utf-8');
    assert.match(rewritten, /^milestone: v0\.1\.2$/m, `STATE.md milestone not rewritten: ${rewritten}`);
    assert.match(rewritten, /^milestone_name: Tech Debt$/m, 'milestone_name not rewritten');
  });

  // ─── Overall status ────────────────────────────────────────────────────────

  test("returns 'healthy' when all checks pass", () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    // Create valid phase dir matching ROADMAP
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-a');
    fs.mkdirSync(phaseDir, { recursive: true });
    // Add PLAN+SUMMARY so no I001
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'healthy', `Expected healthy, got ${output.status}. Errors: ${JSON.stringify(output.errors)}, Warnings: ${JSON.stringify(output.warnings)}`);
    assert.deepStrictEqual(output.errors, [], 'should have no errors');
    assert.deepStrictEqual(output.warnings, [], 'should have no warnings');
  });

  test("returns 'degraded' when only warnings exist", () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    // No config.json → W003 (warning, not error)
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'degraded', `Expected degraded, got ${output.status}`);
    assert.strictEqual(output.errors.length, 0, 'should have no errors');
    assert.ok(output.warnings.length > 0, 'should have warnings');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate health — graph integrity (Check 10)
// ─────────────────────────────────────────────────────────────────────────────

describe('validate health — graph integrity (Check 10)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function writePlan(phaseDirName, phaseNum, planNum, { dependsOn = [], filesModified = [] } = {}) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDirName);
    fs.mkdirSync(dir, { recursive: true });
    const depsYaml = dependsOn.length > 0
      ? 'depends_on:\n' + dependsOn.map(d => `  - "${d}"`).join('\n')
      : 'depends_on: []';
    const filesYaml = filesModified.length > 0
      ? 'files_modified:\n' + filesModified.map(f => `  - ${f}`).join('\n')
      : 'files_modified: []';
    fs.writeFileSync(path.join(dir, `${phaseNum}-${planNum}-PLAN.md`), `---
phase: ${phaseDirName}
plan: "${planNum}"
type: auto
wave: 1
${depsYaml}
${filesYaml}
autonomous: true
---

<objective>Test plan</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
</task>
</tasks>
`);
  }

  function writeSummary(phaseDirName, phaseNum, planNum, { affects = null } = {}) {
    const dir = path.join(tmpDir, '.planning', 'phases', phaseDirName);
    fs.mkdirSync(dir, { recursive: true });
    const affectsYaml = affects
      ? `affects:\n${affects.map(a => `  - "${a}"`).join('\n')}\n`
      : '';
    fs.writeFileSync(path.join(dir, `${phaseNum}-${planNum}-SUMMARY.md`), `---
phase: ${phaseDirName}
plan: "${planNum}"
subsystem: infra
tags: []
${affectsYaml}duration: 5min
completed: 2026-07-05
---

# Summary
`);
  }

  test('dependency cycle registers as E-GRAPH-CYCLE error, status broken', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 3: Foo
**Goal:** g
**Depends on:** Phase 4

### Phase 4: Bar
**Goal:** g
**Depends on:** Phase 3
`);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-foo'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '04-bar'), { recursive: true });

    const result = runGsdTools('validate health --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'broken', `Expected broken, got ${output.status}. Errors: ${JSON.stringify(output.errors)}`);
    const cycleError = output.errors.find(e => e.code === 'E-GRAPH-CYCLE');
    assert.ok(cycleError, `Expected E-GRAPH-CYCLE in errors: ${JSON.stringify(output.errors)}`);
    assert.ok(cycleError.message.includes('phase:3'), `Expected message to include phase:3: ${cycleError.message}`);
    assert.ok(cycleError.message.includes('phase:4'), `Expected message to include phase:4: ${cycleError.message}`);
  });

  test('dangling structural depends_on registers as E-GRAPH-DANGLING error, status broken', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    writePlan('01-a', '01', '01', { dependsOn: ['99-01'] });

    const result = runGsdTools('validate health --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'broken', `Expected broken, got ${output.status}. Errors: ${JSON.stringify(output.errors)}`);
    const danglingError = output.errors.find(e => e.code === 'E-GRAPH-DANGLING');
    assert.ok(danglingError, `Expected E-GRAPH-DANGLING in errors: ${JSON.stringify(output.errors)}`);
  });

  test('dangling advisory affects ref registers as I-GRAPH-DANGLING info, status stays healthy', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    writePlan('01-a', '01', '01', {});
    writeSummary('01-a', '01', '01', { affects: ['Phase 42'] });

    const result = runGsdTools('validate health --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const danglingInfo = output.info.find(i => i.code === 'I-GRAPH-DANGLING');
    assert.ok(danglingInfo, `Expected I-GRAPH-DANGLING in info: ${JSON.stringify(output.info)}`);
    assert.strictEqual(output.status, 'healthy', `Expected healthy (info must not flip status), got ${output.status}. Errors: ${JSON.stringify(output.errors)}, Warnings: ${JSON.stringify(output.warnings)}`);
  });

  test('files_modified overlap with no affects edge registers as I-GRAPH-CONTRADICTION info, status stays healthy', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    writePlan('01-a', '01', '01', { filesModified: ['shared.cjs'] });
    writePlan('01-a', '01', '02', { filesModified: ['shared.cjs'] });

    const result = runGsdTools('validate health --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const contradictionInfo = output.info.find(i => i.code === 'I-GRAPH-CONTRADICTION');
    assert.ok(contradictionInfo, `Expected I-GRAPH-CONTRADICTION in info: ${JSON.stringify(output.info)}`);
    assert.strictEqual(output.status, 'healthy', `Expected healthy (info must not flip status), got ${output.status}. Errors: ${JSON.stringify(output.errors)}, Warnings: ${JSON.stringify(output.warnings)}`);
  });

  test('graph findings are never repaired by --repair', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 3: Foo
**Goal:** g
**Depends on:** Phase 4

### Phase 4: Bar
**Goal:** g
**Depends on:** Phase 3
`);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-foo'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '04-bar'), { recursive: true });

    const result = runGsdTools('validate health --repair --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const cycleError = output.errors.find(e => e.code === 'E-GRAPH-CYCLE');
    assert.ok(cycleError, `Expected E-GRAPH-CYCLE in errors: ${JSON.stringify(output.errors)}`);
    assert.strictEqual(cycleError.repairable, false, 'E-GRAPH-CYCLE must not be repairable');
    if (Array.isArray(output.repairs_performed)) {
      assert.ok(
        !output.repairs_performed.some(r => /graph|cycle|dangling/i.test(r.action || '')),
        `--repair must not attempt any graph-related action: ${JSON.stringify(output.repairs_performed)}`
      );
    }
  });

  test('clean acyclic fixture with no dangling refs or contradictions stays healthy with zero graph findings', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-a');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');

    const result = runGsdTools('validate health --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'healthy', `Expected healthy, got ${output.status}. Errors: ${JSON.stringify(output.errors)}, Warnings: ${JSON.stringify(output.warnings)}`);
    const allIssues = [...output.errors, ...output.warnings, ...output.info];
    assert.ok(
      !allIssues.some(i => i.code && (i.code.startsWith('E-GRAPH') || i.code.startsWith('I-GRAPH'))),
      `Expected zero graph findings on clean fixture: ${JSON.stringify(allIssues.filter(i => i.code && i.code.includes('GRAPH')))}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate health --repair command
// ─────────────────────────────────────────────────────────────────────────────

describe('validate health --repair command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Set up base project with ROADMAP and PROJECT.md so repairs are triggered
    // (E001, E003 are not repairable so we always need .planning/ and ROADMAP.md)
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates config.json with defaults when missing', () => {
    // STATE.md present so no STATE repair; no config.json
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    // Ensure no config.json
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      Array.isArray(output.repairs_performed),
      `Expected repairs_performed array: ${JSON.stringify(output)}`
    );
    const createAction = output.repairs_performed.find(r => r.action === 'createConfig');
    assert.ok(createAction, `Expected createConfig action: ${JSON.stringify(output.repairs_performed)}`);
    assert.strictEqual(createAction.success, true, 'createConfig should succeed');

    // Verify config.json now exists on disk with valid JSON and balanced profile
    assert.ok(fs.existsSync(configPath), 'config.json should now exist on disk');
    const diskConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(diskConfig.model_profile, 'balanced', 'default model_profile should be balanced');
    // Verify nested workflow structure matches config.cjs canonical format
    assert.ok(diskConfig.workflow, 'config should have nested workflow object');
    assert.strictEqual(diskConfig.workflow.research, true, 'workflow.research should default to true');
    assert.strictEqual(diskConfig.workflow.plan_check, true, 'workflow.plan_check should default to true');
    assert.strictEqual(diskConfig.workflow.verifier, true, 'workflow.verifier should default to true');
    assert.strictEqual(diskConfig.workflow.nyquist_validation, true, 'workflow.nyquist_validation should default to true');
    // Verify branch templates are present
    assert.strictEqual(diskConfig.phase_branch_template, 'gsd/phase-{phase}-{slug}');
    assert.strictEqual(diskConfig.milestone_branch_template, 'gsd/{milestone}-{slug}');
  });

  test('resets config.json when JSON is invalid', () => {
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, '{broken json');

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      Array.isArray(output.repairs_performed),
      `Expected repairs_performed: ${JSON.stringify(output)}`
    );
    const resetAction = output.repairs_performed.find(r => r.action === 'resetConfig');
    assert.ok(resetAction, `Expected resetConfig action: ${JSON.stringify(output.repairs_performed)}`);

    // Verify config.json is now valid JSON with correct nested structure
    const diskConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.ok(typeof diskConfig === 'object', 'config.json should be valid JSON after repair');
    assert.ok(diskConfig.workflow, 'reset config should have nested workflow object');
    assert.strictEqual(diskConfig.workflow.research, true, 'workflow.research should be true after reset');
  });

  test('regenerates STATE.md when missing', () => {
    writeValidConfigJson(tmpDir);
    // No STATE.md
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      Array.isArray(output.repairs_performed),
      `Expected repairs_performed: ${JSON.stringify(output)}`
    );
    const regenerateAction = output.repairs_performed.find(r => r.action === 'regenerateState');
    assert.ok(regenerateAction, `Expected regenerateState action: ${JSON.stringify(output.repairs_performed)}`);
    assert.strictEqual(regenerateAction.success, true, 'regenerateState should succeed');

    // Verify STATE.md now exists and contains "# Session State"
    assert.ok(fs.existsSync(statePath), 'STATE.md should now exist on disk');
    const stateContent = fs.readFileSync(statePath, 'utf-8');
    assert.ok(stateContent.includes('# Session State'), 'regenerated STATE.md should contain "# Session State"');
  });

  test('does not rewrite existing STATE.md for invalid phase references', () => {
    writeValidConfigJson(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    const originalContent = '# Session State\n\nPhase 99 is current.\n';
    fs.writeFileSync(
      statePath,
      originalContent
    );

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !Array.isArray(output.repairs_performed) || !output.repairs_performed.some(r => r.action === 'regenerateState'),
      `Did not expect regenerateState for W002: ${JSON.stringify(output)}`
    );

    const stateContent = fs.readFileSync(statePath, 'utf-8');
    assert.strictEqual(stateContent, originalContent, 'existing STATE.md should be preserved');

    const planningDir = path.join(tmpDir, '.planning');
    const planningFiles = fs.readdirSync(planningDir);
    const backupFile = planningFiles.find(f => f.startsWith('STATE.md.bak-'));
    assert.strictEqual(backupFile, undefined, `Did not expect backup file for non-destructive repair. Found: ${planningFiles.join(', ')}`);
  });

  test('adds nyquist_validation key to config.json via addNyquistKey repair', () => {
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    // Config with workflow section but missing nyquist_validation
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ model_profile: 'balanced', workflow: { research: true } }, null, 2)
    );

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      Array.isArray(output.repairs_performed),
      `Expected repairs_performed array: ${JSON.stringify(output)}`
    );
    const addKeyAction = output.repairs_performed.find(r => r.action === 'addNyquistKey');
    assert.ok(addKeyAction, `Expected addNyquistKey action: ${JSON.stringify(output.repairs_performed)}`);
    assert.strictEqual(addKeyAction.success, true, 'addNyquistKey should succeed');

    // Read config.json and verify workflow.nyquist_validation is true
    const diskConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(diskConfig.workflow.nyquist_validation, true, 'nyquist_validation should be true');
  });

  test('reports repairable_count correctly', () => {
    // No config.json (W003, repairable=true) and no STATE.md (E004, repairable=true)
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    // Run WITHOUT --repair to just check repairable_count
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.repairable_count >= 2,
      `Expected repairable_count >= 2, got ${output.repairable_count}. Full output: ${JSON.stringify(output)}`
    );
  });

  test('phase mismatch warnings do not count as repairable issues', () => {
    writeValidConfigJson(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Session State\n\nPhase 99 is the current phase.\n'
    );

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.repairable_count, 0, `Expected no repairable issues for W002: ${JSON.stringify(output)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Source↔runtime symmetry check (SC4)
// ─────────────────────────────────────────────────────────────────────────────

describe('source-runtime symmetry check', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // Helper: create identical source + runtime trees
  function writeIdenticalTrees(dir, files = {}) {
    const srcDir = path.join(dir, 'get-shit-done');
    const runtimeDir = path.join(dir, '.claude', 'get-shit-done');
    fs.mkdirSync(path.join(srcDir, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(runtimeDir, 'bin'), { recursive: true });
    for (const [relPath, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(srcDir, relPath), content);
      fs.writeFileSync(path.join(runtimeDir, relPath), content);
    }
    return { srcDir, runtimeDir };
  }

  // ─── No drift: identical trees + valid settings.json ──────────────────────

  test('no symmetry error when source and runtime trees are identical and settings.json is present with expected hooks', () => {
    writeIdenticalTrees(tmpDir, { 'bin/foo.cjs': 'module.exports = {};\n' });
    // Write a valid settings.json with all expected hook scripts present
    const settingsDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(settingsDir, { recursive: true });
    // Also create hook scripts referenced in settings
    const hooksDir = path.join(tmpDir, '.claude', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    const hookScripts = [
      'gsd2-check-update.js',
      'gsd2-context-monitor.js',
      'gsd2-read-injection-scanner.js',
      'gsd2-agent-trace.js',
      'gsd2-prompt-guard.js',
      'gsd2-read-guard.js',
      'gsd2-statusline.js',
    ];
    for (const h of hookScripts) {
      fs.writeFileSync(path.join(hooksDir, h), '// hook\n');
    }
    const settings = {
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-check-update.js` }] }],
        PostToolUse: [
          { hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-context-monitor.js` }] },
          { matcher: 'Read', hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-read-injection-scanner.js` }] },
          { matcher: 'Task|Agent', hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-agent-trace.js` }] },
        ],
        PreToolUse: [
          { matcher: 'Write|Edit', hooks: [
            { type: 'command', command: `node .claude/hooks/gsd2-prompt-guard.js` },
            { type: 'command', command: `node .claude/hooks/gsd2-read-guard.js` },
          ]},
        ],
        PostToolUseFailure: [
          { matcher: 'Task|Agent', hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-agent-trace.js` }] },
        ],
      },
      statusLine: { type: 'command', command: `node .claude/hooks/gsd2-statusline.js` },
    };
    fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify(settings, null, 2));

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.errors.some(e => e.code === 'E-DRIFT' || (e.message && e.message.includes('source-runtime'))),
      `Should not report drift: ${JSON.stringify(output.errors)}`
    );
    assert.ok(
      !output.errors.some(e => e.code === 'E-SETTINGS-DRIFT' || (e.message && e.message.includes('settings'))),
      `Should not report settings drift: ${JSON.stringify(output.errors)}`
    );
  });

  // ─── File-tree drift: missing runtime file ─────────────────────────────────

  test('reports E-DRIFT when a source file is missing from runtime', () => {
    const srcDir = path.join(tmpDir, 'get-shit-done', 'bin');
    const runtimeDir = path.join(tmpDir, '.claude', 'get-shit-done', 'bin');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });
    // Source has foo.cjs; runtime does not
    fs.writeFileSync(path.join(srcDir, 'foo.cjs'), 'module.exports = {};\n');

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.code === 'E-DRIFT' || (e.message && e.message.includes('source-runtime'))),
      `Expected E-DRIFT or source-runtime error: ${JSON.stringify(output.errors)}`
    );
  });

  // ─── File-tree drift: different content ───────────────────────────────────

  test('reports E-DRIFT when a source file differs from runtime file', () => {
    const srcDir = path.join(tmpDir, 'get-shit-done', 'bin');
    const runtimeDir = path.join(tmpDir, '.claude', 'get-shit-done', 'bin');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'bar.cjs'), 'module.exports = { version: 2 };\n');
    fs.writeFileSync(path.join(runtimeDir, 'bar.cjs'), 'module.exports = { version: 1 };\n');

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.code === 'E-DRIFT' || (e.message && e.message.includes('source-runtime'))),
      `Expected E-DRIFT for differing files: ${JSON.stringify(output.errors)}`
    );
  });

  // ─── Agents exclusion: PATH-TOKEN RULE ────────────────────────────────────

  test('does NOT report drift for agents/ files that legitimately differ (PATH-TOKEN RULE)', () => {
    const srcAgentsDir = path.join(tmpDir, 'get-shit-done', 'agents');
    const runtimeAgentsDir = path.join(tmpDir, '.claude', 'get-shit-done', 'agents');
    fs.mkdirSync(srcAgentsDir, { recursive: true });
    fs.mkdirSync(runtimeAgentsDir, { recursive: true });
    // Source uses ~/.claude/ token; runtime uses absolute path — intentionally different
    fs.writeFileSync(path.join(srcAgentsDir, 'my-agent.md'), 'agent: ~/.claude/get-shit-done/bin/gsd-tools.cjs\n');
    fs.writeFileSync(path.join(runtimeAgentsDir, 'my-agent.md'), 'agent: /home/user/.claude/get-shit-done/bin/gsd-tools.cjs\n');

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.errors.some(e => e.code === 'E-DRIFT' || (e.message && e.message.includes('source-runtime'))),
      `Should NOT report drift for agents/ files: ${JSON.stringify(output.errors)}`
    );
  });

  // ─── Settings.json parity drift ───────────────────────────────────────────

  test('reports E-SETTINGS-DRIFT when settings.json is missing a required hook registration', () => {
    writeIdenticalTrees(tmpDir, { 'bin/foo.cjs': 'module.exports = {};\n' });
    // Create hooks dir but write an incomplete settings.json (missing statusLine)
    const settingsDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(settingsDir, { recursive: true });
    const hooksDir = path.join(tmpDir, '.claude', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    const hookScripts = ['gsd2-check-update.js', 'gsd2-context-monitor.js', 'gsd2-read-injection-scanner.js', 'gsd2-agent-trace.js', 'gsd2-prompt-guard.js', 'gsd2-read-guard.js'];
    for (const h of hookScripts) {
      fs.writeFileSync(path.join(hooksDir, h), '// hook\n');
    }
    // Settings missing statusLine entry and gsd2-statusline.js
    const settings = {
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-check-update.js` }] }],
        PostToolUse: [
          { hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-context-monitor.js` }] },
          { matcher: 'Read', hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-read-injection-scanner.js` }] },
          { matcher: 'Task|Agent', hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-agent-trace.js` }] },
        ],
        PreToolUse: [
          { matcher: 'Write|Edit', hooks: [
            { type: 'command', command: `node .claude/hooks/gsd2-prompt-guard.js` },
            { type: 'command', command: `node .claude/hooks/gsd2-read-guard.js` },
          ]},
        ],
        PostToolUseFailure: [
          { matcher: 'Task|Agent', hooks: [{ type: 'command', command: `node .claude/hooks/gsd2-agent-trace.js` }] },
        ],
        // statusLine intentionally missing
      },
    };
    fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify(settings, null, 2));

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.code === 'E-SETTINGS-DRIFT' || (e.message && e.message.includes('settings'))),
      `Expected E-SETTINGS-DRIFT for missing statusLine: ${JSON.stringify(output.errors)}`
    );
  });

  test('does not report settings drift when .claude/settings.json is absent (skip cleanly)', () => {
    writeIdenticalTrees(tmpDir, { 'bin/foo.cjs': 'module.exports = {};\n' });
    // No .claude/settings.json — should skip the settings parity check

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.errors.some(e => e.code === 'E-SETTINGS-DRIFT' || (e.message && e.message.includes('settings'))),
      `Should not report settings drift when settings.json absent: ${JSON.stringify(output.errors)}`
    );
  });

  test('does not report file-tree drift when .claude/get-shit-done/ is absent (skip cleanly with info)', () => {
    // Only source tree exists; runtime tree absent
    const srcDir = path.join(tmpDir, 'get-shit-done', 'bin');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'foo.cjs'), 'module.exports = {};\n');
    // No .claude/get-shit-done/

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.errors.some(e => e.code === 'E-DRIFT'),
      `Should not report E-DRIFT when runtime dir absent: ${JSON.stringify(output.errors)}`
    );
  });

  // ─── Repair: --repair re-syncs drifted files, excludes agents/ ──────────

  test('--repair copies source files to runtime and records repair entry; agents/ NOT touched', () => {
    const srcDir = path.join(tmpDir, 'get-shit-done');
    const runtimeDir = path.join(tmpDir, '.claude', 'get-shit-done');
    fs.mkdirSync(path.join(srcDir, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(runtimeDir, 'bin'), { recursive: true });
    // Drifted file: runtime has old content
    fs.writeFileSync(path.join(srcDir, 'bin', 'drifted.cjs'), 'new content\n');
    fs.writeFileSync(path.join(runtimeDir, 'bin', 'drifted.cjs'), 'old content\n');
    // Agent file: source and runtime differ (intentional)
    fs.mkdirSync(path.join(srcDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(runtimeDir, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'agents', 'my-agent.md'), 'agent: ~/.claude/gsd-tools.cjs\n');
    fs.writeFileSync(path.join(runtimeDir, 'agents', 'my-agent.md'), 'agent: /home/user/.claude/gsd-tools.cjs\n');
    const agentRuntimeContent = fs.readFileSync(path.join(runtimeDir, 'agents', 'my-agent.md'), 'utf-8');

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);

    // Runtime drifted.cjs should now match source
    const runtimeContent = fs.readFileSync(path.join(runtimeDir, 'bin', 'drifted.cjs'), 'utf-8');
    assert.strictEqual(runtimeContent, 'new content\n', 'runtime file should be updated by repair');

    // Agent file should remain untouched
    const agentAfterRepair = fs.readFileSync(path.join(runtimeDir, 'agents', 'my-agent.md'), 'utf-8');
    assert.strictEqual(agentAfterRepair, agentRuntimeContent, 'agents/ file should NOT be touched by repair');

    // A repair entry should have been recorded
    assert.ok(
      Array.isArray(output.repairs_performed),
      `Expected repairs_performed: ${JSON.stringify(output)}`
    );
    assert.ok(
      output.repairs_performed.some(r => r.action === 'syncSourceRuntime' && r.success === true),
      `Expected syncSourceRuntime repair: ${JSON.stringify(output.repairs_performed)}`
    );
  });

  // ─── Transform-aware comparison tests ─────────────────────────────────────
  //
  // Case (a): source has path tokens; runtime has absolute paths (correct install)
  //   → transformed-source === runtime → NO E-DRIFT
  //
  // Case (b): source and runtime both use token form; but real non-path text differs
  //   → transformed-source !== runtime → E-DRIFT flagged
  //
  // Case (c): source has path token; runtime was copied verbatim (token still present)
  //   → transformed-source !== runtime (token vs absolute) → E-DRIFT flagged

  test('(a) no E-DRIFT when runtime .md has absolute paths (correct install transform)', () => {
    // Source: token form; runtime: what install.js would write (absolute path)
    const srcDir = path.join(tmpDir, 'get-shit-done', 'workflows');
    const runtimeDir = path.join(tmpDir, '.claude', 'get-shit-done', 'workflows');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });

    // The transform replaces ~/.claude/ with <tmpDir>/.claude/
    const installDir = path.resolve(path.join(tmpDir, '.claude')).replace(/\\/g, '/');
    const srcContent = 'See: ~/.claude/get-shit-done/workflows/health.md\n';
    const runtimeContent = srcContent.replace(/~\/\.claude\//g, installDir + '/');

    fs.writeFileSync(path.join(srcDir, 'ship.md'), srcContent);
    fs.writeFileSync(path.join(runtimeDir, 'ship.md'), runtimeContent);

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.errors.some(e => e.code === 'E-DRIFT'),
      `Should NOT report E-DRIFT for correctly-transformed runtime: ${JSON.stringify(output.errors)}`
    );
  });

  test('(b) E-DRIFT reported when real non-path content differs (genuine drift)', () => {
    // Both source and runtime use token-free content that genuinely differs
    const srcDir = path.join(tmpDir, 'get-shit-done', 'workflows');
    const runtimeDir = path.join(tmpDir, '.claude', 'get-shit-done', 'workflows');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });

    fs.writeFileSync(path.join(srcDir, 'do.md'), '# Do\n\nNew instruction text.\n');
    fs.writeFileSync(path.join(runtimeDir, 'do.md'), '# Do\n\nOld instruction text.\n');

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.code === 'E-DRIFT'),
      `Expected E-DRIFT for genuine non-path content drift: ${JSON.stringify(output.errors)}`
    );
  });

  test('(c) E-DRIFT reported when runtime .md still has token form (un-transformed)', () => {
    // Source: token form; runtime: also token form (was cp'd verbatim, not install-transformed)
    // The check should flag this because transformed-source (absolute) !== runtime (token)
    const srcDir = path.join(tmpDir, 'get-shit-done', 'workflows');
    const runtimeDir = path.join(tmpDir, '.claude', 'get-shit-done', 'workflows');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });

    const tokenContent = 'See: ~/.claude/get-shit-done/workflows/health.md\n';
    // Both source and runtime have token form — runtime was not transformed
    fs.writeFileSync(path.join(srcDir, 'git-integration.md'), tokenContent);
    fs.writeFileSync(path.join(runtimeDir, 'git-integration.md'), tokenContent);

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.code === 'E-DRIFT'),
      `Expected E-DRIFT for token-form (un-transformed) runtime: ${JSON.stringify(output.errors)}`
    );
  });
});
