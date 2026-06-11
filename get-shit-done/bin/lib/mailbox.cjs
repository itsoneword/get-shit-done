/**
 * Mailbox — gsd-tools mailbox subcommand implementation
 *
 * Append-only question mailbox at .planning/run/<run-id>/MAILBOX.jsonl.
 * Deliberate deviations from lesson.cjs (same posture as ledger.cjs):
 *  1. NO writeMailbox / full-file rewrite — only appendFileSync writes MAILBOX.jsonl
 *  2. NO cmdUpdate / cmdMailboxPatch — Phase 12 fills answer via separate mechanism
 *  3. Required-field validation at write time (before appendFileSync)
 *  4. GSD_RUN_ID + run-dir-existence gate on cmdMailboxAppend
 *  5. Library functions return data, never process.exit — only cmd* handlers exit
 *
 * Plan 10-02 deliverables:
 *  - mailbox append: append-only, question-validated, run-context gated
 *  - mailbox list: read-only with optional --status filter
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Required fields ──────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['question'];

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Absolute path to the run directory for a given run-id.
 */
function runDir(cwd, runId) {
  return path.join(cwd, '.planning', 'run', runId);
}

/**
 * Absolute path to MAILBOX.jsonl for a given run-id.
 */
function mailboxPath(cwd, runId) {
  return path.join(cwd, '.planning', 'run', runId, 'MAILBOX.jsonl');
}

// ─── JSONL reader ─────────────────────────────────────────────────────────────

/**
 * Read MAILBOX.jsonl for a run.
 * Returns [] if file absent. Skips malformed lines (best-effort).
 */
function readMailbox(cwd, runId) {
  const mp = mailboxPath(cwd, runId);
  if (!fs.existsSync(mp)) return [];
  const raw = fs.readFileSync(mp, 'utf8');
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
 * Filter mailbox records.
 * opts = { status, last }
 *  - status: exact match on r.status
 *  - last: tail-N (default 50)
 */
function filterMailbox(records, opts) {
  opts = opts || {};
  let result = records;

  if (opts.status) {
    result = result.filter(r => r.status === opts.status);
  }

  const last = opts.last != null ? opts.last : 50;
  if (result.length > last) {
    result = result.slice(result.length - last);
  }

  return result;
}

// ─── ID allocation ────────────────────────────────────────────────────────────

/**
 * Compute the next q-NNN id given existing records.
 * Pads to 3 digits minimum.
 */
function nextQId(records) {
  let max = 0;
  for (const rec of records) {
    if (rec.id && /^q-(\d+)$/.test(rec.id)) {
      const n = parseInt(RegExp.$1, 10);
      if (n > max) max = n;
    }
  }
  return 'q-' + String(max + 1).padStart(3, '0');
}

// ─── Table formatter ──────────────────────────────────────────────────────────

/**
 * Format mailbox records as a plain-text table.
 * Columns: id, ts, phase, status, question
 */
function formatTable(records) {
  const headers = ['id', 'ts', 'phase', 'status', 'question'];

  const rows = records.map(r => [
    String(r.id || ''),
    String(r.ts || ''),
    String(r.phase != null ? r.phase : ''),
    String(r.status || ''),
    String(r.question || ''),
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
 * Append a mailbox record (append-only, question-validated, run-context gated).
 *
 * Steps:
 *  1. Resolve effectiveRunId (explicit arg or GSD_RUN_ID env)
 *  2. Gate: run dir must exist
 *  3. Parse jsonString
 *  4. Validate required fields (question must be present)
 *  5. Assign id + ts, build record with optional-field defaults
 *  6. appendFileSync — never writeFileSync for MAILBOX.jsonl
 */
function cmdMailboxAppend(cwd, runId, jsonString) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('mailbox append: no run context — set GSD_RUN_ID or pass run-id arg\n');
    process.exit(1);
  }

  // 2. Run dir must exist
  if (!fs.existsSync(runDir(cwd, effectiveRunId))) {
    process.stderr.write(
      `mailbox append: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`
    );
    process.exit(1);
  }

  // 3. Parse JSON
  let input;
  try {
    input = JSON.parse(jsonString);
  } catch (e) {
    process.stderr.write('mailbox append: invalid JSON — ' + e.message + '\n');
    process.exit(1);
  }

  // 4. Validate required fields
  const missing = REQUIRED_FIELDS.filter(f => !(f in input));
  if (missing.length > 0) {
    process.stderr.write('mailbox append: missing required fields: ' + missing.join(', ') + '\n');
    process.exit(1);
  }

  // 5. Build record — defaults first, then caller input, then forced auto-fills
  const records = readMailbox(cwd, effectiveRunId);
  const id = nextQId(records);
  const rec = Object.assign(
    {
      run_id: effectiveRunId,
      phase: null,
      decision_id: null,
      context: null,
      options: null,
      evidence: null,
      status: 'open',
      answer: null,
      answered_ts: null,
    },
    input,
    { id, ts: new Date().toISOString(), run_id: effectiveRunId }
  );

  // 6. Append exactly one JSONL line (never writeFileSync for MAILBOX.jsonl)
  fs.appendFileSync(mailboxPath(cwd, effectiveRunId), JSON.stringify(rec) + '\n', 'utf8');

  process.stdout.write(id + '\n');
}

/**
 * List mailbox records with optional status filtering.
 * raw=true  → one JSON.stringify(rec) per line
 * raw=false → formatted table
 */
function cmdMailboxList(cwd, runId, opts, raw) {
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('mailbox list: no run context\n');
    process.exit(1);
  }

  const recs = filterMailbox(readMailbox(cwd, effectiveRunId), opts);

  if (raw) {
    for (const rec of recs) {
      process.stdout.write(JSON.stringify(rec) + '\n');
    }
  } else {
    const table = formatTable(recs);
    if (table) process.stdout.write(table + '\n');
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  REQUIRED_FIELDS,
  runDir,
  mailboxPath,
  readMailbox,
  filterMailbox,
  nextQId,
  formatTable,
  cmdMailboxAppend,
  cmdMailboxList,
};
