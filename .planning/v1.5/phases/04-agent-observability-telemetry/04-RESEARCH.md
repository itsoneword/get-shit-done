# Phase 4: Agent Observability & Telemetry — Research

**Researched:** 2026-06-05
**Domain:** Claude Code hook instrumentation / Node.js telemetry
**Confidence:** MEDIUM (primary API fields unverifiable from docs alone — see Open Technical Questions)

---

## Summary

Phase 4 adds a `PostToolUse(Task)` hook (`gsd2-agent-trace.js`) that appends a JSONL record to `.planning/telemetry/agent-trace.jsonl` for every `gsd-*` subagent spawn. It also adds a minimal `gsd-tools trace` subcommand (tail + filter). The mechanism is fully code/config-side: zero workflow or agent `.md` files change.

The research confirmed the locked mechanism is correct: `PostToolUse` with `matcher:"Task"` is the only hook event that receives BOTH the spawn input (`tool_input.description`, `.subagent_type`) AND the return text (`tool_response` containing the confidence verdict). `SubagentStart`/`SubagentStop` hooks, while purpose-built for lifecycle events, do NOT carry return text and therefore cannot satisfy OBS-02.

The central open question — the exact field name for return text inside `tool_response` — could not be authoritatively confirmed from official docs alone. The docs confirm the shape at a high level (`tool_response` is an object with tool-specific fields) and an independent deep-dive transcript confirmed that the internal transcript representation uses a `content: [{type:"text", text:"..."}]` array. The hook payload may use a top-level `result` string field (supported by a third-party schema gist) or may match the transcript shape. A Wave-0 echo-stdin hook is mandated as the first task to empirically resolve this before writing the scraper logic.

