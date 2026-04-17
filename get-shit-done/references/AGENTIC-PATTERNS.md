# Agentic System Topology Patterns

Reference catalog for the gsd-agent-researcher. When a user describes an agentic system, map it to the simplest pattern that works. Challenge upgrades to more complex patterns unless the user can justify the added complexity.

**Sources:** Anthropic "Building Effective Agents" (5 workflow patterns + augmented LLM building block) and Andrew Ng's 4 Agentic Design Patterns (Reflection, Tool Use, Planning, Multi-Agent Collaboration).

---

## Summary Table

| Pattern | Complexity | When to Use | When NOT to Use |
|---------|-----------|-------------|-----------------|
| Chain (Augmented LLM) | Low | Linear transformations, extraction, summarization | Needs retry, branching, or parallel work |
| Routing | Low-Medium | Diverse input types needing different handling | Single input type, or when misclassification is catastrophic |
| Parallel | Medium | Independent subtasks, results merged | Tasks depend on each other's output |
| Orchestrator-Workers | Medium-High | Complex tasks needing dynamic decomposition | Simple fixed pipelines, or when orchestrator becomes bottleneck |
| Evaluator-Optimizer | Medium-High | Quality-sensitive outputs with definable criteria | Criteria are subjective or undefined, risk of infinite loops |
| Autonomous / Graph | High | Long-horizon tasks, uncertain environments, conditional branching | Anything simpler works, team lacks observability tooling |

---

## Chain (Augmented LLM)

**Description:** Linear sequence of LLM calls where each step's output feeds the next step's input. Each LLM call may be augmented with tools, retrieval, or memory, but control flow is fixed and unidirectional. The simplest agentic pattern -- closer to a pipeline than a true agent.

**Architecture diagram:**

```
[Input] -> [LLM Step 1] -> [LLM Step 2] -> [LLM Step 3] -> [Output]
              |                |                |
            [tool/RAG]      [tool/RAG]      [tool/RAG]
```

**Real-world example:** GSD's discuss-phase -> plan-phase -> execute-phase is a Chain pattern. Each workflow takes the prior phase's output (CONTEXT.md, PLAN.md) and produces structured artifacts for the next. No branching, no retries at the workflow level.

**Tradeoffs:**

| Advantage | Disadvantage |
|-----------|--------------|
| Trivially debuggable -- linear trace | Cannot recover from mid-chain errors without external retry |
| Predictable latency and token cost | No adaptive behavior; same path every time |
| Easy to test step-by-step | Wasted compute when an early step's output is "good enough" but later steps still run |
| No coordination overhead | Cannot parallelize independent steps |

**Failure modes:**
- Mid-chain error halts the entire chain -- no fallback
- Cumulative drift: small errors in step N compound by step N+3
- Schema mismatch between steps causes silent corruption if not validated at each boundary
- Unbounded latency if any single step is slow -- no parallelism to compensate

**Observability requirements:**
- Per-step input and output payloads logged with shared trace_id
- Step boundary timestamps to identify which step is the latency bottleneck
- Schema validation logs at each boundary -- malformed handoffs must fail loud

**Upgrade signal:** When you find yourself wrapping the chain in an outer retry loop, when different inputs need different chain shapes, or when steps that don't depend on each other are running serially -- you've outgrown Chain.

---

## Routing

**Description:** A classifier (LLM or heuristic) inspects each input and dispatches it to one of several specialized downstream handlers. Each handler is itself a chain or single LLM call optimized for one input class. Adds one decision point on top of Chain.

**Architecture diagram:**

```
                       +---> [Handler A: refunds]
                       |
[Input] -> [Classifier] +---> [Handler B: technical support]
                       |
                       +---> [Handler C: account management]
```

**Real-world example:** GSD's domain router in discuss-phase classifies a phase as "UI", "Agentic", or "general", then routes downstream planning to the matching specialized workflow (ui-phase, agent-spec-phase, or default). The classifier is one LLM call; the handlers are entire workflows.

**Tradeoffs:**

| Advantage | Disadvantage |
|-----------|--------------|
| Each handler stays focused and testable | Adds a single point of failure -- bad classifier breaks everything |
| Can mix human and LLM handlers per route | Latency cost of the classifier on every request |
| Easy to add new routes incrementally | Misclassification cascades -- handler runs against wrong input class |

**Failure modes:**
- Classifier confidently routes to the wrong handler (misclassification cascade)
- New input class arrives that matches no defined route -- needs explicit fallback
- Classifier latency dominates total response time on simple requests
- Handlers diverge in output format, breaking downstream consumers

**Observability requirements:**
- Classifier decision logged with confidence score and chosen route
- Per-route invocation count and latency to detect class skew
- Sample of misclassifications surfaced for human review (eval set)
- Fallback-route invocation count -- spike means new input class has appeared

**Upgrade signal:** When routes start needing to share state, when one route's output has to feed another, or when the classifier's accuracy degrades faster than you can retrain it -- consider Orchestrator-Workers.

**Downgrade signal:** If 90% of traffic goes to one route, the routing overhead is wasted -- collapse to Chain on the dominant path with the rare cases as exceptions.

