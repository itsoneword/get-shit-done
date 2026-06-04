# Phase 4: Agent Observability & Telemetry - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

GSD emits a structured, code-level telemetry log (JSONL) of agent activity: every `gsd-*` subagent spawn (type / spawning-context / timestamp) and its returned confidence verdict — so loop and feature behavior is verifiable by inspecting a record rather than eyeballing a transcript. Mechanism is Claude Code hooks reusing the Phase 1 hook infrastructure. **Observability lives in code/config, never in prompts** — zero workflow/agent prose changes. Scope is the emit-and-read pipeline (hook + log + minimal reader); it does NOT include consuming the telemetry signal (that is Phase 5 stall-detection) or any prompt/agent redesign.

**Detected domain:** Generic
**Evidence:** instrumentation/tooling — building a Claude Code hook + a `gsd-tools` reader, not an agent topology. Keywords "agent"/"observability" brushed the Agentic domain, but there is no multi-agent system being *designed* here (no communication contracts, no orchestration topology) — so no AGENT-SPEC.
**Confirmed by user:** not explicitly prompted (LOW-confidence Agentic signal overridden to Generic on structural grounds — it's a logging hook)

</domain>

<established>
## Established Patterns (from codebase)

- **Hook infrastructure (Phase 1)**: `scripts/build-hooks.js` builds `hooks/*.js` → `hooks/dist/`; `install.js` registers hooks into `.claude/settings.json`. `gsd2-*` naming is the established convention.
- **`PostToolUse` wiring**: `.claude/settings.json` already has a `PostToolUse` array (currently `gsd2-context-monitor.js` unscoped + `gsd2-read-injection-scanner.js` scoped `matcher: "Read"`). Adding a `matcher: "Task"` entry follows this exact shape.
- **Config gating**: `.planning/config.json` `hooks.*` boolean keys (`prompt_guard`, `read_injection_scanner`, `read_guard`) gate each hook. `gsd2-context-monitor.js` reads `config.hooks?.context_warnings === false` to disable. New telemetry hook follows the same `config.hooks.<key>` pattern.
- **Hook robustness idioms** (`gsd2-context-monitor.js`): 10s stdin timeout guard, `try/catch` → silent `process.exit(0)` on any error (never block the tool), stale-data guard, subagent-context bail (exits when no per-session metrics file exists). The telemetry hook reuses these idioms verbatim.
- **Confidence verdict format (Phase 2)**: `gsd-phase-researcher` micro_research returns `Recommendation / Reasoning / Confidence / Source / Caveat`; the resolution-loop verdict shape is JSON with a `confidence` field. The confidence value lands in the **Task return text** — which is what makes scraping it from a `PostToolUse` hook feasible.

</established>

<decisions>
## Implementation Decisions

### Mechanism (locked by ROADMAP Phase 4 detail — carried forward, not re-discussed)
- Claude Code hook, `matcher: "Task"`, modeled on `hooks/gsd2-context-monitor.js`. [STRONG — roadmap-locked]
- Observability in **code/config, never in prompts** — zero changes to any workflow/agent `.md`. [STRONG — explicit user requirement, roadmap-locked]
- Best-effort, non-blocking: a hook failure never interrupts the agent run; degrades cleanly (silently) in runtimes without hook support (Copilot/Gemini). [STRONG — roadmap-locked, SC#3]
- Log only `gsd-*` subagent spawns (filter by subagent_type). [STRONG — OBS-01 / SC#1]

### Log location
- Dedicated `.planning/telemetry/agent-trace.jsonl`. [WEAK — accepted recommendation; rationale: telemetry is a distinct concern from `.planning/debug/` session files, independently gitignorable/rotatable]

### Reader tooling scope
- Build a **minimal raw reader now**: `gsd-tools trace` — tail + filter by event / agent-type / session. Enough to make spawns grep-checkable without gold-plating. [WEAK — accepted recommendation]
- Full pretty-printer / timeline / correlation-grouping view is **deferred** (see Deferred Ideas).

### Retention / rotation
- **Append-only, no rotation** — one growing `agent-trace.jsonl`. JSONL lines are tiny; simplest to grep across runs. Revisit only if it ever grows large. [WEAK — accepted recommendation]

### Default posture (config gating)
- **Default-on**: `config.hooks.agent_trace` defaults `true` (mirrors Phase 1 hook gating; new `hooks.*` key). Best-effort + non-blocking, and the whole payoff is making dogfooding automatic — opt-in would defeat it. Still disable-able via config. [WEAK — accepted recommendation; aligned with roadmap's stated "immediate payoff: makes dogfood items grep-checkable" intent]

</decisions>

<open_technical_questions>
## Open Technical Questions (researcher/planner MUST resolve before building the schema)

These were surfaced and partly verified during discussion. The spawn/return JSONL **schema is PROPOSED, pending feasibility** — do not bless it as final until #1 is resolved.

1. **One `PostToolUse` hook vs. a `PreToolUse(Task)` + `PostToolUse(Task)` pair.** A `PostToolUse` hook on `Task` fires *once, at return* — so `agent.spawn` and `agent.return` would share one timestamp, and a subagent that hangs/crashes before returning is never logged. A true spawn-time event (and durable capture of non-returning spawns) needs a `PreToolUse(Task)` hook too. **Consequence:** OBS-01's wording ("Claude Code `PostToolUse`, `matcher: Task`") and the roadmap's two-event schema (`agent.spawn` + `agent.return`) may need amending. Decide: merged single record at return (simpler) vs. paired spawn+return events (durable, true timestamps). *Verified during discussion: `PostToolUse`-on-`Task`-fires-once is confirmed behavior.*

2. **Confidence scraper format tolerance.** Confidence lands in Task return text in **two** forms: prose `Confidence: HIGH` (micro_research return) and JSON `"confidence": "HIGH"` (resolution-loop verdict shape). The scraper regex must tolerate both, and degrade to `confidence: null` when absent (most `gsd-*` spawns are not resolution agents and emit no confidence). *Verified during discussion: confidence IS present in return text — see `resolution-loop.md` + `gsd-phase-researcher` micro_research.*

3. **Correlation key for LOW → re-research.** OBS-02 requires a LOW→second-spawn to be visible as *correlated* entries. A `PostToolUse(Task)` hook sees `session_id`, `description`, and `tool_input.prompt`/`subagent_type`. What links the two spawns? Candidates: `session_id` + monotonic sequence, or `session_id` + a question/desc hash. Researcher to pick a key derivable purely from hook-visible fields (no prompt changes allowed).

4. **Subagent-context guard.** Subagents lack the `Task`/`Agent` tool (confirmed: planner/researcher grants), so all traceable spawns are orchestrator-level and there are effectively no nested spawns to filter. A cheap guard (mirroring context-monitor's no-metrics-file bail) is still worth including as insurance against future tool-grant changes.

</open_technical_questions>

<expected_outcome>
## Expected Outcome

- **End state:** After any GSD run that spawns subagents, `.planning/telemetry/agent-trace.jsonl` contains one structured, timestamped record per `gsd-*` spawn (type, spawning context, and — for resolution/verifier agents — the returned confidence verdict). `gsd-tools trace` tails/filters it. No workflow or agent prompt file changed.
- **Success signal:** A Phase 2 autonomous-resolution dogfood item is verifiable by grepping the log instead of watching a transcript — e.g. a LOW→re-research shows up as two distinct, timestamped, correlated `gsd-phase-researcher` entries with `confidence: LOW` then `confidence: HIGH/MEDIUM`.
- **Flow:** Orchestrator spawns a `gsd-*` subagent via `Task` → hook fires → appends a JSONL record (spawn ctx + scraped confidence) best-effort → run continues uninterrupted → developer inspects with `gsd-tools trace` or `jq`/`grep`.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — OBS-01 (spawn logging), OBS-02 (confidence-verdict capture + optional reader)
- `.planning/ROADMAP.md` §"Phase 4: Agent Observability & Telemetry" — locked mechanism, discussion focus, success criteria (note: schema there is the *proposed* one — see Open Technical Questions)

### Hook infrastructure to reuse (Phase 1)
- `hooks/gsd2-context-monitor.js` — the model: `PostToolUse` hook, stdin-timeout guard, silent-fail, config-gate read, subagent-context bail
- `scripts/build-hooks.js` — build pipeline (`hooks/*.js` → `hooks/dist/`)
- `install.js` — hook registration into `.claude/settings.json` (registration/uninstall arrays must include the new hook)
- `.claude/settings.json` — existing `PostToolUse` array shape to extend with a `matcher: "Task"` entry
- `.planning/config.json` — `hooks.*` gating keys; add `hooks.agent_trace`
- `.planning/v1.5/phases/01-security-hooks/01-CONTEXT.md` — Phase 1 hook config-gating + `gsd2-*` naming decisions

### Confidence source (Phase 2)
- `get-shit-done/references/resolution-loop.md` — verdict shape (`confidence` field), micro_research return format, orchestrator-level loop placement (why spawns are orchestrator-level)
- `.planning/v1.5/phases/02-autonomous-technical-resolution/02-CONTEXT.md` — micro_research return contract (Recommendation/Reasoning/Confidence/Source/Caveat)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/gsd2-context-monitor.js`: direct template for the new `hooks/gsd2-agent-trace.js` — copy its stdin handling, timeout guard, config-gate, and silent-fail structure.
- `scripts/build-hooks.js`: builds the new hook into `hooks/dist/` with no new wiring (it globs `hooks/*.js`).
- Config-gating idiom: `config.hooks?.<key> === false` early-exit, already proven in context-monitor.

### Established Patterns
- `gsd2-*` naming for hooks (Phase 1 blanket rename).
- `PostToolUse` array in `.claude/settings.json` supports multiple entries with optional `matcher` — adding `matcher: "Task"` is additive, won't disturb existing hooks.
- Source-vs-runtime: `hooks/` is committed source; `.claude/hooks/` is gitignored runtime copy propagated by install. Commit only source + `install.js`/`settings.json` template; runtime is regenerated.

### Integration Points
- `.claude/settings.json` `PostToolUse` (and possibly `PreToolUse` per Open Question #1) — new hook entry.
- `install.js` registration + uninstall arrays — add `gsd2-agent-trace.js`.
- `.planning/config.json` `hooks.agent_trace` — new default-`true` gate.
- `gsd-tools.cjs` — new `trace` subcommand (reader).
- Writes to `.planning/telemetry/agent-trace.jsonl` (hook creates the dir if absent).

</code_context>

<specifics>
## Specific Ideas

- "Makes Phase 2's autonomous-resolution dogfood items grep-checkable instead of transcript-watched" — the concrete payoff that justifies default-on (from ROADMAP Phase 4 detail).
- Reader should be ergonomic for the dogfood use case: `gsd-tools trace` filtered by agent-type/session to confirm a loop behaved, not a full UI.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
None — no pending todos matched Phase 4.

- **Full pretty-printer / timeline / correlation-grouping reader view** — deferred; this phase ships a minimal raw `gsd-tools trace`. Build the richer view in a later phase if the raw log proves awkward.
- **Per-session log files** and **size-capped rotation** — deferred; append-only single file chosen for now. Revisit if `agent-trace.jsonl` grows large or cross-run grep gets noisy.
- **Consuming the telemetry signal for stall-detection** — that is Phase 5 (Plan-Loop Convergence); Phase 4 only emits + reads.

</deferred>

---

*Phase: 04-agent-observability-telemetry*
*Context gathered: 2026-06-04*
