<purpose>

Run all remaining milestone phases unattended with the v1.6 harness active (ledger + escalation + mailbox + parking). Executes at ORCHESTRATOR level only — top-level session or headless `claude -p "/gsd2:overnight"` — never as a spawned subagent (subagents lack Skill grants).

Sandbox-first: this workflow NEVER uses or recommends `--permission-mode bypassPermissions`; permission needs auto-deny in headless mode and surface as mailbox questions (probe-confirmed 2026-06-12). Proposes, never disposes: every outcome is auditable from `.planning/run/{run-id}/` alone, without replaying transcripts.

Each phase runs via `Skill(skill="gsd2:autonomous", args="--phase N")`, which inherits the run context from environment variables and produces a machine-greppable `PHASE RESULT:` line on exit. The runner owns: run.log authorship, worktree lifecycle, conflict routing to mailbox, and stuck detection at every phase boundary. It does NOT rewrite the discuss→plan→execute loop — that lives in autonomous.md and is unchanged.

</purpose>

<process>

<step name="parse_arguments">

## Step 1: Parse arguments

Parse `$ARGUMENTS`:

```bash
FROM_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-from\s+[0-9]'; then
  FROM_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-from\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi

RUN_ID_OVERRIDE=""
if echo "$ARGUMENTS" | grep -qE '\-\-run-id\s+\S+'; then
  RUN_ID_OVERRIDE=$(echo "$ARGUMENTS" | grep -oE '\-\-run-id\s+\S+' | awk '{print $2}')
fi
```

Optional flags:
- `--from N` — start from phase N (skip earlier phases)
- `--run-id <id>` — override the auto-generated run-id (useful for resuming a partial run or smoke testing)

</step>

<step name="run_init">

## Step 2: Run init + env export

```bash
GSD_RUN_ID="${RUN_ID_OVERRIDE:-overnight-$(date +%Y%m%d-%H%M%S)}"
export GSD_RUN_ID
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run init "$GSD_RUN_ID"
GSD_RUN_LOG="$(pwd)/.planning/run/$GSD_RUN_ID/run.log"
export GSD_RUN_LOG
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) RUN_START run_id=$GSD_RUN_ID from=${FROM_PHASE:-first-incomplete}" >> "$GSD_RUN_LOG"
```

**Critical:** `GSD_RUN_LOG` MUST be computed as an absolute path (`$(pwd)/...`) at init time, BEFORE any worktree exists. Worktree-CWD phases inherit `GSD_RUN_LOG` from the environment, so they will write the typed log lines to the main tree's log — not a relative path that resolves differently from a worktree subdirectory. The health check enforces this with a path-absoluteness gate.

</step>

<step name="health_check">

## Step 3: Startup health check (fail closed)

**run.log line format contract:** Every line written to `GSD_RUN_LOG` is exactly:

```
<ISO8601-UTC> <TYPE> key=value key=value ...
```

The complete locked TYPE vocabulary — these are the ONLY tokens that may appear as TYPE in run.log lines:

- `RUN_START` — run initialized
- `HEALTH_PASS` — startup checks passed
- `HEALTH_FAIL` — a startup check failed (run aborts before any phase starts)
- `PHASE_START` — phase invocation beginning
- `PHASE_COMPLETE` — phase finished successfully
- `PHASE_PARKED` — phase halted by park-and-ask verdict
- `PHASE_FAILURE` — phase failed for any reason
- `AUTH_FAILURE` — authentication error detected (hard stop)
- `PERMISSION_DENIAL` — a tool call was auto-denied in headless mode
- `CONFLICT_ROUTED` — merge conflict routed to mailbox
- `CONFLICT_ROUTED_FAIL` — merge conflict detected but mailbox append failed
- `MERGE_PARSE_FAIL` — worktree merge --raw output was not parseable JSON
- `WORKTREE_FALLBACK` — worktree creation failed; running in-place
- `STUCK_FLAG` — stuck phase detected (no ledger progress across consecutive boundaries)
- `RUN_STOP` — run stopped before completing all phases
- `RUN_COMPLETE` — all phases processed, run complete

