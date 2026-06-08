---
name: gsd2:add-backlog
description: Add an idea to the backlog parking lot (B-prefixed (B1, B2…) numbering)
argument-hint: <description>
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Add a backlog item to the roadmap using B-prefixed (B1, B2…) numbering. Backlog
items are unsequenced ideas that aren't ready for active planning — they live
outside the phase-number space and accumulate context over time. IDs are
allocated by `next-backlog-id` and only receive a real phase number when
promoted into a milestone.
</objective>

<process>

1. **Read ROADMAP.md** to find existing backlog entries:
   ```bash
   cat .planning/ROADMAP.md
   ```

2. **Find next backlog number:**
   ```bash
   NEXT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase next-backlog-id --raw)
   ```
   If no B* backlog dirs exist, starts at B1.

3. **Create the phase directory** (resolves to partitioned `.planning/{milestone}/phases/` when STATE.md has a milestone, else `.planning/phases/` legacy fallback):
   ```bash
   SLUG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-slug "$ARGUMENTS")
   PARTITION_ROOT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init milestone-op --raw 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.partition_root||'.planning')}catch{process.stdout.write('.planning')}}")
   mkdir -p "${PARTITION_ROOT}/phases/${NEXT}-${SLUG}"
   touch "${PARTITION_ROOT}/phases/${NEXT}-${SLUG}/.gitkeep"
   ```

4. **Add to ROADMAP.md** under a `## Backlog` section. If the section doesn't exist, create it at the end:

   ```markdown
   ## Backlog

   ### {NEXT}: {description} (BACKLOG)

   **Goal:** [Captured for future planning]
   **Requirements:** TBD
   **Plans:** 0 plans

   Plans:
   - [ ] TBD (promote with /gsd2:review-backlog when ready)
   ```

5. **Commit:**
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: add backlog item ${NEXT} — ${ARGUMENTS}" --files .planning/ROADMAP.md "${PARTITION_ROOT}/phases/${NEXT}-${SLUG}/.gitkeep"
   ```

6. **Report:**
   ```
   Backlog Item Added

   {NEXT}: {description}
   Directory: {partition_root}/phases/{NEXT}-{slug}/

   This item lives in the backlog parking lot.
   Use /gsd2:discuss-phase with the description to explore it further.
   Use /gsd2:review-backlog to promote items to active milestone.
   ```

</process>

<notes>
- B-prefixed (B1, B2…) IDs keep backlog items outside the phase-number space
- Phase directories are created immediately, so /gsd2:discuss-phase and /gsd2:plan-phase work on them
- No `Depends on:` field — backlog items are unsequenced by definition
- Sparse numbering is fine (B1, B3) — always uses next-backlog-id
</notes>
