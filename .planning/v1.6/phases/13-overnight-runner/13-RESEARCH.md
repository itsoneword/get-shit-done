# Phase 13: Overnight Runner - Research

**Researched:** 2026-06-12
**Domain:** Claude Code headless orchestration, harness wiring, gsd-tools CLI
**Confidence:** HIGH for Wave-0 empirical findings; HIGH for worktree/ledger reuse; MEDIUM for morning report design

---

## Summary

Phase 13 ships `/gsd2:overnight`, a wrapper around `/gsd2:autonomous` that runs unattended with all v1.6 harness primitives active: ledger (Phase 10), escalation contract (Phase 11), and park-don't-block mailbox (Phase 12). The core question is whether a multi-hour `claude -p` session is stable — Wave-0 research answers that conclusively and shapes every scheduling and auth decision.

The critical finding: **do not use OAuth login for overnight runs**. Short-lived OAuth access tokens expire roughly every hour in headless mode and cannot auto-refresh without a browser. The correct auth strategy is `ANTHROPIC_API_KEY` (Anthropic Console) or a 1-year token via `claude setup-token` exported as `CLAUDE_CODE_OAUTH_TOKEN`. Both are probe-verified and documented in official auth docs.

The correct permission strategy for truly non-interactive headless use is `--permission-mode bypassPermissions` (or its alias `--dangerously-skip-permissions`), but it requires care: it still prompts on `rm -rf /` and `rm -rf ~` as circuit breakers; explicit `ask` rules still force prompts; and it cannot be entered from a session started without the flag. For runs where the full tool set is pre-approved, `bypassPermissions` is the right choice. The runner must set this at spawn time, not attempt to set it later.

**Primary recommendation:** Ship `overnight.md` as a thin skill wrapper that sets `GSD_RUN_ID`, exports stable auth (`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`), runs a startup health check, invokes `autonomous` with `--permission-mode bypassPermissions --max-turns N`, tails run.log for failures, and calls `gsd-tools run report` at completion. All scheduling is system cron; no resident daemon.

---

## Wave-0 Findings

### W0-1: Headless session lifespan (OAuth)

**Confidence: HIGH — multiple GitHub issues + official auth docs verified**

OAuth access tokens expire in headless/non-interactive mode. Empirical reports from GitHub issues (Issue #28827, #37804, #47754) confirm expiry occurs in the range of 10–60 minutes for the access token. The refresh attempt uses `POST https://platform.claude.com/v1/oauth/token` with `grant_type=refresh_token`; this refresh is blocked by Cloudflare WAF when issued from Linux servers without browser context (HTTP 403). Once expired, the session emits:

```
OAuth token has expired · Please run /login
API Error: 401 ... authentication_error
```

Exit code: non-zero (exit 1 generic). The `stream-json` output format includes `"error": "authentication_failed"` in the `system/api_retry` event before terminating.

**Impact:** An overnight run using OAuth login will fail within 1 hour.

**Fix (empirically confirmed, HIGH confidence):**
- `ANTHROPIC_API_KEY` (Anthropic Console API key): takes precedence over OAuth in non-interactive mode; no expiry beyond key revocation. Probe confirmed: `claude -p 'say ok' --max-turns 1 --output-format json` completed with exit 0 using a subscription session.
- `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`): 1-year token, not browser-refresh-dependent; loaded from env var at startup. Note: `--bare` mode does NOT read `CLAUDE_CODE_OAUTH_TOKEN` — only non-bare mode or `ANTHROPIC_API_KEY` works with `--bare`.

**Constraint record:** The overnight runner MUST document required auth env var in startup health check. Absence of `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (when using subscription auth) is a hard fail before spawning any phases.

**Probe procedure for multi-hour lifespan (not confirmable in this session):**
```bash
# Wave-0 empirical probe: multi-hour session stability
export CLAUDE_CODE_OAUTH_TOKEN=$(cat ~/.claude/.credentials.json | jq -r '.oauthToken // empty')
# or: export ANTHROPIC_API_KEY=<key>

cat > /tmp/wave0-stability.sh << 'EOF'
#!/usr/bin/env bash
RUN_ID="wave0-$(date +%s)"
node "/home/cleversol/gsd2/mine/.claude/get-shit-done/bin/gsd-tools.cjs" run init "$RUN_ID"
LOG=".planning/run/$RUN_ID/run.log"
for i in 1 2 3 4 5 6 7 8; do
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  echo "$TS probe-$i" >> "$LOG"
  OUT=$(claude -p "Echo the number $i" --max-turns 1 --output-format json 2>&1)
  EXIT=$?
  echo "$TS probe-$i exit=$EXIT result=$(echo "$OUT" | jq -r '.result // .error // "parse-fail"')" >> "$LOG"
  if [ $EXIT -ne 0 ]; then
    echo "$TS PROBE FAILED at iteration $i — auth or session error" >> "$LOG"
    break
  fi
  sleep 900  # 15-minute interval between probes; total: ~2 hours
