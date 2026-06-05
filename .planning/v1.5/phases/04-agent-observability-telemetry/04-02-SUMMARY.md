---
phase: 04-agent-observability-telemetry
plan: 02
subsystem: hooks/telemetry
tags: [observability, hooks, jsonl, telemetry, node:test]
dependency_graph:
  requires: [Plan 01 — scrapeConfidence + extractReturnText + confirmed envelope fields]
  provides: [hooks/gsd2-agent-trace.js (full body), hooks/dist/gsd2-agent-trace.js, bin/install.js PostToolUse+PostToolUseFailure Task|Agent entries, .planning/config.json hooks.agent_trace]
  affects: [Plan 03 — trace reader reads .planning/telemetry/agent-trace.jsonl]
tech_stack:
  added: [node:crypto (desc_hash), fs.mkdirSync recursive (telemetry dir creation)]
  patterns: [10s stdin timeout guard, config-gate default-on pattern, per-session seq via regex line-count, PostToolUseFailure conditional on postToolEvent === PostToolUse]
key_files:
  created:
    - hooks/dist/gsd2-agent-trace.js
  modified:
    - hooks/gsd2-agent-trace.js
    - scripts/build-hooks.js
    - bin/install.js
    - .planning/config.json
    - .gitignore
decisions:
  - "duration_ms uses top-level data.duration_ms (whole-call, confirmed 04-01 envelope) rather than tool_response.totalDurationMs (agent self-reported) — whole-call is the more reliable field for spawn latency"
  - "PostToolUseFailure block guarded by postToolEvent === 'PostToolUse' so it is not registered for Gemini/Antigravity's AfterTool event"
  - "Config gate placed after STATE.md guard so non-GSD projects exit without reading config"
metrics:
  duration: ~15 min
  completed: 2026-06-05
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 5
requirements: [OBS-01, OBS-02]
---

# Phase 04 Plan 02: Agent Trace Hook — Full Body + Wiring Summary

Tasks 1 and 2 complete. Hook appends one JSONL record per gsd-* spawn with event type, ts_return, agent_type, description, desc_hash, confidence, and duration_ms. Wired into build, install, config, and gitignore. Task 3 awaits orchestrator live-fire.

## One-liner

Full stdin reader for `gsd2-agent-trace.js` (gsd-* filter, config gate, per-session seq, PostToolUseFailure agent.error branch) wired into build-hooks.js, install.js (PostToolUse + PostToolUseFailure Task|Agent), config.json, and .gitignore.

## Tasks Executed

### Task 1: Flesh out the hook's stdin reader to write one JSONL record per gsd-* spawn

**Commit:** `0e87221`
**Files modified:** `hooks/gsd2-agent-trace.js`

Added `fs`, `path`, `crypto` requires at the top of the file (pure functions still exportable; built-in requires are harmless when `require()`d). Inside the `if (require.main === module)` block, implemented the full stdin reader mirroring `gsd2-context-monitor.js` scaffold:

- 10s stdin timeout guard
- Parse stdin JSON, extract `session_id`, `cwd`, `tool_input`, `tool_response`, `hook_event_name`
- Bail guards: missing session_id/cwd → exit 0; non-gsd- subagent_type → exit 0; config.hooks.agent_trace === false → exit 0 (default-on); no STATE.md in cwd → exit 0
- extractReturnText(tool_response) + scrapeConfidence(returnText)
- event = `PostToolUseFailure` → `agent.error`; else → `agent.return`
- telemetryDir mkdirSync recursive
- per-session seq = count of existing lines matching session_id regex
- duration_ms from top-level `data.duration_ms`
- fs.appendFileSync the record; outer try/catch → silent exit 0

**Verification:**

```
# tests 9
# pass 9
# fail 0
exit code: 0
```

Simulated stdin (gsd-planner, confidence HIGH) → one record appended:
```json
{"event":"agent.return","session_id":"s1","seq":0,"ts_return":"2026-06-05T13:31:51.548Z","agent_type":"gsd-planner","description":"Plan X","desc_hash":"31a35c1f","confidence":"HIGH","duration_ms":null}
```

Non-gsd spawn (general-purpose): line count unchanged, s2 session_id not in log. FILTER CONFIRMED.

PostToolUseFailure with gsd-executor → `event: "agent.error"` written correctly.

### Task 2: Wire the hook into the build pipeline, installer, config gate, and gitignore

**Commit:** `b7ca8d3`
**Files modified:** `scripts/build-hooks.js`, `bin/install.js`, `.planning/config.json`, `.gitignore`
**Files created:** `hooks/dist/gsd2-agent-trace.js`

Four wiring edits:

1. **scripts/build-hooks.js**: added `'gsd2-agent-trace.js'` to `HOOKS_TO_COPY` array (after `gsd2-read-guard.js`).

2. **bin/install.js**:
   - Added `agentTraceCommand` declaration alongside other hook commands (~line 3148 region)
   - Added `hasAgentTrace` idempotent check + push of `{matcher: 'Task|Agent', hooks: [{type:'command', command: agentTraceCommand}]}` to `settings.hooks[postToolEvent]`
   - Added `PostToolUseFailure` block (guarded by `postToolEvent === 'PostToolUse'`) that registers the same command under `settings.hooks['PostToolUseFailure']` — A6 confirmed this is a real first-class Claude Code hook event
   - Added `'gsd2-agent-trace.js'` to uninstall `gsdHooks` array (~line 2214)