---

## Parallel

**Description:** Multiple subagents run simultaneously on independent slices of the same task, then a merger combines their outputs. The classic "sectioning" or "voting" pattern -- either each subagent handles a different aspect (sectioning) or all subagents handle the same aspect and vote (voting).

**Architecture diagram:**

```
                +---> [Subagent A] ---+
                |                     |
[Input] -> [Splitter] +---> [Subagent B] ---+--> [Merger] -> [Output]
                |                     |
                +---> [Subagent C] ---+
```

**Real-world example:** GSD's parallel-wave executor spawns multiple gsd-executor agents simultaneously, each working on an independent plan within the same wave. Results are merged when all agents return. The wave dependency graph plays the role of splitter; the orchestrator plays the role of merger.

**Tradeoffs:**

| Advantage | Disadvantage |
|-----------|--------------|
| Wall-clock latency drops to slowest subagent, not sum | Total token cost is N times higher than serial |
| Voting pattern improves robustness on noisy tasks | Requires partial-failure handling -- what if one subagent fails? |
| Sectioning lets each subagent specialize | Merger logic is non-trivial when subagent outputs disagree |

**Failure modes:**
- One subagent fails or times out -- merger must decide whether to wait, retry, or proceed with partial results
- Subagents return contradictory outputs and merger has no tie-break rule
- Splitter creates uneven workload -- one slow subagent stalls the whole job
- Merger silently drops information when output formats diverge

**Observability requirements:**
- Per-subagent latency and token count to identify stragglers
- Merger decision logs: which inputs were combined, which were dropped, which conflicted
- Partial-failure events flagged distinctly from full success
- Splitter assignment logged so a failed subagent's slice can be retried in isolation

**Upgrade signal:** When subagents need to communicate during execution (not just at the merge step), or when the split itself depends on dynamic analysis -- consider Orchestrator-Workers.

**Downgrade signal:** If the merge step usually picks one subagent's output and discards the rest, the parallelism is paying for nothing -- pick the one consistently-best subagent and use Chain.

---

## Orchestrator-Workers

**Description:** A central orchestrator LLM dynamically decomposes a complex task into subtasks and dispatches each to a specialized worker agent. The orchestrator decides what work needs to happen at runtime, unlike Routing where routes are predefined. The orchestrator may iterate -- inspect worker outputs, then dispatch additional subtasks.

**Architecture diagram:**

```
                  +---> [Worker A: search]
                  |
[Input] -> [Orchestrator] +---> [Worker B: summarize]
              ^   |
              |   +---> [Worker C: extract]
              |          |
              +----------+ (results returned for next decision)
```

**Real-world example:** A coding agent that receives "fix this bug" as input, then dispatches: a search worker to find related files, a code-reading worker to understand the call site, an edit worker to apply the fix, and a test worker to verify. The orchestrator decides which workers to spawn based on what it learns.

**Tradeoffs:**

| Advantage | Disadvantage |
|-----------|--------------|
| Adapts to task complexity at runtime | Orchestrator becomes a bottleneck and single point of failure |
| Workers stay focused on narrow capabilities | Coordination overhead grows with worker count |
| New workers can be added without changing the orchestrator's prompt much | Hard to predict total cost or latency upfront |

**Failure modes:**
- Orchestrator fails to decompose -- spawns no workers or wrong workers
- Orchestrator loop runs indefinitely without making progress (no iteration limit)
- Worker outputs accumulate in orchestrator context until context window overflows
- One worker's bad output poisons orchestrator's next decision -- cascades through subsequent dispatches

**Observability requirements:**
- Orchestrator decision log: at each step, which workers were considered and which were dispatched and why
- Per-worker invocation trace with parent_span_id linking back to the orchestrator decision
- Iteration count metric with hard cap to prevent runaway loops
- Orchestrator context size tracked over time -- spike indicates worker output accumulation

**Upgrade signal:** When the orchestrator's decisions become themselves complex enough to require their own evaluation loop -- wrap the orchestrator in Evaluator-Optimizer, or move to a full Autonomous pattern with explicit state.

**Downgrade signal:** If the orchestrator always dispatches the same workers in the same order, you have a Chain disguised as an orchestrator -- collapse to Chain and remove the indirection.

---

## Evaluator-Optimizer

**Description:** A generator agent produces output, an evaluator agent scores it against defined criteria, and the loop continues until the evaluator approves or an iteration limit is hit. Useful when output quality is verifiable but not directly optimizable in a single pass.

**Architecture diagram:**

```
[Input] -> [Generator] -> [Output draft] -> [Evaluator] -> {pass/fail}
              ^                                  |
              |          (feedback)              |
              +----------------------------------+
                       (loop until pass or N iterations)
```

**Real-world example:** A translation agent generates a translation, an evaluator agent scores it for fidelity and fluency. If either score is below threshold, the evaluator's specific critique ("the second sentence loses the formal register") feeds back into the generator's next attempt. Loop caps at 3 iterations.

**Tradeoffs:**

