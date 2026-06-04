/**
 * 02-resolution-loop — Wave 0 structural test for the autonomous technical-resolution loop.
 *
 * This is the grading instrument for Plans 02 and 03 of Phase 02.
 *
 * Wave 0 behavior:
 *   - RSCH-01 (targets resolution-loop.md only) PASSES after Plan 01 completes.
 *   - RSCH-02 (targets discuss-phase.md, plan-phase.md) is RED until Plan 02 and 03 run.
 *   - RSCH-03 (targets wiring files only — NOT resolution-loop.md) is RED until Plans 02/03 run.
 *
 * A full-suite run (`node --test tests/02-resolution-loop.test.cjs`) intentionally exits
 * NON-ZERO at Wave 0 because RSCH-02/RSCH-03 assert on wiring that does not exist yet.
 * That is correct. Do NOT treat the full-file non-zero exit as a failure of this plan.
 *
 * Paths: resolved relative to this file's __dirname — all paths point at committed
 * source (get-shit-done/, agents/), NEVER at the gitignored runtime mirror.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Repo root — same resolution pattern as helpers.cjs (TOOLS_PATH = __dirname + '/..')
const repoRoot = path.join(__dirname, '..');

// Read committed source files once at top
const discussPhaseContent = fs.readFileSync(
  path.join(repoRoot, 'get-shit-done', 'workflows', 'discuss-phase.md'),
  'utf-8'
);
const planPhaseContent = fs.readFileSync(
  path.join(repoRoot, 'get-shit-done', 'workflows', 'plan-phase.md'),
  'utf-8'
);
const gsdPlannerContent = fs.readFileSync(
  path.join(repoRoot, 'agents', 'gsd-planner.md'),
  'utf-8'
);
const resolutionLoopContent = fs.readFileSync(
  path.join(repoRoot, 'get-shit-done', 'references', 'resolution-loop.md'),
  'utf-8'
);

// ---------------------------------------------------------------------------
// RSCH-01 — loop contract exists (targets resolution-loop.md only)
// ---------------------------------------------------------------------------

describe('RSCH-01 — loop contract exists', () => {
  test('resolution-loop.md exists and contains verdict shape (iterations_used and escalate)', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'get-shit-done', 'references', 'resolution-loop.md')),
      'resolution-loop.md must exist at get-shit-done/references/resolution-loop.md'
    );
    assert.match(resolutionLoopContent, /iterations_used/, 'resolution-loop.md must contain "iterations_used"');
    assert.match(resolutionLoopContent, /escalate/, 'resolution-loop.md must contain "escalate"');
  });

  test('resolution-loop.md states MEDIUM auto-decides', () => {
    assert.match(resolutionLoopContent, /MEDIUM/, 'resolution-loop.md must reference MEDIUM confidence');
    assert.match(resolutionLoopContent, /auto-decide/, 'resolution-loop.md must contain "auto-decide"');
  });

  test('resolution-loop.md documents the bounded ceiling (max_iterations)', () => {
    assert.match(resolutionLoopContent, /max_iterations/, 'resolution-loop.md must contain "max_iterations"');
  });
});

// ---------------------------------------------------------------------------
// RSCH-02 — discuss-phase LOW branch runs the loop, not bare ask-user
// (targets discuss-phase.md only — RED until Plan 02 wires the LOW branch)
// ---------------------------------------------------------------------------

describe('RSCH-02 — discuss-phase LOW branch runs the loop, not bare ask-user', () => {
  test('discuss-phase.md LOW branch references the resolution loop', () => {
    assert.match(
      discussPhaseContent,
      /resolution.loop|self.critique|re.research/i,
      'discuss-phase.md must reference the resolution loop (resolution.loop, self.critique, or re.research)'
    );
  });

  test('discuss-phase.md question_triage block contains a re-research/loop step (not bare ask-user only)', () => {
    // Extract the question_triage block
    const triageStart = discussPhaseContent.indexOf('<question_triage>');
    const triageEnd = discussPhaseContent.indexOf('</question_triage>');
    assert.ok(triageStart !== -1, 'discuss-phase.md must contain a <question_triage> block');
    assert.ok(triageEnd !== -1, 'discuss-phase.md must contain </question_triage>');
    const triageBlock = discussPhaseContent.slice(triageStart, triageEnd);
    assert.match(
      triageBlock,
      /broaden|re.research|iteration|resolution.loop/i,
      'The question_triage block must contain a re-research/loop step (broaden, re.research, iteration, or resolution.loop) so LOW does not jump straight to ask-user'
    );
  });
});

// ---------------------------------------------------------------------------
// RSCH-02 — plan-phase resolves inline at orchestrator, planner only surfaces
// (targets plan-phase.md + gsd-planner.md — RED until Plans 02/03 run)
// ---------------------------------------------------------------------------

describe('RSCH-02 — plan-phase resolves inline at orchestrator, planner only surfaces', () => {
  test('plan-phase.md contains an orchestrator-level resolution path (resolution.loop + Task-spawn of gsd-phase-researcher)', () => {
    // Whole-file match — NOT bounded by a heading. Rationale: Plan 03 may place the spawn
    // in a sub-step (e.g. ## 9.3) which falls outside a naive next-heading region extractor.
    assert.match(
      planPhaseContent,
      /resolution.loop/i,
      'plan-phase.md must reference the resolution loop (whole-file match)'
    );
    // Task( near gsd-phase-researcher — whole-file, tolerates any sub-step placement
    const hasTaskSpawn =
      /Task\([\s\S]{0,200}gsd-phase-researcher/i.test(planPhaseContent) ||
      /gsd-phase-researcher[\s\S]{0,200}Task\(/i.test(planPhaseContent);
    assert.ok(
      hasTaskSpawn,
      'plan-phase.md must contain a Task()-based gsd-phase-researcher spawn for the orchestrator research path (whole-file)'
    );
  });

  test('plan-phase.md references a distinct technical-unknown return signal', () => {
    assert.match(
      planPhaseContent,
      /TECHNICAL UNKNOWN|open_question/,
      'plan-phase.md must reference TECHNICAL UNKNOWN or open_question signal'
    );
  });

  test('gsd-planner.md surfaces the unknown (open_question or TECHNICAL UNKNOWN)', () => {
    assert.match(
      gsdPlannerContent,
      /open_question|TECHNICAL UNKNOWN/,
      'gsd-planner.md must contain an open_question or TECHNICAL UNKNOWN surface mechanism'
    );
  });

  test('NEGATIVE (Pitfall-4 discriminator): gsd-planner.md does NOT spawn a research Task', () => {
    // The planner has no Task tool. A loop buried in the planner cannot actually execute
    // its research steps — it silently degrades. This assertion catches that.
    assert.doesNotMatch(
      gsdPlannerContent,
      /resolution.loop[\s\S]{0,400}Task\(/i,
      'gsd-planner.md must NOT contain a resolution-loop Task-spawn (planner has no Task tool)'
    );
    assert.doesNotMatch(
      gsdPlannerContent,
      /Task\([\s\S]{0,200}gsd-phase-researcher/i,
      'gsd-planner.md must NOT contain a Task()-based gsd-phase-researcher spawn (planner has no Task tool)'
    );
  });
});

// ---------------------------------------------------------------------------
// RSCH-03 — signal-strength skip + STRONG-honoring present in WIRING files
// (targets discuss-phase.md / plan-phase.md / gsd-planner.md — NOT resolution-loop.md)
// RED until Plans 02/03 run.
// ---------------------------------------------------------------------------

describe('RSCH-03 — signal-strength skip + STRONG-honoring present in WIRING files', () => {
  test('discuss-phase.md contains STRONG skip logic (does not include resolution-loop.md in assertion)', () => {
    // Explicitly targets discuss-phase.md only — resolution-loop.md is excluded so this
    // assertion discriminates the wiring, not the contract.
    assert.match(
      discussPhaseContent,
      /STRONG[\s\S]{0,80}skip|skip[\s\S]{0,80}STRONG|Signal-strength pre-check|skip the loop/i,
      'discuss-phase.md must contain STRONG skip logic or Signal-strength pre-check'
    );
  });

  test('plan-phase.md or gsd-planner.md references STRONG decision-honoring (wiring files only)', () => {
    // Explicitly uses only the wiring files — resolution-loop.md is not checked here,
    // so this assertion requires the wiring files to have STRONG-honoring prose.
    const wiringFilesMatch =
      /\[STRONG\]|STRONG.*decision|signal-strength/i.test(planPhaseContent) ||
      /\[STRONG\]|STRONG.*decision|signal-strength/i.test(gsdPlannerContent);
    assert.ok(
      wiringFilesMatch,
      'plan-phase.md or gsd-planner.md must reference [STRONG] decision-honoring or signal-strength (wiring files only — not resolution-loop.md)'
    );
  });
});
