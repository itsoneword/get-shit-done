/**
 * GSD Tools Tests - Init
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, createLegacyLayoutFixture, createPartitionedFixture, withStateMilestone, cleanup } = require('./helpers.cjs');

describe('init commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init plan-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research Findings');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/phases/03-api/03-UAT.md');
  });

  test('init progress returns file paths', () => {
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.project_path, '.planning/PROJECT.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init phase-op returns core and optional phase file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init phase-op 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/phases/03-api/03-UAT.md');
  });

  test('init plan-phase omits optional paths if files missing', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_path, undefined);
    assert.strictEqual(output.research_path, undefined);
  });

  // ── phase_req_ids extraction (fix for #684) ──────────────────────────────

  test('init plan-phase extracts phase_req_ids from ROADMAP', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: CP-01, CP-02, CP-03\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'CP-01, CP-02, CP-03');
  });

  test('init plan-phase strips brackets from phase_req_ids', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: [CP-01, CP-02]\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'CP-01, CP-02');
  });

  test('init plan-phase returns null phase_req_ids when Requirements line is absent', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null);
  });

  test('init plan-phase returns null phase_req_ids when ROADMAP is absent', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null);
  });

  test('init execute-phase extracts phase_req_ids from ROADMAP', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: EX-01, EX-02\n**Plans:** 1 plans\n`
    );

    const result = runGsdTools('init execute-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'EX-01, EX-02');
  });

  test('init plan-phase returns null phase_req_ids when value is TBD', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: TBD\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null, 'TBD placeholder should return null');
  });

  test('init execute-phase returns null phase_req_ids when Requirements line is absent', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Plans:** 1 plans\n`
    );

    const result = runGsdTools('init execute-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitTodos (INIT-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitTodos', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty pending dir returns zero count', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'todos', 'pending'), { recursive: true });

    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 0);
    assert.deepStrictEqual(output.todos, []);
    assert.strictEqual(output.pending_dir_exists, true);
  });

  test('missing pending dir returns zero count', () => {
    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 0);
    assert.deepStrictEqual(output.todos, []);
    assert.strictEqual(output.pending_dir_exists, false);
  });

  test('multiple todos with fields are read correctly', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'task-1.md'), 'title: Fix bug\narea: backend\ncreated: 2026-02-25');
    fs.writeFileSync(path.join(pendingDir, 'task-2.md'), 'title: Add feature\narea: frontend\ncreated: 2026-02-24');
    fs.writeFileSync(path.join(pendingDir, 'task-3.md'), 'title: Write docs\narea: backend\ncreated: 2026-02-23');

    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 3);
    assert.strictEqual(output.todos.length, 3);

    const task1 = output.todos.find(t => t.file === 'task-1.md');
    assert.ok(task1, 'task-1.md should be in todos');
    assert.strictEqual(task1.title, 'Fix bug');
    assert.strictEqual(task1.area, 'backend');
    assert.strictEqual(task1.created, '2026-02-25');
    assert.strictEqual(task1.path, '.planning/todos/pending/task-1.md');
  });

  test('area filter returns only matching todos', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'task-1.md'), 'title: Fix bug\narea: backend\ncreated: 2026-02-25');
    fs.writeFileSync(path.join(pendingDir, 'task-2.md'), 'title: Add feature\narea: frontend\ncreated: 2026-02-24');
    fs.writeFileSync(path.join(pendingDir, 'task-3.md'), 'title: Write docs\narea: backend\ncreated: 2026-02-23');

    const result = runGsdTools('init todos backend', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 2);
    assert.strictEqual(output.area_filter, 'backend');
    for (const todo of output.todos) {
      assert.strictEqual(todo.area, 'backend');
    }
  });

  test('area filter miss returns zero count', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'task-1.md'), 'title: Fix bug\narea: backend\ncreated: 2026-02-25');

    const result = runGsdTools('init todos nonexistent', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 0);
    assert.strictEqual(output.area_filter, 'nonexistent');
  });

  test('malformed file uses defaults', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'broken.md'), 'some random content without fields');

    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 1);
    const todo = output.todos[0];
    assert.strictEqual(todo.title, 'Untitled');
    assert.strictEqual(todo.area, 'general');
    assert.strictEqual(todo.created, 'unknown');
  });

  test('non-md files are ignored', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'task.md'), 'title: Real task\narea: dev\ncreated: 2026-01-01');
    fs.writeFileSync(path.join(pendingDir, 'notes.txt'), 'title: Not a task\narea: dev\ncreated: 2026-01-01');

    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 1);
    assert.strictEqual(output.todos[0].file, 'task.md');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitMilestoneOp (INIT-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitMilestoneOp', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('no phase directories returns zero counts', () => {
    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 0);
    assert.strictEqual(output.completed_phases, 0);
    assert.strictEqual(output.all_phases_complete, false);
  });

  test('multiple phases with no summaries', () => {
    const phase1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    const phase2 = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase1, { recursive: true });
    fs.mkdirSync(phase2, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 2);
    assert.strictEqual(output.completed_phases, 0);
    assert.strictEqual(output.all_phases_complete, false);
  });

  test('mix of complete and incomplete phases', () => {
    const phase1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    const phase2 = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase1, { recursive: true });
    fs.mkdirSync(phase2, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase1, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(phase2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 2);
    assert.strictEqual(output.completed_phases, 1);
    assert.strictEqual(output.all_phases_complete, false);
  });

  test('all phases complete', () => {
    const phase1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 1);
    assert.strictEqual(output.completed_phases, 1);
    assert.strictEqual(output.all_phases_complete, true);
  });

  test('archive directory scanning', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'archive', 'v1.0'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'archive', 'v0.9'), { recursive: true });

    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archive_count, 2);
    assert.strictEqual(output.archived_milestones.length, 2);
  });

  test('no archive directory returns empty', () => {
    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archive_count, 0);
    assert.deepStrictEqual(output.archived_milestones, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitPhaseOp fallback (INIT-04)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitPhaseOp fallback', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('normal path with existing directory', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Context');
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Plans:** 1 plans\n'
    );

    const result = runGsdTools('init phase-op 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true);
    assert.ok(output.phase_dir.includes('03-api'), 'phase_dir should contain 03-api');
    assert.strictEqual(output.has_context, true);
    assert.strictEqual(output.has_plans, true);
  });

  test('fallback to ROADMAP when no directory exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 5: Widget Builder\n**Goal:** Build widgets\n**Plans:** TBD\n'
    );

    const result = runGsdTools('init phase-op 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true);
    assert.strictEqual(output.phase_dir, null);
    assert.strictEqual(output.phase_slug, 'widget-builder');
    assert.strictEqual(output.has_research, false);
    assert.strictEqual(output.has_context, false);
    assert.strictEqual(output.has_plans, false);
  });

  test('prefers current milestone roadmap entry over archived phase with same number', () => {
    const archiveDir = path.join(
      tmpDir,
      '.planning',
      'milestones',
      'v1.2-phases',
      '02-event-parser-and-queue-schema'
    );
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(path.join(archiveDir, '02-CONTEXT.md'), '# Archived context');
    fs.writeFileSync(path.join(archiveDir, '02-01-PLAN.md'), '# Archived plan');
    fs.writeFileSync(path.join(archiveDir, '02-VERIFICATION.md'), '# Archived verification');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

<details>
<summary>Shipped milestone v1.2</summary>

### Phase 2: Event Parser and Queue Schema
**Goal:** Archived milestone work
</details>

## Milestone v1.3 Current

### Phase 2: Retry Orchestration
**Goal:** Current milestone work
**Plans:** TBD
`
    );

    const result = runGsdTools('init phase-op 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true);
    assert.strictEqual(output.phase_dir, null);
    assert.strictEqual(output.phase_name, 'Retry Orchestration');
    assert.strictEqual(output.phase_slug, 'retry-orchestration');
    assert.strictEqual(output.has_context, false);
    assert.strictEqual(output.has_plans, false);
    assert.strictEqual(output.has_verification, false);
  });

  test('neither directory nor roadmap entry returns not found', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Setup\n**Goal:** Setup project\n**Plans:** TBD\n'
    );

    const result = runGsdTools('init phase-op 99', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, false);
    assert.strictEqual(output.phase_dir, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitProgress (INIT-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitProgress', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('no phases returns empty state', () => {
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 0);
    assert.deepStrictEqual(output.phases, []);
    assert.strictEqual(output.current_phase, null);
    assert.strictEqual(output.next_phase, null);
    assert.strictEqual(output.has_work_in_progress, false);
  });

  test('multiple phases with mixed statuses', () => {
    // Phase 01: complete (has plan + summary)
    const phase1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase1, '01-01-SUMMARY.md'), '# Summary');

    // Phase 02: in_progress (has plan, no summary)
    const phase2 = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase2, { recursive: true });
    fs.writeFileSync(path.join(phase2, '02-01-PLAN.md'), '# Plan');

    // Phase 03: pending (no plan, no research)
    const phase3 = path.join(tmpDir, '.planning', 'phases', '03-ui');
    fs.mkdirSync(phase3, { recursive: true });
    fs.writeFileSync(path.join(phase3, '03-CONTEXT.md'), '# Context');

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 3);
    assert.strictEqual(output.completed_count, 1);
    assert.strictEqual(output.in_progress_count, 1);
    assert.strictEqual(output.has_work_in_progress, true);

    assert.strictEqual(output.current_phase.number, '02');
    assert.strictEqual(output.current_phase.status, 'in_progress');

    assert.strictEqual(output.next_phase.number, '03');
    assert.strictEqual(output.next_phase.status, 'pending');

    // Verify phase entries have expected structure
    const p1 = output.phases.find(p => p.number === '01');
    assert.strictEqual(p1.status, 'complete');
    assert.strictEqual(p1.plan_count, 1);
    assert.strictEqual(p1.summary_count, 1);
  });

  test('researched status detected correctly', () => {
    const phase1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-RESEARCH.md'), '# Research');

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const p1 = output.phases.find(p => p.number === '01');
    assert.strictEqual(p1.status, 'researched');
    assert.strictEqual(p1.has_research, true);
    assert.strictEqual(output.current_phase.number, '01');
  });

  test('all phases complete returns no current or next', () => {
    const phase1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_count, 1);
    assert.strictEqual(output.current_phase, null);
    assert.strictEqual(output.next_phase, null);
  });

  test('paused_at detected from STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Paused At:** Phase 2, Task 3 — implementing auth\n'
    );

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.paused_at, 'paused_at should be set');
    assert.ok(output.paused_at.includes('Phase 2, Task 3'), 'paused_at should contain pause location');
  });

  test('no paused_at when STATE.md has no pause line', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\nSome content without pause.\n'
    );

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.paused_at, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// cmdInitMapCodebase (INIT-05)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitMapCodebase', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('no codebase dir returns empty', () => {
    const result = runGsdTools('init map-codebase', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_maps, false);
    assert.deepStrictEqual(output.existing_maps, []);
    assert.strictEqual(output.codebase_dir_exists, false);
  });

  test('with existing maps lists md files only', () => {
    const codebaseDir = path.join(tmpDir, '.planning', 'codebase');
    fs.mkdirSync(codebaseDir, { recursive: true });
    fs.writeFileSync(path.join(codebaseDir, 'STACK.md'), '# Stack');
    fs.writeFileSync(path.join(codebaseDir, 'ARCHITECTURE.md'), '# Architecture');
    fs.writeFileSync(path.join(codebaseDir, 'notes.txt'), 'not a markdown file');

    const result = runGsdTools('init map-codebase', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_maps, true);
    assert.strictEqual(output.existing_maps.length, 2);
    assert.ok(output.existing_maps.includes('STACK.md'), 'Should include STACK.md');
    assert.ok(output.existing_maps.includes('ARCHITECTURE.md'), 'Should include ARCHITECTURE.md');
  });

  test('empty codebase dir returns no maps', () => {
    const codebaseDir = path.join(tmpDir, '.planning', 'codebase');
    fs.mkdirSync(codebaseDir, { recursive: true });

    const result = runGsdTools('init map-codebase', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_maps, false);
    assert.deepStrictEqual(output.existing_maps, []);
    assert.strictEqual(output.codebase_dir_exists, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitNewProject (INIT-06)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitNewProject', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('greenfield project with no code', () => {
    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_existing_code, false);
    assert.strictEqual(output.has_package_file, false);
    assert.strictEqual(output.is_brownfield, false);
    assert.strictEqual(output.needs_codebase_map, false);
  });

  test('brownfield with package.json detected', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_package_file, true);
    assert.strictEqual(output.is_brownfield, true);
    assert.strictEqual(output.needs_codebase_map, true);
  });

  test('brownfield with codebase map does not need map', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'codebase'), { recursive: true });

    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.is_brownfield, true);
    assert.strictEqual(output.needs_codebase_map, false);
  });

  test('planning_exists flag is correct', () => {
    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.planning_exists, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitNewMilestone (INIT-06)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitNewMilestone', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns expected fields', () => {
    const result = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('current_milestone' in output, 'Should have current_milestone');
    assert.ok('current_milestone_name' in output, 'Should have current_milestone_name');
    assert.ok('researcher_model' in output, 'Should have researcher_model');
    assert.ok('synthesizer_model' in output, 'Should have synthesizer_model');
    assert.ok('roadmapper_model' in output, 'Should have roadmapper_model');
    assert.ok('commit_docs' in output, 'Should have commit_docs');
    assert.strictEqual(output.project_path, '.planning/PROJECT.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.state_path, '.planning/STATE.md');
  });

  test('file existence flags reflect actual state', () => {
    // Default: no STATE.md, ROADMAP.md, or PROJECT.md
    const result1 = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result1.success, `Command failed: ${result1.error}`);

    const output1 = JSON.parse(result1.output);
    assert.strictEqual(output1.state_exists, false);
    assert.strictEqual(output1.roadmap_exists, false);
    assert.strictEqual(output1.project_exists, false);

    // Create files and verify flags change
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project');

    const result2 = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result2.success, `Command failed: ${result2.error}`);

    const output2 = JSON.parse(result2.output);
    assert.strictEqual(output2.state_exists, true);
    assert.strictEqual(output2.roadmap_exists, true);
    assert.strictEqual(output2.project_exists, true);
  });

  test('reports latest completed milestone and archive target for reset flow', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      '# Milestones\n\n## v1.2 Search Refresh (Shipped: 2026-02-18)\n\n---\n'
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-refine-search'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '07-polish'), { recursive: true });

    const result = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.latest_completed_milestone, 'v1.2');
    assert.strictEqual(output.latest_completed_milestone_name, 'Search Refresh');
    assert.strictEqual(output.phase_dir_count, 2);
    assert.strictEqual(output.phase_archive_path, '.planning/milestones/v1.2-phases');
  });

  test('reset flow metadata is null-safe when no milestones file exists', () => {
    const result = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.latest_completed_milestone, null);
    assert.strictEqual(output.latest_completed_milestone_name, null);
    assert.strictEqual(output.phase_dir_count, 0);
    assert.strictEqual(output.phase_archive_path, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 05 — partition-aware init JSON output
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 05 partitioned-layout init', () => {

  // ─── cmdInitPhaseOp ──────────────────────────────────────────────────────

  test('cmdInitPhaseOp emits partitioned phase_dir when .planning/{milestone}/phases/ exists', () => {
    const tmp = createPartitionedFixture('v1.4');
    fs.mkdirSync(path.join(tmp, '.planning', 'v1.4', 'phases', '01-foo'), { recursive: true });
    // ROADMAP.md so phase resolution can derive phase_name from headings (optional)
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.4\n\n### Phase 1: foo\n**Goal:** test\n`);
    try {
      const result = runGsdTools(['init', 'phase-op', '01'], tmp);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const json = JSON.parse(result.output);
      assert.match(json.phase_dir, /\.planning[\/\\]v1\.4[\/\\]phases[\/\\]01-foo/);
      assert.strictEqual(json.milestone_root, 'v1.4');
      assert.strictEqual(json.legacy_layout_detected, false);
      assert.strictEqual(json.partition_root, '.planning/v1.4');
    } finally { cleanup(tmp); }
  });

  test('cmdInitPhaseOp emits legacy phase_dir when only .planning/phases/ exists', () => {
    const tmp = createLegacyLayoutFixture('v1.4');
    fs.mkdirSync(path.join(tmp, '.planning', 'phases', '01-foo'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.4\n\n### Phase 1: foo\n**Goal:** test\n`);
    try {
      const result = runGsdTools(['init', 'phase-op', '01'], tmp);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const json = JSON.parse(result.output);
      assert.match(json.phase_dir, /\.planning[\/\\]phases[\/\\]01-foo/);
      assert.strictEqual(json.milestone_root, 'v1.4');
      assert.strictEqual(json.legacy_layout_detected, true);
    } finally { cleanup(tmp); }
  });

  // ─── cmdInitPlanPhase ────────────────────────────────────────────────────

  test('cmdInitPlanPhase emits partitioned phase_dir + milestone_root in JSON output', () => {
    const tmp = createPartitionedFixture('v1.4');
    fs.mkdirSync(path.join(tmp, '.planning', 'v1.4', 'phases', '02-bar'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.4\n\n### Phase 2: bar\n**Goal:** test\n`);
    try {
      const result = runGsdTools(['init', 'plan-phase', '02'], tmp);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const json = JSON.parse(result.output);
      assert.match(json.phase_dir, /\.planning[\/\\]v1\.4[\/\\]phases[\/\\]02-bar/);
      assert.strictEqual(json.milestone_root, 'v1.4');
      assert.strictEqual(json.legacy_layout_detected, false);
    } finally { cleanup(tmp); }
  });

  test('cmdInitPlanPhase emits legacy phase_dir when partitioned dir missing', () => {
    const tmp = createLegacyLayoutFixture('v1.4');
    fs.mkdirSync(path.join(tmp, '.planning', 'phases', '02-bar'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.4\n\n### Phase 2: bar\n**Goal:** test\n`);
    try {
      const result = runGsdTools(['init', 'plan-phase', '02'], tmp);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const json = JSON.parse(result.output);
      assert.match(json.phase_dir, /\.planning[\/\\]phases[\/\\]02-bar/);
      assert.strictEqual(json.milestone_root, 'v1.4');
      assert.strictEqual(json.legacy_layout_detected, true);
    } finally { cleanup(tmp); }
  });

  // ─── cmdInitProgress — partitioned phases[] ──────────────────────────────

  test('cmdInitProgress lists phases from partitioned milestone dir', () => {
    const tmp = createPartitionedFixture('v1.4');
    fs.mkdirSync(path.join(tmp, '.planning', 'v1.4', 'phases', '01-alpha'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.4\n\n### Phase 1: alpha\n**Goal:** test\n`);
    try {
      const result = runGsdTools(['init', 'progress'], tmp);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const json = JSON.parse(result.output);
      assert.strictEqual(json.milestone_root, 'v1.4');
      assert.strictEqual(json.legacy_layout_detected, false);
      const dirs = (json.phases || []).map(p => p.directory || '');
      assert.ok(dirs.some(d => d.includes('v1.4/phases/01-alpha')),
        `expected partitioned directory in phases[]; got: ${JSON.stringify(dirs)}`);
    } finally { cleanup(tmp); }
  });

  // ─── B-CROSS: cross-milestone exclusion (SC-6) ───────────────────────────

  test('cross-milestone exclusion: cmdInitProgress phases[] omits phases from non-active milestone partitions', () => {
    // Setup: TWO milestone partitions present on disk
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-cross-'));
    fs.mkdirSync(path.join(tmp, '.planning', 'v1.3', 'phases', '01-foo'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.planning', 'v1.4', 'phases', '01-bar'), { recursive: true });
    // STATE.md pins active milestone to v1.4
    fs.writeFileSync(
      path.join(tmp, '.planning', 'STATE.md'),
      `---\nmilestone: v1.4\nmilestone_name: test\n---\n\n# State\n`
    );
    // Minimal ROADMAP.md so cmdInitProgress can derive a milestone filter
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.4\n\n### Phase 1: bar\n**Goal:** test\n`);
    try {
      const result = runGsdTools(['init', 'progress'], tmp);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const json = JSON.parse(result.output);
      const phaseDirs = (json.phases || []).map(p => p.directory || p.name || '');
      const joined = phaseDirs.join('|');
      // Active milestone phase IS present
      assert.ok(/01-bar/.test(joined),
        `expected 01-bar (active v1.4) in phases[], got: ${joined}`);
      // Prior milestone phase NOT in phases[]
      assert.ok(!/01-foo/.test(joined),
        `prior milestone phase not in phases[] — got 01-foo: ${joined}`);
      // milestone_root pinned to active
      assert.strictEqual(json.milestone_root, 'v1.4');
    } finally { cleanup(tmp); }
  });

  // ─── prior_milestones[] field ────────────────────────────────────────────

  test('cmdInitProgress populates prior_milestones[] when closed-milestone SUMMARY.md exists', () => {
    const tmp = createPartitionedFixture('v1.4');
    // Closed prior milestone with SUMMARY.md
    fs.mkdirSync(path.join(tmp, '.planning', 'v1.3'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, '.planning', 'v1.3', 'SUMMARY.md'),
      `# Milestone v1.3 Summary\n`
    );
    fs.writeFileSync(path.join(tmp, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.4\n\n### Phase 1: a\n`);
    try {
      const result = runGsdTools(['init', 'progress'], tmp);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const json = JSON.parse(result.output);
      assert.ok(Array.isArray(json.prior_milestones));
      const found = json.prior_milestones.find(p => p.milestone === 'v1.3');
      assert.ok(found, `expected v1.3 in prior_milestones[], got: ${JSON.stringify(json.prior_milestones)}`);
      assert.match(found.summary_path, /\.planning\/v1\.3\/SUMMARY\.md/);
    } finally { cleanup(tmp); }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap analyze command
// ─────────────────────────────────────────────────────────────────────────────
