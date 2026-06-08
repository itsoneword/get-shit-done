# Cross-Phase Notes

> Insights from phase discussions relevant to other phases. Each session appends here.

---

### From Phase 4 discussion (2026-05-05)

**For future MCP/browser-capability phases:**
- User showed strong interest in Playwright MCP server as a way to give Claude Code direct browser-control tools (browser.click, browser.fill, browser.screenshot)
- Quote: "for mcp server - interesting. we will need to learn how it works and will may have as a result a possibility to rule browser from claude code? sounds cool!"
- Signal: [STRONG] — forward-looking enthusiasm, explicitly deferred from Phase 4 because of scope but earmarked for v2
- Context: came up while scoping UI verification in the verifier loop. Phase 4 schema (`type: ui` in must_haves verify block) is designed so Playwright MCP integration later is a config change, not architectural

**For future test-phase / TEST-SPEC.md changes:**
- Phase 4 chose to author verify commands directly in PLAN.md `must_haves:` rather than extending TEST-SPEC.md
- Rationale: TEST-SPEC.md isn't always present; coupling verification harness to test-phase being run was avoided
- If test-phase is later enhanced to produce executable scenarios, Phase 4's must_haves verify schema is the natural consumer
- Signal: [STRONG] — explicit deferral

**For future executor-level TDD enhancement:**
- gsd-executor already has TDD support but it's opt-in per task (`tdd="true"`)
- User implicitly acknowledged making TDD default is a separate concern from verification harness
- Worth its own scoping conversation: making TDD default-ON parallels Phase 4's verify_after default-ON decision
- Signal: [STRONG] — out-of-scope decision for Phase 4

---

### From Phase 5 discussion (2026-05-10)

**For Phase 6: Graph-based linking (new — add to roadmap)**
- User framing: partitioning (Phase 5) is a workaround for the underlying "load too much context" problem. The structural fix is a graph linking decisions, phases, requirements, with weights/types — so commands can traverse only what's relevant instead of loading everything in scope.
- Quote: "if we have the system allowing us to link things to each other in the right way, like a graph, when we could have some weights or tags... we already have something like this with all these tags for the verification of the process and criteria of success."
- Signal: [STRONG] — user explicitly described the architecture and pointed at existing tag infrastructure as the seed
- Context: came up while scoping Phase 5. User asked whether graph belongs inside Phase 5 or as a separate phase. Decision: separate (Phase 6) so Phase 5 can ship; but Phase 5's distillation artifact and decision-log format are designed graph-friendly (typed tags, explicit links) so Phase 6 indexes existing structure rather than retrofitting.
- Substrate Phase 6 will consume: `MILESTONE-{version}-SUMMARY.md` distill artifacts, structured decision logs, requirement IDs, phase IDs (newly milestone-versioned).

**For Phase 7: RAG / semantic retrieval (new — add to roadmap)**
- User framing: even with graph (Phase 6), at large enough scale "we still come to the point where we need all these files" loaded. Then semantic search beats traversal — retrieve only the chunks actually relevant to the question.
- Signal: [STRONG] — user explicitly named it as the long-tail solution after partition + graph
- Context: same conversation as Phase 6 framing. Acknowledged as further-out than Phase 6 — only worth building once graph traversal hits its limits.

**For any future workflow that loads multiple phases:**
- Phase 5 is changing the layout to `.planning/{milestone}/phases/...`. After Phase 5 lands, do not iterate `.planning/phases/*` — go through `gsd-tools init` outputs (extended fields will include milestone partition root). Hardcoding old paths in workflows will break post-retrofit.
- Signal: [STRONG] — directly implied by Phase 5 scope

---

### From Phase 2 discussion (2026-06-04)

**PROJECT-LEVEL north-star — re-scores ALL phases, not just Phase 2 (now in PROJECT.md Core Value):**
- The bottleneck is the human in the loop, not the model. Two failure modes: (1) **latency** — every Claude→human round-trip stalls a fast system on a slow human, and most of those questions the model could answer itself; (2) **context** — no human holds 10 objectives × 10 plans × 10 details, so GSD's job is to feed just-enough context and ask the human ONLY for judgment they uniquely own (taste, preference, intent — never "which technical approach").
- Quote: "the weakest part of the system is me actually... instead of working on something we now just wait super slow human." / "providing it only the parts where my solution is really needed."
- **Design bias the user stated explicitly:** "we need more loops and skills on [agents], rather than... create many many agents for every case." The week lost wiring 5–10 agents to write simple CV text is the anti-pattern.
- Signal: [STRONG] — extended, emphatic, reasoned; user authorized reshaping the roadmap around it.
- **How to apply to every future phase:** score each feature by "does it reduce human round-trips / human context-load, reserving the human for genuine judgment?" Prefer loops/skills that raise model autonomy over new special-case agents. Where a workflow currently asks the human a technical/factual question, ask whether the model could resolve it instead.

