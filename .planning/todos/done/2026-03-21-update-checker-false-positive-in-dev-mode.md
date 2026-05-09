---
created: 2026-03-21T20:57:12.916Z
title: Update checker false positive in dev mode
area: tooling
files:
  - hooks/gsd-check-update.js
  - hooks/gsd-statusline.js:96-107
  - scripts/build-hooks.js
  - hooks/gsd-workflow-guard.js:1-2
---

## Problem

When developing GSD from the source repo, the update checker compares local version (v1.2.0) against the upstream npm package (v1.27.0) and shows a false "update available" + "stale hooks" warning in the statusline. This is confusing during dev since you're ahead of the published version, not behind it.

Two sub-issues:
1. **False update indicator**: `gsd-check-update.js` writes `update_available: true` to cache because local `1.2.0` < npm `1.27.0`. The statusline reads this cache and shows the warning.
2. **Stale hooks false positive**: `gsd-workflow-guard.js` has `{{GSD_VERSION}}` as its version header — the `build-hooks.js` script stamps this during build, but if hooks are used directly from source (not via `hooks/dist/`), the placeholder is never replaced. The stale-hooks check sees "unknown" version and flags it.

## Solution

1. **Dev mode detection**: Check if the running hook is inside a git repo with a `package.json` containing `"name": "gsd2"`. If so, skip the npm update check entirely — the developer IS the source of truth.
2. **Version stamping**: Either stamp `{{GSD_VERSION}}` in the source hooks too (during `npm run dev`), or make the stale-hooks check recognize the placeholder as "source mode" and skip.
3. **Alternative**: Add a config flag like `dev_mode: true` in `.planning/config.json` that suppresses update checks.
