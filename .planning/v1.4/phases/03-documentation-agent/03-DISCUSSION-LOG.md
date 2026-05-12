# Phase 3: Documentation Agent - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the conversation and reasoning.

**Date:** 2026-04-17
**Phase:** 03-documentation-agent
**Discussion style:** Conversation-first
**Decisions captured:** 12 areas (9 STRONG, 3 with WEAK sub-decisions, 0 DISCRETION blocks beyond noted scope)

---

## Conversation Summary

### Relationship to `map-codebase`
**User's perspective:** "map codebase was just a reference. could be completely unrelated workflow, the goal is to have same property of be run against new codebase. can call map command under the hood as well, if needed."
**Decision:** `/gsd2:document` is a separate workflow; may invoke `map-codebase` when `.planning/codebase/` missing; does not replace it.
**Signal:** STRONG — user explicit framing, multiple clarifying clauses.

### System map structure
**User's perspective:** Liked layered approach. "considering whole project has structure could be easily separated (not store all doc in single file but have layers and only search in relevant one. could use graph based system as on obsidian or something similar)."
**Decision:** Three-tier layout — `docs/SYSTEM-MAP.md` (root), `docs/system/{subsystem}.md`, `docs/system/_gaps.md`. Subsystems derived by agent, not fixed.
**Signal:** STRONG — user proposed the layering philosophy first; assistant formalized structure; user accepted.

### Mermaid diagram types
**User's perspective:** "probably agent may decide."
**Decision:** Agent picks diagram type per subsystem; root map always has at least one Mermaid (satisfies DOCS-02).
**Signal:** STRONG (for the discretion decision itself) — user explicitly deferred to agent.

### [undocumented] marker behavior
**User's perspective:** Asked for elaboration of the concept. After options A/B/C presented: "hard to say, you decide how it gives less damage by noise" — then in follow-up "agree with C too."
**Decision:** Option C — dedicated `docs/system/_gaps.md` aggregator with file:line pointers.
**Signal:** STRONG — explicit confirmation after understanding options.

### Scope flags and inference
**User's perspective:** "I would say yes, but considering it runs after each phase and decides if doc is needed — its kind of duplicating, no?"
**Decision:** Keep `--full` and `--subsystem <name>`; reject `--phase N` as duplicative with inference + milestone hook.
**Signal:** STRONG — user identified the duplication; assistant reconciled and user implicitly accepted reconciliation.

### Update policy for incremental runs
**User's perspective:** "I vote for 2 and 3" (surgical edit + propose diff).
**Decision:** Incremental = surgical edit with diff preview and user confirmation; `--yes` auto-applies; full runs write without preview.
**Signal:** STRONG for main decision; WEAK for `--yes` flag (derived, not requested).

### Graph link style
**User's perspective:** "I vote for better visibility (obsidian)" — chose Obsidian wikilinks over GitHub-portable Markdown links when tradeoff was presented.
**Decision:** Use `[[wikilinks]]` throughout.
**Signal:** STRONG — explicit choice against portability.

### Changelog at root
**User's perspective:** Assistant framed as "less damage by noise" trade; user accepted overall architecture bundle including this.
**Decision:** Minimal one-line timestamped entry at top of root `SYSTEM-MAP.md` per run.
**Signal:** STRONG (accepted in bundle with other answers).

### Milestone completion hook
**User's perspective:** "I think before, as part of closing milestone — write the doc. although, could be skipped, doc only needed after some hard part is done, no need to document implementation of single button color change."
**Decision:** Hook fires BEFORE archive in `complete-milestone`; suggestion not gate; milestone-only (no per-phase trigger).
**Signal:** STRONG — user gave the full reasoning (why milestone not phase).

### Agent architecture
**User's perspective:** "lets try with simpler (like map codebase + smaller single agent for increment, if I see quality not as good as we expect — will move more to agent like types (with deeper workflow analyzing the mapper output like research)."
**Decision:** Parallel mappers (full) + single smaller agent (incremental). No researcher/checker loop in v1. Iterate if quality disappoints.
**Signal:** STRONG — user explicit architectural preference with explicit future-path condition.

### Output paths
**User's perspective:** "Im ok with given layer system" — accepted `docs/SYSTEM-MAP.md` + `docs/system/*.md` + `docs/system/_gaps.md`.
**Decision:** As proposed.
**Signal:** STRONG — explicit acceptance.

---

## Established (Not Discussed)
- `map-codebase` parallel mapper pattern — presented as reuse reference, user acknowledged
- `complete-milestone.md` workflow existence — presented as hook point, user confirmed placement
- Domain router (Phase 1) + AGENT-SPEC (Phase 2) as input sources — implicit carry-forward from memory and project state
- Memory-driven defaults: on-demand not inline, map-first, cumulative updates — user did not challenge these

## Deferred Ideas
- `--fix-gaps` interactive mode — future phase
- Researcher/checker pattern for doc agent — v2 if quality insufficient
- Per-phase auto-trigger — explicitly rejected in this phase
- Prose documentation layer on top of the map — future phase
- GitHub-portable wikilink rendering — future if friction observed