No other TYPE tokens may be invented. This vocabulary is the observability API — it enables exhaustive grep over run.log without reading prose.

**Health checks, in order:**

```bash
ERRORS=0

# 1. ESC-03 calibration gate — case-SENSITIVE grep; lowercase "pass" in the template must NOT satisfy it
if ! grep -q "PASS" .planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/*CALIBRATION*.md 2>/dev/null; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) HEALTH_FAIL check=esc-03 detail=calibration-gate-not-passed" >> "$GSD_RUN_LOG"
  ERRORS=$((ERRORS + 1))
fi

# 2. GSD_RUN_LOG absoluteness — the worktree trap (if relative, worktree-CWD phases write to the wrong tree)
case "$GSD_RUN_LOG" in /*) ;;
  *)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) HEALTH_FAIL check=run-log detail=path-not-absolute" >> "$GSD_RUN_LOG"
  ERRORS=$((ERRORS + 1));;
esac

# 3. Auth source — INFORMATIONAL ONLY (user-locked posture: no env-var mandate; the running session proves
#    live auth; hard failures are caught at runtime by the AUTH_FAILURE path below)
AUTH_SRC="session"
[ -n "$ANTHROPIC_API_KEY" ] && AUTH_SRC="api-key"
[ -n "$CLAUDE_CODE_OAUTH_TOKEN" ] && AUTH_SRC="oauth-token"

# 4. Git tree state — WARNING key on the pass line only; never a failure gate
GIT_DIRTY="false"
[ -n "$(git status --porcelain 2>/dev/null)" ] && GIT_DIRTY="true"

if [ $ERRORS -gt 0 ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) RUN_STOP reason=health-fail errors=$ERRORS" >> "$GSD_RUN_LOG"
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run status --set stopped --reason health-fail
  # ABORT — print the failing checks and how to fix them, then STOP
  # Fix for esc-03 gate: run /gsd2:verify-work, open 11-CALIBRATION.md, fill in the Result section
  # with the evaluation outcome. The file MUST contain the uppercase token before overnight can run.
fi
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) HEALTH_PASS auth=$AUTH_SRC git_dirty=$GIT_DIRTY" >> "$GSD_RUN_LOG"
```

**On health failure: NOTHING runs.** No `PHASE_START` line may appear after a `HEALTH_FAIL` abort. This is TC-1's invariant. The run stops here and the human must fix the failing gate (for ESC-03: complete the calibration file by running `/gsd2:verify-work` and writing the evaluation result into the Result section).

</step>

<step name="discover_phases">

## Step 4: Discover phases + dependency graph

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

Parse the `phases` array. Filter to incomplete: `disk_status !== "complete"` OR `roadmap_complete === false`. If `FROM_PHASE` is set, exclude phases where `number < FROM_PHASE` (numeric comparison, handles decimals like "5.1"). Sort by `number` ascending.

For each remaining phase, fetch details and parse the dependency graph:

```bash
DETAIL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extract phase numbers from the `**Depends on**:` line in the `section` field using the pattern `/Phase\s+(\d+(\.\d+)?)/g`. "Nothing" or absent means no dependencies. Build an ordered list with each phase's `depends_on` set.

Prune stale worktrees from any previous crashed run:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" worktree prune
```

Non-zero exit from prune: log the warning and continue — a stale worktree will not block phase execution.

</step>

<step name="phase_loop">

## Step 5: Sequential phase loop

Maintain two sets across the run:
- `BLOCKED` — phases that parked or failed this run (not eligible as unblocked dependencies)
- `SKIPPED` — phases whose `depends_on ∩ BLOCKED ≠ ∅` (skipped at dispatch time)

For each phase N in roadmap order:

**Dependency check:** if `depends_on ∩ BLOCKED ≠ ∅`, add N to `SKIPPED` and continue to the next phase. No `PHASE_START` line is written for skipped phases — they are recorded on the `RUN_STOP` line and visible in RUN-META. Skip-to-independent keeps the run making progress even when phases fail.

**Otherwise, execute:**

