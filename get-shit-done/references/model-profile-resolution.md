# Model Profile Resolution

Resolve model profile once at the start of orchestration, then use it for all Task spawns.

## Resolution Pattern

Use `gsd-tools resolve-model` — it handles profile lookup, per-agent `model_overrides`, non-Claude runtime detection, and optional alias-to-ID mapping in one call:

```bash
PLANNER_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-planner --raw)
```

Default: `balanced` profile if not set or config missing.

## Lookup Table

@~/.claude/get-shit-done/references/model-profiles.md

Look up the agent in the table for the resolved profile. Pass the model parameter to Task calls:

```
Task(
  prompt="...",
  subagent_type="gsd-planner",
  model="{resolved_model}"  # e.g. "fable", "opus", "sonnet", "haiku", or "inherit"
)
```

**Note:** Per-agent `model_overrides` in `.planning/config.json` take precedence over the profile and pass through verbatim — any alias the runtime accepts is valid (e.g. `fable` on Claude Code).

If `model_profile` is `"inherit"`, all agents resolve to `"inherit"` (useful for runtimes with live model switching, e.g. OpenCode `/model`). Non-Claude runtimes force `"inherit"` automatically.

## Usage

1. Resolve once at orchestration start (one `resolve-model` call per agent type)
2. Store the resolved values
3. Pass the model parameter to each Task call (values: `"fable"`, `"opus"`, `"sonnet"`, `"haiku"`, `"inherit"`)
