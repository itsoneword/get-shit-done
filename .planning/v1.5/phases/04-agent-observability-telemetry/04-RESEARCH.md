# Phase 4: Agent Observability & Telemetry — Research

**Researched:** 2026-06-05
**Domain:** Claude Code hook instrumentation / Node.js telemetry
**Confidence:** MEDIUM (primary API fields unverifiable from docs alone — see Open Technical Questions)

---

## Summary

Phase 4 adds a `PostToolUse(Task|Agent)` hook (`gsd2-agent-trace.js`) that appends a JSONL record to `.planning/telemetry/agent-trace.jsonl` for every `gsd-*` subagent spawn. It also adds a minimal `gsd-tools trace` subcommand (tail + filter). The mechanism is fully code/config-side: zero workflow or agent `.md` files change.

The research confirmed the locked mechanism is correct: `PostToolUse` with `matcher:"Task|Agent"` is the only hook event that receives BOTH the spawn input (`tool_input.description`, `.subagent_type`) AND the return text (`tool_response` containing the confidence verdict). `SubagentStart`/`SubagentStop` hooks, while purpose-built for lifecycle events, do NOT carry return text and therefore cannot satisfy OBS-02.

**CRITICAL matcher ambiguity:** The transcript shows the runtime tool_use fires as `Agent` (not `Task`) — specifically `"name": "Agent"` in c5609700 at line 184. The `.claude/settings.json` `allowedTools` array uses `Task`, and official docs use `Task`, but the hook `tool_name` field carries whatever name the runtime surfaces. To be safe against this version-specific ambiguity, use `matcher: "Task|Agent"` (alternation supported per settings.json pattern `"Edit|Write"`). The Wave-0 debug hook MUST register with NO matcher (fires on every tool) to empirically confirm which string appears in `tool_name` — then tighten or confirm the alternation.

The central open question — the exact field name for return text inside `tool_response` — could not be authoritatively confirmed from official docs alone. Transcript evidence shows `tool_response` carries a content array with text blocks (not a structured `result` string); `duration_ms` appears only as embedded text inside a `<usage>` block in that array, not as a top-level field. A Wave-0 echo-stdin hook is mandated as the first task to empirically resolve both the tool_name and the tool_response shape before writing the scraper logic.

**Primary recommendation:** Implement a single `PostToolUse(Task|Agent)` record per spawn (description + subagent_type + scraped confidence + timestamp). Add `PostToolUseFailure(Task|Agent)` for crash capture. Skip PreToolUse. The Wave-0 debug hook MUST use no matcher so it fires regardless of whether the tool is called `Task` or `Agent` at runtime.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Claude Code hook, `matcher: "Task"`, modeled on `hooks/gsd2-context-monitor.js`. [STRONG — roadmap-locked] **[AMENDED: use "Task|Agent" — see Q1 matcher note]**
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
| OBS-01 | `PostToolUse` / `matcher:Task` hook logs every `gsd-*` spawn (timestamp, type, context) with zero prompt-file changes | Confirmed: PostToolUse(Task|Agent) receives `tool_input.description` and `tool_input.subagent_type`; gsd-* prefix filter provides scope. **Note: OBS-01 says "Task" but runtime may use "Agent" — matcher amended to "Task\|Agent"** |
| OBS-02 | Telemetry captures confidence verdicts scraped from return text; LOW→re-research visible as correlated timestamped entries; best-effort + non-blocking; minimal reader | Confirmed: confidence lands in return text (two formats documented); correlation by session_id + agent_type + timestamp ordering |

---

## Open Technical Questions — Resolved

### Q1: PostToolUse-only vs PreToolUse+PostToolUse pair

**Recommendation:** Use a single `PostToolUse(Task|Agent)` record. Do NOT add PreToolUse. For crash/hang capture, add a `PostToolUseFailure(Task|Agent)` hook entry.

**Reasoning:**

1. **OBS-01's mechanism is correct; the matcher string needs verification.** `PostToolUse` fires once at return and receives both `tool_input` (spawn desc/subagent_type) and `tool_response` (return text with confidence). This satisfies both OBS-01 (spawn logging) and OBS-02 (confidence scraping) in a single event. However, the transcript shows the runtime tool fires as `Agent` (c5609700 line 184: `"name": "Agent"`), while the settings allow-list says `Task`. A hook with `matcher: "Task"` may never fire if the runtime surfaces it as `Agent`. Use `matcher: "Task|Agent"` for robustness. **Empirical confirmation is the first Wave-0 task.**

