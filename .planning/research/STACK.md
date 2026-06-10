# Stack Research: v1.6 Autonomous Supervision Harness

**Domain:** GSD framework extension — supervision harness for autonomous multi-session oversight
**Researched:** 2026-06-10
**Confidence:** HIGH (all claims verified against local installed claude binary, existing gsd-tools.cjs codebase, package.json, and live CLI introspection)

---

## Constraint Recap

GSD is dependency-free Node.js CJS. No new npm runtime dependencies unless the case is airtight. Every new mechanism must integrate with the existing `gsd-tools.cjs` + hooks + workflow pattern.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js built-ins (`fs`, `path`, `child_process`, `crypto`) | >=20.0.0 (already required) | JSONL ledger I/O, mailbox file ops, headless process spawning | Zero new deps; `fs.appendFileSync` is the proven JSONL pattern already used in `lesson.cjs`, `agent-trace.js`. `child_process.spawn` is how `gsd2-check-update.js` already runs detached background processes. |
| `claude -p --output-format json` | 2.1.172+ (installed, verified) | Headless single-turn invocations — evaluator verdicts, triage worker, discussion lens | `-p` exits after response; `--output-format json` gives structured `{result, session_id, total_cost_usd, stop_reason, is_error}`. Existing `review.md` already uses `claude -p` in shell snippets. The `--permission-mode bypassPermissions` flag enables unattended execution. |
| `claude -p --output-format stream-json` | 2.1.172+ (installed) | Overnight runner monitoring — stream events as they arrive for progress visibility | Each turn emits JSONL chunks; `--include-partial-messages` adds streaming chunks. Supervisor can tail-pipe into a log file with zero buffering issues. |
| System cron (`crontab`) | Native OS (verified: `/usr/bin/crontab`, active cron exists) | Overnight runner scheduling | System cron is already in use on this machine. No node-cron dependency needed — shell wrapper + `crontab` entry is the right surface for overnight scheduling in a framework that is otherwise stateless between sessions. |

### Supporting Libraries (Node built-ins only — no npm installs)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` — `appendFileSync` | built-in | Append-only JSONL writes to `DECISIONS.jsonl`, `INBOX.jsonl` | Every ledger write — matches existing `lesson.cjs` and `gsd2-agent-trace.js` pattern exactly |
| `node:fs` — `readFileSync` + line-split | built-in | Read ledger files for inbox review, triage, evaluator context | Same read pattern as `readLessons()` and `readTrace()` — already battle-tested with malformed-line skip |
| `node:fs` — `writeFileSync` | built-in | Atomic overwrite for mailbox item status updates (parked → answered) | Use for status mutation on mailbox items; never on append-only ledgers |
| `node:child_process` — `spawn` with `detached: true` + `unref()` | built-in | Fire-and-forget overnight runner, non-blocking headless phase runs | Same pattern as `gsd2-check-update.js` background spawn — parent exits immediately, child runs independently |
| `node:child_process` — `spawnSync` | built-in | Synchronous evaluator verdict calls within a phase loop (blocking is correct here) | Used by `worktree.cjs` for git commands; correct when the caller must wait for the verdict before proceeding |
| `node:crypto` — `randomUUID` | built-in | Generate run IDs for mailbox items and decision records | Consistent with `agent-trace.js` which already uses `crypto` for `desc_hash` |

### Claude Code Primitives to Build On

| Primitive | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| `Stop` hook | 2.1.172+ (verified in binary strings) | Fires when an interactive session ends naturally — drain ledger, write run summary | `Stop` fires at orchestrator level; `SubagentStop` fires for spawned subagents. The supervisor hook listens to `Stop` to finalize a run's `DECISIONS.jsonl` and update run status. |
| `PostToolUse` hook (`matcher: Task\|Agent`) | Already in use (Phase 4) | Intercept agent completions to auto-append decision records with confidence verdict | Already wired via `gsd2-agent-trace.js`. The decision ledger hook can coexist alongside it, using the same `tool_input.subagent_type` filter. |
| `SessionStart` hook | Already in use | On supervisor session start: scan `INBOX.jsonl` for unanswered parked items, surface count to user | Same pattern as `gsd2-check-update.js` — fire-and-forget check at session open. |
| `claude -p --permission-mode bypassPermissions` | 2.1.172+ | Unattended overnight runner — no permission dialogs | `--permission-mode` accepts `bypassPermissions`; equivalent to `--dangerously-skip-permissions` but scoped to the headless run. Only for worktree-isolated overnight runs. |
| `claude --output-format json` result fields | 2.1.172+ (live verified) | `result` (text), `session_id`, `total_cost_usd`, `stop_reason`, `is_error`, `num_turns`, `duration_ms` | These fields are the structured interface between the headless evaluator call and the supervisor's decision-recording logic. `is_error: true` + non-null `api_error_status` means escalate unconditionally. |
| `claude agents --json` | 2.1.172+ | List active background agent sessions for supervisor status dashboard | Returns JSON array of active sessions. Lets the overnight runner check whether a phase agent is still running before spawning a new one. |

---

## Integration With Existing gsd-tools.cjs

