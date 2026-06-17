/**
 * Triage — gsd-tools triage subcommand implementation
 *
 * Structural helpers for the triage worker. Verdict assignment (LLM judgment
 * over the six-verdict table) lives in workflows/triage.md workflow prose.
 * This module provides: ROADMAP backlog parser, mailbox proposal builder,
 * dedup check, resume idempotency check, and CLI dispatch handler.
 *
 * Key invariants:
 *  1. Never writes to todo files or ROADMAP.md (propose-never-dispose)
 *  2. Mailbox proposals always carry status:'pending' explicitly (Phase 14-03)
 *  3. One mailbox append per item (appendFileSync-atomic per AGENT-SPEC)
 *
 * Plan 15-01 deliverables:
 *  - parseRoadmapBacklog: parse ## Backlog section for B-prefixed items
 *  - buildTriageProposal: build mailbox-ready proposal object
 *  - pendingProposalExists: dedup guard before append
 *  - supersedingRecordExists: resume idempotency check
 *  - cmdTriageRun: CLI handler — reads input, appends proposals per item
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── parseRoadmapBacklog ──────────────────────────────────────────────────────

/**
 * Parse the ## Backlog section of ROADMAP.md, returning B-prefixed items.
 *
 * @param {string} cwd - project root
 * @returns {Array<{id: string, title: string, goal: string, body: string}>}
 */