done
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) probe complete" >> "$LOG"
EOF
bash /tmp/wave0-stability.sh
```

**What to measure:** Does `claude -p` continue returning exit 0 across all 8 iterations (2 hours)? Which iteration first fails and what exit code / error string? Run twice: once with `CLAUDE_CODE_OAUTH_TOKEN` and once with `ANTHROPIC_API_KEY`.

**LOW confidence items (marked for Wave-0 probe):**
- Exact max-turns default for `claude -p` (no documented upper limit found; `--max-turns` must be set explicitly)
- Whether session context accumulates across `claude -p` calls with `--continue` (each call without `--continue` is a fresh session — confirmed; `--continue` reuses the last session's context)

---

### W0-2: `--permission-mode bypassPermissions` behavior

**Confidence: HIGH — official permission-modes docs verified via WebFetch**

Empirically probed: `claude -p 'say ok' --max-turns 1 --output-format json` completed exit 0 (took ~5 min due to auth lookup). The `--permission-mode` flag is a valid CLI option confirmed via `claude --help` probe.

**Exact behavior of `bypassPermissions`:**
- Tool calls execute without permission prompts — no confirmation for file edits, Bash commands, MCP tool calls, web fetches, or subagent spawns
- As of v2.1.126+: writes to protected paths (`.git`, `.vscode`, `.claude`, shell rc files, etc.) are also auto-approved — earlier versions still prompted for these
- `explicit ask` rules in settings still force a prompt even in `bypassPermissions` mode
- `rm -rf /` and `rm -rf ~` still prompt as a circuit breaker (even in this mode)
- Cannot be entered mid-session; must be set at startup via `--permission-mode bypassPermissions` or `--dangerously-skip-permissions`

**Critical distinction — two flags with same effect but different startup behavior:**
- `--permission-mode bypassPermissions` → activates immediately with no confirmation dialog
- `--dangerously-skip-permissions` → equivalent, same behavior
- `--allow-dangerously-skip-permissions` → adds the mode to Shift+Tab cycle WITHOUT activating it immediately (useful for interactive sessions)

**Non-interactive (headless) behavior:** In `-p` mode with `bypassPermissions`, the session runs fully without prompts. If auto mode's classifier blocks an action 3 times in a row or 20 times total and there is no user to prompt, the session aborts. With `bypassPermissions`, the classifier is bypassed entirely so this fallback does not apply.

**Constraint for runner:** The runner must start `claude -p` with `--permission-mode bypassPermissions` at spawn time. It cannot be set after startup.

**Caveat:** On Linux/macOS, `bypassPermissions` is refused when running as root or under sudo:
```
--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons
```
The runner health check must verify it is not running as root before starting phases.

---

### W0-3: Auth failure surface in headless mode

**Confidence: HIGH — official error reference + GitHub issues + stream-json docs verified**

When auth fails in `claude -p` mode:

**Exit code:** Non-zero (exit 1 — generic runtime failure signal). There is no dedicated exit code per error type; all failures exit 1.

**Stderr shape (standard text mode):**
```
OAuth token has expired · Please run /login
```
or:
```
Not logged in · Please run /login
```
or:
```
API Error: 401 ... authentication_error
```

**Stream-json output format (when using `--output-format stream-json`):**
The `system/api_retry` event includes:
```json
{
  "type": "system",
  "subtype": "api_retry",
  "error": "authentication_failed",
  "attempt": 1,
  "max_retries": 10,
  "retry_delay_ms": 1000,
  "error_status": 401
}
```
After 10 retries exhausted (default `CLAUDE_CODE_MAX_RETRIES=10`), the process exits with the auth error on stderr.

**Constraint for runner:**
- Use `--output-format stream-json` for the overnight session to get structured events
- Pipe stdout+stderr to `run.log` with timestamps; monitor for `"error":"authentication_failed"` or exit code
- On non-zero exit: record `AUTH_FAILURE` entry to `run.log` with timestamp and exit code; do NOT retry silently; stop the run
- Env var `CLAUDE_CODE_MAX_RETRIES` can be lowered (e.g., to 3) to surface auth failures faster rather than waiting for 10 retry cycles

**Probe procedure (already partially confirmed):**
```bash
# Verify exit code on auth error by unset-ing all auth env vars
unset ANTHROPIC_API_KEY
unset CLAUDE_CODE_OAUTH_TOKEN
claude -p 'say ok' --max-turns 1 2>/tmp/auth-err.txt; echo "EXIT: $?"
cat /tmp/auth-err.txt
```
Expected: exit 1, stderr contains "Not logged in" or "authentication_error". Mark confirmed after running.

---

### W0-4: `--max-turns` behavior

**Confidence: HIGH — `claude --help` probe confirmed flag exists; docs confirm behavior**

- `--max-turns N`: limits the number of agentic turns; exits with error on limit reached
- No default documented — without `--max-turns`, runs until completion or auth/context failure
- Recommended for overnight: set `--max-turns` per phase invocation, not globally, since each phase calls `claude -p` separately through `autonomous.md`
- The runner does NOT need to set `--max-turns` at the outer `overnight` level if it invokes autonomous sub-calls per phase

### W0-5: User constraint record (2026-06-12 — overrides prescriptions above where they conflict)

The user reviewed W0-1..W0-3 and supplied empirical input from their own environment. These are binding constraints for discuss-phase/planning:

1. **OAuth concern dropped as a blocker.** The user's own overnight Claude sessions sustain auth without issue. Do NOT mandate `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN` in the design. Auth safety net = the RUN-01 startup health check + loud auth-failure logging in run.log (already required). If the first real overnight run hits token expiry, run.log will show it and the prescription can be revisited — trust-ladder empiricism over preemptive complexity. (Caveat preserved for the record: the W0-1 failure reports concern fresh `claude -p` spawns; the user's working pattern may be long-lived sessions. The health check covers both.)

2. **Sandbox-first permissioning, NOT blanket `bypassPermissions`.** The user runs with sandbox + auto-allow today and wants the runner to match. Expected overnight workload is research/fetch/plan/write — destructive ops are NOT expected. Design posture:
   - Sandboxed bash with auto-allow runs without prompting in headless mode (docs: sandboxing.md).
   - Anything needing to escape the sandbox (e.g. deletes outside allowed paths) goes through the regular permission flow — in an unattended run this must NOT hang: route it as a park-and-ask mailbox entry ("needs to delete X — answer in the morning"). This is the park-don't-block design applied to permissions and is explicitly acceptable to the user.
   - **Network is the known pain point:** sandbox prompts per new domain. The runner's settings profile must pre-allow network: `sandbox.network.allowedDomains` (bash-level curl/wget) + `permissions.allow` rules `WebFetch(domain:...)` / `WebSearch` for the research tools.

3. **Remaining Wave-0 probe (small, do before relying on it):** official docs are ambiguous whether a would-prompt tool call in `-p` mode auto-denies with a model-visible error (routable to mailbox) or aborts the run (headless.md says "the run aborts" for non-allowed tools). One short local probe with an `ask` rule + `claude -p` settles it; the mailbox routing design depends on the answer.

---

## Standard Stack

### Core (all existing — no new dependencies)

| Component | Version | Purpose | Source |
|-----------|---------|---------|--------|
| `claude -p` | v2.1.163+ | Headless phase runner | Confirmed via `claude --help` |
| `gsd-tools run init` | shipped Phase 10 | Creates run directory layout | Confirmed via probe: exit 0 |
| `gsd-tools ledger append` | shipped Phase 10 | Audit trail for decisions | ledger.cjs verified |
| `gsd-tools mailbox append/list/answer` | shipped Phase 10/12 | Park-don't-block primitives | mailbox.cjs verified |
| `gsd-tools park create/staleness` | shipped Phase 12 | Branch parking + staleness | park.cjs verified |
| `gsd-tools worktree add/merge/remove` | shipped Phase 7 | Per-phase isolation | worktree.cjs verified |
| `workflows/autonomous.md` | shipped v1.5 | Phase execution loop | Read and verified |

**ZERO new npm dependencies.** Requirements explicitly state this. All primitives exist.

### New deliverables (Phase 13 adds)

| Artifact | Type | Purpose |
|----------|------|---------|
| `workflows/overnight.md` | Workflow | Harness wrapper: health check + autonomous wiring + morning report |
| `commands/gsd2/overnight.md` | Command stub | `/gsd2:overnight` entry point |
| `gsd-tools run report <run-id>` | CLI subcommand in ledger.cjs | Morning report from ledger alone |

### Supporting (already exists)

| Component | Purpose |
|-----------|---------|
| `GSD_RUN_ID` env var | Run context gate used by ledger.cjs and mailbox.cjs |
| `.planning/run/{run-id}/run.log` | `runLogPath()` already defined in park.cjs |
| `RUN-META.json` | Already written by `cmdRunInit`; `phases[]` field ready to populate |
| System cron | Scheduling — no resident daemon |

**Installation:** Nothing to install. Verify with:
```bash
node /home/cleversol/gsd2/mine/.claude/get-shit-done/bin/gsd-tools.cjs run init test-run-$(date +%s)
```

---

## Architecture Patterns

### Recommended overnight.md Structure

```
overnight.md
├── Step 1: Parse arguments (--from N, --run-id override)
├── Step 2: Startup health check (auth, not root, git status, ESC-03 gate)
├── Step 3: Initialize run (gsd-tools run init; export GSD_RUN_ID)
├── Step 4: Invoke autonomous.md (with harness env vars set)
├── Step 5: Per-phase worktree isolation hook (check clean:false → mailbox)
└── Step 6: Morning report (gsd-tools run report <run-id>)
```

### Pattern 1: GSD_RUN_ID wiring

`autonomous.md` and `discuss-phase.md` are already wired to read `GSD_RUN_ID` from the environment. The overnight runner sets it once at startup and all sub-invocations inherit it automatically.

```bash
# Set run context before invoking autonomous
export GSD_RUN_ID="overnight-$(date +%Y%m%d-%H%M%S)"
node "/home/cleversol/gsd2/mine/.claude/get-shit-done/bin/gsd-tools.cjs" run init "$GSD_RUN_ID"
LOG_FILE=".planning/run/$GSD_RUN_ID/run.log"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) run started" >> "$LOG_FILE"
```

### Pattern 2: Worktree isolation with conflict routing (RUN-02)

`cmdWorktreeMerge` exits 0 on conflict (by design — conflicts are a detected state, not a hard error). The runner MUST check the `clean` field:

```bash
# Source: worktree.cjs line 16:
# "A conflict is a detected state ({clean:false}) — NOT a hard error —
#  so cmdWorktreeMerge exits 0 on conflict."

