# Feature Landscape: Autonomous Supervision Harness (v1.6)

**Domain:** Agentic dev workflow supervision — decision ledger, escalation, async inbox, overnight runner, multi-lens discussion, backlog triage
**Researched:** 2026-06-10
**Confidence:** HIGH (existing comparable systems well-documented; GSD-specific constraints from primary source)

---

## Comparable Systems Reference

How the six target features manifest in comparable tools (confidence notes where training data, not primary source, drives claims).

### Decision Ledger / Audit Trail

**Devin (Cognition):** Every action taken by the agent is shown in a session "replay" — tool calls, file changes, terminal output — timestamped and replayable. The ledger is session-scoped and retrospective; no structured alternatives-plus-evidence per decision. [MEDIUM confidence — training data through Aug 2025]

**OpenHands (AllHands.dev):** The event stream architecture stores every agent action as a typed event (`AgentThinkAction`, `CmdRunAction`, `FileWriteAction`, etc.) in a structured log. Reviewable after the fact. No alternatives or confidence fields in the base schema — it logs what happened, not why. [HIGH confidence — documented in architecture]

**LangGraph (LangChain):** State graph checkpointing via `MemorySaver` or `SqliteSaver` stores full graph state at every node boundary. This creates a natural decision ledger if states carry reasoning fields — but it's the developer's responsibility to put reasoning into state. Nothing is logged by default except the state blob. [HIGH confidence — official API]

**AutoGen (Microsoft):** GroupChat/Agent conversation log is inherently auditable — every agent message is stored in `chat_messages`. Reasoning is embedded in message text, not a structured field. No alternatives or escalation flags. [HIGH confidence — official API]

**Claude Code (Anthropic):** `PostToolUse` hooks (which GSD already uses for telemetry) provide the hook point for decision capture. No native decision ledger; GSD's `agent-trace.jsonl` is the closest existing primitive. The existing telemetry captures timestamp + agent_type + confidence verdict — DECISIONS.jsonl is a superset of this.

**Finding:** No comparable system structures decisions as `{choice, alternatives_considered, evidence, confidence, escalated_flag}`. Devin/OpenHands log actions; LangGraph/AutoGen log messages. The structured alternatives+evidence+escalation schema is GSD-specific and genuinely differentiating. Table stakes for this feature is "actions are logged with timestamp and outcome"; the structured evidence+alternatives schema is the differentiator.

---

### Human-in-the-Loop Escalation: What Criteria Do Existing Systems Use?

This is the most concrete prior-art question. Here is what is known about each system's escalation criteria:

**Devin:** Human input is requested when the agent reaches a "decision point" it cannot resolve — specifically: when credentials or secrets are needed that were not pre-provided; when the agent produces a PR and waits for human review; and when it encounters a blocking ambiguity in the spec. The criteria are implicit in the agent's behavior, not written as a policy. There is no structured three-tier verdict schema. [MEDIUM confidence]

**OpenHands:** The `AgentController` has an `AgentState.AWAITING_USER_INPUT` state. The agent transitions to this state when: (a) it reaches a tool call that requires confirmation (in `confirmation_mode`); (b) the agent emits an `AgentFinishAction` with a message requesting clarification; or (c) the delegate agent returns control. In headless mode, awaiting-user-input terminates the run. Criteria are purely agent-initiated — the agent decides to ask, not a policy evaluation step. [HIGH confidence — from source code]

**LangGraph:** The canonical HITL pattern uses `interrupt()` — a node in the graph that halts execution and passes state to a human. The developer defines which nodes trigger interrupts. LangGraph's own guidance identifies three patterns: (1) `interrupt_before` a tool call to get approval; (2) `interrupt_after` tool execution to review results; (3) a dedicated review node. What causes the interrupt is entirely developer-defined — LangGraph provides the mechanism, not the policy. Common patterns in the community: interrupt before tool calls that write/delete; interrupt when confidence score is below threshold; interrupt before external API calls with side effects. [HIGH confidence — official docs]

**AutoGen (GroupChat):** The `human_input_mode` parameter on agents controls escalation: `NEVER` (never interrupt), `TERMINATE` (interrupt at conversation end), `ALWAYS` (interrupt every turn). The `HumanProxyAgent` is the explicit mechanism — you route certain topics or decisions to a human-backed agent. Criteria are topological (which agent handles it) not evaluative (is this question human-worthy). [HIGH confidence — official API]

