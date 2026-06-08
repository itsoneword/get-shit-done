---
phase: 08-validated-example-corpus
verified: 2026-06-08T14:10:00Z
status: passed
score: 3/3 ROADMAP success criteria verified
---

# Phase 8: Validated Example Corpus — Verification Report

**Phase Goal:** GSD guidance draws on a curated corpus of validated, human-maintained code examples mined from strong real-world reference projects — indexed by pattern, with commentary — instead of leaning on plausible-but-untested LLM-generated examples. The corpus is structured to also serve as the validated reference/eval substrate Phase 9 will consume.
**Verified:** 2026-06-08T14:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP SC1 / SC2 / SC3)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | A validated-example corpus exists as a pattern-indexed catalog with explicit selection criteria, sourced from real reference projects (not synthetic), with per-example commentary on what it solves and what not to cargo-cult | VERIFIED | 6 entry files in `get-shit-done/references/validated-examples/`; each has pattern_id front matter, attributed real-repo permalink pinned to a release tag, and all four commentary sections (`## What this solves`, `## Excerpt`, `## Why it's good`, `## What NOT to cargo-cult`); `SELECTION-CRITERIA.md` defines the source bar (reputation, licensing, excerpt hygiene, no synthetic examples) |
| SC2 | The corpus is loaded into at least one GSD flow (the planner reference) through the normal references mechanism | VERIFIED | `agents/gsd-planner.md` lines 79–81 contain the on-demand pointer inside `<code_quality_reference>`; pointer reads `~/.claude/get-shit-done/references/validated-examples/INDEX.md` and instructs loading only the needed pattern; awk-window check confirms placement within the section; runtime `.claude/` copy is byte-identical to source (verified with `diff -rq`) |
| SC3 | The corpus is structured so Phase 9 can consume it as validated reference/eval material | VERIFIED | All 12 `counters:` values across all 6 entry files are exact `## ` section-header strings from `common-bug-patterns.md` (join key intact); no slug-form values; `INDEX.md` is slim (4 columns, no code fences, no prose); pattern_id in INDEX rows matches filenames and front matter — all lookups are unambiguous |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `get-shit-done/references/validated-examples/INDEX.md` | VERIFIED | Slim 4-column table, 6 data rows, no code fences, anti-eager-blob comment present |
| `get-shit-done/references/validated-examples/_TEMPLATE.md` | VERIFIED | All mandatory fields: `pattern_id`, `title`, `language`, `source_repo`, `source_file`, `source_lines`, `source_permalink`, `license`, `counters`; counters vocabulary block references `common-bug-patterns.md`; all four section headers present |
| `get-shit-done/references/validated-examples/SELECTION-CRITERIA.md` | VERIFIED | Contains reputation, license, and no-paste-into-runtime rules |
| `get-shit-done/references/validated-examples/error-propagation-python.md` | VERIFIED | psf/requests source, release-tag permalink (v2.31.0), counters: `Error Handling` + `Python-Specific Bugs`, all four sections |
| `get-shit-done/references/validated-examples/validation-layer-python.md` | VERIFIED | pydantic/pydantic source, release-tag permalink (v2.12.5), counters: `Data Shape / API Contract` + `Type / Coercion`, all four sections |
| `get-shit-done/references/validated-examples/python-resource-management.md` | VERIFIED | python/cpython source, release-tag permalink (v3.12.3), counters: `Python-Specific Bugs` + `Error Handling`, all four sections |
| `get-shit-done/references/validated-examples/async-retry-backoff.md` | VERIFIED | nodejs/undici source, release-tag permalink (v6.21.0), counters: `Async / Timing` + `Error Handling`, all four sections |
| `get-shit-done/references/validated-examples/validation-layer-ts.md` | VERIFIED | colinhacks/zod source, release-tag permalink (v4.4.3), counters: `Data Shape / API Contract` + `Type / Coercion`, all four sections |
| `get-shit-done/references/validated-examples/config-env-validation.md` | VERIFIED | fastify/env-schema source, release-tag permalink (v7.0.0), counters: `Environment / Config` + `Data Shape / API Contract`, all four sections |
| `agents/gsd-planner.md` | VERIFIED | Pointer at lines 79–81, inside `<code_quality_reference>`, correct `~/.claude/...` path token, `Load only the pattern(s) you need` instruction present |
| `.claude/get-shit-done/references/validated-examples/` (runtime copy) | VERIFIED | All 9 files present (INDEX.md + _TEMPLATE.md + SELECTION-CRITERIA.md + 6 entries); `diff -rq` reports no differences vs source |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `agents/gsd-planner.md` `<code_quality_reference>` | `validated-examples/INDEX.md` | on-demand `Read ~/.claude/...` pointer | VERIFIED | Pointer is inside the section, uses correct path token, includes load-only instruction |
| `INDEX.md` rows | entry files | `file` column path references | VERIFIED | All 6 rows resolve to existing files; no dangling rows |
| entry files `counters:` values | `common-bug-patterns.md` `##` section headers | exact string match (Phase 9 join key) | VERIFIED | All 12 counters values match verbatim; no slug-form values found |
| `get-shit-done/references/validated-examples/` source | `.claude/get-shit-done/references/validated-examples/` runtime | `cp -f` propagation | VERIFIED | Byte-identical (`diff -rq` clean) |

### Plan-Level Structural Checks

All plan `must_haves.truths[].verify[]` commands pass:

**Plan 01 (scaffold):**
- Structure files existence check: OK
- Template mandatory fields check: OK
- Template counters anchored to common-bug-patterns.md headers: OK
- INDEX.md slim 4-column header: OK

**Plan 02 (Python entries):**
- Three Python entry files exist: OK
- All have required front matter fields: OK
- All have four commentary sections: OK
- All permalinks release-tag-pinned (not main/master/HEAD): OK

**Plan 03 (TS/Node entries):**
- Three TS/Node entry files exist: OK
- All have required front matter fields: OK
- All have four commentary sections: OK
- All permalinks release-tag-pinned (not main/master/HEAD): OK

**Plan 04 (integration):**
- Every entry file has an INDEX row: OK (6/6 indexed)
- No dangling INDEX rows: OK
- INDEX has no code fences: OK
- gsd-planner.md contains pointer and load-only instruction: OK
- Pointer is inside `<code_quality_reference>` (awk window check): OK
- Runtime copy exists and is byte-identical: OK

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholder stubs, or empty implementations found in the corpus files.

### Human Verification Required

| Behavior | Why Manual |
|----------|------------|
| Excerpt quotation fidelity — each excerpt actually matches its cited permalink/line range | Requires fetching live GitHub source at the pinned tag; quotation accuracy not grep-checkable |
| Commentary quality — "What this solves" and "What NOT to cargo-cult" sections are substantively useful, not formulaic | Editorial judgment not automatable |

These are quality-bar items, not blockers to phase goal achievement. All structural requirements are satisfied.

---

_Verified: 2026-06-08T14:10:00Z_
_Verifier: Claude (gsd-verifier)_
