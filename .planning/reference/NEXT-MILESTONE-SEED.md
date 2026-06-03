# GSD2 v1.5 — Kickoff Seed (feed into `/gsd2:new-milestone` or `/gsd2:plant-seed`)

> A short intent capture, NOT a plan. The real plan comes out of GSD's
> discuss → plan → execute loop. Nothing below is adopted blindly — each item
> goes through the normal phase process.

## Goal

Keep the fork's strengths (rewritten prompts, conversation-first discussion,
signal strength, cross-phase pollination) and close its main gap: **execution
detail / dedicated capabilities** — by selectively porting proven pieces from
`gsd-core`, each one properly discussed and verified, not copied wholesale.

## Guiding principle

> Adopt by *understanding*, not by *copying*. For every candidate capability:
> discuss what it's for in *our* context → decide what to keep/drop → plan →
> execute → verify. The comparison analysis (`analysis/COMPARISON.md`) is the input.

## Candidate phases (to refine in discuss/plan)

1. **Security hooks (cheapest, highest-confidence — likely Phase 1).**
   Port the 4 self-contained guard hooks from core (no TS/build/core-lib deps):
   `prompt-guard`, `read-injection-scanner`, `read-guard`, `worktree-path-guard`.
   Work = copy into `hooks/`, add to `build-hooks.js`, register in `install.js`
   settings wiring, adapt `gsd2:` namespace + a config gate. Decide on-by-default
   vs opt-in, and soft (advisory) vs hard-block per hook.

2. **Research-agent roster (the gap you named).**
   Today `gsd-agent-researcher` = *AI-agent spec authoring* (narrow). Core has a
   general `gsd-ai-researcher` / `gsd-domain-researcher` for broad technical/domain
   research. Add a general researcher distinct from the agent-spec one, wired into
   discuss/plan, so technical questions get researched — not guessed.

3. **Execution-detail enrichment.**
   Where mine's execute-phase is thin vs core: candidates are core's
   plan-review stall-detection (idea #4), context-budget/utilization classifier
   (idea #2 — core has the *finished* version), and the anti-pattern / bug-pattern
   reference docs (idea #3, pure prose, add Python). Pick a subset; don't boil the ocean.

4. **(Backlog, not this milestone)** graphify/bug-feature graph (idea #1 — schema
   needs rework), skills system, workstreams. Park in backlog via `/gsd2:add-backlog`.

## Dev / git loop

- Develop **inside `mine/`** (the git repo; `.planning/` tracked, `.claude/` ignored).
- Drive with GSD slash commands; GSD tracks work in `mine/.planning/` (new milestone v1.5).
- After each phase: commit; push to `origin/main` (or a feature branch) when ready.
- Source of ported features: `core/` clone (read-only reference) + `analysis/`.

## First command to run

`/gsd2:new-milestone` (v1.4 is complete) — paste this seed as the milestone intent,
then `/gsd2:discuss-phase 1` to start on the security hooks.
