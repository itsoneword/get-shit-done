# Phase 1: Security Hooks - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-03
**Phase:** 1-security-hooks
**Decisions captured:** 6 (4 strong, 0 weak, 2 discretion/exclusion)

---

## Conversation Summary

### Naming / namespace
**User's perspective:** Wanted unambiguous ownership — hooks should be visibly "mine, not core." Volunteered that *anything* still named `gsd-*` in the fork should be renamed, not just the new files.
**Decision:** Blanket rename to `gsd2-*` — 3 new security hooks + the 4 existing hooks.
**Signal:** [STRONG] — decisive, gave reasoning, expanded scope themselves.

### Per-hook posture (advisory hooks)
**User's perspective:** Picked the recommended matrix option directly.
**Decision:** prompt-guard + read-injection-scanner advisory/default-ON; read-guard advisory/opt-in.
**Signal:** [STRONG] — explicit selection from a concrete matrix.

### worktree-path-guard (hard-blocker)
**User's perspective:** "I can use worktrees in general, but never had any problems with that, so no prefs. we can simply exclude this req if it is not critical for other functionality." First answer leaned "do what's easier or even skip."
**Decision:** Excluded from Phase 1 (standalone, nothing depends on it). SEC-01 amended to 3 hooks; worktree-guard moved to a Future requirement.
**Signal:** [DISCRETION → exclusion] — no preference, explicitly OK to drop.

### validate-commit (bash)
**User's perspective:** "same as worktree guards, can be postponed, not actively used."
**Decision:** Deferred / out of scope (already outside SEC).
**Signal:** [STRONG] — clear defer.

### Config gating mechanism
**User's perspective:** Not separately questioned — anchored on the existing `gsd-workflow-guard` self-gate precedent, surfaced as established.
**Decision:** Register unconditionally in install.js; gate inside each hook via `.planning/config.json`. Default-on hooks invert the precedent (run unless explicitly false).
**Signal:** [STRONG, specialist-backed] — established fork pattern, advisor-confirmed.

## Established (Not Discussed)
- Hook anatomy (stdin-JSON, silent-fail, advisory vs block output shapes) — copied from core as-is.
- build-hooks.js copy + `vm.Script` syntax check + `{{GSD_VERSION}}` stamp.
- install.js registration shape (matcher + timeout + idempotency `.some()` guard) and runtime event-name mapping.

## Deferred Ideas
- worktree-path-guard — revisit if worktree-isolated execution becomes routine.
- gsd-validate-commit.sh — bigger security-auditor surface.
- update-command hook-sync todo (2026-03-22) — adjacent, kept separate.
