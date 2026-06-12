/**
 * Ledger — gsd-tools ledger and run subcommand implementation
 *
 * Append-only decision ledger at .planning/run/<run-id>/DECISIONS.jsonl.
 * Three deliberate deviations from lesson.cjs:
 *  1. NO writeLedger / full-file rewrite — only appendFileSync writes DECISIONS.jsonl
 *  2. NO cmdUpdate / patch — superseding records are new appends with `supersedes` field
 *  3. Required-field validation at write time (before appendFileSync)
 *  4. GSD_RUN_ID + run-dir-existence gate on cmdLedgerAppend
 *
 * Plan 10-01 deliverables:
 *  - run init: create .planning/run/<run-id>/ layout
 *  - ledger append: append-only, validated, run-context gated
 *  - ledger list / filter: read-only query helpers
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Required fields ──────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['decision', 'alternatives', 'evidence', 'confidence', 'escalated'];

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Absolute path to the run directory for a given run-id.
 */
function runDir(cwd, runId) {
  return path.join(cwd, '.planning', 'run', runId);
}

/**
 * Absolute path to DECISIONS.jsonl for a given run-id.
 */
function ledgerPath(cwd, runId) {
  return path.join(cwd, '.planning', 'run', runId, 'DECISIONS.jsonl');
}

// ─── JSONL reader ─────────────────────────────────────────────────────────────

/**
 * Read DECISIONS.jsonl for a run.
 * Returns [] if file absent. Skips malformed lines (best-effort).
 */
function readLedger(cwd, runId) {
  const lp = ledgerPath(cwd, runId);
  if (!fs.existsSync(lp)) return [];
  const raw = fs.readFileSync(lp, 'utf8');
  return raw
    .split('\n')
    .filter(line => line.trim() !== '')
    .reduce((acc, line) => {
      try {
        acc.push(JSON.parse(line));
      } catch (_) {
        // skip malformed lines
      }
      return acc;
    }, []);
}

// ─── Filter ───────────────────────────────────────────────────────────────────

/**
 * Filter decision records.
 * opts = { phase, escalated, last }
 *  - phase: exact match on r.phase (numeric)
 *  - escalated: strict === true (excludes null and false)
 *  - last: tail-N (default 50)
 */
function filterLedger(records, opts) {
  opts = opts || {};
  let result = records;

  if (opts.phase != null) {
    result = result.filter(r => r.phase === opts.phase);
  }
  if (opts.escalated) {
    result = result.filter(r => r.escalated === true);
  }

  const last = opts.last != null ? opts.last : 50;
  if (result.length > last) {
    result = result.slice(result.length - last);
  }

  return result;
}

// ─── ID allocation ────────────────────────────────────────────────────────────

/**
 * Compute the next dec-NNN id given existing records.
 * Pads to 3 digits minimum.
 */
function nextDecId(records) {
  let max = 0;
  for (const rec of records) {
    if (rec.id && /^dec-(\d+)$/.test(rec.id)) {
      const n = parseInt(RegExp.$1, 10);
      if (n > max) max = n;
    }
  }
  return 'dec-' + String(max + 1).padStart(3, '0');
}

// ─── Table formatter ──────────────────────────────────────────────────────────

/**
 * Format decision records as a plain-text table.
 * Columns: id, ts, phase, confidence, escalated
 */
function formatTable(records) {
  const headers = ['id', 'ts', 'phase', 'confidence', 'escalated'];

  const rows = records.map(r => [
    String(r.id || ''),
    String(r.ts || ''),
    String(r.phase != null ? r.phase : ''),
    String(r.confidence || ''),
    String(r.escalated != null ? r.escalated : ''),
  ]);

  const widths = headers.map((h, i) => {
    let w = h.length;
    for (const row of rows) {
      if (row[i].length > w) w = row[i].length;
    }
    return w;
  });

  function pad(s, w) {
    return s + ' '.repeat(Math.max(0, w - s.length));
  }

  const lines = [];
  lines.push(headers.map((h, i) => pad(h, widths[i])).join('  '));
  for (const row of rows) {
    lines.push(row.map((cell, i) => pad(cell, widths[i])).join('  '));
  }

  return lines.join('\n');
}

// ─── cmd handlers ─────────────────────────────────────────────────────────────

/**
 * Initialize a run directory.
 * Creates .planning/run/<runId>/ with DECISIONS.jsonl, MAILBOX.jsonl, RUN-META.json, parked/.
 */