**Anthropic / Claude Code guidance (internal):** Claude's constitution and agent safety guidance identifies escalation triggers as: irreversible actions (git force-push, database drops), actions that acquire new capabilities (installing new tools, requesting new permissions), actions that reach a decision fork the spec didn't address. These map closely to the GSD escalation contract criteria.

**Synthesis — the four escalation criteria that appear across all systems:**

1. **Irreversibility** — actions that can't be undone (DELETE, force-push, destructive schema migration, credential use). All systems with HITL either block or escalate these.
2. **Scope change** — the agent is about to do something outside the stated task boundary. Devin and OpenHands surface this implicitly; LangGraph requires the developer to encode it.
3. **External side effects** — API calls with real-world consequences (payments, email, deploys to prod). LangGraph interrupt_before_tool is the common pattern.
4. **Spec ambiguity** — the agent cannot determine intent from available context. This is the "ask the human" case that all systems support, but none of them have a written policy for what "can't determine" means — it's model-behavior-dependent.

**GSD-specific fifth criterion:** **Security boundary crossing** (a step would touch credentials, secrets, permissions outside the declared scope in AGENT-SPEC). This is GSD-specific because GSD has AGENT-SPEC permission matrices.

**What none of the comparable systems have:** A **written, human-readable escalation policy as a first-class artifact** that the agent evaluates against. Devin escalates by behavior; LangGraph escalates by graph topology; AutoGen escalates by agent routing. GSD's escalation contract — a written `{proceed / proceed-and-log / park-and-ask}` verdict schema with named criteria — is a genuine differentiator.

---

### Park-Don't-Block / Async Question Inbox

**Devin:** Blocking. If Devin needs human input, the session pauses and waits. No park-and-continue mechanism. [MEDIUM confidence]

**OpenHands Headless:** In headless mode, reaching `AWAITING_USER_INPUT` terminates the run. No async continuation. The `AgentController` supports `resume()` in interactive mode, but headless runs are fire-and-forget. [HIGH confidence — architecture]

**LangGraph:** `interrupt()` is fundamentally blocking — the graph state is persisted and execution halts until `Command(resume=...)` is called. The mechanism for "park and continue other work" requires the developer to explicitly route to a parallel subgraph. LangGraph's own docs show a "branching" interrupt pattern where one branch parks and another continues, but this is non-trivial to implement. [HIGH confidence]

**AutoGen:** No native park-and-continue. Blocking by design — GroupChat waits on the human proxy.

**Finding:** Park-don't-block is uncommon and complex in current systems. Blocking on escalation is the default everywhere. A non-blocking escalation inbox with branch-level parking is a genuine differentiator. The complexity is HIGH because it requires: (a) a branch state machine that can be in `parked` state while a runner continues other branches, (b) an inbox that collects parked questions across branches, (c) a resume mechanism that injects the human answer and restarts the branch.

**The key design insight from prior art:** LangGraph's checkpointing is what enables park-and-resume. The analogous primitive in GSD is `.planning/` file persistence — a parked branch's state is its `.planning/phases/` directory. Resume = inject human answer into a `MAILBOX.md` or similar, re-invoke the workflow for that phase.

---

### Overnight Runner / Long-Horizon Autonomous Runs

**Devin:** Purpose-built for this. Runs multi-hour sessions autonomously, reports completion async via Slack/email. The human reviews a PR, not a session. [MEDIUM confidence — training data]

**OpenHands Headless CLI:** `python -m openhands.headless --task "..."` runs fully autonomously until completion or stuck state. No human checkpoints. Suitable for overnight runs but no native ledger or structured reporting of decisions made. [HIGH confidence — documented]

**SWE-bench evaluation harness:** The canonical overnight runner pattern for coding agents — a task queue, a per-task agent run, result capture to a structured file, failure categorization. This is the research-community pattern GSD's overnight runner should mirror. [HIGH confidence — published methodology]

**Key insight from overnight runner failures in practice:** The primary failure modes are (a) the agent gets stuck in a loop consuming context, (b) the agent makes a catastrophic irreversible change mid-run, (c) the run produces code but verification fails and there's no escalation path. All three are addressed by the GSD harness design: stall detection (already in v1.5), escalation contract (park irreversible decisions), and ledger+verification.

