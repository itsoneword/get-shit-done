# Phase 1: Security Hooks - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Port a defense-in-depth hook layer of standalone guard hooks into `hooks/`, config-gated and namespace-clean, with no TypeScript or core-lib dependency (SEC-01..04). Hooks scan for prompt injection at write-time and read-time and nudge read-before-edit for non-Claude runtimes.

**Scope reduced during discussion:** the layer ships **3 advisory JS hooks**, not 4. `worktree-path-guard` (the only hard-blocker) is excluded — the user doesn't rely on worktree isolation and nothing else depends on it. `validate-commit` (bash) remains out of scope. Both are deferred (see Deferred Ideas).

**Detected domain:** Generic
**Evidence:** tooling/CLI phase — hooks, build wiring (`scripts/build-hooks.js`), install wiring (`bin/install.js`), `.planning/config.json` gating. No UI (`src/components`, `*.tsx`) or agentic (`agents/`, `workflows/`) structural signals.
**Confirmed by user:** not prompted (LOW confidence → Generic, per workflow rule)

</domain>

<established>
## Established Patterns (from codebase)

- **Hook anatomy** — every fork/core hook is pure Node: `#!/usr/bin/env node`, `// gsd-hook-version: {{GSD_VERSION}}` stamp, stdin-JSON parse with a 3–5s timeout, silent-fail (`process.exit(0)`) on any error so a hook never blocks tool execution. Advisory output via `{hookSpecificOutput:{hookEventName, additionalContext}}`; hard-block via `{decision:'block', reason}` + `process.exit(2)`. The 3 hooks being ported already follow this exactly → SEC-04 (pure standalone JS, no lib/build dep) is satisfied by copying them.
- **Build wiring** — `scripts/build-hooks.js` copies a hardcoded `HOOKS_TO_COPY` array to `hooks/dist/`, syntax-checking each with `vm.Script` (guards the duplicate-`const` shipping bug, #1107) and stamping `{{GSD_VERSION}}`. Adding hooks = adding array entries.
- **Install wiring** — `bin/install.js` registers hooks by pushing `{matcher, hooks:[{type:'command', command, timeout}]}` entries into `settings.hooks[event]`. SessionStart + PostToolUse blocks already exist for the current 4 hooks. `cleanupOrphanedHooks()` + an `orphanedHookPatterns` list already remove renamed/removed hooks from settings on upgrade — this is the migration hook for the rename.
- **Self-gating precedent** — `hooks/gsd-workflow-guard.js` reads `.planning/config.json` and `process.exit(0)`s when its config key is falsy (default OFF). This is the exact pattern SEC-03 extends — gate lives **inside** each hook, registration in install.js stays unconditional.

</established>

<decisions>
## Implementation Decisions

### Naming / namespace
- **All hooks renamed to the `gsd2-*` convention** — new security hooks AND the existing 4. New: `gsd2-prompt-guard.js`, `gsd2-read-injection-scanner.js`, `gsd2-read-guard.js`. Renamed existing: `gsd2-statusline.js`, `gsd2-check-update.js`, `gsd2-context-monitor.js`, `gsd2-workflow-guard.js`. [STRONG — user: "all renamed to gsd2, easier to understand it's mine, not core. if something in mine still has gsd it should be renamed"]
- Rationale: the fork's hooks currently share filenames with gsd-core (`gsd-*`), so they collide in a shared `~/.claude/hooks/`. `gsd2-*` makes ownership unambiguous and collision-safe.
- **Upgrade migration is mandatory:** install.js must add the old `gsd-*` filenames to orphan cleanup so existing users' `settings.json` registrations are removed, then register the `gsd2-*` names — otherwise users get duplicate/orphaned hooks. The renamed `gsd-*.js` files in `hooks/` and `hooks/dist/` must be removed/replaced, and every internal reference updated (build-hooks `HOOKS_TO_COPY`, install.js registration + statusline command, any check-update worker / managed-hooks list). [STRONG — integration requirement flowing from the rename]

### Per-hook posture (SEC-03)
- `gsd2-prompt-guard` — advisory, **default ON**, gate `hooks.prompt_guard`. [STRONG — confirmed from recommended matrix]
- `gsd2-read-injection-scanner` — advisory, **default ON**, gate `hooks.read_injection_scanner`. [STRONG]
- `gsd2-read-guard` — advisory, **opt-in (default OFF)**, gate `hooks.read_guard`. [STRONG — user picked "scanners on, read-guard opt-in"]
- Reasoning carried into the decision: `read-guard` self-skips on Claude Code (only helps non-Claude runtimes like OpenCode/Gemini), so default-off costs Claude users nothing.

### Config gating mechanism (SEC-03)
- Extend the `gsd-workflow-guard` precedent: **register unconditionally in install.js; gate at runtime inside each hook** by reading `.planning/config.json`. Keeps SEC-04 (pure JS, no shared lib) intact. [STRONG, specialist-backed — established fork pattern]
- **Default semantics differ by posture** and must be implemented precisely:
  - Default-ON hooks (`prompt_guard`, `read_injection_scanner`): run UNLESS the key is explicitly `false`. Absence of `.planning/config.json` or of the key = ON (security defaults on). This is the *inverse* of workflow-guard's "exit if missing" logic.
  - Opt-in hook (`read_guard`): run ONLY when the key is explicitly `true` (mirror workflow-guard exactly).
- Config keys namespaced under `hooks.*` in `.planning/config.json`, matching the existing `hooks.workflow_guard` key.

### Matchers (from core's proven registration)
- `gsd2-prompt-guard`: PreToolUse, matcher `Write|Edit`
- `gsd2-read-injection-scanner`: PostToolUse, matcher `Read`
- `gsd2-read-guard`: PreToolUse, matcher `Write|Edit`
- (Gemini/Antigravity use `BeforeTool`/`AfterTool` instead of `PreToolUse`/`PostToolUse` — install.js already maps this for existing hooks; reuse that mapping.)

### Scope exclusions (decided this session)
- **worktree-path-guard excluded from Phase 1.** [user: "I can use worktrees in general, but never had any problems with that, so no prefs. we can simply exclude this req if it is not critical for other functionality"] It's standalone — no other functionality depends on it — so exclusion is clean. SEC-01 amended to 3 hooks; worktree-guard moved to a deferred requirement. Net effect: Phase 1 ships **no hard-blocker**, all 3 hooks advisory.
- **validate-commit (bash) deferred.** [user: "same as worktree guards, can be postponed, not actively used"] Already outside SEC scope; confirmed out.

### Folded Todos
- None folded. Related todo `2026-03-22-update-command-should-sync-project-local-hooks` overlaps (the rename's upgrade-migration concern is adjacent to "update should sync project-local hooks") but is a broader `update`-command task — left as its own todo, not folded.

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** After installing the fork, a user has 3 advisory security hooks present in `hooks/dist/` and registered in `.claude/settings.json` under `gsd2-*` filenames. All 7 GSD hooks (3 new + 4 renamed) use the `gsd2-*` convention. Each new hook can be toggled via a `hooks.*` key in `.planning/config.json`; the two scanners are on by default, read-guard is off until enabled.
- **Success signal:** `npm run build:hooks` produces all hooks in `hooks/dist/` with no syntax errors; a fresh `gsd2 --claude --local` install registers the `gsd2-*` hooks (PreToolUse + PostToolUse) and removes any stale `gsd-*` registrations; toggling a config key flips a hook on/off with no other change; hooks run with zero new runtime dependencies.
- **Flow:** user installs/upgrades → install.js cleans old `gsd-*` registrations and registers `gsd2-*` → during a session, writes to `.planning/` and Read outputs are scanned, warnings injected advisory-only → user can disable any hook (or enable read-guard) via `.planning/config.json`.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Security Hooks (SEC) — SEC-01..04; note SEC-01 amended this session to 3 hooks (worktree-guard moved to Future/deferred)
- `.planning/ROADMAP.md` §"Phase 1: Security Hooks" — goal, success criteria (amended to 3 hooks), discussion focus

### Source hooks to port (gsd-core — copy + adapt naming/gating)
- `/home/cleversol/gsd2/core/hooks/gsd-prompt-guard.js` — PreToolUse Write/Edit scanner of `.planning/` writes; INJECTION_PATTERNS + invisible-unicode; advisory output shape
- `/home/cleversol/gsd2/core/hooks/gsd-read-injection-scanner.js` — PostToolUse Read scanner; INJECTION + SUMMARISATION + MARKDOWN_LINK patterns, LOW/HIGH severity, `isExcludedPath` false-positive list, tool_response string/object extraction
- `/home/cleversol/gsd2/core/hooks/gsd-read-guard.js` — PreToolUse Write/Edit read-before-edit advisory; Claude-Code self-skip detection (`session_id` / `CLAUDE_CODE_*` env)
- `/home/cleversol/gsd2/core/bin/install.js` lines ~9849–9988 — core's registration blocks (matchers, timeouts, idempotency `.some()` checks) for the 3 hooks
- `/home/cleversol/gsd2/core/hooks/managed-hooks-registry.cjs` — core's authoritative hook list pattern (reference for whether the fork needs an equivalent after rename)

### Fork integration points (must edit)
- `scripts/build-hooks.js` — `HOOKS_TO_COPY` array
- `bin/install.js` — registration (~line 3113+), `cleanupOrphanedHooks` + `orphanedHookPatterns` (~line 1931), statusline/update/context-monitor command builders (~line 3118)
- `hooks/gsd-workflow-guard.js` — the self-gating template to mirror
- `.planning/config.json` — `hooks.*` key namespace

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-workflow-guard.js` self-gate block (reads `.planning/config.json`, exits on falsy key) — copy/invert per hook for the config gate.
- `buildHookCommand(configDir, hookName)` in install.js — already builds cross-platform `node "<path>"` commands; reuse for the 3 new hooks.
- `cleanupOrphanedHooks()` + `orphanedHookPatterns` in install.js — the existing mechanism for dropping renamed hooks from settings.json on upgrade; extend it with the old `gsd-*` names.
- `validateSyntax()` (vm.Script) in build-hooks.js — already runs on every copied hook; no change needed beyond array entries.

### Established Patterns
- Advisory hooks emit `hookSpecificOutput.additionalContext`; never `exit 2`. All 3 ported hooks are advisory → no `decision:'block'` paths ship this phase.
- Install registration is idempotent via `settings.hooks[event].some(entry => …command.includes('<name>'))` guards — replicate for new hooks so re-install doesn't duplicate.
- Runtime event-name mapping (`PreToolUse`→`BeforeTool`, `PostToolUse`→`AfterTool` for gemini/antigravity) already exists — reuse, don't reinvent.

### Integration Points
- **build-hooks.js** `HOOKS_TO_COPY`: rename 4 existing + add 3 new = 7 `gsd2-*` entries; delete stale `gsd-*` from `hooks/` and `hooks/dist/`.
- **install.js** registration: new PreToolUse block (`Write|Edit` → prompt-guard, read-guard) + PostToolUse `Read` → read-injection-scanner; update existing SessionStart/PostToolUse/statusline commands to `gsd2-*`; add old `gsd-*` filenames to orphan cleanup.
- **config.json**: `hooks.prompt_guard`, `hooks.read_injection_scanner`, `hooks.read_guard` (+ existing `hooks.workflow_guard`).
- **Risk surface:** the rename touches update-detection / statusline / orphan-cleanup beyond the security hooks themselves. Researcher should grep the full repo for the 4 existing hook filenames to find every reference before renaming.

</code_context>

<specifics>
## Specific Ideas

- User wants unambiguous ownership: "easier to understand it's mine, not core." Drives the blanket `gsd2-*` rename rather than only namespacing the 3 new files.
- User does not work heavily with git worktrees and has never hit the out-of-worktree-edit issue (#260) — hence dropping the hard-blocker without hesitation.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-03-22-update-command-should-sync-project-local-hooks` — adjacent (the rename surfaces an upgrade-sync need) but broader `/gsd2:update` work; kept separate.

### Out-of-phase
- **worktree-path-guard** (hard-block, PreToolUse `Write|Edit|MultiEdit`, exit 2 on abs paths escaping a linked worktree) — excluded from Phase 1; source at `/home/cleversol/gsd2/core/hooks/gsd-worktree-path-guard.js`. Revisit if worktree-isolated execution becomes routine. Moved to a Future requirement in REQUIREMENTS.md.
- **gsd-validate-commit.sh** (bash, Conventional Commits hard-block) — out of SEC scope; larger surface (`secure-phase`/security-auditor territory per Out of Scope table).

</deferred>

---

*Phase: 01-security-hooks*
*Context gathered: 2026-06-03*
