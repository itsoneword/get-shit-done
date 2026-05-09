# Phase 3: Documentation Agent - Research

**Researched:** 2026-04-17
**Domain:** Agentic workflow (on-demand documentation generation) + Markdown/Mermaid authoring
**Confidence:** HIGH (internal patterns), MEDIUM (Mermaid/Obsidian conventions)

## Summary

Phase 3 adds `/gsd2:document` — an on-demand workflow that produces a layered, sourced SYSTEM-MAP from a project's planning artifacts, git history, and source code. The user's decisions in `03-CONTEXT.md` are locked and unusually detailed: three-tier output (`docs/SYSTEM-MAP.md` + `docs/system/{subsystem}.md` + `docs/system/_gaps.md`), Obsidian-style `[[wikilinks]]`, agent-chosen Mermaid diagram types, `map-codebase`-style parallel mappers for full runs, a single smaller updater agent for incremental runs with diff preview, and a milestone-hook suggestion (not gate) inserted *before* archival in `complete-milestone.md`.

The entire implementation lives inside the existing GSD runtime — no new external dependencies. The planner's job is to turn this locked design into waves/tasks that: (1) build the workflow file (`workflows/document.md`), (2) add an `init document` entrypoint in `bin/lib/init.cjs`, (3) register new agent type(s) in `model-profiles.cjs`, (4) create agent persona files in `.claude/agents/`, (5) register the `/gsd2:document` command in both `.claude/commands/gsd2/` and `commands/gsd2/` (runtime and source), and (6) patch `complete-milestone.md` with the pre-archive suggestion hook.

**Primary recommendation:** Reuse every pattern already present in the codebase — `map-codebase.md` for the full-run orchestration shape, `ui-phase.md`/`agent-spec-phase.md` for workflow file structure, `gsd-codebase-mapper` for the mapper agent template. Introduce no new libraries. The only novel mechanic is diff-preview-before-write for incremental runs, which is implementable as a two-pass agent flow using existing `Read`/`Write`/`Bash` tools.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Output structure (STRONG):**
- `docs/SYSTEM-MAP.md` — root index, ~100 lines, high-level Mermaid + one-line subsystem descriptions, each linking to a detail file, changelog at top.
- `docs/system/{subsystem}.md` — one per agent-identified bounded area, focused Mermaid, sourced claims.
- `docs/system/_gaps.md` — aggregator of undocumented behaviors with file:line pointers.
- Subsystems derived by agent (inputs: directory structure, `.planning/codebase/STRUCTURE.md` if present, phase/milestone history). Not a fixed catalog.

**Graph links (STRONG):** `[[wikilinks]]` (Obsidian), not GitHub-portable Markdown links. GitHub rendering friction accepted.

**Mermaid (STRONG):** Agent picks diagram type per subsystem. Root map must have ≥1 Mermaid (satisfies DOCS-02).

**[undocumented] marker (STRONG):** Option C — centralized `_gaps.md` with file:line pointers. No inline tags, no per-section gap blocks.

**Scope flags on `/gsd2:document` (STRONG):**
- Default: agent infers scope from last-run timestamp + GSD activity (commits, completed phases, new SUMMARY.md files, new todos).
- `--full`: force full regeneration.
- `--subsystem <name>`: target a specific subsystem.
- `--phase N` **EXPLICITLY REJECTED**.

**Update policy (STRONG for main, WEAK for `--yes`):**
- Incremental = surgical edit + diff preview + user confirmation.
- `--yes` auto-applies (WEAK, derived).
- Full runs write without preview (WEAK, logical consequence).

**Changelog (STRONG):** Single minimal one-line entry per run at top of root `SYSTEM-MAP.md`. Timestamp + trigger + one-line summary. No per-file changelog.

**Agent architecture (STRONG):** `map-codebase`-style parallel mappers for `--full` / first run; single smaller agent for incremental. NO researcher/checker/revision loop in v1.

**Milestone hook (STRONG):** Fires BEFORE archive in `complete-milestone.md`. Suggestion not gate. User can skip with "no" or `--skip-docs`. Milestone-only — no per-phase trigger.

**Relationship to map-codebase (STRONG):** Separate workflow. `/gsd2:document` MAY invoke `map-codebase` under the hood when `.planning/codebase/` is missing. Does NOT replace or merge with it.

### Claude's Discretion