2. **The "shared timestamp" objection is neutralized.** Transcript evidence confirms `duration_ms` is present — but it appears as embedded text inside a `<usage>` block in the content array, not as a structured field. The Wave-0 echo-stdin hook confirms whether `duration_ms` is parseable as a structured value or requires text extraction. Either way, `ts_return` alone is sufficient for ordering; `duration_ms` can be parsed opportunistically.

3. **Hung/crashed subagents:** A hung subagent that never returns will never fire PostToolUse. The correct safety net is **`PostToolUseFailure(Task|Agent)`** (fires when the tool call errors/times out), NOT PreToolUse. Include a `PostToolUseFailure` entry in `.claude/settings.json` alongside the PostToolUse entry — it writes an `agent.error` event type with whatever partial info is available. This is cleaner than PreToolUse because it matches the same tool failure lifecycle.

4. **SubagentStart/SubagentStop** hooks DO exist (confirmed from official docs) and DO provide `agent_id` for lifecycle correlation, but they carry NO return text. They are irrelevant to OBS-02 and should not be used as primary mechanism.

**OBS-01 wording amendment needed?** The mechanism ("PostToolUse on the spawn tool") is correct. The specific string `"Task"` in OBS-01 should be amended to `"Task|Agent"` to handle the runtime name ambiguity. The roadmap two-event schema (`agent.spawn` + `agent.return`) can be collapsed to a single `agent.return` event.

**Confidence:** MEDIUM (structural argument confirmed; matcher string Task vs Agent is empirically unresolved — Wave-0 required)
**Source:** Official docs (code.claude.com/docs/en/hooks), transcript c5609700 line 184 (Agent tool_use), settings.json allowedTools (Task)

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

**Single tolerant regex (corrected — previous version missed prose format):**
```js
const match = returnText.match(/confidence\s*["']?\s*[:=]\s*\**\s*["']?(HIGH|MEDIUM|LOW)/i);
const confidence = match ? match[1].toUpperCase() : null;
```

The previous regex `/["']?confidence["']?\s*[=:]\s*["']?\*{0,2}(HIGH|MEDIUM|LOW)\*{0,2}["']?/i` had a bug: after the colon it matched `\*{0,2}` but had no `\s*` before the capture group, so `**Confidence:** HIGH` (with a space between `:**` and `HIGH`) would NOT match. The corrected form allows whitespace and optional markdown between the colon and the value.

Verification against both real strings:
- `**Confidence:** HIGH` → matches (key=`confidence`, sep=`:**`, space, value=`HIGH`)
- `"confidence": "HIGH"` → matches (key=`"confidence"`, sep=`:`, space, value=`"HIGH"`)

**Caveat on `tool_response` shape:** If `tool_response` is an array of `{type:"text", text:"..."}` blocks (matching the internal transcript shape — likely correct per Wave-0 evidence), concatenate all `text` values before matching. The Wave-0 echo-stdin hook confirms exact structure.

**`null` is the common case.** Most gsd-* spawns (gsd-planner, gsd-executor, gsd-plan-checker, etc.) emit no confidence. Only gsd-phase-researcher (micro_research mode) and resolution-loop agents return a confidence verdict.

**Confidence:** HIGH for both formats confirmed; MEDIUM for regex correctness (corrected from prior version — test against literal strings before shipping)
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
| Claude Code hooks API | PostToolUse + PostToolUseFailure | Intercept Task/Agent tool lifecycle | Only mechanism for code-level spawn capture |

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

    // Extract return text from tool_response (shape confirmed by Wave-0 echo hook)
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

    // duration_ms: present as embedded text in <usage> block — parse opportunistically after Wave-0
    // After Wave-0 confirms tool_response shape, implement duration extraction or leave null
    const record = {
      event: 'agent.return',
      session_id,
      seq,
      ts_return: new Date().toISOString(),
      agent_type: agentType,
      description: desc,
      desc_hash: descHash,
      confidence,
      duration_ms: null,  // populated after Wave-0 confirms extraction method
    };

    fs.appendFileSync(logPath, JSON.stringify(record) + '\n');
  } catch (_) {
    // Silent fail — never block tool execution
  }
  process.exit(0);
});

