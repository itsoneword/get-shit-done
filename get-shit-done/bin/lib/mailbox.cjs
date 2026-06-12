/**
 * Mailbox — gsd-tools mailbox subcommand implementation
 *
 * MAILBOX.jsonl appends are appendFileSync-only (cmdMailboxAppend).
 * The ONLY full-file rewrite is the answer path (writeMailbox), because answers
 * are terminal-state mutations of existing records — a question is answered
 * exactly once. Never use writeMailbox to add records (concurrent parks would
 * be lost — Pitfall 3).
 *
 * 'open' and 'pending' both count as unanswered. review and pending count treat
 * them identically; no schema migration required.
 *
 * Plan 10-02 deliverables:
 *  - mailbox append: append-only, question-validated, run-context gated
 *  - mailbox list: read-only with optional --status filter
 *
 * Plan 12-02 deliverables:
 *  - writeMailbox: full-file rewrite for terminal-state answer updates only
 *  - answerRecord: pure function, terminal-state mutation (no re-answer)
 *  - printResumeHandoff: print park snapshot resume info after answering
 *  - cmdMailboxAnswer: targeted single-question answer
 *  - cmdMailboxReview: stdin-driven loop over all pending questions
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('node:readline');
const park = require('./park.cjs');

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

// ─── Full-file rewrite (answer path only) ────────────────────────────────────

/**
 * Full-file rewrite. ONLY for terminal-state answer updates — never for appends.
 *
 * Writes records back to MAILBOX.jsonl as JSONL (one record per line).
 * For an empty records array writes an empty string.
 *
 * @param {string} cwd
 * @param {string} runId
 * @param {object[]} records
 */
function writeMailbox(cwd, runId, records) {
  const content = records.length === 0
    ? ''
    : records.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(mailboxPath(cwd, runId), content, 'utf8');
}

// ─── Answer record (pure) ─────────────────────────────────────────────────────

/**
 * Pure function — mutate a copy of records to mark one record as answered.
 *
 * Returns:
 *  { error: 'not found' }       — qId not in records
 *  { error: 'already answered' } — record already has status === 'answered'
 *  { records: [...], record: <updated> } — success
 *
 * @param {object[]} records
 * @param {string} qId
 * @param {string} answerText
 */
function answerRecord(records, qId, answerText) {
  const idx = records.findIndex(r => r.id === qId);
  if (idx === -1) return { error: 'not found' };
  if (records[idx].status === 'answered') return { error: 'already answered' };

  const updated = Object.assign({}, records[idx], {
    status: 'answered',
    answer: answerText,
    answered_ts: new Date().toISOString(),
  });
  const newRecords = records.slice();
  newRecords[idx] = updated;
  return { records: newRecords, record: updated };
}

// ─── Resume handoff ───────────────────────────────────────────────────────────

/**
 * Print a resume handoff block when the answered question has a parked snapshot.
 *
 * Returns true if a handoff was printed, false otherwise (no snapshot, null phase,
 * or snapshot unreadable).
 *
 * Never throws — corrupt snapshots are caught and print a warning.
 *
 * @param {string} cwd
 * @param {string} runId
 * @param {number|null} phase
 * @param {NodeJS.WriteStream} [out] - defaults to process.stdout
 * @returns {boolean}
 */
function printResumeHandoff(cwd, runId, phase, out) {
  if (out == null) out = process.stdout;
  if (phase == null) return false;

  const sp = park.snapshotPath(cwd, runId, phase);
  if (!fs.existsSync(sp)) return false;

  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(sp, 'utf8'));
  } catch (_) {
    out.write(`(snapshot unreadable: ${sp})\n`);
    return false;
  }

  let staleness;
  try {
    staleness = park.checkStaleness(cwd, snapshot);
  } catch (_) {
    out.write(`(snapshot unreadable: ${sp})\n`);
    return false;
  }

  const changedStr = staleness.changed.length > 0
    ? staleness.changed.join(', ')
    : 'nothing changed since park';
  const gitRange = staleness.git_range || 'n/a';

  out.write(`── Resume handoff: phase ${phase} ──\n`);
  out.write(`resume: ${snapshot.resume_instruction || 'n/a'}\n`);
  out.write(`staleness: ${changedStr}\n`);
  out.write(`git range: ${gitRange}\n`);
  out.write(`detail: gsd-tools park staleness ${runId} --phase ${phase}\n`);

  return true;
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