- Exact Mermaid diagram types per subsystem
- Subsystem boundary inference heuristics
- Changelog entry phrasing and format
- How the incremental agent structures its diff preview
- Exact insertion point in `complete-milestone.md` (must be just before archival step)

### Deferred Ideas (OUT OF SCOPE)

- `/gsd2:document --fix-gaps` interactive mode
- Researcher/checker pattern for the doc agent (v2 only if v1 quality insufficient)
- Per-phase auto-trigger
- Prose documentation layer on top of the map
- GitHub-portable wikilink rendering

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | `/gsd2:document` command generates system map from planning artifacts, git history, and code | New `workflows/document.md` + command stub in `.claude/commands/gsd2/` and `commands/gsd2/`, matching `map-codebase.md` pattern |
| DOCS-02 | System map includes Mermaid diagrams for component relationships and boundaries | Root `SYSTEM-MAP.md` always contains ≥1 Mermaid; subsystem files have agent-chosen types — satisfied by "Mermaid Diagrams" stack entry below |
| DOCS-03 | All claims cite source artifacts — gaps marked as `[undocumented]` | Agent prompt must enforce citation-per-claim; un-sourceable claims routed to `docs/system/_gaps.md` with file:line pointers |
| DOCS-04 | Works for new projects with no milestones (code + git only) | Agent conditional logic: when `.planning/` absent → call `map-codebase` under the hood, then consume its output; fallback to code+git walk if `.planning/codebase/` absent |
| DOCS-05 | Milestone completion workflow suggests running doc agent | Patch `complete-milestone.md` — insert new step BEFORE `archive_milestone` that offers to run `/gsd2:document`; honors `--skip-docs` |
| DOCS-06 | Cumulative updates — diffs against existing SYSTEM-MAP and updates incrementally | Incremental agent: reads existing files + STATE.md last-run + git log since last-run + new SUMMARY.md/CONTEXT.md → proposes surgical edits → shows diff → user confirms |

## Standard Stack

### Core

| Library / Asset | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| Existing GSD agent framework (`Task` tool, model profiles) | current | Spawn mapper/updater agents | Already the v1 execution substrate — `map-codebase`, `ui-phase`, `agent-spec-phase` all use it |
| Mermaid | v11.x (GitHub-native support; no install needed) | Diagrams embedded in Markdown | User decision locks Mermaid; GitHub renders natively in `.md` fenced blocks `\`\`\`mermaid ... \`\`\`` |
| Obsidian `[[wikilinks]]` | syntax, no library | Inter-doc navigation | User locked — no dependency, just string convention |
| Node built-ins (`fs`, `path`, `child_process`) | Node 18+ | `init document` entrypoint state inspection | All other `init *` commands use these; keep uniformity |
| `gsd-tools.cjs commit` helper | current | Atomic commits of generated docs | Already used by every other workflow |

**No new npm dependencies.** This phase adds zero runtime packages. Version verification is not applicable — all assets are internal.

### Supporting

| Asset | Purpose | When to Use |
|-------|---------|-------------|
| `gsd-codebase-mapper` agent template | Structural reference for new doc-mapper agent | Copy persona structure (`<role>`, `<why_your_output_matters>`, `<guidelines>`), swap focus from "codebase understanding" to "narrative, sourced documentation" |
| `map-codebase.md` orchestration | Structural reference for `--full` branch of `document.md` | Parallel Task spawn + TaskOutput collection pattern lifts directly |
| `ui-phase.md` / `agent-spec-phase.md` | Structural reference for single-agent flows (incremental branch) | How to wrap a sub-agent call, receive confirmation, commit, exit |
| `complete-milestone.md` | Integration point for DOCS-05 | Insert a new `<step>` immediately before `archive_milestone` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| Mermaid | PlantUML / Graphviz / ASCII art | External renderer required | User locked Mermaid |
| Obsidian wikilinks | Standard `[text](./path.md)` Markdown links | Renders on GitHub | User explicitly rejected |
| Centralized `_gaps.md` | Inline `[undocumented]` tags / per-section gap blocks | Less actionable | User explicitly chose Option C |
| Researcher/checker loop | Single-pass mapper | Higher quality, more cost | User deferred to v2 |

**Installation:** None. All assets are file creations/edits inside the repo.

## Architecture Patterns

### Recommended File Structure