function extractReturnText(toolResponse) {
  // WAVE-0 VALIDATION REQUIRED: actual field name unconfirmed
  // Lead with Candidate 2 (array of text blocks) — matches transcript evidence from c5609700
  if (Array.isArray(toolResponse)) {
    return toolResponse
      .filter(b => b?.type === 'text')
      .map(b => b.text || '')
      .join('\n');
  }
  // Candidate 1: string field 'result' (suggested by secondary gist sources)
  if (typeof toolResponse?.result === 'string') return toolResponse.result;
  // Fallback: stringify whatever we got
  return typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse || '');
}

function scrapeConfidence(text) {
  if (!text) return null;
  // Tolerant regex: handles both prose "**Confidence:** HIGH" and JSON '"confidence": "HIGH"'
  // Note: \s* after the separator handles the space in ":** HIGH" that naive versions miss
  const m = text.match(/confidence\s*["']?\s*[:=]\s*\**\s*["']?(HIGH|MEDIUM|LOW)/i);
  return m ? m[1].toUpperCase() : null;
}
```

### Pattern 2: settings.json PostToolUse + PostToolUseFailure entries

```json
{
  "PostToolUse": [
    { "...existing entries..." : "..." },
    {
      "matcher": "Task|Agent",
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
      "matcher": "Task|Agent",
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

**Matcher rationale:** `"Task|Agent"` is used because the transcript shows the runtime tool fires as `Agent` (c5609700 line 184) while settings.json uses `Task` in allowedTools. Alternation (`Edit|Write` pattern already in settings.json) is supported and costs nothing. After Wave-0 confirms which string appears in `tool_name`, the matcher can be tightened to the single confirmed name or left as alternation.

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

- **Using `matcher: "Task"` alone without verifying tool_name at runtime:** if the runtime surfaces the spawn as `Agent`, the hook never fires and telemetry silently stays empty. Use `"Task|Agent"` until Wave-0 confirms the exact string.
- **Regex on `tool_response` before confirming its shape:** the Wave-0 echo-stdin hook must run first. Don't hard-code `tool_response.result` without empirical confirmation.
- **Using PreToolUse to capture spawn time:** unnecessary. `ts_return` is sufficient for ordering; `duration_ms` can be extracted from the `<usage>` text block opportunistically.
- **Counting all JSONL lines for `seq`:** count only lines where `session_id` matches to get per-session sequence number.
- **Using the previous regex `/["']?confidence["']?\s*[=:]\s*["']?\*{0,2}(HIGH|MEDIUM|LOW)/i`:** it has no `\s*` between `\*{0,2}` and the capture group and will miss `**Confidence:** HIGH` (space before the value).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL append | Custom locking mechanism | `fs.appendFileSync` (atomic for single-process append) | Hook is single-process; no concurrent writers; Node fs.appendFileSync is sufficient |
| Line counting for seq | Complex parser | `existing.match(regexForSessionId).length` | The file is small (one line per spawn); simple regex count is fast enough |
| Confidence parsing | NLP | Single tolerant regex (documented above) | The two formats are highly regular; regex is the right tool |

---

## Common Pitfalls

### Pitfall 1: tool_name is "Agent" not "Task" — hook never fires
**What goes wrong:** Hook with `matcher: "Task"` never fires because the runtime tool_use has `name: "Agent"`. All spawns are invisible; telemetry silently stays empty. No error is raised because the hook simply doesn't match.
**Why it happens:** Transcript evidence shows the runtime tool fires as `Agent` (c5609700 line 184: `"name": "Agent"`), while settings.json and docs use `Task`. The strings may be equivalent aliases, but the matcher is string-compared.
**How to avoid:** Use `matcher: "Task|Agent"`. Register the Wave-0 debug hook with NO matcher (fires on all tools), trigger one gsd-* spawn, read `tool_name` from the raw JSON. Confirm the correct string before shipping.
**Warning signs:** `agent-trace.jsonl` doesn't grow after a confirmed gsd-* spawn.

### Pitfall 2: tool_response field name unknown
**What goes wrong:** Hook writes `null` for confidence because `tool_response.result` doesn't exist (actual shape is a content array).
**Why it happens:** Official docs don't publish per-tool schemas; transcript evidence suggests a content array, not a `result` field.
**How to avoid:** Wave-0 task: add a throwaway no-matcher hook, trigger one gsd-* spawn, inspect the raw JSON. Remove throwaway hook before committing the real hook.
**Warning signs:** All JSONL records show `"confidence": null` even after a micro_research run.

### Pitfall 3: Confidence regex misses prose format
**What goes wrong:** `**Confidence:** HIGH` (with space between `:**` and `HIGH`) returns `null` — the previous regex had no `\s*` after `\*{0,2}`.
**Why it happens:** Regex was written for the JSON format and added `\*{0,2}` for bold markers but forgot the trailing space before the value.
**How to avoid:** Use the corrected regex: `/confidence\s*["']?\s*[:=]\s*\**\s*["']?(HIGH|MEDIUM|LOW)/i`. Test against both literal strings before shipping.
**Warning signs:** gsd-phase-researcher spawns always log `confidence: null` even when micro_research returns `**Confidence:** HIGH`.

### Pitfall 4: build-hooks.js HOOKS_TO_COPY list not updated
**What goes wrong:** `gsd2-agent-trace.js` exists in `hooks/` but never copied to `hooks/dist/` during build.
**Why it happens:** `build-hooks.js` has an explicit `HOOKS_TO_COPY` array (not a glob).
**How to avoid:** Add `'gsd2-agent-trace.js'` to the `HOOKS_TO_COPY` array in `scripts/build-hooks.js`.

### Pitfall 5: install.js registration/uninstall arrays missed
**What goes wrong:** Hook file exists but never wired into `.claude/settings.json` on install.
**How to avoid:** Add the new hook to both the registration path and uninstall cleanup array in `bin/install.js`.

### Pitfall 6: PostToolUseFailure not registered
**What goes wrong:** Crashed subagents are invisible in the log.
**How to avoid:** Add both `PostToolUse`+`PostToolUseFailure` entries with `matcher: "Task|Agent"` in install.js settings wiring.

### Pitfall 7: telemetry dir not gitignored
**What goes wrong:** `agent-trace.jsonl` gets committed and grows in the repo.
**How to avoid:** Add `.planning/telemetry/` to `.gitignore` during Wave 0. The dir is created on first write by the hook itself.

### Pitfall 8: Source vs runtime mirror
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
  "duration_ms": null
}
```

Note: `duration_ms` starts as `null`. After Wave-0 confirms the `tool_response` shape, implement parsing of the `<usage>` text block (e.g. regex `duration_ms:\s*(\d+)` against the concatenated text) and populate this field.

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
| matcher: "Task" | matcher: "Task\|Agent" | Phase 4 research | Handles runtime tool-name ambiguity |

---

## Validation Architecture

### Wave-0 Gate (NON-NEGOTIABLE — two exit criteria, in order)

**Exit criterion 1: Confirm `tool_name` string (matcher validation)**

Register a TEMPORARY hook with NO matcher (fires on all tools). Trigger one gsd-* spawn. Inspect the raw JSON and read `data.tool_name`. This confirms whether the hook should match `"Task"`, `"Agent"`, or both. If the answer is one name only, simplify the matcher. If ambiguous or both, keep `"Task|Agent"`.

**Task:** Add temporary `hooks/gsd2-agent-trace-debug.js`:
```js
process.stdin.on('data', d => require('fs').appendFileSync('/tmp/gsd-hook-debug.json', d));
process.stdin.on('end', () => process.exit(0));
```
Register it as a PostToolUse hook with NO matcher. Trigger one gsd-planner spawn. Read `/tmp/gsd-hook-debug.json` and note `tool_name`.

**Exit criterion 2: Confirm `tool_response` shape and `duration_ms` location**

From the same debug capture, note:
- Whether `tool_response` is an array of `{type:"text", text:"..."}` blocks (expected per transcript) or has a `result` string field
- Whether `duration_ms` appears as a structured field or only inside a `<usage>` text block
- Whether `hook_event_name` is in the payload

Remove the debug hook before committing the real hook.

**Exit criteria for Wave-0:** `extractReturnText()` correctly returns plain text AND `scrapeConfidence()` correctly extracts the verdict from at least one real micro_research return.

### Test Commands

| Check | Command | What it verifies |
|-------|---------|-----------------|
| Wave-0 debug: tool_name | Register no-matcher hook, trigger gsd-planner, read `/tmp/gsd-hook-debug.json` | Confirms "Task" vs "Agent" |
| Hook fires on spawn | Trigger a gsd-planner run, check `.planning/telemetry/agent-trace.jsonl` for new line | OBS-01 |
| gsd-* filter works | Trigger a non-gsd Task spawn (if any), confirm no log entry | Q4 guard |
| Confidence scraped | Run a micro_research, check JSONL for `confidence: HIGH/MEDIUM/LOW` | OBS-02 |
| LOW→HIGH visible | Run a two-iteration loop (LOW first pass), check two correlated entries | OBS-02 success signal |
| Trace reader | `node gsd-tools.cjs trace --session <id>` returns filtered output | Reader |
| Config gate | Set `config.hooks.agent_trace: false`, confirm no new entries written | Config gating |
| Build pipeline | `node scripts/build-hooks.js` — confirm `hooks/dist/gsd2-agent-trace.js` created | Build |
| Install wiring | `node bin/install.js --claude` — confirm `PostToolUse` Task\|Agent entry in `.claude/settings.json` | Install |

---

## Sources

### Primary (HIGH confidence)
- `code.claude.com/docs/en/hooks-guide.md` (fetched 2026-06-05) — PostToolUse/PreToolUse patterns, hook lifecycle table, SubagentStart/SubagentStop discovery
- `code.claude.com/docs/en/hooks#subagentstart` (fetched 2026-06-05) — SubagentStart/SubagentStop schemas; confirmed SubagentStop has no return text
- `code.claude.com/docs/en/sub-agents` (fetched 2026-06-05) — `name` frontmatter = `agent_type` in SubagentStart, tool grant docs
- Project transcripts (`.claude/projects/.../c5609700-*.jsonl`) — direct evidence: `Agent` tool_use (line 184), tool_result content array with text blocks + `agentId` + `<usage>duration_ms:742811</usage>` footer
- `hooks/gsd2-context-monitor.js` — hook template (stdin guard, config-gate, silent-fail)
- `.claude/agents/gsd-phase-researcher.md`, `.claude/agents/gsd-planner.md` — tool-grant confirmation (no Task/Agent in tools list)
- `get-shit-done/references/resolution-loop.md` — confidence verdict JSON shape, critique_hint prompt mutation confirmed

### Secondary (MEDIUM confidence)
- `gist.github.com/FrancisBourre/50dca37124ecc43eaf08328cdcccdb34` — claude-code-hooks schemas; suggests `result` string field in tool_response; could not independently verify against official source
- `gist.github.com/johnlindquist/d22c70fd70660b4f6fb4d0b05d0792d2` — Task tool `tool_input` schema (description/subagent_type/prompt confirmed); tool_response `result` field with usage fields

### Tertiary (LOW confidence — Wave-0 empirical check required)
- `tool_response.result` field name: plausible from two independent sources but not in official docs; transcript evidence points to content array instead; must be confirmed empirically before writing scraper
- `tool_name` string value ("Task" vs "Agent"): runtime may differ from docs/settings; must be confirmed empirically

---

## Metadata

**Confidence breakdown:**
- Hook mechanism (PostToolUse single-record): HIGH — confirmed from official docs + locked roadmap decision
- Matcher string ("Task" vs "Agent"): LOW — transcript says "Agent", docs say "Task"; use "Task|Agent" until Wave-0 confirms
- tool_input fields (description, subagent_type, prompt): HIGH — confirmed from transcript inspection (real Agent calls in c5609700)
- tool_response shape (content array vs result field): MEDIUM — transcript points to content array; secondary gists suggest result field; Wave-0 required
- duration_ms location (embedded in usage text, not structured field): MEDIUM — transcript shows usage text block; confirm with Wave-0
- Confidence scraper regex: MEDIUM — corrected from prior buggy version; verify against both literal strings before shipping
- Correlation key (session_id + agent_type + timestamp): HIGH — structural argument; prompt-hash exclusion confirmed from resolution-loop.md
- Subagent guard (prefix filter): HIGH — confirmed from agent frontmatter + GitHub issue #34692
- gsd-tools trace structure: HIGH — mirrors existing subcommand pattern in gsd-tools.cjs

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (30 days; hooks API is stable; tool_name and tool_response shape are the live unknowns — resolve in Wave-0)