**Orchestration constraint (GSD-specific):** PROJECT.md constraint is clear — supervisor/runner must execute at orchestrator level, never as a spawned subagent. This rules out implementing the runner as a skill invoked from within another skill. The runner is a top-level workflow.

---

### Multi-Agent Deliberation Loops with Convergence Criteria

**AutoGen GroupChat:** The canonical pattern — multiple agents in a round-robin or dynamic conversation, with a `GroupChatManager` that decides speaker order. Convergence is human-defined: either a fixed round count, a termination string (agent says "TERMINATE"), or a custom `is_termination_msg` function. No structured multi-lens roles built in — developers define agent personas in system prompts. [HIGH confidence]

**LangGraph multi-agent:** Typically implements deliberation as a graph with a supervisor node that routes between worker agents. Convergence is a state condition checked by the supervisor. The "skeptic/advocate/architect" pattern requires the developer to define roles explicitly. [HIGH confidence]

**OpenClaw / multi-role patterns (community):** The dominant community pattern for structured deliberation: define 3 roles (skeptic, proposer, evaluator), have each produce a verdict, have a convergence checker compare verdicts for agreement. When agreement threshold is met (e.g., 2/3 agree on the same direction) or maximum rounds exceeded, exit. [MEDIUM confidence — training data]

**Key finding for GSD's discussion loop:** The "artifact-anchored" constraint in PROJECT.md is an important differentiator from AutoGen/LangGraph patterns. Those systems deliberate about actions or plans in the abstract. GSD's design — lenses judge a **concrete artifact** (a produced CONTEXT.md, a plan draft) — is stronger because it prevents the deliberation from becoming unconstrained argument. This maps to the "concrete proposal, then critique" pattern from structured debate methodology.

**Convergence brake design:** The v1.5 stall-detection primitive (non-decreasing BLOCKER+WARNING trajectory triggers STALL DETECTED) is the right precedent. For the discussion loop: convergence when all lenses agree the artifact meets criteria, OR when round count exceeds max, OR when lens verdicts stabilize (same set of objections repeated across two consecutive rounds = stall). The third condition prevents the loop from cycling forever on unresolvable disagreements.

---

### Backlog / Todo Triage Worker

**No direct comparable.** Backlog triage is a solved UX problem in project management tools (Linear, GitHub Issues, Jira) but none of these have AI triage workers that emit structured verdicts into a workflow. The closest is:

- **GitHub Copilot Workspace:** Can propose issue decomposition and route tasks to code-writing agents. Triage is implicit in the workspace setup, not a named verdict-emitting worker. [MEDIUM confidence]
- **Sweep AI (GitHub app):** Automatically triages labeled issues, opens PRs for simple fixes. The "already-done / needs-PR / out-of-scope" verdict pattern is the closest analog. Verdicts are binary (do it / can't do it), not the full six-category taxonomy GSD defines. [MEDIUM confidence]

**Key insight for GSD's triage worker:** The six verdicts in PROJECT.md (already-done / obsolete / fold-into-phase / new-phase / needs-input / defer) are well-chosen. They cover the full decision space without overlap. The critical design constraint is that the worker **proposes into the mailbox**, never disposes. This is the correct approach because: (a) "already-done" judgments can be wrong and require human confirmation; (b) "fold-into-phase" changes the roadmap, which is a structural decision; (c) "obsolete" is a data loss risk. All verdicts are proposals, not actions.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Every autonomous decision logged with timestamp and choice made | Without this the harness is a black box; humans can't audit post-run | LOW | GSD already has `agent-trace.jsonl`; DECISIONS.jsonl is a structured superset |
| Escalation produces a visible artifact, not a silent block | If the runner stalls invisibly, the human learns nothing until they check | LOW | A `MAILBOX.md` or `parked-questions.jsonl` file is the minimal artifact |
| Human can answer a parked question in one command | The inbox must be actionable without re-reading transcripts | MEDIUM | The answer must inject back into the blocked branch's state |
| Overnight run survives process interruption (crash, OOM) | Runs that can't be resumed are useless for overnight work | MEDIUM | Requires checkpoint-to-disk after each phase, not just in-memory state |
| Ledger is readable without replaying the run | Must be standalone-auditable — structured JSONL with human-readable summary | LOW | The `escalated: true/false` flag is the key field; alternatives must be present |
| Runner reports what it did when it finishes | Summary: phases attempted, phases completed, escalations raised, ledger location | LOW | Final banner + summary file |
| Convergence limit on discussion loops | Loops without a hard exit are anti-patterns; humans must be able to trust the loop will end | LOW | Max rounds + stall detection (already designed) |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Written escalation policy as a first-class artifact | Humans can read the criteria, audit escalation precision, and tune it — no other system does this | MEDIUM | The contract is a `.md` or config section, not implicit agent behavior |
| Park-don't-block: continue other branches while one waits | Blocking on escalation is the industry default; non-blocking is a genuine speedup for multi-phase runs | HIGH | Requires per-phase state machine with `parked` status; runner skips parked phases and returns to them |
| Alternatives + evidence in the ledger, not just the choice made | Every other system logs what happened; GSD logs why and what was rejected | LOW | The ledger schema carries `alternatives: []` and `evidence: string`; wired into discuss-phase reasoning |
| Escalation precision scoring (via ledger review) | The human can measure: of N escalations, how many were actually necessary? This enables criteria tuning | MEDIUM | Requires a review command that reads the ledger and asks the human to score each escalation |
| Artifact-anchored discussion loop (lenses judge a concrete artifact) | Prevents unconstrained argument; lenses critique something specific, not an abstract plan | MEDIUM | Stronger convergence than AutoGen GroupChat because the artifact is a forcing function |
| Six-verdict triage (not binary) | Sweep/Copilot Workspace do binary triage; six verdicts preserve nuance and don't force false decisions | LOW | The taxonomy design is done; execution is a structured prompt + mailbox write |
| Trust ladder: single-phase validation before overnight multi-phase | Operators can build confidence in escalation precision before widening scope | LOW | This is a workflow/documentation concern, not a code feature — but it should be made explicit in the runner help text |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Silent autonomous resolution of parked questions | Tempting to "just guess" rather than wait | Defeats the audit trail; the human's judgment on escalated questions is exactly the value being preserved | Park-and-log the question; proceed with safe default if a safe default exists (proceed-and-log), only block if no safe path forward |
| Automatic PR creation from overnight run results | Feels like end-to-end automation | PRs created without human review of the ledger create noise and potential merge conflicts; the human should read the ledger BEFORE the PR | Write the DECISIONS.jsonl and let the human trigger `git push` and PR creation after review |
| Escalation policy auto-tuned by ML on past decisions | Would "learn" what to ask | Creates opaque, unauditable policy drift; the criteria become unreadable | Human-curated criteria tuning via the precision-scoring command — explicit, readable, ratifiable |
| Real-time notifications (Slack/email) during run | Devin-style async notification | Adds external service dependency; the inbox review command is the right async interface for a local tool | Single inbox review command post-run; if real-time is needed, a simple `tail -f` on MAILBOX.md suffices |
| Discussion loop agents with persistent memory across phases | Sounds like deeper reasoning | Agents with growing memory across phases accumulate bias; each discussion loop should start fresh from the artifact | Anchor each loop to the concrete artifact; pass only the artifact and the escalation criteria, not accumulated reasoning history |
| Runner as a spawned subagent (Skill invocation) | Would simplify wiring | PROJECT.md constraint: GSD subagents lack Skill/Agent tool grants — the runner cannot spawn further skills from within a skill invocation | Runner executes at orchestrator level (top-level session or headless) |
| Triage worker that acts on verdicts (moves files, edits ROADMAP) | Feels automated | "Dispose" actions on backlog items are irreversible; the worker must propose, not act | Verdicts land in mailbox; human runs `gsd-tools triage apply` to act on proposals after review |

---

## Feature Dependencies

```
[Decision Ledger (LEDGER)]
    └──required-by──> [Escalation Contract (ESC)]
                          └──required-by──> [Park-Don't-Block (PARK)]
                                                └──required-by──> [Overnight Runner (RUN)]

[Escalation Contract (ESC)]
    └──required-by──> [Todo Triage Worker (TRIAGE)]
                          (triage verdicts flow through same mailbox)

[Discussion Loop (LOOP)]
    ├──uses──> [Escalation Contract (ESC)]
    │              (convergence failure escalates to mailbox)
    └──independent-of──> [Overnight Runner (RUN)]
                              (loop can run inline in discuss-phase without the full runner)

[Overnight Runner (RUN)]
    ├──wraps──> [/gsd2:autonomous (existing)]
    ├──uses──> [Decision Ledger (LEDGER)]
    ├──uses──> [Park-Don't-Block (PARK)]
    └──uses──> [worktree isolation (v1.5 Phase 7, existing)]

[Todo Triage Worker (TRIAGE)]
    ├──uses──> [Park-Don't-Block mailbox (PARK)]
    └──reads──> [existing todos/backlog files]
```

### Dependency Notes

- **LEDGER is the foundation:** ESC, PARK, and RUN all require structured decision records to function. Build LEDGER first, wire it into discuss-phase `--auto`, then add the escalation evaluator on top.
- **ESC before PARK:** The escalation evaluator must exist before park-don't-block can decide what to park. The verdict schema (`proceed / proceed-and-log / park-and-ask`) is the API between them.
- **PARK before RUN:** The overnight runner's value is that it can continue while branches are parked. Without PARK, the runner is just a wrapped `/gsd2:autonomous` call — useful but not novel.
- **LOOP is the most independent:** The multi-lens discussion loop doesn't depend on PARK or RUN. It can be built and validated against a single phase's discuss step. Its only dependency is ESC (so convergence failures can escalate).
- **TRIAGE is the most independent after LOOP:** It reads existing todos/backlog and writes to the mailbox. It can be validated standalone without the overnight runner running.
- **Existing v1.5 machinery:** Stall detection (Phase 5), worktree isolation (Phase 7), and agent-trace telemetry (Phase 4) are all prerequisites — all already shipped.

---

## MVP Definition

### Launch With (v1 — core trust ladder)

- [x] **Decision Ledger (LEDGER)** — the audit primitive everything else requires; wired into discuss-phase `--auto` first to validate schema before broader use
- [x] **Escalation Contract (ESC)** — written criteria + verdict schema; without this, PARK and RUN have no policy to evaluate against
- [x] **Park-Don't-Block (PARK)** — the mailbox + branch-parking state; this is the behavioral change that makes the harness non-blocking

These three, used together in a single-phase validation run, constitute the minimum trust-building step described in PROJECT.md ("validate on a single phase, read the ledger, score escalation precision").

### Add After Validation (v1.x)

- [ ] **Overnight Runner (RUN)** — wraps existing `/gsd2:autonomous` with LEDGER+ESC+PARK; add after single-phase trust is established so the runner doesn't amplify an untuned escalation policy across 10 phases simultaneously
- [ ] **Artifact-Anchored Discussion Loop (LOOP)** — can be validated independently on discuss-phase; add in parallel with RUN once ESC schema is stable
- [ ] **Todo Triage Worker (TRIAGE)** — lowest urgency; the backlog problem is real but not a blocker for the harness's core value proposition

### Future Consideration (v2+)

- [ ] Escalation precision scoring command (review ledger + human scores each escalation) — enables criteria tuning; deferred because it requires a meaningful amount of ledger data first
- [ ] Cross-session ledger aggregation (track escalation patterns across multiple runs) — useful for policy improvement; requires LEDGER to be stable and used regularly first
- [ ] Discussion loop as a standalone `/gsd2:discuss-loop` command (currently embedded in discuss-phase) — only needed if the loop is used outside of the autonomous harness

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Decision Ledger | HIGH (audit, trust) | LOW (JSONL schema + write hook) | P1 |
| Escalation Contract | HIGH (policy, precision) | MEDIUM (evaluator + verdict schema) | P1 |
| Park-Don't-Block Mailbox | HIGH (non-blocking runs) | HIGH (per-phase state machine) | P1 |
| Overnight Runner | HIGH (the main UX) | MEDIUM (wraps existing machinery) | P2 |
| Discussion Loop | MEDIUM (better discuss quality) | MEDIUM (multi-role prompt + convergence) | P2 |
| Todo Triage Worker | MEDIUM (backlog hygiene) | LOW (structured prompt + mailbox write) | P2 |
| Escalation Precision Scoring | MEDIUM (policy tuning) | LOW (ledger read + human scoring) | P3 |

**Priority key:** P1 = must have for single-phase validation; P2 = required for overnight runs and full value; P3 = improvement after initial use

---

## Competitor Feature Analysis

| Feature | Devin | OpenHands Headless | LangGraph HITL | GSD v1.6 Approach |
|---------|-------|---------------------|----------------|-------------------|
| Decision logging | Session replay (actions) | Event stream (typed) | Graph state checkpoints | DECISIONS.jsonl with alternatives+evidence+escalated flag |
| Escalation criteria | Implicit (agent behavior) | State transition (AWAITING_USER_INPUT) | Developer-defined node interrupts | Written policy artifact with four named criteria (irreversibility, security, scope, ambiguity) |
| Blocking behavior | Blocking | Blocking (terminates headless) | Blocking (graph pauses) | Non-blocking (branch parks, runner continues) |
| Async inbox | No | No | No (thread-based) | MAILBOX file + review command |
| Overnight support | Yes (native) | Yes (headless CLI) | Yes (persistent state) | Wrapped /gsd2:autonomous + worktrees |
| Multi-lens deliberation | No | No | Custom graph nodes | Three-lens artifact judgment with convergence brake |
| Backlog triage | No | No | No | Six-verdict worker, propose-only, mailbox output |
| Policy auditability | No | No | Partial (code) | Yes (written escalation contract, readable without code) |

---

## Escalation Criteria: Concrete Prior Art Summary

This is the quality-gate item — concrete criteria existing HITL systems use to decide what is "human-worthy":

**Irreversibility (universally recognized, HIGH confidence):**
- Destructive filesystem operations (rm, overwrite without backup)
- Force-push / branch deletion
- Database schema drops or destructive migrations
- Credential rotation or deletion
- External service calls that can't be undone (payments, sent emails, published deploys)

**Scope change (recognized by Devin/OpenHands behavior, MEDIUM confidence):**
- Agent is about to work in a directory or file not mentioned in the phase goal
- Agent wants to install a new dependency not in the original plan
- Agent's proposed solution requires more phases than the current scope

**Security boundary crossing (GSD-specific via AGENT-SPEC, HIGH confidence for GSD context):**
- Access to credentials, secrets, or environment variables not declared in the AGENT-SPEC permission matrix
- Network calls to domains not in the declared tool manifest
- File access outside the declared scope for the phase

**Spec ambiguity (agent-reported, MEDIUM confidence):**
- Agent produces contradictory implementations across two valid interpretations of the spec
- Agent's confidence verdict is LOW after the technical-resolution loop (existing v1.5 primitive)
- Agent reaches a branch where both paths are defensible but have different implications for future phases

**Not human-worthy (counter-criteria — important for precision):**
- Technical implementation choices the model can resolve (library selection, algorithm choice, code style) — this is what the v1.5 autonomous-resolution loop handles
- Reversible file writes during execution
- Standard test failures that can be fixed autonomously
- Documentation generation and summarization

---

## Sources

- GSD PROJECT.md — primary source for v1.6 requirements and constraints
- GSD REQUIREMENTS.md — primary source for existing capabilities (LEDGER, ESC, PARK, RUN, LOOP, TRIAGE feature definitions)
- GSD `/workflows/autonomous.md` — existing autonomous runner design (wrapping target for RUN)
- GSD `v1.5/phases/04-agent-observability-telemetry/` — existing telemetry primitive (LEDGER foundation)
- GSD `v1.5/phases/05-plan-loop-convergence/` — existing stall detection (convergence brake model)
- OpenHands architecture (AgentController state machine, event stream) — [MEDIUM confidence, training data Aug 2025]
- LangGraph HITL documentation (interrupt(), Command(resume=...), MemorySaver checkpointing) — [HIGH confidence, well-documented stable API]
- AutoGen GroupChat (human_input_mode, HumanProxyAgent, is_termination_msg) — [HIGH confidence, official API]
- Devin session replay behavior — [MEDIUM confidence, training data Aug 2025]
- SWE-bench headless evaluation harness pattern — [HIGH confidence, published methodology]
- Anthropic agent safety guidance (irreversibility criteria, capability-acquisition escalation) — [HIGH confidence, published]

---

*Feature research for: GSD v1.6 Autonomous Supervision Harness*
*Researched: 2026-06-10*