```
.claude/
├── agents/
│   ├── gsd-document-mapper.md       # NEW — parallel mapper for --full runs
│   └── gsd-document-updater.md      # NEW — single agent for incremental runs
├── commands/gsd2/
│   └── document.md                  # NEW — /gsd2:document command stub (runtime copy)
└── get-shit-done/
    ├── workflows/
    │   └── document.md              # NEW — orchestration workflow
    └── bin/lib/
        ├── init.cjs                 # EDIT — add cmdInitDocument
        └── model-profiles.cjs       # EDIT — register new agent types

commands/gsd2/
└── document.md                      # NEW — command stub (source copy, mirrors .claude/commands/gsd2)

.claude/get-shit-done/workflows/
└── complete-milestone.md            # EDIT — insert pre-archive hook step

docs/                                # NEW — created by /gsd2:document at runtime (user's project)
├── SYSTEM-MAP.md
└── system/
    ├── {subsystem}.md
    └── _gaps.md
```

**Two-copy command stubs:** The codebase has `.claude/commands/gsd2/*.md` AND `commands/gsd2/*.md` — both must be added and kept in sync. Confirmed from `ls` of both dirs (50 commands each). `install.js` propagates these to runtimes.

### Pattern 1: Parallel Mapper Orchestration (`--full` run)

**What:** Spawn N parallel `gsd-document-mapper` agents, each responsible for a discovered subsystem, writing directly to `docs/system/{subsystem}.md`. Orchestrator only receives confirmation strings.

**When to use:** `--full` flag, first run (no existing `docs/SYSTEM-MAP.md`), or agent infers scope is "everything stale."

**Example (adapted from `map-codebase.md` lines 58-127):**
```
Task(subagent_type="gsd-document-mapper", model="{mapper_model}", run_in_background=true,
  description="Document subsystem {N}: {name}",
  prompt="Subsystem: {name}
Boundary: {file paths / modules discovered}
Input artifacts: {list of planning files + code paths}
Write to docs/system/{subsystem-slug}.md with:
- Focused Mermaid diagram (agent picks type)
- Sourced claims (every statement cites file:line or artifact path)
- [[wikilinks]] to related subsystem files
Un-sourceable behaviors: append entries to docs/system/_gaps.md
Return confirmation only.")
```

Orchestrator collects outputs via `TaskOutput` in a single parallel call, then writes the root `SYSTEM-MAP.md` summarizing subsystem list + top-level Mermaid + `[[wikilinks]]` to each.

### Pattern 2: Two-Pass Incremental Update (diff preview)

**What:** Single `gsd-document-updater` agent. Pass 1 — read existing map + deltas, propose edits as a written diff preview. Pass 2 (after user confirmation) — apply edits.

**When to use:** Default invocation (no `--full`, existing `docs/SYSTEM-MAP.md`), or `--subsystem <name>` targeted update.

**Structure:**
1. Orchestrator calls `init document` → receives state JSON (last-run timestamp, existing map file list, GSD activity since last run: commit count, new SUMMARY.md files, closed phases).
2. Orchestrator spawns updater agent with state context.
3. Agent reads existing files + deltas, builds proposed-edits report at `docs/system/_proposed.md` (or returns diff inline).
4. Orchestrator shows diff preview to user.
5. User confirms (or `--yes` flag present) → orchestrator instructs agent to apply.
6. Agent writes surgical edits, appends changelog entry to root, deletes `_proposed.md` if used.

**Design choice for planner:** Pick between (a) inline diff in Task return payload — simpler but limited by Task output size, or (b) `_proposed.md` scratch file — handles large diffs but adds a cleanup step. Recommend (b) when the updater is expected to touch multiple subsystem files.

### Pattern 3: State-Driven Scope Inference

**What:** `init document` entrypoint returns enough signal for the orchestrator to choose between full/incremental/subsystem modes without user flags.

