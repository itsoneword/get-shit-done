# Phase 6: Skill Self-Sufficiency — Audit and Port superpowers Gaps - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

GSD natively covers the capability gaps the (now-disabled) `superpowers` Claude Code plugin filled, so the external dependency can be dropped without losing capability. Scope: (1) a written coverage audit of all 14 superpowers skills, and (2) porting the *genuine* gaps into GSD as native artifacts loaded through normal GSD flow.

**In scope:** audit doc + porting the confirmed gaps (execution-time TDD discipline, receiving-code-review, writing-skills→GSD-authoring guide, worktree-isolation *technique*).
**Out of scope:** hard-removal of the superpowers plugin cache + `installed_plugins.json` registry entry (explicit follow-up); the execute-phase worktree add→wave→merge *orchestration* and parallel-safety gate (those are **Phase 7** scope item 1).

**Detected domain:** Generic
**Evidence:** meta-work on the GSD framework itself (porting references/workflow edits); no UI structural signals; not a new agentic-system design (no topology/communication-contract work)
**Confirmed by user:** not prompted (Generic → no confirm prompt)

</domain>

<decisions>
## Implementation Decisions

### Coverage audit (success criterion #1)
- A written audit maps each of the 14 superpowers skills to either an existing GSD command/reference (covered) or a concrete port target (gap), with rationale. [STRONG — explicit success criterion]
- Verdicts (scouted this session):
  - **Covered:** brainstorming→discuss-phase; writing-plans/executing-plans→plan/execute-phase; subagent-driven-development + dispatching-parallel-agents→wave executor; verification-before-completion→verify-work/gsd-verifier; requesting-code-review→gsd2:review; finishing-a-development-branch→ship/pr-branch.
  - **Covered (verified this session):** systematic-debugging → `gsd-debugger` already implements scientific method (hypothesis→test→root-cause-before-fix) with a persistent debug session file. No port needed. [STRONG, specialist-backed — confidence: HIGH, source: agents/gsd-debugger.md scout <!-- resolved inline by resolution loop -->]
  - **N/A:** `using-superpowers` is the plugin's own meta-skill — irrelevant once the plugin is dropped.
  - **Gaps to port:** test-driven-development (execution-time discipline), receiving-code-review, writing-skills, using-git-worktrees (technique).

### Gap 1 — Execution-time TDD discipline
- **Default-ON where it helps, NOT a blanket requirement.** The planner tags TDD-worthy tasks (business logic / parsing / algorithms / validation — the existing `tdd.md` heuristic) `tdd=true` by default; trivial implementations and **agent/prompt/workflow-only changes** are exempt. [STRONG — user gave detailed, nuanced reasoning]
  - User's rule (verbatim sense): use TDD "there where it could be helpful and not just do it because it is a hard requirement." Skip when the implementation is trivially simple, or when the change is to *agent logic via prompt/tools* rather than code — "it is not always possible to make the correct tests for that. Although if it is possible it would always be good."
  - **GSD-specific exemption to add to `tdd.md`:** agent/prompt/workflow/reference edits where behavior is not unit-testable. This is a large fraction of GSD's own work — the heuristic must name it explicitly so the planner doesn't force-tag it.
- **When `tdd=true`, the discipline is enforced, not loose.** Port the superpowers Iron Law rigor into the executor's TDD flow: NO production code without a failing test first; watch-it-fail is MANDATORY (a test that passes immediately is wrong); rationalization table + red-flags list so the agent self-checks under pressure. [STRONG]
- Form factor: edit `references/tdd.md` (add Iron Law + watch-it-fail + rationalization/red-flag counters + the agent-change exemption) and the `gsd-executor` `<tdd_execution>` block; extend the planner's TDD-tagging heuristic. No new command.

