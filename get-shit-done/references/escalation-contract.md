# Escalation Contract

## Purpose

This contract makes autonomous-run escalation deterministic. When the harness evaluator processes a decision resolved by the resolution loop, it applies this contract as a MEMBERSHIP CHECK against literal condition lists — not as heuristic judgment. Prose criteria drift across LLM runs; discrete condition lists do not. A decision either matches a listed condition or it does not. No inference is required beyond reading the condition and checking whether the proposed action satisfies it.

## Verdict Tiers

Three tiers govern what the harness does with an autonomously resolved decision:

- **`proceed`** — confidence is HIGH AND no criterion condition was met. Execute the decision autonomously; the ledger records it for morning review. `escalated: false`
- **`proceed-and-log`** — confidence is MEDIUM AND no criterion condition was met. Execute the decision autonomously; the ledger flags it for morning review with extra attention. `escalated: false`
- **`park-and-ask`** — ANY criterion condition is met, regardless of confidence level. Do not execute the decision autonomously; surface it to the human. `escalated: true`

`escalated` is `true` if and only if the verdict is `park-and-ask`. For `proceed` and `proceed-and-log`, `escalated` is always `false`.

## Criteria

Each criterion maps to `park-and-ask`. Apply each criterion by checking the proposed decision against its numbered condition list. If the decision satisfies ANY numbered condition in ANY criterion, the verdict is `park-and-ask`.

### 1. Irreversibility

Fires when the decision proposes an action that:

1. Deletes or overwrites files not tracked by git (no `git revert` recovery path)
2. Runs destructive git operations: `push --force` to a shared remote, `branch -D` on an unmerged branch, `reset --hard` discarding uncommitted work, history rewrites (`filter-branch` / `filter-repo`)
3. Publishes or releases an artifact: `npm publish`, pushing a git tag to a remote, creating a GitHub release
4. Sends external side-effecting communication: creating issues/PRs/comments on a remote, firing webhooks, sending email
5. Applies a database schema migration or data mutation without a tested rollback
6. Rotates, revokes, or deletes credentials or keys

### 2. Security boundary

Fires when the decision proposes an action that:

1. Reads or writes credential material: `.env*` files, token files, keychains, secrets embedded in config
2. Adds or changes network egress: a new external endpoint, a newly fetched domain, a telemetry destination
3. Modifies hook execution paths: `hooks/`, `hooks/dist/`, hook registrations in `settings.json`
4. Changes permission posture: `settings.json` permissions, `bypassPermissions`, sandbox configuration
5. Introduces code that executes untrusted or interpolated input (`eval`, `child_process` with unsanitized interpolation)

### 3. Scope change

Fires when the decision proposes:

1. Work touching files or components outside the phase CONTEXT.md `<domain>` boundary
2. Implementing anything listed in the phase CONTEXT.md `<deferred>` section
3. Adding a dependency (npm package, external service) not named in the phase CONTEXT.md or RESEARCH.md
4. Editing REQUIREMENTS.md or ROADMAP.md scope mid-phase

### 4. Spec ambiguity

Fires when:

1. The resolved decision contradicts a decision tagged `[STRONG]` (any variant: `[STRONG]`, `[STRONG, user-override]`, `[STRONG, specialist-backed]`) in the phase CONTEXT.md
2. The resolution loop returned LOW confidence after exhausting its budget
3. Two canonical references give conflicting directives and neither is marked superseded

## Tie-break Rules

A **borderline** case is one where the evaluator cannot determine from available facts whether a listed condition is met — the proposed action resembles a condition but does not literally match it.

- **Default:** borderline → `proceed-and-log` (the neutral tier: do the work, flag it, discuss in morning review). A wrong scope or ambiguity call is reviewable and revertable from the ledger later.
- **EXCEPTION:** borderline on Irreversibility or Security boundary → `park-and-ask`. A wrong irreversibility or security call cannot be fixed in morning review after the fact.

## How the Evaluator Applies This Contract

1. Read each criterion's condition list (sections 1–4 above).
2. Check the resolved decision against each condition as a membership test — does the proposed action literally match this condition?
3. If ANY condition fires, record which condition fired (criterion name + condition number, e.g., "Irreversibility condition 3") in `escalation_reason` and set `escalation_verdict: "park-and-ask"`, `escalated: true`.
4. If no condition fires, determine the verdict from confidence alone:
   - HIGH confidence → `"proceed"`, `escalated: false`
   - MEDIUM confidence → `"proceed-and-log"`, `escalated: false`
5. If a borderline case applies, apply the tie-break rule above before computing the verdict.
6. Compute the complete verdict (`escalation_verdict`, `escalation_reason`, `escalated`) BEFORE the `ledger append` call. The ledger is write-once; there is no patch path.

## Calibration Posture

The tie-break defaults and the trust-ladder thresholds (zero hard-criteria misses; ≤1 soft miss landing in plain `proceed`; ≤3/10 false parks) are dials, not doctrine — a neutral starting point expected to be tuned after the first real overnight runs. These numbers reflect a balance between over-asking (blocking progress) and under-asking (missing genuine risks). The calibration procedure and gate live in `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CALIBRATION.md`.
