# Phase 13: Overnight Runner - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-12
**Phase:** 13-overnight-runner
**Decisions captured:** 12 (10 strong [incl. 2 user-override, 6 specialist-backed], 0 weak, 5 discretion items)

---

## Conversation Summary

### Setup
Wave-0 research (13-RESEARCH.md) preceded this discussion per the roadmap gate; the user had already reviewed W0-1..W0-3 and recorded binding constraints as §W0-5 (OAuth non-blocker, sandbox-first permissioning). The discussion therefore opened with most of the technical surface locked by prior phases (10/11/12) and research; four genuinely open areas were presented and the user selected all four.

### Domain classification
**Decision:** Agentic, confirmed by user. Route to `/gsd2:agent-spec-phase 13` before planning.
**Signal:** [STRONG] — explicit confirmation.

### Morning report + inbox composition
**User's perspective:** picked the recommended inbox-first composition.
**Decision:** `/gsd2:inbox` is the single morning command; embeds the run report summary then walks questions. `gsd-tools run report` ships standalone per RUN-04 but inbox reuses it.
**Signal:** [STRONG, specialist-backed] — confirms Phase 12's explicit "single entry point, no second review surface" boundary note.

### Launch & scheduling
**User's perspective:** picked manual-first.
**Decision:** user launches `/gsd2:overnight` themselves in v1; crontab line documented, never installed. No install helper (deferred).
**Signal:** [STRONG, specialist-backed] — consistent with the project's trust-ladder decision.

### Run scope + failure posture
**User's perspective:** picked skip-to-independent over sequential-stop and over full parallelism.
**Decision:** all remaining phases by default (`--from N` override); on park/non-auth failure, record and continue to the next phase without a `depends_on` on the blocked one; stop when nothing independent remains. Auth failure always stops the run (RUN-03). Sequential execution in v1; concurrency deferred.
**Signal:** [STRONG, specialist-backed] — park-don't-block applied at run-loop level.

### Remaining Wave-0 probe (ask-rule behavior in `-p` mode)
**User's perspective:** chose "run it now" rather than deferring to a Wave-0 plan task.
**Probe:** temp project with `{"permissions":{"ask":["Bash(touch:*)"]}}`; `claude -p` asked to run the gated command. Result: exit 0, run continued, model reported the denial, result JSON contained structured `permission_denials[]`. No abort, no hang (~2.3 min).
**Decision:** would-prompt tool calls in headless mode auto-deny with model-visible errors → mailbox routing of permission needs is fully viable, with `permission_denials[]` as runner-side backstop.
**Signal:** [STRONG, specialist-backed] — empirical, HIGH confidence, probed live this session.

## Established (Not Discussed)
GSD_RUN_ID run signal; ESC-03 PASS-grep gate; `clean:false` mailbox routing; stuck-detection ownership; park-and-ask bifurcation; ledger write-once; appendFileSync trace safety; worktree machinery incl. in-place fallback; zero new deps / system cron; autonomous.md sub-skill invocation + :255/:276 prompt alignment.

## Deferred Ideas
Cron install helper; concurrent independent phases; parked-branch resume (Phase 15); runner-invoked discuss-loop wiring (optional 13/15). Two backlog todos reviewed, not folded (plan-phase sync checkpoints; hook sync).