function parseRoadmapBacklog(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) return [];

  const content = fs.readFileSync(roadmapPath, 'utf8');

  // Find ## Backlog section; stop at next ## heading or end of file
  const backlogMatch = content.match(/^## Backlog\s*$([\s\S]*?)(?=^## |\0)/m);
  if (!backlogMatch) {
    // Try a simpler fallback: take everything from ## Backlog to end or next ##
    const simpleMatch = content.split(/^## Backlog\s*$/m);
    if (simpleMatch.length < 2) return [];
    const afterBacklog = simpleMatch[1];
    // Cut at next ## heading
    const nextSectionIdx = afterBacklog.search(/^## /m);
    const section = nextSectionIdx === -1 ? afterBacklog : afterBacklog.slice(0, nextSectionIdx);
    return parseBacklogSection(section);
  }

  return parseBacklogSection(backlogMatch[1]);
}

/**
 * Parse B-prefixed items from a backlog section string.
 * @param {string} section
 * @returns {Array<{id: string, title: string, goal: string, body: string}>}
 */
function parseBacklogSection(section) {
  const items = [];
  const headerRe = /^### (B\d+): (.+)$/gm;
  let m;

  while ((m = headerRe.exec(section)) !== null) {
    const id = m[1];
    const rawTitle = m[2].trim();
    const title = rawTitle.replace(/\s*\(BACKLOG\)\s*$/, '').trim();

    // Extract body until next ### or end of section
    const start = m.index + m[0].length;
    const remainder = section.slice(start);
    const nextHeaderRe = /^### /m;
    const nextIdx = remainder.search(nextHeaderRe);
    const body = nextIdx === -1 ? remainder : remainder.slice(0, nextIdx);

    const goalMatch = body.match(/\*\*Goal:\*\*\s*(.+)/);

    items.push({
      id,
      title,
      goal: goalMatch ? goalMatch[1].trim() : '',
      body: body.trim(),
    });
  }

  return items;
}

// ─── buildTriageProposal ──────────────────────────────────────────────────────

/**
 * Build a mailbox-ready proposal object for a triage item.
 *
 * @param {{id: string, title: string}} item - todo or backlog item
 * @param {string} verdict - one of: already-done|obsolete|fold-into-phase|new-phase|needs-input|defer
 * @param {string} evidence - rationale citing code/roadmap
 * @param {string|null} target - phase name or reason (included in context field)
 * @returns {{question: string, phase: null, context: string, options: string[], evidence: string, status: 'pending', decision_id: null}}
 */
function buildTriageProposal(item, verdict, evidence, target) {
  const targetStr = target != null ? target : 'null';
  return {
    question: `Triage proposal: ${item.title}`,
    phase: null,
    context: `triage-verdict: ${verdict} target=${targetStr}`,
    options: ['accept', 'defer'],
    evidence: evidence,
    status: 'pending',       // MUST be explicit — cmdMailboxAppend default is 'open'
    decision_id: null,
  };
}

// ─── pendingProposalExists ────────────────────────────────────────────────────

/**
 * Dedup guard: returns true if a mailbox entry has status !== 'answered'
 * and question includes itemTitle. Prevents duplicate proposals on re-run.
 *
 * @param {string} cwd
 * @param {string} runId
 * @param {string} itemTitle
 * @returns {boolean}
 */
function pendingProposalExists(cwd, runId, itemTitle) {
  const { readMailbox } = require('./mailbox.cjs');
  const records = readMailbox(cwd, runId);
  return records.some(r => r.status !== 'answered' && r.question && r.question.includes(itemTitle));
}

// ─── supersedingRecordExists ──────────────────────────────────────────────────

/**
 * Resume idempotency check: returns true if any ledger record has
 * supersedes === questionId OR evidence field containing questionId.
 * Used to skip ledger write if already written by a prior attempt.
 *
 * @param {string} cwd
 * @param {string} runId
 * @param {string} questionId
 * @returns {boolean}
 */
function supersedingRecordExists(cwd, runId, questionId) {
  const { readLedger } = require('./ledger.cjs');
  const records = readLedger(cwd, runId);
  return records.some(r =>
    r.supersedes === questionId ||
    (typeof r.evidence === 'string' && r.evidence.includes(questionId))
  );
}

// ─── cmdTriageRun ─────────────────────────────────────────────────────────────

/**
 * CLI handler for `gsd-tools triage run [run-id]`.
 *
 * Resolves effectiveRunId (explicit arg or process.env.GSD_RUN_ID).
 * Reads todos from .planning/todos/pending/*.md.
 * Reads backlog via parseRoadmapBacklog.
 * For each item: checks dedup, appends mailbox proposal with status:'pending'.
 * Prints: "triage complete: N proposals appended, M failed"
 *
 * NOTE: Verdict assignment is the responsibility of the triage.md workflow prose.
 * This handler serves as the structural coordinator: dedup check + append.
 * In workflow-driven mode, the LLM assigns verdicts before this runs; here we
 * emit needs-input as the structural default for programmatic invocation.
 *
 * @param {string} cwd
 * @param {string|undefined} runId
 */
async function cmdTriageRun(cwd, runId) {
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('triage run: no run context — set GSD_RUN_ID or pass run-id\n');
    process.exit(1);
    return;
  }

  // Verify run dir exists
  const runDirPath = path.join(cwd, '.planning', 'run', effectiveRunId);
  if (!fs.existsSync(runDirPath)) {
    process.stderr.write(`triage run: run directory not found: ${runDirPath}\n`);
    process.exit(1);
    return;
  }

  // Read todos from .planning/todos/pending/*.md
  let todos = [];
  try {
    const todosDir = path.join(cwd, '.planning', 'todos', 'pending');
    if (fs.existsSync(todosDir)) {
      const files = fs.readdirSync(todosDir).filter(f => f.endsWith('.md'));
      todos = files.map(f => {
        const filePath = path.join(todosDir, f);
        const raw = fs.readFileSync(filePath, 'utf8');
        const titleMatch = raw.match(/^title:\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : f.replace('.md', '');
        return { id: f.replace('.md', ''), title, path: filePath };
      });
    }
  } catch (err) {
    process.stderr.write(`triage run: warning — could not read todos: ${err.message}\n`);
  }

  // Read backlog
  const backlog = parseRoadmapBacklog(cwd);
  if (backlog.length === 0) {
    process.stderr.write('triage: no backlog section found in ROADMAP.md; running on todos only\n');
  }

  const allItems = [...todos, ...backlog];

  let appended = 0;
  let failed = 0;

  for (const item of allItems) {
    if (pendingProposalExists(cwd, effectiveRunId, item.title)) {
      process.stdout.write(`triage: skipping duplicate proposal for "${item.title}"\n`);
      continue;
    }

    // Structural default: needs-input proposal.
    // In workflow-driven mode, LLM assigns verdict before calling this.
    const proposal = buildTriageProposal(
      item,
      'needs-input',
      'Awaiting LLM verdict assignment from triage workflow.',
      null
    );
    const jsonString = JSON.stringify(proposal);

    try {
      const { cmdMailboxAppend } = require('./mailbox.cjs');
      cmdMailboxAppend(cwd, effectiveRunId, jsonString);
      appended++;
    } catch (err) {
      process.stderr.write(`triage: mailbox append failed for "${item.title}": ${err.message}\n`);
      failed++;
    }
  }

  process.stdout.write(`triage complete: ${appended} proposals appended, ${failed} failed\n`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  parseRoadmapBacklog,
  buildTriageProposal,
  pendingProposalExists,
  supersedingRecordExists,
  cmdTriageRun,
};
