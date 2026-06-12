/**
 * Discuss Loop — gsd-tools discuss-loop subcommand implementation
 *
 * Deterministic primitives for the multi-lens discussion loop (Phase 14).
 * Pure functions never call process.exit; cmd* handlers do process I/O and exit.
 *
 * Subcommands:
 *  - loop-id <artifact-ref>       generate a stable loop id
 *  - validate --round N --data <json> [--prior <json>] [--artifact <path>]
 *  - delta --round N --data <json array of blocks> [--degraded]
 *  - survivors --data <json: array of rounds>
 *  - transcript <loop-id> --data <record json>
 *
 * Requirements: LOOP-01 (grounding / referential integrity), LOOP-02 (no-synthesis,
 *               deterministic convergence)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_LENSES = ['skeptic', 'user-advocate', 'architect'];
const VALID_POSITIONS = ['accept', 'reject', 'modify'];
const VALID_SEVERITIES = ['blocking', 'non-blocking'];
const VALID_STATUSES = ['new', 'carried'];

// Constraint id format: <lens>-r<round>-c<n>
const CONSTRAINT_ID_RE = /^(skeptic|user-advocate|architect)-r[1-3]-c\d+$/;

// ─── Pure functions (exported) ────────────────────────────────────────────────

/**
 * Generate a stable loop id from an artifact ref and optional run id.
 *
 * Format: loop-<UTC ISO ts with : and . replaced by ->-<artifact slug>
 *         plus --<runId> suffix iff runId is truthy.
 *
 * @param {string} artifactRef
 * @param {string|null} runId
 * @returns {string}
 */
function generateLoopId(artifactRef, runId) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = String(artifactRef)
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .toLowerCase();
  const base = `loop-${ts}-${slug}`;
  return runId ? `${base}--${runId}` : base;
}

/**
 * Validate a position block.
 *
 * @param {object} block - the block to validate
 * @param {object} opts
 * @param {number} opts.round - expected round number
 * @param {string[]|Set} [opts.priorIds] - prior constraint ids (for referential integrity)
 * @param {string|null} [opts.artifactContent] - full artifact text (for anchor substring check)
 * @returns {string[]} array of error strings (empty = valid)
 */
function validatePositionBlock(block, opts) {
  opts = opts || {};
  const round = opts.round;
  const priorIds = opts.priorIds ? new Set(opts.priorIds) : new Set();
  const artifactContent = opts.artifactContent != null ? opts.artifactContent : null;

  const errors = [];

  // lens enum
  if (!VALID_LENSES.includes(block.lens)) {
    errors.push(`invalid lens: ${block.lens}`);
  }

  // round must match
  if (block.round !== round) {
    errors.push(`round mismatch: block says ${block.round}, expected ${round}`);
  }

  // position enum
  if (!VALID_POSITIONS.includes(block.position)) {
    errors.push(`invalid position: ${block.position}`);
  }

  // modification required when position === 'modify'
  if (block.position === 'modify') {
    if (!block.modification || typeof block.modification !== 'string' || block.modification.trim() === '') {
      errors.push('modification required when position=modify');
    }
  }

  // blocking must be boolean
  if (typeof block.blocking !== 'boolean') {
    errors.push('blocking must be boolean');
  }

  // summary required
  if (!block.summary || typeof block.summary !== 'string' || block.summary.trim() === '') {
    errors.push('summary required');
  }

  // constraints must be an array
  if (!Array.isArray(block.constraints)) {
    errors.push('constraints must be an array');
    return errors; // can't continue without array
  }

  // validate each constraint
  for (let i = 0; i < block.constraints.length; i++) {
    const c = block.constraints[i];
    const label = c.id || `[${i}]`;

    // id format
    if (!c.id || !CONSTRAINT_ID_RE.test(c.id)) {
      errors.push(`constraint ${label}: invalid id format`);
    }

    // statement required
    if (!c.statement || typeof c.statement !== 'string' || c.statement.trim() === '') {
      errors.push(`constraint ${label}: statement required`);
    }

    // anchor required and non-empty
    if (!c.anchor || typeof c.anchor !== 'string' || c.anchor.trim() === '') {
      errors.push(`constraint ${label}: anchor required`);
    } else if (artifactContent !== null && !artifactContent.includes(c.anchor)) {
      // anchor must be verbatim substring of artifact content (LOOP-01)
      errors.push(`constraint ${label}: anchor not found in artifact`);
    }

    // severity enum
    if (!VALID_SEVERITIES.includes(c.severity)) {
      errors.push(`constraint ${label}: invalid severity: ${c.severity}`);
    }

    // status enum
    if (!VALID_STATUSES.includes(c.status)) {
      errors.push(`constraint ${label}: invalid status: ${c.status}`);
    }

    // carried constraints must cite a prior id (referential integrity)
    if (c.status === 'carried') {
      if (!c.carries || typeof c.carries !== 'string' || c.carries.trim() === '') {
        errors.push(`constraint ${label}: carries required when status=carried`);
      } else if (!priorIds.has(c.carries)) {
        errors.push(`constraint ${label}: carries id ${c.carries} not in prior rounds`);
      }
    }
  }

  return errors;
}

