# Phase 3: Execution-Detail Enrichment - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers **codified anti-pattern / bug-pattern reference docs (including Python)** that the planner and verifier draw on, so plans and verifications measure code against a shared "what good/bad code looks like" standard instead of improvising.

**RESHAPED 2026-06-04** — the original phase also included a context-budget cluster (degradation tiers + a `gsd-health` utilization classifier). That cluster was reshaped OUT of this phase during discussion (see Implementation Decisions → Context cluster reshape, and Deferred Ideas → doctor phase). Phase 3 is now GUIDE-only.

**Detected domain:** Generic
**Evidence:** tooling/reference-doc phase — new prose docs under `references/` + wiring into existing workflows; no UI; the (former) classifier was a small CLI function, not an agent
**Confirmed by user:** n/a (LOW-confidence domain detection → Generic, no confirm prompt)

</domain>

<established>
## Established Patterns (from codebase)

- **Reference docs live in `.claude/get-shit-done/references/`** — `AGENTIC-PATTERNS.md`, `verification-patterns.md`, `tdd.md` set the precedent. New docs go here. (Placement decided — not a gray area.)
- **Two loading idioms already in use:**
  - **Eager** — `@/…/references/X.md` at the top of a workflow loads it into context every run. Example: `verify-phase.md:21` eager-loads `verification-patterns.md`.
  - **On-demand** — `"Read /…/references/X.md when …"` lets the model pull it only when relevant. Example: `execute-plan.md:194` references `tdd.md`; `agent-spec-phase.md:89` "Read … for topology patterns."
- **`context_window` is a static config field** (`bin/lib/core.cjs:70` default 200000, 1000000 for 1M models; surfaced via `init.cjs:58`) — a declared capacity, NOT a live usage signal. (This is why the read-depth tiers had no consumer once the classifier was dropped.)
- **`gsd-health` = `gsd-tools validate health`** (`gsd-tools.cjs:571`), with a `--repair` flag — structural integrity check today.

</established>

<decisions>
## Implementation Decisions

### Reference doc placement & format
- Docs land in `.claude/get-shit-done/references/` — follows the established convention. [STRONG — established codebase pattern]
- Mirror the gsd-core source filenames/scope: a universal anti-patterns doc and a common bug-patterns doc ("what good vs bad code looks like"). Pure prose, no runtime deps. [WEAK, source-backed — port from `COMPARISON.md` §"Bonus (idea#3)"]

### Loading strategy — HYBRID
- **Verifier eager-loads (`@`) the bug-pattern doc** — bad code matters most at verify time, so guarantee it's in context. [STRONG — user chose Hybrid explicitly]
- **Planner references the anti-pattern doc on-demand** ("Read when relevant", mirroring `tdd.md`) — keeps planning context lean, honoring the project context-bloat north-star. [STRONG]
- Rationale: balances GUIDE-01's "docs are applied" against the keep-context-tiny operating principle. Eager-everywhere was rejected (token cost every run); on-demand-everywhere was rejected (model can skip under pressure).

### Python content scope
- Include a Python-specific section/doc covering **idioms, anti-patterns, and typing conventions** alongside the language-agnostic material. [WEAK — user accepted the scope as framed; GUIDE-02]