**Primary recommendation:** Implement a single `PostToolUse(Task)` record per spawn (description + subagent_type + scraped confidence + timestamp). Add `PostToolUseFailure(Task)` as a separate entry for error/crash capture. Skip PreToolUse — the timestamp objection is neutralized by the `duration_ms` field in tool_response.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Claude Code hook, `matcher: "Task"`, modeled on `hooks/gsd2-context-monitor.js`. [STRONG — roadmap-locked]
- Observability in **code/config, never in prompts** — zero changes to any workflow/agent `.md`. [STRONG — explicit user requirement, roadmap-locked]
- Best-effort, non-blocking: a hook failure never interrupts the agent run; degrades cleanly (silently) in runtimes without hook support (Copilot/Gemini). [STRONG — roadmap-locked, SC#3]
- Log only `gsd-*` subagent spawns (filter by subagent_type). [STRONG — OBS-01 / SC#1]
- Log location: `.planning/telemetry/agent-trace.jsonl` [WEAK — accepted]
- Reader: `gsd-tools trace` (tail + filter by event/agent-type/session) [WEAK — accepted]
- Append-only, no rotation [WEAK — accepted]
- Default-on via `config.hooks.agent_trace` [WEAK — accepted]

### Deferred (OUT OF SCOPE)
- Full pretty-printer / timeline / correlation-grouping reader view
- Per-session log files and size-capped rotation
- Consuming the telemetry signal for stall-detection (Phase 5)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OBS-01 | `PostToolUse` / `matcher:Task` hook logs every `gsd-*` spawn (timestamp, type, context) with zero prompt-file changes | Confirmed: PostToolUse(Task) receives `tool_input.description` and `tool_input.subagent_type`; gsd-* prefix filter provides scope |
| OBS-02 | Telemetry captures confidence verdicts scraped from return text; LOW→re-research visible as correlated timestamped entries; best-effort + non-blocking; minimal reader | Confirmed: confidence lands in return text (two formats documented); correlation by session_id + agent_type + timestamp ordering |

---

## Open Technical Questions — Resolved

### Q1: PostToolUse-only vs PreToolUse+PostToolUse pair

**Recommendation:** Use a single `PostToolUse(Task)` record. Do NOT add PreToolUse. For crash/hang capture, add a `PostToolUseFailure(Task)` hook entry.

**Reasoning:**

1. **OBS-01's wording is correct as written.** `PostToolUse(Task)` fires once at return and receives both `tool_input` (spawn desc/subagent_type) and `tool_response` (return text with confidence). This satisfies both OBS-01 (spawn logging) and OBS-02 (confidence scraping) in a single event.

2. **The "shared timestamp" objection is neutralized.** Transcript evidence shows `tool_response` carries a `duration_ms` field. A single record at return can therefore include both `ts_return` (ISO timestamp when the hook fires) and `duration_ms` — reconstructing `ts_spawn ≈ ts_return - duration_ms`. No PreToolUse needed.

3. **Hung/crashed subagents:** A hung subagent that never returns will never fire PostToolUse. The correct safety net is **`PostToolUseFailure(Task)`** (fires when the tool call errors/times out), NOT PreToolUse. Include a `PostToolUseFailure` entry in `.claude/settings.json` alongside the PostToolUse entry — it writes an `agent.error` event type with whatever partial info is available. This is cleaner than PreToolUse because it matches the same tool failure lifecycle.

4. **SubagentStart/SubagentStop** hooks DO exist (confirmed from official docs) and DO provide `agent_id` for lifecycle correlation, but they carry NO return text. They are irrelevant to OBS-02 and should not be used as primary mechanism.

**OBS-01 wording amendment needed?** No. The locked "PostToolUse, matcher: Task" mechanism is correct. The roadmap two-event schema (`agent.spawn` + `agent.return`) can be collapsed to a single `agent.return` event with a reconstructed spawn timestamp from `duration_ms`.

**Confidence:** HIGH (structural argument; confirmed by SubagentStop docs stating "does not include the subagent's return text")
**Source:** Official docs (code.claude.com/docs/en/hooks), transcript inspection, johnlindquist gist schema

---

### Q2: Confidence scraper format tolerance

**Recommendation:** Apply one tolerant regex over the full return text (stringified). Default to `null` when absent.

**Both confirmed formats:**

1. **Prose** (gsd-phase-researcher micro_research return format):
   ```
   **Confidence:** HIGH
   ```

2. **JSON** (resolution-loop verdict shape):
   ```json
   {"confidence": "HIGH", ...}
   ```

**Single tolerant regex:**
```js
const match = returnText.match(/["']?confidence["']?\s*[=:]\s*["']?\*{0,2}(HIGH|MEDIUM|LOW)\*{0,2}["']?/i);
const confidence = match ? match[1].toUpperCase() : null;
```

This captures:
- `"confidence": "HIGH"` (JSON double-quoted key)
- `'confidence': 'HIGH'` (JSON single-quoted)
- `confidence: HIGH` (bare key, resolution loop)
- `**Confidence:** HIGH` (prose with markdown bold)
- `Confidence: HIGH` (plain prose)

**Caveat on `tool_response` shape:** If `tool_response` is an object (e.g. `{ result: "...", duration_ms: ... }`), extract the text field first before matching. If it's an array of `{type:"text", text:"..."}` blocks (matching the internal transcript shape), concatenate all `text` values. The Wave-0 echo-stdin hook confirms which.

**`null` is the common case.** Most gsd-* spawns (gsd-planner, gsd-executor, gsd-plan-checker, etc.) emit no confidence. Only gsd-phase-researcher (micro_research mode) and resolution-loop agents return a confidence verdict.

**Confidence:** HIGH (both formats confirmed from `resolution-loop.md` and gsd-phase-researcher agent definition read during research)
**Source:** `get-shit-done/references/resolution-loop.md`, `agents/gsd-phase-researcher.md`

---

### Q3: Correlation key for LOW→re-research

**Recommendation:** Use `session_id` + `agent_type` + chronological ordering by `ts_return`. Do NOT hash the prompt.

**Reasoning:**

- The resolution loop (from `resolution-loop.md`) mutates the prompt across iterations via `critique_hint`. A prompt hash will NOT match between the LOW spawn and its HIGH/MEDIUM retry. The description (`tool_input.description`) is stable: it is set by the orchestrator and unlikely to change between iterations of the same research question.
- **Primary correlation key:** `session_id` + `agent_type` — filtering the trace for a session shows all spawns of a given agent type in timestamp order. A LOW immediately followed by a re-research of the same `agent_type` in the same `session_id` is the correlated pair.
- **Optional secondary key:** `desc_hash` = first 8 chars of SHA-256 of `tool_input.description`. The description is the orchestrator's stable framing ("What do I need to know about X?") and doesn't get critique-mutated. This is a logged field, not a filter key — available for `jq` post-processing.

**What the log record includes for correlation:**
```json
{
  "session_id": "abc123",
  "seq": 3,
  "agent_type": "gsd-phase-researcher",
  "description": "Research how to implement agent telemetry",
  "desc_hash": "a1b2c3d4",
  "confidence": "LOW",
  "ts_return": "2026-06-05T10:00:00.000Z"
}
```

A `seq` counter (per-session line count in the log) is trivially derived by counting existing lines with `session_id` before appending — this is a cheap fs.readFileSync line-count, no state required.

**Confidence:** HIGH (correlation by timestamp+agent_type in a JSONL is the canonical approach; prompt-hash risk confirmed from resolution-loop.md critique_hint behavior)
**Source:** `get-shit-done/references/resolution-loop.md`

---

### Q4: Subagent-context guard

**Recommendation:** Use `tool_input.subagent_type` prefix filter (`/^gsd-/`) as the primary guard. The no-metrics-file bail from context-monitor does NOT apply here — document why.

**Reasoning:**

1. **Tool-grant confirmation:** Both `gsd-phase-researcher` and `gsd-planner` agent definitions (confirmed from frontmatter) do NOT include `Task` or `Agent` in their `tools` list. All traceable spawns are therefore orchestrator-level. Issue #34692 (confirmed from official GitHub) states that subagent-issued tool calls do not fire parent hooks anyway, so nested spawns cannot reach this hook even if tool grants changed.

2. **The prefix filter is the guard.** `tool_input.subagent_type.startsWith('gsd-')` is both the OBS-01 filter ("log only gsd-* spawns") and the subagent-context guard in one check. If tool grants ever expand, only spawns with a `gsd-*` subagent_type name are logged — built-in subagents (`Explore`, `Plan`, `general-purpose`) are automatically excluded.

3. **Why NOT copy context-monitor's no-metrics-file bail:** The context-monitor bails on "no metrics file" to detect when it's running inside a subagent (subagents don't write the metrics file). This hook has a cleaner, more direct guard: if `tool_input.subagent_type` doesn't start with `gsd-`, silently exit. No tmpfile needed.

4. **Additional guard worth adding:** Check `data.cwd` for `.planning/` existence (same as context-monitor does for `STATE.md`) so the hook self-disables cleanly in non-GSD projects where the config file and telemetry dir don't exist.

**Confidence:** HIGH (tool grant inspection is primary evidence; confirmed from agent .md files)
**Source:** `.claude/agents/gsd-phase-researcher.md`, `.claude/agents/gsd-planner.md`, github.com/anthropics/claude-code/issues/34692

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, os, crypto) | N/A | Hook file I/O, JSONL append, dir creation, sha hash | No external deps — hooks must be pure JS per SEC-04 pattern |
| Claude Code hooks API | PostToolUse + PostToolUseFailure | Intercept Task tool lifecycle | Only mechanism for code-level spawn capture |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.createHash('sha256')` | Node built-in | Stable desc_hash for correlation | Included in log record as optional correlation aid |

**Installation:** None — pure Node.js, no npm install required. Matches SEC-04 constraint ("no TypeScript/build/core-lib dependency").

---

## Architecture Patterns

### Recommended File Layout

```
hooks/
  gsd2-agent-trace.js          # NEW — committed source
  gsd2-context-monitor.js      # existing template to mirror
hooks/dist/
  gsd2-agent-trace.js          # runtime copy (gitignored) — build-hooks.js produces this
.planning/
  telemetry/
    agent-trace.jsonl          # append-only JSONL log (gitignored or tracked, user's choice)
get-shit-done/bin/
  gsd-tools.cjs                # add 'trace' case to switch
  lib/
    trace.cjs                  # NEW — trace subcommand implementation
```

### Pattern 1: PostToolUse hook reading stdin JSON

The hook follows `gsd2-context-monitor.js` exactly for the outer scaffold:

```js
// gsd2-agent-trace.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 10000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const { session_id, cwd, tool_input, tool_response } = data;

    if (!session_id || !cwd) process.exit(0);

    // Guard: only gsd-* spawns
    const agentType = tool_input?.subagent_type || '';
    if (!agentType.startsWith('gsd-')) process.exit(0);

    // Config gate
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cfg.hooks?.agent_trace === false) process.exit(0);
      } catch (_) {}
    }

    // Only operate in GSD projects
    if (!fs.existsSync(path.join(cwd, '.planning', 'STATE.md'))) process.exit(0);

    // Extract return text from tool_response (shape TBD — see Wave 0 validation)
    const returnText = extractReturnText(tool_response);

    // Scrape confidence
    const confidence = scrapeConfidence(returnText);

    // Compute desc_hash for correlation
    const desc = tool_input?.description || '';
    const descHash = crypto.createHash('sha256').update(desc).digest('hex').slice(0, 8);

    // Build record
    const telemetryDir = path.join(cwd, '.planning', 'telemetry');
    fs.mkdirSync(telemetryDir, { recursive: true });

    const logPath = path.join(telemetryDir, 'agent-trace.jsonl');
    // Derive seq from existing lines for this session
    let seq = 0;
    if (fs.existsSync(logPath)) {
      const existing = fs.readFileSync(logPath, 'utf8');
      seq = (existing.match(new RegExp('"session_id":"' + session_id + '"', 'g')) || []).length;
    }

    const record = {
      event: 'agent.return',
      session_id,
      seq,
      ts_return: new Date().toISOString(),
      agent_type: agentType,
      description: desc,
      desc_hash: descHash,
      confidence,
      duration_ms: tool_response?.duration_ms ?? null,
    };

    fs.appendFileSync(logPath, JSON.stringify(record) + '\n');
  } catch (_) {
    // Silent fail — never block tool execution
  }
  process.exit(0);
});

