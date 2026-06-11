# Phase 12: Park-Don't-Block Mailbox - Research

**Researched:** 2026-06-11
**Domain:** Generic (CLI extensions + workflow prose + thin skill)
**Confidence:** HIGH

---

## Summary

Phase 12 is purely additive within an already well-defined architecture. The run directory layout (`parked/` subdir), MAILBOX.jsonl schema (with `status`/`answer`/`answered_ts`), and CLI primitives all exist from Phase 10. The only new code is: `mailbox review` + `mailbox answer` subcommands, a new `park.cjs` module for snapshot writing + hashing, stuck-detection logic, and a thin `/gsd2:inbox` skill. No new npm dependencies are needed — `node:crypto` covers all hashing.

The key integration boundary is Phase 11: the evaluator that emits `park-and-ask` verdicts lives in `discuss-phase.md` `question_triage` (Phase 11 deliverable), but Phase 11 is not yet executed. Phase 12's parking logic fires *after* that evaluator emits a verdict. Research confirmed the exact splice point and what already exists at runtime today.

**Primary recommendation:** Implement parking as two sequential writes (MAILBOX.jsonl append then `parked/phase-{N}.json` write), derive parked state from those artifacts (no third state file), hash with `node:crypto` sha256, and surface stuck-detection flag as an extra column in the existing `ledger list` table output.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Branch-parking state machine (PARK-01)**
- A park writes BOTH artifacts: MAILBOX.jsonl question entry (status `pending`) AND `parked/phase-{N}.json` context snapshot — mailbox entry is human-facing, snapshot is machine-facing resume context [STRONG, specialist-backed]
- Parked state is derivable, not separately tracked: pending mailbox entry + snapshot file present = parked. No third state file [STRONG, specialist-backed]
- Parking fires only under `GSD_RUN_ID` + autonomous mode; interactive sessions keep asking the human directly [STRONG]
- When a phase parks, the phase halts with a clear PARKED outcome; "run continues other work" is runner behavior (Phase 13) — Phase 12 only guarantees parking is non-blocking from the phase's perspective

**Context snapshot contents (PARK-03 staleness substrate)**
- Snapshot fields: phase, blocked-at step, question id, phase_dir, resume instruction, content hashes of `STATE.md` / `ROADMAP.md` / `cross-phase-notes.md` / the phase's CONTEXT.md, git HEAD at park time, timestamp [STRONG, specialist-backed]
- Staleness check at resume: re-hash the same files, list which changed since park, show the git range (`<park-HEAD>..HEAD`) — diff is VISIBLE before replay, it does not auto-block [STRONG]

**Inbox review (PARK-02)**
- `gsd-tools mailbox review <run-id>` ships as the CLI primitive [STRONG]
- PLUS a thin `/gsd2:inbox` skill: Claude presents each parked question with context, evidence, and staleness state, discusses it with the user, records the answer via `mailbox answer` [STRONG, specialist-backed]
- The skill is THIN: reads mailbox and records answers — does not resume branches, replan, or execute (resume handoff is printed, not performed)
- Mailbox answers are recorded in MAILBOX.jsonl only; the ledger gets its superseding record when the branch acts on the answer at resume (Phase 15 wiring) — preserves write-once ledger

**Resume handoff at the prompt level (PARK-03, boundary with Phase 15)**
- Phase 12 ships primitives: snapshot format, staleness-diff command surface, and the inbox (CLI + skill) printing a concrete per-phase resume handoff once its question is answered [STRONG, specialist-backed]
- Resume instruction in the snapshot is concrete enough for a human or Phase 15 to act on

**Stuck detection (PARK-04)**
- Mechanism: hash of DECISIONS.jsonl recorded at phase-boundary snapshots; two consecutive identical hashes → flagged as stuck [STRONG]
- Phase 12 ships the primitive (snapshot-hash recording + comparison) and surfaces the flag in `gsd-tools ledger list` output and `run.log`

### Claude's Discretion