**`init document` output shape (planner must add to `bin/lib/init.cjs`):**
```js
{
  // Model resolution
  mapper_model: resolveModelInternal(cwd, 'gsd-document-mapper'),
  updater_model: resolveModelInternal(cwd, 'gsd-document-updater'),

  // Config
  commit_docs: config.commit_docs,

  // State
  docs_dir: 'docs',
  system_dir: 'docs/system',
  root_map_path: 'docs/SYSTEM-MAP.md',
  gaps_path: 'docs/system/_gaps.md',
  root_map_exists: pathExistsInternal(cwd, 'docs/SYSTEM-MAP.md'),
  system_dir_exists: pathExistsInternal(cwd, 'docs/system'),
  existing_subsystems: [...],        // filenames in docs/system/ excluding _gaps.md
  last_run_iso: '...',               // from root SYSTEM-MAP.md changelog first entry, or null
  has_planning: pathExistsInternal(cwd, '.planning'),
  has_codebase_maps: pathExistsInternal(cwd, '.planning/codebase'),

  // Activity since last run (empty if no prior run)
  commits_since: <int>,
  new_summaries: [...],              // SUMMARY.md files modified since last_run_iso
  completed_phases_since: [...],
  new_todos: <int>
}
```

**Decision tree the orchestrator runs (not the agent):**
- `--full` flag OR `!root_map_exists` → full run
- `--subsystem <name>` flag → targeted updater
- `commits_since === 0 && new_summaries.length === 0` → suggest skip
- otherwise → incremental updater

### Anti-Patterns to Avoid

- **Orchestrator reads document contents.** The whole point of the parallel-mapper pattern is to keep orchestrator context small. Orchestrator receives file paths + confirmations, NOT document bodies. Repeat the discipline from `map-codebase.md` line 124: "You receive file paths and line counts only — not document contents."
- **Embedding domain knowledge in the orchestrator.** Subsystem boundary inference is agent work, not workflow-prescribed. Don't list subsystems in `document.md`; let the mapper discover them.
- **Treating `_gaps.md` as a fallback log.** It is an intentional output. Every run must either update it or explicitly note "no new gaps." Empty gaps file is not the same as missing gaps file.
- **Blocking milestone completion on doc generation.** The milestone hook is a suggestion. User replies "no"/`--skip-docs` → proceed to archive. Do not check for doc freshness as a gate.
- **Double-writing changelog entries.** Single changelog at root `SYSTEM-MAP.md`. Not per-subsystem. Enforce in the mapper/updater prompts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown diff rendering | Custom diff library or line-diff logic | Write both versions to scratch files, let user `diff` via `Bash`, OR show the proposed-file contents as-is with a `_proposed.md` | All GSD diff flows today use `git diff` or file contents as-is |
| Commit management | Custom git invocation | `gsd-tools.cjs commit "..." --files ...` | Respects `commit_docs` flag, matches every other workflow |
| Phase/state discovery | Ad-hoc fs scanning in the workflow | `init document` entrypoint in `bin/lib/init.cjs` | Every workflow bootstraps via `init` for uniform state contract |
| Model resolution | Hardcoded model names | `resolveModelInternal(cwd, '<agent-name>')` via `model-profiles.cjs` | Supports quality/balanced/budget profiles uniformly |
| Markdown parsing for "did this section change" | Custom parser | Don't parse. Let the updater agent read the full existing file and propose surgical replacements as string edits via `Edit`/`Write` | Matches how `ui-review` and other surgical-edit flows work |
| Mermaid validation | Syntax checker | Trust the agent output; rely on GitHub/Obsidian renderers to surface errors. Optionally add a `scan_for_syntax` step paralleling `map-codebase`'s `scan_for_secrets` | No lightweight validator ships with the project; overhead > value for v1 |
| Secrets scanning in `docs/` | Custom regex sweep | Reuse the exact regex from `map-codebase.md` line 163 | One source of truth — copy-paste or factor into `gsd-tools.cjs` in a future phase |

**Key insight:** The orchestration substrate (agents, init, commits, model profiles) is mature. Phase 3 is a composition exercise — writing prompts and wiring state — not a framework extension.

## Common Pitfalls

### Pitfall 1: Wikilink Resolution Ambiguity
**What goes wrong:** `[[auth]]` is ambiguous when two subsystem files match (e.g., `auth-service.md` and `auth-ui.md`).
**Why it happens:** Obsidian resolves wikilinks by filename across the vault; agent uses human labels.
**How to avoid:** Prompt the mapper to use full subsystem slugs in links (`[[auth-service]]`) and to keep slugs globally unique within `docs/system/`.
**Warning signs:** Broken links in Obsidian graph view; duplicate subsystem filenames.