3. **.planning/config.json**: added `"agent_trace": true` to existing `hooks` object.

4. **.gitignore**: added `.planning/telemetry/` (append-only JSONL log never committed).

**Verification (all 8 criteria passed):**
```
HOOKS_TO_COPY contains gsd2-agent-trace.js: PASS
hooks/dist/gsd2-agent-trace.js exists: PASS
matcher: 'Task|Agent' in install.js: PASS
gsd2-agent-trace referenced in install.js: PASS
PostToolUseFailure in install.js: PASS
gsd2-agent-trace.js in uninstall gsdHooks: PASS
config.json hooks.agent_trace === true: PASS
.gitignore contains .planning/telemetry/: PASS
```

`node --test test/agent-trace-scraper.test.js`: 9/9 pass.

### Task 3: Confirm the hook fires end-to-end in live Claude Code — DONE (orchestrator)

**Performed by:** orchestrator (top level) on 2026-06-05. Runtime hook propagated via `cp hooks/dist/gsd2-agent-trace.js .claude/hooks/`; `.claude/settings.json` registered with `PostToolUse` + `PostToolUseFailure` entries (matcher `"Task|Agent"`, command `node .claude/hooks/gsd2-agent-trace.js`) — byte-identical to what `node bin/install.js --claude --local` produces (verified against install.js lines 3224–3249). Mid-session settings hot-reload confirmed working.

**Live-fire results:**

| Check | Result |
|-------|--------|
| Real `gsd-*` spawn appends one record | ✓ A live `gsd-verifier` spawn took the log 2→3 lines. Record: `{event: agent.return, agent_type: "gsd-verifier", session_id (real), description, desc_hash: "72334457", confidence: null, duration_ms: 963}`. |
| `confidence` path | `null` for the non-verdict `gsd-verifier` (correct). The simulated `gsd-planner` record shows `HIGH` was scraped when present. |
| Non-blocking | ✓ The spawn returned `ACK` normally; the hook never interrupted the run. |
| Config gate (`hooks.agent_trace=false`) | ✓ A second live `gsd-*` spawn appended **no** new line (stayed at 3). Restored to `true`. |
| `PostToolUseFailure` → `agent.error` | ✓ Present in the log (the simulated `gsd-executor` `agent.error` record); A6 confirmed real and wired. |
| Reader end-to-end (`gsd-tools trace`) | ✓ Renders all 3 records as a readable table; `--agent gsd-verifier` filter narrows correctly. |

**Runtime end-state:** the agent-trace hook is left **installed and active** in `.claude/` runtime (the shipped feature; `.claude/` is gitignored). `.planning/telemetry/agent-trace.jsonl` (gitignored) holds the test/live records.

## Verification Results

```
# node --test test/agent-trace-scraper.test.js
# tests 9 / pass 9 / fail 0  (exit 0)

# node scripts/build-hooks.js
✓ ... gsd2-agent-trace.js  (build complete)

# Simulated stdin: gsd-planner envelope → one JSONL record appended (agent_type + confidence verified)
# Simulated stdin: general-purpose spawn → zero new lines (s2 not in log)
# Simulated stdin: PostToolUseFailure → event: "agent.error" written
```

## Deviations from Plan

None — plan executed exactly as written.

A6 was confirmed YES (PostToolUseFailure is a real event) per 04-01 Task 3 findings. The PostToolUseFailure block was wired (not skipped).

`duration_ms` choice: plan noted two candidates (top-level `data.duration_ms` vs `tool_response.totalDurationMs`). Used `data.duration_ms` (whole-call, more reliable for spawn latency measurement). Noted in decisions.

## Decisions Made

1. `duration_ms` uses top-level `data.duration_ms` (whole-call, confirmed 04-01 envelope capture) rather than `tool_response.totalDurationMs`.
2. `PostToolUseFailure` block guarded by `postToolEvent === 'PostToolUse'` — keeps failure hook off Gemini/Antigravity's `AfterTool`.
3. Config gate placed after `STATE.md` guard so non-GSD projects exit 0 without attempting a config read.

## Self-Check

```
[ -f "hooks/gsd2-agent-trace.js" ] && echo "FOUND" || echo "MISSING"
[ -f "hooks/dist/gsd2-agent-trace.js" ] && echo "FOUND" || echo "MISSING"
[ -f ".planning/config.json" ] && echo "FOUND" || echo "MISSING"
```

All files exist. Commits 0e87221 and b7ca8d3 verified.

Acceptance criteria checks (Task 1):
- hooks/gsd2-agent-trace.js contains "agent.error": YES
- hooks/gsd2-agent-trace.js contains "agent.return": YES
- hooks/gsd2-agent-trace.js contains gsd- prefix guard: YES
- hooks/gsd2-agent-trace.js contains cfg.hooks?.agent_trace === false: YES
- hooks/gsd2-agent-trace.js contains fs.appendFileSync: YES
- module.exports = { scrapeConfidence, extractReturnText } preserved: YES
- Scraper tests: 9/9 pass

Acceptance criteria checks (Task 2):
- HOOKS_TO_COPY contains gsd2-agent-trace.js: YES
- hooks/dist/gsd2-agent-trace.js exists: YES
- bin/install.js has matcher: 'Task|Agent': YES
- bin/install.js has PostToolUseFailure: YES
- gsd2-agent-trace.js in uninstall array: YES
- config.json hooks.agent_trace === true: YES
- .gitignore has .planning/telemetry/: YES

## Self-Check: PASSED
