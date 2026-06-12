/**
 * Park — gsd-tools park and run snapshot subcommand implementation
 *
 * Parking/staleness/stuck primitives for the autonomous supervision harness.
 * Follows the Phase 10 ledger/mailbox module pattern: pure functions exported
 * for tests, cmd* handlers for process I/O, thin dispatch in gsd-tools.cjs.
 *
 * Three invariants:
 *  1. Park path never rewrites MAILBOX.jsonl — mailbox append stays
 *     appendFileSync-only (see mailbox.cjs); park.cjs only writes
 *     parked/phase-{N}.json and RUN-META.json
 *  2. Boundary hashes are recorded at phase COMPLETION, not phase start —
 *     two consecutive identical hashes mean a phase completed without growing
 *     the ledger (Pitfall 5)
 *  3. Pure functions never run git — resolveGitHead is called only from
 *     cmd* handlers and try/catches to null (Pitfall 4)
 *
 * Plan 12-01 deliverables:
 *  - park create: write parked/phase-{N}.json context snapshot
 *  - park staleness: re-hash tracked files and report diff vs snapshot
 *  - run snapshot: record decisions hash at phase boundary, detect stuck
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const { execSync } = require('child_process');

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Absolute path to the run directory for a given run-id.
 */
function runDir(cwd, runId) {
  return path.join(cwd, '.planning', 'run', runId);
}

/**
 * Absolute path to the parked snapshot for a given run-id and phase number.
 */
function snapshotPath(cwd, runId, phase) {
  return path.join(cwd, '.planning', 'run', runId, 'parked', `phase-${phase}.json`);
}

/**
 * Absolute path to run.log for a given run-id.
 */
function runLogPath(cwd, runId) {
  return path.join(cwd, '.planning', 'run', runId, 'run.log');
}

/**
 * Absolute path to RUN-META.json for a given run-id.
 */
function metaPath(cwd, runId) {
  return path.join(cwd, '.planning', 'run', runId, 'RUN-META.json');
}

// ─── Hashing ──────────────────────────────────────────────────────────────────

/**
 * SHA-256 hex of a string.
 * Returns 64-char lowercase hex.
 */
function hashContent(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * SHA-256 hex of a file's contents.
 * Returns null if the file does not exist.
 */
function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return hashContent(fs.readFileSync(filePath, 'utf8'));
}

// ─── Content hashes ───────────────────────────────────────────────────────────

/**
 * Build content hashes for the four tracked planning files.
 *
 * Keys: 'STATE.md', 'ROADMAP.md', 'cross-phase-notes.md', 'CONTEXT.md'
 * Missing files map to null. contextPath of null maps 'CONTEXT.md' to null.
 */
