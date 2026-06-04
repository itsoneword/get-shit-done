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
