# GSD User Guide

A detailed reference for workflows, troubleshooting, and configuration. For quick-start setup, see the [README](../README.md).

---

## Table of Contents

- [Workflow Diagrams](#workflow-diagrams)
- [UI Design Contract](#ui-design-contract)
- [Command Reference](#command-reference)
- [Configuration Reference](#configuration-reference)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Recovery Quick Reference](#recovery-quick-reference)

---

## Workflow Diagrams

### Full Project Lifecycle

```
  ┌──────────────────────────────────────────────────┐
  │                   NEW PROJECT                    │
  │  /gsd2:new-project                                │
  │  Questions -> Research -> Requirements -> Roadmap│
  └─────────────────────────┬────────────────────────┘
                            │
             ┌──────────────▼─────────────┐
             │      FOR EACH PHASE:       │
             │                            │
             │  ┌────────────────────┐    │
             │  │ /gsd2:discuss-phase │    │  <- Lock in preferences
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd2:ui-phase      │    │  <- Design contract (frontend)
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd2:plan-phase    │    │  <- Research + Plan + Verify
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd2:execute-phase │    │  <- Parallel execution
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd2:verify-work   │    │  <- Manual UAT
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd2:ship          │    │  <- Create PR (optional)
             │  └──────────┬─────────┘    │
             │             │              │
             │     Next Phase?────────────┘
             │             │ No
             └─────────────┼──────────────┘
                            │
            ┌───────────────▼──────────────┐
            │  /gsd2:audit-milestone        │
            │  /gsd2:complete-milestone     │
            └───────────────┬──────────────┘
                            │
                   Another milestone?
                       │          │
                      Yes         No -> Done!
                       │
               ┌───────▼──────────────┐
               │  /gsd2:new-milestone  │
               └──────────────────────┘
```

### Planning Agent Coordination

```
  /gsd2:plan-phase N
         │
         ├── Phase Researcher (x4 parallel)
         │     ├── Stack researcher
         │     ├── Features researcher
         │     ├── Architecture researcher
         │     └── Pitfalls researcher
         │           │
         │     ┌──────▼──────┐
         │     │ RESEARCH.md │
         │     └──────┬──────┘
         │            │
         │     ┌──────▼──────┐
         │     │   Planner   │  <- Reads PROJECT.md, REQUIREMENTS.md,
         │     │             │     CONTEXT.md, RESEARCH.md
         │     └──────┬──────┘
         │            │
         │     ┌──────▼───────────┐     ┌────────┐
         │     │   Plan Checker   │────>│ PASS?  │
         │     └──────────────────┘     └───┬────┘
         │                                  │
         │                             Yes  │  No
         │                              │   │   │
         │                              │   └───┘  (loop, up to 3x)
         │                              │
         │                        ┌─────▼──────┐
         │                        │ PLAN files │
         │                        └────────────┘
         └── Done
```

### Validation Architecture (Nyquist Layer)

During plan-phase research, GSD now maps automated test coverage to each phase
requirement before any code is written. This ensures that when Claude's executor
commits a task, a feedback mechanism already exists to verify it within seconds.

The researcher detects your existing test infrastructure, maps each requirement to
a specific test command, and identifies any test scaffolding that must be created
before implementation begins (Wave 0 tasks).

The plan-checker enforces this as an 8th verification dimension: plans where tasks
lack automated verify commands will not be approved.

**Output:** `{phase}-VALIDATION.md` -- the feedback contract for the phase.

**Disable:** Set `workflow.nyquist_validation: false` in `/gsd2:settings` for
rapid prototyping phases where test infrastructure isn't the focus.

### Retroactive Validation (`/gsd2:validate-phase`)

For phases executed before Nyquist validation existed, or for existing codebases
with only traditional test suites, retroactively audit and fill coverage gaps:

```
  /gsd2:validate-phase N
         |
         +-- Detect state (VALIDATION.md exists? SUMMARY.md exists?)
         |
         +-- Discover: scan implementation, map requirements to tests
         |
         +-- Analyze gaps: which requirements lack automated verification?
         |
         +-- Present gap plan for approval
         |
         +-- Spawn auditor: generate tests, run, debug (max 3 attempts)
         |
         +-- Update VALIDATION.md
               |
               +-- COMPLIANT -> all requirements have automated checks
               +-- PARTIAL -> some gaps escalated to manual-only
```

The auditor never modifies implementation code — only test files and
VALIDATION.md. If a test reveals an implementation bug, it's flagged as an
escalation for you to address.

**When to use:** After executing phases that were planned before Nyquist was
enabled, or after `/gsd2:audit-milestone` surfaces Nyquist compliance gaps.

---

## UI Design Contract

### Why

AI-generated frontends are visually inconsistent not because Claude Code is bad at UI but because no design contract existed before execution. Five components built without a shared spacing scale, color contract, or copywriting standard produce five slightly different visual decisions.

`/gsd2:ui-phase` locks the design contract before planning. `/gsd2:ui-review` audits the result after execution.

### Commands

| Command | Description |
|---------|-------------|
| `/gsd2:ui-phase [N]` | Generate UI-SPEC.md design contract for a frontend phase |
| `/gsd2:ui-review [N]` | Retroactive 6-pillar visual audit of implemented UI |

### Workflow: `/gsd2:ui-phase`

**When to run:** After `/gsd2:discuss-phase`, before `/gsd2:plan-phase` — for phases with frontend/UI work.

**Flow:**
1. Reads CONTEXT.md, RESEARCH.md, REQUIREMENTS.md for existing decisions
2. Detects design system state (shadcn components.json, Tailwind config, existing tokens)
3. shadcn initialization gate — offers to initialize if React/Next.js/Vite project has none
4. Asks only unanswered design contract questions (spacing, typography, color, copywriting, registry safety)
5. Writes `{phase}-UI-SPEC.md` to phase directory
6. Validates against 6 dimensions (Copywriting, Visuals, Color, Typography, Spacing, Registry Safety)
7. Revision loop if BLOCKED (max 2 iterations)

**Output:** `{padded_phase}-UI-SPEC.md` in `.planning/phases/{phase-dir}/`

### Workflow: `/gsd2:ui-review`

**When to run:** After `/gsd2:execute-phase` or `/gsd2:verify-work` — for any project with frontend code.

**Standalone:** Works on any project, not just GSD-managed ones. If no UI-SPEC.md exists, audits against abstract 6-pillar standards.

**6 Pillars (scored 1-4 each):**
1. Copywriting — CTA labels, empty states, error states
2. Visuals — focal points, visual hierarchy, icon accessibility
3. Color — accent usage discipline, 60/30/10 compliance
4. Typography — font size/weight constraint adherence
5. Spacing — grid alignment, token consistency
6. Experience Design — loading/error/empty state coverage

**Output:** `{padded_phase}-UI-REVIEW.md` in phase directory with scores and top 3 priority fixes.

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `workflow.ui_phase` | `true` | Generate UI design contracts for frontend phases |
| `workflow.ui_safety_gate` | `true` | plan-phase prompts to run /gsd2:ui-phase for frontend phases |

Both follow the absent=enabled pattern. Disable via `/gsd2:settings`.

### shadcn Initialization

For React/Next.js/Vite projects, the UI researcher offers to initialize shadcn if no `components.json` is found. The flow:

1. Visit `ui.shadcn.com/create` and configure your preset
2. Copy the preset string
3. Run `npx shadcn init --preset {paste}`
4. Preset encodes the entire design system — colors, border radius, fonts

The preset string becomes a first-class GSD planning artifact, reproducible across phases and milestones.

### Registry Safety Gate

Third-party shadcn registries can inject arbitrary code. The safety gate requires:
- `npx shadcn view {component}` — inspect before installing
- `npx shadcn diff {component}` — compare against official

Controlled by `workflow.ui_safety_gate` config toggle.

### Screenshot Storage

`/gsd2:ui-review` captures screenshots via Playwright CLI to `.planning/ui-reviews/`. A `.gitignore` is created automatically to prevent binary files from reaching git. Screenshots are cleaned up during `/gsd2:complete-milestone`.

---

### Execution Wave Coordination

```
  /gsd2:execute-phase N
         │
         ├── Analyze plan dependencies
         │
         ├── Wave 1 (independent plans):
         │     ├── Executor A (fresh 200K context) -> commit
         │     └── Executor B (fresh 200K context) -> commit
         │
         ├── Wave 2 (depends on Wave 1):
         │     └── Executor C (fresh 200K context) -> commit
         │
         └── Verifier
               └── Check codebase against phase goals
                     │
                     ├── PASS -> VERIFICATION.md (success)
                     └── FAIL -> Issues logged for /gsd2:verify-work
```

### Brownfield Workflow (Existing Codebase)

```
  /gsd2:map-codebase
         │
         ├── Stack Mapper     -> codebase/STACK.md
         ├── Arch Mapper      -> codebase/ARCHITECTURE.md
         ├── Convention Mapper -> codebase/CONVENTIONS.md
         └── Concern Mapper   -> codebase/CONCERNS.md
                │
        ┌───────▼──────────┐
        │ /gsd2:new-project │  <- Questions focus on what you're ADDING
        └──────────────────┘
```

---

## Command Reference

### Core Workflow

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd2:new-project` | Full project init: questions, research, requirements, roadmap | Start of a new project |
| `/gsd2:new-project --auto @idea.md` | Automated init from document | Have a PRD or idea doc ready |
| `/gsd2:discuss-phase [N]` | Capture implementation decisions | Before planning, to shape how it gets built |
| `/gsd2:ui-phase [N]` | Generate UI design contract | After discuss-phase, before plan-phase (frontend phases) |
| `/gsd2:plan-phase [N]` | Research + plan + verify | Before executing a phase |
| `/gsd2:execute-phase <N>` | Execute all plans in parallel waves | After planning is complete |
| `/gsd2:verify-work [N]` | Manual UAT with auto-diagnosis | After execution completes |
| `/gsd2:ship [N]` | Create PR from verified work | After verification passes |
| `/gsd2:next` | Auto-detect state and run next step | Anytime — "what should I do next?" |
| `/gsd2:ui-review [N]` | Retroactive 6-pillar visual audit | After execution or verify-work (frontend projects) |
| `/gsd2:audit-milestone` | Verify milestone met its definition of done | Before completing milestone |
| `/gsd2:complete-milestone` | Archive milestone, tag release | All phases verified |
| `/gsd2:new-milestone [name]` | Start next version cycle | After completing a milestone |

### Navigation

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd2:progress` | Show status and next steps | Anytime -- "where am I?" |
| `/gsd2:resume-work` | Restore full context from last session | Starting a new session |
| `/gsd2:pause-work` | Save structured handoff (HANDOFF.json + continue-here.md) | Stopping mid-phase |
| `/gsd2:session-report` | Generate session summary with work and outcomes | End of session, stakeholder sharing |
| `/gsd2:help` | Show all commands | Quick reference |
| `/gsd2:update` | Update GSD with changelog preview | Check for new versions |
| `/gsd2:join-discord` | Open Discord community invite | Questions or community |

### Phase Management

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd2:add-phase` | Append new phase to roadmap | Scope grows after initial planning |
| `/gsd2:insert-phase [N]` | Insert urgent work (decimal numbering) | Urgent fix mid-milestone |
| `/gsd2:remove-phase [N]` | Remove future phase and renumber | Descoping a feature |
| `/gsd2:list-phase-assumptions [N]` | Preview Claude's intended approach | Before planning, to validate direction |
| `/gsd2:plan-milestone-gaps` | Create phases for audit gaps | After audit finds missing items |
| `/gsd2:research-phase [N]` | Deep ecosystem research only | Complex or unfamiliar domain |

### Brownfield & Utilities

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd2:map-codebase` | Analyze existing codebase | Before `/gsd2:new-project` on existing code |
| `/gsd2:fix [N] [issues]` | Fix issues with dependency awareness | Post-execution issues, regressions |
| `/gsd2:debug [desc]` | Systematic debugging with persistent state | When something breaks |
| `/gsd2:add-todo [desc]` | Capture an idea for later | Think of something during a session |
| `/gsd2:check-todos` | List pending todos | Review captured ideas |
| `/gsd2:settings` | Configure workflow toggles and model profile | Change model, toggle agents |
| `/gsd2:set-profile <profile>` | Quick profile switch | Change cost/quality tradeoff |
| `/gsd2:reapply-patches` | Restore local modifications after update | After `/gsd2:update` if you had local edits |

---

## Configuration Reference

GSD stores project settings in `.planning/config.json`. Configure during `/gsd2:new-project` or update later with `/gsd2:settings`.

### Full config.json Schema

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}",
    "fix_branch_template": null
  }
}
```

### Core Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `mode` | `interactive`, `yolo` | `interactive` | `yolo` auto-approves decisions; `interactive` confirms at each step |
| `granularity` | `coarse`, `standard`, `fine` | `standard` | Phase granularity: how finely scope is sliced (3-5, 5-8, or 8-12 phases) |
| `model_profile` | `quality`, `balanced`, `budget`, `inherit` | `balanced` | Model tier for each agent (see table below) |

### Planning Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `planning.commit_docs` | `true`, `false` | `true` | Whether `.planning/` files are committed to git |
| `planning.search_gitignored` | `true`, `false` | `false` | Add `--no-ignore` to broad searches to include `.planning/` |

> **Note:** If `.planning/` is in `.gitignore`, `commit_docs` is automatically `false` regardless of the config value.

### Workflow Toggles

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `workflow.research` | `true`, `false` | `true` | Domain investigation before planning |
| `workflow.plan_check` | `true`, `false` | `true` | Plan verification loop (up to 3 iterations) |
| `workflow.verifier` | `true`, `false` | `true` | Post-execution verification against phase goals |
| `workflow.nyquist_validation` | `true`, `false` | `true` | Validation architecture research during plan-phase; 8th plan-check dimension |
| `workflow.ui_phase` | `true`, `false` | `true` | Generate UI design contracts for frontend phases |
| `workflow.ui_safety_gate` | `true`, `false` | `true` | plan-phase prompts to run /gsd2:ui-phase for frontend phases |

Disable these to speed up phases in familiar domains or when conserving tokens.

### Git Branching

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | When and how branches are created |
| `git.phase_branch_template` | Template string | `gsd/phase-{phase}-{slug}` | Branch name for phase strategy |
| `git.milestone_branch_template` | Template string | `gsd/{milestone}-{slug}` | Branch name for milestone strategy |
| `git.fix_branch_template` | Template string or `null` | `null` | Optional branch name for `/gsd2:fix` tasks |

**Branching strategies explained:**

| Strategy | Creates Branch | Scope | Best For |
|----------|---------------|-------|----------|
| `none` | Never | N/A | Solo development, simple projects |
| `phase` | At each `execute-phase` | One phase per branch | Code review per phase, granular rollback |
| `milestone` | At first `execute-phase` | All phases share one branch | Release branches, PR per version |

**Template variables:** `{phase}` = zero-padded number (e.g., "03"), `{slug}` = lowercase hyphenated name, `{milestone}` = version (e.g., "v1.0").

Example fix-task branching:

```json
"git": {
  "fix_branch_template": "gsd/fix-{phase}-{slug}"
}
```

### Model Profiles (Per-Agent Breakdown)

| Agent | `quality` | `balanced` | `budget` | `inherit` |
|-------|-----------|------------|----------|-----------|
| gsd-planner | Opus | Opus | Sonnet | Inherit |
| gsd-roadmapper | Opus | Sonnet | Sonnet | Inherit |
| gsd-executor | Opus | Sonnet | Sonnet | Inherit |
| gsd-phase-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-project-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-research-synthesizer | Sonnet | Sonnet | Haiku | Inherit |
| gsd-debugger | Opus | Sonnet | Sonnet | Inherit |
| gsd-codebase-mapper | Sonnet | Haiku | Haiku | Inherit |
| gsd-verifier | Sonnet | Sonnet | Haiku | Inherit |
| gsd-plan-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-integration-checker | Sonnet | Sonnet | Haiku | Inherit |

**Profile philosophy:**
- **quality** -- Opus for all decision-making agents, Sonnet for read-only verification. Use when quota is available and the work is critical.
- **balanced** -- Opus only for planning (where architecture decisions happen), Sonnet for everything else. The default for good reason.
- **budget** -- Sonnet for anything that writes code, Haiku for research and verification. Use for high-volume work or less critical phases.
- **inherit** -- All agents use the current session model. Best when switching models dynamically (e.g. OpenCode `/model`), or **required** when using non-Anthropic providers (OpenRouter, local models) to avoid unexpected API costs.

---

## Usage Examples

### New Project (Full Cycle)

```bash
claude --dangerously-skip-permissions
/gsd2:new-project            # Answer questions, configure, approve roadmap
/clear
/gsd2:discuss-phase 1        # Lock in your preferences
/gsd2:ui-phase 1             # Design contract (frontend phases)
/gsd2:plan-phase 1           # Research + plan + verify
/gsd2:execute-phase 1        # Parallel execution
/gsd2:verify-work 1          # Manual UAT
/gsd2:ship 1                 # Create PR from verified work
/gsd2:ui-review 1            # Visual audit (frontend phases)
/clear
/gsd2:next                   # Auto-detect and run next step
...
/gsd2:audit-milestone        # Check everything shipped
/gsd2:complete-milestone     # Archive, tag, done
/gsd2:session-report         # Generate session summary
```

### New Project from Existing Document

```bash
/gsd2:new-project --auto @prd.md   # Auto-runs research/requirements/roadmap from your doc
/clear
/gsd2:discuss-phase 1               # Normal flow from here
```

### Existing Codebase

```bash
/gsd2:map-codebase           # Analyze what exists (parallel agents)
/gsd2:new-project            # Questions focus on what you're ADDING
# (normal phase workflow from here)
```

### Fixing Issues After Execution

```bash
/gsd2:fix 5 sidebar overlaps, save throws error
```

### Resuming After a Break

```bash
/gsd2:progress               # See where you left off and what's next
# or
/gsd2:resume-work            # Full context restoration from last session
```

### Preparing for Release

```bash
/gsd2:audit-milestone        # Check requirements coverage, detect stubs
/gsd2:plan-milestone-gaps    # If audit found gaps, create phases to close them
/gsd2:complete-milestone     # Archive, tag, done
```

### Speed vs Quality Presets

| Scenario | Mode | Granularity | Profile | Research | Plan Check | Verifier |
|----------|------|-------|---------|----------|------------|----------|
| Prototyping | `yolo` | `coarse` | `budget` | off | off | off |
| Normal dev | `interactive` | `standard` | `balanced` | on | on | on |
| Production | `interactive` | `fine` | `quality` | on | on | on |

### Mid-Milestone Scope Changes

```bash
/gsd2:add-phase              # Append a new phase to the roadmap
# or
/gsd2:insert-phase 3         # Insert urgent work between phases 3 and 4
# or
/gsd2:remove-phase 7         # Descope phase 7 and renumber
```

---

## Troubleshooting

### "Project already initialized"

You ran `/gsd2:new-project` but `.planning/PROJECT.md` already exists. This is a safety check. If you want to start over, delete the `.planning/` directory first.

### Context Degradation During Long Sessions

Clear your context window between major commands: `/clear` in Claude Code. GSD is designed around fresh contexts -- every subagent gets a clean 200K window. If quality is dropping in the main session, clear and use `/gsd2:resume-work` or `/gsd2:progress` to restore state.

### Plans Seem Wrong or Misaligned

Run `/gsd2:discuss-phase [N]` before planning. Most plan quality issues come from Claude making assumptions that `CONTEXT.md` would have prevented. You can also run `/gsd2:list-phase-assumptions [N]` to see what Claude intends to do before committing to a plan.

### Execution Fails or Produces Stubs

Check that the plan was not too ambitious. Plans should have 2-3 tasks maximum. If tasks are too large, they exceed what a single context window can produce reliably. Re-plan with smaller scope.

### Lost Track of Where You Are

Run `/gsd2:progress`. It reads all state files and tells you exactly where you are and what to do next.

### Need to Change Something After Execution

Do not re-run `/gsd2:execute-phase`. Use `/gsd2:fix` for targeted fixes with dependency awareness, or `/gsd2:verify-work` to systematically identify and fix issues through UAT.

### Model Costs Too High

Switch to budget profile: `/gsd2:set-profile budget`. Disable research and plan-check agents via `/gsd2:settings` if the domain is familiar to you (or to Claude).

### Using Non-Anthropic Models (OpenRouter, Local)

If GSD subagents call Anthropic models and you're paying through OpenRouter or a local provider, switch to the `inherit` profile: `/gsd2:set-profile inherit`. This makes all agents use your current session model instead of specific Anthropic models. See also `/gsd2:settings` → Model Profile → Inherit.

### Working on a Sensitive/Private Project

Set `commit_docs: false` during `/gsd2:new-project` or via `/gsd2:settings`. Add `.planning/` to your `.gitignore`. Planning artifacts stay local and never touch git.

### GSD Update Overwrote My Local Changes

Since v1.17, the installer backs up locally modified files to `gsd-local-patches/`. Run `/gsd2:reapply-patches` to merge your changes back.

### Subagent Appears to Fail but Work Was Done

A known workaround exists for a Claude Code classification bug. GSD's orchestrators (execute-phase) spot-check actual output before reporting failure. If you see a failure message but commits were made, check `git log` -- the work may have succeeded.

### Parallel Execution Causes Build Lock Errors

If you see pre-commit hook failures, cargo lock contention, or 30+ minute execution times during parallel wave execution, this is caused by multiple agents triggering build tools simultaneously. GSD handles this automatically since v1.26 — parallel agents use `--no-verify` on commits and the orchestrator runs hooks once after each wave. If you're on an older version, add this to your project's `CLAUDE.md`:

```markdown
## Git Commit Rules for Agents
All subagent/executor commits MUST use `--no-verify`.
```

To disable parallel execution entirely: `/gsd2:settings` → set `parallelization.enabled` to `false`.

### Windows: Installation Crashes on Protected Directories

If the installer crashes with `EPERM: operation not permitted, scandir` on Windows, this is caused by OS-protected directories (e.g., Chromium browser profiles). Fixed since v1.24 — update to the latest version. As a workaround, temporarily rename the problematic directory before running the installer.

---

## Recovery Quick Reference

| Problem | Solution |
|---------|----------|
| Lost context / new session | `/gsd2:resume-work` or `/gsd2:progress` |
| Phase went wrong | `git revert` the phase commits, then re-plan |
| Need to change scope | `/gsd2:add-phase`, `/gsd2:insert-phase`, or `/gsd2:remove-phase` |
| Milestone audit found gaps | `/gsd2:plan-milestone-gaps` |
| Something broke | `/gsd2:debug "description"` |
| Fix post-execution issues | `/gsd2:fix [N] [issues]` |
| Plan doesn't match your vision | `/gsd2:discuss-phase [N]` then re-plan |
| Costs running high | `/gsd2:set-profile budget` and `/gsd2:settings` to toggle agents off |
| Update broke local changes | `/gsd2:reapply-patches` |
| Want session summary for stakeholder | `/gsd2:session-report` |
| Don't know what step is next | `/gsd2:next` |
| Parallel execution build errors | Update GSD or set `parallelization.enabled: false` |

---

## Project File Structure

For reference, here is what GSD creates in your project:

```
.planning/
  PROJECT.md              # Project vision and context (always loaded)
  REQUIREMENTS.md         # Scoped v1/v2 requirements with IDs
  ROADMAP.md              # Phase breakdown with status tracking
  STATE.md                # Decisions, blockers, session memory
  config.json             # Workflow configuration
  MILESTONES.md           # Completed milestone archive
  HANDOFF.json            # Structured session handoff (from /gsd2:pause-work)
  research/               # Domain research from /gsd2:new-project
  reports/                # Session reports (from /gsd2:session-report)
  todos/
    pending/              # Captured ideas awaiting work
    done/                 # Completed todos
  debug/                  # Active debug sessions
    resolved/             # Archived debug sessions
  codebase/               # Brownfield codebase mapping (from /gsd2:map-codebase)
  phases/
    XX-phase-name/
      XX-YY-PLAN.md       # Atomic execution plans
      XX-YY-SUMMARY.md    # Execution outcomes and decisions
      CONTEXT.md          # Your implementation preferences
      RESEARCH.md         # Ecosystem research findings
      VERIFICATION.md     # Post-execution verification results
      XX-UI-SPEC.md       # UI design contract (from /gsd2:ui-phase)
      XX-UI-REVIEW.md     # Visual audit scores (from /gsd2:ui-review)
  ui-reviews/             # Screenshots from /gsd2:ui-review (gitignored)
```