### Gap 2 — receiving-code-review
- Port as a GSD **reference** on consuming review feedback critically: verify-before-implement, restate the requirement (no performative agreement / no "you're absolutely right" / no gratitude), push back with technical reasoning when the suggestion is wrong for this codebase, YAGNI-check "implement properly" suggestions, and clarify ALL unclear items before implementing any. [STRONG — directly reinforces the user's standing no-sycophancy / neutral-tone preference]
- Loaded at the review-**consumption** points: when acting on `gsd2:review` output (REVIEWS.md), in `gsd2:ship`'s review step, and when consuming external PR review comments. GSD today only *requests* review — it has nothing on how to *receive* it.
- Form factor: reference + wiring edits to the review/ship flow. No new command.

### Gap 3 — writing-skills → GSD artifact-authoring guide
- Port as a GSD reference that codifies two things: **(a) when a capability deserves its own dedicated artifact (reference / tool / agent / workflow edit) vs. being left to Opus inline** — the optimization judgment the user described as "the orchestrator's call"; and **(b) how to author that artifact so the model actually loads and obeys it** — description = *when to use*, never a workflow summary (else the model follows the blurb and skips the body); one excellent example over many; close rationalization loopholes explicitly; don't codify what a regex/validation can enforce. [DISCRETION → Claude's recommendation; user deferred: "can you decide what better fits to general concept?"]
- Rationale: this is the only framing that turns the user's stated meta-principle (encode the *right way* to answer a recurring question; add an artifact only when it raises quality enough to justify the cost; bias to loops/skills over command/agent proliferation) into something the decision-making model can load — instead of leaving it implicit in the user's head. It also serves this phase directly (we are authoring ports).
- Form factor: a single reference. No new command.