- Exact command names/flags for staleness + stuck primitives (e.g. `run staleness`, `run check-stuck` vs flags on existing commands); where boundary-snapshot hashes are stored (RUN-META.json field vs snapshots file)
- Inbox answer semantics beyond record-answer (skip/defer handling — keep pending vs explicit status), table/output formatting
- `/gsd2:inbox` skill prose, question-presentation format, whether staleness shows per-question or per-session
- parked/phase-{N}.json exact field names; hash algorithm (sha256 via node crypto is the obvious default)
- Test structure (follows Phase 10 unit-test conventions)

### Deferred Ideas (OUT OF SCOPE)

- Actual branch replay / resume execution in autonomous.md — Phase 15
- Runner-side "continue other work while parked," mailbox polling, morning report — Phase 13
- Integrating the morning report into `/gsd2:inbox` as a single morning entry point — Phase 13 follow-up
- Triage-type mailbox entries (six-verdict proposals) flowing through the same inbox — Phase 15

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARK-01 | A park-and-ask verdict appends question + context snapshot to per-run MAILBOX.jsonl; parked branch stops while run continues | `parked/` subdir already created by `cmdRunInit`; `cmdMailboxAppend` exists; snapshot write is additive |
| PARK-02 | User can review and answer all parked questions in one inbox command | `mailbox review` + `mailbox answer` are new handlers on existing `mailbox.cjs` + dispatch; `/gsd2:inbox` thin skill is a new command + workflow file |
| PARK-03 | Answering resumes the parked branch with staleness check — current planning state re-read before replay | Snapshot stores content hashes; staleness check re-hashes and diffs; resume handoff printed (replay is Phase 15) |
| PARK-04 | Stuck detection — identical ledger hash across consecutive snapshots flags the run | DECISIONS.jsonl hash at phase-boundary snapshots; flag surfaces in `ledger list` table and `run.log` |

