<purpose>
Orchestrate the on-demand documentation agent: generate or update a layered, sourced SYSTEM-MAP in docs/ from planning artifacts, code, and git history. Full runs use parallel mappers (one per subsystem, agent-discovered). Incremental runs use a single updater with two-pass diff preview. All inter-doc navigation uses Obsidian [[wikilinks]]. Every claim cites a source or is routed to docs/system/_gaps.md.
</purpose>

<process>

<step name="init_context" priority="first">
```bash
INIT=$(node "/Users/itsoneword/Downloads/devProjects/GSD/get-shit-done/.claude/get-shit-done/bin/gsd-tools.cjs" init document)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract all 17 keys from the init JSON:
- `mapper_model` — resolved model for `gsd-document-mapper` agent
- `updater_model` — resolved model for `gsd-document-updater` agent
- `commit_docs` — whether to auto-commit generated docs
- `docs_dir` — `docs`
- `system_dir` — `docs/system`
- `root_map_path` — `docs/SYSTEM-MAP.md`
- `gaps_path` — `docs/system/_gaps.md`
- `root_map_exists` — boolean
- `system_dir_exists` — boolean
- `existing_subsystems` — array of subsystem filenames (excludes `_gaps.md` and `_proposed.md`)
- `last_run_iso` — ISO timestamp of last run (from root changelog), or null
- `has_planning` — `.planning/` exists
- `has_codebase_maps` — `.planning/codebase/` exists
- `commits_since` — git commit count since `last_run_iso`
- `new_summaries` — SUMMARY.md files changed since last run
- `completed_phases_since` — phases marked `[x]` in ROADMAP
- `new_todos` — count of todo additions since last run
</step>

<step name="parse_arguments">
Parse `$ARGUMENTS` for flags and capture:

- `FULL=true` if `--full` present
- `YES=true` if `--yes` present
- `SKIP=true` if `--skip-docs` present
- `SUBSYSTEM=<name>` if `--subsystem <name>` present
- `PHASE_FLAG=true` if `--phase` (any form `--phase`, `--phase=`, `--phase N`) present

Then apply rejection and skip rules in order:

1. If `PHASE_FLAG` is true → exit with non-zero code and print to stderr/stdout:
   ```
   error: --phase N is not supported. Use --subsystem <name> for targeted updates or --full for full regeneration.
   ```
2. If `SKIP` is true → exit 0 with message `Skipped per --skip-docs.` — do NOT invoke any agent, do NOT touch files.
</step>

<step name="decide_mode">
Apply the scope decision tree using the flags and the init JSON:

1. If `FULL === true` OR `root_map_exists === false` → `MODE=FULL`
2. Else if `SUBSYSTEM` is set (non-empty) → `MODE=TARGETED`
3. Else if `last_run_iso` is non-null AND `commits_since === 0 && new_summaries.length === 0 && new_todos === 0` → prompt the user:
   ```
   No GSD activity since last run (commits_since=0, new_summaries=0, new_todos=0). Run anyway? (y/n)
   ```
   Default `n`. If the user answers `n` or times out → exit 0. If `y` → `MODE=INCREMENTAL`.
4. Else → `MODE=INCREMENTAL`

Announce the resolved mode: `Mode: {MODE}`.
</step>

<step name="ensure_codebase_maps" condition="MODE == FULL AND has_codebase_maps === false">
When `MODE === FULL` and `has_codebase_maps === false`, spawn the 4 `gsd-codebase-mapper` agents directly BEFORE the document mappers. This is a sub-invocation, NOT a nested `/gsd2:map-codebase` command. Skip the `offer_next` UX from `map-codebase.md`.

```bash
mkdir -p .planning/codebase
```

Spawn 4 parallel `gsd-codebase-mapper` agents with `model="{mapper_model}"` and `run_in_background=true` (block copied from `map-codebase.md`):

**Agent 1: Tech**
```
Task(subagent_type="gsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map codebase tech stack",
  prompt="Focus: tech
Analyze this codebase for technology stack and external integrations.
Write to .planning/codebase/:
- STACK.md - Languages, runtime, frameworks, dependencies, configuration
- INTEGRATIONS.md - External APIs, databases, auth providers, webhooks
Explore thoroughly. Write documents directly using templates. Return confirmation only.")
```

**Agent 2: Architecture**
```
Task(subagent_type="gsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map codebase architecture",
  prompt="Focus: arch
Analyze this codebase architecture and directory structure.
Write to .planning/codebase/:
- ARCHITECTURE.md - Pattern, layers, data flow, abstractions, entry points
- STRUCTURE.md - Directory layout, key locations, naming conventions
Explore thoroughly. Write documents directly using templates. Return confirmation only.")
```

**Agent 3: Quality**
```
Task(subagent_type="gsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map codebase conventions",
  prompt="Focus: quality
Analyze this codebase for coding conventions and testing patterns.
Write to .planning/codebase/:
- CONVENTIONS.md - Code style, naming, patterns, error handling
- TESTING.md - Framework, structure, mocking, coverage
Explore thoroughly. Write documents directly using templates. Return confirmation only.")
```

**Agent 4: Concerns**
```
Task(subagent_type="gsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map codebase concerns",
  prompt="Focus: concerns
Analyze this codebase for technical debt, known issues, and areas of concern.
Write to .planning/codebase/:
- CONCERNS.md - Tech debt, bugs, security, performance, fragile areas
Explore thoroughly. Write document directly using template. Return confirmation only.")
```

Call `TaskOutput` for all 4 task_ids in parallel. Do NOT present the user any "next up" summary from map-codebase; this is a sub-step. Proceed directly to `discover_subsystems`.
</step>

<step name="discover_subsystems" condition="MODE == FULL">
Build a preliminary list of candidate subsystems from these sources (agent-assisted refinement may happen inside mapper prompts; the orchestrator produces a seed list):

1. `.planning/codebase/STRUCTURE.md` if present — extract top-level modules.
2. Top-level code directories — e.g., `src/`, `bin/`, `workflows/`, `agents/`, `commands/`, `hooks/`, `tests/`.
3. Completed phases in `.planning/phases/` — each phase with a `SUMMARY.md` may seed one subsystem named after the phase slug.

Deduplicate and produce an array `DISCOVERED_SUBSYSTEMS` of objects:
```
{ slug: "lowercase-kebab-case", boundary: "<file paths / modules>", input_artifacts: "<planning files + code paths>" }
```

Slugs MUST be lowercase-kebab-case and globally unique within `docs/system/`. Reject collisions (append numeric suffix if inferred slug collides with an existing subsystem name).

Typical count: 3-8 subsystems. Log the list before spawning.
</step>

<step name="spawn_full_mappers" condition="MODE == FULL">
Spawn N parallel `gsd-document-mapper` Task calls (one per subsystem in `DISCOVERED_SUBSYSTEMS`) in a single message with `run_in_background=true`. Orchestrator MUST NOT read document bodies.

For each subsystem:
```
Task(subagent_type="gsd-document-mapper", model="{mapper_model}", run_in_background=true,
  description="Document subsystem {N}: {slug}",
  prompt="subsystem_slug: {slug}
boundary: {boundary}
input_artifacts: {input_artifacts}
existing_file_path: null
Write to docs/system/{slug}.md. Return confirmation only.")
```

Collect confirmations via `TaskOutput` in a single parallel call. If any mapper fails, log the failure and continue with the successful ones. Proceed to `write_root_map`.
</step>

<step name="write_root_map" condition="MODE == FULL">
Orchestrator writes `docs/SYSTEM-MAP.md` after mappers finish. The root file must contain:

- H1 title (e.g., `# System Map: {project-name}`)
- **Changelog section** immediately after the H1, as a dated list. Seed with this run's entry at the TOP:
  ```
  ## Changelog
  - <ISO timestamp> | full | regenerated N subsystems
  ```
- One top-level Mermaid fenced block (`mermaid`) showing subsystem relationships. Use `[[wikilinks]]` on nodes where possible (or parenthetical hints pointing to the file names).
- A "Subsystems" section with one short paragraph per subsystem: one-line description + `[[wikilink]]` to `docs/system/{slug}.md`.
- Target: ≤ 100 lines.

Orchestrator does NOT read any subsystem file contents to write the root map; use only the confirmation metadata (slug + one-liner returned by each mapper).
</step>

<step name="spawn_incremental_updater" condition="MODE == INCREMENTAL OR MODE == TARGETED">
Two-pass updater flow. The agent writes its proposed changes to `docs/system/_proposed.md` on pass 1 (diff preview), then applies them on pass 2 after user confirmation.

**Pass 1 — propose (`mode=propose`):**

```
Task(subagent_type="gsd-document-updater", model="{updater_model}",
  description="Propose doc updates",
  prompt="mode=propose
activity:
  commits_since: {commits_since}
  new_summaries: {new_summaries}
  completed_phases_since: {completed_phases_since}
  new_todos: {new_todos}
  last_run_iso: {last_run_iso}
existing_files: {existing_subsystems + root_map_path}
subsystem_slug: {SUBSYSTEM or null}
Read existing files + deltas. Write proposed edits to docs/system/_proposed.md. Do not modify other files yet. Return confirmation only.")
```

After the agent confirms, read `docs/system/_proposed.md` contents and present them to the user for review.

**Pass 2 — apply (`mode=apply`), gated on `YES` flag or user confirm:**

If `YES === true` → skip prompt, proceed to apply.
Else prompt:
```
Apply proposed changes? (y/n)
[show _proposed.md contents for user review]
```

- `n` → delete `docs/system/_proposed.md` and exit 0.
- `y` (or `YES`) → spawn pass 2:

```
Task(subagent_type="gsd-document-updater", model="{updater_model}",
  description="Apply proposed doc updates",
  prompt="mode=apply
proposed_file: docs/system/_proposed.md
Read the proposal, apply surgical edits to the target files, append exactly ONE new changelog entry at the top of docs/SYSTEM-MAP.md (preserve all existing entries verbatim — changelog is APPEND-ONLY), and delete docs/system/_proposed.md when done. Return confirmation only.")
```

Collect confirmation. If the agent reports failure, keep `_proposed.md` so the user can re-run or inspect.
</step>

<step name="verify_outputs">
Run automated checks on the output files:

```bash
# Root map exists
test -f docs/SYSTEM-MAP.md || echo "FAIL: docs/SYSTEM-MAP.md missing"

# At least one mermaid fenced block
grep -q '```mermaid' docs/SYSTEM-MAP.md || echo "FAIL: no mermaid block in root map"

# At least one changelog entry dated today
TODAY=$(date -u +%Y-%m-%d)
grep -q "$TODAY" docs/SYSTEM-MAP.md || echo "FAIL: no changelog entry dated today"

# Gaps file exists (may be header-only but must exist)
test -f docs/system/_gaps.md || echo "FAIL: docs/system/_gaps.md missing"
```

On `MODE == FULL`: for each slug in `DISCOVERED_SUBSYSTEMS`, verify `docs/system/{slug}.md` exists.

On `MODE == INCREMENTAL` or `MODE == TARGETED`: verify `docs/system/_proposed.md` does NOT exist (cleanup confirmed).

If any check fails, print the failure line to the user but do NOT roll back — agent outputs were committed separately and the user can fix up.
</step>

<step name="commit">
Respect `commit_docs` from init:

```bash
if [ "$commit_docs" = "true" ]; then
  node "/Users/itsoneword/Downloads/devProjects/GSD/get-shit-done/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(system-map): $MODE update" --files docs/
fi
```

If `commit_docs` is false, skip the commit and leave the files modified for the user to handle.
</step>

<step name="summarize">
Print a short, non-interactive summary to the user:

```
/gsd2:document complete
- Mode: {MODE}
- Subsystems touched: {count}
- Gaps file entries: {wc -l of docs/system/_gaps.md}
- Commit: {commit hash if commit_docs, else "skipped (commit_docs=false)"}
```

Do NOT present a "next up" suggestion — `/gsd2:document` is an on-demand command, not a stage in a fixed flow.
</step>

</process>

<anti_patterns>

The following anti-patterns are drawn from `.planning/phases/03-documentation-agent/03-RESEARCH.md` (Pitfalls 1-6). Each is a "do not" rule with the guard that prevents it.

1. **Do not allow ambiguous wikilinks.** Mapper and updater prompts require full subsystem slugs in wikilinks (`[[auth-service]]`, not `[[auth]]`); slugs must be globally unique within `docs/system/`. The `discover_subsystems` step dedupes and appends a numeric suffix on collision. [Pitfall 1]

2. **Do not emit claims without sources.** Every sentence in every subsystem file must cite one of: `file:line`, a `.planning/**` artifact path, or a git commit hash. Un-sourceable behaviors are routed to `docs/system/_gaps.md` under `## Subsystem: {slug}` headings — the persona enforces this, the workflow does not bypass it. [Pitfall 2]

3. **Do not let scope inference miss quick commits.** The decision tree in `decide_mode` inspects `commits_since` and `new_todos` in addition to `new_summaries` and `completed_phases_since`. If `commits_since > 0` and everything else is zero, the user is still offered an incremental run (via the "Run anyway?" prompt) — never a silent no-op. [Pitfall 3]

4. **Do not overwrite the changelog.** The updater persona and the pass-2 prompt in `spawn_incremental_updater` both enforce append-only: exactly ONE new entry is inserted at the top of `docs/SYSTEM-MAP.md`; existing entries are preserved verbatim. `write_root_map` (full runs) writes the complete changelog only because the file is being regenerated from scratch. [Pitfall 4]

5. **Do not block milestone archival on doc generation.** This workflow does NOT fail milestone completion. The milestone hook (in `complete-milestone.md`) is a suggestion only; if the user accepts, they are instructed to run `/gsd2:document` themselves — the archive step is not gated on doc success. [Pitfall 5]

6. **Do not recurse into `/gsd2:map-codebase` as a user command.** When `has_codebase_maps === false` and `MODE === FULL`, `ensure_codebase_maps` spawns the 4 `gsd-codebase-mapper` agents DIRECTLY — it does NOT invoke the `/gsd2:map-codebase` command. The `offer_next` UX from `map-codebase.md` is explicitly skipped to avoid a "Next Up: /gsd2:new-project" message mid doc-run. [Pitfall 6]

</anti_patterns>

<success_criteria>
- All 11 steps execute in order: init_context → parse_arguments → decide_mode → ensure_codebase_maps (conditional) → discover_subsystems (conditional) → spawn_full_mappers (conditional) → write_root_map (conditional) → spawn_incremental_updater (conditional) → verify_outputs → commit → summarize
- `--phase N` is rejected with the exact error message; `--skip-docs` exits 0 without side effects
- Full runs produce `docs/SYSTEM-MAP.md` with ≥1 Mermaid block + dated changelog entry + `[[wikilinks]]`, plus `docs/system/{slug}.md` per discovered subsystem, plus `docs/system/_gaps.md`
- Incremental/targeted runs produce `docs/system/_proposed.md` for user review, then either delete it (on `n`) or apply edits + delete it (on `y`/`--yes`)
- Orchestrator never reads subsystem document bodies; it works from confirmation metadata only
- `commit_docs === false` is honored (no commit made)
</success_criteria>
