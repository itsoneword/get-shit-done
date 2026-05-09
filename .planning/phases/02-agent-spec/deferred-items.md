# Deferred Items — Phase 02 agent-spec

Pre-existing test failures discovered during Plan 02-02 execution. These are NOT caused by Plan 02-02 changes. They were present at execution start and are visible in the modified files in `git status` from prior unrelated work.

## Pre-existing Failing Tests (21 total)

Reproduction: `npm test` against current main HEAD (commit 1d67da2) reports 21 failures.

### agent-frontmatter.test.cjs (13 fails)
- `gsd-codebase-mapper has anti-heredoc instruction`
- `gsd-debugger has anti-heredoc instruction`
- `gsd-executor has anti-heredoc instruction`
- `gsd-fixer has anti-heredoc instruction`
- `gsd-phase-researcher has anti-heredoc instruction`
- `gsd-planner has anti-heredoc instruction`
- `gsd-project-researcher has anti-heredoc instruction`
- `gsd-research-synthesizer has anti-heredoc instruction`
- `gsd-roadmapper has anti-heredoc instruction`
- `gsd-test-designer has anti-heredoc instruction`
- `gsd-ui-auditor has anti-heredoc instruction`
- `gsd-ui-researcher has anti-heredoc instruction`
- `gsd-verifier has anti-heredoc instruction`
- `gsd-test-designer has commented hooks pattern`
- `gsd-verifier has commented hooks pattern`

### copilot-install.test.cjs (5 fails)
- `creates skill folders from source commands`
- `all 17 agents convert without error`
- `installs expected number of skill directories`
- `installs expected number of agent files`
- `installs all expected agent files`
- `manifest contains expected file categories`

## Why Deferred

These failures relate to anti-heredoc agent linting rules and Copilot install scaffold counts — neither domain touched by Plan 02-02 (which only adds AGENT-SPEC.md discovery + agent type registration). Out of scope per executor scope-boundary rule.