**For Phase 3 (Execution-Detail Enrichment) specifically:**
- The CTX requirements (context-budget tiers, utilization classifier) and the user's "100k-token /progress" pain are the *context* half of the north-star. Score Phase 3's context work against "keep the human oriented with less loaded," not just "add reference docs."
- Signal: [STRONG] — the context-bloat pain was named directly as a current top problem.

**For future milestone candidates (not this milestone):**
- **UI not being tested** is a named live pain with no home in v1.5 — candidate for a future milestone or backlog. Context bloat at scale (graph linking, RAG) is already captured in the Phase 5 notes above (Phase 6/7 candidates).
- Signal: [STRONG] — "the UI, it's not tested" stated as a standing problem.

---

### From Phase 3 discussion (2026-06-04)

**For a NEW "doctor" phase (add to roadmap — candidate for this milestone or next):**
- User reframed Phase 3's context-budget cluster: a human-facing context-utilization classifier ("you're at 70%") is NOT wanted. Quote: "there is no need to inform me about it. There is only need to fix it. And it is what I already addressed previously."
- The keep-context-tiny goal is met **structurally** — keep only the latest state in active docs, move superseded/previous decisions to prior versions, so `/progress` loads minimal content. Partly already addressed (milestone partitioning, distillation).
- **The forward-looking idea worth building — the "doctor":** an agent-assisted command that, by reading the documentation, finds "decisions which were documented and then overwritten," and heals the docs by archiving the superseded ones. Quote: "the idea for the health command could be useful if we have the agents assisting with the healing, like the doctor command... maybe we can do the health as part of the doctor and the doctor is the command [that] fix[es] this."
- **Not greenfield:** extends existing `/gsd2:health` (diagnose) + `gsd-tools validate health --repair` (structural repair). The doctor adds a *semantic* layer — superseded-decision detection — on top of the existing structural health check. Fold health INTO doctor.
- Signal: [STRONG] — user described the mechanism concretely and said "think about it" (park, don't drop).
- **Design bias reminder (from Phase 2 north-star):** prefer loops/skills raising model autonomy over many special-case agents; the doctor should be a skill + a bounded agent loop, not an agent zoo.
- Inherits CTX-01/CTX-02 reshaped out of Phase 3 (REQUIREMENTS.md marked Reshaped → doctor). Note: CTX-02's <60/70 token-% thresholds are NOT reusable (doctor measures stale-decision count, not token %); only the keep-lean intent carries.

---

### From Phase 6 discussion (2026-06-06)

**For Phase 7: Parallel Multi-Session Safety**
- Phase 6 ports the worktree-isolation *technique* as a GSD reference (detect-existing, native-first, git fallback, ignore-check, baseline test, sandbox fallback). Phase 7 consumes it for the `execute-phase` add→wave→merge orchestration — do NOT re-derive the technique; wire the Phase 6 reference in.
- Phase 6 deliberately did NOT build a gsd-tools worktree helper — it would guess at Phase 7's orchestration API. Phase 7 defines that API; build the helper there if needed.
- Signal: [STRONG] — explicit Phase 6/7 boundary, ratified by user ("let's keep it and let's do it"; boundary delegated to Claude).

**Supersedes SEC-DEFER-01 rationale**
- SEC-DEFER-01 (Phase 1) descoped worktree-path-guard because "user doesn't rely on worktree isolation." That premise is now false: Phase 7's parallelization makes worktree isolation load-bearing. If worktree-isolated execution becomes routine (Phase 7), reconsider SEC-DEFER-01 (the `worktree-path-guard` hard-block hook).
- Signal: [STRONG] — user reversed the prior explicitly.

**Closes the Phase 4 TDD-default note**
- Phase 4 cross-phase note flagged "making TDD default-ON is a separate concern needing its own scoping." Phase 6 scoped it: default-ON where helpful (planner-tagged logic tasks), agent/prompt/workflow edits exempt, executor enforces Iron Law when tagged. Not blanket-mandatory.
- Signal: [STRONG] — resolved.

**⚠ PENDING MANUAL VERIFICATION (Success Criterion #3 — deferred to a real prod run)**
- Phase 6 closed on automated checks only (all 14 structural grep/file assertions pass + 912/912 unit tests). The end-to-end behavioral proof was deferred — tracked in `06-HUMAN-UAT.md` (status: partial) and `06-VERIFICATION.md` (status: human_needed).
- **What to verify during a future prod `plan → execute` run (with the `superpowers` plugin disabled):**
  1. **TDD discipline fires:** on a `tdd=true` logic task, the executor refuses production code before a failing test and rejects a test that passes immediately (watch-it-fail). On an agent/prompt/workflow/reference task, the planner does NOT force-tag `tdd=true` (the exemption).
  2. **receiving-code-review loads:** when acting on `gsd2:review` output or PR comments (via `review.md`/`ship.md`), the agent verifies-before-implementing and avoids performative agreement ("you're absolutely right").
  3. **git-worktree technique available:** the reference is loadable for Phase 7 to wire in (Phase 7 owns the orchestration).
  4. **No superpowers dependency:** none of the above requires the plugin to be installed/enabled.
- Run `/gsd2:verify-work 6` after that run to record the result and clear the open UAT.
- Signal: user chose "test in prod" (2026-06-06) — phase marked done, this note is the reminder.

---

### From Phase 7 discussion (2026-06-06)

**For Phase 6 (sequencing — now a HARD dependency):**
- User overrode the roadmap's "may start Phase 7 before Phase 6 closes." Phase 6 must hard-close first: the worktree-isolation *technique* reference Phase 6 ships must be final before Phase 7's `execute-phase` wires it.
- Signal: [STRONG, user-override] — explicit override of the recommended/roadmap default.
- Context: scope-confirmation question; user chose "All 5, but Phase 6 must close first."

**For the future semantic "doctor" phase (Phase 3 note — keep distinct):**
- Phase 7's doctor is ONLY the structural source↔runtime symmetry-check (`diff -rq` + settings.json parity), folded into `/gsd2:health`. It deliberately does NOT claim the `/gsd2:doctor` command name.
- The `/gsd2:doctor` name stays reserved for the future *semantic stale-decision healer* (detects documented-then-overwritten decisions, archives superseded ones). Do not let a downstream agent merge the two.
- Signal: [STRONG] — explicit naming boundary set this session to avoid premature command-name capture.

**Reactivates SEC-DEFER-01 (worktree-path-guard hard-block hook):**
- Phase 7 makes worktree isolation load-bearing → SEC-DEFER-01's descope premise ("user doesn't rely on worktree isolation") is fully void. The `worktree-path-guard` PreToolUse hard-block (exit 2 on paths escaping a linked worktree) becomes a sensible follow-up once worktree execution is routine. Not required to ship Phase 7.
- Signal: [STRONG] — second explicit reversal of SEC-DEFER-01 (first flagged in Phase 6 notes).

### From Phase 8 discussion (2026-06-08)

**For Phase 9: SkillOpt-Style Self-Improving Skills**
- The hard prerequisite is an eval substrate GSD lacks: a graded `train/val/test` set of real GSD tasks + an automated scorer. SkillOpt (arXiv 2605.23904, github.com/microsoft/SkillOpt) gates every bounded skill-doc edit on a strict held-out validation improvement — no benchmark, no loop.
- Candidate score signals to investigate: verifier BLOCKER/WARNING counts, plan-loop convergence iterations (Phase 5), telemetry confidence verdicts (Phase 4 `agent-trace.jsonl`).
- Likely needs its own **benchmark-substrate sub-phase** before the optimizer loop is buildable. Flag at Phase 9 discuss.
- Phase 8's validated-example corpus is structured to be reusable as Phase 9 reference/eval material (real code, per-pattern retrievable).
- Open scoping for Phase 9: what counts as a gradable GSD "task"; which prose artifacts are the optimization target (agent instructions vs command/workflow prose vs references); optimizer model; reuse `microsoft/SkillOpt` directly vs GSD-native reimplementation.
- Signal: [STRONG] — phase split was an explicit user decision; substrate gap confirmed via primary-source research.

### From Phase 9 discussion (2026-06-08)

**Phase 9 RESHAPED — SkillOpt batch-optimizer → online feedback-driven skill evolution:**
- The Phase 8 note above (eval substrate, scorer, benchmark-substrate sub-phase) is **superseded**. At discuss, the user reframed: the goal is a *self-evolving skill model during development*, not offline batch optimization. Loop: observe real failure → reflect → propose bounded edit → human-ratify → commit to source + lessons ledger.
- The two blocking tensions (small-N data, cheap-vs-faithful scorer) **dissolve** in the online model — the task+signal come free from real bugs; no synthetic dataset; gameability evaporates (real signal, human ratifies). What's dropped: the quantitative held-out gate (replaced by human ratify + advisor-critic).
- Signal: [STRONG] — explicit user reframe with a concrete motivating example.

**For Phase 8 (corpus): dependency downgraded from HARD to SOFT.**
- Phase 8's corpus was framed as Phase 9's eval substrate. Post-reshape there is no scorer/benchmark, so the corpus is **no longer a blocker** for Phase 9 — it remains a *soft* reference (good-code grounding when proposing edits). Phase 8 can ship on its own merits; Phase 9 does not gate on it.
- Signal: [STRONG] — direct consequence of the reshape.

**For Phase 4 (telemetry): now load-bearing for Phase 9.**
- `agent-trace.jsonl` is the **attribution substrate** — Phase 9's loop reads it to infer which agent produced a failing artifact and propose the edit target. Telemetry usefulness now extends beyond observability into the self-improvement loop.
- Signal: [STRONG] — explicit attribution decision.

**For the future semantic `/gsd2:doctor`: inherits lesson/skill-edit consolidation.**
- Phase 9 deliberately does NOT build consolidation. Dedup, merging redundant lessons, and pruning stale skill edits are delegated to the doctor (already scoped as the stale-decision healer). The doctor's remit grows: stale *documented decisions* AND stale *self-taught skill edits* in the `.planning/lessons/` ledger.
- Signal: [STRONG] — explicit delegation.
