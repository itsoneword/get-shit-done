# Research: Best Practices for Agent, Skill, and Tool Design

**Date:** 2026-03-21
**Context:** Sanity-checking GSD agent definitions against known best practices
**Method:** Primary sources from Anthropic docs, OpenAI docs, academic research (2024-2026)

---

## 1. Optimal System Prompt / Agent Definition Size

### Structure matters more than size
Anthropic does not specify an optimal token count. All guidance focuses on *structure* (XML tags, clear sections) over brevity. Well-organized long prompts outperform short vague ones.

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence

### Context rot is real but gradual
As tokens increase, recall precision decreases — a gradient, not a cliff. Transformer attention gets "stretched thin" at longer contexts.

**Source:** [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | HIGH confidence

### Document placement matters — queries at end improve quality ~30%
For inputs 20k+ tokens, placing long documents at the top and queries/instructions at the end "can improve response quality by up to 30% in tests."

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence

### Large system prompts can trigger excessive thinking
Claude Opus 4.6's adaptive thinking fires more often than needed "with large or complex system prompts."

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence

---

## 2. Specificity vs. Generality

### Smarter models need simpler prompts — confirmed
A 2025 study (23 prompt types × 12 LLMs): "high-performance models usually work better with simpler prompts" while "cost-effective models benefit from complex reasoning prompts."

**Source:** [arxiv.org/pdf/2602.00337](https://arxiv.org/pdf/2602.00337) | MEDIUM confidence (academic)

### Anthropic confirms: over-prompting hurts newer models
"If your prompts were designed to reduce undertriggering on tools or skills, these models may now overtrigger. The fix is to dial back any aggressive language. Where you might have said 'CRITICAL: You MUST use this tool when...', you can use more normal prompting like 'Use this tool when...'"

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence (exact quote)

### General instructions outperform prescriptive steps
"Prefer general instructions over prescriptive steps. A prompt like 'think thoroughly' often produces better reasoning than a hand-written step-by-step plan. Claude's reasoning frequently exceeds what a human would prescribe."

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence (exact quote)

### Exemplars outperform detailed instructions
NeurIPS 2024: "even detailed and task-specific instructions do not regulate the LLM's behavior as effectively as exemplars." Random search over exemplars outperformed state-of-the-art instruction optimization.

**Source:** [NeurIPS 2024 — arxiv.org/abs/2406.15708](https://arxiv.org/abs/2406.15708) | HIGH confidence (peer-reviewed)

### Context/motivation beats bare rules
Providing *why* helps more than the instruction alone. "NEVER use ellipses" is less effective than explaining the TTS engine reason. "Claude is smart enough to generalize from the explanation."

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence (exact quote)

---

## 3. Agent Scope: Specialist vs. Generalist

### Start simple, add complexity only when justified
"Start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short." Most successful implementations used "simple, composable patterns."

**Source:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | HIGH confidence

### Workflows for predictable tasks, agents for open-ended ones
Workflows = "LLMs and tools orchestrated through predefined code paths." Agents = "LLMs dynamically direct their own processes." Use agents only for "open-ended problems where step count cannot be predicted."

**Source:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | HIGH confidence

### Subagent overhead — Opus spawns too eagerly
"Claude Opus 4.6 has a strong predilection for subagents and may spawn them in situations where a simpler, direct approach would suffice."

Guidance: "Use subagents when tasks can run in parallel, require isolated context, or involve independent workstreams. For simple tasks, sequential operations, single-file edits, work directly rather than delegating."

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence (exact quote)

### Practical cap: 3-4 subagents maximum
Beyond that, orchestration overhead exceeds benefit.

**Source:** [claudefa.st/blog/guide/agents/sub-agent-best-practices](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) | MEDIUM confidence (community)

### Sub-agents should return condensed summaries (1-2k tokens)
Keeps orchestrator context clean.

**Source:** [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | HIGH confidence

---

## 4. Claude-Specific Best Practices

### System prompt structure
- Use XML tags (`<instructions>`, `<context>`, `<input>`)
- Set a role (even one sentence helps)
- 3-5 examples in `<example>` tags
- Long documents at top, queries at bottom
- Tell Claude what to do, not what not to do

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence

### Tool definitions are the primary action guide
"Tools are prominent in Claude's context window, making them the primary actions Claude will consider." Anthropic spent "more time optimizing our tools than the overall prompt" for SWE-bench. Changing to absolute filepaths "eliminated errors completely."

**Source:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | HIGH confidence

### Tool descriptions: minimum 3-4 sentences
"Aim for at least 3-4 sentences per tool description, more if the tool is complex."

**Source:** [Tool use with Claude](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) | HIGH confidence

### Skill files: keep SKILL.md under 500 lines
"Keep SKILL.md under 500 lines. Move detailed reference material to separate files."

Skills use progressive disclosure: (1) metadata at startup, (2) full SKILL.md when triggered, (3) supplementary files as needed. Description budget = 2% of context window.

**Source:** [Extend Claude with skills](https://code.claude.com/docs/en/skills) | HIGH confidence

---

## 5. Tool Definition Best Practices

### Write descriptions like onboarding docs
Include "example usage, edge cases, input format requirements, and clear boundaries from other tools."

**Source:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | HIGH confidence

### Consolidate, don't wrap
Don't mirror API endpoints 1:1. Implement consolidated tools handling multiple operations. Example: single `schedule_event` instead of separate `list_users`, `list_events`, `create_event`.

**Source:** [Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | HIGH confidence

### Use unambiguous parameter names
`user_id` over generic `user`. Resolve UUIDs to meaningful language.

**Source:** [Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | HIGH confidence

### Deferred loading for large tool sets
Tools marked `defer_loading: true` are discoverable but not loaded into context initially.

**Source:** [Introducing advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) | HIGH confidence

---

## 6. Known Anti-Patterns

### "Lost in the middle" — real but position-dependent
Performance degrades 30%+ when key info is in the middle vs start/end (TACL 2024). However, 2025 follow-up found "no consistent relationship between instruction following rates and instruction position across models."

**Source:** [TACL 2024](https://aclanthology.org/2024.tacl-1.9/) | HIGH confidence (peer-reviewed)

### Instruction following degrades at ~150 instructions
IFScale benchmark (2025):
- Reasoning models maintain near-perfect until 150+ instructions, then steep decline
- At 300+ instructions: "uniform instruction abandonment"
- Even frontier models: only 68% accuracy at 500 instructions
- Primacy bias peaks at 150-200 instructions

**Source:** [arxiv.org/html/2507.11538v1](https://arxiv.org/html/2507.11538v1) | HIGH confidence (academic)

### Over-prompting causes overtriggering
Instructions for older models ("CRITICAL: You MUST") cause overtriggering on Claude 4.5/4.6. Fix: normal language.

**Source:** [Claude 4 best practices](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | HIGH confidence

### Three simple rules boosted OpenAI SWE-bench by ~20%
Just three instructions — persistence, tool-calling, planning — increased scores by ~20%.

**Source:** [GPT-4.1 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide) | HIGH confidence

---

## Actionable Recommendations for GSD

### For Agent Definitions (agents/*.md)

1. **Structure over size** — Use XML sections, keep organized. No magic length limit.
2. **Explain WHY, not just WHAT** — Rules with motivation generalize better.
3. **Dial back aggressive language** — Replace "CRITICAL: You MUST" with normal language for Claude 4.6.
4. **Use 3-5 examples** — Exemplars steer behavior more reliably than instructions.
5. **For Opus agents: broad goals > step-by-step** — "Think thoroughly" outperforms prescriptive plans.
6. **For Haiku agents: keep step-by-step** — Less capable models need more structure.
7. **Watch the 150-instruction threshold** — Beyond ~150 discrete rules, adherence degrades.

### For Workflow Files (workflows/*.md)

8. **Put data at top, instructions at bottom** — Leverages the 30% quality improvement.
9. **Keep orchestrator lean** — Sub-agents return condensed summaries.
10. **Default to single-agent** — Only decompose when parallelism or isolation is genuinely needed.
11. **Cap subagents at 3-4** per workflow step.

### For Tool/Skill Design

12. **3-4+ sentences per tool description** — Quality directly impacts performance.
13. **SKILL.md under 500 lines** — Move reference material to separate files.
14. **Progressive disclosure** — Load only what's needed when it's needed.
15. **Consolidate related operations** — Fewer, smarter tools > many thin wrappers.

### For the Specialist-in-the-Loop Feature Specifically

16. **Micro-research agent is well-scoped** — Single question, 15-30s, condensed return. Aligns with "sub-agents return 1-2k token summaries."
17. **Performance budget of 0-5 calls per session is appropriate** — Avoids subagent overuse anti-pattern.
18. **Reusing existing agent with mode switch** — Better than creating a new agent (reduces catalog bloat).
19. **Confidence-based presentation** — Aligns with "explain why" principle. HIGH → fact, MEDIUM → suggestion, LOW → ask user.

---

## Sources Index

| Source | Type | URL |
|--------|------|-----|
| Claude 4 best practices | Anthropic docs | https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices |
| Building Effective Agents | Anthropic research | https://www.anthropic.com/research/building-effective-agents |
| Effective context engineering | Anthropic engineering | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| Writing tools for agents | Anthropic engineering | https://www.anthropic.com/engineering/writing-tools-for-agents |
| Tool use with Claude | Anthropic docs | https://docs.anthropic.com/en/docs/build-with-claude/tool-use |
| Extend Claude with skills | Claude Code docs | https://code.claude.com/docs/en/skills |
| Agent Skills blog post | Anthropic blog | https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills |
| Advanced tool use | Anthropic engineering | https://www.anthropic.com/engineering/advanced-tool-use |
| GPT-4.1 Prompting Guide | OpenAI cookbook | https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide |
| Lost in the Middle | TACL 2024 | https://aclanthology.org/2024.tacl-1.9/ |
| IFScale (instruction following) | arXiv 2025 | https://arxiv.org/html/2507.11538v1 |
| Exemplars vs Instructions | NeurIPS 2024 | https://arxiv.org/abs/2406.15708 |
| Prompt complexity study | arXiv 2025 | https://arxiv.org/pdf/2602.00337 |
| Multi-Agent Orchestration | arXiv 2025 | https://arxiv.org/pdf/2511.15755 |
