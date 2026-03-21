# GSD Command Reference

> Complete command syntax, flags, options, and examples. For feature details, see [Feature Reference](FEATURES.md). For workflow walkthroughs, see [User Guide](USER-GUIDE.md).

---

## Command Syntax

- **Claude Code / Gemini / Copilot:** `/gsd2:command-name [args]`
- **OpenCode:** `/gsd-command-name [args]`
- **Codex:** `$gsd-command-name [args]`

---

## Core Workflow Commands

### `/gsd2:new-project`

Initialize a new project with deep context gathering.

| Flag | Description |
|------|-------------|
| `--auto @file.md` | Auto-extract from document, skip interactive questions |

**Prerequisites:** No existing `.planning/PROJECT.md`
**Produces:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `research/`, `CLAUDE.md`

```bash
/gsd2:new-project                    # Interactive mode
/gsd2:new-project --auto @prd.md     # Auto-extract from PRD
```

---

### `/gsd2:discuss-phase`

Capture implementation decisions before planning.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to current phase) |

| Flag | Description |
|------|-------------|
| `--auto` | Auto-select recommended defaults for all questions |
| `--batch` | Group questions for batch intake instead of one-by-one |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** `{phase}-CONTEXT.md`

```bash
/gsd2:discuss-phase 1                # Interactive discussion for phase 1
/gsd2:discuss-phase 3 --auto         # Auto-select defaults for phase 3
/gsd2:discuss-phase --batch          # Batch mode for current phase
```

---

### `/gsd2:ui-phase`

Generate UI design contract for frontend phases.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to current phase) |

**Prerequisites:** `.planning/ROADMAP.md` exists, phase has frontend/UI work
**Produces:** `{phase}-UI-SPEC.md`

```bash
/gsd2:ui-phase 2                     # Design contract for phase 2
```

---

### `/gsd2:plan-phase`

Research, plan, and verify a phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to next unplanned phase) |

