# Phase 4 — Agent / Workflow / Tool Dependency Graph

**Generated:** 2026-05-07
**Scope:** .claude/agents/, .claude/get-shit-done/, .claude/commands/
**Source:** 04-dependency-graph.json

---

## Agents

### gsd-agent-checker
- **Callers:**
  - .claude/commands/gsd2/agent-spec-phase.md
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/templates/AGENT-SPEC.md
  - .claude/get-shit-done/workflows/agent-spec-phase.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/agent-spec-phase.md

### gsd-agent-researcher
- **Callers:**
  - .claude/agents/gsd-agent-checker.md
  - .claude/commands/gsd2/agent-spec-phase.md
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/AGENTIC-PATTERNS.md
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/templates/AGENT-SPEC.md
  - .claude/get-shit-done/workflows/agent-spec-phase.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/agent-spec-phase.md

### gsd-codebase-mapper
- **Callers:**
  - .claude/commands/gsd2/map-codebase.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/document.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/map-codebase.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/document.md
  - .claude/get-shit-done/workflows/map-codebase.md

### gsd-debugger
- **Callers:**
  - .claude/commands/gsd2/debug.md
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/templates/debug-subagent-prompt.md
  - .claude/get-shit-done/workflows/diagnose-issues.md
  - .claude/get-shit-done/workflows/execute-phase.md
- **Spawned by:**
  - .claude/commands/gsd2/debug.md
  - .claude/get-shit-done/templates/debug-subagent-prompt.md
  - .claude/get-shit-done/workflows/diagnose-issues.md

### gsd-document-mapper
- **Callers:**
  - .claude/agents/gsd-document-updater.md
  - .claude/commands/gsd2/document.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/document.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/document.md

### gsd-document-updater
- **Callers:**
  - .claude/commands/gsd2/document.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/document.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/document.md

### gsd-executor
- **Callers:**
  - .claude/agents/gsd-test-designer.md
  - .claude/agents/gsd-ui-researcher.md
  - .claude/commands/gsd2/quick.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/AGENTIC-PATTERNS.md
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/templates/TEST-SPEC.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/execute-plan.md
  - .claude/get-shit-done/workflows/quick.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/execute-plan.md
  - .claude/get-shit-done/workflows/quick.md

### gsd-fixer
- **Callers:**
  - .claude/commands/gsd2/fix.md
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
- **Spawned by:**
  - .claude/commands/gsd2/fix.md

### gsd-integration-checker
- **Callers:**
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/audit-milestone.md
  - .claude/get-shit-done/workflows/execute-phase.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/audit-milestone.md

### gsd-nyquist-auditor
- **Callers:**
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/validate-phase.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/validate-phase.md

### gsd-phase-researcher
- **Callers:**
  - .claude/commands/gsd2/research-phase.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/templates/context.md
  - .claude/get-shit-done/workflows/discuss-phase.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/research-phase.md
- **Spawned by:**
  - .claude/commands/gsd2/research-phase.md
  - .claude/get-shit-done/workflows/discuss-phase.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/research-phase.md

### gsd-plan-checker
- **Callers:**
  - .claude/commands/gsd2/plan-phase.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/quick.md
  - .claude/get-shit-done/workflows/verify-work.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/verify-work.md

### gsd-planner
- **Callers:**
  - .claude/agents/gsd-agent-checker.md
  - .claude/agents/gsd-agent-researcher.md
  - .claude/agents/gsd-phase-researcher.md
  - .claude/agents/gsd-test-designer.md
  - .claude/agents/gsd-ui-researcher.md
  - .claude/commands/gsd2/plan-phase.md
  - .claude/commands/gsd2/quick.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profile-resolution.md
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/templates/TEST-SPEC.md
  - .claude/get-shit-done/templates/context.md
  - .claude/get-shit-done/templates/phase-prompt.md
  - .claude/get-shit-done/templates/planner-subagent-prompt.md
  - .claude/get-shit-done/workflows/discuss-phase.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/quick.md
  - .claude/get-shit-done/workflows/verify-work.md
- **Spawned by:**
  - .claude/get-shit-done/references/model-profile-resolution.md
  - .claude/get-shit-done/templates/planner-subagent-prompt.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/quick.md
  - .claude/get-shit-done/workflows/verify-work.md

