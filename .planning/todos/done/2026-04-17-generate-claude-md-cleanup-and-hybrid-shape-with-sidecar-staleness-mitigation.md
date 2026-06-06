---
created: 2026-04-17T21:06:32.051Z
title: generate-claude-md cleanup + hybrid shape + sidecar staleness mitigation
area: tooling
files:
  - get-shit-done/bin/lib/profile-output.cjs:280-376
  - get-shit-done/bin/lib/profile-output.cjs:817-942
  - agents/gsd-codebase-mapper.md
  - commands/gsd2/map-codebase.md
  - commands/gsd2/plan-phase.md
  - commands/gsd2/execute-phase.md
  - workflows/new-project.md:601
  - templates/claude-md.md
---

## Resolution (2026-06-06)

All pieces landed.
- Pieces 1, 2, 4a: already committed in v1.4.6 (`summarizeSidecar`, hybrid shape + pointers, map-codebase auto-sync).
- Piece 3: covered by mapper content-rules (`agents/gsd-codebase-mapper.md` "the output feeds CLAUDE.md" block) — templates keep `[..]` placeholders but the rule mandates deleting them; not stripped from templates verbatim.
- Piece 4b/4c: `sidecar_impact` PLAN.md frontmatter (planner) + `sync_sidecars` step in `execute-phase.md` (targeted mapper + files_modified drift heuristic). Frontmatter validator is permissive (required-only), so no shared schema change. Implemented in `agents/gsd-planner.md`, not the flagged `commands/gsd2/plan-phase.md`.
- Piece 5: `summarizeSidecar` unit tests added to `tests/claude-md.test.cjs` (not a new file).

Note: `sidecar_impact` is declared but only enforced by execute-phase prose; no automated test of the targeted-spawn path (workflow is markdown, not unit-testable here).

## Problem

`gsd-tools generate-claude-md` has three compounding issues that make the generated root `CLAUDE.md` noisy, stale, and misleading:

### 1. Output-quality bugs in the generator
Evidence: `get-shit-done/bin/lib/profile-output.cjs:280-376`. The three sidecar-based generators (`generateStackSection`, `generateConventionsSection`, `generateArchitectureSection`) use naive line-prefix filtering:

- **Empty code fences.** `generateArchitectureSection` keeps lines starting with ``` but skips the fence content (content lines don't start with `-`/`*`/`|`/`#`/```). Result: `## Data Flow` followed by empty ``` blocks.
- **Heading hierarchy broken.** Sidecar `## Subsection` is passed through verbatim, so children land at same level as wrapper `## Architecture` instead of being demoted to `###`.
- **Empty-valued bullets pass through.** `- **Service design:**` with no body, `- **Exception handling patterns:**` — reads like a rule exists when none does.
- **Empty headings pass through.** `## Import Organization` with no content beneath it.
- **Stale snapshots.** Hardcoded agent names, route paths, counts ("5 route modules", "steps 1-6 sequentially") age into lies within a milestone.

Mapper agent contribution (`agents/gsd-codebase-mapper.md`): templates contain placeholder-shaped bullets like `- [Patterns observed]`. Mapper is told to use "Not detected" but nothing prevents emitting bare labels with no body.

### 2. One-shot sync
Evidence: only caller is `workflows/new-project.md:601`. `/gsd2:map-codebase` refreshes sidecars but never re-syncs CLAUDE.md. Drift accumulates silently.

### 3. Sidecar staleness during phase work
Even after fixing sync trigger, sidecars themselves only refresh on explicit `map-codebase`. If a phase swaps a framework or changes architecture (e.g., swapping auth middleware, changing communication layer), sidecars — and therefore CLAUDE.md — stay frozen until the user remembers to re-map. Claude operates on a stale mental model without knowing it.

### Scope note
This is docs for Claude (always-loaded context), not docs for humans — a separate human-docs todo is in progress. Optimize for "minimum mental model + reliable pointer", not readability.

## Solution

Implementing as direct patches (no phase), roughly 3–4 commits. All four pieces below are in scope.

### Piece 1 — Hybrid CLAUDE.md shape

Restructure managed sections so the always-loaded file stays lean while sidecars hold detail:

- **`## Project`** — full content (small, stable: identity, core value, constraints). Always-loaded.
- **`## GSD Workflow Enforcement`** — full content (stable). Always-loaded.
- **`## Technology Stack`** — 5–10 line compressed summary + pointer `> For current detail: .planning/codebase/STACK.md`.
- **`## Conventions`** — 5–10 line summary + pointer.
- **`## Architecture`** — 5–10 line summary + pointer.

