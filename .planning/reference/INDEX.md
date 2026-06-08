# Reference material — gsd2 vs gsd-core (for v1.5 work)

These docs were produced 2026-06-03 comparing this fork against `gsd-core`, to guide
the v1.5 enhancement milestone. They are reference only — the real plan comes from
GSD's discuss → plan → execute loop.

- **COMPARISON.md** — full gsd2-vs-gsd-core analysis (workflow, agents/commands/hooks/
  skills inventory + overlap, node layer, porting candidates). Cite during discuss/plan.
- **IDEAS.md** — the user's parked enhancement ideas (graph links, convergence loop,
  good-practices, prune, etc.).
- **CODE-EXAMPLES.md** — curated note on replacing synthetic examples with validated
  handwritten OSS code sources for future references / skill-improvement work.
- **NEXT-MILESTONE-SEED.md** — kickoff intent for v1.5 (feed to `/gsd2:new-milestone`).

## Live source clones (read-only reference, OUTSIDE this repo)

- gsd-core clone: `/home/cleversol/gsd2/core/` — the source of features we may port
  (e.g. security hooks at `core/hooks/gsd-{prompt-guard,read-injection-scanner,read-guard,worktree-path-guard}.js`).
- this repo's sibling parent workspace: `/home/cleversol/gsd2/` (holds `analysis/`).

A GSD session rooted in this repo can read those paths directly when pointed at them.