### gsd-project-researcher
- **Callers:**
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/new-milestone.md
  - .claude/get-shit-done/workflows/new-project.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/new-milestone.md
  - .claude/get-shit-done/workflows/new-project.md

### gsd-research-synthesizer
- **Callers:**
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/new-milestone.md
  - .claude/get-shit-done/workflows/new-project.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/new-milestone.md
  - .claude/get-shit-done/workflows/new-project.md

### gsd-roadmapper
- **Callers:**
  - .claude/agents/gsd-research-synthesizer.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/new-milestone.md
  - .claude/get-shit-done/workflows/new-project.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/new-milestone.md
  - .claude/get-shit-done/workflows/new-project.md

### gsd-test-designer
- **Callers:**
  - .claude/commands/gsd2/test-phase.md
  - .claude/get-shit-done/templates/TEST-SPEC.md
  - .claude/get-shit-done/workflows/test-phase.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/test-phase.md

### gsd-ui-auditor
- **Callers:**
  - .claude/agents/gsd-ui-researcher.md
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/ui-review.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/ui-review.md

### gsd-ui-checker
- **Callers:**
  - .claude/agents/gsd-ui-researcher.md
  - .claude/commands/gsd2/ui-phase.md
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/templates/UI-SPEC.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/ui-phase.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/ui-phase.md

### gsd-ui-researcher
- **Callers:**
  - .claude/agents/gsd-ui-checker.md
  - .claude/commands/gsd2/ui-phase.md
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/templates/UI-SPEC.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/ui-phase.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/ui-phase.md

### gsd-user-profiler
- **Callers:**
  - .claude/get-shit-done/references/user-profiling.md
  - .claude/get-shit-done/workflows/profile-user.md
- **Spawned by:**
  - (none detected)

### gsd-verifier
- **Callers:**
  - .claude/agents/gsd-plan-checker.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/quick.md
- **Spawned by:**
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/quick.md

---

## Workflows

### add-phase.md
- **Callers:**
  - .claude/commands/gsd2/add-phase.md
- **Includes:**
  - (none)

### add-tests.md
- **Callers:**
  - .claude/commands/gsd2/add-tests.md
- **Includes:**
  - (none)

### add-todo.md
- **Callers:**
  - .claude/commands/gsd2/add-todo.md
- **Includes:**
  - (none)

### agent-spec-phase.md
- **Callers:**
  - .claude/commands/gsd2/agent-spec-phase.md
- **Includes:**
  - (none)

### audit-milestone.md
- **Callers:**
  - .claude/commands/gsd2/audit-milestone.md
- **Includes:**
  - (none)

### audit-uat.md
- **Callers:**
  - .claude/commands/gsd2/audit-uat.md
- **Includes:**
  - (none)

### autonomous.md
- **Callers:**
  - .claude/commands/gsd2/autonomous.md
- **Includes:**
  - (none)

### check-todos.md
- **Callers:**
  - .claude/commands/gsd2/check-todos.md
- **Includes:**
  - (none)

### cleanup.md
- **Callers:**
  - .claude/commands/gsd2/cleanup.md
- **Includes:**
  - (none)

### complete-milestone.md
- **Callers:**
  - .claude/commands/gsd2/complete-milestone.md
  - .claude/get-shit-done/templates/project.md
- **Includes:**
  - (none)

### diagnose-issues.md
- **Callers:**
  - .claude/get-shit-done/workflows/verify-work.md
- **Includes:**
  - (none)

### discovery-phase.md
- **Callers:**
  - (none detected)
- **Includes:**
  - (none)

### discuss-phase.md
- **Callers:**
  - .claude/agents/gsd-document-mapper.md
  - .claude/commands/gsd2/discuss-phase.md
- **Includes:**
  - (none)

### do.md
- **Callers:**
  - .claude/commands/gsd2/do.md
- **Includes:**
  - (none)

### document.md
- **Callers:**
  - .claude/commands/gsd2/document.md
- **Includes:**
  - (none)

### execute-phase.md
- **Callers:**
  - .claude/commands/gsd2/execute-phase.md
- **Includes:**
  - workflows/execute-plan.md