</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` (built-in) | Node bundled | sha256 hashing for content snapshots + stuck detection | Zero new deps constraint; `createHash('sha256').update(content).digest('hex')` is idiomatic |
| `node:fs` (built-in) | Node bundled | File I/O for snapshot writes, parked/ dir, MAILBOX.jsonl | Already used throughout all `bin/lib/*.cjs` modules |
| `node:path` (built-in) | Node bundled | Path construction | Already used throughout |
| `node:child_process` (built-in) | Node bundled | `git rev-parse HEAD` for park-time git HEAD capture | Already used in worktree.cjs |

### No New npm Dependencies
Zero new packages. All required primitives exist in Node builtins or the project's existing code. This is a locked constraint.

**Installation:** none needed.

**Version verification:** n/a — all node builtins.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
get-shit-done/
  bin/lib/
    park.cjs              # snapshot write, staleness check, stuck detection (pure fns + cmd*)
  workflows/
    inbox.md              # /gsd2:inbox skill workflow prose
commands/gsd2/
  inbox.md                # thin command stub (mirrors discuss-phase.md pattern)
tests/
  park.test.cjs           # unit tests for park.cjs pure functions
```

### Pattern 1: Two-Phase Atomic Park Write

**What:** Write MAILBOX.jsonl entry first (using existing `cmdMailboxAppend`), then write `parked/phase-{N}.json`. Mailbox entry is always written before snapshot; if snapshot write fails, the mailbox entry still records the question (safe degradation — the phase is still considered parked, just without a resume snapshot).

**When to use:** Every time discuss-phase emits a `park-and-ask` verdict under `GSD_RUN_ID` + autonomous context.

**Example:**
```javascript
// Source: mailbox.cjs cmdMailboxAppend pattern (Phase 10)
// Step 1: append to MAILBOX.jsonl
cmdMailboxAppend(cwd, runId, JSON.stringify({
  question, phase, decision_id, context, options, evidence
}));
// q-id is returned

// Step 2: write parked/phase-{N}.json
const snapshot = buildParkSnapshot({ phase, blockedAt, questionId, phaseDir, ... });
fs.writeFileSync(snapshotPath(cwd, runId, phase), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
```

### Pattern 2: Snapshot Content Hashing (node:crypto)

**What:** Hash each planning file's content with sha256. Store hashes in the snapshot at park time. At resume, re-hash the same files and compare — unchanged files are skipped, changed files are listed with their old/new hashes.

**When to use:** Building `parked/phase-{N}.json` snapshot and at resume time for staleness diff.

**Example:**
```javascript
// Source: node:crypto docs; pattern mirrors existing worktree.cjs child_process usage
const crypto = require('node:crypto');
const fs = require('fs');

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function buildContentHashes(cwd, phaseContextPath) {
  return {
    'STATE.md':             hashFile(path.join(cwd, '.planning', 'STATE.md')),
    'ROADMAP.md':           hashFile(path.join(cwd, '.planning', 'ROADMAP.md')),
    'cross-phase-notes.md': hashFile(path.join(cwd, '.planning', 'cross-phase-notes.md')),
    'CONTEXT.md':           hashFile(phaseContextPath),
  };
}
```

### Pattern 3: Stuck Detection via DECISIONS.jsonl Hash

**What:** Hash the full DECISIONS.jsonl content at each phase-boundary snapshot. Compare the current hash to the previous boundary hash. Identical two consecutive hashes → stuck flag.

**Where to store:** RUN-META.json `phase_snapshots` array (each entry: `{phase, ts, decisions_hash}`). RUN-META.json is a mutable JSON file (already written by `cmdRunInit`); it is the natural home for run-level state that is not per-decision.

**Example:**
```javascript
// Phase boundary: hash current DECISIONS.jsonl
function decisionsHash(cwd, runId) {
  const lp = path.join(cwd, '.planning', 'run', runId, 'DECISIONS.jsonl');
  if (!fs.existsSync(lp)) return null;
  const content = fs.readFileSync(lp, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Detect stuck: read last two snapshots from RUN-META.json phase_snapshots
function isStuck(meta) {
  const snaps = (meta.phase_snapshots || []);
  if (snaps.length < 2) return false;
  const last = snaps[snaps.length - 1];
  const prev = snaps[snaps.length - 2];
  return last.decisions_hash !== null && last.decisions_hash === prev.decisions_hash;
}
```

### Pattern 4: mailbox review (Interactive CLI Loop)

**What:** `cmdMailboxReview(cwd, runId)` iterates pending mailbox records, prints each with context/options/evidence, reads stdin for answer, calls the existing `mailbox answer` path to update the record. All pending questions in one loop — no tab-switching.

**When to use:** Human morning inbox session.

**Example:**
```javascript
// Mirrors lesson.cjs cmdUpdate pattern: update record in-place via full file rewrite
// mailbox.cjs already has readMailbox; review extends it with a mutation path
// Note: the mutation here (answering) is the intentional Phase 12 deviation from
// pure append-only — answers supersede the pending entry by updating its fields.
// This is safe: answers are terminal state (no further mutation expected).
function cmdMailboxReview(cwd, runId, readline) {
  const records = readMailbox(cwd, runId);
  const pending = records.filter(r => r.status === 'pending');
  // ... present each, record answer, write full file back
}
```

### Pattern 5: mailbox answer (Targeted Record Update)

**What:** `cmdMailboxAnswer(cwd, runId, qId, answerText)` reads MAILBOX.jsonl, finds the record by id, sets `status: 'answered'`, `answer: answerText`, `answered_ts: now`, writes the full file back. Single-question update path used by `/gsd2:inbox` skill.

**Important deviation from mailbox.cjs append-only posture:** mailbox.cjs is append-only for the *append* command (PARK-01 write), but answers are terminal state mutations — a question can only be answered once. The Phase 10 comment `"Phase 12 fills answer via separate mechanism"` (mailbox.cjs line 8) explicitly anticipates this. Use `writeMailbox` (full file rewrite, like `writeLessons` in lesson.cjs) for the answer update — do NOT use `appendFileSync`.

### Pattern 6: /gsd2:inbox Command + Workflow

**What:** Thin command stub at `commands/gsd2/inbox.md` + workflow prose at `get-shit-done/workflows/inbox.md`. The skill reads mailbox, presents each pending question with context + staleness diff, holds a discussion, records answers via `mailbox answer`. It is the human-facing layer over the CLI primitives.

**Convention:** Follows the exact same structure as `commands/gsd2/discuss-phase.md` (frontmatter with `allowed-tools`, `<objective>`) + `get-shit-done/workflows/discuss-phase.md` (full workflow prose). Synced via `npm run dev`.

### Anti-Patterns to Avoid

- **Third state file for parked:** Parked state is derivable from (pending mailbox entry AND snapshot file present). No `parked-state.json` or similar. Derivable state avoids sync bugs.
- **Blocking on mailbox during phase execution:** Phase 12 writes the question and halts the phase. The runner (Phase 13) handles continuing other work. Phase 12 must not attempt to poll or wait.
- **Full rewrite of MAILBOX.jsonl for appends:** `cmdMailboxAppend` uses `appendFileSync` — never rewrite the file for new questions. Only the answer-update path uses full rewrite.
- **Storing stuck flag in a separate file:** The stuck flag belongs in `ledger list` output (existing display surface) and `run.log` (runner artifact). A separate flag file adds a sync surface.
- **Running git operations in pure functions:** The `git rev-parse HEAD` call for park-time git HEAD must be in a `cmd*` handler or the workflow, not in an exported pure function. Pure functions must be testable without git.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Content hashing | Custom hash implementation | `node:crypto` `createHash('sha256')` | Built-in, zero deps, deterministic |
| JSONL read with malformed-line tolerance | Custom parser | `readMailbox` from `mailbox.cjs` (already exists) | Handles the skip-bad-lines case, already tested |
| ID allocation for q-NNN | Custom counter | `nextQId` from `mailbox.cjs` (already exists) | Monotonic, tested, handles gaps |
| Run directory layout creation | Custom mkdir logic | `cmdRunInit` from `ledger.cjs` (already creates `parked/` subdir) | Already creates `parked/`, DECISIONS.jsonl, MAILBOX.jsonl, RUN-META.json |
| Table formatting for review output | Custom table formatter | `formatTable` from `mailbox.cjs` or `lesson.cjs` pattern | Consistent with `ledger list` / `mailbox list` output |

**Key insight:** The Phase 10 implementation deliberately left hooks for Phase 12. `mailbox.cjs` line 8 says `"Phase 12 fills answer via separate mechanism"`. `cmdRunInit` already creates `parked/`. The schema already has `answer`/`answered_ts`/`status` fields. Phase 12 is completing a planned extension, not building from scratch.

---

## Common Pitfalls

### Pitfall 1: Phase 11 Integration Points Are Not Yet Real

**What goes wrong:** Planning or implementing the park trigger assuming Phase 11's evaluator already exists in `discuss-phase.md`. Phase 11 has a CONTEXT.md but its plans are not yet executed (STATE.md: "Phase 11 — EXECUTING"). The `park-and-ask` verdict pathway in `question_triage` does not yet exist in the actual workflow file.

**Why it happens:** The CONTEXT.md and ARCHITECTURE.md describe the final state; `discuss-phase.md` is the current real state.

**How to avoid:** Phase 12's deliverables are the parking primitives (CLI + snapshot + stuck detection + inbox). The wiring into `discuss-phase.md`'s `question_triage` park branch is Phase 11's deliverable. Phase 12 plans should treat the evaluator as an integration point to splice into after Phase 11 ships, OR include the minimal splice that calls the Phase 12 primitives (write MAILBOX.jsonl + write snapshot). Clarify scope boundary explicitly in each plan's task list.

**Warning signs:** A task that says "modify question_triage to emit park-and-ask" — that's Phase 11. A task that says "write snapshot + mailbox entry when a park-and-ask verdict is received" — that's Phase 12.

### Pitfall 2: mailbox status field collision ('open' vs 'pending')

**What goes wrong:** Existing `mailbox.cjs` defaults `status: 'open'` (line 199). The ARCHITECTURE.md and CONTEXT.md use `status: 'pending'` for parked questions. If Phase 12 uses 'pending' without updating the existing tests/schema docs, `mailbox list --status open` will miss parked questions, and the `filterMailbox` logic won't work as expected.

**Why it happens:** The schema was sketched in ARCHITECTURE.md with 'pending' before the Phase 10 implementation chose 'open' as the default.

**How to avoid:** Decide on one status value for new-question state. Options: (a) use 'pending' for parking (distinct from manually-appended 'open' entries), or (b) change the park write to use 'open' to match existing defaults, or (c) document that 'pending' and 'open' are equivalent in the inbox filter. The planner must make this explicit — the existing test at `mailbox.test.cjs:269` seeds records with `status: 'open'` and tests `--status open` filtering.

**Warning signs:** `mailbox list --status pending` returning 0 results when parked questions exist.

### Pitfall 3: Full-File Rewrite Corrupts MAILBOX.jsonl Under Concurrent Writes

**What goes wrong:** Two phases park concurrently (Phase 13 scenario), both read MAILBOX.jsonl, both write it back after appending their question. The second write overwrites the first.

**Why it happens:** `mailbox answer` needs full-file rewrite to update a record. If parking also uses rewrite (instead of `appendFileSync`), concurrent parks are unsafe.

**How to avoid:** Parking (new question append) ALWAYS uses `appendFileSync`. Only answer/review updates use full rewrite. Document this invariant in `park.cjs` header comments. Phase 13 will need to sequence mailbox writes across phases; Phase 12 must not introduce rewrite on the append path.

**Warning signs:** Missing questions in MAILBOX.jsonl when multiple phases park in the same run.

### Pitfall 4: git rev-parse HEAD Fails in Non-Git Directories

**What goes wrong:** Snapshot building calls `git rev-parse HEAD` to capture park-time git HEAD. In CI or temp test dirs, this fails and crashes snapshot creation.

**Why it happens:** Tests create temp dirs that are not git repos.

**How to avoid:** Wrap `git rev-parse HEAD` in a try/catch; default to `null` on failure. Pure functions that build snapshots take `gitHead` as a parameter (passed in by `cmd*` handler that resolves it). This keeps pure functions testable without git.

**Warning signs:** Tests for `buildParkSnapshot` failing with "not a git repository" errors.

### Pitfall 5: Stuck Detection Hash Computed Too Early

**What goes wrong:** The DECISIONS.jsonl hash is computed before the phase's decisions are appended (at phase start rather than phase boundary), so every consecutive hash is identical even when decisions are being made.

**Why it happens:** "Phase boundary" is ambiguous — is it start or end?

**How to avoid:** The hash is recorded at phase **completion** (the boundary after the phase finishes). "Two consecutive identical hashes" means phase N completed with the same ledger content as phase N-1 completed with. Document this explicitly in the `park.cjs` snapshot API.

**Warning signs:** Every run immediately shows `stuck: true` after the first two phases.

---

## Code Examples

Verified patterns from existing source files:

### Snapshot Path Convention

```javascript
// Source: ledger.cjs runDir() + cmdRunInit() parked/ creation
function snapshotPath(cwd, runId, phaseNum) {
  return path.join(cwd, '.planning', 'run', runId, 'parked', `phase-${phaseNum}.json`);
}
// parked/ subdir already created by cmdRunInit — no mkdir needed
```

### RUN-META.json Read/Write Pattern

```javascript
// Source: ledger.cjs cmdRunInit() — RUN-META.json is already written there
// For phase_snapshots append:
function appendPhaseSnapshot(cwd, runId, snap) {
  const metaPath = path.join(cwd, '.planning', 'run', runId, 'RUN-META.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.phase_snapshots = meta.phase_snapshots || [];
  meta.phase_snapshots.push(snap);
  if (isStuck(meta)) meta.stuck = true;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
}
```

### mailbox answer Update Pattern

```javascript
// Source: lesson.cjs writeLessons() + cmdUpdate() — same full-rewrite-for-update pattern
function cmdMailboxAnswer(cwd, runId, qId, answerText) {
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  // ... gate check ...
  const records = readMailbox(cwd, effectiveRunId);
  const idx = records.findIndex(r => r.id === qId);
  if (idx === -1) { process.stderr.write(`mailbox answer: question not found: ${qId}\n`); process.exit(1); }
  records[idx] = Object.assign({}, records[idx], {
    status: 'answered',
    answer: answerText,
    answered_ts: new Date().toISOString(),
  });
  // Full rewrite — safe for answer (terminal state, not concurrent with appends)
  const mp = mailboxPath(cwd, effectiveRunId);
  fs.writeFileSync(mp, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  process.stdout.write(qId + '\n');
}
```

### gsd-tools.cjs Dispatch Extension Pattern

```javascript
// Source: gsd-tools.cjs mailbox case (lines 943-982) — extend by adding new sub-cases
case 'mailbox': {
  const sub = args[1];
  switch (sub) {
    case 'append': { /* existing */ break; }
    case 'list': { /* existing */ break; }
    case 'review': {
      // mailbox review <run-id>
      mailbox.cmdMailboxReview(cwd, runId);
      break;
    }
    case 'answer': {
      // mailbox answer <run-id> --id q-001 --answer "text"
      const idIdx = args.indexOf('--id');
      const answerIdx = args.indexOf('--answer');
      mailbox.cmdMailboxAnswer(cwd, runId,
        idIdx !== -1 ? args[idIdx + 1] : null,
        answerIdx !== -1 ? args[answerIdx + 1] : null
      );
      break;
    }
    default: process.stderr.write(`mailbox: unknown subcommand\n`); process.exit(1);
  }
  break;
}
```

---

## State of the Art (Integration Boundary Map)

| Component | Today (pre-Phase 11) | After Phase 11 | After Phase 12 |
|-----------|---------------------|----------------|----------------|
| `discuss-phase.md` question_triage | resolution loop only | + evaluator sub-step emitting park-and-ask verdict | + park branch calls mailbox append + snapshot write |
| `mailbox.cjs` | append + list only | unchanged | + review + answer handlers |
| `ledger.cjs` | append + list + run init | unchanged | + phase-boundary snapshot hash recording |
| `parked/` dir | created by `cmdRunInit`, unused | unchanged | populated by Phase 12 |
| `RUN-META.json` | `run_id`, `started_ts`, `phases`, `status` | unchanged | + `phase_snapshots[]` + `stuck` flag |
| Stuck detection | nonexistent | nonexistent | available as `ledger list --stuck` flag |
| Human inbox | none | none | `mailbox review` CLI + `/gsd2:inbox` skill |

**Phase 11 items NOT yet executed (Phase 12 must treat as future integration points):**
- Evaluator sub-step in `discuss-phase.md` `question_triage`
- `escalation-contract.md` reference doc
- `11-CALIBRATION.md` gate file

Phase 12 can implement the parking primitives without requiring Phase 11 to be complete first, provided the park trigger is either a stub or wired after Phase 11 delivers the evaluator. Plan waves should reflect this: Wave 1 = pure parking primitives (no workflow wiring), Wave 2 = workflow splice + inbox skill.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no jest/mocha) |
| Config file | `scripts/run-tests.cjs` — auto-discovers `tests/*.test.cjs` |
| Quick run command | `npm test` |
| Full suite command | `npm test` (runs all `tests/*.test.cjs` sorted alphabetically) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARK-01 | Park writes MAILBOX.jsonl entry + parked/phase-{N}.json snapshot | unit | `npm test` (park.test.cjs) | Wave 0 |
| PARK-01 | Parking fires only under GSD_RUN_ID + autonomous; interactive no-ops | unit | `npm test` (park.test.cjs) | Wave 0 |
| PARK-02 | `mailbox review` presents pending questions, accepts answer, records it | unit | `npm test` (mailbox.test.cjs extension) | Extend existing |
| PARK-02 | `mailbox answer` updates status/answer/answered_ts | unit | `npm test` (mailbox.test.cjs extension) | Extend existing |
| PARK-03 | buildParkSnapshot produces correct field set with content hashes | unit | `npm test` (park.test.cjs) | Wave 0 |
| PARK-03 | stalenessCheck returns correct changed/unchanged diff | unit | `npm test` (park.test.cjs) | Wave 0 |
| PARK-04 | decisionsHash produces deterministic sha256 | unit | `npm test` (park.test.cjs) | Wave 0 |
| PARK-04 | isStuck returns true on two consecutive identical hashes | unit | `npm test` (park.test.cjs) | Wave 0 |
| PARK-04 | Stuck flag visible in `ledger list` output | integration | `npm test` (park.test.cjs or ledger extension) | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd2:verify-work`

### Wave 0 Gaps
- [ ] `tests/park.test.cjs` — covers PARK-01 snapshot write, PARK-03 staleness, PARK-04 stuck detection
- [ ] `get-shit-done/bin/lib/park.cjs` — pure functions + cmd* handlers (stub for TDD)

*(Extending `tests/mailbox.test.cjs` for review/answer does NOT require a new file — add test cases to the existing file)*

---

## Open Questions

1. **'pending' vs 'open' status for new parked questions**
   - What we know: `cmdMailboxAppend` defaults `status: 'open'` (mailbox.cjs:199). ARCHITECTURE.md sketches use 'pending'. CONTEXT.md uses 'pending'.
   - What's unclear: Whether Phase 12 should change the default to 'pending', use 'pending' only for parked entries (passing it as caller input), or keep 'open' and treat them as equivalent.
   - Recommendation: Use 'pending' as the status for park-written entries (passed explicitly in the append JSON) and document that 'open' is for manually-appended entries without a snapshot. The `filterMailbox` status filter matches on the passed value — no code change needed to support both.

2. **Where to surface the stuck flag on `ledger list`**
   - What we know: `ledger list` currently shows id/ts/phase/confidence/escalated columns. `formatTable` in ledger.cjs generates the table. RUN-META.json holds the stuck flag.
   - What's unclear: Whether to add a `stuck` column per-run (requires reading RUN-META.json in `cmdLedgerList`) or emit a header warning line above the table when `stuck: true`.
   - Recommendation: Header warning line — "STUCK FLAG: run {run-id} — ledger unchanged across last 2 phase boundaries". This avoids modifying the per-record table schema and keeps the flag high-visibility.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `get-shit-done/bin/lib/mailbox.cjs` — full source read, schema confirmed, Phase 12 hook comment at line 8 confirmed
- Direct inspection of `get-shit-done/bin/lib/ledger.cjs` — `cmdRunInit` creates `parked/` at line 161, RUN-META.json schema confirmed
- Direct inspection of `get-shit-done/bin/gsd-tools.cjs` — dispatch table, mailbox/ledger/run sub-cases confirmed, extension pattern documented
- Direct inspection of `tests/mailbox.test.cjs` — test infrastructure confirmed (node:test, helpers.cjs, temp project pattern)
- Direct inspection of `.planning/v1.6/phases/12-park-don-t-block-mailbox/12-CONTEXT.md` — all locked decisions
- Direct inspection of `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CONTEXT.md` — Phase 11 boundary confirmed; evaluator wiring deferred to Phase 11
- Direct inspection of `.planning/research/ARCHITECTURE.md` §Component 3 — directory layout, MAILBOX schema, parked/ resume flow

### Secondary (MEDIUM confidence)
- `scripts/run-tests.cjs` — test runner mechanics confirmed (auto-discovers tests/*.test.cjs, node --test)
- `.planning/config.json` — `workflow.nyquist_validation: true` confirmed; validation section required

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are Node builtins already used in the project
- Architecture: HIGH — Phase 10 code directly read; extension points pre-wired; patterns verified from lesson.cjs/mailbox.cjs/ledger.cjs
- Pitfalls: HIGH — status field collision and concurrent-write risks identified from direct source inspection
- Phase 11 boundary: HIGH — confirmed not yet executed from STATE.md; integration point clearly scoped

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable; only invalidated if Phase 10/11 code changes before Phase 12 plans)