New subcommands to add to `gsd-tools.cjs` (same pattern as `lesson`, `trace`, `worktree`):

| New Subcommand | New lib file | What it does |
|----------------|-------------|--------------|
| `ledger append <json>` | `lib/ledger.cjs` | Append one record to `DECISIONS.jsonl` for the current run. Mirrors `lesson append` — same id-allocation + `appendFileSync` pattern. |
| `ledger list [--run R] [--escalated] [--last N]` | `lib/ledger.cjs` | Read + filter decisions. Feed for inbox review command. |
| `mailbox park <json>` | `lib/mailbox.cjs` | Write a parked question to `INBOX.jsonl` with status=`parked`. Returns item ID. |
| `mailbox answer <id> <answer>` | `lib/mailbox.cjs` | Update item status to `answered`, write answer text. |
| `mailbox list [--status parked\|answered\|all]` | `lib/mailbox.cjs` | List inbox items. Used by `/gsd2:inbox` review command. |
| `mailbox resume <id>` | `lib/mailbox.cjs` | Mark item `resumed` after the blocked branch re-reads the answer. |
| `run start` | `lib/run.cjs` | Write `RUN.json` to `.planning/supervisor/` with run metadata (start_ts, phases, run_id). |
| `run status [--field F]` | `lib/run.cjs` | Read `RUN.json`. Headless scripts poll this file to detect if another run is in progress (mutex pattern). |
| `run complete` | `lib/run.cjs` | Mark run done, write end_ts and cost summary into `RUN.json`. |

These extend `gsd-tools.cjs` via the existing dispatch pattern (switch case in the main block) — no new entry points, no new binaries.

---

## File Layout for New Artifacts

```
.planning/supervisor/
  DECISIONS.jsonl         — append-only per-run decision ledger (one JSON record per line)
  INBOX.jsonl             — append-only mailbox; items are never deleted, status field mutates
  RUN.json                — current run state (single JSON file, not JSONL; overwritten per run)
  runs/
    {run_id}-SUMMARY.md   — per-run narrative summary written at run end
```

This follows the exact pattern of `.planning/telemetry/` (append-only JSONL) and `.planning/lessons/` (JSONL + single-record mutations via full-rewrite). The `INBOX.jsonl` uses the `writeLessons`-style rewrite for status mutations since inbox items are bounded in count (unlike trace which is unbounded).

---

## Scheduling: Shell Wrapper + crontab (No node-cron)

The overnight runner is a shell script that calls `node gsd-tools.cjs run start` then `claude -p --permission-mode bypassPermissions "/gsd2:autonomous --from N"` in the worktree, then `node gsd-tools.cjs run complete`. System cron is already active on this machine (verified). A crontab entry like:

```
0 22 * * 1-5 /path/to/.claude/get-shit-done/bin/gsd-overnight.sh >> .planning/supervisor/overnight.log 2>&1
```

is all that is required. `gsd-overnight.sh` is a new 30-line shell script in `bin/` — no Node.js process manager, no daemon, no node-cron dependency.

**Why not node-cron:** node-cron requires a long-running Node.js process. GSD has no daemon. Cron is already the system-level scheduler; using it keeps the harness stateless between runs and avoids process management complexity.

**Why not a Notification hook for scheduling:** The `Notification` hook fires during a Claude Code session — it cannot trigger a new session. It is useful for in-session alerts but not for overnight scheduling.

---

## JSONL Ledger Format

Decision record schema (mirrors `lesson.cjs` and `agent-trace.js` conventions):

```json
{
  "id": "DEC-001",
  "run_id": "uuid-v4",
  "ts": "ISO-8601",
  "phase": 3,
  "agent_type": "gsd-planner",
  "decision": "string — what was decided",
  "alternatives": ["alt1", "alt2"],
  "evidence": "string — rationale",
  "confidence": "HIGH|MEDIUM|LOW",
  "verdict": "proceed|proceed-and-log|park-and-ask",
  "escalated": false,
  "mailbox_id": null
}
```

Mailbox item schema:

```json
{
  "id": "PKD-001",
  "run_id": "uuid-v4",
  "ts_parked": "ISO-8601",
  "ts_answered": null,
  "phase": 3,
  "question": "string",
  "context": "string — why this needs human input",
  "escalation_reason": "irreversibility|security|scope-change|spec-ambiguity",
  "status": "parked|answered|resumed|expired",
  "answer": null,
  "decision_id": "DEC-001"
}
```