### Context cluster reshape (CTX-01, CTX-02 removed from Phase 3)
- **The human-facing context-utilization classifier (CTX-02) is dropped.** The user explicitly rejected a "you're at N% context" warning: *"there is no need to inform me about it. There is only need to fix it. And it is what I already addressed previously."* [STRONG — emphatic, reasoned]
- **The degradation-tiers / read-depth reference doc (CTX-01) is dropped too** — its read-depth rules were meant to key off a *live* context %, which was CTX-02's job. With the classifier gone and `context_window` being only a static config field, CTX-01 would be an orphan doc nobody loads — keeping it would itself add context for no consumer. [STRONG — technical consequence, confirmed with user]
- **The keep-context-tiny goal is met structurally instead** — keep only the latest state in active docs; move superseded decisions to prior versions so `/progress` loads minimal content. Partly already in flight (milestone partitioning, distillation). [STRONG]
- Both CTX requirements are marked **Reshaped → doctor phase** in REQUIREMENTS.md and ROADMAP.md.

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** `references/` contains anti-pattern + bug-pattern docs (with Python content). The verifier automatically has the bug-pattern standard in context; the planner can pull the anti-pattern standard on demand. Plans/verifications cite a shared good/bad-code standard.
- **Success signal:** Running a verify pass references concrete bug-pattern criteria; a plan can pull anti-pattern guidance without it being forced into every run. No human-facing context-% machinery exists (by design).
- **Flow:** planner plans → (optionally reads anti-pattern doc when code-quality judgment is needed) → executor builds → verifier runs with bug-pattern doc already loaded → checks code against it.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Port source
- `.planning/reference/COMPARISON.md` §"Bonus (idea#3 best fit): Anti-Pattern & Bug-Pattern References" (~line 1148) — names the source docs (`universal-anti-patterns.md`, `common-bug-patterns.md`, `planner-antipatterns.md`) and confirms "pure prose, no deps, add Python."
- `.planning/reference/COMPARISON.md` §"Context-Budget / Engineering Maturity" (~line 1077) — the (now reshaped-out) CTX source; read only for the doctor phase, not Phase 3.

### Loading-idiom exemplars (how to wire the docs)
- `.claude/get-shit-done/workflows/verify-phase.md:21` — eager `@`-load pattern (model for the bug-pattern doc).
- `.claude/get-shit-done/workflows/execute-plan.md:194` — on-demand "See path" pattern (model for the anti-pattern doc).

### Requirements
- `.planning/REQUIREMENTS.md` — GUIDE-01, GUIDE-02 (active); CTX-01, CTX-02 (Reshaped → doctor).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing `references/*.md` docs (`AGENTIC-PATTERNS.md`, `verification-patterns.md`, `tdd.md`) — structural/tone template for the new docs.
- The `@path` vs "Read path" loading idioms — both already used; reuse, don't invent a new mechanism.

### Established Patterns
- Workflows reference docs by **absolute path** (`/home/cleversol/gsd2/mine/.claude/get-shit-done/references/…`) — match this when wiring the new docs.

### Integration Points
- **Verifier:** add an eager `@`-load of the bug-pattern doc in `workflows/verify-phase.md` (alongside `verification-patterns.md`).
- **Planner:** add an on-demand pointer to the anti-pattern doc in the planner workflow (`workflows/plan-phase.md`) — currently has NO anti-pattern/good-code reference (confirmed via grep).

</code_context>

<specifics>
## Specific Ideas

- User's framing of the underlying problem: *"keep only the latest state in the documentation and all the previous decisions … move them to the previous versions. So the progress will then only show the smallest documentation."* — This is the doctor's job, not Phase 3's; captured here so it's not lost.

</specifics>

<deferred>
## Deferred Ideas

### The "doctor" phase (new — add to roadmap; this milestone or next)
- An **agent-assisted health/heal command** that reads the planning docs, detects decisions that were **documented and later overwritten/superseded**, and heals by archiving superseded ones to prior versions — keeping active context tiny.
- **Not greenfield:** a *semantic* extension of the existing `/gsd2:health` (diagnose) + `gsd-tools validate health --repair` (structural). Fold health into doctor.
- Inherits the reshaped CTX-01 / CTX-02 intent (keep-lean), though NOT CTX-02's token-% thresholds (doctor measures stale-decision count, not token %).
- Honor the Phase 2 north-star design bias: a skill + bounded agent loop, not an agent zoo.
- Captured in `.planning/cross-phase-notes.md` (2026-06-04). To be formally captured via `/gsd2:plant-seed` after this discussion.

</deferred>

---

*Phase: 03-execution-detail-enrichment*
*Context gathered: 2026-06-04*