/**
 * Answer a single mailbox question by id.
 *
 * gsd-tools mailbox answer [run-id] --id q-NNN --answer <text>
 *
 * @param {string} cwd
 * @param {string|undefined} runId  - explicit run-id arg (may be undefined for env fallback)
 * @param {string|null} qId
 * @param {string|null} answerText
 */
function cmdMailboxAnswer(cwd, runId, qId, answerText) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('mailbox answer: no run context — set GSD_RUN_ID or pass run-id arg\n');
    process.exit(1);
  }

  // 2. Validate required flags
  if (!qId || !answerText) {
    process.stderr.write('mailbox answer <run-id> --id <q-NNN> --answer <text>\n');
    process.exit(1);
  }

  // 3. Run dir must exist
  if (!fs.existsSync(runDir(cwd, effectiveRunId))) {
    process.stderr.write(
      `mailbox answer: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`
    );
    process.exit(1);
  }

  // 4. Read, apply update, check for errors
  const records = readMailbox(cwd, effectiveRunId);
  const result = answerRecord(records, qId, answerText);
  if (result.error) {
    process.stderr.write(`mailbox answer: question ${qId} ${result.error}\n`);
    process.exit(1);
  }

  // 5. Full-file rewrite (terminal-state mutation)
  writeMailbox(cwd, effectiveRunId, result.records);

  // 6. Print resume handoff if snapshot exists
  printResumeHandoff(cwd, effectiveRunId, result.record.phase);

  // 7. Print answered id
  process.stdout.write(qId + '\n');
}

/**
 * Interactively review all unanswered questions for a run.
 *
 * gsd-tools mailbox review [run-id]
 *
 * Reads answers from stdin (one per question). Empty line = skip.
 * Prints resume handoff for each answered question that has a parked snapshot.
 * After loop: one writeMailbox call if any were answered, summary line.
 *
 * Works with both interactive TTYs and piped stdin (spawnSync with input).
 *
 * @param {string} cwd
 * @param {string|undefined} runId
 */
async function cmdMailboxReview(cwd, runId) {
  // 1. Resolve run context
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('mailbox review: no run context — set GSD_RUN_ID or pass run-id arg\n');
    process.exit(1);
  }

  // 2. Run dir must exist
  if (!fs.existsSync(runDir(cwd, effectiveRunId))) {
    process.stderr.write(
      `mailbox review: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`
    );
    process.exit(1);
  }

  // 3. Load records, filter pending
  let records = readMailbox(cwd, effectiveRunId);
  const pending = records.filter(r => r.status !== 'answered');

  if (pending.length === 0) {
    process.stdout.write(`no pending questions for run ${effectiveRunId}\n`);
    return;
  }

  // 4. Read all stdin lines up-front — works with both piped and interactive.
  //    For piped stdin, we collect all lines then walk them in sync with questions.
  const stdinLines = await new Promise(resolve => {
    const lines = [];
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', line => lines.push(line));
    rl.on('close', () => resolve(lines));
  });

  let lineIdx = 0;

  let answeredCount = 0;
  let skippedCount = 0;

  // 5. Loop over pending records
  for (const rec of pending) {
    const optionsStr = Array.isArray(rec.options) && rec.options.length > 0
      ? rec.options.join(' | ')
      : '-';

    process.stdout.write(`── ${rec.id} (phase ${rec.phase != null ? rec.phase : '-'}) [${rec.status}] ──\n`);
    process.stdout.write(`question: ${rec.question}\n`);
    process.stdout.write(`context: ${rec.context || '-'}\n`);
    process.stdout.write(`options: ${optionsStr}\n`);
    process.stdout.write(`evidence: ${rec.evidence || '-'}\n`);
    process.stdout.write('answer (empty = skip)> ');

    const raw = lineIdx < stdinLines.length ? stdinLines[lineIdx++] : '';
    const answer = raw.trim();

    if (!answer) {
      skippedCount++;
      continue;
    }

    const result = answerRecord(records, rec.id, answer);
    if (!result.error) {
      records = result.records;
      process.stdout.write(`recorded: ${rec.id}\n`);
      printResumeHandoff(cwd, effectiveRunId, rec.phase);
      answeredCount++;
    }
  }

  // 6. One full-file rewrite if any answered
  if (answeredCount > 0) {
    writeMailbox(cwd, effectiveRunId, records);
  }

  // 7. Summary
  process.stdout.write(`answered: ${answeredCount}  skipped: ${skippedCount}\n`);
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
  writeMailbox,
  answerRecord,
  printResumeHandoff,
  cmdMailboxAppend,
  cmdMailboxList,
  cmdMailboxAnswer,
  cmdMailboxReview,
};