function cmdRunInit(cwd, runId) {
  if (!runId) {
    process.stderr.write('run init: run-id is required\n');
    process.exit(1);
  }

  const dir = runDir(cwd, runId);
  fs.mkdirSync(path.join(dir, 'parked'), { recursive: true });

  // Create empty DECISIONS.jsonl and MAILBOX.jsonl only if not already present
  const decisionsPath = path.join(dir, 'DECISIONS.jsonl');
  const mailboxPath = path.join(dir, 'MAILBOX.jsonl');
  if (!fs.existsSync(decisionsPath)) {
    fs.writeFileSync(decisionsPath, '', 'utf8');
  }
  if (!fs.existsSync(mailboxPath)) {
    fs.writeFileSync(mailboxPath, '', 'utf8');
  }

  // Write RUN-META.json (overwrite to reflect latest init)
  const meta = {
    run_id: runId,
    started_ts: new Date().toISOString(),
    phases: [],
    status: 'running',
  };
  fs.writeFileSync(path.join(dir, 'RUN-META.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  process.stdout.write(`run initialized: .planning/run/${runId}/\n`);
}

/**
 * Append a decision record (append-only, validated, run-context gated).
 *
 * Steps:
 *  1. Resolve effectiveRunId (explicit arg or GSD_RUN_ID env)
 *  2. Gate: run dir must exist
 *  3. Parse jsonString
 *  4. Validate required fields (using `in` so escalated:null passes)
 *  5. Assign id + ts, build record with optional-field defaults
 *  6. appendFileSync — never writeFileSync for DECISIONS.jsonl
 */
function cmdLedgerAppend(cwd, runId, jsonString) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('ledger append: no run context — set GSD_RUN_ID or pass run-id arg\n');
    process.exit(1);
  }

  // 2. Run dir must exist
  if (!fs.existsSync(runDir(cwd, effectiveRunId))) {
    process.stderr.write(
      `ledger append: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`
    );
    process.exit(1);
  }

  // 3. Parse JSON
  let input;
  try {
    input = JSON.parse(jsonString);
  } catch (e) {
    process.stderr.write('ledger append: invalid JSON — ' + e.message + '\n');
    process.exit(1);
  }

  // 4. Validate required fields (use `in` so escalated:null is accepted)
  const missing = REQUIRED_FIELDS.filter(f => !(f in input));
  if (missing.length > 0) {
    process.stderr.write('ledger append: missing required fields: ' + missing.join(', ') + '\n');
    process.exit(1);
  }

  // 5. Build record
  const records = readLedger(cwd, effectiveRunId);
  const id = nextDecId(records);
  const rec = Object.assign(
    {
      phase: null,
      context: null,
      question: null,
      escalation_verdict: null,
      escalation_reason: null,
    },
    input,
    { id, ts: new Date().toISOString() }
  );

  // 6. Append exactly one JSONL line (never writeFileSync for DECISIONS.jsonl)
  fs.appendFileSync(ledgerPath(cwd, effectiveRunId), JSON.stringify(rec) + '\n', 'utf8');

  process.stdout.write(id + '\n');
}

/**
 * List or filter decision records.
 * raw=true  → one JSON.stringify(rec) per line
 * raw=false → formatted table (with optional STUCK FLAG header)
 *
 * STUCK FLAG is printed before the table in non-raw mode only, so that raw
 * output stays machine-parseable JSONL.
 */
function cmdLedgerList(cwd, runId, opts, raw) {
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('ledger list: no run context\n');
    process.exit(1);
  }

  const recs = filterLedger(readLedger(cwd, effectiveRunId), opts);

  if (raw) {
    for (const rec of recs) {
      process.stdout.write(JSON.stringify(rec) + '\n');
    }
  } else {
    // Check for stuck flag in RUN-META.json (non-raw branch only)
    try {
      const metaFile = path.join(cwd, '.planning', 'run', effectiveRunId, 'RUN-META.json');
      if (fs.existsSync(metaFile)) {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        if (meta.stuck === true) {
          process.stdout.write(
            `STUCK FLAG: run ${effectiveRunId} — ledger unchanged across last 2 phase boundaries\n`
          );
        }
      }
    } catch (_) {
      // Missing or corrupt RUN-META.json must never break ledger list
    }

    const table = formatTable(recs);
    if (table) process.stdout.write(table + '\n');
  }
}

