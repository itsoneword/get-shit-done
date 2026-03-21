# Research: Best Practices for Inline Workflow Prompt Optimization

**Date:** 2026-03-21
**Context:** Optimizing 49 GSD workflow files (~16K total lines, ~330 lines avg) that run INLINE in the main orchestrator context
**Method:** Primary sources from Anthropic docs, OpenAI docs, Claude Code docs, academic research (2024-2026)

---

## 1. Context Window Efficiency for Inline Prompts

### Every token in the orchestrator window has a cost — treat context as a finite resource
Unlike sub-agent prompts that get a fresh context, inline workflow instructions consume the orchestrator's shared context window. This makes token efficiency critical. Anthropic's context engineering guidance establishes the core principle: "good context engineering means finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome."

**Source:** [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | HIGH confidence

### Context rot is a gradient that worsens with token count
"As the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases." Models experience reduced precision in "information retrieval and long-range reasoning compared to their performance on shorter contexts." This means every workflow instruction that stays in context degrades the model's ability to use the rest of the context.

**Source:** [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | HIGH confidence

### Large system prompts trigger excessive thinking overhead
"Claude Opus 4.6 does significantly more upfront exploration than previous models." Large or complex prompts cause adaptive thinking to fire more often than needed, inflating thinking tokens and slowing responses. The fix: "Replace blanket defaults with more targeted instructions" and "Remove over-prompting."

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence

### Bloated instruction files cause instruction loss
Claude Code docs warn directly: "Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" and recommend: "For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it." This applies equally to workflow files loaded inline.

**Source:** [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices) | HIGH confidence (exact quote)

### A well-optimized prompt can be 20-40% shorter and still yield better results
Research on context window optimization found that "a well-optimized prompt might be 20–40% shorter than an unoptimized one, and still yield better results" through concise phrasing choices.

**Source:** [Context Window Optimization Through Prompt Engineering](https://www.gocodeo.com/post/context-window-optimization-through-prompt-engineering) | MEDIUM confidence

### Skills architecture recovers ~82% token savings via on-demand loading
Moving specialized instructions into skills that load on-demand "recovers significant tokens per session — roughly 15,000 tokens per session, an 82% improvement over loading everything into CLAUDE.md upfront."

**Source:** [Claude Code token efficiency community analysis](https://claudefa.st/blog/guide/development/usage-optimization) | MEDIUM confidence (community)

---

## 2. Procedural vs. Behavioral Prompts

### "Prefer general instructions over prescriptive steps" — but this has nuance
Anthropic's flagship recommendation: "Prefer general instructions over prescriptive steps. A prompt like 'think thoroughly' often produces better reasoning than a hand-written step-by-step plan. Claude's reasoning frequently exceeds what a human would prescribe."

**Critical caveat for workflows:** This guidance targets *reasoning and creative tasks* where Claude should decide the approach. Procedural workflows (init context, parse JSON, check conditions, spawn agents) are control flow, not reasoning. The model needs to execute a specific sequence, not discover one.

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence (exact quote, with domain-specific interpretation)

### Anthropic distinguishes workflows from agents explicitly
"Workflows: systems where LLMs and tools are orchestrated through predefined code paths. Agents: systems where LLMs dynamically direct their own processes and tool usage." The key differentiator: "whether the execution path is predetermined (workflows) or determined by the model's reasoning (agents)."

This confirms that GSD workflow files are correctly structured as predefined paths — they SHOULD be step-by-step. The "simpler is better" guidance applies to the agent prompts, not the workflow orchestration.

**Source:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | HIGH confidence (exact quote)

### Provide instructions as sequential steps when order matters
Anthropic explicitly recommends: "Provide instructions as sequential steps using numbered lists or bullet points when the order or completeness of steps matters." This directly validates procedural workflow structure.

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence (exact quote)

### Longer, more detailed instructions improve domain-specific performance
A 2025 study across nine domain-specific tasks found: "long instructions generally improve the performance metrics across all tasks on all experimented domains compared to base performance." Short instructions "negatively affect performances in all tasks compared to baseline."

However, this does not mean longer is always better — it means *relevant detail* improves performance. Padding and boilerplate do not.

**Source:** [Effects of Prompt Length on Domain-specific Tasks](https://arxiv.org/html/2502.14255v1) | HIGH confidence (academic)

### Three simple agentic reminders boosted SWE-bench by ~20%
OpenAI found that just three instruction categories — persistence, tool-calling, and planning — transformed the model "from a chatbot-like state into a much more 'eager' agent, driving the interaction forward autonomously." This suggests workflow preambles should be short, high-signal nudges rather than exhaustive behavioral rules.

**Source:** [GPT-4.1 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide) | HIGH confidence

---

## 3. Step-by-Step Orchestration Patterns

### Prompt chaining: sequential steps with programmatic gates
Anthropic's recommended workflow pattern: decompose tasks into sequential steps where each LLM call processes the previous output. Include programmatic "gates" to verify intermediate results. This is "ideal for situations where the task can be easily and cleanly decomposed into fixed subtasks."

**Source:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | HIGH confidence

### Orchestrator-workers for dynamic decomposition
When subtasks can't be predicted upfront, use an orchestrator that dynamically decomposes and delegates. "The key difference from parallelization is its flexibility — subtasks aren't pre-defined, but determined by the orchestrator based on the specific input."

**Source:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | HIGH confidence

### Separate exploration from execution
Claude Code best practices: "Letting Claude jump straight to coding can produce code that solves the wrong problem." The recommended workflow has four phases: Explore, Plan, Implement, Commit. For workflow files, this means clearly delineating the "read and analyze" phase from the "act" phase.

**Source:** [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices) | HIGH confidence

### GPT-5 guide: contradictory instructions are more damaging to capable models
"Poorly-constructed prompts containing contradictory or vague instructions can be more damaging to GPT-5 than to other models, as it expends reasoning tokens searching for a way to reconcile the contradictions." This implies workflow files must be internally consistent — conflicting if/else branches or ambiguous fallbacks waste orchestrator reasoning tokens.

**Source:** [GPT-5 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide) | HIGH confidence (exact quote)

### Tool preambles with structured plans improve transparency
GPT-5 guide recommends prompting models to "immediately outline a structured plan detailing each logical step you'll follow" and "narrate each step succinctly and sequentially, marking progress clearly." For GSD workflows, this means the `<purpose>` and `<core_principle>` tags serve as effective plan preambles.

**Source:** [GPT-5 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide) | HIGH confidence

### Parallel tool calls should be explicitly encouraged
Claude's models excel at parallel tool execution but benefit from explicit guidance: "If you intend to call multiple tools and there are no dependencies between the tool calls, make all of the independent tool calls in parallel." This can be boosted "to ~100%" with explicit prompting.

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence

---

## 4. Conditional Logic in Prompts

### Code-style structuring significantly improves conditional reasoning
Academic research (ACL 2024) found that structuring prompts like pseudocode with if/else conditions "consistently outperform text prompts" by 2.6-7.7 points across conditional reasoning benchmarks. The code format itself triggers reasoning abilities: "the combination of code that represents the original natural language instance and the NL text exploits the potential of LLMs."

**Key finding:** Removing natural language comments from pseudocode caused "performance drops of 14+ points." Both the logical structure AND semantic context are essential.

**Source:** [Code Prompting Elicits Conditional Reasoning (ACL 2024)](https://arxiv.org/html/2401.10065v1) | HIGH confidence (peer-reviewed)

### Always include default/fallback branches
Best practice for conditional prompts: "Always include a default action (the 'Otherwise' clause) to handle cases that don't match your defined conditions." This prevents the model from improvising when no condition matches.

**Source:** [Conditional Logic in Prompting](https://learn.playlab.ai/prompting/advanced/conditional%20logic) | MEDIUM confidence

### Escape clauses prevent instruction lock-in
OpenAI warns: "Instructing a model to always follow a specific behavior can occasionally induce adverse effects." The fix: "Adding explicit escape clauses should mitigate this." For GSD workflows, this means runtime compatibility sections should have clear fallback paths rather than just error states.

**Source:** [GPT-4.1 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide) | HIGH confidence (exact quote)

### Resolve contradictions explicitly rather than relying on priority
GPT-5 guide demonstrates that conflicting instructions (e.g., "always look up patient info" vs "in emergencies, skip lookup") must be explicitly reconciled: "Adding 'Do not do lookup in the emergency case, proceed immediately' to let the model know it is ok to not look up." Simply having both rules and hoping the model infers priority is insufficient.

**Source:** [GPT-5 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide) | HIGH confidence (exact quote)

### GSD implication: runtime compatibility blocks are well-structured but verbose
GSD's `<runtime_compatibility>` pattern (if Claude Code, use Task(); if Copilot, use sequential; if other, use fallback) maps directly to the code-prompting research. The pseudocode-with-comments format is validated. However, the verbosity of repeating this across many workflows is a compression target.

**Confidence:** HIGH (synthesis of multiple sources)

---

## 5. Template/Boilerplate Compression

### Avoid hardcoding complex, brittle logic — it increases maintenance cost
Anthropic warns against "hardcoding complex, brittle logic in their prompts to elicit exact agentic behavior" as this "creates fragility and increases maintenance complexity over time." Instead, curate "diverse, canonical examples that effectively portray the expected behavior."

**Source:** [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | HIGH confidence (exact quote)

### Prompt templates show consistent structural patterns
Research analyzing 4,540 real-world prompt templates found seven primary components with predictable ordering:
- Directive (86.7% frequency)
- Context (56.2%)
- Output Format/Style (39.7%)
- Constraints (35.7%)
- Workflow (27.5%)
- Profile/Role (28.4%)
- Examples (19.9%)

"Profile/Role and Directive components commonly appear in the first position" with probability 0.87 and 0.65. "Context and Workflows" and "Output Format/Style and Constraints" consistently form paired groups.

**Source:** [From Prompts to Templates (arXiv 2025)](https://arxiv.org/html/2504.02052v2) | HIGH confidence (academic)

### Compressed prompts retain full LLM effectiveness despite being unintelligible to humans
LLMLingua research (EMNLP 2023, ACL 2024) achieved "up to 20x compression with minimal performance loss" and found that "compressed prompts, though unintelligible to humans, retain full effectiveness for LLMs, suggesting significant redundancy in natural language formatting for machine processing."

This is relevant not for applying automated compression, but for understanding that natural language workflows contain substantial redundancy the model doesn't need.

**Source:** [LLMLingua (Microsoft Research)](https://www.microsoft.com/en-us/research/blog/llmlingua-innovating-llm-efficiency-with-prompt-compression/) | HIGH confidence (peer-reviewed)

### CLI tools are the most context-efficient way to interact with external services
Claude Code docs state directly: "CLI tools are the most context-efficient way to interact with external services." For GSD workflows, this validates the pattern of using `node gsd-tools.cjs init` to batch-load context in one call rather than multiple file reads.

**Source:** [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices) | HIGH confidence (exact quote)

### Skills load on-demand — workflow instructions should too
"Skills extend Claude's knowledge with information specific to your project, team, or domain. Claude applies them automatically when relevant." Skills use progressive disclosure: metadata at startup, full SKILL.md when triggered, supplementary files as needed.

GSD workflows are already loaded on-demand (only when a command is invoked), which is correct. But shared boilerplate within workflows is loaded redundantly every time.

**Source:** [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices) | HIGH confidence

### Pass context between steps, don't repeat it
Multi-step chain best practice: "Pass prior outputs effectively to maintain continuity, e.g., 'Using this summary: {summary}, answer: {question}.'" Avoid re-explaining context the model already has from previous steps.

**Source:** [Orchestrating Multi-Step LLM Chains](https://deepchecks.com/orchestrating-multi-step-llm-chains-best-practices/) | MEDIUM confidence

---

## 6. Token Budget for Orchestration

### No official percentage guidance exists — but principles are clear
Neither Anthropic nor OpenAI publish specific percentages for "how much context should be instructions vs data." However, the research converges on several principles:

### Context should be treated like a budget with diminishing returns
"Every new token introduced depletes this budget by some amount, increasing the need to carefully curate the tokens available to the LLM." The context window is "the most important resource to manage."

**Source:** [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices) | HIGH confidence

### Instruction following degrades at ~150 discrete instructions
IFScale benchmark (2025): Reasoning models maintain near-perfect instruction following until 150+ instructions, then show steep decline. At 300+ instructions: "uniform instruction abandonment." Even frontier models: only 68% accuracy at 500 instructions. Primacy bias peaks at 150-200 instructions.

**GSD implication:** A 330-line workflow file likely contains 30-80 discrete instructions. This is within safe range individually, but the orchestrator also has CLAUDE.md, tool definitions, and conversation history consuming attention budget.

**Source:** [IFScale (arXiv 2025)](https://arxiv.org/html/2507.11538v1) | HIGH confidence (academic)

### Queries/instructions at the end improve quality ~30%
"Queries at the end can improve response quality by up to 30% in tests, especially with complex, multi-document inputs." For inline workflows, this means the most critical step instructions should be at the end of the workflow file, not buried in the middle.

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence

### Programmatic tool batching reduces token usage by 37%
When Claude "orchestrates 20+ tool calls in a single code block, you eliminate 19+ inference passes, achieving a 37% reduction on complex research tasks."

**GSD implication:** The `gsd-tools.cjs init` pattern that batches context loading into one call is well-validated. Workflows that make multiple sequential bash calls for init data should consolidate.

**Source:** [Claude Code token efficiency community analysis](https://medium.com/@pierreyohann16/optimizing-token-efficiency-in-claude-code-workflows) | MEDIUM confidence (community)

### XML format outperforms JSON for document-heavy contexts
OpenAI's testing found that for large document collections, "XML performs well" while "JSON performs poorly." This validates GSD's use of XML tags (`<purpose>`, `<process>`, `<step>`) over JSON-structured workflow definitions.

**Source:** [GPT-4.1 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide) | HIGH confidence

---

## 7. MUST/NEVER/CRITICAL Language in Workflow Context

### Over-prompting causes overtriggering — but control flow is different
Anthropic: "Where you might have said 'CRITICAL: You MUST use this tool when...', you can use more normal prompting like 'Use this tool when...'"

**However:** This guidance targets behavioral nudges (encouraging tool use, thoroughness). GSD workflows contain structural MUST/NEVER constraints that are control flow: "You MUST execute this bash block before any config reads" is not a behavioral suggestion — it's a sequencing requirement. Removing emphasis from genuine sequencing constraints risks the model skipping critical steps.

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence (exact quote, with domain interpretation)

### Claude Code docs validate emphasis for critical instructions
"You can tune instructions by adding emphasis (e.g., 'IMPORTANT' or 'YOU MUST') to improve adherence." This confirms that emphasis has legitimate uses — the key is using it sparingly for genuine control flow, not for every instruction.

**Source:** [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices) | HIGH confidence (exact quote)

### Context/motivation beats bare rules
"Providing context or motivation behind your instructions, such as explaining to Claude why such behavior is important, can help Claude better understand your goals." The example: "NEVER use ellipses" is less effective than explaining the TTS engine reason. "Claude is smart enough to generalize from the explanation."

**GSD implication:** Instead of "REQUIRED — Sync chain flag with intent" (bare rule), explain why: "Clear the auto-chain flag to prevent stale flags from previous interrupted runs from causing unwanted auto-advance."

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence (exact quote)

---

## Actionable Recommendations for GSD Workflows

### Token Efficiency

1. **Audit every workflow for token ROI.** For each instruction, ask: "Would removing this cause Claude to execute the workflow incorrectly?" If not, cut it. Target 20-40% reduction in line count.

2. **Extract shared boilerplate into a common preamble.** The init bash block, JSON parsing pattern, runtime compatibility check, and available agent types list appear across many workflows. Extract these into a shared reference file that workflows can `@import` or that `gsd-tools.cjs init` returns as structured context.

3. **Consolidate init calls.** Workflows that make multiple sequential bash calls for initialization should batch into a single `gsd-tools.cjs init` call. The 37% token savings from batched tool calls is significant.

4. **Keep workflow files under 200 lines.** The current 330-line average means each workflow consumes substantial orchestrator context. Target 150-200 lines by removing redundancy — not by removing essential steps.

### Structural Optimization

5. **Keep the XML step structure — it's validated.** Research confirms XML outperforms JSON for structured prompts, and sequential numbered steps are explicitly recommended "when the order or completeness of steps matters."

6. **Put critical steps and output formatting at the END of workflow files.** The 30% quality improvement from end-positioned instructions means the final presentation/output step should be last, not followed by cleanup notes.

7. **Use pseudocode-with-comments for conditional logic.** The code prompting research shows if/else with natural language annotations outperforms pure prose for conditional reasoning. GSD's runtime compatibility blocks are already close to this pattern — formalize it.

8. **Resolve conditional conflicts explicitly.** Don't rely on the model inferring priority between competing instructions. When two rules can conflict, add an explicit resolution: "In this case, X takes priority over Y because Z."

### Instruction Language

9. **Reserve MUST/NEVER/REQUIRED for genuine control flow constraints.** Sequencing requirements ("execute this before reading config") and data integrity constraints ("never modify STATE.md outside the designated step") warrant emphasis. Behavioral preferences ("present output in a table") do not.

10. **Add WHY to every emphasized constraint.** Transform "REQUIRED — Sync chain flag" into "Clear the auto-chain flag so stale flags from previous interrupted runs don't cause unwanted auto-advance." The motivation helps Claude generalize correctly.

11. **Dial back behavioral emphasis.** Replace "You MUST present the progress table" with "Present the progress table." Reserve emphasis budget for ~3-5 critical constraints per workflow.

### Architecture

12. **Validate the procedural structure — don't flatten to goals.** "Prefer general instructions over prescriptive steps" applies to reasoning/creative tasks. GSD workflows are predefined code paths (Anthropic's "workflow" pattern), not open-ended agent tasks. Step-by-step structure is correct for this use case.

13. **Consider extracting the `<available_agent_types>` list.** This 12-line block appears in multiple workflows verbatim. Move it to a shared reference or have `gsd-tools.cjs init` include it in its JSON response when subagents are relevant.

14. **Separate "what to do" from "what to show the user."** Many workflows mix orchestration logic with user-facing output formatting. Separating these concerns could allow the output formatting to be shared across workflows.

15. **Use hooks for non-negotiable constraints instead of prompt instructions.** Claude Code docs: "Use hooks for actions that must happen every time with zero exceptions." If a constraint truly cannot be violated (e.g., never modify certain files), a hook is more reliable than a prompt instruction.

### Per-Workflow Triage

16. **Prioritize the largest workflows for optimization.** Rank workflows by line count; the longest ones consume the most orchestrator context and have the most optimization potential.

17. **Simple workflows should stay simple.** `fast.md` (80 lines) is appropriately minimal. Don't add structure to workflows that are already lean.

18. **Complex workflows may benefit from splitting.** If a workflow exceeds 300 lines, consider whether it's doing two jobs and should be two commands with a shared helper.

---

## Sources Index

| Source | Type | URL |
|--------|------|-----|
| Claude 4 best practices | Anthropic docs | https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices |
| Building Effective Agents | Anthropic research | https://www.anthropic.com/research/building-effective-agents |
| Effective context engineering | Anthropic engineering | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| Best Practices for Claude Code | Claude Code docs | https://code.claude.com/docs/en/best-practices |
| GPT-4.1 Prompting Guide | OpenAI cookbook | https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide |
| GPT-5 Prompting Guide | OpenAI cookbook | https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide |
| LLMLingua | Microsoft Research / EMNLP 2023 | https://www.microsoft.com/en-us/research/blog/llmlingua-innovating-llm-efficiency-with-prompt-compression/ |
| Code Prompting for Conditional Reasoning | ACL 2024 | https://arxiv.org/html/2401.10065v1 |
| Effects of Prompt Length | arXiv 2025 | https://arxiv.org/html/2502.14255v1 |
| IFScale (instruction following) | arXiv 2025 | https://arxiv.org/html/2507.11538v1 |
| From Prompts to Templates | arXiv 2025 | https://arxiv.org/html/2504.02052v2 |
| Context Window Optimization | GoCodeo | https://www.gocodeo.com/post/context-window-optimization-through-prompt-engineering |
| Multi-Step LLM Chains | Deepchecks | https://deepchecks.com/orchestrating-multi-step-llm-chains-best-practices/ |
| Conditional Logic in Prompting | Playlab | https://learn.playlab.ai/prompting/advanced/conditional%20logic |
| Claude Code token efficiency | Medium (community) | https://medium.com/@pierreyohann16/optimizing-token-efficiency-in-claude-code-workflows |
| Claude Code usage optimization | Claudefast (community) | https://claudefa.st/blog/guide/development/usage-optimization |
| OpenAI Practical Guide to Building Agents | OpenAI | https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/ |
