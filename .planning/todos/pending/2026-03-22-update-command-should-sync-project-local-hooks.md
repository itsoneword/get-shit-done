---
created: 2026-03-22T11:58:06.575Z
title: Update command should sync project-local hooks
area: tooling
files:
  - bin/install.js
  - get-shit-done/workflows/update.md
---

## Problem

`/gsd2:update` installs hooks to `~/.claude/hooks/` (global), but projects with local installs have `settings.json` pointing to `.claude/hooks/` (project-local). After update, the global hooks get the new version stamp but project-local hooks remain stale, triggering the "stale hooks" warning in the status bar.

## Solution

The update/install flow should detect project-local hook references in `settings.json` and update those too. Options:

1. Installer checks if `.claude/hooks/gsd-*.js` exists in the current project dir and updates those alongside global hooks
2. The stale-hooks check in `gsd-check-update.js` looks at the actual hooks being used (from settings.json paths) rather than just scanning the config dir
3. Both — sync local hooks AND check the right paths