function extractReturnText(toolResponse) {
  // WAVE-0 VALIDATION REQUIRED: actual field name unconfirmed
  // Candidate 1: string field 'result'
  if (typeof toolResponse?.result === 'string') return toolResponse.result;
  // Candidate 2: array of text blocks (mirrors transcript shape)
  if (Array.isArray(toolResponse)) {
    return toolResponse
      .filter(b => b?.type === 'text')
      .map(b => b.text || '')
      .join('\n');
  }
  // Fallback: stringify whatever we got
  return typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse || '');
}

function scrapeConfidence(text) {
  if (!text) return null;
  const m = text.match(/["']?confidence["']?\s*[=:]\s*["']?\*{0,2}(HIGH|MEDIUM|LOW)\*{0,2}["']?/i);
  return m ? m[1].toUpperCase() : null;
}
```

### Pattern 2: settings.json PostToolUse + PostToolUseFailure entries

```json
{
  "PostToolUse": [
    { ... existing entries ... },
    {
      "matcher": "Task",
      "hooks": [
        {
          "type": "command",
          "command": "node .claude/hooks/gsd2-agent-trace.js"
        }
      ]
    }
  ],
  "PostToolUseFailure": [
    {
      "matcher": "Task",
      "hooks": [
        {
          "type": "command",
          "command": "node .claude/hooks/gsd2-agent-trace.js"
        }
      ]
    }
  ]
}
```

The hook reads `hook_event_name` from stdin to distinguish `PostToolUse` (write `event: "agent.return"`) from `PostToolUseFailure` (write `event: "agent.error"`).

### Pattern 3: gsd-tools trace subcommand

Minimal reader — tail + filter, no pretty-printing:

```
gsd-tools trace                        # tail last 20 lines
gsd-tools trace --session <id>         # filter by session_id
gsd-tools trace --agent <type>         # filter by agent_type prefix
gsd-tools trace --confidence LOW       # filter by confidence value
gsd-tools trace --last N               # tail last N lines
gsd-tools trace --raw                  # raw JSONL output
```

Implementation: read the full JSONL, filter in-memory (file is small), format as a table or pass --raw for JSONL. Lives in `get-shit-done/bin/lib/trace.cjs`, dispatched from the main `gsd-tools.cjs` switch.

### Anti-Patterns to Avoid

- **Wrapping the JSONL write in a second try/catch that might swallow the config-parse error:** errors inside the outer try/catch must exit(0) silently — the pattern from context-monitor is correct.
- **Using PreToolUse to capture spawn time:** unnecessary now that `duration_ms` is available in tool_response. PreToolUse adds complexity with no payoff.
- **Regex on `tool_response` before confirming its shape:** the Wave-0 echo-stdin hook must run first. Don't hard-code `tool_response.result` without empirical confirmation.
- **Counting all JSONL lines for `seq`:** count only lines where `session_id` matches to get per-session sequence number.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL append | Custom locking mechanism | `fs.appendFileSync` (atomic for single-process append) | Hook is single-process; no concurrent writers; Node fs.appendFileSync is sufficient |
| Line counting for seq | Complex parser | `existing.match(regexForSessionId).length` | The file is small (one line per spawn); simple regex count is fast enough |
| Confidence parsing | NLP | Single tolerant regex (documented above) | The two formats are highly regular; regex is the right tool |

---

## Common Pitfalls

### Pitfall 1: tool_response field name unknown
**What goes wrong:** Hook writes `null` for confidence because `tool_response.result` doesn't exist (actual field might be different).
**Why it happens:** Official docs don't publish per-tool schemas; transcript internal format may differ from hook payload format.
**How to avoid:** Wave-0 task: add a throwaway `echo-stdin` hook, trigger one gsd-* spawn, inspect the raw JSON. Remove throwaway hook before committing the real hook.
**Warning signs:** All JSONL records show `"confidence": null` even after a micro_research run.

### Pitfall 2: build-hooks.js HOOKS_TO_COPY list not updated
**What goes wrong:** `gsd2-agent-trace.js` exists in `hooks/` but never copied to `hooks/dist/` during build.
**Why it happens:** `build-hooks.js` has an explicit `HOOKS_TO_COPY` array (not a glob).
**How to avoid:** Add `'gsd2-agent-trace.js'` to the `HOOKS_TO_COPY` array in `scripts/build-hooks.js`.

### Pitfall 3: install.js registration/uninstall arrays missed
**What goes wrong:** Hook file exists but never wired into `.claude/settings.json` on install.
**How to avoid:** Add the new hook to both the registration path and uninstall cleanup array in `bin/install.js`.

### Pitfall 4: PostToolUseFailure not registered
**What goes wrong:** Crashed subagents are invisible in the log.
**How to avoid:** Add both `PostToolUse`+`PostToolUseFailure` entries with `matcher: "Task"` in install.js settings wiring.

### Pitfall 5: telemetry dir not gitignored
**What goes wrong:** `agent-trace.jsonl` gets committed and grows in the repo.
**How to avoid:** Add `.planning/telemetry/` to `.gitignore` during Wave 0. The dir is created on first write by the hook itself.

### Pitfall 6: Source vs runtime mirror
**What goes wrong:** Changes to `hooks/gsd2-agent-trace.js` don't appear in runtime `.claude/hooks/gsd2-agent-trace.js`.
**How to avoid:** Follow the established pattern: commit source in `hooks/`, build via `scripts/build-hooks.js`, propagate via `install.js`. The Wave 0 "confirm build pipeline" task covers this.

---

## Code Examples

### JSONL record shape (proposed, pending Wave-0 field-name confirmation)

```json
{
  "event": "agent.return",
  "session_id": "abc123",
  "seq": 0,
  "ts_return": "2026-06-05T10:14:32.451Z",
  "agent_type": "gsd-phase-researcher",
  "description": "Research how to implement Phase 4 agent telemetry",
  "desc_hash": "a1b2c3d4",
  "confidence": "LOW",
  "duration_ms": 45231
}
```

For an error event:

```json
{
  "event": "agent.error",
  "session_id": "abc123",
  "seq": 1,
  "ts_return": "2026-06-05T10:15:01.211Z",
  "agent_type": "gsd-planner",
  "description": "Plan Phase 4",
  "desc_hash": "b3c4d5e6",
  "confidence": null,
  "duration_ms": null
}
```

### gsd-tools trace sample output (table mode)

```
ts_return               event         agent_type           confidence  seq
2026-06-05T10:14:32Z   agent.return  gsd-phase-researcher LOW         0
2026-06-05T10:16:55Z   agent.return  gsd-phase-researcher HIGH        1
2026-06-05T10:17:30Z   agent.return  gsd-planner          null        2
```

### config.json gating key

```json
{
  "hooks": {
    "prompt_guard": true,
    "read_injection_scanner": true,
    "read_guard": false,
    "agent_trace": true
  }
}
```

### SubagentStart/SubagentStop — noted, not used

These hooks exist in the API. The `agent_type` field matches the `name` frontmatter of a custom subagent file. For reference, SubagentStart fires at spawn and provides `agent_id` + `agent_type` but NO return text. SubagentStop fires at completion with `stop_reason` (`"completed"`, `"error"`, `"max_turns"`, `"user_interrupt"`) but also NO return text. They are useful for lifecycle monitoring but cannot satisfy OBS-02. Noted for completeness — do not use as primary mechanism.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Transcript-watching for subagent confidence | Hook-based structured JSONL | Phase 4 | grep-checkable vs eyeballing |
| PostToolUse only (no failure capture) | PostToolUse + PostToolUseFailure both registered | Phase 4 | Crashed spawns visible as `agent.error` |
| Subagent context monitor using metrics-file bail | Direct prefix filter on subagent_type | Phase 4 | Cleaner: no tmpfile dependency |

---

## Validation Architecture

### Wave-0 Gate (NON-NEGOTIABLE)

Before implementing the scraper or writing any confidence-parsing logic, a throwaway echo-stdin hook MUST confirm the exact `tool_response` field structure:

**Task:** Add a temporary hook `hooks/gsd2-agent-trace-debug.js` that logs the full stdin JSON to `/tmp/gsd-hook-debug.json` then exits 0. Register it as a `PostToolUse` `matcher:"Task"` hook. Run one gsd-phase-researcher spawn. Inspect `/tmp/gsd-hook-debug.json`. Note exact field names for:
- The return text field in `tool_response` (likely `result` or a `content[].text` array)
- Whether `duration_ms` is present
- Whether `hook_event_name` is in the payload

Remove the debug hook before committing the real hook.

**Exit criteria:** `extractReturnText()` function in gsd2-agent-trace.js correctly returns the plain text of the subagent's return value.

### Test Commands

| Check | Command | What it verifies |
|-------|---------|-----------------|
| Hook fires on spawn | Trigger a gsd-planner run, check `.planning/telemetry/agent-trace.jsonl` for new line | OBS-01 |
| gsd-* filter works | Trigger a non-gsd Task spawn (if any), confirm no log entry | Q4 guard |
| Confidence scraped | Run a micro_research, check JSONL for `confidence: HIGH/MEDIUM/LOW` | OBS-02 |
| LOW→HIGH visible | Run a two-iteration loop (LOW first pass), check two correlated entries | OBS-02 success signal |
| Trace reader | `node gsd-tools.cjs trace --session <id>` returns filtered output | Reader |
| Config gate | Set `config.hooks.agent_trace: false`, confirm no new entries written | Config gating |
| Build pipeline | `node scripts/build-hooks.js` — confirm `hooks/dist/gsd2-agent-trace.js` created | Build |
| Install wiring | `node bin/install.js --claude` — confirm `PostToolUse` Task entry in `.claude/settings.json` | Install |

---

## Sources

### Primary (HIGH confidence)
- `code.claude.com/docs/en/hooks-guide.md` (fetched 2026-06-05) — PostToolUse/PreToolUse patterns, hook lifecycle table, SubagentStart/SubagentStop discovery
- `code.claude.com/docs/en/hooks#subagentstart` (fetched 2026-06-05) — SubagentStart/SubagentStop schemas; confirmed SubagentStop has no return text
- `code.claude.com/docs/en/sub-agents` (fetched 2026-06-05) — `name` frontmatter = `agent_type` in SubagentStart, tool grant docs
- Project transcripts (`.claude/projects/.../c5609700-*.jsonl`) — direct evidence of `Agent` tool `tool_use` input shape (`description`, `subagent_type`, `prompt`) and tool_result shape (content array with text blocks + `agentId` + `<usage>` footer)
- `hooks/gsd2-context-monitor.js` — hook template (stdin guard, config-gate, silent-fail)
- `.claude/agents/gsd-phase-researcher.md`, `.claude/agents/gsd-planner.md` — tool-grant confirmation (no Task/Agent in tools list)
- `get-shit-done/references/resolution-loop.md` — confidence verdict JSON shape, critique_hint prompt mutation confirmed

### Secondary (MEDIUM confidence)
- `gist.github.com/FrancisBourre/50dca37124ecc43eaf08328cdcccdb34` — claude-code-hooks schemas; suggests `result` string field in tool_response; could not independently verify against official source
- `gist.github.com/johnlindquist/d22c70fd70660b4f6fb4d0b05d0792d2` — Task tool `tool_input` schema (description/subagent_type/prompt confirmed); tool_response `result` field with usage fields

### Tertiary (LOW confidence — Wave-0 empirical check required)
- `tool_response.result` field name: plausible from two independent sources but not in official docs; must be confirmed empirically before writing scraper

---

## Metadata

**Confidence breakdown:**
- Hook mechanism (PostToolUse single-record): HIGH — confirmed from official docs + locked roadmap decision
- tool_input fields (description, subagent_type, prompt): HIGH — confirmed from transcript inspection (real Agent calls in c5609700)
- tool_response field name (result vs content array): MEDIUM — supported by 2 secondary sources, unconfirmed in official docs; Wave-0 echo-hook required
- Confidence scraper regex: HIGH — both formats confirmed from primary source files
- Correlation key (session_id + agent_type + timestamp): HIGH — structural argument; prompt-hash exclusion confirmed from resolution-loop.md
- Subagent guard (prefix filter): HIGH — confirmed from agent frontmatter + GitHub issue #34692
- gsd-tools trace structure: HIGH — mirrors existing subcommand pattern in gsd-tools.cjs

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (30 days; hooks API is stable; tool_response field name is the only live unknown)
