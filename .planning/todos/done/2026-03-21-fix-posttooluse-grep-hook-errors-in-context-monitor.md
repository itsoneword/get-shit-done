---
created: 2026-03-21T19:53:51.850Z
title: Fix PostToolUse Grep hook errors in context monitor
area: tooling
files:
  - hooks/gsd-context-monitor.js
---

## Problem

`hooks/gsd-context-monitor.js` throws errors on PostToolUse for Grep tool calls. The error appears as "PostToolUse:Grep hook error" in the user-visible output. It occurs consistently across both orchestrator and sub-agent contexts — every Grep call triggers it.

Doesn't block execution (tool results still return correctly), but produces noisy error output that the user sees after every Grep invocation.

## Solution

Investigate `hooks/gsd-context-monitor.js` — likely the hook expects a specific input shape from PostToolUse events that Grep doesn't match (e.g., missing `file_path` field, different result structure than Read/Write/Bash). May need a guard clause or Grep-specific handling in the hook.
