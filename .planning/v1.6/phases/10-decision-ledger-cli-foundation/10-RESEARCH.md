# Phase 10: Decision Ledger + CLI Foundation - Research

**Researched:** 2026-06-11
**Domain:** Node.js CJS CLI module — JSONL persistence layer, gsd-tools subcommand dispatch
**Confidence:** HIGH (all findings from direct codebase inspection; zero external dependencies)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Run-id signaling (LEDGER-03)**
- Active harness run is signaled by the `GSD_RUN_ID` environment variable — NOT a config key
- Trust-ladder interactive calibration (Phase 11) runs via `GSD_RUN_ID=<id> claude`
- `RUN-META.json` is the run's record (start time, phase list, status), never the detection signal

**Ledger mutability (LEDGER-01)**
- Records are write-once; `appendFileSync` only — no full-file rewrite for DECISIONS.jsonl
- No `ledger patch` command; superseding records reference the original id by convention
- Full-file rewrite (lesson.cjs `writeLessons` pattern) is NOT acceptable for DECISIONS.jsonl

**Out-of-run behavior (LEDGER-03)**
- `gsd-tools ledger append` with no `GSD_RUN_ID` (and no explicit run-id arg resolving to an initialized run): loud error, exit 1
- Silent no-op is explicitly forbidden

**Git posture**
- `.planning/run/` is gitignored (same as `.planning/telemetry/`)

**Schema (LEDGER-01)**
- Required at write time, rejected with clear error if missing: `decision`, `alternatives`, `evidence`, `confidence`, `escalated`
- Auto-filled by the CLI: `id`, `ts`
- Caller-supplied context fields (optional): `phase`, `context`, `question`
- `escalation_verdict` / `escalation_reason` optional in Phase 10 (Phase 11 populates them)
- `escalated` may be `null` only if no evaluator ran — but the field itself must be present
- Mailbox schema: `id, ts, run_id, phase, decision_id, question, context, options, evidence, status, answer, answered_ts`

**Command surface (LEDGER-02)**
- Ships in Phase 10: `ledger append <run-id>`, `ledger list <run-id>`, `ledger filter <run-id> --phase N --escalated`
- Ships in Phase 10: `mailbox append`, `mailbox list` (write/read primitives only)
- Ships in Phase 10: `run init <run-id>` (creates + enforces directory layout)
- Deferred: `mailbox review` / `mailbox answer` interactivity → Phase 12 (PARK-02)

### Claude's Discretion

- Record id format (e.g. `dec-NNN`), run-id slug format, table columns, exact filter flag names, error message wording, test file structure
- Whether `ledger list` and `ledger filter` are one command or two — collapse if simpler

### Deferred Ideas (OUT OF SCOPE)

- `mailbox review`/`answer` interactive inbox — Phase 12
- Escalation evaluator + verdict write — Phase 11
- `autonomous.md:255/276` adaptive triage alignment — Phase 13
- Per-run `agent-trace.jsonl` isolation — Phase 13
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEDGER-01 | Every autonomous decision appended to per-run DECISIONS.jsonl with schema enforced at write time | lesson.cjs append pattern; required-field validation before `appendFileSync` |
| LEDGER-02 | User can read and filter ledger via gsd-tools CLI (by phase, verdict, escalated) | filterLessons pattern directly portable; new `--escalated` boolean filter flag |
| LEDGER-03 | Ledger behavior gated by harness run context; interactive sessions have zero behavior change | `GSD_RUN_ID` env var check in `cmdAppend`; loud error if unset and no initialized run-dir |
</phase_requirements>

---

## Summary

Phase 10 builds two new lib modules (`ledger.cjs`, `mailbox.cjs`) and three new top-level subcommands (`ledger`, `mailbox`, `run`) wired into the existing `gsd-tools.cjs` dispatcher. All patterns already exist in the codebase: `lesson.cjs` is the canonical template for JSONL ledger modules (append/read/filter/format-table), and `trace.cjs` is a second reference confirming the convention. The critical deviation from lesson.cjs is that DECISIONS.jsonl is **strictly append-only** — `writeLessons`-style full-file rewrite is forbidden, and there is no `ledger update/patch` command.

