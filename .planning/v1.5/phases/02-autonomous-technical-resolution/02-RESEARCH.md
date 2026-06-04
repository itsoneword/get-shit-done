# Phase 2: Autonomous Technical Resolution - Research

**Researched:** 2026-06-04
**Domain:** Agentic loop wiring — GSD workflow modification (discuss-phase, plan-phase, gsd-planner)
**Confidence:** HIGH on integration mechanics; HIGH on missing deep-research gap (critical finding)

---

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

**Critical finding:** The `deep-research` skill cited in CONTEXT.md as the heavy path does not exist as a file anywhere in this repo (Skills count in fork = 0, confirmed by COMPARISON.md; `find` over both project and global scopes returned nothing). All the adversarial-verify language in CONTEXT.md and DISCUSSION-LOG originates from the discuss-phase AI's characterization during the reframe conversation — it appears to have been a forward-looking or mistaken reference to gsd-core's domain-researcher tier. The planner must choose the heavy-path resolution: either treat `gsd-phase-researcher` full mode as the heavy path (it already searches, fetches, and reasons across sources, which is functionally equivalent), or treat building `deep-research` as a Wave 0 prerequisite of this phase. See Open Questions §1.

The loop's convergence shape — bounded iterations, structured verdict JSON, debug file trace — maps directly onto the Phase 4 AGENT-SPEC verifier-loop pattern. That pattern is fully implemented (STATE shows 04-01/02/03 complete), so the planner can reference it as a confirmed working model. The plan-phase wiring is the only verified-absent integration point; discuss-phase micro-research already exists and the loop simply augments its LOW-confidence exit path rather than replacing the classification or spawning logic.

**Primary recommendation:** Wire the loop as two surgical edits to existing workflow files (discuss-phase.md, plan-phase.md) plus one inline loop definition (new file or inline in an agent), with gsd-phase-researcher full mode serving as the heavy path until deep-research is built.

---

## Integration Mechanics (Canonical Seam Analysis)

### Seam 1: discuss-phase `question_triage` — LOW-confidence fallback

**File:** `.claude/get-shit-done/workflows/discuss-phase.md`
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

**File:** `.claude/get-shit-done/workflows/plan-phase.md`
**Current state (Step 5):** Full researcher spawn via `Task(subagent_type="gsd-phase-researcher")`. This is for upfront phase research, not inline question resolution. The planner receives RESEARCH.md and plans from it.

**Where inline questions surface:** In `gsd-planner.md`, the `<discovery_levels>` section (lines 56–72) defines when the planner researches. Level 2-3 signals (new library, architecture decision) route to "discovery workflow" — but that means DISCOVERY.md, not an inline loop. The planner has **no mechanism to surface a mid-planning technical question** back to the orchestrator. It either routes to discovery or proceeds.

**Hook point (two options, planner picks):**

Option A — plan-phase orchestrator, Step 5.5 (between current 5 and 5.5):
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

Option B is preferred (fewer round-trips, planner handles it autonomously) but requires adding loop-invocation capability to the planner agent prompt. Option A is an orchestrator change only (simpler, but introduces an extra spawn round-trip).

### Seam 3: micro_research_mode invocation contract

**File:** `agents/gsd-phase-researcher.md` lines 15–46

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

### Pitfall 4: Plan-phase wiring via orchestrator only (Option A) causes extra round-trip
**What goes wrong:** Planner raises an unknown → plan-phase orchestrator catches it → spawns loop → result fed back → planner re-runs from context. Two extra spawns + context reload.
**Why it happens:** Wiring at orchestrator level (Option A) rather than inside the planner (Option B).
**How to avoid:** Wire the loop inside `gsd-planner.md` in the `<mandatory_discovery>` step so the planner can invoke and receive the answer inline without returning to the orchestrator.

