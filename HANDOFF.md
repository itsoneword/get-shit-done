# Handoff — Cross-machine resume

**Session date:** 2026-05-09
**Branch:** main
**HEAD:** see `git log -1` after pull (most recent: quick task 260507-u0a + HANDOFF + un-gitignored `.planning/`)
**Machine context:** moving work to a new machine; this commit makes `.planning/` available there.

---

## How to resume on the new machine

```bash
git clone git@github.com:itsoneword/get-shit-done.git
cd get-shit-done
# install GSD's runtime mirror locally (regenerates .claude/ from source)
# (use whatever install command this repo uses — check package.json scripts or README)
```

Then in Claude Code from the repo root: `/gsd2:resume-work` will load this file plus `.planning/STATE.md` automatically. Or just say "continue from HANDOFF.md".

---

## Where we stopped

Just completed quick task **260507-u0a** — consolidated `/gsd2:progress` into a single CLI call and wired the dormant `--scoped` flag from Plan 04-01. Two source-code commits on `main`:

- `c084da7` — feat: extend `cmdInitProgress` with bundled report fields
- `8597abe` — feat: rewrite `progress.md` to single `init progress --scoped` call

Plus the commit that adds `.planning/` and this HANDOFF.

**Tests:** 852/852 pass.
**Quick-task artifacts:** `.planning/quick/260507-u0a-consolidate-gsd2-progress-into-single-in/` — PLAN + SUMMARY.

## Why this work happened

v1.4.5 (HEAD before today, `079bb2d`) advertised ~13k token savings on `/gsd2:progress` but didn't deliver in real testing. Root cause traced this session: Plan 04-01 added `--scoped` to the CLI but had no task that updated `workflows/progress.md` to actually pass the flag. Verification only `grep -q scoped` against `init.cjs`/`roadmap.cjs` — never asserted the workflow used it. Dormant code shipped as advertised.

The fix consolidates 8 CLI calls down to 1 (`init progress --scoped`) and finally invokes the flag.

## What's left — top priority on resume

**1. Validate the token savings on a real project.** This was the user's original concern. The fix is shipped but not yet measured against a downstream project.

Steps:
- On the new machine, install/refresh GSD globally so the `.claude/` runtime mirror picks up the new `cmdInitProgress` and `progress.md`.
- In a real project (the user has been testing in `cv_work` — a separate non-public project on the same machine), run `/gsd2:progress` and capture the message-token count via `/context`.
- Compare against the ~26k baseline that triggered this work (see end of conversation transcript before clear).
- Target: single-digit-k message tokens per `/gsd2:progress` invocation.

If savings land: bump version, tag v1.4.6, push tag, update CHANGELOG.

If savings don't land: investigate whether the runtime mirror was actually regenerated (check `.claude/get-shit-done/workflows/progress.md` shows the new single-call form; check `.claude/get-shit-done/bin/lib/init.cjs` shows the new bundled fields).

## Carryover from earlier handoff (still open from v1.4 milestone)

Source: previous `HANDOFF.md` content from the v1.4.5 release session (2026-05-07). Postponed into v1.5:

1. **DOCS-04 wiring** — `workflows/document.md:125-140` `discover_subsystems` does not glob `*-AGENT-SPEC.md` despite `gsd-document-mapper.md:79` declaring it as input. <1 hour fix.
2. **Phase 03 retroactive `03-VERIFICATION.md`** — process gap; integration checker confirmed code works end-to-end.
3. **`verify.cjs` parser** — does not unescape YAML `\"` / `\n`. Plans with embedded-quote `node -e` cmds cannot be expressed.
4. **`verify.cjs` matcher** — `rx.test(actual)` in regex mode does not trim trailing newlines. One-line fix: `rx.test(actual.trim())`.
5. **GSD self-verification UX phase** — design reusable harness fixtures or automated regression for the verifier loop instead of one-off manual runs. Captures the deferred Phase 04 dogfood naturally.
6. **`phase complete` CLI** does not refresh per-phase plan counts in `ROADMAP.md` Progress table.
7. **SUMMARY frontmatter `requirements_completed` sparse** — 9 of 11 SUMMARYs have empty arrays despite REQUIREMENTS.md marking everything Complete.

## Milestone status

- **v1.4 milestone:** not yet closed. Audit at `.planning/v1.4-MILESTONE-AUDIT.md` (`gaps_found`).
- **v1.5 milestone:** not yet started. The carryover list above is its likely seed.
- The user paused milestone closure to validate v1.4.5 in real projects first.

## Open debug sessions

Run `ls .planning/debug/*.md 2>/dev/null | grep -v resolved` to list. Status as of session end: none active in this repo's `.planning/debug/` (most debug sessions referenced in past work were in downstream projects, not in GSD self-dev).

## Key files to look at when resuming

- `.planning/STATE.md` — current position + decisions log
- `.planning/quick/260507-u0a-consolidate-gsd2-progress-into-single-in/260507-u0a-SUMMARY.md` — what landed in the latest quick task
- `get-shit-done/workflows/progress.md` — the consolidated workflow (one bash call)
- `get-shit-done/bin/lib/init.cjs:cmdInitProgress` — the bundled JSON output (new fields: progress_bar, verification_debt, todo_count, debug_session_count, recent_summaries, profile, state, plus per-phase goal/depends_on/has_context/roadmap_complete)
- `.planning/v1.4-MILESTONE-AUDIT.md` — milestone gaps if you want to plan v1.5

## Notes for the new machine

- `.planning/` is now tracked in git (was previously gitignored). All artifacts ship with the repo.
- `.claude/` is still gitignored — that's the runtime mirror, regenerated on install. Don't commit it.
- Source tree edits go in `get-shit-done/`, `commands/`, `bin/` at repo root. Source files use `$HOME/.claude/...` placeholders, NOT absolute `/Users/...` paths. Never copy `.claude/` files back into source (Phase 04-04 regression — `feedback_dual_tree_edits.md`).
