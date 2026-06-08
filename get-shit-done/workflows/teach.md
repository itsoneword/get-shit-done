<purpose>
Online, human-gated skill-evolution loop for GSD. Observe a real failure, attribute it to a source prose artifact, draft a bounded edit via advisor-critic, ratify interactively, commit to source, and record in the lessons ledger. The auto-miner path (`/gsd2:teach scan`) nominates recurring patterns from the ledger — it proposes no edit and writes no file.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_subcommand">
**Parse $ARGUMENTS.**

| Condition | Path |
|-----------|------|
| `$ARGUMENTS` is exactly `scan` (case-insensitive) | **Path A — nominations report** |
| Anything else | **Path B — teach loop** |
</step>

<!-- ============================================================ -->
<!-- PATH A: scan                                                   -->
<!-- ============================================================ -->

<step name="scan">
**Path A — auto-miner nominations report (no edit proposed).**

Run:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson scan
```

Print the output verbatim. Propose no edit. Write no source file. Write nothing to the lessons ledger. End here.
</step>

<!-- ============================================================ -->
<!-- PATH B: teach loop                                             -->
<!-- ============================================================ -->

<step name="init_telemetry">
**Step 1 — Init / telemetry context.**

Read recent telemetry to inform attribution:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" trace --last 20 --raw
```

Keep the output in working memory. It will be passed to the attribution step.
</step>

<step name="attribution">
**Step 2 — Attribution.**

Run the attribution helper, optionally scoping to a specific agent type if the failure description names one (e.g., "executor missed an endpoint" → use `--agent gsd-executor`). Otherwise use `--last 50` for a broad match:

```bash
# If failure description names an agent type:
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson attribute --agent <type>

# Otherwise (default):
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson attribute --last 50
```

The command returns `{attributed_agent, attributed_file}`.

Present to the user:
```
Looks like a {attributed_agent} issue — edit {attributed_file}? [y / redirect to <path>]
```

Wait for the user's answer:
- **y** → proceed with `{attributed_file}` as the target.
- **redirect to `<path>`** → use the user-supplied path as the target instead.

**Target path rules (assert before proceeding):**
- The target MUST be a repo-root source path — it must start with `agents/` or `get-shit-done/` (or another source directory like `commands/gsd2/`).
- The target MUST NOT start with `.claude/` (that is the gitignored runtime; edits there are lost at the next `npm run dev`).
- The target MUST NOT contain `gsd-local-patches/` (that layer is for user-local overrides, not phase-taught lessons).

If the user-supplied redirect violates these rules, explain and re-prompt.
</step>

<step name="reflect">
**Step 3 — Reflect (advisor-critic, inline).**

Read the current content of the `{attributed_file}` (or the specific section the failure implicates, if the file is large).

Invoke the `advisor` tool inline with:
- The failure description from `$ARGUMENTS`
- The relevant section of `{attributed_file}`
- This reflection prompt: "Was a skill in this prose genuinely at fault for the described failure? If yes, what is the MINIMAL prose change (add, delete, or replace) that prevents recurrence? The change must target ONE contiguous section (delimited by a `##` or `###` header) and must not exceed 20 lines changed (added + removed combined). If no skill edit is warranted, say so."

Evaluate the advisor's response:
- If the advisor concludes no skill edit is warranted, report that to the user and end (no lesson appended).
- If the advisor drafts an edit, proceed to the next step.
</step>

<step name="draft_bounded_edit">
**Step 4 — Draft bounded edit.**

From the advisor's response, produce a concrete before/after diff for:
- ONE contiguous section (delimited by a `##` or `###` header) within `{attributed_file}`
- ONE operation type: add, delete, or replace
- **No more than 20 lines changed** (added + removed combined)

If the advisor draft exceeds this bound (>20 lines changed, or touches more than one section), do NOT proceed with the over-budget draft. Instead:
1. Ask the advisor to narrow the scope to the single most impactful change within the bound.
2. If narrowing is not possible, split the lesson: propose one bounded change now and note the remainder for a future `/gsd2:teach` invocation. Never apply an over-budget edit in a single ratification step.
</step>

<step name="append_proposed_lesson">
**Step 5 — Append proposed lesson to ledger.**

Record the lesson as `proposed` before presenting it to the user:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson append \
  '{"description":"<failure description>","attributed_agent":"<agent>","attributed_file":"<file>","edit_type":"<add|delete|replace>","lines_changed":<N>,"disposition":"proposed","source_failure":"teach-manual"}'