The run-context gate (`GSD_RUN_ID` env var check) is a two-line addition to `cmdLedgerAppend`: if `process.env.GSD_RUN_ID` is absent and no explicit run-id argument resolves to an initialized `.planning/run/{run-id}/` directory, write to stderr and exit 1. This produces zero behavior change for interactive sessions because no workflow outside the harness sets `GSD_RUN_ID`.

The test pattern (node:test, `runGsdTools` helper, `createTempProject` fixture) is already established across 30+ test files in `/tests/`. New `ledger.test.cjs` and `mailbox.test.cjs` follow the identical shape as `lesson.test.cjs`.

**Primary recommendation:** Mirror `lesson.cjs` exactly for `ledger.cjs` and `mailbox.cjs`, with three targeted deviations: (1) no `writeLedger` full-rewrite export, (2) required-field validation before the `appendFileSync` call, (3) `GSD_RUN_ID` env check at the start of `cmdLedgerAppend`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:fs | built-in | `appendFileSync`, `readFileSync`, `mkdirSync` | Already used throughout all lib modules |
| node:path | built-in | Path joining, directory resolution | Used in every lib module |
| node:test | built-in | Unit test runner | Established in all 30+ test files |
| node:assert | built-in | Test assertions | Established in all test files |

No new npm dependencies. All primitives are present.

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Layout

```
get-shit-done/bin/lib/
  ledger.cjs          NEW — DECISIONS.jsonl module
  mailbox.cjs         NEW — MAILBOX.jsonl module

tests/
  ledger.test.cjs     NEW — follows lesson.test.cjs shape
  mailbox.test.cjs    NEW — follows lesson.test.cjs shape

.planning/run/        GITIGNORED (add to .gitignore)
  {run-id}/
    DECISIONS.jsonl   append-only decision ledger
    MAILBOX.jsonl     parked questions
    RUN-META.json     run record (start time, phase list, status)
    parked/           (Phase 13 concern — dir created at run init but not used in Phase 10)
```

### Pattern 1: ledger.cjs Module Shape

Mirrors `lesson.cjs` with three deviations:

```javascript
// Source: get-shit-done/bin/lib/lesson.cjs (direct inspection)
'use strict';
const fs = require('fs');
const path = require('path');

// Path helper — run-scoped (not global like lessons.jsonl)
function ledgerPath(cwd, runId) {
  return path.join(cwd, '.planning', 'run', runId, 'DECISIONS.jsonl');
}

// JSONL read — malformed-line-skipping (identical to readLessons)
function readLedger(cwd, runId) {
  const lp = ledgerPath(cwd, runId);
  if (!fs.existsSync(lp)) return [];
  return fs.readFileSync(lp, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .reduce((acc, line) => {
      try { acc.push(JSON.parse(line)); } catch (_) {}
      return acc;
    }, []);
}

// DEVIATION 1: NO writeLedger / full-file rewrite — append-only
// DEVIATION 2: required-field validation before append
const REQUIRED_FIELDS = ['decision', 'alternatives', 'evidence', 'confidence', 'escalated'];

function cmdLedgerAppend(cwd, runId, jsonString) {
  // DEVIATION 3: GSD_RUN_ID gate
  const envRunId = process.env.GSD_RUN_ID;
  const effectiveRunId = runId || envRunId;
  if (!effectiveRunId) {
    process.stderr.write('ledger append: no run context — set GSD_RUN_ID or pass run-id arg\n');
    process.exit(1);
  }
  const runDir = path.join(cwd, '.planning', 'run', effectiveRunId);
  if (!fs.existsSync(runDir)) {
    process.stderr.write(`ledger append: run not initialized: ${effectiveRunId} (run: gsd-tools run init ${effectiveRunId})\n`);
    process.exit(1);
  }

  let input;
  try { input = JSON.parse(jsonString); } catch (e) {
    process.stderr.write('ledger append: invalid JSON — ' + e.message + '\n');
    process.exit(1);
  }

  // Required-field validation
  const missing = REQUIRED_FIELDS.filter(f => !(f in input));
  if (missing.length > 0) {
    process.stderr.write(`ledger append: missing required fields: ${missing.join(', ')}\n`);
    process.exit(1);
  }

  const records = readLedger(cwd, effectiveRunId);
  const id = nextDecId(records);
  const rec = Object.assign({ phase: null, context: null, question: null,
    escalation_verdict: null, escalation_reason: null }, input, {
    id, ts: new Date().toISOString() });

  fs.appendFileSync(ledgerPath(cwd, effectiveRunId), JSON.stringify(rec) + '\n', 'utf8');
  process.stdout.write(id + '\n');
}
```