// ─── Run-meta mutation helpers ────────────────────────────────────────────────

const VALID_PHASE_STATUSES = ['completed', 'parked', 'failed'];
const VALID_RUN_STATUSES = ['running', 'complete', 'stopped'];

/**
 * Local path helper — avoids importing park.cjs (keep ledger.cjs sibling-free).
 */
function metaFilePath(cwd, runId) {
  return path.join(runDir(cwd, runId), 'RUN-META.json');
}

/**
 * Append a validated phase outcome record to RUN-META.json phases[].
 *
 * gsd-tools run record-phase <run-id> --phase N --status S [--worktree X]
 *   [--merge-clean true|false] [--started-ts ISO] [--ended-ts ISO] [--reason text]
 */
function cmdRunRecordPhase(cwd, runId, opts) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write(
      'run record-phase: no run context — set GSD_RUN_ID or pass run-id arg\n'
    );
    process.exit(1);
  }

  // 2. Run dir must exist
  if (!fs.existsSync(runDir(cwd, effectiveRunId))) {
    process.stderr.write(
      `run record-phase: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`
    );
    process.exit(1);
  }

  // 3. --phase required
  if (opts.phase == null || isNaN(opts.phase)) {
    process.stderr.write(
      'run record-phase: --phase <N> and --status <completed|parked|failed> are required\n'
    );
    process.exit(1);
  }

  // 4. Validate --status
  if (!opts.status || !VALID_PHASE_STATUSES.includes(opts.status)) {
    if (!opts.status) {
      process.stderr.write(
        'run record-phase: --phase <N> and --status <completed|parked|failed> are required\n'
      );
    } else {
      process.stderr.write(
        `run record-phase: invalid status: ${opts.status} (expected completed|parked|failed)\n`
      );
    }
    process.exit(1);
  }

  // 5. Read RUN-META.json
  const mp = metaFilePath(cwd, effectiveRunId);
  const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
  if (!Array.isArray(meta.phases)) meta.phases = [];

  // 6. Push the new entry
  meta.phases.push({
    phase: opts.phase,
    status: opts.status,
    worktree: opts.worktree != null ? opts.worktree : null,
    merge_clean: opts.mergeClean != null ? opts.mergeClean : null,
    started_ts: opts.startedTs != null ? opts.startedTs : null,
    ended_ts: opts.endedTs != null ? opts.endedTs : null,
    reason: opts.reason != null ? opts.reason : null,
  });

  // 7. Write back
  fs.writeFileSync(mp, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  process.stdout.write(`phase recorded: phase=${opts.phase} status=${opts.status}\n`);
}

/**
 * Set the terminal status of a run in RUN-META.json.
 *
 * gsd-tools run status <run-id> --set <running|complete|stopped> [--reason text]
 */
function cmdRunStatus(cwd, runId, setValue, reason) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write(
      'run status: no run context — set GSD_RUN_ID or pass run-id arg\n'
    );
    process.exit(1);
  }

  // 2. Run dir must exist
  if (!fs.existsSync(runDir(cwd, effectiveRunId))) {
    process.stderr.write(
      `run status: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`
    );
    process.exit(1);
  }

  // 3. --set required
  if (!setValue) {
    process.stderr.write(
      'run status: usage: run status <run-id> --set <running|complete|stopped> [--reason <text>]\n'
    );
    process.exit(1);
  }

  // 4. Validate --set value
  if (!VALID_RUN_STATUSES.includes(setValue)) {
    process.stderr.write(
      `run status: invalid status: ${setValue} (expected running|complete|stopped)\n`
    );
    process.exit(1);
  }

  // 5. Read, update, write RUN-META.json
  const mp = metaFilePath(cwd, effectiveRunId);
  const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
  meta.status = setValue;
  if (reason) meta.stopped_reason = reason;
  fs.writeFileSync(mp, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  process.stdout.write(`run status: ${setValue}\n`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  REQUIRED_FIELDS,
  VALID_PHASE_STATUSES,
  VALID_RUN_STATUSES,
  runDir,
  ledgerPath,
  readLedger,
  filterLedger,
  nextDecId,
  formatTable,
  cmdRunInit,
  cmdLedgerAppend,
  cmdLedgerList,
  cmdRunRecordPhase,
  cmdRunStatus,
};
