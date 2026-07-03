# Subsystem: Templates & References

**Updated:** 2026-04-17 by /gsd2:document (full run)
**Sources:** `get-shit-done/templates/*.md`, `get-shit-done/references/*.md`, `.planning/codebase/STRUCTURE.md:61-78`

## Shape

```mermaid
flowchart LR
    subgraph Templates [Templates — filled once per artifact]
        TplProject[project.md]
        TplState[state.md]
        TplRoadmap[roadmap.md]
        TplUAT[UAT.md]
        TplVal[VALIDATION.md]
        TplSumStd[summary-standard.md]
        TplSumMin[summary-minimal.md]
        TplSumCpx[summary-complex.md]
        TplClaude[claude-md.md]
        TplEtc[+20 others]
    end
    subgraph References [References — read-only policy]
        RefProfiles[model-profiles.md]
        RefResolve[model-profile-resolution.md]
        RefUI[ui-brand.md]
        RefCont[continuation-format.md]
        RefVerify[verification-patterns.md]
        RefTdd[tdd.md]
        RefQuest[questioning.md]
        RefGit[git-integration.md]
        RefGitPlan[git-planning-commit.md]
        RefParse[phase-argument-parsing.md]
        RefDecimal[decimal-phase-calculation.md]
        RefCfg[planning-config.md]
        RefChk[checkpoints.md]
        RefPatterns[AGENTIC-PATTERNS.md]
        RefProfile[user-profiling.md]
    end
    Workflow[Workflow or Agent] -->|Read and fill manually| Templates
    Templates --> Artifact[Write filled artifact to disk]
    Workflow -->|@-include or Read| References
    Agent[Agent persona] -->|@-include| References
```

## How It Works

### Overview

The subsystem splits into two categories (source: `.planning/codebase/STRUCTURE.md:61-78`):

- **Templates** (`get-shit-done/templates/*.md`, 30 files) — document scaffolding filled once per artifact by agents reading the file and producing output manually.
- **References** (`get-shit-done/references/*.md`, 15 files) — read-only behavioral policy loaded by workflows and agents on every run via `@`-includes. Not filled; not mutated.

### Templates Inventory

Per directory listing:

| Template | Produces |
|---|---|
| `project.md` | PROJECT.md (project seed) |
| `state.md` | STATE.md (per-project state tracker) |
| `roadmap.md` | ROADMAP.md (milestone + phase breakdown) |
| `requirements.md` | REQUIREMENTS.md |
| `milestone.md`, `milestone-archive.md` | Milestone files |
| `discovery.md`, `discussion-log.md` | Discuss-phase artifacts |
| `research.md`, `research-project/` | Research scaffolds |
| `context.md`, `continue-here.md` | Context handoffs |
| `summary-minimal.md` / `summary-standard.md` / `summary-complex.md` | Phase SUMMARY.md variants selected by heuristic |
| `UAT.md`, `VALIDATION.md` | Verification artifacts |
| `verification-report.md` | Verifier output |
| `retrospective.md` | Milestone retrospective |
| `AGENT-SPEC.md` | Agent spec phase output |
| `TEST-SPEC.md` | Test designer output |
| `UI-SPEC.md` | UI researcher output |
| `DEBUG.md`, `debug-subagent-prompt.md`, `planner-subagent-prompt.md` | Inline subagent prompts |
| `user-profile.md`, `user-setup.md` | Profile artifacts |
| `claude-md.md` | User-project CLAUDE.md seed |
| `copilot-instructions.md` | Copilot instructions seed |
| `dev-preferences.md` | Dev preferences seed |
| `codebase/` | Codebase-map templates for `.planning/codebase/*` |
| `config.json` | Default GSD config |

### Template Selection

Templates are read directly by agents and workflows, which choose the summary-minimal/standard/complex variant and produce the filled output manually. (The dead programmatic-fill CLI module was removed 2026-07 — no runtime caller remained.)

### References Inventory

Per directory listing, all under `get-shit-done/references/`:

| Reference | Loaded by |
|---|---|
| `model-profiles.md` | workflows that resolve models; sync target of `model-profiles.cjs` |
| `model-profile-resolution.md` | `/gsd2:set-profile`, `resolve-model` |
| `AGENTIC-PATTERNS.md` | most agents, as policy |
| `checkpoints.md` | `gsd-executor` |
| `continuation-format.md` | long-running agents |
| `decimal-phase-calculation.md` | `/gsd2:insert-phase`, `phase next-decimal` |
| `git-integration.md`, `git-planning-commit.md` | all workflows that commit |
| `phase-argument-parsing.md` | workflows that take `--phase N` etc. |
| `planning-config.md` | workflows that read/write `.planning/config.json` |
| `questioning.md` | `/gsd2:discuss-phase`, `gsd-user-profiler` |
| `tdd.md` | `gsd-executor`, `gsd-test-designer` |
| `ui-brand.md` | `gsd-ui-researcher`, `gsd-ui-auditor`, `gsd-ui-checker` |
| `user-profiling.md` | `gsd-user-profiler`, `/gsd2:profile-user` |
| `verification-patterns.md` | `gsd-verifier`, `gsd-nyquist-auditor`, `/gsd2:verify-work` |

### Key Distinction

Templates produce a filled output file exactly once per artifact. References are read-only context loaded into the model's working memory every time the loader invokes them. Conflating the two leaks mutable artifacts into the policy layer.

## Interfaces

### Inputs (Templates)

- `@get-shit-done/templates/<name>.md` — read directly by the agent or workflow that fills it

### Outputs (Templates)

- A written file at the orchestrator's chosen path
- Filled Markdown body with frontmatter updated

### Inputs (References)

- `@get-shit-done/references/<name>.md` in a workflow or agent `required_reading` block — the file's content is injected into context

### Outputs (References)

- None — they are read-only. Changes to policy require editing the reference file itself.

## Related

- [[workflows]] — workflows `@`-include references and read/fill templates directly
- [[agents]] — agents load references (`AGENTIC-PATTERNS`, `questioning`, `verification-patterns`, `tdd`) as behavioral policy; `model-profiles.md` mirrors `model-profiles.cjs`
- [[installer]] — copies both directories to the runtime install location

## Gaps

See [[_gaps#templates-references]] for un-sourced behaviors.