function buildContentHashes(cwd, contextPath) {
  return {
    'STATE.md': hashFile(path.join(cwd, '.planning', 'STATE.md')),
    'ROADMAP.md': hashFile(path.join(cwd, '.planning', 'ROADMAP.md')),
    'cross-phase-notes.md': hashFile(path.join(cwd, '.planning', 'cross-phase-notes.md')),
    'CONTEXT.md': contextPath ? hashFile(contextPath) : null,
  };
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

/**
 * Build a park snapshot object from caller-supplied options.
 *
 * @param {object} opts
 * @param {number} opts.phase
 * @param {string} opts.blockedAt
 * @param {string} opts.questionId
 * @param {string|null} opts.phaseDir
 * @param {string|null} opts.contextPath
 * @param {string} opts.resumeInstruction
 * @param {object} opts.contentHashes
 * @param {string|null} opts.gitHead
 * @returns {object} snapshot record
 */
function buildParkSnapshot(opts) {
  return {
    phase: opts.phase,
    blocked_at: opts.blockedAt,
    question_id: opts.questionId,
    phase_dir: opts.phaseDir != null ? opts.phaseDir : null,
    context_path: opts.contextPath != null ? opts.contextPath : null,
    resume_instruction: opts.resumeInstruction,
    content_hashes: opts.contentHashes,
    git_head: opts.gitHead != null ? opts.gitHead : null,
    ts: new Date().toISOString(),
  };
}

// ─── Staleness ────────────────────────────────────────────────────────────────

/**
 * Re-hash the four tracked files and compare against a stored snapshot.
 *
 * Returns { changed, unchanged, missing, git_range }:
 *  - changed: keys where hash differs (incl. null→non-null)
 *  - unchanged: keys where hash is identical (incl. both null)
 *  - missing: keys that were non-null at park time and are null now
 *  - git_range: "<park-head>..HEAD" when snapshot.git_head is non-null, else null
 *
 * Note: pure function, never runs git.
 */
function checkStaleness(cwd, snapshot) {
  const hashes = snapshot.content_hashes || {};
  const contextPath = snapshot.context_path;

  // Resolve CONTEXT.md path — use as-is if absolute, else resolve relative to cwd
  let resolvedContextPath = null;
  if (contextPath) {
    resolvedContextPath = path.isAbsolute(contextPath)
      ? contextPath
      : path.join(cwd, contextPath);
  }

  const current = {
    'STATE.md': hashFile(path.join(cwd, '.planning', 'STATE.md')),
    'ROADMAP.md': hashFile(path.join(cwd, '.planning', 'ROADMAP.md')),
    'cross-phase-notes.md': hashFile(path.join(cwd, '.planning', 'cross-phase-notes.md')),
    'CONTEXT.md': resolvedContextPath ? hashFile(resolvedContextPath) : null,
  };

  const changed = [];
  const unchanged = [];
  const missing = [];

  const keys = ['STATE.md', 'ROADMAP.md', 'cross-phase-notes.md', 'CONTEXT.md'];
  for (const key of keys) {
    const oldHash = hashes[key] != null ? hashes[key] : null;
    const newHash = current[key];

    if (oldHash !== null && newHash === null) {
      // Was present at park, now gone
      missing.push(key);
    } else if (oldHash === newHash) {
      // Identical (including both null)
      unchanged.push(key);
    } else {
      // Differs (null→non-null or hash changed)
      changed.push(key);
    }
  }

  return {
    changed,
    unchanged,
    missing,
    git_range: snapshot.git_head ? `${snapshot.git_head}..HEAD` : null,
  };
}

// ─── Decisions hash ───────────────────────────────────────────────────────────

/**
 * SHA-256 hex of the DECISIONS.jsonl content for a run.
 * Returns null when the file is absent.
 */
function decisionsHash(cwd, runId) {
  const decisionsPath = path.join(cwd, '.planning', 'run', runId, 'DECISIONS.jsonl');
  if (!fs.existsSync(decisionsPath)) return null;
  return hashContent(fs.readFileSync(decisionsPath, 'utf8'));
}

// ─── Stuck detection ──────────────────────────────────────────────────────────

/**
 * Determine whether a run is stuck based on its phase_snapshots.
 *
 * Returns true iff the last two entries in meta.phase_snapshots have equal,
 * non-null decisions_hash values. Returns false when:
 *  - meta.phase_snapshots is missing or has fewer than 2 entries
 *  - the last two entries differ
 *  - the last hash is null
 */
function isStuck(meta) {
  const snaps = meta.phase_snapshots;
  if (!Array.isArray(snaps) || snaps.length < 2) return false;
  const last = snaps[snaps.length - 1];
  const prev = snaps[snaps.length - 2];
  return (
    last.decisions_hash !== null &&
    last.decisions_hash === prev.decisions_hash
  );
}

// ─── Phase snapshot append ────────────────────────────────────────────────────

/**
 * Append a phase boundary snapshot to RUN-META.json.
 *
 * snap = { phase, ts, decisions_hash }
 * Creates phase_snapshots array if absent, appends snap, sets meta.stuck
 * (boolean), writes file back as pretty-printed JSON + '\n'.
 * Returns the updated meta object.
 */
function appendPhaseSnapshot(cwd, runId, snap) {
  const mp = metaPath(cwd, runId);
  const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
  if (!Array.isArray(meta.phase_snapshots)) {
    meta.phase_snapshots = [];
  }
  meta.phase_snapshots.push(snap);
  meta.stuck = isStuck(meta);
  fs.writeFileSync(mp, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return meta;
}

// ─── Git head ────────────────────────────────────────────────────────────────

/**
 * Resolve the current git HEAD sha for a directory.
 * Returns a 40-char hex string, or null on any error (not a git repo, etc.).
 * Never throws.
 */
function resolveGitHead(cwd) {
  try {
    return execSync('git rev-parse HEAD', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
  } catch (_) {
    return null;
  }
}

// ─── cmd handlers ─────────────────────────────────────────────────────────────

/**
 * Handle `park create <run-id> --phase N --question q-NNN --blocked-at X --resume Y`
 *
 * Gates: effectiveRunId must exist, run dir must be initialized.
 * Required: --phase (integer) and --question.
 * Optional: --phase-dir, --context-path.
 * Writes parked/phase-{N}.json and prints the relative path.
 */
function cmdParkCreate(cwd, runId, opts) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('park create: no run context — set GSD_RUN_ID or pass run-id arg\n');
    process.exit(1);
  }

  // 2. Run dir must exist
  if (!fs.existsSync(runDir(cwd, effectiveRunId))) {
    process.stderr.write(
      `park create: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`
    );
    process.exit(1);
  }

  // 3. Validate required fields
  if (opts.phase == null || isNaN(opts.phase)) {
    process.stderr.write('park create: --phase <N> and --question <q-id> are required\n');
    process.exit(1);
  }
  if (!opts.question) {
    process.stderr.write('park create: --phase <N> and --question <q-id> are required\n');
    process.exit(1);
  }

  // 4. Build snapshot
  const gitHead = resolveGitHead(cwd);
  const contentHashes = buildContentHashes(cwd, opts.contextPath || null);
  const snap = buildParkSnapshot({
    phase: opts.phase,
    blockedAt: opts.blockedAt || null,
    questionId: opts.question,
    phaseDir: opts.phaseDir || null,
    contextPath: opts.contextPath || null,
    resumeInstruction: opts.resume || null,
    contentHashes,
    gitHead,
  });

  // 5. Write snapshot file
  const sp = snapshotPath(cwd, effectiveRunId, opts.phase);
  fs.writeFileSync(sp, JSON.stringify(snap, null, 2) + '\n', 'utf8');

  // 6. Print relative path
  process.stdout.write(`.planning/run/${effectiveRunId}/parked/phase-${opts.phase}.json\n`);
}

/**
 * Handle `park staleness <run-id> --phase N [--raw]`
 *
 * Gates: effectiveRunId must exist; snapshot file must exist.
 * Reads the snapshot, runs checkStaleness, outputs diff.
 */
function cmdParkStaleness(cwd, runId, opts, raw) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('park staleness: no run context — set GSD_RUN_ID or pass run-id arg\n');
    process.exit(1);
  }

  // 2. Snapshot file must exist
  const sp = snapshotPath(cwd, effectiveRunId, opts.phase);
  if (!fs.existsSync(sp)) {
    process.stderr.write(`park staleness: no snapshot for phase ${opts.phase}\n`);
    process.exit(1);
  }

  // 3. Parse snapshot
  const snapshot = JSON.parse(fs.readFileSync(sp, 'utf8'));

  // 4. Run staleness check
  const { changed, unchanged, missing, git_range } = checkStaleness(cwd, snapshot);

  // 5. Output
  if (raw) {
    process.stdout.write(JSON.stringify({
      phase: snapshot.phase,
      question_id: snapshot.question_id,
      resume_instruction: snapshot.resume_instruction,
      changed,
      unchanged,
      missing,
      git_range,
    }) + '\n');
  } else {
    process.stdout.write(`phase: ${snapshot.phase}\n`);
    process.stdout.write(`question: ${snapshot.question_id}\n`);
    process.stdout.write(`changed: ${changed.length > 0 ? changed.join(', ') : 'none'}\n`);
    process.stdout.write(`unchanged: ${unchanged.length > 0 ? unchanged.join(', ') : 'none'}\n`);
    process.stdout.write(`missing: ${missing.length > 0 ? missing.join(', ') : 'none'}\n`);
    process.stdout.write(`git range: ${git_range || 'n/a'}\n`);
    process.stdout.write(`resume: ${snapshot.resume_instruction || 'n/a'}\n`);
  }
}

