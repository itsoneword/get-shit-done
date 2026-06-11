# Model Profiles

Model profiles control which Claude model each GSD agent uses. This allows balancing quality vs token spend, or inheriting the currently selected session model.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` | `inherit` |
|-------|-----------|------------|----------|-----------|
| gsd-planner | opus | opus | sonnet | inherit |
| gsd-roadmapper | opus | sonnet | sonnet | inherit |
| gsd-executor | opus | sonnet | sonnet | inherit |
| gsd-phase-researcher | opus | sonnet | haiku | inherit |
| gsd-project-researcher | opus | sonnet | haiku | inherit |
| gsd-research-synthesizer | sonnet | sonnet | haiku | inherit |
| gsd-debugger | opus | sonnet | sonnet | inherit |
| gsd-codebase-mapper | sonnet | haiku | haiku | inherit |
| gsd-document-mapper | sonnet | sonnet | haiku | inherit |
| gsd-document-updater | sonnet | sonnet | haiku | inherit |
| gsd-verifier | sonnet | sonnet | haiku | inherit |
| gsd-plan-checker | sonnet | sonnet | haiku | inherit |
| gsd-integration-checker | sonnet | sonnet | haiku | inherit |
| gsd-nyquist-auditor | sonnet | sonnet | haiku | inherit |
| gsd-ui-researcher | opus | sonnet | haiku | inherit |
| gsd-ui-checker | sonnet | sonnet | haiku | inherit |
| gsd-ui-auditor | sonnet | sonnet | haiku | inherit |
| gsd-agent-researcher | opus | sonnet | haiku | inherit |
| gsd-agent-checker | sonnet | sonnet | haiku | inherit |

## Profile Philosophy

**quality** - Maximum reasoning power
- Opus for all decision-making agents
- Sonnet for read-only verification
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation
- Opus only for planning (where architecture decisions happen)
- Sonnet for execution and research (follows explicit instructions)
- Sonnet for verification (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal Opus usage
- Sonnet for anything that writes code
- Haiku for research and verification
- Use when: conserving quota, high-volume work, less critical phases

**inherit** - Follow the current session model
- All agents resolve to `inherit`
- Best when you switch models interactively (for example OpenCode `/model`)
- **Required when using non-Anthropic providers** (OpenRouter, local models, etc.) — otherwise GSD may call Anthropic models directly, incurring unexpected costs
- Use when: you want GSD to follow your currently selected runtime model

## Using Non-Anthropic Models (OpenRouter, Local, etc.)

**Non-Claude runtimes (Codex, Gemini, etc.):** GSD automatically forces `inherit` — no manual configuration needed.

**Claude Code with OpenRouter or local models:** Set the `inherit` profile manually to prevent GSD from calling Anthropic models for subagents:

```bash
# Via settings command
/gsd2:settings
# → Select "Inherit" for model profile

# Or manually in .planning/config.json
{
  "model_profile": "inherit"
}
```

Without `inherit`, GSD's default `balanced` profile spawns specific Anthropic models (`opus`, `sonnet`, `haiku`) for each agent type, which can result in additional API costs through your non-Anthropic provider.

## Automatic Runtime Detection

GSD auto-detects non-Claude runtimes (Codex, Gemini, Copilot, Cursor, Antigravity) based on the installation path. When running inside a non-Claude runtime, all agents automatically resolve to `inherit` — regardless of the configured profile. This prevents Claude-specific model aliases (`sonnet`, `opus`, `haiku`) from being passed to runtimes that don't understand them.

Per-agent overrides in `model_overrides` still take effect, so you can pin specific model names if your runtime supports it.

## Resolution Logic

Orchestrators resolve model before spawning:

```
1. Detect runtime from installation path
2. If non-Claude runtime → return 'inherit' (skip profile lookup)
3. Read .planning/config.json
4. Check model_overrides for agent-specific override
5. If no override, look up agent in profile table
6. Pass model parameter to Task call
```

## Per-Agent Overrides

Override specific agents without changing the entire profile:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

Overrides take precedence over the profile and are passed through to the Task call verbatim — any model alias the runtime accepts works. Common values: `fable`, `opus`, `sonnet`, `haiku`, `inherit`.

`fable` (Claude Fable 5) is not part of any profile tier — it costs ~2× Opus per token and uses a tokenizer that produces ~30% more tokens for the same content. Reserve it via override for low-volume, high-leverage agents (e.g. `gsd-planner`, `gsd-roadmapper`) where decisions cascade into everything downstream. Avoid it for agents that fan out in parallel or run inside automatic loops (`gsd-executor`, `gsd-debugger`).

## Switching Profiles

Runtime: `/gsd2:set-profile <profile>`

Per-project default: Set in `.planning/config.json`:
```json
{
  "model_profile": "balanced"
}
```

## Design Rationale

**Why Opus for gsd-planner?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why Sonnet for gsd-executor?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why Sonnet (not Haiku) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. Sonnet handles this well; Haiku may miss subtle gaps.

**Why Haiku for gsd-codebase-mapper?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.

**How aliases resolve**
Profile lookup returns the bare alias (`opus`, `sonnet`, `haiku`) and passes it to the Task call. The runtime (Claude Code) resolves the alias to its current model version, so GSD never pins a specific dated model ID. Set `resolve_model_ids: true` in config only if your runtime rejects bare aliases — that maps aliases through `MODEL_ALIAS_MAP` in `core.cjs`, which must be kept current with each release.

**Why `inherit` profile?**
Some runtimes (including OpenCode) let users switch models at runtime (`/model`). The `inherit` profile keeps all GSD subagents aligned to that live selection.
