---
created: 2026-03-21T19:21:56.519Z
title: Investigate haiku mapper agents failing to write files
area: tooling
files:
  - agents/gsd-codebase-mapper.md
  - get-shit-done/bin/lib/config.cjs
  - get-shit-done/workflows/map-codebase.md
---

## Problem

During `/gsd2:map-codebase`, 4 parallel `gsd-codebase-mapper` agents were spawned with `model=haiku`. All 4 agents explored the codebase successfully (grep, read, bash calls all worked) but none called the Write tool to create the output documents in `.planning/codebase/`. The agents appeared to complete without error, but the directory was empty.

On retry with `model=sonnet`, all 4 agents wrote their documents successfully on the first attempt.

The agent output logs showed haiku agents were still exploring (reading files, grepping) when they completed — suggesting they ran out of token budget before reaching the Write step.

## Solution

Investigate:
1. **Token budget**: Are haiku agents hitting output token limits before reaching the Write step? The mapper agent prompt + templates are substantial.
2. **Prompt complexity**: The `gsd-codebase-mapper.md` agent definition includes detailed templates and guidelines (~180 lines). May need a simplified version for haiku.
3. **Config default**: `mapper_model` defaults to `haiku` in config. Consider defaulting to `sonnet` or adding a minimum model capability check.
4. **Graceful fallback**: The orchestrator should detect empty output and auto-retry with a more capable model rather than requiring manual intervention.
