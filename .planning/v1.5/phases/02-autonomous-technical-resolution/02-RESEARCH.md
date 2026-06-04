# Phase 2: Autonomous Technical Resolution - Research

**Researched:** 2026-06-04
**Domain:** Agentic loop wiring — GSD workflow modification (discuss-phase, plan-phase, gsd-planner)
**Confidence:** HIGH on integration mechanics; HIGH on the deep-research callability constraint (critical finding — corrected 2026-06-04)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions [STRONG]

- **Loop, not agent.** Deliverable is a reusable resolution loop (research → self-critique → confidence verdict), composed from existing capability. No new specialized agent.
- **Reuse, don't rebuild.** Reuse `deep-research` (fan-out + adversarial-verify) for the heavy path and the existing micro-research shape for the light path.
- **Reduce human round-trips.** Loop's success = technical questions resolved without reaching the human. LOW→HIGH confidence resolved autonomously = one fewer round-trip.
- **Human reached only when:** confidence stays LOW after the loop exhausts its bounded iterations, or the question is genuine preference/taste.
- **plan-phase wiring.** plan-phase gains an inline technical-resolution path it lacks today.
- **discuss-phase wiring.** `question_triage` LOW-confidence branch runs the self-critique loop before defaulting to asking the human.
- **Mirror Phase 4 shape** for bounded-iteration self-critique (max iterations, structured verdict, debug trace). [WEAK — planner may adjust exact mechanism]
- **Signal-strength honoring.** Loop reads CONTEXT.md and does not re-open `[STRONG]`/`[STRONG, user-override]` questions; resolved technical decisions recorded with confidence + source. [DISCRETION — storage detail is planner's]

### Deferred Ideas (OUT OF SCOPE)

- New general-researcher agent / core's AI-SPEC tier — explicitly rejected
- "Add user sync checkpoints to plan-phase subagent chains" — adjacent, not folded
- UI not being tested — future milestone
- Context bloat at scale (graph/RAG) — Phase 6/7 candidates

</user_constraints>

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RSCH-01 | Autonomous technical-resolution loop exists (research → self-critique → confidence verdict), composed from existing capability. Raises LOW→HIGH without human input where evidence allows. | Loop shape defined in §Architecture Patterns; light path = micro_research_mode; convergence mirrors Phase 4 |
| RSCH-02 | Loop wired into discuss-phase `question_triage` (incl. LOW-confidence fallback) and plan-phase (inline path, absent today). Technical Q reaches human only when confidence stays LOW after exhaustion, or genuine preference. | Exact attach points documented in §Integration Mechanics |
| RSCH-03 | Loop honors signal strength — skips `[STRONG]`/`[STRONG, user-override]`, records resolved decisions with provenance + confidence. | Signal-strength tag semantics in §Signal-Strength Honoring; write-back target in §Open Questions |

---

## Summary

Phase 2 builds an autonomous technical-resolution loop that runs inside the existing GSD workflows rather than alongside them as a new agent. The loop has two research primitives (light = micro_research_mode, heavy = either deep-research or gsd-phase-researcher full mode), a self-critique layer that mirrors Phase 4's bounded-iteration verifier shape, and two wiring points: discuss-phase's LOW-confidence fallback branch (~line 302–306 of discuss-phase.md) and a new inline path in plan-phase attached near but distinct from Step 5 (the existing full-research spawn).

**Critical finding (corrected):** `deep-research` DOES exist — it is a **native Claude Code harness skill** (present in the interactive session's available-skills list alongside `verify`/`run`/`init`/`code-review`), not a file-based skill. That is why a `find` over the repo and `~/.claude/skills/` turns up nothing, and why COMPARISON.md's "Skills: 0" (which counts *project* skill files) is misleading here. The original draft's "does not exist" was wrong; the real constraint is **callability, not existence**: the loop is LLM-executed prose whose capabilities are bounded by the tool grants of whichever agent executes that file. `gsd-planner` (Tools: Read, Write, Bash, Glob, Grep, WebFetch, context7 — **no `Skill`, no `Agent`, no WebSearch**) and `gsd-phase-researcher` (adds WebSearch — **still no `Skill`, no `Agent`**) **cannot invoke `Skill(deep-research)` nor spawn a research subagent.** `deep-research` is reachable only from the **main-loop orchestrator** (e.g. discuss-phase.md, which runs with full tools). Two consequences for the planner: (1) the `[STRONG]` "reuse deep-research" decision is unsatisfiable on any subagent-executed path — the heavy path must be **orchestrator-spawned `gsd-phase-researcher` full mode** (honors "reuse, don't rebuild"); (2) this constrains the wiring location (see Open Questions §1 and §2 — it undercuts Option B). Additionally, native skills are not guaranteed present on every install (headless/cron/other machines), so depending on `deep-research` directly would be fragile even where callable. See Open Questions §1.

The loop's convergence shape — bounded iterations, structured verdict JSON, debug file trace — maps directly onto the Phase 4 AGENT-SPEC verifier-loop pattern. That pattern is fully implemented (STATE shows 04-01/02/03 complete), so the planner can reference it as a confirmed working model. The plan-phase wiring is the only verified-absent integration point; discuss-phase micro-research already exists and the loop simply augments its LOW-confidence exit path rather than replacing the classification or spawning logic.

**Primary recommendation:** Wire the loop as two surgical edits to existing workflow files (discuss-phase.md, plan-phase.md) plus one inline loop definition (new reference file), with **orchestrator-spawned `gsd-phase-researcher` full mode as the heavy path** and micro_research_mode as the light path. Because the heavy path requires `Agent`/`Task` (and the light path does too), the loop's research steps must execute where those tools exist — the **main-loop orchestrator**, not inside the `gsd-planner`/`gsd-phase-researcher` subagents. This is the decisive constraint on the plan-phase wiring (favors Option A / orchestrator-driven over Option B / planner-internal — see §Open Questions).

---

## Source File Layout — Critical for Planner

> `.claude/` is gitignored. All edits MUST land in the committed source copies. The runtime `.claude/` is a mirror populated by `install.js` at install time.

| What changes | Source file to edit (committed) | Runtime mirror (gitignored) |
|---|---|---|
| discuss-phase workflow | `get-shit-done/workflows/discuss-phase.md` | `.claude/get-shit-done/workflows/discuss-phase.md` |
| plan-phase workflow | `get-shit-done/workflows/plan-phase.md` | `.claude/get-shit-done/workflows/plan-phase.md` |
| gsd-planner agent | `agents/gsd-planner.md` | `.claude/agents/gsd-planner.md` |
| gsd-phase-researcher agent | `agents/gsd-phase-researcher.md` | `.claude/agents/gsd-phase-researcher.md` |
| New loop definition (if separate) | `get-shit-done/references/resolution-loop.md` or inline in agent | `.claude/get-shit-done/references/resolution-loop.md` |

**Evidence:** `.gitignore` line `.claude/`; STATE.md Phase 04-01 decision: "All edits mirrored in source (get-shit-done/, commands/) AND runtime (.claude/) — only source committed since runtime is gitignored."

**Verify commands** in test maps use the committed source paths (`get-shit-done/workflows/discuss-phase.md`, `agents/gsd-planner.md`), not `.claude/`.

---

## Integration Mechanics (Canonical Seam Analysis)

### Seam 1: discuss-phase `question_triage` — LOW-confidence fallback

**Source file:** `get-shit-done/workflows/discuss-phase.md` (edit here; runtime mirror: `.claude/get-shit-done/workflows/discuss-phase.md`)
**Exact lines:** 302–306 (within the `<question_triage>` block, lines 274–317)

Current flow (lines 290–305):
```
For TECHNICAL/HYBRID — spawn micro-research:
  Task(subagent_type="gsd-phase-researcher", ...)

Present based on confidence:
- HIGH → recommendation as fact
- MEDIUM → informed suggestion with options
- LOW → fall back to asking user: "I looked into [topic] but it depends..."
```

**Hook point:** Replace the LOW branch. Instead of asking the user, run the self-critique loop:
```
- LOW → run resolution loop:
    iteration 1: re-research with broader query / alternative angle
    iteration 2: cross-check via second source / different constraint framing
    verdict: if now HIGH/MEDIUM → present autonomously; if still LOW → THEN ask user
```

**Budget context (line 316):** The existing `0-5 micro-research calls per session` throttle applies to the initial micro-research spawn. The loop's internal re-research iterations count against the same budget; the loop should track remaining budget and not iterate if budget is exhausted (fall through to ask-user).

**Signal-strength tag read (line 302-306 context):** The `question_triage` currently classifies PREFERENCE vs TECHNICAL vs HYBRID. The loop must also check CONTEXT.md before classifying: if the question's subject matches a `[STRONG]` or `[STRONG, user-override]` decision in CONTEXT.md, skip the loop entirely and apply the existing decision. This pre-check happens before the Task() spawn.

### Seam 2: plan-phase inline research path

**Source file:** `get-shit-done/workflows/plan-phase.md` (orchestrator — Option A, **required by tool grants** — see Open Questions §2). Option B (`agents/gsd-planner.md`) is NOT viable for the research steps: the planner subagent has no `Agent`/`Skill` tool, so it cannot spawn micro-research or full research from inside itself.
**Current state (Step 5):** Full researcher spawn via `Task(subagent_type="gsd-phase-researcher")`. This is for upfront phase research, not inline question resolution. The planner receives RESEARCH.md and plans from it.

**Where inline questions surface:** In `agents/gsd-planner.md`, the `<discovery_levels>` section (lines 56–72) defines when the planner researches. Level 2-3 signals (new library, architecture decision) route to "discovery workflow" — but that means DISCOVERY.md, not an inline loop. The planner has **no mechanism to surface a mid-planning technical question** back to the orchestrator. It either routes to discovery or proceeds.

**Hook point (two options, planner picks):**

Option A — plan-phase orchestrator, new Step 5.3 (between current 5 and 5.5):
```
## 5.3. Inline Technical Questions (new step)
If planner returns a question (flagged in plan via <open_question> tag), 
the orchestrator catches it and runs the resolution loop inline before 
proceeding to plan-phase Step 6.
```

Option B — inside gsd-planner itself, before the `<plan>` step:
```
In gsd-planner's <mandatory_discovery> step:
If Level 2-3 discovery is triggered AND RESEARCH.md does not already answer it,
run the resolution loop inline rather than deferring to a full discovery workflow.
Return answer inline; continue planning without spawning DISCOVERY.md.
```

**Tool-grant verdict:** Option A is required for any loop step that does research. `gsd-planner` lacks `Agent`/`Skill`, so it cannot spawn micro-research or `gsd-phase-researcher` full mode from within itself — Option B would silently degrade the heavy/light paths to "whatever Context7+WebFetch can do inline." The planner surfaces the unknown (e.g. `<open_question>` tag / PLANNING INCONCLUSIVE); the orchestrator runs the loop and re-spawns the planner with the answer. The extra round-trip is forced by the tool boundary, not a preference.

### Seam 3: micro_research_mode invocation contract

**Source file:** `agents/gsd-phase-researcher.md` lines 15–46

**Invocation (from discuss-phase.md line 292–299):**
```
Task(subagent_type="gsd-phase-researcher", prompt="
<micro_research>
QUESTION: {the specific technical question}
CONSTRAINTS: {relevant project constraints from PROJECT.md and codebase scout}
PHASE GOAL: {from ROADMAP.md}
DOMAIN: {the technical domain}
</micro_research>
", description="Technical Q: {short summary}")
```

**Return format (lines 32–38):**
```
**Recommendation:** [one clear directive]
**Reasoning:** [2-3 sentences, cite specific constraints]
**Confidence:** [HIGH/MEDIUM/LOW]
**Source:** [what was checked]
**Caveat:** [edge case — omit if none]
```

**Timing:** 15–30 seconds target execution.

**Confidence calibration (lines 40–43):**
- HIGH: Context7 / official docs verified, no reasonable alternative
- MEDIUM: Multiple credible sources agree but not primary-verified, or valid alternatives exist
- LOW: Single source, training data only, conflicting information, or highly context-dependent

**After returning (line 45):** discuss-phase orchestrator presents based on confidence. This is the exact decision path the loop extends — the loop runs when the initial spawn returns LOW.

---

## Architecture Patterns

### Loop Shape (mirrors Phase 4 AGENT-SPEC)

The Phase 4 evaluator-optimizer loop (fully implemented, STATE 04-01/02/03 complete) provides the convergence template. The resolution loop is simpler (no separate investigator/fixer agents — all inline) but mirrors the key properties:

| Property | Phase 4 Loop | Resolution Loop |
|----------|-------------|-----------------|
| Max iterations | 3 (hard ceiling, not configurable) | 2-3 (planner decides) |
| Iteration counter | in-memory within orchestrator turn | in-memory within loop invocation |
| Debug trace | `.planning/debug/{plan-slug}-verify-loop.md` | Optional — write to CONTEXT.md annotation or skip for light questions |
| Ceiling-reached | CHECKPOINT REACHED block → escalate to human | Return LOW verdict → ask user (not a hard block) |
| Structured verdict | `{status, iteration, score, gaps[]}` JSON | `{confidence, recommendation, source, iterations_used}` inline |

**Key difference:** Phase 4 loop has distinct agents for verify/investigate/fix. The resolution loop is single-agent (the researcher does all three passes). The STRONG constraint is "mirror the shape, not replicate the roster."

### Recommended Loop Structure

```
technical_resolution_loop(question, constraints, budget_remaining):
  iteration = 0
  max_iterations = 2   # planner may adjust to 3
  
  while iteration < max_iterations and budget_remaining > 0:
    result = micro_research(question, constraints, iteration_hints[iteration])
    
    if result.confidence in [HIGH, MEDIUM]:
      return {confidence: result.confidence, recommendation: result, iterations: iteration+1}
    
    # LOW: critique and re-approach
    iteration += 1
    budget_remaining -= 1
    iteration_hints[iteration] = derive_critique(result)  # broaden query, try alt angle
  
  # Exhausted: return LOW, surface to human
  return {confidence: LOW, recommendation: result, iterations: max_iterations, escalate: true}
```

**Critique strategies per iteration:**
- Iteration 2: broaden query (remove project-specific constraints, try general domain answer)
- Iteration 3 (if allowed): cross-check via explicitly different source type (e.g., official docs if first pass was training data; WebSearch if first pass was Context7)

### Signal-Strength Honoring

**Read target:** `<decisions>` section of CONTEXT.md (already the canonical source).

**Skip condition (before spawning loop):**
```
for each decision in CONTEXT.md:
  if decision.signal in ["[STRONG]", "[STRONG, user-override]", "[STRONG, specialist-backed]"]:
    if question.subject matches decision.topic:
      apply decision directly — do NOT spawn loop
      return as fact (HIGH confidence, source: "CONTEXT.md locked decision")
```

**Write-back (RSCH-03):** When loop resolves a technical question (returns HIGH or MEDIUM), record the decision. The `[STRONG, specialist-backed]` and `[WEAK, specialist-backed]` tags already exist for this (discuss-phase.md lines 53–56). For plan-phase resolutions (which currently have no write-back), the planner should append to the phase's CONTEXT.md `<decisions>` section with the signal `[STRONG, specialist-backed]` if HIGH, `[WEAK, specialist-backed]` if MEDIUM, and `confidence:` + `source:` inline in the tag annotation.

**Downstream protection:** If CONTEXT.md is updated with the resolved decision, downstream agents (gsd-planner, gsd-verifier) that read CONTEXT.md will see the decision and not re-ask.

### Confidence Threshold for Auto-Decide

| Confidence After Loop | Action |
|-----------------------|--------|
| HIGH | Decide autonomously, present as FYI ("I resolved X: [recommendation]. Source: [source]") |
| MEDIUM | Decide autonomously with caveat ("Going with X [reasoning]. You can override.") |
| LOW (after exhaustion) | Surface to human: "I looked into [topic] — conflicting signals. [best-effort finding]. Your call?" |

The current micro_research flow presents even HIGH findings back to the user ("Going with that unless you object?"). The loop changes this: HIGH → autonomous, no question asked. This is the core behavior change for RSCH-02.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Research execution | Custom web search + fetch pipeline | `gsd-phase-researcher` micro_research_mode or full mode | Already has Context7 + WebSearch + WebFetch + confidence calibration |
| Adversarial verification | Custom multi-source checker | `gsd-phase-researcher` full mode (multi-source, cross-referenced) | Full mode already cross-verifies; it's the heavy path |
| Convergence loop shape | New iteration-tracking pattern | Mirror Phase 4 (implemented, working, debug-file convention established) | Proven; planner has the full AGENT-SPEC to copy from |
| Signal tag parsing | Custom CONTEXT.md parser | String matching on signal tag variants | Tags are literal suffixes; grep/includes() suffices |

---

## Common Pitfalls

### Pitfall 1: Re-invoking the loop for PREFERENCE questions
**What goes wrong:** Loop runs for "Card or list layout?" — burns budget, returns LOW (correctly — it depends on taste), user gets asked anyway after delay.
**Why it happens:** Forgetting that `question_triage` PREFERENCE classification is the loop's outer gate, not the loop itself.
**How to avoid:** The loop only runs for TECHNICAL and HYBRID types. PREFERENCE always skips to ask-user immediately. The pre-check is: `if type == PREFERENCE: skip_loop(); ask_user()`.

### Pitfall 2: Re-opening STRONG decisions
**What goes wrong:** Loop researches "which state management library" even though CONTEXT.md has `[STRONG]` decision for Zustand.
**Why it happens:** Loop spawns before checking CONTEXT.md signal-strength.
**How to avoid:** Pre-check CONTEXT.md `<decisions>` section before any loop spawn. Match question subject against existing decisions.

### Pitfall 3: Budget exhaustion without fallback
**What goes wrong:** Budget reaches 0 mid-loop, loop crashes or silently drops question.
**Why it happens:** No budget guard in loop.
**How to avoid:** Check `budget_remaining > 0` before each iteration. If budget = 0 at start of loop, skip directly to ask-user (treating as immediate LOW escalation).

### Pitfall 4: Trying to avoid the round-trip by wiring the loop inside the planner (Option B)
**What goes wrong:** To save the orchestrator round-trip, the loop is placed inside `agents/gsd-planner.md`. But the planner has no `Agent`/`Skill` tool — it cannot spawn micro-research or `gsd-phase-researcher` full mode. The "loop" silently degrades to inline Context7/WebFetch guessing, and the structural grep tests still pass (prose is present), masking that the heavy/light research paths never actually run.
**Why it happens:** Optimizing for round-trips without checking subagent tool grants.
**How to avoid:** Accept the orchestrator round-trip (Option A). The planner flags the unknown (`<open_question>` tag / PLANNING INCONCLUSIVE); the plan-phase orchestrator — which has `Task`/`Agent`/`Skill` — runs the loop, records the decision, and re-spawns the planner with the answer. The round-trip is the cost of the tool boundary, not a wiring mistake.

### Pitfall 5: Medium-confidence treated as Low
**What goes wrong:** Loop returns MEDIUM, then asks the user — defeating the round-trip reduction goal for the majority of questions (most real-world technical questions land MEDIUM, not HIGH).
**Why it happens:** Conservative threshold — treating MEDIUM as "insufficient to decide."
**How to avoid:** MEDIUM → decide autonomously with caveat. The human can always override. This is the critical behavior change vs. current micro_research presentation.

### Pitfall 6: Editing the gitignored .claude/ runtime copy
**What goes wrong:** Edits to `.claude/get-shit-done/workflows/discuss-phase.md` or `.claude/agents/gsd-planner.md` appear to work locally but don't commit (gitignored). Next install wipes them.
**Why it happens:** `.claude/` is the install-time runtime mirror, not source.
**How to avoid:** All edits MUST go to `get-shit-done/workflows/`, `get-shit-done/references/`, and `agents/` (the committed sources). The runtime copy is populated by `install.js` at install time. Verify with `git status` after editing — if the file doesn't appear as modified, you edited the wrong copy.

---

## Code Examples

### Current micro_research invocation (get-shit-done/workflows/discuss-phase.md lines 292–299)
```markdown
Task(subagent_type="gsd-phase-researcher", prompt="
<micro_research>
QUESTION: {the specific technical question}
CONSTRAINTS: {relevant project constraints from PROJECT.md and codebase scout}
PHASE GOAL: {from ROADMAP.md}
DOMAIN: {the technical domain — e.g., real-time data, authentication, database design}
</micro_research>
", description="Technical Q: {short summary}")
```

### Proposed loop extension in discuss-phase LOW branch (conceptual pseudocode for planner)
```markdown
# Replace lines 302–306 of get-shit-done/workflows/discuss-phase.md

if result.confidence == LOW:
  if budget_remaining > 0:
    # Iteration 2: broaden + re-research
    critique_hint = "Previous pass returned LOW confidence. Broaden scope: ignore project-specific constraints, answer for the general domain."
    result_2 = spawn micro_research(question, constraints=general_domain, hint=critique_hint)
    budget_remaining -= 1
    
    if result_2.confidence in [HIGH, MEDIUM]:
      # Resolved — present autonomously
      [present per HIGH/MEDIUM rules above]
      record_decision(result_2, signal="[STRONG, specialist-backed]" if HIGH else "[WEAK, specialist-backed]")
      return
  
  # Still LOW or budget exhausted — ask human
  present_to_user: "I looked into [topic] but signals are conflicting. [result.recommendation]. Your call?"
```

### Phase 4 verdict shape (to mirror for resolution loop — from 04-AGENT-SPEC.md)
```json
{
  "status": "pass | fail",
  "iteration": "number",
  "trace_id": "string",
  "score": "number",
  "total": "number",
  "gaps": [...]
}
```

**Resolution loop verdict shape (adapted):**
```json
{
  "confidence": "HIGH | MEDIUM | LOW",
  "recommendation": "string",
  "reasoning": "string",
  "source": "string",
  "iterations_used": "number",
  "escalate": "boolean"
}
```

### Signal-strength tag variants (from get-shit-done/workflows/discuss-phase.md lines 52–56)
```
[STRONG, specialist-backed]   — specialist HIGH + user confirmed
[STRONG, user-override]       — specialist recommended differently, user overrode
[WEAK, specialist-backed]     — specialist MEDIUM + user casually accepted
```
These are the tags the loop appends to CONTEXT.md write-backs.

---

## State of the Art (within this codebase)

| Old State | Current State | Impact |
|-----------|--------------|--------|
| discuss-phase asks user for all tech questions | micro_research spawns for TECHNICAL/HYBRID; user asked for LOW | LOW branch is the remaining gap |
| plan-phase has no inline question path | plan-phase Step 5 spawns full gsd-phase-researcher | Full research ≠ inline question; mid-planning unknowns still have no resolution path |
| Phase 4 loop shape | Implemented and working (STATE 04-01/02/03 complete) | Directly reusable as template |

---

## Open Questions

### 1. deep-research is a native skill, not callable from the loop's execution context [CRITICAL — resolved with user before planning]

**What we know (corrected):** `deep-research` exists as a **native Claude Code harness skill** (in the interactive session's available-skills list), NOT as a project/global skill file — which is why `find` and `~/.claude/skills/` came up empty and COMPARISON.md's project-skill count of 0 doesn't apply. The decisive fact is tool grants: the loop is LLM-executed prose, and its capabilities are whatever the *executing agent* can do. `gsd-planner` and `gsd-phase-researcher` subagents have **no `Skill` and no `Agent` tool**, so they cannot call `Skill(deep-research)` nor spawn a research subagent. Only the **main-loop orchestrator** (discuss-phase.md / plan-phase.md prose run at top level) can. Native skills also aren't guaranteed on every install.

**What's unclear (for the user):** Whether to (a) use orchestrator-spawned `gsd-phase-researcher` full mode as the heavy path — honoring "reuse, don't rebuild," fully portable, no Skill dependency; or (b) keep `deep-research` as the heavy path but pin the loop's heavy step to the orchestrator level where Skill is callable, accepting it won't run on installs lacking the native skill.

**Recommendation:** Option (a) — `gsd-phase-researcher` full mode, orchestrator-spawned. It already does multi-source search + cross-verification (see `agents/gsd-phase-researcher.md` tool strategy + verification pitfalls), is portable across installs, and honors the "reuse existing capability / no new agent" STRONG constraint without depending on a native skill that subagents can't reach. The loop captures the key finding from the researcher's structured return rather than a full RESEARCH.md file. Do NOT build a new `deep-research` agent (violates "no new specialized agent" STRONG).

**Touches a STRONG decision:** CONTEXT.md `[STRONG]` "Reuse `deep-research`... do not rebuild." `deep-research` exists but is unreachable from the subagent paths where the loop was expected to run, so applying the decision literally everywhere is impossible. This is the one item to confirm with the user before planning (it reinterprets a locked decision). Frame accurately: *deep-research is a native skill, not a missing one — it just can't be called from the planner subagent; substitute orchestrator-spawned gsd-phase-researcher full mode.*

### 2. Plan-phase inline wiring: Option A (orchestrator) vs Option B (planner-internal)

**What we know:** `agents/gsd-planner.md` has no mechanism to surface mid-planning questions back to the orchestrator. The planner's `<discovery_levels>` routes Level 2-3 unknowns to "discovery workflow" (DISCOVERY.md), which is a separate spawn, not an inline loop.

**What's unclear:** Whether the loop should live in `get-shit-done/workflows/plan-phase.md` orchestrator (Option A — easier but more round-trips) or inside `agents/gsd-planner.md` discovery step (Option B — fewer round-trips, more invasive change).

**Recommendation (revised — tool grants flip this to Option A):** The loop's research steps need `Agent`/`Task` (to spawn micro-research and `gsd-phase-researcher` full mode). `gsd-planner` has neither `Agent` nor `Skill`, so a loop placed *inside* the planner (Option B) collapses to Context7 + WebFetch + codebase reads only — it cannot delegate to the light OR heavy research path. Therefore the loop's research must run at the **orchestrator** level (Option A), where `Task`/`Agent` work. Practical shape: `gsd-planner` flags a mid-planning unknown via an `<open_question>` tag in its return (or PLANNING INCONCLUSIVE); the **plan-phase orchestrator** catches it, runs the resolution loop (Task-spawned research + self-critique), records the resolved decision to CONTEXT.md, and re-spawns the planner with the answer in context. The extra round-trip (Pitfall 4) is the unavoidable cost of the subagent tool-grant boundary — not a design choice. ⚠ Note: the structural grep tests in §Validation Architecture pass on prose presence; they would NOT catch a loop placed where its tools can't execute. The plan must put the loop where the tools are, not just where the prose reads well.

### 3. CONTEXT.md write-back for plan-phase resolved decisions

**What we know:** Discuss-phase already has `[STRONG, specialist-backed]` / `[WEAK, specialist-backed]` tags for resolved decisions. For plan-phase, there's no current mechanism to persist resolved technical decisions back to CONTEXT.md.

**What's unclear:** Whether the planner should append to CONTEXT.md (mutating an upstream artifact mid-plan), write to RESEARCH.md, or write to a new per-loop sidecar.

**Recommendation:** Append to the phase's CONTEXT.md `<decisions>` section. CONTEXT.md is already read by downstream agents (gsd-verifier, subsequent planners); appending there is the cheapest way to prevent re-asking. Add a comment block: `<!-- resolved inline by resolution loop [date] -->` to distinguish planner-added decisions from user-discussed ones.

---

## Sources

### Primary (HIGH confidence — direct file reads)
- `agents/gsd-phase-researcher.md` lines 15–46 — micro_research_mode full invocation contract verified (read from `.claude/` runtime mirror, which is identical to committed `agents/` source)
- `get-shit-done/workflows/discuss-phase.md` lines 274–317 — question_triage full block; LOW-confidence fallback at lines 302–306; budget throttle at line 316
- `get-shit-done/workflows/plan-phase.md` Steps 5/5.5/5.6 — full research path; verified no inline question handling
- `agents/gsd-planner.md` — discovery_levels; no inline Q surfacing mechanism confirmed
- `.planning/v1.4/phases/04-verification-harness-and-context-efficiency/04-AGENT-SPEC.md` — full loop contracts, verdict shapes, iteration ceiling=3, debug file convention
- `.planning/reference/COMPARISON.md` — Skills: mine 0, confirmed
- `.gitignore` line `.claude/` — source/runtime split confirmed; STATE.md Phase 04-01 decision corroborates
- `find /home/cleversol -name "deep-research*"` + `ls ~/.claude/skills/ ~/.agents/skills/` — confirmed deep-research is NOT a file-based skill anywhere. **Correction:** it IS present as a native harness skill in the interactive session's available-skills list; the file search missing it does not mean it doesn't exist — it means it's built into the harness, callable only where `Skill` is granted (orchestrator, not subagents).
- Subagent tool grants (from agent registry): `gsd-planner` = Read/Write/Bash/Glob/Grep/WebFetch/context7 (no Skill, no Agent, no WebSearch); `gsd-phase-researcher` = +WebSearch (no Skill, no Agent). This is the binding constraint on heavy-path callability and wiring location.

### Secondary (MEDIUM confidence)
- `.planning/v1.5/phases/02-autonomous-technical-resolution/02-DISCUSSION-LOG.md` — conversation record; confirms deep-research was presented as existing capability during discussion

---

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly set in `.planning/config.json` — treated as enabled.

> **Implementation note:** The loop deliverable is LLM-executed markdown prose wired into workflow files, not a callable JS function. Unit tests target structural properties of the modified markdown (presence of loop logic, correct signal-strength tags), not function invocations. Integration tests use `grep`/`node --test` against the committed source files in `get-shit-done/` and `agents/`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node:test (built-in, v22+) — established in this project (gsd-phase-02-agent-spec used it) |
| Config file | None — inline via `node --test` |
| Quick run command | `node --test tests/02-resolution-loop.test.cjs` |
| Full suite command | `node --test tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSCH-01 | Loop prose exists in modified discuss-phase.md — LOW branch contains bounded-iteration logic (not direct ask-user) | structural | `grep -c "resolution.loop\|self.critique\|iterate.*confidence\|LOW.*exhaust" get-shit-done/workflows/discuss-phase.md` (expect > 0) | ❌ Wave 0 |
| RSCH-01 | Loop prose exists in gsd-planner.md discovery section — Level 1.5 or inline-loop tier present | structural | `grep -c "resolution.loop\|inline.*loop\|Level.*1\.5" agents/gsd-planner.md` (expect > 0) | ❌ Wave 0 |
| RSCH-01 | Verdict shape documented in loop definition — confidence/recommendation/iterations_used fields present | structural | `grep -c "iterations_used\|escalate" get-shit-done/workflows/discuss-phase.md agents/gsd-planner.md` (expect > 0) | ❌ Wave 0 |
| RSCH-02 | discuss-phase LOW branch no longer falls straight to ask-user for TECHNICAL — loop step intervenes | structural | `node --test tests/02-resolution-loop.test.cjs` — test reads discuss-phase.md, asserts LOW branch does not contain only ask-user pattern | ❌ Wave 0 |
| RSCH-02 | plan-phase mid-planning unknowns reach loop, not discovery workflow | structural | `node --test tests/02-resolution-loop.test.cjs` — test reads gsd-planner.md, asserts discovery Level 2 path has loop-invocation option | ❌ Wave 0 |
| RSCH-03 | Loop skips questions matching STRONG decisions — skip-logic present before spawn | structural | `grep -c "STRONG.*skip\|skip.*STRONG\|check.*signal" get-shit-done/workflows/discuss-phase.md agents/gsd-planner.md` (expect > 0) | ❌ Wave 0 |
| RSCH-03 | Write-back tags present — STRONG/WEAK specialist-backed appended to CONTEXT.md on resolution | integration | `grep -c "\[STRONG, specialist-backed\]\|\[WEAK, specialist-backed\]" .planning/v1.5/phases/02-autonomous-technical-resolution/02-CONTEXT.md` (expect > 0 after dogfood run) | ❌ Wave 0 / post-run |

### Sampling Rate
- **Per task commit:** `node --test tests/02-resolution-loop.test.cjs`
- **Per wave merge:** `node --test tests/`
- **Phase gate:** Full suite green before `/gsd2:verify-work`

### Wave 0 Gaps
- [ ] `tests/02-resolution-loop.test.cjs` — covers RSCH-01 and RSCH-02 (structural: reads committed source files, asserts loop logic presence and correct LOW-branch shape)
- [ ] Structural grep checks above can be embedded in this single test file — no second test file needed

---

## Metadata

**Confidence breakdown:**
- Integration mechanics (attach points, invocation contracts): HIGH — direct file reads with line citations
- Loop convergence shape: HIGH — Phase 4 AGENT-SPEC verified implemented
- Signal-strength tag semantics: HIGH — discuss-phase.md lines 50-62 read directly
- deep-research callability: HIGH — it is a native harness skill (exists), but NOT callable from `gsd-planner`/`gsd-phase-researcher` subagents (no Skill/Agent grant); only from the main-loop orchestrator. Corrected from initial "absent" finding.
- Plan-phase planner internals: HIGH — gsd-planner.md discovery_levels read directly
- Source/runtime split: HIGH — .gitignore + STATE.md decision confirmed

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable domain — GSD's own files; no external dependency churn)
