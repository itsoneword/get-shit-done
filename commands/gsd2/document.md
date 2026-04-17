---
name: gsd2:document
description: Generate or update a layered, sourced SYSTEM-MAP in docs/ from planning artifacts, code, and git history
argument-hint: "[--full] [--subsystem <name>] [--yes] [--skip-docs]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - Task
---

<objective>
Produce or update a layered, sourced system map for the project:

- `docs/SYSTEM-MAP.md` — root overview with subsystem index, cross-cutting diagrams, and a changelog of documentation runs.
- `docs/system/{subsystem}.md` — one file per discovered subsystem with a Mermaid diagram (type chosen per subsystem: flowchart, sequence, state, class, etc.), behaviors, interfaces, and cited sources.
- `docs/system/_gaps.md` — aggregated list of behaviors that could not be sourced, grouped by subsystem.

**Execution modes:**

- `--full` or first run → spawn parallel `gsd-document-mapper` agents, one per discovered subsystem; write all files from scratch.
- Incremental (default when prior `docs/SYSTEM-MAP.md` exists) → spawn a single `gsd-document-updater` agent in propose mode, preview the diff, require confirmation (auto-confirm with `--yes`), then apply.

**Invariants:**

- Every non-heading claim in subsystem files cites a source: `path/to/file:line`, a planning artifact path, or a short git hash.
- Inter-document navigation uses Obsidian `[[wikilinks]]` — never Markdown links.
- The Mermaid diagram type is chosen per subsystem by the mapper/updater agent based on what best represents the subsystem's behavior.
</objective>

<execution_context>
@/Users/itsoneword/Downloads/devProjects/GSD/get-shit-done/.claude/get-shit-done/workflows/document.md
</execution_context>

<context>
**Argument parsing** (`$ARGUMENTS`):

- `--full` — force full regeneration: spawn parallel mappers per discovered subsystem, overwrite all files in `docs/system/`.
- `--subsystem <name>` — target a single subsystem; only that file in `docs/system/` is updated.
- `--yes` — auto-confirm the diff preview in incremental mode (non-interactive).
- `--skip-docs` — skip the final commit of generated docs (useful when the caller wants to inspect before committing).

**No flags → inferred scope.** The agent reads `init document` state (last-run timestamp + GSD activity since — new plans, summaries, commits) and picks:
- No prior run → full.
- Prior run + changes since → incremental with automatically detected subsystems.
- Prior run + no changes → no-op with a message.

**Rejected flags.** If `$ARGUMENTS` contains `--phase N` (or any `--phase` variant), fail immediately with:

> --phase N is not supported. Use --subsystem <name> to target a specific subsystem, or --full to regenerate everything.

The documentation agent is scoped by subsystem, not by phase. Phase boundaries are a planning artifact; subsystems are a runtime/architectural artifact. Conflating them pollutes the system map with planning-time concerns.
</context>

<when_to_use>
**Use `/gsd2:document` for:**

- Generating a system map for the first time on any project maturity (greenfield with code only, brownfield with full `.planning/`, or mid-development).
- Refreshing the map after a milestone completes (the `complete-milestone` workflow suggests this as the final step).
- Targeted update of one subsystem that is known-stale via `--subsystem <name>` (for example, after a focused refactor).

**Skip `/gsd2:document` for:**

- Trivial changes (button color, typo, single-file bug fix) — documentation runs at milestone granularity, not per-commit.
- Projects with no code AND no planning artifacts — there is nothing to map.
</when_to_use>

<process>
1. Call `gsd-tools.cjs init document` to load state: last-run timestamp, existing `docs/` files, GSD activity since last run.
2. Resolve scope: explicit (`--full` / `--subsystem <name>`) or inferred from state.
3. **Full mode** → discover subsystems from planning artifacts + code structure; spawn parallel `gsd-document-mapper` agents (one per subsystem); each mapper writes its `docs/system/{name}.md` directly and returns a short summary; orchestrator assembles `docs/SYSTEM-MAP.md` root and `docs/system/_gaps.md`.
4. **Incremental mode** → spawn a single `gsd-document-updater` agent in propose mode; agent emits a unified diff against the existing docs; orchestrator shows the diff; user confirms (or `--yes` auto-confirms); agent applies the diff.
5. Append a changelog entry at the top of `docs/SYSTEM-MAP.md` (date, mode, subsystems touched, run trigger).
6. Unless `--skip-docs`, commit generated docs via `gsd-tools.cjs commit` (respects the `commit_docs` config flag).
</process>

<success_criteria>
- [ ] `docs/SYSTEM-MAP.md` exists with at least one Mermaid diagram and a changelog entry for this run
- [ ] `docs/system/` contains one `.md` file per discovered subsystem (or preserved from prior run on incremental)
- [ ] `docs/system/_gaps.md` exists (even if empty — lists un-sourced behaviors grouped by subsystem)
- [ ] Every non-heading claim in subsystem files cites a source (`file:line`, planning artifact, or git hash)
- [ ] Inter-document navigation uses Obsidian `[[wikilinks]]`, not Markdown links
</success_criteria>