### Gap 4 — using-git-worktrees (technique only)
- Port the **technique** as a GSD reference: detect-existing-isolation first, prefer native worktree tools, git-worktree fallback, verify the worktree dir is gitignored, run a clean baseline test, sandbox-permission fallback (work in place). [DISCRETION → Claude's recommendation; user said either option fine]
- **Boundary with Phase 7 (important):** Phase 7 owns the `execute-phase` worktree add→wave→merge *orchestration* and the parallel-safety gate (its scope item 1). Phase 6 delivers only the reusable *technique/primitive* that Phase 7 wires in. A gsd-tools helper is deliberately NOT built now — it would guess at an API Phase 7 hasn't defined. [STRONG on the boundary — derived from Phase 7 roadmap depends-on note]
- This supersedes SEC-DEFER-01's rationale ("user doesn't rely on worktree isolation"): the Phase-7 parallelization design now makes worktree isolation load-bearing. User: "we decided that for parallelization it's needed to use the worktree isolation so let's keep it and let's do it."

### Form-factor principle (applies to all gaps)
- **References + workflow/agent edits; no new commands.** [STRONG — user's loop/skill philosophy + PROJECT.md anti-proliferation bias + REQUIREMENTS Out-of-Scope "extra phase modes… each is a command to maintain"]
  - User's framing: a *skill* encodes the right way to answer a recurring question about an output; a *loop* applies that skill back to the model. The bias trades slight token/time cost for significantly higher quality. The failure mode it targets: "the model has a question which it simply answers without proper research" mid-execution/planning — skills fix that by encoding the right answer shape.

### Claude's Discretion
- Exact file names/locations for the new references (under `get-shit-done/references/`, mirrored to runtime per the source↔runtime path rule).
- Audit doc location/format (phase dir; a table is sufficient).
- Whether the TDD Iron Law content lives inline in `tdd.md` or in a sibling reference cross-linked from it.

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** GSD contains native references + workflow/agent edits covering the four confirmed gaps, plus a written 14-skill audit. The superpowers plugin can stay disabled with no capability loss (hard-removal is a separate follow-up).
- **Success signal:** A representative `plan → execute` run exercises the ported TDD discipline, review-reception rigor, and worktree technique with **no** superpowers skill available — and the audit shows every one of the 14 skills is either covered or ported.
- **Flow:** Audit all 14 skills → confirm the 4 gaps (TDD, receiving-review, writing-skills, worktree-technique) → port each as a reference/edit loaded through normal GSD flow → verify a plan→execute cycle uses the ported behavior unaided.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### superpowers source skills (mining input — read to port faithfully)
- `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/test-driven-development/SKILL.md` — Iron Law, watch-it-fail, rationalization table, red flags (Gap 1)
- `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/receiving-code-review/SKILL.md` — response pattern, forbidden performative responses, YAGNI check, push-back rules (Gap 2)
- `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/writing-skills/SKILL.md` — CSO (description = when-not-what), one-good-example, loophole-closing, when-to-create (Gap 3)
- `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/using-git-worktrees/SKILL.md` — detect-isolation, native-first, git fallback, ignore-check, baseline test, sandbox fallback (Gap 4)
- All 14 skills live under `.../5.1.0/skills/` — the audit must enumerate every one.

### GSD integration targets (edit points)
- `.planning/../get-shit-done/references/tdd.md` — current plan-time TDD reference; gains Iron Law + execution-time discipline + agent-change exemption
- `get-shit-done/agents/gsd-executor.md` §`<tdd_execution>` (~L216) — executor's TDD flow; gains watch-it-fail enforcement
- `get-shit-done/workflows/plan-phase.md` — planner TDD-tagging heuristic (extend to default-tag logic tasks, exempt agent/prompt edits)
- `get-shit-done/workflows/review.md` + `get-shit-done/workflows/ship.md` — review-consumption wiring point for the receiving-code-review reference
- `get-shit-done/agents/gsd-debugger.md` — evidence that systematic-debugging is already covered (no edit; audit citation)

### Project principles (constrain form factor)
- `.planning/PROJECT.md` Core Value — minimize human round-trips; loops/skills over agent/command proliferation
- `.planning/REQUIREMENTS.md` Out of Scope — "extra phase modes… each is a command to maintain" (no new commands bias)
- `.planning/cross-phase-notes.md` — Phase 4 note "making TDD default-ON is a separate concern" (now addressed here); Phase 7 worktree design

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `references/tdd.md`: already defines RED-GREEN-REFACTOR, TDD-plan structure, when-to-use heuristic, framework setup. Gap 1 extends it (Iron Law + enforcement + agent-change exemption) rather than replacing it.
- `gsd-executor` `<tdd_execution>` block: already runs RED→GREEN→REFACTOR for `tdd="true"` tasks. Gap 1 hardens it (mandatory watch-it-fail, rationalization counters).
- `gsd-debugger`: scientific-method investigator with persistent session file — already absorbs systematic-debugging.
- `gsd2:review` → REVIEWS.md (cross-AI external review): the producer side. Gap 2 adds the consumer-side discipline.

### Established Patterns
- **Source↔runtime mirror rule** (from Phase 3/4): edit `get-shit-done/` source AND `.claude/get-shit-done/` runtime; agent files use `~/.claude/` token in source vs absolute path in runtime; only source is committed (runtime gitignored). All ported references must follow this.
- References are loaded via `@path` includes in workflows/agents (eager) or read on-demand. New references attach at the right consumption point, not globally.

### Integration Points
- TDD: planner (tag) → executor (enforce) → `tdd.md` (the shared standard).
- Receiving-review: `review.md` / `ship.md` consumption steps.
- Worktree: Phase 6 reference ← consumed by → Phase 7 `execute-phase` orchestration.

</code_context>

<specifics>
## Specific Ideas

- "Use [TDD] there where it could be helpful and not just do it because it is a hard requirement to do it all the time." — the governing principle for Gap 1.
- On agent changes: "Sometimes we need to adjust the agent's logic by the prompt and tools, and it is not always possible to make the correct tests for that. Although if it is possible it would always be good." — the TDD exemption.
- On the loop/skill bias: "skills allow us to answer the question about the given output in the right way… the loop allows us to apply this skill back to the model… slightly increase token usage / execution time but significantly increase quality." — the form-factor north star.
- On adding artifacts: "every action has its own dedicated number of tools, skills, agents… we need to be optimal in terms of separating the task… enhanced by additional skills and tools only when it's needed. And if it's needed or not, it's for the orchestrator, for Opus, to decide." — the core of the writing-skills port.

</specifics>

<deferred>
## Deferred Ideas

- **Worktree orchestration in execute-phase (add→wave→merge) + parallel-safety gate** — Phase 7 scope item 1, not Phase 6. Phase 6 ships only the technique reference.
- **Hard-removal of the superpowers plugin** (cache + `installed_plugins.json`) — explicit follow-up after this phase proves coverage. (Roadmap Out of Scope.)
- **Full default-ON TDD for all production code** — rejected; user wants default-where-helpful, not blanket.

</deferred>

---

*Phase: 06-skill-self-sufficiency-audit-and-port-superpo*
*Context gathered: 2026-06-06*