### Pitfall 2: Claim Without Source
**What goes wrong:** Agent writes plausible-sounding claims it inferred from code context without citing the file:line or planning artifact.
**Why it happens:** LLMs prefer fluent prose over tedious citations.
**How to avoid:** Enforce in agent persona — "Every claim must cite one of: `file:line` path, `.planning/phases/XX-*/XX-*.md` artifact, or git commit hash. If you cannot cite, route the claim to `_gaps.md` with a pointer to the code location that prompted the claim."
**Warning signs:** Paragraphs with no backticked paths; `_gaps.md` is empty after a full run on a non-trivial codebase.

### Pitfall 3: Scope Inference False Negative
**What goes wrong:** User adds a feature via `/gsd2:quick` or manual commit, agent misses it because the signals (new SUMMARY.md, closed phases) are phase-centric.
**Why it happens:** `quick` todos and direct commits don't write SUMMARY.md.
**How to avoid:** Include `commits_since` (raw git commit count since last-run timestamp) and `new_todos` as activity signals, not only phase artifacts. If `commits_since > 0` and no other signal fires, still offer an incremental run.
**Warning signs:** User runs `/gsd2:document`, agent reports "no changes detected" despite visible code changes.

### Pitfall 4: Incremental Run Overwrites Changelog
**What goes wrong:** Updater agent rewrites the entire root `SYSTEM-MAP.md` including historical changelog entries.
**Why it happens:** Surgical-edit agents sometimes prefer to regenerate full sections.
**How to avoid:** Explicit prompt rule — "The changelog section is APPEND-ONLY. Never rewrite prior entries. Insert the new entry at the top, preserve all existing entries verbatim."
**Warning signs:** `git diff` on `SYSTEM-MAP.md` shows all changelog lines modified, not just one added.

### Pitfall 5: Milestone Hook Blocks Archive
**What goes wrong:** User says "yes" to the doc suggestion, `/gsd2:document` fails, `/gsd2:complete-milestone` aborts without archiving.
**Why it happens:** Hook is implemented as a blocking subprocess instead of a suggestion.
**How to avoid:** Hook presents the prompt, if user accepts, spawn the document workflow as a SEPARATE user invocation (or run it but treat failure as non-fatal for archival). Document failure → warn, continue archive. User can re-run `/gsd2:document` post-archive.
**Warning signs:** Milestone archival blocked behind doc errors; user has to `--skip-docs` to recover.

### Pitfall 6: `map-codebase` Recursion
**What goes wrong:** `/gsd2:document` calls `map-codebase` under the hood when `.planning/codebase/` is missing. `map-codebase` at tail says "next: /gsd2:new-project". User confused.
**Why it happens:** `map-codebase.md`'s `offer_next` step assumes a fresh-start flow.
**How to avoid:** When `document.md` invokes `map-codebase`, do it as a sub-flow — spawn mapper agents directly (skip the `offer_next` UX), or call `map-codebase` via a dedicated non-interactive entrypoint. Do NOT `/gsd2:map-codebase` as a user command.
**Warning signs:** "Next Up: /gsd2:new-project" appears mid doc-run.

## Code Examples

### Example 1: Subsystem file template the mapper produces

```markdown
# Subsystem: Domain Router

**Updated:** 2026-04-17 by /gsd2:document (full run)
**Sources:** `.planning/phases/01-domain-router/`, `.claude/get-shit-done/workflows/discuss-phase.md:120-185`

## Shape

\`\`\`mermaid
flowchart LR
  User --> Discuss[/gsd2:discuss-phase/]
  Discuss --> Router{Domain classifier}
  Router -->|UI signals| UISpec[[ui-spec]]
  Router -->|Agentic signals| AgentSpec[[agent-spec]]
  Router -->|Low confidence| Generic[Generic fallback]
\`\`\`

## How It Works

The domain router is inline LLM logic in [[discuss-phase]] step 5.5 — no separate agent or CLI command (source: `.planning/phases/01-domain-router/01-SUMMARY.md:23`).

Classification reads phase description keywords and codebase context; confidence below threshold silently falls back to generic (source: `workflows/discuss-phase.md:142-168`).

## Related

- [[agent-spec]] — downstream handoff for agentic phases
- [[ui-spec]] — downstream handoff for UI phases

## Gaps

See [[_gaps#domain-router]] for un-sourced behaviors.
```

### Example 2: `init document` implementation skeleton (for planner reference)