### execute-plan.md
- **Callers:**
  - .claude/agents/gsd-planner.md
  - .claude/get-shit-done/templates/phase-prompt.md
  - .claude/get-shit-done/workflows/execute-phase.md
- **Includes:**
  - workflows/node-repair.md

### health.md
- **Callers:**
  - .claude/commands/gsd2/health.md
- **Includes:**
  - (none)

### help.md
- **Callers:**
  - .claude/commands/gsd2/help.md
- **Includes:**
  - (none)

### insert-phase.md
- **Callers:**
  - .claude/commands/gsd2/insert-phase.md
- **Includes:**
  - (none)

### list-phase-assumptions.md
- **Callers:**
  - .claude/commands/gsd2/list-phase-assumptions.md
- **Includes:**
  - (none)

### map-codebase.md
- **Callers:**
  - .claude/commands/gsd2/map-codebase.md
- **Includes:**
  - (none)

### new-milestone.md
- **Callers:**
  - .claude/commands/gsd2/new-milestone.md
- **Includes:**
  - (none)

### new-project.md
- **Callers:**
  - .claude/commands/gsd2/new-project.md
- **Includes:**
  - (none)

### next.md
- **Callers:**
  - .claude/commands/gsd2/next.md
- **Includes:**
  - (none)

### node-repair.md
- **Callers:**
  - .claude/get-shit-done/workflows/execute-plan.md
- **Includes:**
  - (none)

### note.md
- **Callers:**
  - .claude/commands/gsd2/note.md
- **Includes:**
  - (none)

### pause-work.md
- **Callers:**
  - .claude/commands/gsd2/pause-work.md
- **Includes:**
  - (none)

### plan-milestone-gaps.md
- **Callers:**
  - .claude/commands/gsd2/plan-milestone-gaps.md
- **Includes:**
  - (none)

### plan-phase.md
- **Callers:**
  - .claude/commands/gsd2/plan-phase.md
- **Includes:**
  - (none)

### plant-seed.md
- **Callers:**
  - .claude/commands/gsd2/plant-seed.md
- **Includes:**
  - (none)

### pr-branch.md
- **Callers:**
  - .claude/commands/gsd2/pr-branch.md
- **Includes:**
  - (none)

### profile-user.md
- **Callers:**
  - .claude/commands/gsd2/profile-user.md
- **Includes:**
  - (none)

### progress.md
- **Callers:**
  - .claude/commands/gsd2/progress.md
- **Includes:**
  - (none)

### quick.md
- **Callers:**
  - .claude/commands/gsd2/quick.md
- **Includes:**
  - (none)

### remove-phase.md
- **Callers:**
  - .claude/commands/gsd2/remove-phase.md
- **Includes:**
  - (none)

### research-phase.md
- **Callers:**
  - (none detected)
- **Includes:**
  - (none)

### resume-project.md
- **Callers:**
  - .claude/commands/gsd2/resume-work.md
- **Includes:**
  - (none)

### review.md
- **Callers:**
  - .claude/commands/gsd2/review.md
- **Includes:**
  - (none)

### session-report.md
- **Callers:**
  - .claude/commands/gsd2/session-report.md
- **Includes:**
  - (none)

### settings.md
- **Callers:**
  - .claude/commands/gsd2/settings.md
- **Includes:**
  - (none)

### ship.md
- **Callers:**
  - .claude/commands/gsd2/ship.md
- **Includes:**
  - (none)

### stats.md
- **Callers:**
  - .claude/commands/gsd2/stats.md
- **Includes:**
  - (none)

### test-phase.md
- **Callers:**
  - .claude/commands/gsd2/test-phase.md
- **Includes:**
  - (none)

### transition.md
- **Callers:**
  - .claude/get-shit-done/templates/project.md
  - .claude/get-shit-done/workflows/execute-phase.md
- **Includes:**
  - (none)

### ui-phase.md
- **Callers:**
  - .claude/commands/gsd2/ui-phase.md
- **Includes:**
  - (none)

### ui-review.md
- **Callers:**
  - .claude/commands/gsd2/ui-review.md
- **Includes:**
  - (none)

### update.md
- **Callers:**
  - .claude/commands/gsd2/update.md