Generator emits the compressed summary (first paragraph / top bullets of sidecar, bounded line cap) plus a fixed pointer line.

Target size: CLAUDE.md drops from ~few hundred lines to ~80–120.

### Piece 2 — Generator filter fixes (`bin/lib/profile-output.cjs`)

Replace line-prefix filtering in the three sidecar generators with a shared `summarizeSidecar(content, opts)` helper that is markdown-aware:

- Preserve code fences with contents (track fence open/close state).
- Demote headings: `## → ###`, `### → ####`, capped at 6.
- Drop empty-valued bullets (regex: `^[-*]\s+(\*\*[^*]+\*\*:\s*)?$`) and bullets whose body is placeholder text (`[...]`, `TBD`).
- Drop empty headings (heading with no content before next heading / EOF).
- Strip sidecar H1 and "Analysis Date" metadata line.
- Apply the summary-compression cap described in Piece 1.

### Piece 3 — Mapper template tightening (`agents/gsd-codebase-mapper.md`)

- Strip `- [Patterns observed]`-style placeholder bullets from templates; replace with prose guidance "fill only what you observe; omit the bullet if nothing applies".
- Add explicit rule in `<guidelines>`: "Prefer patterns over enumerations. Don't list all agents/routes/modules with counts — describe the pattern and point at the glob (e.g., `agents/*.md`). Exhaustive lists age into lies."
- Add rule: "Never emit a bulleted label (`- **Foo:**`) without a body. Never emit a heading with no content beneath it. Omit the whole bullet/section instead."

### Piece 4 — Sync trigger + staleness mitigation

**4a. Auto-sync on map-codebase.** After the four mapper agents complete in `/gsd2:map-codebase`, invoke `gsd-tools generate-claude-md --auto` if root `CLAUDE.md` exists. Existing `--auto` path detects manually-edited sections and skips them, so users don't get clobbered. If CLAUDE.md doesn't exist, skip silently (creation is `/gsd2:new-project`'s job).

**4b. Planner declares impact zones.** `/gsd2:plan-phase` writes PLAN.md frontmatter:
```yaml
sidecar_impact: [STACK, ARCHITECTURE]   # or []
```
At phase completion (after verifier passes), `execute-phase` spawns the mapper agent only for impacted focus areas:
- `STACK` or `INTEGRATIONS` → focus=`tech`
- `ARCHITECTURE` or `STRUCTURE` → focus=`arch`
- `CONVENTIONS` or `TESTING` → focus=`quality`
- `CONCERNS` → focus=`concerns`

Mapper rewrites just those sidecars; generator re-syncs CLAUDE.md. No cost on routine phases.

**4c. Post-phase drift heuristic (safety net).** Before phase completion, compare git diff file set against glob rules:
- `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod` → STACK likely stale
- New top-level src dirs, `src/routes/**`, `src/app/**` restructure → ARCHITECTURE likely stale
- `.eslintrc*`, `.prettierrc*`, new test scaffolding → CONVENTIONS likely stale

If drift detected but planner didn't declare impact, prompt: "Phase touched X — Y sidecar may be stale. Refresh now? (y/n)". Non-blocking; user can skip.

### Piece 5 — Tests (`tests/generate-claude-md.test.cjs`)

Cover:
- Empty-valued bullet stripped
- Empty heading stripped
- Fenced code block preserved with contents
- `##` in sidecar → `###` in output
- H1 + "Analysis Date" line stripped
- Hybrid output: stack/conventions/architecture have pointer line and ≤ N lines
- `--auto` skip on manually edited section (extend existing if covered)

Add integration test for `sidecar_impact` frontmatter parsing + targeted mapper spawn (mock mapper call).

### Out of scope

- Pointer-only model for Project / Workflow sections — those stay full.
- `/gsd2:sync-claude-md` dedicated command — auto-sync on map-codebase covers it; skip unless user asks.
- Editing this repo's own `CLAUDE.md` — file doesn't exist here.
- Human-facing docs — separate in-flight todo.

### Commit plan (rough)

1. `fix(tooling): strip empties and demote headings in generate-claude-md` — Piece 2 + tests.
2. `refactor(tooling): hybrid CLAUDE.md shape with sidecar pointers` — Piece 1 + template updates.
3. `feat(tooling): auto-sync CLAUDE.md after map-codebase` — Piece 4a.
4. `feat(workflow): sidecar_impact frontmatter drives targeted refresh + drift heuristic` — Pieces 4b + 4c + mapper template tightening (Piece 3).
