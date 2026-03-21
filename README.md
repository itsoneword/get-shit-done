# GSD v2 — Experimental Fork

> Fork of [get-shit-done](https://github.com/gsd-build/get-shit-done) by **TÂCHES** — a meta-prompting and spec-driven development system for Claude Code.
>
> This fork explores architectural improvements to the discussion and planning pipeline.

## What's Different Here

### Problem: The Information Funnel

The original GSD has a lossy compression problem in its pipeline:

```
new-project:   Rich adaptive questioning → PROJECT.md              ✓ Great
roadmapper:    AI reads PROJECT.md → 1-2 sentence phase descs      ← lossy
discuss-phase: AI reads 1 sentence → generates gray areas → menus  ← lossy again
plan-phase:    Planner reads CONTEXT.md (from generic questions)   ← builds on sand
executor:      Reads PLAN.md (3rd-hand interpretation of intent)   ← most removed
```

By the time an executor reads its PLAN.md, it's working from decisions that were answers to questions that were generated from assumptions derived from a 1-sentence roadmap entry.

### Changes in This Fork

**1. Conversation-first discuss-phase** (done)

Replaced the rigid menu-driven interview (3-4 gray areas × 4 AskUserQuestion each) with genuine back-and-forth conversation:

- Opens with "Tell me about this phase" instead of pre-generated multiple choice
- Classifies codebase into ESTABLISHED (don't ask) vs NEW (discuss)
- Follows user energy — deep where it matters, brief where it doesn't
- AskUserQuestion only for binary choices, not as primary interaction
- Adaptive depth: 3 questions if simple, 15 if complex

**2. Signal strength on decisions** (done)

Every decision in CONTEXT.md now carries `[STRONG]`, `[WEAK]`, or `[DISCRETION]`:

```markdown
- Card-based layout [STRONG — user referenced Pinterest, wants masonry grid]
- Dark theme [WEAK — said "probably" without preference]
- Loading skeleton [DISCRETION — "whatever works"]
```

Downstream agents treat these differently: planner won't deviate from STRONG, can adjust WEAK.

**3. Cross-phase note pollination** (done)

During discussion of phase 2, if user mentions something relevant to phase 5 → saved to `.planning/cross-phase-notes.md`. When phase 5 is discussed later, those notes are pre-loaded:

> "From your Phase 2 discussion, you mentioned X. Still the plan?"

Result: 10-15 questions across 5 phases instead of 5 × 4 = 20, because answers cross-pollinate.

**4. Discussion focus hints in roadmap** (done)

Roadmapper now generates `**Discussion focus**:` per phase — what's ambiguous and needs user input. Discuss-phase reads this to prioritize conversation.

**5. Specialist-in-the-loop during discussion** (done)

Technical questions during discuss-phase are now answered by a specialist agent instead of the user. Before asking any implementation/architecture question, the orchestrator classifies it:

- **PREFERENCE** (user taste/priority) → ask user directly
- **TECHNICAL** (domain constraints, ecosystem standards) → spawn `gsd-phase-researcher` in micro-research mode, present recommendation
- **HYBRID** (technical feasibility shapes options) → research first, present viable options to user

```
BEFORE: "Should we use REST or WebSocket for HFT data?" → user guesses
AFTER:  Specialist researches → "WebSocket — REST adds 50-200ms latency,
        unviable for HFT [HIGH confidence]" → user confirms
```

New signal strength types: `[STRONG, specialist-backed]`, `[WEAK, specialist-backed]`, `[STRONG, user-override]`.

**6. Agent prompt optimization** (done)

All 15 agent definitions rewritten based on current best practices research:

- **9,210 → 4,961 lines** (-46%) with **47 concrete examples** added
- Replaced prescriptive step-by-step with broad goals (smarter models need simpler prompts)
- Replaced aggressive language (CRITICAL/MUST/NEVER) with normal prose explaining WHY
- Added good-vs-bad examples to every agent (exemplars outperform instructions per NeurIPS 2024)
- Research backing: `docs/RESEARCH-agent-best-practices.md` (Anthropic docs, academic papers, all with source URLs)

**7. Workflow prompt optimization** (done)

All 49 workflow files optimized for orchestrator token efficiency:

- **16,176 → 12,708 lines** (-21%) — different approach than agents since workflows are procedural orchestration, not behavioral prompts
- Cut redundancy and meta-commentary while preserving all procedural steps
- Added WHY to emphasized constraints, capped at 3-5 per file
- Moved critical instructions to end of files (30% quality improvement per Anthropic research)
- Research backing: `docs/RESEARCH-workflow-optimization.md`

**8. Namespace migration to gsd2** (done)

- All commands renamed from `/gsd:*` to `/gsd2:*`
- Installer auto-cleans old `commands/gsd/` directory during upgrade
- `.planning/` data is fully backward compatible

### What's NOT Changed

- `.planning/` file formats (STATE.md, CONTEXT.md, PLAN.md, etc.)
- gsd-tools CLI interface and JSON output
- Installation and runtime support (Claude Code, Gemini, Codex, Copilot, Cursor, Antigravity)

## Install

```bash
npx gsd2@latest
```

Or from source:

```bash
git clone https://github.com/itsoneword/get-shit-done.git
cd get-shit-done
npm run dev
```

## Architecture Visualizations

Two interactive HTML reports are included (open in browser):

- `gsd-architecture.html` — Pipeline flow, problem analysis, file flow, improvement proposals
- `gsd-orchestration.html` — Agent spawning map, conditions, prompts, workflow swim lanes

## Planned Improvements

- [ ] Multi-workflow parallelism (phase-level waves, execution manifest for resumability)
- [ ] Manifest.yml for selective context loading (structured metadata approach)
- [ ] Agent consolidation (15 agents → ~8 with parameterized focus)

## Original Project

Full docs, commands, and configuration: [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)

## License

MIT — same as original.
