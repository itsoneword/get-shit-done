# Documentation

This project's documentation is **auto-generated and sourced**, not hand-written.
Run `/gsd2:document` to (re)generate it from the actual code, planning artifacts,
and git history. Every claim links back to its source, so the docs stay honest as
the code changes.

## Start here

- **[SYSTEM-MAP.md](SYSTEM-MAP.md)** — top-level overview: what GSD is, how the
  subsystems fit together, and a diagram of the main flow.

## Subsystems (`system/`)

Each file documents one subsystem in depth:

- **[system/installer.md](system/installer.md)** — cross-runtime npm installer (`bin/install.js`).
- **[system/tool-cli.md](system/tool-cli.md)** — `gsd-tools.cjs` CLI invoked by every workflow.
- **[system/agents.md](system/agents.md)** — the `gsd-*` agent personas and model resolution.
- **[system/workflows.md](system/workflows.md)** — workflow orchestration files and command stubs.
- **[system/templates-references.md](system/templates-references.md)** — document templates and read-only policy references.
- **[system/hooks.md](system/hooks.md)** — Claude Code lifecycle hooks.
- **[system/test-suite.md](system/test-suite.md)** — the installer test suite.
- **[system/_gaps.md](system/_gaps.md)** — behaviors that could not be sourced and warrant investigation.

## A note on the old docs

GSD previously shipped hand-written reference docs at `docs/*.md`
(`AGENTS.md`, `ARCHITECTURE.md`, `COMMANDS.md`, `USER-GUIDE.md`, …). Those drifted
out of sync with the code and have been **retired** in favor of the sourced
`system/` tree above. The upstream project (`gsd-core`) still carries that
hand-written set if you need it for reference.
