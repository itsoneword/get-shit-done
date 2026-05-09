# Phase 3: Documentation Agent - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

`/gsd2:document` command that generates a layered, sourced system map from existing artifacts (planning docs, code, git history). Works on new projects (code + git only) and mature ones (full `.planning/`). Incremental updates via surgical edit. Hooks into milestone completion as a suggestion (not a gate).

Phase is FIXED. Not in scope: prose doc generation beyond the map, editor UI, inline doc by executors, replacing `map-codebase`.

</domain>

<established>
## Established Patterns (from codebase)

- **`map-codebase` workflow**: parallel mapper agents write files directly to `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS, INTEGRATIONS). Orchestrator summarizes only. This is the reuse target for Phase 3's `--full` / first-run path — and the doc agent can invoke it under the hood when those docs are missing.
- **Researcher/checker orchestration** (`ui-phase.md`, `agent-spec-phase.md`): sequential agent → validate → revision loop. NOT used in v1 (explicitly deferred — see decisions).
- **`complete-milestone.md` workflow**: existing milestone archival flow. The milestone hook (DOCS-05) inserts a suggestion step BEFORE archive.
- **Domain router (Phase 1) + AGENT-SPEC (Phase 2)**: planning artifacts now include `AGENT-SPEC.md`, `UI-SPEC.md`, per-phase `CONTEXT.md`, `SUMMARY.md`, and `RESEARCH.md`. These are the rich inputs the doc agent reads.
- **Parallel agent pattern**: agents write directly, orchestrator receives confirmation only. Keeps orchestrator context small.
- **`init.cjs` compound commands**: bundle phase/workflow context as JSON. `/gsd2:document` needs an `init document` entrypoint reporting state (existing map presence, last-run timestamp, GSD activity since).

</established>

<decisions>
## Implementation Decisions

### Output structure — layered, not single file
- Root index: `docs/SYSTEM-MAP.md` — high-level Mermaid + one-line description per subsystem, each linking to a detail file. Kept short (~100 lines), the "front door." [STRONG — user agreed with layered proposal citing Obsidian-style navigation]
- Per-subsystem files: `docs/system/{subsystem}.md` — one per bounded area the agent identifies. Each has focused Mermaid, sourced claims, and local gap markers. [STRONG]
- Gap aggregator: `docs/system/_gaps.md` — central list of undocumented behaviors with file:line pointers. User can work through it like a todo list. [STRONG — user chose this explicitly over inline or per-section options because less noise damage]
- Subsystem discovery is derived by the agent, not a fixed catalog. Inputs: directory structure, `.planning/codebase/STRUCTURE.md` if present, phase/milestone history. New project → from code only. [STRONG]

### Graph links — Obsidian wikilinks
- Use `[[wikilinks]]` for inter-doc references, not standard Markdown links. [STRONG — user explicitly chose Obsidian over GitHub portability when told the tradeoff]
- Rationale: the project already stores planning graph-style; Obsidian-style navigation matches the layered structure.

### Mermaid diagrams — agent decides per subsystem
- No fixed "component vs sequence vs both" rule. Agent picks the diagram type that best fits the subsystem being documented. [STRONG — user explicitly "agent may decide"]
- DOCS-02 requirement (at least one Mermaid showing component relationships or boundaries) is satisfied at the root `SYSTEM-MAP.md` level.

### [undocumented] marker behavior
- Option C selected: dedicated `docs/system/_gaps.md` file aggregating everything the agent couldn't source, with file:line pointers. [STRONG — explicit user choice]
- Rationale (from discussion): inline tags are noisy, per-section blocks fragment the signal, a central gaps file is actionable — feeds back into planning, can be treated like a todo list.
- Future enhancement (not this phase): `/gsd2:document --fix-gaps` interactive mode to prompt user for missing rationale. [DEFERRED]

### Scope flags on `/gsd2:document`
- Default: agent infers scope from state (last-run timestamp + GSD activity since: commits, completed phases, new SUMMARY.md files, new todos). [STRONG — user pushed back on per-phase flags as duplicative]
- `--full`: force full regeneration (first run, or when user knows everything is stale). [STRONG]
- `--subsystem <name>`: operator targets a specific subsystem they suspect is drifting. [STRONG]
- `--phase N` scope flag EXPLICITLY REJECTED — duplicates the agent's inference logic and overlaps with the milestone hook. [STRONG — user flagged this as redundant]

### Update policy — surgical edit + diff preview
- Incremental runs: agent proposes changes (diff preview), user confirms before writes. [STRONG — user voted for option 2 + 3 hybrid]
- `--yes` flag auto-applies without prompting (for CI / chained workflows). [WEAK — derived, not explicitly requested]
- Full runs (`--full` or first run): no diff preview, just write. [WEAK — logical consequence]

### Changelog at root
- Single minimal entry per run at top of `docs/SYSTEM-MAP.md`: timestamp + trigger (manual / milestone hook / full regen) + one-line summary of what changed. [STRONG — user agreed with "less damage by noise" framing, and a changelog only at root minimizes noise vs per-file]
- Rationale: gives a visible trail without polluting every subsystem file.

### Agent architecture — start simple, iterate on quality
- V1 pattern: `map-codebase`-style parallel mappers for `--full` and first runs, single smaller agent for incremental updates. [STRONG — user explicitly chose simpler path with intent to iterate]
- NO researcher/checker/revision loop in v1. [STRONG — "if I see quality not as good as we expect — will move more to agent like types"]
- Future enhancement: add researcher/checker if quality proves insufficient. [DEFERRED]
- Incremental agent gets full picture (reads existing map + recent SUMMARY.md files + git log + planning deltas) before proposing edits. [WEAK — derived from surgical edit requirement]

### Milestone completion hook
- Fires BEFORE `/gsd2:complete-milestone` archives phases, so the agent can read live planning artifacts. [STRONG]
- Suggestion, not a gate — user can skip with "no" or `--skip-docs`. [STRONG]
- Milestone-only — no per-phase trigger. "Doc only needed after some hard part is done, no need to document implementation of single button color change." [STRONG — user's exact reasoning]
- User retains manual control: can run `/gsd2:document` any time outside the milestone flow.

### Relationship to `map-codebase`
- Separate, unrelated workflow. `/gsd2:document` MAY call `map-codebase` under the hood when `.planning/codebase/` is missing and the agent needs structural input. [STRONG — user clarified: "was just a reference... could be completely unrelated workflow... can call map command under the hood as well, if needed"]
- Shared property: both must work on projects with no `.planning/` directory.
- Do NOT replace or merge `map-codebase` — it serves its own purpose (phase planning context).

### Claude's Discretion
- Exact Mermaid diagram types per subsystem
- Subsystem boundary inference heuristics
- Changelog entry phrasing and format
- How the incremental agent structures its diff preview
- Where in `complete-milestone.md` the hook inserts exactly (just before archival step)

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** User runs `/gsd2:document` on a project at any maturity level. Agent produces/updates `docs/SYSTEM-MAP.md` (root), `docs/system/{subsystem}.md` files (per-area detail with Mermaid), and `docs/system/_gaps.md` (what couldn't be sourced). Every claim cites its source. Incremental runs preserve unchanged content and show a diff preview. After a milestone, the complete-milestone workflow offers to run the agent before archiving.
- **Success signal:** A developer opens `docs/SYSTEM-MAP.md`, sees the system's shape via Mermaid + navigates via wikilinks to a focused subsystem file, reads a sourced explanation of how that subsystem works, and — if something is missing — finds it in `_gaps.md` with a clear pointer. Running the command a week later updates only what changed.
- **Flow:** user runs `/gsd2:document` → agent inspects state (last run, GSD activity since) → picks scope (full/incremental/subsystem) → parallel mappers (full) or single agent (incremental) reads planning artifacts + code + git → writes/edits files → shows diff preview on incremental → user confirms → changelog entry added to root. Separately: `/gsd2:complete-milestone` suggests a run before archive; user accepts or skips.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Documentation agent requirements
- `.planning/REQUIREMENTS.md` — DOCS-01 through DOCS-06 define all documentation agent requirements

### Workflows to reuse or hook into
- `~/.claude/get-shit-done/workflows/map-codebase.md` — parallel mapper orchestration pattern; may be invoked under the hood when `.planning/codebase/` is missing
- `~/.claude/get-shit-done/workflows/complete-milestone.md` — milestone archival flow; insertion point for DOCS-05 suggestion (BEFORE archive step)
- `~/.claude/get-shit-done/workflows/ui-phase.md` — researcher/checker pattern (deferred, reference for future iteration if v1 quality insufficient)
- `~/.claude/get-shit-done/workflows/agent-spec-phase.md` — researcher/checker pattern applied to agentic spec generation (deferred reference)

### Integration points
- `~/.claude/get-shit-done/bin/lib/init.cjs` — needs a new `init document` entrypoint returning state JSON (existing map files, last-run timestamp, GSD activity since last run)
- `~/.claude/get-shit-done/bin/lib/model-profiles.cjs` — model profile registration for the new document agent(s)

### Input artifacts the agent reads
- `.planning/PROJECT.md` — milestone goals, constraints, key decisions
- `.planning/ROADMAP.md` — phase structure and completion status
- `.planning/REQUIREMENTS.md` — validated/active requirement lists
- `.planning/phases/**/CONTEXT.md`, `RESEARCH.md`, `PLAN.md`, `SUMMARY.md` — per-phase planning artifacts
- `.planning/phases/**/AGENT-SPEC.md`, `UI-SPEC.md` — domain-specific specs when present
- `.planning/codebase/*.md` — structural maps if already produced
- Git history — commit log filtered to planning/code commits
- Actual code — source files for `[undocumented]` gap detection

### Prior phase context (dependencies)
- `.planning/phases/01-domain-router/01-CONTEXT.md` — domain classification available to the doc agent for subsystem labeling
- `.planning/phases/02-agent-spec/02-CONTEXT.md` — AGENT-SPEC structure the doc agent reads for agentic subsystems

### Memory
- Memory `project_domain_awareness.md` — milestone-level design decisions (on-demand not inline, map-first, cumulative updates)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `map-codebase.md` orchestration — parallel mapper pattern directly reusable for `--full` path
- `.planning/codebase/*.md` templates — if already produced, doc agent consumes them as pre-computed structural input
- `init.cjs` compound command pattern — add `init document` returning state JSON
- `gsd-tools.cjs` commit helper — used for committing doc changes atomically
- Model profiles in `model-profiles.cjs` — register new `gsd-document-mapper` and/or `gsd-document-updater` agent types

### Established Patterns
- Subagents write files directly; orchestrator receives confirmation only (keeps orchestrator context clean)
- Workflows live in `workflows/{name}.md`; bin entry in `bin/lib/` when state inspection needed
- Milestone-level hooks insert into `complete-milestone.md` as optional suggestions, not gates
- Commands follow `/gsd2:{name}` naming (e.g., `/gsd2:map-codebase`, `/gsd2:complete-milestone`)

### Integration Points
- **`workflows/document.md`** — NEW workflow file (the `/gsd2:document` command)
- **`workflows/complete-milestone.md`** — hook point BEFORE archive step: suggest running `/gsd2:document`
- **`bin/lib/init.cjs`** — add `init document` entrypoint
- **`bin/lib/model-profiles.cjs`** — register new agent type(s)
- **Command registration** (wherever new commands are declared for each runtime — Claude Code, Copilot, etc.)

</code_context>

<specifics>
## Specific Ideas

- User's framing for scope inference: "we write diffs only via gsd (todo, quick or phases/milestones), so when these commands running — there is already context on what we are working on now." This is the design lever — the agent has rich state signals, doesn't need to guess.
- User's architecture philosophy: "lets try with simpler... if I see quality not as good as we expect — will move more to agent like types (with deeper workflow analyzing the mapper output like research)." Ship v1 without researcher/checker; iterate based on observed quality.
- User's hook placement reasoning: "doc only needed after some hard part is done, no need to document implementation of single button color change." Milestone hook only — not per-phase, not per-todo.
- User's Obsidian preference signals intent to navigate the system map as a personal knowledge graph, not just serve it as GitHub docs.

</specifics>

<deferred>
## Deferred Ideas

- `/gsd2:document --fix-gaps` interactive mode that walks the user through `_gaps.md` entries and captures missing rationale — future phase
- Researcher/checker pattern for the document agent (like `ui-phase` / `agent-spec-phase`) — revisit only if v1 parallel-mapper + single-updater quality proves insufficient
- Per-phase auto-trigger on phase completion — explicitly rejected; only milestone trigger in this phase
- Prose documentation generation layer on top of the map (memory note: "Prose documentation is second layer, generated from map when needed") — future phase once the map layer is solid
- GitHub-portable wikilink rendering (pandoc-style or a link rewriter) — future if users hit friction viewing on GitHub

</deferred>

---

*Phase: 03-documentation-agent*
*Context gathered: 2026-04-17*