The `escalation_reason` enum is the written escalation contract. Evaluators only park when the reason maps to one of these four — all other decisions are `proceed` or `proceed-and-log`.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| System cron + shell wrapper | `node-cron` npm package | GSD is dependency-free; cron is already present and active on this machine; node-cron requires a persistent process |
| `claude -p --output-format json` for headless calls | Claude SDK (npm `@anthropic-ai/sdk`) | SDK is a new npm runtime dependency; `claude -p` is already the CLI-level primitive used in `review.md`; no added capability justifies the dependency |
| Append-only JSONL + `appendFileSync` | SQLite (`better-sqlite3`) | New native dependency with platform-specific builds; JSONL is proven in this codebase (three existing ledgers); query needs are satisfied by JS array filter |
| `INBOX.jsonl` with status mutation via full-rewrite | Separate `INBOX-parked.jsonl` + `INBOX-answered.jsonl` | Two-file scheme complicates `mailbox list` queries; inbox item count is bounded so full-rewrite is not a perf issue; single file matches `lesson.cjs` pattern |
| File-based mailbox (`.planning/supervisor/INBOX.jsonl`) | `WAITING.json` signal (existing) | `WAITING.json` is a binary signal (waiting/not-waiting) for a single blocked question; the mailbox needs to accumulate multiple parked items across phases without blocking the runner |
| `Stop` hook for run finalization | Manual ledger flush in workflow | `Stop` fires reliably at session end; a hook is less forgettable than a manual step in the workflow prose |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node-cron` | New runtime dependency; requires persistent process; system cron already available | System `crontab` + shell wrapper |
| `better-sqlite3` / any SQLite | Native binary dependency; overkill for 3 JSONL files with simple filter queries | `appendFileSync` + `JSON.parse` line-split (existing pattern) |
| `@anthropic-ai/sdk` npm package | Major new runtime dependency; `claude -p` CLI already provides the headless invocation interface at the right abstraction level | `claude -p --output-format json` via `child_process.spawnSync` |
| `chokidar` / `fs.watch` for mailbox polling | Adds a watcher dependency; the runner polls on a known schedule (after each phase), not continuously | Explicit `mailbox list --status parked` check after each phase step |
| `Notification` hook for scheduling | Fires during a session, not between sessions; cannot start a new run | System cron |
| `PreCompact` hook for decision recording | Fires on context compaction, not at decision points; wrong lifecycle event | `PostToolUse` (matcher `Task|Agent`) for agent-level decisions; `Stop` for run finalization |
| A new dedicated supervisor agent (spawned subagent) | Subagents lack Skill/Agent tool grants (confirmed constraint from PROJECT.md); the supervisor cannot be a subagent — it must run at orchestrator level or as a headless `claude -p` process | Top-level session workflow or `claude -p` headless call |

---

## Stack Patterns by Mode

**If running an interactive supervised session (human at keyboard):**
- Supervisor workflow runs at orchestrator level
- Decision ledger writes happen via `gsd-tools ledger append` inside the workflow
- Parked questions surface via `AskUserQuestion` immediately
- Mailbox used only for parked items the human defers ("answer later")

**If running an overnight headless run:**
- `gsd-overnight.sh` calls `claude -p --permission-mode bypassPermissions --output-format json "/gsd2:autonomous --from N"`
- Supervisor reads `--output-format json` result fields after completion
- All parked questions accumulate in `INBOX.jsonl`; human reviews in the morning via `/gsd2:inbox`
- `Stop` hook fires at end of each phase to flush decisions to ledger
- `run start` / `run complete` bracket the run for cost accounting and mutex detection

**If running the evaluator verdict for a single decision:**
- `spawnSync('claude', ['-p', '--output-format', 'json', prompt_text])` from within `gsd-tools.cjs` evaluator logic
- Verdict parsed from `result` field of JSON output
- If `is_error: true`, verdict defaults to `park-and-ask` (fail-safe escalation)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `claude` CLI 2.1.172 | Node.js >=20.0.0 | `--output-format json` and `--permission-mode bypassPermissions` both confirmed present in this version |
| `gsd-tools.cjs` (existing) | Node.js >=20.0.0 | New `ledger.cjs`, `mailbox.cjs`, `run.cjs` follow identical CJS module structure; no compatibility risk |
| System cron | Linux/macOS | crontab present at `/usr/bin/crontab` on this machine; macOS uses launchd natively but `crontab` wrapper works there too |

---

## Sources

- Live `claude --help` introspection — `--permission-mode`, `--output-format`, `--input-format`, `agents --json` flags confirmed present in v2.1.172
- Live `claude -p --output-format json` call — confirmed fields: `type`, `result`, `session_id`, `is_error`, `total_cost_usd`, `stop_reason`, `num_turns`, `duration_ms`, `usage`
- `strings /home/cleversol/.local/share/claude/versions/2.1.172` — confirmed hook event names: `SessionStart`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `Notification`, `PreCompact`
- `gsd-tools.cjs` source — dispatch pattern, existing lib module structure, `lesson.cjs` JSONL read/write API
- `gsd2-agent-trace.js` — `appendFileSync` hook pattern, `tool_input.subagent_type` filter, detached spawn with `unref()`
- `gsd2-check-update.js` — background detached `spawn` + `child.unref()` pattern for fire-and-forget
- `state.cjs` — `WAITING.json` signal pattern (existing single-item mailbox; contrasted with multi-item INBOX)
- `worktree.cjs` — `spawnSync` for synchronous child process calls
- `package.json` (root) — confirmed zero runtime dependencies; `engines.node >= 20.0.0`; `devDependencies` only
- `crontab -l` output — active cron job present on this machine; `/usr/bin/crontab` confirmed

---

*Stack research for: GSD v1.6 Autonomous Supervision Harness*
*Researched: 2026-06-10*