### Pattern 2: `run init` Command

```javascript
// Source: lesson.cjs mkdirSync pattern + ARCHITECTURE.md §Component 3 layout
function cmdRunInit(cwd, runId) {
  if (!runId) {
    process.stderr.write('run init: run-id is required\n');
    process.exit(1);
  }
  const runDir = path.join(cwd, '.planning', 'run', runId);
  fs.mkdirSync(path.join(runDir, 'parked'), { recursive: true });

  // Create empty ledger files (touch pattern)
  const decFile = path.join(runDir, 'DECISIONS.jsonl');
  const mbFile = path.join(runDir, 'MAILBOX.jsonl');
  if (!fs.existsSync(decFile)) fs.writeFileSync(decFile, '', 'utf8');
  if (!fs.existsSync(mbFile)) fs.writeFileSync(mbFile, '', 'utf8');

  // Write RUN-META.json
  const meta = { run_id: runId, started_ts: new Date().toISOString(),
    phases: [], status: 'running' };
  fs.writeFileSync(path.join(runDir, 'RUN-META.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  process.stdout.write(`run initialized: .planning/run/${runId}/\n`);
}
```

### Pattern 3: gsd-tools.cjs Dispatch Wiring

```javascript
// Source: gsd-tools.cjs lines 838-896 (lesson case — direct inspection)
// Add require at top alongside other lib requires:
const ledger = require('./lib/ledger.cjs');
const mailbox = require('./lib/mailbox.cjs');

// In main() switch(command):
case 'ledger': {
  const sub = args[1];
  const runId = args[2];  // explicit run-id (may be null — env fallback in lib)
  switch (sub) {
    case 'append': {
      const dataIdx = args.indexOf('--data');
      const jsonString = dataIdx !== -1 ? args[dataIdx + 1] : args[3];
      if (!jsonString) { process.stderr.write('ledger append <run-id> --data <json>\n'); process.exit(1); }
      ledger.cmdLedgerAppend(cwd, runId, jsonString);
      break;
    }
    case 'list': {
      const phaseIdx = args.indexOf('--phase');
      const opts = { phase: phaseIdx !== -1 ? parseInt(args[phaseIdx + 1], 10) : null,
                     escalated: args.includes('--escalated') };
      ledger.cmdLedgerList(cwd, runId, opts, raw);
      break;
    }
    case 'filter': {
      // Collapse into list if simpler — same opts object
      const phaseIdx = args.indexOf('--phase');
      const opts = { phase: phaseIdx !== -1 ? parseInt(args[phaseIdx + 1], 10) : null,
                     escalated: args.includes('--escalated') };
      ledger.cmdLedgerList(cwd, runId, opts, raw);
      break;
    }
    default:
      process.stderr.write(`ledger: unknown subcommand: ${sub}\n`); process.exit(1);
  }
  break;
}

case 'mailbox': {
  const sub = args[1];
  const runId = args[2];
  switch (sub) {
    case 'append': { /* mirrors ledger append */ break; }
    case 'list': {
      const statusIdx = args.indexOf('--status');
      const opts = { status: statusIdx !== -1 ? args[statusIdx + 1] : null };
      mailbox.cmdMailboxList(cwd, runId, opts, raw);
      break;
    }
    default:
      process.stderr.write(`mailbox: unknown subcommand: ${sub}\n`); process.exit(1);
  }
  break;
}

case 'run': {
  const sub = args[1];
  switch (sub) {
    case 'init': {
      const runId = args[2];
      // run init accepts explicit arg OR falls back to GSD_RUN_ID
      const effectiveRunId = runId || process.env.GSD_RUN_ID;
      if (!effectiveRunId) { process.stderr.write('run init: run-id required\n'); process.exit(1); }
      ledger.cmdRunInit(cwd, effectiveRunId);
      break;
    }
    default:
      process.stderr.write(`run: unknown subcommand: ${sub}\n`); process.exit(1);
  }
  break;
}
```