- **Includes:**
  - (none)

### validate-phase.md
- **Callers:**
  - .claude/commands/gsd2/validate-phase.md
- **Includes:**
  - (none)

### verify-phase.md
- **Callers:**
  - .claude/get-shit-done/templates/phase-prompt.md
- **Includes:**
  - (none)

### verify-work.md
- **Callers:**
  - .claude/commands/gsd2/verify-work.md
- **Includes:**
  - workflows/diagnose-issues.md

---

## Tools (gsd-tools subcommands)

### audit-uat
- **Callers:**
  - .claude/get-shit-done/workflows/audit-uat.md
  - .claude/get-shit-done/workflows/progress.md

### commit
- **Callers:**
  - .claude/agents/gsd-debugger.md
  - .claude/agents/gsd-executor.md
  - .claude/agents/gsd-phase-researcher.md
  - .claude/agents/gsd-planner.md
  - .claude/agents/gsd-research-synthesizer.md
  - .claude/agents/gsd-test-designer.md
  - .claude/agents/gsd-ui-researcher.md
  - .claude/commands/gsd2/add-backlog.md
  - .claude/commands/gsd2/document.md
  - .claude/commands/gsd2/review-backlog.md
  - .claude/commands/gsd2/thread.md
  - .claude/get-shit-done/references/git-integration.md
  - .claude/get-shit-done/references/git-planning-commit.md
  - .claude/get-shit-done/references/planning-config.md
  - .claude/get-shit-done/workflows/add-todo.md
  - .claude/get-shit-done/workflows/agent-spec-phase.md
  - .claude/get-shit-done/workflows/autonomous.md
  - .claude/get-shit-done/workflows/check-todos.md
  - .claude/get-shit-done/workflows/cleanup.md
  - .claude/get-shit-done/workflows/complete-milestone.md
  - .claude/get-shit-done/workflows/diagnose-issues.md
  - .claude/get-shit-done/workflows/discuss-phase.md
  - .claude/get-shit-done/workflows/document.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/execute-plan.md
  - .claude/get-shit-done/workflows/map-codebase.md
  - .claude/get-shit-done/workflows/new-milestone.md
  - .claude/get-shit-done/workflows/new-project.md
  - .claude/get-shit-done/workflows/pause-work.md
  - .claude/get-shit-done/workflows/plan-milestone-gaps.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/plant-seed.md
  - .claude/get-shit-done/workflows/quick.md
  - .claude/get-shit-done/workflows/remove-phase.md
  - .claude/get-shit-done/workflows/review.md
  - .claude/get-shit-done/workflows/ship.md
  - .claude/get-shit-done/workflows/test-phase.md
  - .claude/get-shit-done/workflows/ui-phase.md
  - .claude/get-shit-done/workflows/ui-review.md
  - .claude/get-shit-done/workflows/validate-phase.md
  - .claude/get-shit-done/workflows/verify-work.md

### config-ensure-section
- **Callers:**
  - .claude/get-shit-done/workflows/settings.md

### config-get
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/agent-spec-phase.md
  - .claude/get-shit-done/workflows/discuss-phase.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/execute-plan.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/test-phase.md
  - .claude/get-shit-done/workflows/ui-phase.md

### config-set
- **Callers:**
  - .claude/commands/gsd2/set-profile.md
  - .claude/get-shit-done/workflows/discuss-phase.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/new-project.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/transition.md

### config-set-model-profile
- **Callers:**
  - .claude/commands/gsd2/set-profile.md

### current-timestamp
- **Callers:**
  - .claude/get-shit-done/workflows/pause-work.md

### extract-messages
- **Callers:**
  - (none detected)

### find-phase
- **Callers:**
  - .claude/commands/gsd2/fix.md
  - .claude/get-shit-done/references/phase-argument-parsing.md
  - .claude/get-shit-done/workflows/audit-milestone.md
  - .claude/get-shit-done/workflows/execute-phase.md

### frontmatter get
- **Callers:**
  - .claude/agents/gsd-plan-checker.md
  - .claude/get-shit-done/workflows/verify-phase.md

### frontmatter merge
- **Callers:**
  - (none detected)

### frontmatter set
- **Callers:**
  - (none detected)

