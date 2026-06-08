---
phase: 08-validated-example-corpus
plan: "02"
subsystem: validated-example-corpus
tags: [corpus, python, error-handling, resource-management, validation, pydantic, requests, cpython]
dependency_graph:
  requires: ["08-01"]
  provides: ["error-propagation-python.md", "python-resource-management.md", "validation-layer-python.md"]
  affects: ["08-04-INDEX", "Phase 9 eval substrate"]
tech_stack:
  added: []
  patterns: ["excerpt attribution", "Phase-9 counters join key", "pinned-release-tag permalink"]
key_files:
  created:
    - get-shit-done/references/validated-examples/error-propagation-python.md
    - get-shit-done/references/validated-examples/python-resource-management.md
    - get-shit-done/references/validated-examples/validation-layer-python.md
  modified: []
decisions:
  - "Requests 2.31.0 flat layout confirmed (requests/adapters.py, not src/); lines 500-519 = 20-line except-wrap-reraise chain"
  - "CPython 3.12.3 contextlib.py lines 125-152 = _GeneratorContextManager class header + __enter__ + __exit__ entry (28 lines)"
  - "Pydantic 2.12.5 __init__ (lines 240-260, 21 lines) chosen over model_validate classmethod (47 lines) — cleaner parse contract, fits excerpt size budget"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-06-08"
  tasks: 2
  files: 3
---

# Phase 8 Plan 02: Python Validated Examples Summary

Three Python seed entries curated from real reputation-vetted repos (requests, CPython, Pydantic), each with pinned-tag permalinks, verbatim counters headers, and full four-section commentary.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Curate error-propagation and resource-management entries | 299fed8 | error-propagation-python.md, python-resource-management.md |
| 2 | Curate validation-layer (Pydantic) entry | 1f6f699 | validation-layer-python.md |

## What Was Built

**error-propagation-python.md** — `psf/requests` v2.31.0, `requests/adapters.py` lines 500-519. The `HTTPAdapter.send` except blocks that translate urllib3 exception variants into requests' typed hierarchy (`ConnectionError`, `ConnectTimeout`, `RetryError`, etc.) while preserving the original cause. 20-line excerpt; counters: `Error Handling`, `Python-Specific Bugs`.

**python-resource-management.md** — `python/cpython` v3.12.3, `Lib/contextlib.py` lines 125-152. `_GeneratorContextManager` class header + `__enter__` + `__exit__` entry (28 lines) showing the generator-based context manager implementation. counters: `Python-Specific Bugs`, `Error Handling`.

**validation-layer-python.md** — `pydantic/pydantic` v2.12.5, `pydantic/main.py` lines 240-260. `BaseModel.__init__` (21 lines) showing the parse-to-type contract: input kwargs → validated instance or `ValidationError`. counters: `Data Shape / API Contract`, `Type / Coercion`.

## Decisions Made

- **requests layout**: v2.31.0 uses flat `requests/adapters.py` (no `src/` prefix), confirmed by local package inspection. Source line numbers in local install match the tagged GitHub permalink exactly.
- **contextlib excerpt**: lines 125-152 chosen over lines 272-302 (decorator docstring) — the `_GeneratorContextManager` class shows the runtime behavior directly; the decorator docstring shows intended usage but not the cleanup guarantee mechanism.
- **pydantic excerpt**: `__init__` (240-260, 21 lines) chosen over `model_validate` classmethod (678-724, 47 lines) because `__init__` is more compact, directly encodes the parse contract, and documents the `ValidationError` raise explicitly. `model_validate` delegates immediately to the same `__pydantic_validator__` and has a long docstring that would push the excerpt past 30 lines.

## Deviations from Plan

None — plan executed exactly as written. All three source repos were locally installed at pinned versions; no network access was needed. Excerpt sizes: 20, 28, and 21 lines respectively — all within the 10-30 line constraint.

## Self-Check: PASSED

```
FOUND: get-shit-done/references/validated-examples/error-propagation-python.md
FOUND: get-shit-done/references/validated-examples/python-resource-management.md
FOUND: get-shit-done/references/validated-examples/validation-layer-python.md
FOUND commit: 299fed8
FOUND commit: 1f6f699
All counters match common-bug-patterns.md ## headers
All permalinks pinned to release tags (v2.31.0, v3.12.3, v2.12.5)
All four commentary sections present in all three files
```