### Pitfall 5: Medium-confidence treated as Low
**What goes wrong:** Loop returns MEDIUM, then asks the user — defeating the round-trip reduction goal for the majority of questions (most real-world technical questions land MEDIUM, not HIGH).
**Why it happens:** Conservative threshold — treating MEDIUM as "insufficient to decide."
**How to avoid:** MEDIUM → decide autonomously with caveat. The human can always override. This is the critical behavior change vs. current micro_research presentation.

---

## Code Examples

### Current micro_research invocation (discuss-phase.md lines 292–299)
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
# Replace lines 302–306 of discuss-phase.md

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

### Signal-strength tag variants (from discuss-phase.md lines 52–56)
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

### 1. deep-research skill does not exist in this repo [CRITICAL — resolution required before planning]

**What we know:** CONTEXT.md and DISCUSSION-LOG cite `deep-research` (fan-out + adversarial-verify + cited synthesis) as the heavy-path research primitive that the loop reuses. A comprehensive `find` over project and global scope (`~/.claude/skills/`, `~/.agents/skills/`) found no such file. COMPARISON.md confirms `Skills: mine 0`. The discussion-phase AI appears to have made a forward-looking or mistaken attribution.

**What's unclear:** Whether the user intended to build `deep-research` as part of this phase (making it a Wave 0 prerequisite), or whether `gsd-phase-researcher` full mode (which multi-source searches, fetches, cross-verifies, and produces cited output) is a sufficient functional substitute.

**Recommendation:** Treat `gsd-phase-researcher` full mode as the heavy path. It already does multi-source research with cross-verification (see `gsd-phase-researcher.md` tool strategy + verification pitfalls sections). The only capability gap vs. a hypothetical `deep-research` skill is that it produces a RESEARCH.md artifact rather than inline cited text — the loop could capture the key finding from the researcher's structured return rather than the full file. Name this substitution explicitly in the plan; do NOT silently build a new `deep-research` agent (violates the "no new specialized agent" STRONG constraint).

**If the user confirms they want `deep-research` built:** that is a new capability and should be a Wave 0 or separate plan task with its own CONTEXT-level decision, since it contradicts "do not rebuild research capability" [STRONG].

### 2. Plan-phase inline wiring: Option A (orchestrator) vs Option B (planner-internal)

**What we know:** gsd-planner.md has no mechanism to surface mid-planning questions back to the orchestrator. The planner's `<discovery_levels>` routes Level 2-3 unknowns to "discovery workflow" (DISCOVERY.md), which is a separate spawn, not an inline loop.

**What's unclear:** Whether the loop should live in plan-phase.md orchestrator (Option A — easier but more round-trips) or inside gsd-planner.md discovery step (Option B — fewer round-trips, more invasive change).

**Recommendation:** Option B. Add the resolution loop call inside `gsd-planner.md`'s `<mandatory_discovery>` step as a Level 1.5 tier: "single known question with technical uncertainty — run resolution loop inline, no DISCOVERY.md." This eliminates the planner→orchestrator→loop→orchestrator→planner round-trip of Option A.

### 3. CONTEXT.md write-back for plan-phase resolved decisions

**What we know:** Discuss-phase already has `[STRONG, specialist-backed]` / `[WEAK, specialist-backed]` tags for resolved decisions. For plan-phase, there's no current mechanism to persist resolved technical decisions back to CONTEXT.md.

**What's unclear:** Whether the planner should append to CONTEXT.md (mutating an upstream artifact mid-plan), write to RESEARCH.md, or write to a new per-loop sidecar.

**Recommendation:** Append to the phase's CONTEXT.md `<decisions>` section. CONTEXT.md is already read by downstream agents (gsd-verifier, subsequent planners); appending there is the cheapest way to prevent re-asking. Add a comment block: `<!-- resolved inline by resolution loop [date] -->` to distinguish planner-added decisions from user-discussed ones.

---

## Sources