### frontmatter validate
- **Callers:**
  - .claude/agents/gsd-planner.md

### generate-claude-md
- **Callers:**
  - .claude/get-shit-done/workflows/map-codebase.md
  - .claude/get-shit-done/workflows/new-project.md

### generate-claude-profile
- **Callers:**
  - .claude/get-shit-done/workflows/profile-user.md

### generate-dev-preferences
- **Callers:**
  - .claude/get-shit-done/workflows/profile-user.md

### generate-slug
- **Callers:**
  - .claude/commands/gsd2/add-backlog.md
  - .claude/commands/gsd2/thread.md
  - .claude/get-shit-done/references/decimal-phase-calculation.md
  - .claude/get-shit-done/workflows/add-todo.md

### history-digest
- **Callers:**
  - .claude/agents/gsd-planner.md

### init document
- **Callers:**
  - .claude/commands/gsd2/document.md
  - .claude/get-shit-done/workflows/document.md

### init execute-phase
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/references/planning-config.md
  - .claude/get-shit-done/workflows/complete-milestone.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/execute-plan.md

### init map-codebase
- **Callers:**
  - .claude/get-shit-done/workflows/map-codebase.md

### init milestone-op
- **Callers:**
  - .claude/commands/gsd2/autonomous.md
  - .claude/get-shit-done/workflows/audit-milestone.md
  - .claude/get-shit-done/workflows/autonomous.md

### init new-milestone
- **Callers:**
  - .claude/get-shit-done/workflows/new-milestone.md

### init new-project
- **Callers:**
  - .claude/get-shit-done/workflows/new-project.md

### init phase-op
- **Callers:**
  - .claude/agents/gsd-phase-researcher.md
  - .claude/agents/gsd-plan-checker.md
  - .claude/commands/gsd2/research-phase.md
  - .claude/get-shit-done/workflows/add-phase.md
  - .claude/get-shit-done/workflows/add-tests.md
  - .claude/get-shit-done/workflows/autonomous.md
  - .claude/get-shit-done/workflows/discuss-phase.md
  - .claude/get-shit-done/workflows/insert-phase.md
  - .claude/get-shit-done/workflows/remove-phase.md
  - .claude/get-shit-done/workflows/research-phase.md
  - .claude/get-shit-done/workflows/review.md
  - .claude/get-shit-done/workflows/ship.md
  - .claude/get-shit-done/workflows/ui-review.md
  - .claude/get-shit-done/workflows/validate-phase.md
  - .claude/get-shit-done/workflows/verify-phase.md

### init plan-phase
- **Callers:**
  - .claude/agents/gsd-planner.md
  - .claude/get-shit-done/workflows/agent-spec-phase.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/test-phase.md
  - .claude/get-shit-done/workflows/ui-phase.md

### init progress
- **Callers:**
  - .claude/get-shit-done/workflows/progress.md

### init quick
- **Callers:**
  - .claude/get-shit-done/workflows/quick.md

### init resume
- **Callers:**
  - .claude/get-shit-done/workflows/resume-project.md

### init todos
- **Callers:**
  - .claude/get-shit-done/workflows/add-todo.md
  - .claude/get-shit-done/workflows/check-todos.md

### init verify-work
- **Callers:**
  - .claude/get-shit-done/workflows/verify-work.md

### list-todos
- **Callers:**
  - (none detected)

### milestone complete
- **Callers:**
  - .claude/get-shit-done/workflows/complete-milestone.md

### phase add
- **Callers:**
  - .claude/commands/gsd2/review-backlog.md
  - .claude/get-shit-done/workflows/add-phase.md

### phase complete
- **Callers:**
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/transition.md

### phase insert
- **Callers:**
  - .claude/get-shit-done/workflows/insert-phase.md

### phase next-decimal
- **Callers:**
  - .claude/commands/gsd2/add-backlog.md
  - .claude/get-shit-done/references/decimal-phase-calculation.md

### phase remove
- **Callers:**
  - .claude/get-shit-done/workflows/remove-phase.md

### phase-plan-index
- **Callers:**
  - .claude/get-shit-done/workflows/execute-phase.md