/**
 * Compute a round delta record from an array of validated position blocks.
 *
 * @param {number} round
 * @param {object[]} blocks
 * @param {boolean} degraded
 * @returns {object} round_delta record
 */
function computeRoundDelta(round, blocks, degraded) {
  const blocking_lenses = blocks
    .filter(b => b.blocking === true)
    .map(b => b.lens);

  const new_constraint_ids = [];
  let carried_count = 0;

  for (const block of blocks) {
    if (!Array.isArray(block.constraints)) continue;
    for (const c of block.constraints) {
      if (c.status === 'new') {
        new_constraint_ids.push(c.id);
      } else if (c.status === 'carried') {
        carried_count++;
      }
    }
  }

  const converged = blocking_lenses.length === 0 && new_constraint_ids.length === 0;

  return {
    type: 'round_delta',
    round,
    blocking_lenses,
    new_constraint_ids,
    carried_count,
    converged,
    degraded: !!degraded,
  };
}

/**
 * Select surviving lens positions from an array of rounds.
 *
 * A lens survives iff its final-round block has position !== 'accept' OR
 * some constraint has severity === 'blocking'.
 *
 * Survivors are ordered by divergence weight (count of their final-round
 * blocking constraints whose root is not shared with any other lens),
 * descending. Ties broken by fixed order: skeptic, user-advocate, architect.
 *
 * @param {object[][]} rounds - array of rounds, each an array of position blocks
 * @returns {{ lens: string, weight: number, block: object }[]}
 */
function selectSurvivors(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return [];

  // Build a constraint map across ALL rounds: id → constraint
  const constraintMap = new Map();
  for (const round of rounds) {
    for (const block of round) {
      if (!Array.isArray(block.constraints)) continue;
      for (const c of block.constraints) {
        if (c.id) constraintMap.set(c.id, c);
      }
    }
  }

  // Compute the root of a constraint by walking the carries chain
  function rootOf(constraintId) {
    const visited = new Set();
    let id = constraintId;
    while (true) {
      if (visited.has(id)) break; // cycle guard
      visited.add(id);
      const c = constraintMap.get(id);
      if (!c || c.status !== 'carried' || !c.carries) break;
      if (!constraintMap.has(c.carries)) break; // missing id — stop
      id = c.carries;
    }
    return id;
  }

  // Final round blocks by lens
  const finalRound = rounds[rounds.length - 1];
  const finalByLens = new Map();
  for (const block of finalRound) {
    finalByLens.set(block.lens, block);
  }

  // Determine survivors
  const survivors = [];
  for (const [lens, block] of finalByLens) {
    const hasBlockingConstraint = Array.isArray(block.constraints) &&
      block.constraints.some(c => c.severity === 'blocking');
    if (block.position !== 'accept' || hasBlockingConstraint) {
      survivors.push({ lens, block });
    }
  }

  if (survivors.length === 0) return [];

  // For each survivor, compute roots of their final-round blocking constraints
  const survivorRoots = new Map(); // lens → Set of roots
  for (const { lens, block } of survivors) {
    const roots = new Set();
    if (Array.isArray(block.constraints)) {
      for (const c of block.constraints) {
        if (c.severity === 'blocking') {
          roots.add(rootOf(c.id));
        }
      }
    }
    survivorRoots.set(lens, roots);
  }

  // A blocking constraint of lens L is "unshared" iff no OTHER survivor lens
  // has a final-round blocking constraint with the same root
  function computeWeight(targetLens) {
    const targetRoots = survivorRoots.get(targetLens);
    if (!targetRoots) return 0;

    let weight = 0;
    for (const root of targetRoots) {
      let sharedWithOther = false;
      for (const { lens } of survivors) {
        if (lens === targetLens) continue;
        const otherRoots = survivorRoots.get(lens);
        if (otherRoots && otherRoots.has(root)) {
          sharedWithOther = true;
          break;
        }
      }
      if (!sharedWithOther) weight++;
    }
    return weight;
  }

  // Compute weights and sort
  const LENS_ORDER = ['skeptic', 'user-advocate', 'architect'];
  const result = survivors.map(({ lens, block }) => ({
    lens,
    weight: computeWeight(lens),
    block, // passed through UNMODIFIED — never merged or rewritten (LOOP-02)
  }));

  result.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight; // descending by weight
    return LENS_ORDER.indexOf(a.lens) - LENS_ORDER.indexOf(b.lens); // tie-break by fixed order
  });

  return result;
}

/**
 * Append a record to the loop transcript (append-only JSONL).
 *
 * Creates the transcript directory if needed.
 * Injects loop_id and ts into the record.
 *
 * @param {string} cwd
 * @param {string} loopId
 * @param {object} record
 * @returns {string} transcript file path
 */
function appendTranscript(cwd, loopId, record) {
  const dir = path.join(cwd, '.planning', 'discuss-loop', loopId);
  fs.mkdirSync(dir, { recursive: true });
  const merged = Object.assign({}, record, {
    loop_id: loopId,
    ts: new Date().toISOString(),
  });
  const transcriptPath = path.join(dir, 'transcript.jsonl');
  fs.appendFileSync(transcriptPath, JSON.stringify(merged) + '\n', 'utf8');
  return transcriptPath;
}