```js
// bin/lib/init.cjs — add alongside cmdInitMapCodebase

function cmdInitDocument(cwd, raw) {
  const config = loadConfig(cwd);

  const rootMapPath = path.join(cwd, 'docs', 'SYSTEM-MAP.md');
  const systemDir = path.join(cwd, 'docs', 'system');

  let existingSubsystems = [];
  try {
    existingSubsystems = fs.readdirSync(systemDir)
      .filter(f => f.endsWith('.md') && f !== '_gaps.md');
  } catch { /* no dir yet */ }

  // Parse last-run timestamp from root map changelog (first dated line)
  let lastRunIso = null;
  try {
    const content = fs.readFileSync(rootMapPath, 'utf-8');
    const match = content.match(/^\s*-\s*(\d{4}-\d{2}-\d{2}T[\d:.Z]+)/m);
    if (match) lastRunIso = match[1];
  } catch { /* no root map yet */ }

  // Activity signals since last run
  let commitsSince = 0;
  if (lastRunIso) {
    try {
      const out = execSync(`git log --since="${lastRunIso}" --oneline`, { cwd }).toString();
      commitsSince = out.trim().split('\n').filter(Boolean).length;
    } catch { /* not a git repo or git error */ }
  }

  const result = {
    mapper_model: resolveModelInternal(cwd, 'gsd-document-mapper'),
    updater_model: resolveModelInternal(cwd, 'gsd-document-updater'),
    commit_docs: config.commit_docs,

    docs_dir: 'docs',
    system_dir: 'docs/system',
    root_map_path: 'docs/SYSTEM-MAP.md',
    gaps_path: 'docs/system/_gaps.md',
    root_map_exists: pathExistsInternal(cwd, 'docs/SYSTEM-MAP.md'),
    system_dir_exists: pathExistsInternal(cwd, 'docs/system'),
    existing_subsystems: existingSubsystems,
    last_run_iso: lastRunIso,
    has_planning: pathExistsInternal(cwd, '.planning'),
    has_codebase_maps: pathExistsInternal(cwd, '.planning/codebase'),
    commits_since: commitsSince,
    // new_summaries, completed_phases_since, new_todos — derive from .planning/ walks
  };

  output(result, raw);
}

module.exports = { ..., cmdInitDocument };
```

Planner must also:
- Wire this command into `gsd-tools.cjs` router (see lines 121-130 where `init plan-phase` / `init map-codebase` are declared).
- Add to the exports at the bottom of `init.cjs`.

### Example 3: Model profile entries

```js
// bin/lib/model-profiles.cjs — add to MODEL_PROFILES object

const MODEL_PROFILES = {
  // ... existing ...
  'gsd-document-mapper':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-document-updater': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};
```

Rationale: Mirror `gsd-codebase-mapper` profile (sonnet/haiku/haiku) — same task shape, same cost profile. Don't use opus; mapping/updating is a sonnet-ceiling task.

### Example 4: Milestone hook insertion point

In `.claude/get-shit-done/workflows/complete-milestone.md`, insert a new `<step>` between `reorganize_roadmap` (line 172 area) and `archive_milestone` (line 207 area). Draft:

```xml
<step name="offer_documentation">

Before archiving, offer to refresh the system map:

\`\`\`
This milestone is about to be archived. The system map in docs/ may be stale.

Run /gsd2:document to refresh it now? (y/n/--skip-docs)
\`\`\`

- **y** → Instruct user to run `/gsd2:document` in a fresh context, pause this workflow. (Alternative: invoke the document workflow inline; planner decides. If inline and it fails, warn but continue — archival is not blocked.)
- **n** or `--skip-docs` → Continue to `archive_milestone`.

Rationale: Doc refresh before archive ensures the map reflects the final milestone state while phase artifacts are still live in `.planning/phases/`.

</step>
```

**Planner decision point:** Inline invocation vs manual prompt. Inline is smoother UX but couples two workflows and risks the archive-blocking pitfall. Recommend manual prompt (user runs `/gsd2:document` themselves, then re-invokes `/gsd2:complete-milestone`). If planner chooses inline, wrap the call in non-fatal error handling.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline documentation by executors | On-demand doc agent reading all artifacts | v1.4 memory note (project_domain_awareness.md) | Fragmented inline docs replaced by single coherent map |
| Single monolithic SYSTEM-MAP.md | Three-tier layered (root + per-subsystem + gaps) | This phase (user decision) | Obsidian-style navigation, per-file diffs, smaller agent context per update |
| Per-phase auto-generate | Milestone-only suggestion, manual anytime | This phase (user decision) | Doc generated when "a hard part is done," not for trivial commits |

