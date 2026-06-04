# Phase 2: Autonomous Technical Resolution - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

> **Reshaped during discussion.** This phase began as "General Research Agent" (port a `gsd-general-researcher` from gsd-core). The discussion surfaced that the fork already covers research three ways (discuss-phase micro-research, `gsd-phase-researcher` full mode, and the `deep-research` skill with adversarial verification), so a new agent would be a near-duplicate. The user reframed around a project-level north-star — *minimize the human round-trip* — and an explicit design bias — *loops/skills over a new agent per case*. ROADMAP Phase 2, REQUIREMENTS RSCH-01..03, and PROJECT.md Core Value were updated to match. See `.planning/cross-phase-notes.md` (2026-06-04) for the north-star that re-scores all phases.

<domain>
## Phase Boundary

Build an **autonomous technical-resolution loop**: when a technical or domain question arises in a GSD workflow, the system researches it, self-critiques the answer to a confidence threshold, and decides — instead of bouncing the question back to the human. The human is surfaced a technical question only when (a) confidence stays LOW after the loop exhausts, or (b) it is genuinely a preference/taste call. Wired into the two decision points that currently defer to the human: discuss-phase `question_triage` (including its LOW-confidence fallback) and plan-phase (which has **no inline research path today**).

**In scope:** the resolution loop (research → self-critique → confidence verdict); wiring it into discuss-phase and plan-phase; signal-strength honoring; recording resolved decisions with provenance/confidence.

**Out of scope:** a new general-researcher agent (explicitly rejected — loops over agents); rebuilding research capability (reuse `deep-research` + micro-research); core's AI-SPEC / `gsd-ai-researcher` / `gsd-domain-researcher` tier (a larger separate thing); a standalone research engine.

**Detected domain:** Agentic
**Evidence:** agent/loop wiring into discuss/plan workflows; `agents/` + workflow orchestration; keywords "research, loop, autonomous, resolve"
**Confirmed by user:** yes — and routed past `/gsd2:agent-spec-phase` deliberately (single-loop addition, no multi-agent topology warrants a formal AGENT-SPEC; identity captured here instead)
</domain>

<established>
## Established Patterns (from codebase)

- **Micro-research mode** (`gsd-phase-researcher.md` lines 15–46): specialist-in-the-loop for a single TECHNICAL question during discuss-phase. Inline plain-text return (Recommendation / Reasoning / Confidence / Source / Caveat), 15–30s, no artifact. **This is the seed the loop generalizes** — not a thing to duplicate.
- **`question_triage`** (`discuss-phase.md` lines 274–317): classifies each question PREFERENCE (ask user) vs TECHNICAL (spawn micro-research) vs HYBRID (research then present). Budget 0–5 micro-research calls/session. Confidence-based presentation: HIGH→state as fact, MEDIUM→informed suggestion, **LOW→"falls back to asking the user directly."** That LOW fallback is the round-trip the loop must eliminate where evidence allows.
- **`deep-research` skill**: fan-out web searches → fetch sources → **adversarially verify claims** → synthesize a cited report. Already implements the "critique/verify" instinct for heavy research — reuse, don't rebuild.
- **Verifier-loop primitives (Phase 4)**: `gsd-verifier`/`gsd-fixer` loop mode, max-3-iteration convergence, debug-file iteration tracking, confidence/verdict JSON shapes. The self-critique loop should mirror this proven shape (bounded iterations, structured verdict) rather than invent a new one.
- **Signal-strength tags** (`[STRONG]`/`[WEAK]`/`[DISCRETION]` + variants): the existing mechanism the loop reads to avoid re-opening decided questions.
- **`gsd-phase-researcher` full mode**: phase-implementation research → `RESEARCH.md`. Stays as-is; the loop does not replace it.
</established>

<decisions>
## Implementation Decisions