### Pattern 4: ID Allocation

```javascript
// Source: lesson.cjs nextId() — direct inspection
// Adapt prefix from LSN-NNN to dec-NNN (or DEC-NNN)
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
// Mailbox uses: 'q-' + padStart(3, '0')
```

### Anti-Patterns to Avoid

- **Full-file rewrite for DECISIONS.jsonl:** The `writeLessons` export exists in lesson.cjs for the update/bump-recurrence commands. Do NOT export or call an equivalent `writeLedger` — the ledger is append-only. If this function is accidentally added, the audit guarantee is broken on any crash mid-rewrite.
- **Calling `output()` (process.exit(0)) from library functions:** Documented in CONCERNS.md and ARCHITECTURE.md. Library functions (`readLedger`, `filterLedger`) must return data, never call `process.exit`. Only `cmd*` handlers exit.
- **Using config-get/config-set for run signaling:** CONTEXT.md locks this as forbidden. The env var is process-scoped; a config key is tree-global and would be visible to parallel interactive sessions.
- **Writing DECISIONS.jsonl to a global path:** Run-scoped path only (`.planning/run/{run-id}/DECISIONS.jsonl`). A global `.planning/DECISIONS.jsonl` would corrupt audit trails across concurrent runs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL read with malformed-line tolerance | Custom parser | `readLessons` pattern verbatim | Already handles empty lines, parse errors, missing-file case |
| Plain-text table formatting | Custom formatter | `formatTable` pattern verbatim | Column-width auto-sizing already solved |
| ID allocation with padding | Custom counter | `nextId` pattern verbatim | Handles 0-record and gap cases |
| Test project fixtures | Custom temp dir | `createTempProject` + `runGsdTools` from `tests/helpers.cjs` | 30 test files use this; `execFileSync` array form is safe for JSON args with dollar signs |

**Key insight:** This phase is ~95% copy-and-adapt of existing patterns. The value is in the three deliberate deviations (append-only, required-field validation, env-var gate) — those are the load-bearing correctness properties.

---

## Common Pitfalls

### Pitfall 1: Silent no-op outside run context
**What goes wrong:** `ledger append` with no `GSD_RUN_ID` writes to a fallback path or does nothing, making wiring bugs invisible.
**Why it happens:** Easier code path — just skip the write.
**How to avoid:** Exit 1 with a message identifying exactly what's missing (`GSD_RUN_ID not set`, or `run not initialized`). The CONTEXT.md is explicit: "never silently writes to an undefined run."
**Warning signs:** `ledger append` in a test returns exit 0 with empty output when no run dir exists.

### Pitfall 2: Exporting `writeLedger` and using it anywhere
**What goes wrong:** A later phase (evaluator wiring) reaches for a `patchLedger` convenience function and uses `writeLedger` internally, breaking the append-only guarantee.
**Why it happens:** The lesson.cjs template has `writeLessons` — easy to copy accidentally.
**How to avoid:** Do not export any full-rewrite function from `ledger.cjs`. If a superseding record is ever needed, it is a new `appendFileSync` call with a `supersedes` field referencing the original id.

### Pitfall 3: Required-field check done at read time, not write time
**What goes wrong:** The append always succeeds; the read/filter silently skips malformed records. Success criterion 1 explicitly says "schema enforced at write time — missing required fields rejected with a clear error."
**Why it happens:** The malformed-line-skip in `readLedger` could be mistaken for schema enforcement.
**How to avoid:** Required-field check is a `before-appendFileSync` guard in `cmdLedgerAppend`. The malformed-line-skip is a separate, defensive read layer for records that may have been written by older code.