### phases list
- **Callers:**
  - .claude/get-shit-done/workflows/audit-milestone.md
  - .claude/get-shit-done/workflows/execute-plan.md
  - .claude/get-shit-done/workflows/plan-milestone-gaps.md

### profile-questionnaire
- **Callers:**
  - .claude/get-shit-done/workflows/profile-user.md

### profile-sample
- **Callers:**
  - .claude/get-shit-done/workflows/profile-user.md

### progress
- **Callers:**
  - .claude/get-shit-done/workflows/progress.md
  - .claude/get-shit-done/workflows/transition.md

### requirements mark-complete
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/execute-plan.md

### resolve-model
- **Callers:**
  - .claude/commands/gsd2/debug.md
  - .claude/commands/gsd2/fix.md
  - .claude/commands/gsd2/research-phase.md
  - .claude/get-shit-done/workflows/agent-spec-phase.md
  - .claude/get-shit-done/workflows/audit-milestone.md
  - .claude/get-shit-done/workflows/test-phase.md
  - .claude/get-shit-done/workflows/ui-phase.md
  - .claude/get-shit-done/workflows/ui-review.md
  - .claude/get-shit-done/workflows/validate-phase.md

### roadmap analyze
- **Callers:**
  - .claude/commands/gsd2/autonomous.md
  - .claude/get-shit-done/workflows/autonomous.md
  - .claude/get-shit-done/workflows/complete-milestone.md
  - .claude/get-shit-done/workflows/progress.md
  - .claude/get-shit-done/workflows/transition.md

### roadmap get-phase
- **Callers:**
  - .claude/agents/gsd-plan-checker.md
  - .claude/agents/gsd-verifier.md
  - .claude/commands/gsd2/research-phase.md
  - .claude/get-shit-done/references/phase-argument-parsing.md
  - .claude/get-shit-done/workflows/agent-spec-phase.md
  - .claude/get-shit-done/workflows/autonomous.md
  - .claude/get-shit-done/workflows/plan-phase.md
  - .claude/get-shit-done/workflows/research-phase.md
  - .claude/get-shit-done/workflows/test-phase.md
  - .claude/get-shit-done/workflows/ui-phase.md
  - .claude/get-shit-done/workflows/verify-phase.md

### roadmap update-plan-progress
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/execute-plan.md

### scaffold context
- **Callers:**
  - (none detected)

### scaffold phase-dir
- **Callers:**
  - (none detected)

### scaffold uat
- **Callers:**
  - (none detected)

### scaffold verification
- **Callers:**
  - (none detected)

### scan-sessions
- **Callers:**
  - .claude/get-shit-done/workflows/profile-user.md

### state add-blocker
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/execute-plan.md

### state add-decision
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/execute-plan.md

### state advance-plan
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/execute-plan.md

### state begin-phase
- **Callers:**
  - .claude/get-shit-done/workflows/execute-phase.md

### state get
- **Callers:**
  - (none detected)

### state json
- **Callers:**
  - .claude/get-shit-done/workflows/next.md

### state load
- **Callers:**
  - .claude/agents/gsd-debugger.md
  - .claude/commands/gsd2/debug.md
  - .claude/commands/gsd2/fix.md
  - .claude/get-shit-done/references/planning-config.md
  - .claude/get-shit-done/workflows/do.md
  - .claude/get-shit-done/workflows/settings.md
  - .claude/get-shit-done/workflows/ship.md

### state patch
- **Callers:**
  - (none detected)

### state record-metric
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/execute-plan.md

### state record-session
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/agent-spec-phase.md
  - .claude/get-shit-done/workflows/discuss-phase.md
  - .claude/get-shit-done/workflows/execute-plan.md
  - .claude/get-shit-done/workflows/test-phase.md
  - .claude/get-shit-done/workflows/ui-phase.md

### state resolve-blocker
- **Callers:**
  - (none detected)

### state signal-resume
- **Callers:**
  - (none detected)

### state signal-waiting
- **Callers:**
  - (none detected)

### state snapshot
- **Callers:**
  - (none detected)

### state update
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/execute-plan.md
  - .claude/get-shit-done/workflows/ship.md

### state update-progress
- **Callers:**
  - .claude/agents/gsd-executor.md
  - .claude/get-shit-done/workflows/execute-plan.md

