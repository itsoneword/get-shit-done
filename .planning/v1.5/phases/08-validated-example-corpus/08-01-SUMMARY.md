---
phase: 08-validated-example-corpus
plan: "01"
subsystem: references/validated-examples
tags: [corpus, reference, curation, scaffolding]
dependency_graph:
  requires: []
  provides:
    - get-shit-done/references/validated-examples/_TEMPLATE.md
    - get-shit-done/references/validated-examples/SELECTION-CRITERIA.md
    - get-shit-done/references/validated-examples/INDEX.md
  affects:
    - get-shit-done/references/validated-examples/
tech_stack:
  added: []
  patterns:
    - Per-pattern markdown files + slim INDEX (on-demand load, never eager blob)
    - YAML front-matter with controlled counters vocabulary joining to common-bug-patterns.md headers
key_files:
  created:
    - get-shit-done/references/validated-examples/_TEMPLATE.md
    - get-shit-done/references/validated-examples/SELECTION-CRITERIA.md
    - get-shit-done/references/validated-examples/INDEX.md
  modified: []
decisions:
  - "counters: vocabulary uses exact ## header strings from common-bug-patterns.md (Phase 9 join key) — not slug form"
  - "INDEX is strictly 4-column (pattern_id / constraint / language / file) — no code or prose prevents fat-INDEX anti-pattern"
  - "source_permalink must point to a release tag, never /blob/main/ or HEAD"
  - "SELECTION-CRITERIA.md binding rule: excerpts live only in references/ docs, never in runtime/executable code"
metrics:
  duration_minutes: 8
  completed_date: "2026-06-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
requirements:
  - SC1
---

# Phase 8 Plan 01: Validated Example Corpus Scaffolding Summary

**One-liner:** Corpus scaffolding with entry template (front-matter schema + counters vocabulary locked to common-bug-patterns.md headers), selection-criteria rulebook, and slim 4-column INDEX header.

## What Was Built

Three structure files establishing the authoring contract for the validated-example corpus:

- **`_TEMPLATE.md`** — the per-entry shape curators copy verbatim. YAML front matter declares all 9 mandatory fields (`pattern_id`, `title`, `language`, `source_repo`, `source_file`, `source_lines`, `source_permalink`, `license`, `counters`). An inline comment block lists the full 12-entry valid `counters:` vocabulary (exact `## ` header strings from `common-bug-patterns.md`) and explicitly forbids slug form and HEAD/main permalinks. Four required commentary sections follow: `## What this solves`, `## Excerpt`, `## Why it's good`, `## What NOT to cargo-cult`.

- **`SELECTION-CRITERIA.md`** — the curation rulebook. Covers: what "validated" means (reputation-vetted repo + curator commentary, not independent re-testing), source bar (battle-tested/widely-used/human-maintained; low-usage repos disqualified), licensing posture (short attributed excerpts = quotation; never paste into runtime code), excerpt hygiene (10-30 lines; pinned release tag permalink; no synthetic examples), and the fat-INDEX anti-pattern guard.

- **`INDEX.md`** — slim 4-column table header with load-one-only instruction. No data rows (deferred to Plan 04 once entries exist). No code excerpts or prose.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| b639aa3 | Task 1 | feat(08-01): add validated-examples _TEMPLATE.md and SELECTION-CRITERIA.md |
| 3b55b04 | Task 2 | feat(08-01): add slim INDEX.md schema header for validated-examples corpus |

## Verification Results

All four `must_haves.truths` passed:

1. All three structure files exist — OK
2. Template declares all mandatory front-matter fields — OK
3. `counters:` vocabulary uses header-string form, references `common-bug-patterns.md` — OK
4. INDEX is slim 4-column table with no code excerpts — OK

## Deviations from Plan

None — plan executed exactly as written.

## Key Interfaces Established

- `counters:` values MUST be exact `## ` section header strings from `common-bug-patterns.md` (12 values listed in template comment). This is the Phase 9 eval-substrate join key. Slug form is explicitly forbidden.
- Wave 2 curation plans (08-02, 08-03) copy `_TEMPLATE.md` fields verbatim without re-deriving the schema.
- Plan 08-04 (INDEX population) appends rows to `INDEX.md` in the exact 4-column format established here.

## Self-Check: PASSED

Files confirmed:

- get-shit-done/references/validated-examples/_TEMPLATE.md — exists
- get-shit-done/references/validated-examples/SELECTION-CRITERIA.md — exists
- get-shit-done/references/validated-examples/INDEX.md — exists
- Commits b639aa3 and 3b55b04 — confirmed in git log