**5.1 PHASE_START:**

```bash
STARTED_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "$STARTED_TS PHASE_START phase=$N worktree=pending" >> "$GSD_RUN_LOG"
```

**5.2 Worktree attempt:**

```bash
WORKTREE_RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" worktree add ".worktrees/overnight-phase-${N}" "overnight-phase-${N}" 2>&1)
```

Parse the JSON result:
- `fallback:"in-place"` or `ok:false` → log `WORKTREE_FALLBACK`, set `WORKTREE="in-place"`
- Otherwise: `WORKTREE="overnight-phase-${N}"`

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) WORKTREE_FALLBACK phase=$N mode=in-place" >> "$GSD_RUN_LOG"
```

**Known caveat (Phase 7, 07-01-SUMMARY):** in this Claude Code environment, subagent cwd resets between bash calls, so per-phase worktree isolation is BEST-EFFORT. The in-place fallback is the honest common path. The runner logs `WORKTREE_FALLBACK` whenever isolation cannot be guaranteed — it does NOT pretend isolation that isn't there.

**5.3 Invoke the phase:**

```bash
Skill(skill="gsd2:autonomous", args="--phase ${N}")
```

`GSD_RUN_ID` and `GSD_RUN_LOG` inherit from the environment — the phase loop writes ledger entries, mailbox entries, and park snapshots into the run's artifact directory automatically.

**5.4 Auth check FIRST** — inspect the skill's return output and any tool errors observed during the phase. If any of the following appear:

- `authentication_error`
- `OAuth token has expired`
- `Not logged in`
- `authentication_failed`

Then:

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) AUTH_FAILURE phase=$N" >> "$GSD_RUN_LOG"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) RUN_STOP reason=auth-failure" >> "$GSD_RUN_LOG"
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run status --set stopped --reason auth-failure
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run record-phase --phase $N --status failed --reason auth-failure --worktree "$WORKTREE" --started-ts "$STARTED_TS" --ended-ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**END THE RUN IMMEDIATELY.** No retry, no silent retry, no skip-to-independent for auth failures. Every other failure parks/fails the phase and the runner continues to the next independent phase — auth is the deliberate asymmetric exception. Never silently retry auth failures: a hung session retrying overnight burns the night producing nothing while appearing alive (RUN-03 invariant).

**5.5 Outcome detection** from the LAST `PHASE RESULT:` line in the skill output (machine-greppable per 13-02 contract):

```
^PHASE RESULT: (completed|parked|failed) phase=N( .*)?$
```

- `completed` → `STATUS=completed`
- `parked` — capture `q=q-NNN` id from the line → `STATUS=parked Q_ID=<q-NNN>`
- `failed` — capture `reason=<reason>` → `STATUS=failed REASON=<reason>`
- **No PHASE RESULT line present** → `STATUS=failed REASON=ambiguous-outcome` (fail-safe: never assume completed when the outcome is ambiguous; a wrongly-failed phase is reviewable in the morning; a wrongly-completed phase poisons downstream merges)

**5.6 Permission-denial backstop:** if any permission denial was observed during the phase (the model sees auto-denials as tool errors in-session) and no mailbox entry exists for it, append one:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data "{\"question\":\"Phase ${N} needs permission: <tool + target>\",\"phase\":${N},\"context\":\"auto-denied in headless run; tool_input: <summary>\",\"status\":\"pending\"}"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PERMISSION_DENIAL phase=$N tool=<name>" >> "$GSD_RUN_LOG"
```

**5.7 Merge** (only when `WORKTREE != "in-place"`):

```bash
MERGE_RAW=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" worktree merge "overnight-phase-${N}" --raw)
```

**EXIT CODE OF `worktree merge` IS ALWAYS 0 ON CONFLICT BY DESIGN** (worktree.cjs source comment). Exit code is insufficient and must never be used as the success signal — this is the canonical RUN-02 swallow bug. The `clean` field in the JSON output is the only truth.

Parse `MERGE_RAW` with `node -e JSON.parse`:

- **Parse failure** → treat as conflict (fail-safe):
  ```bash
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) MERGE_PARSE_FAIL phase=$N" >> "$GSD_RUN_LOG"
  ```
  Route the raw output to mailbox and set `MERGE_CLEAN=false`.

- **`clean:true`** → `MERGE_CLEAN=true`; clean up: `node ... worktree remove ".worktrees/overnight-phase-${N}"`

- **`clean:false`** → `MERGE_CLEAN=false`; conflict routing:
  ```bash
  Q_ID=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" mailbox append --data \
    "{\"question\":\"Merge conflict in phase ${N} (overnight-phase-${N}) — resolve before this branch can land\",\"phase\":${N},\"context\":\"conflict_files: <list from conflict_files field>; run_id: ${GSD_RUN_ID}; phase: ${N}\",\"status\":\"pending\"}")
  ```

  - Mailbox append succeeded → log `CONFLICT_ROUTED phase=$N q=$Q_ID files=<count>`. Leave branch and worktree UNMERGED for morning review — do NOT remove, do NOT abort the merge state (TC-2: the branch is the conflict evidence).
  - Mailbox append failed → log `CONFLICT_ROUTED_FAIL phase=$N files=<list>` (the run.log line preserves the evidence even when mailbox write fails). Set `STATUS=failed`.

**5.8 Boundary snapshot + stuck check:**

```bash
SNAPSHOT_OUT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run snapshot --phase $N)
```

If `SNAPSHOT_OUT` contains `STUCK` → log `STUCK_FLAG` and downgrade outcome:

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) STUCK_FLAG phase=$N" >> "$GSD_RUN_LOG"
# TC-6: a stuck phase's record is NEVER completed
if [ "$STATUS" = "completed" ]; then
  STATUS=failed
  REASON=stuck
fi
```

**5.9 Record the outcome:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run record-phase \
  --phase $N \
  --status $STATUS \
  --worktree "$WORKTREE" \
  --merge-clean $MERGE_CLEAN \
  --started-ts "$STARTED_TS" \
  --ended-ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  [--reason $REASON]
```

**5.10 Closing typed line** — exactly one per phase, matching the outcome:

```bash
# For STATUS=completed:
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_COMPLETE phase=$N" >> "$GSD_RUN_LOG"

# For STATUS=parked:
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_PARKED phase=$N q=${Q_ID:-q-unknown}" >> "$GSD_RUN_LOG"

# For STATUS=failed:
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_FAILURE phase=$N reason=${REASON:-unknown}" >> "$GSD_RUN_LOG"
```

**5.11 Update BLOCKED set:** if STATUS is `parked` or `failed`, add N to `BLOCKED`. Continue to the next phase whose `depends_on` avoids `BLOCKED`.

</step>

<step name="finish">

## Step 6: Finish + morning report

After all phases are processed:

- If `BLOCKED` and `SKIPPED` are both empty AND at least one phase completed:
  ```bash
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) RUN_COMPLETE phases=<n>" >> "$GSD_RUN_LOG"
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run status --set complete
  ```

- Otherwise:
  ```bash
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) RUN_STOP reason=no-independent-work blocked=<list> skipped=<list>" >> "$GSD_RUN_LOG"
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run status --set stopped --reason no-independent-work
  ```

**Step 6.5: Triage**

Run the triage worker to analyze pending todos and ROADMAP backlog items and append proposals to the morning inbox. This step always runs even if phases failed or were skipped. Triage proposals appear in the same inbox session as phase questions.

```bash
TRIAGE_OUT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" triage run 2>&1)
TRIAGE_EXIT=$?
```

If TRIAGE_EXIT is non-zero: log `PHASE_FAILURE phase=triage reason=triage-failed` to `$GSD_RUN_LOG`. Log the failure but continue — triage failure does not abort the morning report.

```bash
if [ $TRIAGE_EXIT -ne 0 ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) PHASE_FAILURE phase=triage reason=triage-failed" >> "$GSD_RUN_LOG"
fi
```

If TRIAGE_EXIT is 0: surface TRIAGE_OUT in the session output for observability.