| Flag | Description |
|------|-------------|
| `--auto` | Skip interactive confirmations |
| `--skip-research` | Skip domain research step |
| `--skip-verify` | Skip plan checker verification loop |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`, `{phase}-VALIDATION.md`

```bash
/gsd2:plan-phase 1                   # Research + plan + verify phase 1
/gsd2:plan-phase 3 --skip-research   # Plan without research (familiar domain)
/gsd2:plan-phase --auto              # Non-interactive planning
```

---

### `/gsd2:execute-phase`

Execute all plans in a phase with wave-based parallelization.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | **Yes** | Phase number to execute |

**Prerequisites:** Phase has PLAN.md files
**Produces:** `{phase}-{N}-SUMMARY.md`, `{phase}-VERIFICATION.md`, git commits

```bash
/gsd2:execute-phase 1                # Execute phase 1
```

---

### `/gsd2:verify-work`

User acceptance testing with auto-diagnosis.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to last executed phase) |

**Prerequisites:** Phase has been executed
**Produces:** `{phase}-UAT.md`, fix plans if issues found

```bash
/gsd2:verify-work 1                  # UAT for phase 1
```

---

### `/gsd2:next`

Automatically advance to the next logical workflow step. Reads project state and runs the appropriate command.

**Prerequisites:** `.planning/` directory exists
**Behavior:**
- No project → suggests `/gsd2:new-project`
- Phase needs discussion → runs `/gsd2:discuss-phase`
- Phase needs planning → runs `/gsd2:plan-phase`
- Phase needs execution → runs `/gsd2:execute-phase`
- Phase needs verification → runs `/gsd2:verify-work`
- All phases complete → suggests `/gsd2:complete-milestone`

```bash
/gsd2:next                           # Auto-detect and run next step
```

---

### `/gsd2:session-report`

Generate a session report with work summary, outcomes, and estimated resource usage.

**Prerequisites:** Active project with recent work
**Produces:** `.planning/reports/SESSION_REPORT.md`

```bash
/gsd2:session-report                 # Generate post-session summary
```

**Report includes:**
- Work performed (commits, plans executed, phases progressed)
- Outcomes and deliverables
- Blockers and decisions made
- Estimated token/cost usage
- Next steps recommendation

---

### `/gsd2:ship`

Create PR from completed phase work with auto-generated body.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number or milestone version (e.g., `4` or `v1.0`) |
| `--draft` | No | Create as draft PR |

**Prerequisites:** Phase verified (`/gsd2:verify-work` passed), `gh` CLI installed and authenticated
**Produces:** GitHub PR with rich body from planning artifacts, STATE.md updated

```bash
/gsd2:ship 4                         # Ship phase 4
/gsd2:ship 4 --draft                 # Ship as draft PR
```

**PR body includes:**
- Phase goal from ROADMAP.md
- Changes summary from SUMMARY.md files
- Requirements addressed (REQ-IDs)
- Verification status
- Key decisions

---

### `/gsd2:ui-review`

Retroactive 6-pillar visual audit of implemented frontend.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to last executed phase) |

**Prerequisites:** Project has frontend code (works standalone, no GSD project needed)
**Produces:** `{phase}-UI-REVIEW.md`, screenshots in `.planning/ui-reviews/`

```bash
/gsd2:ui-review                      # Audit current phase
/gsd2:ui-review 3                    # Audit phase 3
```

---

### `/gsd2:audit-uat`

Cross-phase audit of all outstanding UAT and verification items.

**Prerequisites:** At least one phase has been executed with UAT or verification
**Produces:** Categorized audit report with human test plan

```bash
/gsd2:audit-uat
```

---

### `/gsd2:audit-milestone`

Verify milestone met its definition of done.

**Prerequisites:** All phases executed
**Produces:** Audit report with gap analysis

```bash
/gsd2:audit-milestone
```

---

### `/gsd2:complete-milestone`

Archive milestone, tag release.

**Prerequisites:** Milestone audit complete (recommended)
**Produces:** `MILESTONES.md` entry, git tag

```bash
/gsd2:complete-milestone
```

---

### `/gsd2:new-milestone`

Start next version cycle.

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | No | Milestone name |
| `--reset-phase-numbers` | No | Restart the new milestone at Phase 1 and archive old phase dirs before roadmapping |

**Prerequisites:** Previous milestone completed
**Produces:** Updated `PROJECT.md`, new `REQUIREMENTS.md`, new `ROADMAP.md`

```bash
/gsd2:new-milestone                  # Interactive
/gsd2:new-milestone "v2.0 Mobile"    # Named milestone
/gsd2:new-milestone --reset-phase-numbers "v2.0 Mobile"  # Restart milestone numbering at 1
```

---

## Phase Management Commands

### `/gsd2:add-phase`

Append new phase to roadmap.

```bash
/gsd2:add-phase                      # Interactive — describe the phase
```

### `/gsd2:insert-phase`

Insert urgent work between phases using decimal numbering.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Insert after this phase number |

```bash
/gsd2:insert-phase 3                 # Insert between phase 3 and 4 → creates 3.1
```

### `/gsd2:remove-phase`

Remove future phase and renumber subsequent phases.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number to remove |

```bash
/gsd2:remove-phase 7                 # Remove phase 7, renumber 8→7, 9→8, etc.
```

### `/gsd2:list-phase-assumptions`

Preview Claude's intended approach before planning.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd2:list-phase-assumptions 2       # See assumptions for phase 2
```

### `/gsd2:plan-milestone-gaps`

Create phases to close gaps from milestone audit.

```bash
/gsd2:plan-milestone-gaps             # Creates phases for each audit gap
```

### `/gsd2:research-phase`

Deep ecosystem research only (standalone — usually use `/gsd2:plan-phase` instead).

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd2:research-phase 4               # Research phase 4 domain
```

### `/gsd2:validate-phase`

Retroactively audit and fill Nyquist validation gaps.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd2:validate-phase 2               # Audit test coverage for phase 2
```

---

## Navigation Commands

### `/gsd2:progress`

Show status and next steps.

```bash
/gsd2:progress                       # "Where am I? What's next?"
```

### `/gsd2:resume-work`

Restore full context from last session.

```bash
/gsd2:resume-work                    # After context reset or new session
```

### `/gsd2:pause-work`

Save context handoff when stopping mid-phase.

```bash
/gsd2:pause-work                     # Creates continue-here.md
```

### `/gsd2:help`

Show all commands and usage guide.

```bash
/gsd2:help                           # Quick reference
```

---

## Utility Commands

### `/gsd2:quick`

Execute ad-hoc task with GSD guarantees.

| Flag | Description |
|------|-------------|
| `--full` | Enable plan checking (2 iterations) + post-execution verification |
| `--discuss` | Lightweight pre-planning discussion |
| `--research` | Spawn focused researcher before planning |

Flags are composable.

