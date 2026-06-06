---
created: 2026-06-06T00:00:00Z
title: Add {{GSD_VERSION}} header to gsd2-agent-trace.js hook
area: tooling
files:
  - hooks/gsd2-agent-trace.js
  - scripts/build-hooks.js
---

## Problem

All hook sources carry `// gsd-hook-version: {{GSD_VERSION}}` on line 2, which
`build:hooks` stamps from `package.json` and the SessionStart update-check uses to detect
staleness. `hooks/gsd2-agent-trace.js` (added in Phase 4) is the ONE hook missing this
header — so it never gets a version stamp, and the stale-hooks check treats "no header"
as stale (per `gsd2-check-update.js`: missing header → pushed to staleHooks).

Confirmed 2026-06-06: 7/8 dist hooks stamped to 1.4.7; agent-trace is the holdout.

## Solution

Add `// gsd-hook-version: {{GSD_VERSION}}` as line 2 of `hooks/gsd2-agent-trace.js`
(matching the other 7 hooks), then `npm run build:hooks` + install so the dist/runtime
copies get the stamp. One-line fix.

## Acceptance

- `grep -L 'gsd-hook-version' hooks/dist/*.js` returns nothing (all 8 hooks stamped).