### Pitfall 4: `run init` not enforcing the directory layout
**What goes wrong:** `cmdRunInit` creates the directory but not `DECISIONS.jsonl` and `MAILBOX.jsonl`. The first `ledger append` creates the file, but the `run initialized` output implies readiness — `ledger list` on an empty-but-non-existent file then fails.
**Why it happens:** `mkdirSync` is sufficient for the happy path; file creation is easy to forget.
**How to avoid:** `run init` creates all four items: the `run-id/` dir, `parked/` subdir, empty `DECISIONS.jsonl`, empty `MAILBOX.jsonl`, and `RUN-META.json`. The `ledgerPath` existence check in `cmdLedgerAppend` validates the run was properly initialized.

### Pitfall 5: test env var leaking between test cases
**What goes wrong:** A test that sets `GSD_RUN_ID` via `execFileSync` env option affects subsequent tests if the env is not isolated per-spawn.
**How to avoid:** `runGsdTools` spawns a new process via `execFileSync` — env is inherited from the test process. Pass `GSD_RUN_ID` in the `env` option of `execFileSync` when testing the gated path. The existing `helpers.cjs` `runGsdTools` function accepts an options object; extend it to forward `env` overrides.

---

## Code Examples

### Verified: append-only JSONL write (no rewrite)
```javascript
// Source: lesson.cjs cmdAppend lines 139-143 (direct inspection)
// The ONLY write for DECISIONS.jsonl — appendFileSync, never writeFileSync
fs.appendFileSync(lp, JSON.stringify(rec) + '\n', 'utf8');
process.stdout.write(id + '\n');
```

### Verified: full-file rewrite pattern (DO NOT USE for ledger)
```javascript
// Source: lesson.cjs writeLessons lines 51-56 (direct inspection)
// This pattern is used for lesson update/bump-recurrence — NOT acceptable for DECISIONS.jsonl
function writeLessons(cwd, records) {
  const content = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(lp, content, 'utf8');
}
```

### Verified: filter pattern with multiple opts
```javascript
// Source: lesson.cjs filterLessons lines 65-82 (direct inspection)
// Add escalated filter alongside phase filter:
function filterLedger(records, opts) {
  opts = opts || {};
  let result = records;
  if (opts.phase != null) result = result.filter(r => r.phase === opts.phase);
  if (opts.escalated) result = result.filter(r => r.escalated === true);
  const last = opts.last != null ? opts.last : 50;
  if (result.length > last) result = result.slice(result.length - last);
  return result;
}
```

### Verified: test helper invocation with env var
```javascript
// Source: tests/helpers.cjs runGsdTools lines 18-42 (direct inspection)
// To test GSD_RUN_ID gate — extend helpers.cjs or pass env inline:
const result = execFileSync(process.execPath, [TOOLS_PATH, 'ledger', 'append', runId, '--data', json], {
  cwd: tmp,
  encoding: 'utf-8',
  env: { ...process.env, GSD_RUN_ID: runId },
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

### Verified: run-id slug format
```javascript
// Source: ARCHITECTURE.md §Component 3 (direct inspection)
// Format: {YYYYMMDD}-{slug}, e.g., "20260610-v16-overnight"
// generateSlug already exists in gsd-tools: gsd-tools generate-slug "v16 overnight" → "v16-overnight"
const runId = `${dateStr}-${slug}`;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `config-set harness.run_id` (ARCHITECTURE.md assumption) | `GSD_RUN_ID` env var | Phase 10 CONTEXT.md decision (2026-06-11) | ARCHITECTURE.md's overnight.md step 4 is now stale — planner must NOT implement `config-set harness.run_id` |
| `ledger patch` for evaluator write-back (ARCHITECTURE.md `patchLedger` sketch) | Append superseding record | Phase 10 CONTEXT.md decision (2026-06-11) | No `cmdLedgerPatch` command ships in Phase 10; `ledger patch` in ARCHITECTURE.md is superseded |

