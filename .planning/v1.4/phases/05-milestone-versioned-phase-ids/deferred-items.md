# Phase 05 — Deferred Items

## Pre-existing test failure (out of scope for 05-01)

- **Test:** `tests/claude-md.test.cjs:64-103` (`new-project workflow includes CLAUDE.md generation` → `new-project artifacts mention CLAUDE.md`)
- **Error:** `ENOENT: no such file or directory, open '/Users/vyacheslav.dubinin/Progaramming/gsd2/docs/COMMANDS.md'`
- **Reproduced:** Confirmed pre-existing on `main` HEAD (14a3a10) before Plan 05-01 changes were applied — verified via `git stash && npm test`
- **Scope:** Unrelated to milestone-partitioned phases — references a missing CLAUDE.md generation source file
- **Action:** Defer for follow-up plan/fix outside Phase 05