### state-snapshot
- **Callers:**
  - .claude/get-shit-done/workflows/add-tests.md
  - .claude/get-shit-done/workflows/progress.md

### stats
- **Callers:**
  - (none detected)

### summary-extract
- **Callers:**
  - .claude/agents/gsd-verifier.md
  - .claude/get-shit-done/workflows/audit-milestone.md
  - .claude/get-shit-done/workflows/complete-milestone.md
  - .claude/get-shit-done/workflows/progress.md

### template fill
- **Callers:**
  - (none detected)

### template select
- **Callers:**
  - (none detected)

### todo complete
- **Callers:**
  - (none detected)

### validate consistency
- **Callers:**
  - (none detected)

### validate health
- **Callers:**
  - .claude/get-shit-done/workflows/health.md

### verify artifacts
- **Callers:**
  - .claude/agents/gsd-verifier.md
  - .claude/get-shit-done/workflows/verify-phase.md

### verify commits
- **Callers:**
  - (none detected)

### verify key-links
- **Callers:**
  - .claude/agents/gsd-verifier.md
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/verify-phase.md

### verify phase-completeness
- **Callers:**
  - (none detected)

### verify plan-structure
- **Callers:**
  - .claude/agents/gsd-plan-checker.md
  - .claude/agents/gsd-planner.md

### verify references
- **Callers:**
  - (none detected)

### verify-path-exists
- **Callers:**
  - (none detected)

### verify-summary
- **Callers:**
  - (none detected)

### websearch
- **Callers:**
  - .claude/agents/gsd-phase-researcher.md
  - .claude/agents/gsd-project-researcher.md

### write-profile
- **Callers:**
  - .claude/get-shit-done/workflows/profile-user.md

---

## Risk Surface for Plan 04-03

Plan 04-03 adapts gsd-verifier, gsd-debugger, and gsd-fixer in-place to add loop-mode support. The graph below shows every other call site that depends on each agent's current standalone return shape — these must keep working unchanged.

### gsd-verifier

- **Direct spawn sites (Task() invocations):**
  - .claude/get-shit-done/workflows/execute-phase.md
  - .claude/get-shit-done/workflows/quick.md
- **Other references (prompts, docs, model profiles):**
  - .claude/agents/gsd-plan-checker.md
  - .claude/get-shit-done/bin/lib/init.cjs
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md

**Implication:** Loop-mode adaptation must preserve the standalone `## Verification Complete` block consumed by execute-phase.md (verify_phase_goal step) and quick.md. Adding a `mode: loop|standalone` flag is additive only — no removal of existing return fields.

### gsd-debugger

- **Direct spawn sites (Task() invocations):**
  - .claude/commands/gsd2/debug.md
  - .claude/get-shit-done/templates/debug-subagent-prompt.md
  - .claude/get-shit-done/workflows/diagnose-issues.md
- **Other references (prompts, docs, model profiles):**
  - .claude/get-shit-done/bin/lib/model-profiles.cjs
  - .claude/get-shit-done/references/model-profiles.md
  - .claude/get-shit-done/workflows/execute-phase.md

**Implication:** The `goal: find_root_cause_only` mode flag is already present and consumed by diagnose-issues.md and debug.md. Loop-mode adapter must use this existing flag rather than introducing a new mode, so existing callers see no change.

### gsd-fixer

- **Direct spawn sites (Task() invocations):**
  - .claude/commands/gsd2/fix.md
- **Other references (prompts, docs, model profiles):**
  - .claude/get-shit-done/bin/lib/model-profiles.cjs

**Implication:** Today the only spawn site is /gsd2:fix. Loop-mode extension of the `## FIXES COMPLETE` block (e.g. adding `loop_iteration: N`) must keep the existing fields intact so fix.md's parser remains happy.

### Cross-cutting risk: model-profiles registry

All three agents are listed in `.claude/get-shit-done/bin/lib/model-profiles.cjs` and the human-readable companion `.claude/get-shit-done/references/model-profiles.md`. If 04-03 introduces new agent variants (e.g. a separate `gsd-loop-verifier`), both files must be updated. If it adapts the existing agents in-place (preferred), no change is needed here.