### Loop, not agent
- The deliverable is a **reusable resolution loop** (research → self-critique → confidence verdict), composed from existing capability — **no new specialized agent**. [STRONG — user stated the design bias explicitly: "more loops and skills... rather than create many many agents for every case"; authorized reshaping the roadmap around it]
- Reuse existing research capability for the heavy path and the existing micro-research shape for the light path; **do not rebuild research capability**. [STRONG — user's anti-redundancy ethos; verified triple-coverage of research already exists]
  - <!-- RESOLVED 2026-06-04 during plan-phase research (confidence: HIGH; source: subagent tool-grant inspection + 02-RESEARCH.md §Open Questions 1): "deep-research" exists only as a NATIVE harness skill, not callable from the gsd-planner/gsd-phase-researcher subagents (no Skill/Agent tool) where the loop runs. Heavy path = **orchestrator-spawned `gsd-phase-researcher` full mode** (portable, no native-skill dependency). User confirmed this reinterpretation of the [STRONG] decision — same intent (reuse, don't rebuild), reachable primitive. Consequence: the loop's research steps run at the **orchestrator** level (plan-phase / discuss-phase), NOT inside subagents (rules out the "loop inside gsd-planner" wiring). -->

### What the loop optimizes for
- **Reduce human round-trips.** The loop's success is measured by technical questions resolved *without* reaching the human, not by research artifact quality. LOW→HIGH confidence resolved autonomously = one fewer round-trip. [STRONG — the north-star; the entire reframe rests on this]
- The human is reached for a technical question only when confidence stays LOW after the loop exhausts its bounded iterations, or the question is genuine preference/taste. [STRONG — direct from north-star: "ask only the parts where my solution is really needed"]

### Wiring points
- **plan-phase** gains an inline technical-resolution path it lacks today (verified: plan-phase only has the Step-5 full RESEARCH.md fold, no inline question handling). [STRONG — this is the one verified, non-redundant gap]
- **discuss-phase `question_triage`** is tightened so the LOW-confidence branch runs the self-critique loop before defaulting to asking the human. [STRONG]

### Self-critique mechanism
- Mirror Phase 4's bounded-iteration verifier-loop shape (max iterations, structured verdict, debug trace) rather than invent a new convergence pattern. [WEAK — sensible reuse; planner may adjust the exact mechanism]

### Signal-strength honoring (criterion 3)
- The loop reads CONTEXT.md and does not re-open `[STRONG]`/`[STRONG, user-override]` questions; resolved technical decisions are recorded with confidence + source so they aren't re-asked downstream. [DISCRETION — mechanism largely determined by existing signal-strength infra; planner picks the storage/recording detail]

### Routing
- Skip `/gsd2:agent-spec-phase`; route straight to `/gsd2:plan-phase 2`. A single resolution loop has no multi-agent topology to justify a formal AGENT-SPEC. [STRONG — user selected "Skip AGENT-SPEC → plan directly"]
</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** When a technical/domain unknown comes up during discuss or plan, GSD resolves it itself (research → critique → decide) and continues, surfacing the answer as an FYI with its confidence + source. The human is no longer asked "which library / which approach / does X support Y."
- **Success signal:** A plan-phase run that hits a technical unknown completes without stopping to ask the human, with the resolved decision recorded and traceable. The discuss-phase LOW-confidence path resolves autonomously where evidence allows instead of falling back to a user question.
- **Flow:** Workflow hits a TECHNICAL/HYBRID question → loop researches (micro for quick, `deep-research` for heavy) → self-critiques to a confidence verdict over bounded iterations → if HIGH, decide and record + continue; if still LOW, *then* ask the human → decision honored downstream, never re-asked.
</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The capability being generalized (do not duplicate)
- `agents/gsd-phase-researcher.md` §`<micro_research_mode>` (lines 15–46) — the single-question inline research shape the light path reuses
- `.claude/get-shit-done/workflows/discuss-phase.md` §`<question_triage>` (lines 274–317) — PREFERENCE/TECHNICAL/HYBRID classification + the LOW-confidence-→-ask-user fallback the loop must replace
- `deep-research` skill — fan-out + adversarial-verify + cited synthesis; the heavy path. Reuse, don't rebuild.

### The convergence shape to mirror
- `.planning/v1.4/phases/04-verification-harness-and-context-efficiency/04-AGENT-SPEC.md` — bounded-iteration loop contracts (verifier/fixer/investigator), structured verdict shapes, debug-file iteration tracking
- `.claude/get-shit-done/workflows/plan-phase.md` §"Handle Research" (Step 5) — where plan-phase research currently lives; the inline path attaches near here

### Project framing
- `.planning/PROJECT.md` §Core Value — the minimize-human-round-trip operating principle (north-star)
- `.planning/cross-phase-notes.md` (2026-06-04 entry) — the north-star in full, with quotes and how-to-apply
- `.planning/reference/COMPARISON.md` §1.3 RESEARCH — gsd2-vs-core research divergence (why core's agent-roster approach is explicitly *not* being copied)
- `.planning/REQUIREMENTS.md` §Autonomous Technical Resolution (RSCH-01..03) — the reshaped, checkable requirements
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-phase-researcher` micro-research mode — the light-path research primitive; generalize its invocation beyond discuss-phase.
- `deep-research` skill — the heavy-path research+verify primitive; invoke for questions needing multi-source adversarial checking.
- Phase 4 verifier-loop primitives (`gsd-tools verify` commands, loop debug-file convention, max-3-iteration pattern, verdict JSON) — the convergence machinery to mirror.
- Signal-strength tag infra — already parsed across workflows; the loop reads it to skip decided questions.

### Established Patterns
- `question_triage` already classifies questions; the loop hooks into the TECHNICAL/HYBRID branch and the LOW-confidence fallback rather than adding a new classifier.
- Micro-research budget (0–5/session) is an existing throttle the loop should respect/extend.

### Integration Points
- discuss-phase: the LOW-confidence branch of `question_triage` (currently `discuss-phase.md` ~lines 302–306).
- plan-phase: a new inline path near "Handle Research" (Step 5) for questions arising mid-planning.
- CONTEXT.md write-back: resolved technical decisions recorded with confidence + source so the planner/verifier don't re-ask.
</code_context>

<specifics>
## Specific Ideas

- The user's "critique agent" instinct (research → critique → re-research) is **adopted as the self-critique half of the loop**, but scoped to confidence-raising for autonomous resolution — not built as a standalone reviewer agent, and not rebuilt where `deep-research` already adversarially verifies.
- North-star quote anchoring the phase: *"providing it only the parts where my solution is really needed."* The loop is the mechanism that decides what those parts are for technical questions.
</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- "Add user sync checkpoints to plan-phase subagent chains" — adjacent (touches plan-phase human interaction) but it's about *checkpoint* cadence, not technical-question resolution. Not folded; revisit if the plan-phase wiring naturally exposes a checkpoint seam.

### Out of scope (named in discussion, no home in v1.5)
- **UI not being tested** — standing pain; candidate for a future milestone/backlog, not this phase. [STRONG]
- **Context bloat at scale** (graph linking, RAG) — already captured as Phase 6/7 candidates in cross-phase-notes; the *context* half of the north-star partially lands in Phase 3 (CTX requirements).
- A standalone general-researcher agent, core's AI-SPEC tier — explicitly rejected by the reshape.
</deferred>

---

*Phase: 02-autonomous-technical-resolution*
*Context gathered: 2026-06-04*