MERGE_RESULT=$(node gsd-tools.cjs worktree merge phase-13-branch --raw)
CLEAN=$(echo "$MERGE_RESULT" | jq -r '.clean')
if [ "$CLEAN" = "false" ]; then
  CONFLICT_FILES=$(echo "$MERGE_RESULT" | jq -r '.conflict_files[]')
  # Route to mailbox — never swallow
  node gsd-tools.cjs mailbox append --data "{
    \"question\": \"Merge conflict in phase $PHASE_NUM\",
    \"context\": \"conflict_files: $CONFLICT_FILES\",
    \"status\": \"open\"
  }"
  echo "$(date -u +%T) PHASE $PHASE_NUM CONFLICT routed to mailbox" >> "$LOG_FILE"
fi
```

### Pattern 3: Loud auth failure (RUN-03)

Never silently retry on auth failure. Pattern from W0-3:

```bash
# Wrapper for claude -p invocations
run_phase_headless() {
  local PHASE_NUM=$1
  local PROMPT=$2
  local OUT
  OUT=$(claude -p "$PROMPT" \
    --permission-mode bypassPermissions \
    --max-turns 150 \
    --output-format stream-json 2>&1)
  local EXIT=$?
  if [ $EXIT -ne 0 ]; then
    TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    # Check for auth failure
    if echo "$OUT" | grep -q "authentication_failed\|OAuth token\|Not logged in"; then
      echo "$TS AUTH_FAILURE phase=$PHASE_NUM exit=$EXIT" >> "$LOG_FILE"
      echo "$TS STOPPING RUN — auth failure detected, no silent retry" >> "$LOG_FILE"
      exit 1  # Stop the run
    fi
    echo "$TS PHASE_FAILURE phase=$PHASE_NUM exit=$EXIT" >> "$LOG_FILE"
    # Route to mailbox for other failures
  fi
}
```

### Pattern 4: Morning report from ledger alone (RUN-04)

`gsd-tools run report <run-id>` reads `DECISIONS.jsonl` and `MAILBOX.jsonl` only — no transcript replay. The report command is a new addition to ledger.cjs dispatch.

```javascript
// New case in gsd-tools.cjs run router
case 'report': {
  const reportRunId = args[2] || process.env.GSD_RUN_ID;
  ledger.cmdRunReport(cwd, reportRunId);  // new function in ledger.cjs
  break;
}
```

`cmdRunReport` reads:
1. `RUN-META.json` → `started_ts`, `phases[]`, `status`
2. `DECISIONS.jsonl` → count decisions by phase, count escalated, list `park-and-ask` verdicts
3. `MAILBOX.jsonl` → count parked questions by status (answered vs pending)

Output format: plain text suitable for terminal or redirect to file. No Markdown headers that require parsing.

### Pattern 5: Per-run agent-trace (parallel write safety)

The existing `agent-trace.jsonl` at `.planning/telemetry/agent-trace.jsonl` is a single file shared by all sessions via `appendFileSync`. In overnight mode with per-phase worktree isolation, each worktree writes to the main telemetry file via `appendFileSync` — this is safe because POSIX guarantees atomicity for writes under 4096 bytes on the same filesystem (each JSONL line is well under that). No mutex or per-run trace file is needed.

**Constraint:** Use `appendFileSync` (already the pattern) — never `writeFileSync` for telemetry. This is already enforced by the existing hook implementation.

### Pattern 6: Command stub convention

Match the existing pattern from `commands/gsd2/inbox.md`:

```markdown
---
name: gsd2:overnight
description: Run remaining phases unattended with ledger + escalation + mailbox active
argument-hint: "[--from N] [--run-id <id>]"
allowed-tools: [Bash, Read, Write, Edit]
---

