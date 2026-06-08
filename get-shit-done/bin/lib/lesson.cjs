/**
 * Lesson — gsd-tools lesson subcommand implementation
 *
 * JSONL lessons ledger at .planning/lessons/lessons.jsonl.
 * Mirrors trace.cjs shape: readLessons / filterLessons / cmd* handlers.
 *
 * Plan 09-01 deliverables:
 *  - CRUD: append, list, update, bump-recurrence
 *  - Attribution: attributeFile(), pickAttribution(), cmdAttribute()
 *  - Scoped auto-miner: cmdScan() (ledger-recurrence only; no BLOCKER/telemetry scan)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Path helpers ─────────────────────────────────────────────────────────────

function lessonsPath(cwd) {
  return path.join(cwd, '.planning', 'lessons', 'lessons.jsonl');
}

// ─── JSONL read/write ─────────────────────────────────────────────────────────

/**
 * Read the JSONL lessons ledger.
 * Returns an array of parsed records (best-effort: malformed lines skipped).
 */
function readLessons(cwd) {
  const lp = lessonsPath(cwd);
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

/**
 * Rewrite the entire ledger file from an array of records.
 * One JSON.stringify(rec) per line, trailing newline.
 */
function writeLessons(cwd, records) {
  const lp = lessonsPath(cwd);
  fs.mkdirSync(path.dirname(lp), { recursive: true });
  const content = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(lp, content, 'utf8');
}

/**
 * Filter + tail lesson records.
 * opts = { agent, disposition, last }
 *  - agent: filter by attributed_agent (startsWith)
 *  - disposition: exact match on disposition field
 *  - last: tail-N (default 20)
 */
function filterLessons(records, opts) {
  opts = opts || {};
  let result = records;

  if (opts.agent) {
    result = result.filter(r => String(r.attributed_agent || '').startsWith(opts.agent));
  }
  if (opts.disposition) {
    result = result.filter(r => r.disposition === opts.disposition);
  }

  const last = opts.last != null ? opts.last : 20;
  if (result.length > last) {
    result = result.slice(result.length - last);
  }

  return result;
}

// ─── ID allocation ────────────────────────────────────────────────────────────

/**
 * Compute the next LSN-NNN id given existing records.
 * Pads to 3 digits minimum.
 */
function nextId(records) {
  let max = 0;
  for (const rec of records) {
    if (rec.id && /^LSN-(\d+)$/.test(rec.id)) {
      const n = parseInt(RegExp.$1, 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return 'LSN-' + String(next).padStart(3, '0');
}

// ─── CRUD commands ────────────────────────────────────────────────────────────

/**
 * Append a new lesson record.
 * Fills defaults: id, ts, recurrence=1, disposition='proposed'.
 * Prints the assigned id to stdout.
 */
function cmdAppend(cwd, jsonString) {
  let input;
  try {
    input = JSON.parse(jsonString);
  } catch (e) {
    process.stderr.write('lesson append: invalid JSON — ' + e.message + '\n');
    process.exit(1);
  }

  const records = readLessons(cwd);
  const id = nextId(records);

  const rec = Object.assign({
    id,
    ts: new Date().toISOString(),
    description: '',
    attributed_agent: null,
    attributed_file: null,
    attribution_confirmed_by_user: false,
    edit_summary: null,
    edit_type: null,
    lines_changed: null,
    disposition: 'proposed',
    recurrence: 1,
    commit: null,
    session_id: null,
    source_failure: null,
  }, input, { id, ts: new Date().toISOString() });

  // Ensure directory exists
  const lp = lessonsPath(cwd);
  fs.mkdirSync(path.dirname(lp), { recursive: true });

  // Append exactly one JSONL line
  fs.appendFileSync(lp, JSON.stringify(rec) + '\n', 'utf8');

  process.stdout.write(id + '\n');
}

/**
 * Format records as a plain-text table.
 * Columns: id / ts / attributed_agent / disposition / recurrence
 */
function formatTable(records) {
  const headers = ['id', 'ts', 'attributed_agent', 'disposition', 'recurrence'];

  const rows = records.map(r => [
    String(r.id || ''),
    String(r.ts || ''),
    String(r.attributed_agent || ''),
    String(r.disposition || ''),
    String(r.recurrence != null ? r.recurrence : ''),
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

/**
 * List lessons with optional filtering.
 * raw=true  → one JSON.stringify(rec) per line
 * raw=false → formatted table
 */
function cmdList(cwd, opts, raw) {
  const recs = filterLessons(readLessons(cwd), opts);
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
 * Update a lesson record in-place by id.
 * Mutates disposition and (if given) commit. Rewrites whole file.
 */
function cmdUpdate(cwd, id, { disposition, commit }) {
  const records = readLessons(cwd);
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) {
    process.stderr.write(`lesson update: record not found: ${id}\n`);
    process.exit(1);
  }

  if (disposition != null) records[idx].disposition = disposition;
  if (commit != null) records[idx].commit = commit;

  writeLessons(cwd, records);
}

/**
 * Increment the recurrence counter on a record in-place.
 */
function cmdBumpRecurrence(cwd, id) {
  const records = readLessons(cwd);
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) {
    process.stderr.write(`lesson bump-recurrence: record not found: ${id}\n`);
    process.exit(1);
  }

  records[idx].recurrence = (records[idx].recurrence || 0) + 1;
  writeLessons(cwd, records);
}

// ─── Attribution ──────────────────────────────────────────────────────────────

/**
 * Static table: agent_type → repo-root-relative source prose file.
 * NONE of these paths may start with .claude/ (Pitfall 3 guard).
 * NONE may contain gsd-local-patches/ (Pitfall 6 guard).
 */
const AGENT_FILE_MAP = {
  'gsd-executor': 'agents/gsd-executor.md',
  'gsd-planner': 'agents/gsd-planner.md',
  'gsd-verifier': 'agents/gsd-verifier.md',
  'gsd-plan-checker': 'agents/gsd-plan-checker.md',
  'gsd-phase-researcher': 'agents/gsd-phase-researcher.md',
  'gsd-debugger': 'agents/gsd-debugger.md',
  'gsd-fixer': 'agents/gsd-fixer.md',
};

const FALLBACK_FILE = 'get-shit-done/references/common-bug-patterns.md';

/**
 * Resolve agent_type to its source prose file.
 * Returns FALLBACK_FILE for unknown or null agents.
 * Guards: returned path must NOT start with .claude/ or contain gsd-local-patches/.
 */
function attributeFile(agentType) {
  const resolved = AGENT_FILE_MAP[agentType] || FALLBACK_FILE;
  if (resolved.startsWith('.claude/')) {
    throw new Error(`attributeFile: resolved path starts with .claude/: ${resolved}`);
  }
  if (resolved.includes('gsd-local-patches/')) {
    throw new Error(`attributeFile: resolved path contains gsd-local-patches/: ${resolved}`);
  }
  return resolved;
}

/**
 * Read telemetry and pick the most-recent execution agent's attribution.
 * If opts.agent is given, use it directly.
 * Otherwise scan the trace log and pick the most-recent execution agent.
 * Writes nothing.
 */
function pickAttribution(cwd, opts) {
  opts = opts || {};
  let agentType = opts.agent || null;

  if (!agentType) {
    // Lazy-require to avoid circular deps; trace.cjs is stable
    const { readTrace, filterTrace } = require('./trace.cjs');
    const EXEC_AGENTS = ['gsd-executor', 'gsd-planner', 'gsd-verifier'];
    const allRecords = readTrace(cwd);
    const filtered = filterTrace(allRecords, { last: opts.last || 50 });
    // Find most-recent execution agent
    for (let i = filtered.length - 1; i >= 0; i--) {
      const at = String(filtered[i].agent_type || '');
      if (EXEC_AGENTS.some(ea => at.startsWith(ea))) {
        agentType = at;
        break;
      }
    }
  }

  const attributed_file = attributeFile(agentType);
  return { attributed_agent: agentType, attributed_file };
}

/**
 * Print attribution result.
 * raw=true  → JSON line
 * raw=false → two lines (attributed_agent: X / attributed_file: Y)
 * Writes nothing to the ledger.
 */
function cmdAttribute(cwd, opts, raw) {
  const result = pickAttribution(cwd, opts);
  if (raw) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    process.stdout.write(`attributed_agent: ${result.attributed_agent}\n`);
    process.stdout.write(`attributed_file: ${result.attributed_file}\n`);
  }
}

// ─── Scoped auto-miner (ledger-recurrence only) ───────────────────────────────

/**
 * Read recurrence threshold from .planning/config.json key teach.recurrence_threshold.
 * Default: 3.
 */
function readThreshold(cwd) {
  try {
    const cfgPath = path.join(cwd, '.planning', 'config.json');
    if (!fs.existsSync(cfgPath)) return 3;
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const t = cfg && cfg.teach && cfg.teach.recurrence_threshold;
    return typeof t === 'number' ? t : 3;
  } catch (_) {
    return 3;
  }
}

/**
 * Scan the ledger and nominate records with recurrence >= threshold
 * and disposition !== 'applied'.
 *
 * SCOPED: ledger-recurrence ONLY.
 * Does NOT scan VERIFICATION.md BLOCKERs or telemetry dips.
 * Writes nothing.
 */
function cmdScan(cwd, opts) {
  const threshold = readThreshold(cwd);
  const records = readLessons(cwd);
  const nominations = records.filter(
    l => (l.recurrence || 0) >= threshold && l.disposition !== 'applied'
  );

  if (nominations.length === 0) {
    process.stdout.write(`No nominations (threshold=${threshold}).\n`);
    return;
  }

  process.stdout.write(`Nominations (recurrence >= ${threshold}):\n\n`);
  for (const l of nominations) {
    const agent = l.attributed_agent || 'unknown';
    const desc = l.description || '';
    const seen = l.recurrence || 0;
    process.stdout.write(`[${agent}] "${desc}" — seen ${seen}×\n`);
    process.stdout.write(`  → Run: /gsd2:teach "${desc}"\n`);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  lessonsPath,
  readLessons,
  filterLessons,
  nextId,
  cmdAppend,
  formatTable,
  cmdList,
  cmdUpdate,
  cmdBumpRecurrence,
  AGENT_FILE_MAP,
  attributeFile,
  pickAttribution,
  cmdAttribute,
  cmdScan,
};