> **Note:** Verdict assignment in the triage run is driven by LLM judgment per the triage.md workflow. In overnight mode, `gsd-tools triage run` reads items and appends proposals; the actual LLM verdict reasoning happens during a standalone /gsd2:triage session. The overnight step's proposals serve as placeholders that the inbox session will surface for human review.

Then print the morning report and inbox pointer:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" run report "$GSD_RUN_ID"
```

Print the report output verbatim as the final session output, followed by:

```
Morning: run /gsd2:inbox ${GSD_RUN_ID} to review and answer everything in one sitting.
```

</step>

</process>

<scheduling>

## Scheduling

**Manual-first v1 — the cron line is documented here for reference. Copy it, edit the paths, and install yourself with `crontab -e`. It is NOT installed automatically.**

```bash
# /gsd2:overnight cron convention (manual-first v1 — copy, edit paths, install yourself with `crontab -e`)
# Sandbox-first posture: NO --permission-mode bypassPermissions. Permission needs auto-deny
# and surface as mailbox questions (probe-confirmed 2026-06-12).
0 23 * * * cd /abs/path/to/project && claude -p "/gsd2:overnight" >> /abs/path/to/project/.planning/overnight-cron.log 2>&1
```

**Setup notes:**

1. **Network access:** the settings profile must pre-allow research network access — add `sandbox.network.allowedDomains` for bash-level fetches and `permissions.allow` rules for `WebFetch(domain:...)` and `WebSearch` in `settings.json`. Per-domain prompts are the known pain point for headless runs: in `-p` mode, an unrecognized domain auto-denies and routes to the mailbox, not hangs.

2. **Auth:** no env var is required by default (user posture). If a cron run hits `AUTH_FAILURE` in run.log, set `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` in the cron line and revisit — the W0-1 caveat applies: OAuth access tokens expire in roughly 1 hour in headless mode (browser-refresh-blocked); a long-lived token or API key is required for multi-hour overnight runs. Example:
   ```bash
   0 23 * * * cd /abs/path/to/project && ANTHROPIC_API_KEY=sk-... claude -p "/gsd2:overnight" >> .planning/overnight-cron.log 2>&1
   ```

3. **Outer launcher backstop:** an outer launcher may additionally inspect `permission_denials[]` in the `claude -p` result JSON as a backstop to catch denials that the in-session model missed routing to the mailbox.

</scheduling>

<success_criteria>

- Health check fails closed: a missing or unfilled ESC-03 calibration file prevents any `PHASE_START` from appearing in run.log — TC-1.
- Exit-0 merges are never trusted: the runner reads the `clean` field from `worktree merge --raw` JSON; exit code is treated as meaningless — TC-2 (the canonical RUN-02 swallow bug).
- Auth failure = hard stop with zero silent retries: `AUTH_FAILURE` + `RUN_STOP` lines logged; no skip-to-independent for auth; next PHASE_START never appears after AUTH_FAILURE — TC-3.
- Every phase gets exactly one `run record-phase` call and exactly one closing typed line (`PHASE_COMPLETE`, `PHASE_PARKED`, or `PHASE_FAILURE`).
- Only the 16 locked TYPE tokens appear in run.log line templates: `RUN_START`, `HEALTH_PASS`, `HEALTH_FAIL`, `PHASE_START`, `PHASE_COMPLETE`, `PHASE_PARKED`, `PHASE_FAILURE`, `AUTH_FAILURE`, `PERMISSION_DENIAL`, `CONFLICT_ROUTED`, `CONFLICT_ROUTED_FAIL`, `MERGE_PARSE_FAIL`, `WORKTREE_FALLBACK`, `STUCK_FLAG`, `RUN_STOP`, `RUN_COMPLETE`.
- Stuck phases are caught at every boundary via `run snapshot` — TC-6.
- Skip-to-independent keeps the run making progress: only phases whose `depends_on` chain intersects BLOCKED are added to SKIPPED; `reason=no-independent-work` is logged when nothing is left to run.
- The final output is the run report (from `gsd-tools run report`) plus the inbox pointer.

</success_criteria>