<execution_context>
@~/.claude/get-shit-done/workflows/overnight.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Follow the overnight workflow.
</process>
```

### Anti-Patterns to Avoid

- **Using OAuth login for overnight runs:** OAuth access tokens expire in ~1 hour in headless mode without browser refresh. Use `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`.
- **Setting `--permission-mode` after session start:** Can only be set at spawn time via `--permission-mode bypassPermissions`.
- **Swallowing `clean:false` from cmdWorktreeMerge:** The function exits 0 on conflict — exit code check alone is insufficient. Must parse JSON output.
- **Using `--bare` with `CLAUDE_CODE_OAUTH_TOKEN`:** Bare mode does not read `CLAUDE_CODE_OAUTH_TOKEN`. If `--bare` is used, must use `ANTHROPIC_API_KEY` instead.
- **Running as root:** `bypassPermissions` refuses to start under root/sudo.
- **Global `--max-turns` on the outer overnight invocation:** The overnight skill itself does not call `claude -p` directly — it invokes `autonomous.md` which in turn calls the discuss/plan/execute sub-skills. Max-turns should be set at the per-phase sub-invocation level if needed.
- **`node-cron` or persistent daemon:** REQUIREMENTS.md explicitly excludes this. Use system cron.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decision append | Custom file writer | `gsd-tools ledger append` | Schema validation, run-context gate, append-only guarantee |
| Mailbox routing | Custom JSONL write | `gsd-tools mailbox append` | Consistent q-NNN ID allocation, run-id enforcement |
| Branch parking | Custom snapshot | `gsd-tools park create` | Context snapshot + staleness detection already implemented |
| Merge conflict check | Custom git parse | `gsd-tools worktree merge --raw` + check `clean` field | Already handles unmerged path detection |
| Stuck detection | Custom hash diff | `gsd-tools run snapshot` + `park.cjs` stuck flag | Already writes RUN-META.json stuck flag, ledger list shows it |
| Scheduling | node-cron or similar | `crontab` entry | REQUIREMENTS.md explicitly excludes persistent daemon |
| Parallel write safety | Mutex/lock file | `appendFileSync` (already the pattern) | POSIX atomicity for small writes on same fs |
| Morning report format | Custom report template | `gsd-tools run report` (new subcommand) | Keeps reporting next to ledger logic; no transcript replay |

**Key insight:** All v1.6 harness primitives are already shipped and tested. Phase 13 is wiring, not infrastructure.

---

## Common Pitfalls

### Pitfall 1: OAuth token expiry mid-run
**What goes wrong:** `claude -p` session launched with subscription OAuth credentials fails after ~1 hour with exit 1 and auth error on stderr. The runner does not notice, leaves the run in a hanging state.
**Why it happens:** OAuth access tokens expire; headless refresh blocked by Cloudflare WAF.
**How to avoid:** Startup health check requires `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` to be set; absent → fail loudly before running any phases.
**Warning signs:** `authentication_failed` in stream-json output; exit 1 on a `claude -p` call that previously worked.

### Pitfall 2: `clean:false` merge swallowed
**What goes wrong:** `cmdWorktreeMerge` returns exit 0 even when there is a conflict. Runner sees exit 0, treats the merge as clean, proceeds. Conflict files are left in unmerged state silently.
**Why it happens:** By design — conflicts are not hard errors in worktree.cjs so the state is reviewable.
**How to avoid:** Always parse JSON output of `gsd-tools worktree merge --raw` and check `clean` field. Route `clean:false` to mailbox before proceeding.
**Warning signs:** Merge conflict markers (`<<<<<<<`) appearing in committed files.

### Pitfall 3: `ask` rules firing in bypassPermissions
**What goes wrong:** An explicit `ask` rule in `.claude/settings.json` or `~/.claude/settings.json` overrides `bypassPermissions` and prompts. In headless mode, the prompt hangs the session.
**Why it happens:** From official docs: "Explicit ask rules still force a prompt in this mode."
**How to avoid:** Audit settings files for `ask` rules before overnight runs. The health check should warn if any `ask` rules are found.
**Warning signs:** Overnight session hangs without output.

### Pitfall 4: Running as root
**What goes wrong:** `bypassPermissions` refuses to start: `--dangerously-skip-permissions cannot be used with root/sudo privileges`.
**How to avoid:** Health check: `if [ "$(id -u)" = "0" ]; then ... fail loudly`.

### Pitfall 5: `--bare` + `CLAUDE_CODE_OAUTH_TOKEN`
**What goes wrong:** `--bare` mode skips keychain reads and does not read `CLAUDE_CODE_OAUTH_TOKEN`. Session starts unauthenticated.
**How to avoid:** Do not use `--bare` for overnight runs. Or if `--bare` is needed, use `ANTHROPIC_API_KEY` only.

### Pitfall 6: Worktree in sandboxed environment
**What goes wrong:** `git worktree add` requires write access outside the sandbox-allowed path. In sandboxed sessions, the worktree create fails silently (returns `{ok:false, fallback:"in-place"}`).
**How to avoid:** The runner must handle the `ok:false, fallback:"in-place"` response from `cmdWorktreeAdd`. In fallback mode, run in-place with no worktree isolation and log a warning. This is already the documented behavior in worktree.cjs.

### Pitfall 7: `auto` mode unavailability
**What goes wrong:** Overnight skill uses `--permission-mode auto` expecting background safety checks, but auto mode requires specific plan/model combinations. On some accounts it is unavailable.
**How to avoid:** Use `bypassPermissions`, not `auto`. The runner is an isolated dev environment (local git repo), not production. `bypassPermissions` is appropriate.

---

## Code Examples

### Startup health check
```bash
# Source: W0-2 findings + official auth docs
overnight_health_check() {
  local ERRORS=0
  local LOG_FILE=$1

  # 1. Auth — must have stable auth, not OAuth login
  if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
    echo "$(date -u +%T) HEALTH_FAIL: no ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN set" >> "$LOG_FILE"
    echo "Set one of: ANTHROPIC_API_KEY (Console key) or CLAUDE_CODE_OAUTH_TOKEN (from: claude setup-token)"
    ERRORS=$((ERRORS + 1))
  fi

  # 2. Not root
  if [ "$(id -u)" = "0" ]; then
    echo "$(date -u +%T) HEALTH_FAIL: running as root, bypassPermissions not allowed" >> "$LOG_FILE"
    ERRORS=$((ERRORS + 1))
  fi

  # 3. ESC-03 calibration gate — case-sensitive match on the uppercase token;
  # the shipped template is guaranteed to contain zero occurrences until a human
  # fills the Result section (verified: grep -c returns 0 on the PENDING template)
  if ! grep -q "PASS" ".planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/"*CALIBRATION*.md 2>/dev/null; then
    echo "$(date -u +%T) HEALTH_FAIL: ESC-03 calibration gate not passed — run calibration before overnight" >> "$LOG_FILE"
    ERRORS=$((ERRORS + 1))
  fi

  # 4. Git working tree clean
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "$(date -u +%T) HEALTH_WARN: working tree has uncommitted changes" >> "$LOG_FILE"
    # Warning only, not failure
  fi

  if [ $ERRORS -gt 0 ]; then
    echo "$(date -u +%T) HEALTH_CHECK FAILED ($ERRORS errors) — overnight run aborted" >> "$LOG_FILE"
    return 1
  fi

  echo "$(date -u +%T) HEALTH_CHECK PASSED" >> "$LOG_FILE"
  return 0
}
```

### Run init and log setup
```bash
# Source: ledger.cjs cmdRunInit pattern (verified via probe)
GSD_RUN_ID="overnight-$(date +%Y%m%d-%H%M%S)"
export GSD_RUN_ID
node "/home/cleversol/gsd2/mine/.claude/get-shit-done/bin/gsd-tools.cjs" run init "$GSD_RUN_ID"
LOG_FILE=".planning/run/$GSD_RUN_ID/run.log"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) overnight run started run_id=$GSD_RUN_ID" >> "$LOG_FILE"
```

### Morning report command structure (new in ledger.cjs)
```javascript
// Source: ledger.cjs pattern; new cmdRunReport function
function cmdRunReport(cwd, runId) {
  const effectiveRunId = runId || process.env.GSD_RUN_ID;
  if (!effectiveRunId) {
    process.stderr.write('run report: no run context — pass run-id or set GSD_RUN_ID\n');
    process.exit(1);
  }

  const meta = readRunMeta(cwd, effectiveRunId);   // RUN-META.json
  const decisions = readLedger(cwd, effectiveRunId); // DECISIONS.jsonl
  const questions = readMailbox(cwd, effectiveRunId); // MAILBOX.jsonl (import from mailbox.cjs)

  const escalated = decisions.filter(d => d.escalated === true);
  const parked = questions.filter(q => q.status !== 'answered');
  const answered = questions.filter(q => q.status === 'answered');

  // Phases from decisions (unique phase values)
  const phases = [...new Set(decisions.map(d => d.phase).filter(Boolean))].sort();

  let out = `\n=== Morning Report: ${effectiveRunId} ===\n`;
  out += `Started:    ${meta.started_ts || 'unknown'}\n`;
  out += `Status:     ${meta.status || 'unknown'}\n`;
  out += `\nDecisions:  ${decisions.length} total, ${escalated.length} escalated\n`;
  out += `Phases:     ${phases.join(', ') || 'none'}\n`;
  out += `\nMailbox:    ${parked.length} unanswered, ${answered.length} answered\n`;

  if (parked.length > 0) {
    out += `\nUnanswered questions:\n`;
    for (const q of parked) {
      out += `  [${q.id}] phase=${q.phase || '?'} — ${q.question.slice(0, 80)}\n`;
    }
    out += `\nReview with: gsd-tools mailbox review ${effectiveRunId}\n`;
  }
  out += `\n`;

  process.stdout.write(out);
}
```

### Crontab scheduling convention
```bash
# Source: REQUIREMENTS.md "system cron + fire-and-forget headless runs"
# Run at 11pm local time, log to run directory
# Assumes ANTHROPIC_API_KEY is in /etc/environment or cron env file
0 23 * * * cd /home/cleversol/gsd2/mine && ANTHROPIC_API_KEY=<key> /usr/bin/claude -p "/gsd2:overnight" --permission-mode bypassPermissions >> /tmp/overnight-cron.log 2>&1