```

Capture the returned `LSN-NNN` identifier.
</step>

<step name="ratify_gate">
**Step 6 — Ratification gate (human round-trip — no auto-apply).**

Display the before/after diff inline (exact lines that would change, clearly labeled "BEFORE" and "AFTER"). Then ask:
```
Apply this edit to {attributed_file}? [y/N]
```

Wait for the user's answer. This is the ONLY human round-trip in the loop and the primary bloat guard. Even an advisor-passed draft waits for `y`. Never auto-apply.
</step>

<step name="apply">
**Step 7 — Apply (on y).**

Before writing, ASSERT:
1. The resolved target path does NOT start with `.claude/` — if it does, abort and report the error.
2. The resolved target path does NOT contain `gsd-local-patches/` — if it does, abort and report the error.

Use the `Edit` tool (surgical replacement — NOT `Write`) to apply the change to `{attributed_file}`.

Then commit the **source file ONLY** (not the ledger — see why below):
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "teach({attributed_agent}): {one-line edit summary}" \
  --files {attributed_file}
```

Capture the commit hash — this is the revertable source commit.

Update the ledger record to `applied`, then commit the ledger **separately**:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson update {LSN} \
  --disposition applied --commit {hash}
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "teach({attributed_agent}): record lesson {LSN} applied" \
  --files .planning/lessons/lessons.jsonl
```

**Why two commits (do NOT combine):** the undo path is `git revert {hash}` on the source
commit. If the ledger record lived in that same commit, the later `applied` mutation would
rewrite the very line the revert tries to reverse-patch — `git revert` would conflict and
abort. A source-only apply commit keeps the undo clean; the ledger is an append-only audit
log committed on its own (TEACH-02: source-only edit AND an applied ledger record).
</step>

<step name="discard">
**Step 7 — Discard (on N).**

Update the ledger record to `rejected`, then commit the ledger so the tree stays clean:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson update {LSN} --disposition rejected
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "teach: record lesson {LSN} rejected" --files .planning/lessons/lessons.jsonl
```

Change no source file. Confirm: `Lesson {LSN} recorded as rejected. No source file changed.`
</step>

<step name="confirm">
**Step 8 — Confirm (after apply).**

Print:
```
Applied. Commit {hash}. Lesson {LSN}.
Run `npm run dev` to propagate this edit to the current runtime.

To undo:
  git revert {hash}
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson update {LSN} --disposition reverted
  npm run dev
(The lesson stays in the ledger with disposition=reverted — it is NOT deleted. The
revert targets the source-only apply commit, so it never conflicts with the ledger.)
```
</step>

</process>

<constraints>
The following guard rules encode the six common pitfalls for this workflow. Each is a hard rule, not a suggestion.

1. **Confirm attribution before drafting.** Always present the proposed `{attributed_file}` and wait for user confirmation or redirect (Step 2) before invoking the advisor. Never draft an edit to a file the user has not confirmed.

2. **20 lines / one section.** The bounded-edit cap is exactly **20 lines changed** (added + removed combined) within **one contiguous section** (delimited by a `##` or `###` header). If the advisor draft exceeds this, narrow it or split into a second lesson. Do not proceed with an over-budget edit.

3. **Assert non-`.claude/` source path.** Before calling `Edit`, assert the resolved path does NOT start with `.claude/`. The `.claude/` directory is the gitignored runtime; edits there are lost when `npm run dev` re-propagates from source. Source targets: `agents/`, `get-shit-done/`, `commands/gsd2/`.

4. **Never edit `gsd-local-patches/`.** The `.claude/gsd-local-patches/` layer is for user-local overrides only — the loop never touches it. The lesson always targets the repo-root source file (e.g., `agents/gsd-planner.md`, not `.claude/gsd-local-patches/agents/gsd-planner.md`).

5. **Always emit the `npm run dev` propagation line.** The final confirmation (Step 8) must include `Run npm run dev to propagate this edit to the current runtime.` Without this step the running session still uses the old runtime copy.

6. **Auto-miner nominates only.** `/gsd2:teach scan` (Path A) runs `lesson scan` and prints nominations. It proposes no edit, writes no file, and does not open the teach loop. Every edit must flow through the [y/N] ratify gate in Path B.
</constraints>

<success_criteria>
- [ ] Path A (`scan`): nominations report printed, no file written, loop not entered
- [ ] Path B: telemetry read before attribution
- [ ] Path B: attribution presented to user before any advisor call
- [ ] Path B: advisor-critic invoked inline; reflection considers whether a skill edit is warranted
- [ ] Path B: bounded edit cap enforced (<=20 lines, one section); over-budget drafts narrowed or split
- [ ] Path B: lesson appended as `proposed` before the ratify gate
- [ ] Path B: [y/N] ratify gate reached before any file is written (no auto-apply path)
- [ ] Path B (y): target path asserted as non-`.claude/` non-`gsd-local-patches/` before `Edit`
- [ ] Path B (y): source file + `lessons.jsonl` committed together via `gsd-tools commit`
- [ ] Path B (y): ledger record updated to `disposition: applied` with commit hash
- [ ] Path B (y): confirmation includes `npm run dev` propagation line AND `git revert {hash} && npm run dev` reversibility line
- [ ] Path B (N): ledger record updated to `disposition: rejected`, no source file changed
</success_criteria>