**Deprecated/outdated (in ARCHITECTURE.md):**
- `Step 4: config-set harness.run_id {run-id}` in overnight.md design: superseded — do not implement this step
- `ledger patch <run-id> --id dec-001 --data '{json}'` command sketch: superseded — no patch command

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, no config file needed) |
| Config file | none — runner is `node scripts/run-tests.cjs` |
| Quick run command | `node scripts/run-tests.cjs 2>&1 \| grep -E 'pass\|fail\|ledger\|mailbox'` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEDGER-01 | `ledger append` rejects missing `decision` field | unit | `node scripts/run-tests.cjs 2>&1 \| grep ledger` | Wave 0 |
| LEDGER-01 | `ledger append` rejects missing `confidence` field | unit | same | Wave 0 |
| LEDGER-01 | `ledger append` with all required fields writes one JSONL line | unit | same | Wave 0 |
| LEDGER-01 | Written record has auto-filled `id` (dec-NNN) and `ts` | unit | same | Wave 0 |
| LEDGER-02 | `ledger list <run-id>` returns all entries | unit | same | Wave 0 |
| LEDGER-02 | `ledger filter <run-id> --phase 3` returns only phase-3 entries | unit | same | Wave 0 |
| LEDGER-02 | `ledger filter <run-id> --escalated` returns only `escalated: true` entries | unit | same | Wave 0 |
| LEDGER-03 | `ledger append` with no `GSD_RUN_ID` and no arg exits 1 | unit | same | Wave 0 |
| LEDGER-03 | `ledger append` with initialized run dir succeeds | unit | same | Wave 0 |
| LEDGER-03 | `run init <run-id>` creates dir + DECISIONS.jsonl + MAILBOX.jsonl + RUN-META.json | unit | `node scripts/run-tests.cjs 2>&1 \| grep 'run init'` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd2:verify-work`

### Wave 0 Gaps
- [ ] `tests/ledger.test.cjs` — covers LEDGER-01, LEDGER-02, LEDGER-03 (model: `tests/lesson.test.cjs`)
- [ ] `tests/mailbox.test.cjs` — covers mailbox append, mailbox list (model: `tests/lesson.test.cjs`)
- [ ] `get-shit-done/bin/lib/ledger.cjs` — the implementation (model: `lesson.cjs` with three deviations)
- [ ] `get-shit-done/bin/lib/mailbox.cjs` — the implementation (model: `lesson.cjs`, no write-rewrite)
- [ ] `.gitignore` entry for `.planning/run/`
- [ ] `gsd-tools.cjs` dispatch cases for `ledger`, `mailbox`, `run`

---

## Sources

### Primary (HIGH confidence)
- `get-shit-done/bin/lib/lesson.cjs` — canonical template; direct inspection of all functions
- `get-shit-done/bin/lib/trace.cjs` — second JSONL reference pattern confirming conventions
- `get-shit-done/bin/gsd-tools.cjs` — dispatch structure (lines 838–896 for `lesson` case); confirmed total 903 lines, `default` case at 898
- `tests/lesson.test.cjs` — test pattern template; node:test, helpers.cjs, createTempProject
- `tests/helpers.cjs` — `runGsdTools` (execFileSync array form), `createTempProject` fixtures
- `.planning/v1.6/phases/10-decision-ledger-cli-foundation/10-CONTEXT.md` — all locked decisions
- `.planning/research/ARCHITECTURE.md` — directory layout, schema sketch, component boundaries
- `.planning/research/PITFALLS.md` — Pitfall 5 (tool-grant), Pitfall 6 (unverifiable decisions)
- `.planning/REQUIREMENTS.md` — LEDGER-01/02/03 requirement text
- `.gitignore` — confirmed `.planning/telemetry/` gitignored; `.planning/run/` not yet present (Wave 0 gap)
- `.planning/config.json` — confirmed `nyquist_validation` key absent (treat as enabled)

### Secondary (MEDIUM confidence)
- None required — all findings from direct codebase inspection at HIGH confidence.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all primitives are built-in Node.js
- Architecture patterns: HIGH — direct inspection of lesson.cjs, trace.cjs, gsd-tools.cjs dispatch
- Schema and command surface: HIGH — verbatim from CONTEXT.md locked decisions
- Pitfalls: HIGH — derived from PITFALLS.md (direct codebase analysis) + CONTEXT.md locked rationale
- One stale ARCHITECTURE.md detail flagged: `config-set harness.run_id` and `ledger patch` are superseded by CONTEXT.md decisions

**Research date:** 2026-06-11
**Valid until:** Stable — this phase has no external dependencies and all patterns are internal; valid for the duration of Phase 10 work.
