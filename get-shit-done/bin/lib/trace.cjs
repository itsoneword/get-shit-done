/**
 * Trace — gsd-tools trace subcommand implementation
 *
 * Minimal raw reader for .planning/telemetry/agent-trace.jsonl.
 * Supports tail + filter; no pretty-printing (deferred per CONTEXT.md).
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Read the JSONL trace log.
 * Returns an array of parsed records (best-effort: unparseable lines are skipped).
 */
function readTrace(cwd) {
  const logPath = path.join(cwd, '.planning', 'telemetry', 'agent-trace.jsonl');
  if (!fs.existsSync(logPath)) return [];
  const raw = fs.readFileSync(logPath, 'utf8');
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
 * Filter + tail records.
 * opts = { session, agent, confidence, last }
 * Filters are applied first, then last-N tail is applied.
 */
function filterTrace(records, opts) {
  opts = opts || {};
  let result = records;

  if (opts.session) {
    result = result.filter(r => r.session_id === opts.session);
  }
  if (opts.agent) {
    result = result.filter(r => String(r.agent_type || '').startsWith(opts.agent));
  }
  if (opts.confidence) {
    const target = opts.confidence.toUpperCase();
    result = result.filter(r => String(r.confidence || '').toUpperCase() === target);
  }

  const last = opts.last != null ? opts.last : 20;
  if (result.length > last) {
    result = result.slice(result.length - last);
  }

  return result;
}

/**
 * Format records as a plain-text table.
 * Columns: ts_return  event  agent_type  confidence  seq
 */
function formatTable(records) {
  const headers = ['ts_return', 'event', 'agent_type', 'confidence', 'seq'];

  // Build rows as string arrays
  const rows = records.map(r => [
    String(r.ts_return || ''),
    String(r.event || ''),
    String(r.agent_type || ''),
    r.confidence != null ? String(r.confidence) : 'null',
    String(r.seq != null ? r.seq : ''),
  ]);

  // Compute column widths (max of header and each row value)
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
  // Header
  lines.push(headers.map((h, i) => pad(h, widths[i])).join('  '));
  // Rows
  for (const row of rows) {
    lines.push(row.map((cell, i) => pad(cell, widths[i])).join('  '));
  }

  return lines.join('\n');
}

/**
 * Command entrypoint: read → filter → print.
 * raw=true  → print one JSON.stringify(rec) per line
 * raw=false → print formatted table
 */
function cmdTrace(cwd, opts, raw) {
  const recs = filterTrace(readTrace(cwd), opts);
  if (raw) {
    for (const rec of recs) {
      process.stdout.write(JSON.stringify(rec) + '\n');
    }
  } else {
    const table = formatTable(recs);
    if (table) process.stdout.write(table + '\n');
  }
}

module.exports = { readTrace, filterTrace, formatTable, cmdTrace };