**Deprecated/outdated:**
- Inline `[undocumented]` markers scattered in prose — replaced by centralized `_gaps.md`.
- `--phase N` scope flag (considered, rejected) — duplicates agent inference logic.

## Open Questions

1. **Diff preview delivery format (WEAK decision surface).**
   - What we know: User picked "surgical edit + propose diff" (hybrid of options 2 + 3). `--yes` flag is WEAK/derived.
   - What's unclear: Whether the diff is shown inline in the orchestrator message OR via a scratch `_proposed.md` file the user reads externally.
   - Recommendation: Planner picks based on expected edit size. For v1, inline for ≤1 file edited, `_proposed.md` for multi-file edits. Document in workflow file.

2. **Milestone hook invocation model.**
   - What we know: Fires before archive, suggestion not gate.
   - What's unclear: Inline doc workflow call vs prompt-user-to-run-manually.
   - Recommendation: Manual prompt. Simpler, avoids blocking archival on doc errors. Inline can be a follow-up if UX friction is observed.

3. **Subsystem rename handling.**
   - What we know: Agent discovers subsystems; not a fixed catalog.
   - What's unclear: If the agent renames a subsystem across runs (e.g., `auth` → `authentication`), does the old file get orphaned?
   - Recommendation: Incremental updater prompt must list existing subsystem filenames and prefer keeping names unless a rename is justified. If renaming, delete the old file and update all `[[wikilinks]]`. Log rename in changelog entry.

4. **`_gaps.md` structure.**
   - What we know: Central gaps file with file:line pointers.
   - What's unclear: Flat list vs subsystem-grouped sections.
   - Recommendation: Subsystem-grouped (`## Subsystem: auth-service` → list of gap entries) — matches the layered structure and supports wikilinks like `[[_gaps#auth-service]]`.

## Sources

### Primary (HIGH confidence — internal)
- `.planning/phases/03-documentation-agent/03-CONTEXT.md` — all locked user decisions
- `.planning/phases/03-documentation-agent/03-DISCUSSION-LOG.md` — reasoning trail
- `.planning/REQUIREMENTS.md` — DOCS-01 through DOCS-06
- `.planning/ROADMAP.md` — Phase 3 success criteria
- `.claude/get-shit-done/workflows/map-codebase.md` — parallel mapper orchestration reference
- `.claude/get-shit-done/workflows/complete-milestone.md` — hook insertion point
- `.claude/get-shit-done/workflows/ui-phase.md`, `workflows/agent-spec-phase.md` — single-agent flow references
- `.claude/get-shit-done/bin/lib/init.cjs` — init entrypoint pattern (lines 580-612 for `cmdInitMapCodebase`)
- `.claude/get-shit-done/bin/lib/model-profiles.cjs` — agent-to-model mapping
- `.claude/agents/gsd-codebase-mapper.md` — agent persona template
- `.planning/codebase/STRUCTURE.md` — file layout confirmation

### Secondary (MEDIUM confidence — external)
- Mermaid official docs (mermaid.js.org) — diagram types, C4 support, GitHub native rendering
- Obsidian wikilink conventions — general community knowledge

### Tertiary (LOW confidence)
- None — all decisions are user-locked or internal patterns.

## Metadata

**Confidence breakdown:**
- User constraints: HIGH — verbatim from CONTEXT.md with clear STRONG/WEAK markers
- Standard stack: HIGH — zero new dependencies, all internal assets verified via `ls` / `Read`
- Architecture patterns: HIGH — all patterns already implemented in `map-codebase.md`, `ui-phase.md`, `complete-milestone.md`
- Pitfalls: MEDIUM — extrapolated from existing workflow behaviors + user constraints; not all observed in production
- Code examples: MEDIUM — skeletons follow existing `init.cjs` shape but not runtime-verified

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — stable internal patterns, no upstream library volatility)

Sources:
- [Mermaid GitHub repo](https://github.com/mermaid-js/mermaid)
- [Mermaid C4 Diagrams docs](https://mermaid.js.org/syntax/c4.html)