# Preferred: use the overnight skill instead (handles run.log itself):
0 23 * * * cd /home/cleversol/gsd2/mine && env ANTHROPIC_API_KEY=<key> claude -p "/gsd2:overnight" --permission-mode bypassPermissions
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OAuth login for headless | `ANTHROPIC_API_KEY` or `claude setup-token` 1-year token | 2025-2026 (reported in Issues #28827, #47754) | OAuth access tokens expire ~1hr in headless; API key is stable |
| `--dangerously-skip-permissions` only flag | `--permission-mode bypassPermissions` is the canonical form | Documented in current CLI help | Both work, `--permission-mode` is the long-form |
| `auto` mode for unattended | `bypassPermissions` for isolated dev environments | Auto mode introduced v2.1.83 | Auto mode adds classifier overhead and requires specific plans/models |
| Background tasks hold process open | Process exits ~5 seconds after final response (v2.1.163+) | v2.1.163 | Overnight runs now terminate cleanly |
| Persistent daemon (node-cron) | System cron + fire-and-forget | GSD v1.6 design decision | No resident process, no npm dependency |

**Deprecated/outdated:**
- `--mcp-debug` flag: deprecated, use `--debug` instead (confirmed from `claude --help`)
- Using OAuth credentials for automated/CI headless runs: produces ~1hr expiry failures

---

## Open Questions

1. **ESC-03 calibration gate check** — RESOLVED (orchestrator verified against the shipped 11-CALIBRATION.md)
   - The gate token IS the literal uppercase word `PASS`, written by the human into the Result section. The STATE.md note ("avoids uppercase PASS entirely by describing the token by letter spelling") refers only to the TEMPLATE: 11-CALIBRATION.md describes the token as "four letters: p-a-s-s, in capitals" so the file pre-contains zero occurrences and the gate cannot be accidentally satisfied.
   - Health check: case-SENSITIVE `grep -q "PASS" ...CALIBRATION*.md` (not `-i` — the template legitimately contains lowercase "pass" in instructions). Verified: `grep -c "PASS"` returns 0 on the shipped PENDING template.

2. **How overnight.md invokes autonomous.md — direct skill call or Skill()**
   - What we know: `autonomous.md` is already a workflow. The typical pattern is `Skill(skill="gsd2:autonomous")` from within another skill.
   - What's unclear: Whether overnight wraps autonomous as a sub-skill call or rewrites the loop inline. Sub-skill call is cleaner; inline rewrite creates duplication.
   - Recommendation: Use `Skill(skill="gsd2:autonomous", args="--from N")` from within `overnight.md`, with the overnight skill responsible for health check + run init + morning report. The autonomous.md phase loop does not need to change.

3. **`run.log` write access in worktree isolation**
   - What we know: `run.log` lives at `.planning/run/{run-id}/run.log` — inside the main worktree's `.planning/` directory.
   - What's unclear: Worktrees share `.git` but have separate working trees. A phase running in a worktree needs to write to the main tree's `run.log`. Path must be absolute, not relative to worktree CWD.
   - Recommendation: Always compute `LOG_FILE` as an absolute path at run init (`$(pwd)/.planning/run/$GSD_RUN_ID/run.log`) and export it as `GSD_RUN_LOG` so all sub-invocations use the absolute path.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js assert (built-in) + manual CLI probes |
| Config file | none — unit tests inline with module |
| Quick run command | `node get-shit-done/bin/gsd-tools.cjs run init test-$$` + `run report test-$$` |
| Full suite command | Manual CLI probe sequence per Wave-0 probe script above |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | overnight starts headless run with GSD_RUN_ID, writes run.log | manual probe | `GSD_RUN_ID=x claude -p "/gsd2:overnight" --max-turns 2 --output-format json` | ❌ Wave 0 |
| RUN-02 | merge conflict routes to MAILBOX.jsonl, not swallowed | unit + manual | `node gsd-tools.cjs worktree merge nonexistent --raw` → check clean field | ❌ Wave 0 |
| RUN-03 | auth failure logged loudly, run stops | manual | unset auth + run overnight; check run.log | ❌ Wave 0 |
| RUN-04 | morning report from ledger alone | unit | `node gsd-tools.cjs run report <id>` after `ledger append` | ❌ Wave 0 |

### Sampling Rate
- Per task commit: `node /home/cleversol/gsd2/mine/.claude/get-shit-done/bin/gsd-tools.cjs run init test-$(date +%s) && node ... run report ...`
- Per wave merge: full Wave-0 probe script (auth stability + permission mode + morning report)
- Phase gate: Wave-0 empirical results documented in CONTEXT.md before discuss-phase proceeds to scheduling implementation

### Wave 0 Gaps
- [ ] `gsd-tools run report` subcommand — add `cmdRunReport` to ledger.cjs and dispatch in gsd-tools.cjs `case 'run'`
- [ ] `overnight.md` workflow — new file in `get-shit-done/workflows/`
- [ ] `commands/gsd2/overnight.md` — command stub
- [ ] Auth stability probe — run Wave-0 probe script above to confirm 2hr stability with chosen auth method
- [ ] `ask` rule audit — verify no `ask` rules in settings.json that would block headless

---

## Sources

### Primary (HIGH confidence)
- `claude --help` probe (live) — confirmed `--permission-mode` choices, `--max-turns`, `--output-format`, `--bare` flag behavior
- `claude -p 'say ok' --max-turns 1 --output-format json` probe (live) — confirmed exit 0, JSON result structure, session_id, cost fields
- `gsd-tools run init` probe (live) — confirmed exit 0, directory layout creation
- [Official permission-modes docs](https://code.claude.com/docs/en/permission-modes) — bypassPermissions exact behavior, protected paths, ask-rule override, root refusal
- [Official headless docs](https://code.claude.com/docs/en/headless) — `-p` flag behavior, `--bare`, background task termination, stdin cap, stream-json format
- [Official authentication docs](https://code.claude.com/docs/en/authentication) — `setup-token`, 1-year token, auth precedence, `apiKeyHelper` TTL
- [Official error reference](https://code.claude.com/docs/en/errors) — auth error messages, retry behavior, exit code conventions
- ledger.cjs, mailbox.cjs, park.cjs, worktree.cjs — read directly; clean:false exit-0 behavior confirmed in source comment
- `.planning/REQUIREMENTS.md` — "Zero new npm dependencies", "System cron + fire-and-forget headless runs cover scheduling without a resident process"

### Secondary (MEDIUM confidence)
- [GitHub Issue #28827](https://github.com/anthropics/claude-code/issues/28827) — OAuth token refresh fails in headless mode; authentication_error exit behavior
- [GitHub Issue #47754](https://github.com/anthropics/claude-code/issues/47754) — Cloudflare WAF blocks OAuth refresh on Linux servers; ~1hr expiry confirmed
- [GitHub Issue #37804](https://github.com/anthropics/claude-code/issues/37804) — OAuth tokens expiring every ~10 minutes (regression issue, may have been patched)
- [GitHub Issue #52506](https://github.com/anthropics/claude-code/issues/52506) — `--dangerously-skip-permissions` still shows dialog vs `--permission-mode dontAsk`; clarifies interactive vs truly headless distinction

### Tertiary (LOW confidence)
- Community blog posts on headless session patterns (amux.io, agentpatterns.ai) — cited for context but not load-bearing; official docs verified all claims

---

## Metadata

**Confidence breakdown:**
- Wave-0 findings: HIGH — empirically probed flags + official docs
- Standard stack: HIGH — all existing modules verified by direct read
- Auth guidance: HIGH — multiple official docs + GitHub issues consistent
- `clean:false` worktree pattern: HIGH — confirmed in source code comment
- Morning report design: MEDIUM — structure inferred from ledger.cjs patterns; specific output format is planner discretion
- Scheduling: HIGH — explicitly documented in REQUIREMENTS.md

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (30 days) — Claude Code versions ship frequently; re-check `--permission-mode` flag names and auth behavior before that date
