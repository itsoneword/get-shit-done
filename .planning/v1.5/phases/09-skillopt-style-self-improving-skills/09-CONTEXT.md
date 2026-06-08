# Phase 9: SkillOpt-Style Self-Improving Skills - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

**RESHAPED 2026-06-08** — from "SkillOpt-style offline batch-optimizer + eval substrate" to **online, feedback-driven skill evolution**.

GSD's skill/command/reference prose learns from **real failures observed during development**. When a shipped feature reveals a problem traceable to a GSD prose artifact, the lesson is captured, the responsible artifact is identified, a **bounded** edit is proposed, the human **ratifies**, and it commits to `get-shit-done/` source. Skills stop being static — they evolve from real project experience.

The loop: **observe real failure → reflect (was a skill at fault?) → propose bounded edit to that artifact → human-ratify gate → apply (commit to source) + record in lessons ledger.**

**Why the reshape (the discriminating analysis):**
- SkillOpt (arXiv 2605.23904) is *offline batch* optimization: a frozen agent's skill doc is the trainable state, optimized over epochs against a **held-out QA benchmark**, accepting an edit only on strict held-out score improvement.
- That requires an **eval substrate GSD does not have and cannot cheaply build**: (1) a graded train/val/test set of real GSD tasks — but the only real tasks are this repo's ~7 completed phases (**small-N**, almost nothing held out); (2) an **automated scorer** — the *faithful* signals (verifier BLOCKER/WARNING, convergence iterations, telemetry confidence) only exist by actually running execute+verify on a real phase (slow, costly, non-deterministic), and a loop needs hundreds of cheap re-scores. The *cheap* alternative (LLM-judge) is fast but, **in a closed-loop autonomous optimizer**, gameable (reward-hacking a proxy).
- The user's actual goal is **online continual** improvement during development, not offline batch optimization. In that model the two blocking tensions **dissolve**: the task + signal come free from real development (a real observed bug), no synthetic dataset is needed, and gameability largely evaporates because the signal is a *true failure* (not a number being maximized) and a *human ratifies* each edit.
- **What we give up:** the rigorous *quantitative* held-out gate. Replaced by human ratification + advisor-critic + (delegated) consolidation. Weaker guarantee, but one that fits a real project vs. a rigorous one we cannot feed.
- **The hard problem moves** from "build a scorer/benchmark" to **attribution** (which prose artifact is at fault) + **accretion control** (don't bloat skills with one-off lessons).

**Out of this phase:**
- The SkillOpt quantitative held-out optimizer / automated scorer / synthetic benchmark — dropped (see Deferred Ideas; revisit only if a real eval substrate ever materializes).
- Lesson/skill-edit **consolidation** (dedup, merge, prune stale edits) — delegated to the future semantic `/gsd2:doctor`.

**Detected domain:** Agentic
**Evidence:** `get-shit-done/workflows/` + agent prose targets (`gsd-planner`, `gsd-executor`, `gsd-verifier`); deliverable is a reflection/edit loop over agent/skill prose
**Confirmed by user:** not explicitly confirmed; domain is incidental — the deliverable is a command + loop + ledger, not a runtime multi-agent system

</domain>

<established>
## Established Patterns (from codebase)

- **Phase 4 telemetry** — `.planning/telemetry/agent-trace.jsonl` logs every gsd-* spawn (agent_type, description, desc_hash, scraped confidence, seq, session_id). Reader: `gsd-tools trace`. This is the attribution substrate (which agent produced a given artifact).
- **Source vs runtime split** — edits land in `get-shit-done/` (committed source); `.claude/get-shit-done/` is the gitignored runtime copy propagated by install. The loop commits **source only**.
- **`get-shit-done/references/` reference-doc family** (Phase 3/8) — `universal-anti-patterns.md`, `common-bug-patterns.md`, `tdd.md`, etc. One class of editable target artifact.
- **Agent/command/workflow prose** — `get-shit-done/agents/*` (currently empty dir; agents live elsewhere), `get-shit-done/workflows/*.md`, slash-command skills. The other classes of editable target.
- **`.planning/cross-phase-notes.md`** — append-only insight ledger; structural precedent for the lessons ledger.
- **`advisor` capability** — a higher-thinking critic layer; precedent for the reflection/edit-critic step (user gestured at "advisor or higher thinking layer").

</established>

<decisions>
## Implementation Decisions

### Core reshape
- Phase delivers an **online, feedback-driven skill-evolution loop**, NOT a SkillOpt offline batch optimizer + benchmark [STRONG — user reframed explicitly: "what we can do to get self evolving system when working on the project, rather than just rely on same prompts (skills) all the time"; concrete example: ship → test → find missing endpoint → teach the skill "don't miss"].
- SkillOpt *discipline* is retained where cheap: **bounded** add/delete/replace edits, an **explicit accept-gate**, **git-reversible** application. The benchmark/scorer is dropped.

### Capture surface
- **Both — manual `/teach` primary, auto-miner suggests** [STRONG — explicitly selected].
  - **Manual (trusted, lands lessons):** user invokes a command (e.g. `/gsd2:teach "executor missed the endpoint"`) when they spot a real issue. Deliberate, high-signal, low-noise.
  - **Auto-miner (suggests only, never edits):** a secondary suggester harvests recurrence from the lessons ledger / existing GSD events (verify-work BLOCKERs, debug sessions, fix commits, telemetry dips) and nominates — e.g. "seen this 3×, bank a lesson?". It **never edits on its own**; everything routes through the manual gate.

### Gate autonomy
- **Always propose, human ratifies every edit** [STRONG — explicitly selected; user is editing the framework's own brain, wants control]. Each edit is a proposed diff approved before it touches `get-shit-done/` source.
- The human gate is the **primary bloat guard** — junk edits are rejected at ratification.
- Note: this is the *one* human round-trip the PROJECT north-star keeps — lessons are rare + high-value, and the edit rewrites GSD's steering prose, so ratification is judgment only the human owns.

### Attribution (the hard problem)
- **Loop proposes target from telemetry + produced artifact; user confirms** [STRONG — explicitly selected]. e.g. `/teach 'missed endpoint'` → loop reads Phase 4 telemetry (which agent ran) + the artifact → "looks like a gsd-executor issue — edit executor prose?" → user confirms or redirects.
- Lowest attribution burden on the user; fits manual-primary + ratify.

### Accretion / bloat control
- **Delegated to the future semantic `/gsd2:doctor`** [STRONG — explicitly selected]. This phase ships capture → gate → apply **+ the lessons ledger**. Periodic consolidation (dedup, merge redundant lessons, prune stale skill edits) is the doctor's job — already scoped as the stale-decision healer. Keeps this phase small + focused.

### Lessons ledger
- Lessons persist in a small **`.planning/lessons/`** ledger (exact path/format at plan time) [STRONG, implied — not objected; **required** because the auto-miner's "seen 3×" recurrence count cannot exist without a persistent store]. Audit trail + dedup substrate + recurrence counter. Ratified lessons become skill edits; the ledger records both the lesson and its disposition.

### Reflection / edit-proposal engine
- An **advisor-style critic** drafts + sanity-checks the bounded edit diff before the user sees it [DISCRETION — user gestured at "advisor or higher thinking layer"; exact agent/model picked at research time]. Reflection answers "was a skill genuinely at fault, and what is the minimal prose change that prevents recurrence?"

### Claude's Discretion
- Exact `/teach` command name + invocation surface (standalone command vs flag on `fix`/`verify-work`).
- Lessons ledger file format + schema.
- Which existing events the auto-miner harvests first (verify-work / debug / fix / telemetry) and the recurrence threshold.
- The reflection agent/model and the diff-proposal mechanics.
- Edit-bound definition (max size / shape of "bounded").

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** GSD has a `/gsd2:teach` command (+ a secondary auto-miner that nominates recurring failures). When the user hits a real failure during development, they invoke it; the loop reads Phase 4 telemetry + the produced artifact to propose *which* GSD prose is at fault and a *bounded* edit to it; the user ratifies; it commits to `get-shit-done/` source. Lessons persist in a `.planning/lessons/` ledger.
- **Success signal:** A real lesson from a real bug lands as a committed, bounded, ratified edit to the correct GSD artifact — and that class of mistake is now guarded against in the prose. Skills evolve from real project experience, not static prompts.
- **Flow:** ship → test → find problem → `/gsd2:teach` → loop proposes target + bounded edit (advisor-critiqued) → user ratifies → committed to `get-shit-done/` source; lesson recorded in ledger.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Inspiration / prior art
- SkillOpt — arXiv 2605.23904, github.com/microsoft/SkillOpt — the *spirit* (skill doc as trainable state; rollout→reflect→bounded edit→gate→update). **NOTE:** arXiv ID postdates the assistant knowledge cutoff (Jan 2026) — research must fetch the actual paper/repo; do NOT rely on recalled specifics. We adopt the *discipline* (bounded edits, accept-gate, reversibility), NOT the offline-benchmark mechanism.

### Attribution substrate (load-bearing)
- `hooks/gsd2-agent-trace.js` + `.planning/telemetry/agent-trace.jsonl` (Phase 4) — the spawn/confidence telemetry the loop reads to attribute a failure to an agent.
- `gsd-tools trace` reader (Phase 4) — telemetry query surface.

### Editable target artifacts (the things the loop edits)
- `get-shit-done/references/*.md` — reference docs (lowest-blast-radius edit class).
- `get-shit-done/workflows/*.md` — command/workflow prose.
- GSD agent prose (`gsd-planner`, `gsd-executor`, `gsd-verifier`, …) — highest-blast-radius (steers behavior).

### Ledger precedent
- `.planning/cross-phase-notes.md` — append-only insight ledger; structural model for `.planning/lessons/`.

### Soft reference (NOT a hard dependency post-reshape)
- Phase 8 validated-example corpus (`get-shit-done/references/validated-examples/` once built) — good-code grounding when proposing a "what good looks like" edit. Optional, not a blocker.

### Forward dependency
- Future semantic `/gsd2:doctor` — inherits lesson/skill-edit consolidation (dedup/merge/prune). Reserved command name (see cross-phase notes; do NOT capture it here).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 4 telemetry (`agent-trace.jsonl` + `gsd-tools trace`) — attribution input.
- `advisor` higher-thinking layer — reflection/edit-critic precedent.
- `.planning/cross-phase-notes.md` append-only pattern — ledger structural template.
- `gsd-tools commit` + git — reversible source-edit application.

### Established Patterns
- Source→runtime install propagation: commit only `get-shit-done/...`; `.claude/...` is gitignored runtime.
- Human-ratify-before-source-edit mirrors the migration / `[y/N]` confirmation posture already used elsewhere (e.g. `migrate-to-milestone-partition`).
- On-demand reference loading keeps context lean (Phase 3/8) — applies to how a lessons-derived reference edit is consumed.

### Integration Points
- New `/gsd2:teach` command (workflow + skill registration).
- New `gsd-tools` subcommand(s) for the lessons ledger (append / list / mark-recurrence) and possibly the auto-miner.
- Reads Phase 4 telemetry; writes `.planning/lessons/`; proposes diffs against `get-shit-done/`.

</code_context>

<specifics>
## Specific Ideas

- User's concrete motivating example: "we work on the feature, after execution it ships as ready, then I test and find a problem with backend implementation (e.g. missing endpoint). It is easy to fix, but may be also worth to add information to skill which wrote this: like do not miss?"
- "Get self evolving system when working on the project, rather than just rely on same prompts (skills) all the time" — the north star for this phase.
- On gameability: user argued LLM-judge + advisor "sounds like better than nothing for eval" — correct *for this online model* (no autonomous score-maximizer; real signal; human ratifies). Gameability was a property of the dropped batch-optimizer.

## Noted research risks (not discuss decisions)
- **Self-editing blast radius:** the loop edits GSD's *own* steering prose in *this* repo. Bounded edits + human ratify + git-reversibility are the guards; research should still treat a bad ratified edit silently degrading a skill as a live failure mode.
- **Overfit to one-off failures:** a single bug may not warrant a permanent rule. The auto-miner's recurrence count + human gate mitigate; consolidation (doctor) is the longer-term answer.

</specifics>

<deferred>
## Deferred Ideas

- **SkillOpt quantitative optimizer** — offline batch loop with a held-out automated scorer (verifier/convergence/telemetry signals) and synthetic train/val/test tasks. Dropped this phase (blocked on small-N data + cheap-vs-faithful scorer). Revisit only if a real eval substrate ever materializes.
- **Lesson/skill-edit consolidation** (dedup, merge, prune stale edits) → future semantic `/gsd2:doctor`.
- **Auto-apply / tiered-autonomy gate** — considered, rejected for v1 in favor of always-ratify. Could revisit (tiered by artifact blast radius) once the loop is trusted.
- **Reusable example-mining workflow/CLI** (`/gsd2:mine-examples`) — carried over from Phase 8 deferral; not part of this loop.

</deferred>

---

*Phase: 09-skillopt-style-self-improving-skills*
*Context gathered: 2026-06-08*