/**
 * Handle `run snapshot <run-id> --phase N`
 *
 * Gates: effectiveRunId must exist, run dir must exist.
 * Records decisions hash at phase boundary, detects stuck, appends to run.log.
 */
function cmdRunSnapshot(cwd, runId, opts) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('run snapshot: no run context — set GSD_RUN_ID or pass run-id arg\n');
    process.exit(1);
  }

  // 2. Run dir must exist
  if (!fs.existsSync(runDir(cwd, effectiveRunId))) {
    process.stderr.write(
      `run snapshot: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`
    );
    process.exit(1);
  }

  // 3. Compute decisions hash
  const decHash = decisionsHash(cwd, effectiveRunId);
  const iso = new Date().toISOString();

  // 4. Append phase snapshot
  const snap = { phase: opts.phase, ts: iso, decisions_hash: decHash };
  const meta = appendPhaseSnapshot(cwd, effectiveRunId, snap);

  // 5. Append to run.log
  const logPath = runLogPath(cwd, effectiveRunId);
  const hashPrefix = decHash ? decHash.slice(0, 12) : 'null';
  fs.appendFileSync(logPath, `[${iso}] snapshot phase=${opts.phase} decisions_hash=${hashPrefix}\n`, 'utf8');

  // 6. Stuck detection output
  if (meta.stuck) {
    fs.appendFileSync(logPath,
      `[${iso}] STUCK: ledger unchanged across last 2 phase boundaries (phase ${opts.phase})\n`,
      'utf8'
    );
    process.stdout.write(`STUCK: ledger unchanged across last 2 phase boundaries\n`);
  }

  // 7. Always print snapshot recorded
  process.stdout.write(`snapshot recorded: phase=${opts.phase} decisions_hash=${hashPrefix}\n`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDir,
  snapshotPath,
  runLogPath,
  metaPath,
  hashContent,
  hashFile,
  buildContentHashes,
  buildParkSnapshot,
  checkStaleness,
  decisionsHash,
  isStuck,
  appendPhaseSnapshot,
  resolveGitHead,
  cmdParkCreate,
  cmdParkStaleness,
  cmdRunSnapshot,
};