```bash
/gsd2:quick                          # Basic quick task
/gsd2:quick --discuss --research     # Discussion + research + planning
/gsd2:quick --full                   # With plan checking and verification
/gsd2:quick --discuss --research --full  # All optional stages
```

### `/gsd2:autonomous`

Run all remaining phases autonomously.

| Flag | Description |
|------|-------------|
| `--from N` | Start from a specific phase number |

```bash
/gsd2:autonomous                     # Run all remaining phases
/gsd2:autonomous --from 3            # Start from phase 3
```

### `/gsd2:do`

Route freeform text to the right GSD command.

```bash
/gsd2:do                             # Then describe what you want
```

### `/gsd2:note`

Zero-friction idea capture — append, list, or promote notes to todos.

| Argument | Required | Description |
|----------|----------|-------------|
| `text` | No | Note text to capture (default: append mode) |
| `list` | No | List all notes from project and global scopes |
| `promote N` | No | Convert note N into a structured todo |

| Flag | Description |
|------|-------------|
| `--global` | Use global scope for note operations |

```bash
/gsd2:note "Consider caching strategy for API responses"
/gsd2:note list
/gsd2:note promote 3
```

### `/gsd2:debug`

Systematic debugging with persistent state.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Description of the bug |

```bash
/gsd2:debug "Login button not responding on mobile Safari"
```

### `/gsd2:add-todo`

Capture idea or task for later.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Todo description |

```bash
/gsd2:add-todo "Consider adding dark mode support"
```

### `/gsd2:check-todos`

List pending todos and select one to work on.

```bash
/gsd2:check-todos
```

### `/gsd2:add-tests`

Generate tests for a completed phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd2:add-tests 2                    # Generate tests for phase 2
```

### `/gsd2:stats`

Display project statistics.

```bash
/gsd2:stats                          # Project metrics dashboard
```

### `/gsd2:profile-user`

Generate a developer behavioral profile from Claude Code session analysis across 8 dimensions (communication style, decision patterns, debugging approach, UX preferences, vendor choices, frustration triggers, learning style, explanation depth). Produces artifacts that personalize Claude's responses.

| Flag | Description |
|------|-------------|
| `--questionnaire` | Use interactive questionnaire instead of session analysis |
| `--refresh` | Re-analyze sessions and regenerate profile |

**Generated artifacts:**
- `USER-PROFILE.md` — Full behavioral profile
- `/gsd2:dev-preferences` command — Load preferences in any session
- `CLAUDE.md` profile section — Auto-discovered by Claude Code

```bash
/gsd2:profile-user                   # Analyze sessions and build profile
/gsd2:profile-user --questionnaire   # Interactive questionnaire fallback
/gsd2:profile-user --refresh         # Re-generate from fresh analysis
```

### `/gsd2:health`

Validate `.planning/` directory integrity.

| Flag | Description |
|------|-------------|
| `--repair` | Auto-fix recoverable issues |

```bash
/gsd2:health                         # Check integrity
/gsd2:health --repair                # Check and fix
```

### `/gsd2:cleanup`

Archive accumulated phase directories from completed milestones.

```bash
/gsd2:cleanup
```

---

## Configuration Commands

### `/gsd2:settings`

Interactive configuration of workflow toggles and model profile.

```bash
/gsd2:settings                       # Interactive config
```

### `/gsd2:set-profile`

Quick profile switch.

| Argument | Required | Description |
|----------|----------|-------------|
| `profile` | **Yes** | `quality`, `balanced`, `budget`, or `inherit` |

```bash
/gsd2:set-profile budget             # Switch to budget profile
/gsd2:set-profile quality            # Switch to quality profile
```

---

## Brownfield Commands

### `/gsd2:map-codebase`

Analyze existing codebase with parallel mapper agents.

| Argument | Required | Description |
|----------|----------|-------------|
| `area` | No | Scope mapping to a specific area |

```bash
/gsd2:map-codebase                   # Full codebase analysis
/gsd2:map-codebase auth              # Focus on auth area
```

---

## Update Commands

### `/gsd2:update`

Update GSD with changelog preview.

```bash
/gsd2:update                         # Check for updates and install
```

### `/gsd2:reapply-patches`

Restore local modifications after a GSD update.

```bash
/gsd2:reapply-patches                # Merge back local changes
```

---

## Community Commands

### `/gsd2:join-discord`

Open Discord community invite.

```bash
/gsd2:join-discord
```
