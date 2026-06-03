# GSD2 — Enhancement Ideas (parking lot)

Captured 2026-06-03. These are the user's own ideas for future development of the
fork, saved verbatim-ish for later discussion. Not scoped or committed yet.

1. **Graph-based links for bugs / features.**
   Enhance with graph-based links (lvl 1, 2, 3) between bugs and features.
   _(cf. core's `graphify` command + `gsd-graphify-*` hooks — porting candidate.)_

2. **Versioning / context-usage for progress.**
   Check the recent change and whether the work on versioning / reducing context
   usage for progress tracking was actually finished.

3. **Good-practices enforcement.**
   Check if "good practices" guidance exists (what good code looks like, logging,
   modules, structure, etc.). Add this for Python if it isn't there.

4. **Plan / researcher convergence loop.**
   Add a loop for the planner / researcher on complex tasks, iterating before
   human validation. _(cf. core's `plan-review-convergence` + `revision-loop` — porting candidate.)_

5. **Prune unused commands / agents.**
   Get rid of commands/agents that aren't used, to make the system easier to
   understand.

6. **Compare with newest gsd-core and gsd-pi.**
   Compare with the newest gsd-core and "gsd-pi" — they reportedly have code
   examples and a different harness that could be beneficial.

---
_See `COMPARISON.md` (this folder) for the gsd2-vs-gsd-core analysis these ideas relate to._
