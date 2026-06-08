---
phase: 07-parallel-multi-session-safety-planning-ergono
plan: 02
subsystem: tooling
tags: [frontmatter, todo, schema, init, parallel-safety]

requires:
  - phase: 07-01
    provides: worktree CLI helpers (gsd-tools worktree subcommand)

provides:
  - FRONTMATTER_SCHEMAS.todo entry with required [created, title, area] and optional [depends_on, related_to, files]
  - extractFrontmatter parses depends_on/related_to as arrays (inline and block YAML forms)
  - cmdInitTodos surfaces depends_on/related_to in init JSON output
  - add-todo.md template writes depends_on/related_to fields with empty-array defaults

affects: [07-05-parallel-safety-gate, frontmatter-schema-consumers]

tech-stack:
  added: []
  patterns: [extractFrontmatter reuse for todo parsing instead of hand-rolled regex]

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/frontmatter.cjs
    - get-shit-done/bin/lib/init.cjs
    - get-shit-done/workflows/add-todo.md
    - tests/frontmatter.test.cjs

key-decisions:
  - "Use extractFrontmatter (already imported in init.cjs) to parse todo fields — handles both inline [val] and block YAML list forms; no hand-rolled third parser"
  - "todo schema: required=[created,title,area], optional=[depends_on,related_to,files] — existing todos without new fields remain valid"
  - "SC3 substrate only: gate reads these fields in Plan 07-05; mark-complete deferred to 07-05"

patterns-established:
  - "extractFrontmatter reuse: init.cjs already imports it; pull fm fields directly instead of parallel regex"

requirements-completed: []

duration: 7min
completed: 2026-06-08
---

# Phase 7 Plan 02: Todo Frontmatter depends_on/related_to Summary

**`todo` schema added to FRONTMATTER_SCHEMAS with depends_on/related_to as optional fields; init todos surfaces them as arrays in JSON; add-todo template writes empty defaults**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-08T07:53:02Z
- **Completed:** 2026-06-08T08:00:00Z
- **Tasks:** 2
- **Files modified:** 3 source files + 1 test file

## Accomplishments

- `FRONTMATTER_SCHEMAS.todo` added with `required: ['created', 'title', 'area']` and `optional: ['depends_on', 'related_to', 'files']` — existing todos without the new fields still validate
- `cmdInitTodos` extended: uses `extractFrontmatter` (already imported) to extract `depends_on`/`related_to` and pushes them as arrays into each todo object in the init JSON
- `add-todo.md` template updated: new todos get `depends_on: []` and `related_to: []` defaults with inline comments
- Full test suite: 924 tests, 0 failures (added 6 new SC3 tests, 3 were RED before schema addition)

## Task Commits

1. **Task 1 (RED): Add failing todo schema tests** - `163d179` (test)
2. **Task 1 (GREEN): Add todo schema to FRONTMATTER_SCHEMAS** - `c2711d5` (feat)
3. **Task 2: Parse depends_on/related_to in init todos + add-todo template** - `bd8ad66` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/frontmatter.cjs` - Added `todo` schema key to FRONTMATTER_SCHEMAS
- `get-shit-done/bin/lib/init.cjs` - Extended cmdInitTodos to parse and expose depends_on/related_to
- `get-shit-done/workflows/add-todo.md` - Added depends_on/related_to fields to todo template
- `tests/frontmatter.test.cjs` - Added 6 new SC3 tests (todo schema existence, field assertions, parse characterization)

## Decisions Made

- `extractFrontmatter` reuse over hand-rolled regex in `cmdInitTodos`: handles both inline `[phase:6]` and block YAML list forms; `frontmatter.cjs` is already imported in `init.cjs` — no new dependency
- `todo` schema makes `depends_on`/`related_to` optional (not required): existing todos without these fields remain valid; the gate defaults absent fields to `[]`
- SC3 ("todos carry depends_on/related_to AND gate reads them") is not marked complete here — the gate in Plan 07-05 closes SC3; this plan delivers the substrate only

## Deviations from Plan

None - plan executed exactly as written. The advisor's prediction was correct: the `extractFrontmatter` parse tests (test d and e) passed immediately (existing parser already handles YAML lists) — RED came exclusively from the schema-key-not-found tests (b and c), as expected.

## Issues Encountered

None.

## Next Phase Readiness

- SC3 substrate complete: `init todos --raw` now returns `depends_on`/`related_to` arrays on every todo object
- Plan 07-05 (parallel safety gate) can read todo edges directly from `init todos` JSON — no further init changes needed
- Source↔runtime identity verified: all three modified source files are byte-identical with their `.claude/` runtime copies

---
*Phase: 07-parallel-multi-session-safety-planning-ergono*
*Completed: 2026-06-08*

## Self-Check: PASSED

- frontmatter.cjs: FOUND
- init.cjs: FOUND
- add-todo.md: FOUND
- 07-02-SUMMARY.md: FOUND
- Commits 163d179, c2711d5, bd8ad66: FOUND
- todo schema key present: CONFIRMED
- frontmatter tests: 41 pass, 0 fail