### Primary (HIGH confidence — direct file reads)
- `agents/gsd-phase-researcher.md` lines 15–46 — micro_research_mode full invocation contract verified
- `.claude/get-shit-done/workflows/discuss-phase.md` lines 274–317 — question_triage full block; LOW-confidence fallback at lines 302–306; budget throttle at line 316
- `.claude/get-shit-done/workflows/plan-phase.md` Steps 5/5.5/5.6 — full research path; verified no inline question handling
- `agents/gsd-planner.md` — discovery_levels; no inline Q surfacing mechanism confirmed
- `.planning/v1.4/phases/04-verification-harness-and-context-efficiency/04-AGENT-SPEC.md` — full loop contracts, verdict shapes, iteration ceiling=3, debug file convention
- `.planning/reference/COMPARISON.md` — Skills: mine 0, confirmed
- `find /home/cleversol -name "deep-research*"` + `find /home/cleversol/gsd2/core -name "*.md" | xargs grep deep.research` — confirmed deep-research absent from repo
- `ls ~/.claude/skills/ ~/.agents/skills/` — both absent (exit 2), no global skills

### Secondary (MEDIUM confidence)
- `.planning/v1.5/phases/02-autonomous-technical-resolution/02-DISCUSSION-LOG.md` — conversation record; confirms deep-research was presented as existing capability during discussion

---

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly set in `.planning/config.json` — treated as enabled.

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
| RSCH-01 | Loop raises LOW to HIGH/MEDIUM over ≤2 iterations without human input (mock researcher calls returning LOW then HIGH) | unit | `node --test tests/02-resolution-loop.test.cjs::loop_raises_confidence` | ❌ Wave 0 |
| RSCH-01 | Loop returns structured verdict `{confidence, recommendation, source, iterations_used, escalate}` | unit | `node --test tests/02-resolution-loop.test.cjs::verdict_shape` | ❌ Wave 0 |
| RSCH-02 | discuss-phase LOW branch triggers loop (not ask-user) for TECHNICAL questions | integration | `grep -E "resolution_loop|LOW.*escalate" .claude/get-shit-done/workflows/discuss-phase.md` | ❌ Wave 0 |
| RSCH-02 | plan-phase reaches loop for mid-planning unknown (level 2 discovery) without returning to orchestrator | integration | `grep -E "resolution_loop|inline.*loop" agents/gsd-planner.md` | ❌ Wave 0 |
| RSCH-03 | Loop skips STRONG-tagged decisions from CONTEXT.md (no spawn if STRONG match) | unit | `node --test tests/02-resolution-loop.test.cjs::strong_signal_skip` | ❌ Wave 0 |
| RSCH-03 | Resolved HIGH/MEDIUM decision written to CONTEXT.md with `[STRONG, specialist-backed]` or `[WEAK, specialist-backed]` tag | integration | `grep "\[STRONG, specialist-backed\]\|\[WEAK, specialist-backed\]" .planning/v1.5/phases/02-*/02-CONTEXT.md` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/02-resolution-loop.test.cjs`
- **Per wave merge:** `node --test tests/`
- **Phase gate:** Full suite green before `/gsd2:verify-work`

### Wave 0 Gaps
- [ ] `tests/02-resolution-loop.test.cjs` — covers RSCH-01 (unit: verdict shape, confidence raising), RSCH-03 (unit: STRONG skip)
- [ ] `tests/02-integration-wiring.test.cjs` — covers RSCH-02 (integration: discuss + plan wiring checks via grep/regex on modified workflow files)

---

## Metadata

**Confidence breakdown:**
- Integration mechanics (attach points, invocation contracts): HIGH — direct file reads with line citations
- Loop convergence shape: HIGH — Phase 4 AGENT-SPEC verified implemented
- Signal-strength tag semantics: HIGH — discuss-phase.md lines 50-62 read directly
- deep-research existence: HIGH (absent) — multi-source find + COMPARISON.md confirmation
- Plan-phase planner internals: HIGH — gsd-planner.md discovery_levels read directly

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable domain — GSD's own files; no external dependency churn)
