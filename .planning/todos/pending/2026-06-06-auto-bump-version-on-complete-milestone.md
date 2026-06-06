---
created: 2026-06-06T00:00:00Z
title: Auto-bump package.json version on complete-milestone (single source of truth)
area: tooling
files:
  - get-shit-done/workflows/complete-milestone.md
  - bin/install.js
  - scripts/build-hooks.js
  - package.json
  - CHANGELOG.md
---

## Problem

Version lives in 4 places that must move together: `package.json` (source of truth),
`hooks/dist/*.js` headers (`// gsd-hook-version: X`, stamped from package.json by
`build:hooks`), runtime `.claude/get-shit-done/VERSION` (written by install), and
`CHANGELOG.md`. Bumping `package.json` without `npm run build:hooks` + install leaves
dist headers / runtime VERSION stale → the SessionStart update-check flags "stale hooks."
This desync bit the user before (1.4.6). Today bumped to 1.4.7 manually via the correct
chain (package.json → `npm run dev` (build:hooks + install) → CHANGELOG → commit).

`complete-milestone` tags/archives but does NOT bump `package.json`, so version never
advances automatically — it sat at 1.4.6 through all of v1.5's in-progress work.

## Solution

Wire a version bump into `/gsd2:complete-milestone`:
1. Derive target version from the milestone being completed (e.g. v1.5 → `1.5.0`).
2. Write `package.json`, run `npm run build:hooks`, re-run install to regenerate
   runtime VERSION + dist headers in lockstep.
3. Prepend a CHANGELOG entry. Then tag the release (existing step).

Consider a `gsd-tools version set <x.y.z>` helper that does the package.json + build +
install chain atomically, callable both from complete-milestone and by hand. Overlaps
with backlog 999.1 (doctor symmetry-check) — a `doctor` could also assert all 4 places agree.

## Acceptance

- Running complete-milestone on v1.5 leaves package.json, dist headers, runtime VERSION,
  and CHANGELOG all on `1.5.0` with no manual steps.
- A symmetry check confirms the 4 places never diverge.