// ─── cmd handlers (exported) ──────────────────────────────────────────────────

/**
 * gsd-tools discuss-loop loop-id <artifact-ref>
 * Prints the generated loop id to stdout.
 */
function cmdLoopId(cwd, ref) {
  if (!ref) {
    process.stderr.write('discuss-loop loop-id: artifact-ref required\n');
    process.exit(1);
  }
  const id = generateLoopId(ref, process.env.GSD_RUN_ID || null);
  process.stdout.write(id + '\n');
}

/**
 * gsd-tools discuss-loop validate --round N --data <block json>
 *                                 [--prior <json array of ids>]
 *                                 [--artifact <path>]
 *
 * Prints "valid" to stdout on success (exit 0).
 * Prints one error per line to stdout and exits 1 on failure.
 */
function cmdValidate(cwd, opts) {
  const { round, jsonString, priorJson, artifactPath } = opts;

  // Parse block JSON
  let block;
  try {
    block = JSON.parse(jsonString);
  } catch (e) {
    process.stderr.write(`discuss-loop validate: invalid JSON — ${e.message}\n`);
    process.exit(1);
  }

  // Parse prior ids
  let priorIds = [];
  if (priorJson) {
    try {
      priorIds = JSON.parse(priorJson);
    } catch (e) {
      process.stderr.write(`discuss-loop validate: invalid --prior JSON — ${e.message}\n`);
      process.exit(1);
    }
  }

  // Read artifact content if given
  let artifactContent = null;
  if (artifactPath) {
    try {
      artifactContent = fs.readFileSync(artifactPath, 'utf8');
    } catch (e) {
      process.stderr.write(`discuss-loop validate: cannot read artifact: ${e.message}\n`);
      process.exit(1);
    }
  }

  const errors = validatePositionBlock(block, {
    round: parseInt(round, 10),
    priorIds,
    artifactContent,
  });

  if (errors.length > 0) {
    process.stdout.write(errors.join('\n') + '\n');
    process.exit(1);
  }

  process.stdout.write('valid\n');
}

/**
 * gsd-tools discuss-loop delta --round N --data <json array of blocks> [--degraded]
 *
 * Prints round_delta JSON to stdout (exit 0).
 */
function cmdDelta(cwd, opts) {
  const { round, jsonString, degraded } = opts;

  let blocks;
  try {
    blocks = JSON.parse(jsonString);
  } catch (e) {
    process.stderr.write(`discuss-loop delta: invalid JSON — ${e.message}\n`);
    process.exit(1);
  }

  if (!Array.isArray(blocks)) {
    process.stderr.write('discuss-loop delta: --data must be a JSON array of blocks\n');
    process.exit(1);
  }

  const delta = computeRoundDelta(parseInt(round, 10), blocks, degraded);
  process.stdout.write(JSON.stringify(delta) + '\n');
}

/**
 * gsd-tools discuss-loop survivors --data <json: array of rounds>
 *
 * Prints survivor array JSON to stdout (exit 0).
 */
function cmdSurvivors(cwd, jsonString) {
  let rounds;
  try {
    rounds = JSON.parse(jsonString);
  } catch (e) {
    process.stderr.write(`discuss-loop survivors: invalid JSON — ${e.message}\n`);
    process.exit(1);
  }

  if (!Array.isArray(rounds)) {
    process.stderr.write('discuss-loop survivors: --data must be a JSON array of rounds\n');
    process.exit(1);
  }

  const result = selectSurvivors(rounds);
  process.stdout.write(JSON.stringify(result) + '\n');
}

/**
 * gsd-tools discuss-loop transcript <loop-id> --data <record json>
 *
 * Appends one JSONL line to the transcript.
 * Prints the transcript file path on success (exit 0).
 */
function cmdTranscript(cwd, loopId, jsonString) {
  if (!loopId) {
    process.stderr.write('discuss-loop transcript: loop-id required\n');
    process.exit(1);
  }

  let record;
  try {
    record = JSON.parse(jsonString);
  } catch (e) {
    process.stderr.write(`discuss-loop transcript: invalid JSON — ${e.message}\n`);
    process.exit(1);
  }

  // type field required and non-empty
  if (!record.type || typeof record.type !== 'string' || record.type.trim() === '') {
    process.stderr.write('discuss-loop transcript: record must have a type field\n');
    process.exit(1);
  }

  let transcriptPath;
  try {
    transcriptPath = appendTranscript(cwd, loopId, record);
  } catch (e) {
    process.stderr.write(`discuss-loop transcript: write failed — ${e.message}\n`);
    process.exit(1);
  }

  process.stdout.write(transcriptPath + '\n');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  generateLoopId,
  validatePositionBlock,
  computeRoundDelta,
  selectSurvivors,
  appendTranscript,
  cmdLoopId,
  cmdValidate,
  cmdDelta,
  cmdSurvivors,
  cmdTranscript,
};