| Advantage | Disadvantage |
|-----------|--------------|
| Output quality often improves measurably | Doubles or triples token cost per output |
| Evaluator catches errors the generator cannot self-correct | Risk of infinite loops if evaluator is too strict |
| Forces explicit, testable quality criteria | Evaluator gaming -- generator learns to satisfy the metric without satisfying intent |

**Failure modes:**
- Evaluator never approves -- loops to iteration limit and returns last attempt with low confidence
- Evaluator and generator collude on a degenerate output that passes the metric but fails intent
- Evaluator criteria drift from actual user requirements -- passes specs that users hate
- Generator overcorrects on evaluator feedback and breaks something the evaluator does not check

**Observability requirements:**
- Per-iteration generator output and evaluator score logged together
- Iteration count distribution -- bimodal distribution suggests either trivial cases or near-failures
- Evaluator score over time per category to detect drift or gaming
- Final-iteration "still failing" cases flagged for human review

**Upgrade signal:** When the generator needs to call out to other tools or workers between iterations -- wrap the generator in Orchestrator-Workers and keep the evaluator at the outer loop.

**Downgrade signal:** If the evaluator approves on the first iteration in 95% of cases, the loop is paying overhead for rare improvements -- run evaluation only as a sampled audit, not on every output.

---

## Autonomous / Graph

**Description:** Full state machine with conditional branching, cycles, and dynamic agent selection. The agent (or graph) decides what node to execute next based on current state, and execution can run for many turns or indefinitely. Frameworks like LangGraph implement this pattern explicitly. The most powerful and most expensive pattern to operate.

**Architecture diagram:**

```
            +-----[Node A]-----+
            |        |         |
[Input] -> [State] +--+         +-> [Node C] -> [Output]
            |        |         |       ^
            +-----[Node B]-----+       |
                     |                 |
                     +-----------------+
                  (cycles, conditional edges)
```

**Real-world example:** A research agent that explores a topic, decides whether to read more sources, take notes, refine its question, or compose an answer -- looping through these states until it judges the question fully answered. State (notes, sources read, open questions) persists across iterations.

**Tradeoffs:**

| Advantage | Disadvantage |
|-----------|--------------|
| Handles open-ended tasks no fixed pattern can | Hardest to debug -- failures may be many state transitions back |
| State is explicit and inspectable mid-run | Requires real observability tooling to operate safely |
| Can recover from many failure modes inline | High operational cost; long runs accumulate token spend |

**Failure modes:**
- State corruption -- a malformed update poisons all downstream decisions
- Infinite loops -- agent revisits same state repeatedly without progress (needs explicit cycle detection)
- State explosion -- accumulated context overflows model window mid-run
- Nondeterministic paths make incidents hard to reproduce
- Long-running graph drifts from original goal as it wanders

**Observability requirements:**
- Full state snapshot at every node entry/exit (not just inputs/outputs)
- Edge transition log -- which condition caused which next-node selection
- Cycle detection metrics -- count of revisits per node, alert on threshold
- Per-run wall-clock and token budget enforced as hard caps
- Replay capability -- ability to load a state snapshot and re-run from a specific node

**Upgrade signal:** There is no upgrade -- this is the most general pattern. If this is failing, the answer is reducing scope, not adding more complexity.

**Downgrade signal:** If the graph in practice always traverses the same path, or has only one or two real branch points, you don't need a graph -- use Routing or Orchestrator-Workers and reclaim debuggability.

---

## Combining Patterns

Most real systems combine patterns. Examples:

- **Orchestrator-Workers where one worker uses Evaluator-Optimizer internally** -- orchestrator dispatches a worker for high-stakes output (legal text, code patches), and that worker self-corrects via evaluator before returning.
- **Routing into specialized Chains** -- classifier picks the route, each route is a fixed chain optimized for its input class.
- **Parallel inside Orchestrator-Workers** -- orchestrator dispatches independent workers in parallel when subtasks are independent, serial when they aren't.
- **Evaluator-Optimizer wrapping a Chain** -- standard chain produces output, evaluator catches drift and triggers regeneration.

The AGENT-SPEC should name the **primary pattern** that defines the overall topology, and note any **sub-patterns** used within it (e.g. "Orchestrator-Workers, with Evaluator-Optimizer inside the code-edit worker"). This gives the checker enough information to validate observability and failure handling for both the outer and inner loops.

---

## Pattern Selection Checklist

Researcher should walk these in order. The first "yes" wins -- adopt the simplest pattern that fits.

1. **Can the task be done in a single pass with no branching?** -> **Chain (Augmented LLM)**
2. **Do different inputs need different handling, with the routes known up front?** -> **Routing**
3. **Are there independent subtasks that can run simultaneously, with results merged at the end?** -> **Parallel**
4. **Does the task need dynamic decomposition where the next step depends on the previous step's content?** -> **Orchestrator-Workers**
5. **Does output quality need iterative refinement against measurable criteria?** -> **Evaluator-Optimizer**
6. **Is the environment uncertain with conditional paths, cycles, or long-horizon state?** -> **Autonomous / Graph**

If the user reaches for question 6 first, push back. Most "agentic" tasks actually fit at question 1, 2, or 3, and the more complex patterns introduce more failure modes than they solve.
