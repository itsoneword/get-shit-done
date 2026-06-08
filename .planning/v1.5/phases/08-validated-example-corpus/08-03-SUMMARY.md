---
phase: 08-validated-example-corpus
plan: "03"
subsystem: validated-example-corpus
tags:
  - reference
  - corpus
  - node
  - typescript
  - javascript
dependency_graph:
  requires:
    - 08-01-PLAN.md
  provides:
    - get-shit-done/references/validated-examples/async-retry-backoff.md
    - get-shit-done/references/validated-examples/config-env-validation.md
    - get-shit-done/references/validated-examples/validation-layer-ts.md
  affects:
    - 08-04-PLAN.md (INDEX wiring)
    - Phase 9 eval substrate (counters: join keys)
tech_stack:
  added: []
  patterns:
    - Retry with bounded exponential backoff and Retry-After header (undici)
    - AJV schema env validation with fail-fast error and type coercion (env-schema)
    - Zod parse/safeParse discriminated union typed boundary (Zod v3 in v4.x compat)
key_files:
  created:
    - get-shit-done/references/validated-examples/async-retry-backoff.md
    - get-shit-done/references/validated-examples/config-env-validation.md
    - get-shit-done/references/validated-examples/validation-layer-ts.md
  modified: []
decisions:
  - "env-schema (fastify/env-schema v7.0.0) chosen over fastify/fastify initial-config-validation.js for config-env-validation: env-schema directly reads process.env + validates both Environment/Config and Data Shape/API Contract in one function, while fastify's config-validator is AJV auto-generated and not readable as an excerpt"
  - "Zod excerpt from packages/zod/src/v3/types.ts (v3 compat layer in v4.4.3 tag) rather than v4 classic API: parse + safeParse implementation is the same abstract boundary pattern and the v3 layer is the stable API surface users call"
  - "undici retry excerpt from lines 143-163 (backoff+timeout-cap block): omits the allowlist guards (errorCodes/methods/statusCodes) above it to stay within 25-line limit; cargo-cult warning calls this out explicitly"
metrics:
  duration: ~7 minutes
  completed: "2026-06-08T12:19:59Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
requirements:
  - SC1
  - SC3
---

# Phase 08 Plan 03: Node/TS Validated Example Corpus Entries Summary

Three Node/TS seed entries curated from real reputation-vetted repos with real attributed excerpts, header-form counters, and full commentary.

## What was built

Three markdown entry files under `get-shit-done/references/validated-examples/`:

| File | Source | Tag | Lines | Counters |
|------|--------|-----|-------|---------|
| async-retry-backoff.md | nodejs/undici `lib/handler/retry-handler.js` | v6.21.0 | 143-163 | Async / Timing, Error Handling |
| config-env-validation.md | fastify/env-schema `index.js` | v7.0.0 | 107-124 | Environment / Config, Data Shape / API Contract |
| validation-layer-ts.md | colinhacks/zod `packages/zod/src/v3/types.ts` | v4.4.3 | 223-245 | Data Shape / API Contract, Type / Coercion |

Each entry follows `_TEMPLATE.md` exactly: front matter with all required fields, four commentary sections (What this solves / Excerpt / Why it's good / What NOT to cargo-cult), fenced code block excerpt within the 10-30 line constraint, and counters values that are exact `## ` section header strings from `common-bug-patterns.md`.

## Deviations from Plan

None — plan executed exactly as written.

Source locations differed slightly from research hints (env-schema rather than fastify/fastify for config validation; Zod excerpt from v3 compat layer path within v4.4.3 monorepo) but the choices are within the mandate: real reputation-vetted repos, all at pinned release tags, excerpts verified against live raw.githubusercontent.com URLs before writing.

## Self-Check: PASSED

Files exist:
- FOUND: get-shit-done/references/validated-examples/async-retry-backoff.md
- FOUND: get-shit-done/references/validated-examples/config-env-validation.md
- FOUND: get-shit-done/references/validated-examples/validation-layer-ts.md

Commits exist:
- 46d384b: feat(08-03): add async-retry-backoff and config-env-validation entries
- 365b239: feat(08-03): add validation-layer-ts entry (Zod safeParse discriminated union)

All plan must_have verify commands passed.
