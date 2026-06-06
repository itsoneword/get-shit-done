---
created: 2026-04-18T00:00:00Z
title: Merge legacy docs/*.md content into docs/system/ tree
area: docs
files:
  - docs/AGENTS.md
  - docs/ARCHITECTURE.md
  - docs/CLI-TOOLS.md
  - docs/COMMANDS.md
  - docs/CONFIGURATION.md
  - docs/FEATURES.md
  - docs/USER-GUIDE.md
  - docs/README.md
  - docs/context-monitor.md
  - docs/RESEARCH-agent-best-practices.md
  - docs/RESEARCH-workflow-optimization.md
  - docs/superpowers/
  - docs/system/
  - .gitignore
---

## Problem

After Phase 3 (Documentation Agent) landed, there are now two parallel doc trees:

- **Legacy manual docs** (`docs/*.md` at root, ~4600 lines) — hand-written, hand-curated, carries accumulated drift.
- **Auto-generated sourced docs** (`docs/SYSTEM-MAP.md` + `docs/system/*.md`, ~1000 lines) — produced by `/gsd2:document`, every claim sourced, Mermaid + wikilinks, regenerates on demand.

They overlap significantly:

| Legacy | Auto-gen equivalent |
|---|---|
| AGENTS.md | system/agents.md |
| ARCHITECTURE.md | SYSTEM-MAP.md |
| context-monitor.md | system/hooks.md |
| FEATURES.md | (overlaps COMMANDS.md heavily — belongs in REQUIREMENTS.md) |
| CLI-TOOLS.md | system/tool-cli.md |

Legacy docs never referenced each other with the new tree; `docs/README.md` index doesn't mention `system/`.

## Interim state (committed in Phase 3 close-out)

Legacy docs were gitignored to ship Phase 3 with a clean docs tree. Files still exist on disk
locally but are no longer tracked. See `.gitignore` lines 33-45.

## Decision to make later

1. **Which legacy docs genuinely have unique value worth keeping hand-written?**
   - Strong candidates: `USER-GUIDE.md` (troubleshooting prose), `COMMANDS.md` (exhaustive syntax reference), `CONFIGURATION.md` (config schema).
   - Likely redundant: `AGENTS.md`, `ARCHITECTURE.md`, `FEATURES.md`, `context-monitor.md`, `RESEARCH-*.md`.

2. **Which need their content folded into `docs/system/` before deletion?**
   - Walk each legacy file → capture any non-duplicated info → inject as sourced claims in the matching subsystem file (or open a gap in `_gaps.md`).

3. **Update `docs/README.md`** to route users between hand-written references and auto-gen system map, then un-gitignore the files you keep.

## Solution sketch

1. Diff each legacy file against its auto-gen counterpart; capture the delta.
2. For each kept legacy doc: un-gitignore + `git add` + update cross-references.
3. For each retired legacy doc: extract residual value into system/ or REQUIREMENTS.md, then delete from disk.
4. Rewrite `docs/README.md` as a two-tier index (hand-written refs vs. auto-gen map).

## Acceptance

- `git ls-files docs/` shows only files with clear, non-overlapping purpose.
- `.gitignore` no longer has a "pending merge" section for docs.
- `docs/README.md` points users at both layers and explains the difference.

## Resolution (2026-06-06): retired, not merged

Premise no longer held. The parked legacy `docs/*.md` were never committed and had
been deleted from disk — the curated fork content was gone and unrecoverable. The
only surviving copies are in `gsd-core`, which is the un-curated upstream superset
(its FEATURES.md alone is 3020 lines), not the fork's trimmed set. So there was
nothing left to merge.

Resolved by retiring the legacy tree instead:
- Stripped the stale "Legacy docs pending merge" block from `.gitignore`.
- Wrote `docs/README.md` as a one-tier index for `SYSTEM-MAP.md` + `system/`, noting
  the legacy docs are retired in favor of `/gsd2:document` (sourced, regenerated).
- `docs/system/` is now the canonical, auto-generated documentation tree.
