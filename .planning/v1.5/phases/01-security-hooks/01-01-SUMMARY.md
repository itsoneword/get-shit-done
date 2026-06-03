---
phase: 01-security-hooks
plan: 01
subsystem: infra
tags: [hooks, install, migration, rename, gsd2]

# Dependency graph
requires: []
provides:
  - hooks/gsd2-*.js source files (4 hooks, git history preserved)
  - hooks/dist/gsd2-*.js built copies
  - install.js wired to gsd2-* names, with upgrade migration for old gsd-* installs
affects: [01-02-security-hooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook namespace: gsd2-* prefix for all GSD2 fork hooks (prevents collision with gsd-core in shared ~/.claude/hooks/)"
    - "Upgrade migration pattern: orphanedHookPatterns[] + statusLine regex rewrite in cleanupOrphanedHooks()"

key-files:
  created: []
  modified:
    - hooks/gsd2-statusline.js (renamed from gsd-statusline.js)
    - hooks/gsd2-check-update.js (renamed from gsd-check-update.js)
    - hooks/gsd2-context-monitor.js (renamed from gsd-context-monitor.js)
    - hooks/gsd2-workflow-guard.js (renamed from gsd-workflow-guard.js)
    - hooks/dist/gsd2-statusline.js (renamed + rebuilt)
    - hooks/dist/gsd2-check-update.js (renamed + rebuilt)
    - hooks/dist/gsd2-context-monitor.js (renamed + rebuilt)
    - hooks/dist/gsd2-workflow-guard.js (renamed + rebuilt)
    - scripts/build-hooks.js (HOOKS_TO_COPY updated)
    - bin/install.js (command builders, idempotency checks, orphan patterns, statusLine migration, uninstall)

key-decisions:
  - "gsd-workflow-guard.js registration gap left as-is (pre-existing; wiring it is out of scope)"
  - "Uninstall array includes union of old+new names so partial-upgrade machines still clean up stale files"
  - "statusLine migration is a two-hop chain: statusline.js -> gsd-statusline.js -> gsd2-statusline.js (both blocks preserved)"

patterns-established:
  - "New hooks authored directly as gsd2-* (Plan 02 adds 3 hooks without touching this rename)"
  - "orphanedHookPatterns[] is the canonical place to register old filenames for upgrade cleanup"

requirements-completed: [SEC-01, SEC-02]

# Metrics
duration: 6min
completed: 2026-06-03
---

# Phase 01 Plan 01: gsd2-* Hook Rename + Upgrade Migration Summary

**All 4 GSD hooks renamed gsd-* to gsd2-* (source, dist, build, install wiring) with proven upgrade migration that self-heals existing gsd-* settings.json registrations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-03T18:02:33Z
- **Completed:** 2026-06-03T18:08:02Z
- **Tasks:** 3 (Task 3 was verification-only, no commit)
- **Files modified:** 10

## Accomplishments
- Renamed all 8 tracked hook files (4 source + 4 dist) via `git mv` with history preserved
- Updated HOOKS_TO_COPY in build-hooks.js; `npm run build:hooks` exits 0 with gsd2-* output
- Updated all 7 reference classes in bin/install.js: command builders, idempotency checks, orphanedHookPatterns, statusLine migration, uninstall array, uninstall statusLine/SessionStart/PostToolUse checks
- Empirically verified fresh-install and upgrade-migration paths with throwaway settings.json simulations

## Task Commits

1. **Task 1: Rename the 4 hook source + dist files and update build-hooks.js** - `8bdfa69` (feat)
2. **Task 2: Update all bin/install.js references and add upgrade migration for old gsd-* names** - `88e42fb` (feat)
3. **Task 3: Verify fresh-install and upgrade-migration behaviour** - verification-only, no commit needed

## Files Created/Modified
- `hooks/gsd2-statusline.js` - Renamed from gsd-statusline.js (git history preserved)
- `hooks/gsd2-check-update.js` - Renamed from gsd-check-update.js
- `hooks/gsd2-context-monitor.js` - Renamed from gsd-context-monitor.js
- `hooks/gsd2-workflow-guard.js` - Renamed from gsd-workflow-guard.js
- `hooks/dist/gsd2-statusline.js` - Renamed + rebuilt with version stamp
- `hooks/dist/gsd2-check-update.js` - Renamed + rebuilt
- `hooks/dist/gsd2-context-monitor.js` - Renamed + rebuilt
- `hooks/dist/gsd2-workflow-guard.js` - Renamed + rebuilt
- `scripts/build-hooks.js` - HOOKS_TO_COPY updated to gsd2-* names
- `bin/install.js` - 7 reference classes updated (see Accomplishments)

## Task 3 Simulation Results

**Invocation:** `(cd "$TMP" && node /home/cleversol/gsd2/mine/bin/install.js --claude --local)`

**Fresh install settings.json:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/gsd2-check-update.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/gsd2-context-monitor.js"
          }
        ]
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "node .claude/hooks/gsd2-statusline.js"
  }
}
```

**Upgrade simulation settings.json** (pre-seeded with gsd-* paths, post-install result):
```json
{
  "statusLine": {
    "type": "command",
    "command": "node /old/hooks/gsd2-statusline.js"
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/gsd2-check-update.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/gsd2-context-monitor.js"
          }
        ]
      }
    ]
  }
}
```

Upgrade install printed: "Removed orphaned hook registrations" + "Updated statusline path (gsd-statusline.js → gsd2-statusline.js)". Both assertions (gsd- removed AND gsd2- present) verified for all three hook event types.

## Decisions Made
- gsd-workflow-guard.js registration gap left as-is — pre-existing state, wiring it up is out of scope for this plan (Plan 02)
- Uninstall gsdHooks array is a union of old+new names so a partial-upgrade machine that still has gsd-* files in the runtime dir gets them deleted
- statusLine migration is a two-hop chain: the existing `statusline.js -> gsd-statusline.js` block is left producing `gsd-statusline.js`; the new block immediately after rewrites `gsd-statusline.js -> gsd2-statusline.js`. An ancient two-hop install migrates all the way to gsd2 in a single install run.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02 (3 new advisory security hooks) can now be authored directly into the gsd2-* world:
- hooks/ directory contains only gsd2-* files (no collision risk with gsd-core)
- install.js wiring is fully gsd2-* aware
- Upgrade migration self-heals existing users

---
*Phase: 01-security-hooks*
*Completed: 2026-06-03*

## Self-Check: PASSED

Files verified:
- hooks/gsd2-statusline.js: EXISTS
- hooks/gsd2-check-update.js: EXISTS
- hooks/gsd2-context-monitor.js: EXISTS
- hooks/gsd2-workflow-guard.js: EXISTS
- hooks/dist/gsd2-statusline.js: EXISTS
- hooks/dist/gsd2-check-update.js: EXISTS
- hooks/dist/gsd2-context-monitor.js: EXISTS
- hooks/dist/gsd2-workflow-guard.js: EXISTS

Commits verified:
- 8bdfa69: EXISTS (Task 1 - hook rename)
- 88e42fb: EXISTS (Task 2 - install.js update)
