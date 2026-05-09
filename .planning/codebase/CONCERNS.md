# Codebase Concerns
**Analysis Date:** 2026-03-21

## Tech Debt

**Homegrown YAML parser with known fragility:**

- Issue: `get-shit-done/bin/lib/frontmatter.cjs` implements a custom YAML parser from scratch using an indent-tracking stack. It handles nested objects, inline arrays, and array-item conversion but cannot parse multi-line string values, quoted strings containing colons in nested positions, or YAML anchors/aliases.
- Impact: Malformed frontmatter in any PLAN.md or SUMMARY.md silently returns a partial parse. The comment at line 15 acknowledges a corruption recovery path (`allBlocks.at(-1)` on CRLF duplicates), indicating this has already caused data integrity issues in the field.
- Fix: Replace with `js-yaml` (no transitive deps, well-tested). The custom parser was likely written to avoid adding npm dependencies, but the fragility cost is high given how central frontmatter is to every GSD operation.

**Config key whitelist is incomplete and diverges from actual supported keys:**

- Issue: `get-shit-done/bin/lib/config.cjs` `VALID_CONFIG_KEYS` (lines 14-23) rejects `config-set` calls for `context_window`, `resolve_model_ids`, `phase_naming`, and `hooks.*` — all keys that `loadConfig()` in `core.cjs` reads and acts on. `hooks.workflow_guard` and `hooks.context_warnings`, read by the hooks, are entirely absent from the whitelist.
- Impact: Users who find these config options in docs or source must hand-edit `.planning/config.json` directly, bypassing validation. `config-set context_window 1000000` exits with an "Unknown config key" error.
- Fix: Add `context_window`, `resolve_model_ids`, `phase_naming`, `hooks.workflow_guard`, `hooks.context_warnings` to `VALID_CONFIG_KEYS` in `get-shit-done/bin/lib/config.cjs`.

**Hardcoded model version strings that go stale:**

- Issue: `get-shit-done/bin/lib/core.cjs` `MODEL_ALIAS_MAP` (lines 614-618) maps `opus` → `claude-opus-4-0`, `sonnet` → `claude-sonnet-4-5`, `haiku` → `claude-haiku-3-5`. These are pinned IDs that become outdated as Anthropic releases new models.
- Impact: When `resolve_model_ids: true` is enabled, the CLI resolves aliases to stale model IDs, causing 404 API errors. Default behavior (passing aliases) is not affected, but the feature silently breaks on each model generation.
- Fix: Either derive model IDs from the API at runtime, or document that `resolve_model_ids` requires a `MODEL_ALIAS_MAP` update on each GSD release. Expose `model_overrides` in user docs as the safer alternative.

**Duplicate progress-counting logic between `cmdProgressRender` and `cmdStats`:**

- Issue: Both `commands.cjs` `cmdProgressRender` (line 390) and `cmdStats` (line 667) independently read phase directories, count plans/summaries, and compute completion percentages. The two implementations use subtly different phase number regex patterns: `cmdProgressRender` uses `/^(\d+(?:\.\d+)*)-?(.*)/` while `cmdStats` uses `/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i`. This means letter-suffix phases (e.g., `12A`) are handled differently by each command.
- Impact: `cmdProgressRender` strips letter-suffix phases from display names; `cmdStats` handles them correctly. Divergence risk grows with each change to either function.
- Fix: Extract a shared `collectPhaseStats(cwd, options)` helper in `core.cjs` and call it from both commands.

**`extractCurrentMilestone` fallback silently degrades to regex stripping:**

- Issue: `core.cjs` `extractCurrentMilestone` (line 485) has two fallback paths that call `stripShippedMilestones()` when it cannot positively locate the current milestone section. When STATE.md is missing or the milestone version is not found in ROADMAP.md, the function falls back to a negative heuristic (strip `<details>` blocks) that the inline comment at line 471 describes as fragile.
- Impact: Phase completion writes (`cmdPhaseComplete`, `replaceInCurrentMilestone`) may accidentally modify archived milestone content if the positive lookup fails. This is a silent data corruption path that would be difficult to detect.
- Fix: Emit a warning to stderr when taking the `stripShippedMilestones` fallback so the condition is observable during debugging. Add a test for the STATE.md-missing degradation case.

## Security Considerations

**`isGitIgnored` uses `execSync` with string concatenation instead of `spawnSync` with arg array:**

- Risk: `core.cjs` line 134 builds a shell command string: `'git check-ignore -q --no-index -- ' + targetPath.replace(/[^a-zA-Z0-9._\-/]/g, '')`. The regex sanitizer strips special characters rather than escaping them — a path like `foo/..` passes through unchanged. Using `execSync` with a string (not array) invokes a shell.
- Files: `get-shit-done/bin/lib/core.cjs` line 134
- Mitigation: The function is called only with internal path values, not raw user input from stdin. Impact is contained.
- Recommendation: Replace with `spawnSync('git', ['check-ignore', '-q', '--no-index', '--', targetPath], { cwd, stdio: 'pipe' })` — this is the pattern `execGit()` already uses everywhere else in the codebase, making the current `isGitIgnored` inconsistent.

**`process.env.HOME` used without platform fallback in `cmdVerifyReferences`:**

- Risk: `verify.cjs` line 230 resolves `~/` paths via `process.env.HOME || ''`. On Windows, `HOME` is not set; the empty-string fallback silently resolves `~/foo` to `/foo` (filesystem root), producing a wrong path that always returns "not found".
- Files: `get-shit-done/bin/lib/verify.cjs` line 230
- Mitigation: `cmdVerifyReferences` is a read-only check — no write operations are affected.
- Recommendation: Replace `process.env.HOME || ''` with `require('os').homedir()`, which is already imported in other lib files.

## Performance Bottlenecks

**`isInsideFencedBlock` is O(n²) on file line count:**

- Problem: `normalizeMd` in `core.cjs` calls `isInsideFencedBlock(lines, i)` for every line starting with a fence marker. That helper re-scans all lines from 0 to i on each call. For markdown files with 500+ lines and multiple code blocks, this is quadratic.
- Files: `get-shit-done/bin/lib/core.cjs` lines 231-246
- Cause: No fence-state is carried across the main loop; each call to `isInsideFencedBlock` restarts from line 0.
- Fix: Maintain a boolean `insideFence` flag in the main `normalizeMd` loop, flipping it at each ```` ``` ```` boundary. This eliminates `isInsideFencedBlock` and `isClosingFence` as separate O(n) scans entirely.

**Temporary JSON files accumulate in OS tmpdir without cleanup:**

- Problem: `output()` in `core.cjs` (lines 26-29) writes large JSON responses (>50KB) to `gsd-{Date.now()}.json` in `os.tmpdir()` and never deletes them. No cleanup logic exists anywhere in the codebase. On active workstations with many Claude sessions, these files accumulate indefinitely.
- Files: `get-shit-done/bin/lib/core.cjs` lines 26-29
- Fix: Use a fixed filename per process (e.g., `gsd-{pid}.json`) so subsequent writes overwrite the file, or delete the file after writing its path to stdout via a finalizer.

## Fragile Areas

**`output()` calls `process.exit(0)` — library functions are untestable in-process:**

- Files: `get-shit-done/bin/lib/core.cjs` lines 19-35
- Why fragile: Every library function terminates the process via `output()` or `error()`. All tests must spawn child processes and parse stdout, adding overhead and masking assertion stack traces. The 70% line coverage threshold in `test:coverage` is hard to exceed meaningfully because branches inside functions that call `output()` cannot be exercised without process forking.
- Safe modification: Any change to the `output()` / `error()` contract must be validated by the full child-process test suite. Do not add `return` statements after `output()` calls — they are unreachable.
- Test gaps: Branches gated on specific config combinations (e.g., `commit_docs: false`, `isGitIgnored` returning true, `noVerify` flag on commits) have no dedicated test coverage.

**Five independent regex patterns parse milestone versions from ROADMAP.md:**

- Files: `get-shit-done/bin/lib/core.cjs` (`getMilestoneInfo`, `getMilestonePhaseFilter`, `extractCurrentMilestone`), `get-shit-done/bin/lib/phase.cjs` (`cmdPhaseComplete`), `get-shit-done/bin/lib/commands.cjs` (`cmdStats`)
- Why fragile: Each was written independently and handles slightly different heading formats. `getMilestoneInfo` uses `/## .*v(\d+(?:\.\d+)+)[:\s]+([^\n(]+)/`; `extractCurrentMilestone` builds a dynamic regex from the STATE.md version string; `cmdPhaseComplete` uses a table-row regex. A heading format change in ROADMAP.md silently breaks some parsers while others continue working.
- Safe modification: Run `tests/phase.test.cjs`, `tests/milestone.test.cjs`, `tests/state.test.cjs`, and `tests/verify.test.cjs` after any ROADMAP-format change. Add a regression test for each new heading variant.

**`gsd-workflow-guard.js` subagent detection is heuristic and undocumented:**

- Files: `hooks/gsd-workflow-guard.js` lines 32-35
- Why fragile: The guard checks `data.tool_input?.is_subagent || data.session_type === 'task'` to skip writes inside GSD workflows. Neither field is part of the documented Claude Code hook API; both are inferred heuristics. If the hook input schema changes, the guard fires on all executor writes, injecting advisory noise into every agent action.
- Safe modification: The guard is opt-in (`hooks.workflow_guard: true` defaults to false), so a false positive causes advisory noise, not blocking. Monitor after each Claude Code SDK update.

**Update checker queries the wrong npm package name:**

- Files: `hooks/gsd-check-update.js` line 95
- Why fragile: The hook runs `npm view get-shit-done-cc version` but `package.json` names the package `gsd2`. This means the update check silently fails every session — `latest` stays `null`, `update_available` is never `true`, and the statusline update indicator never appears for any user.
- Fix: Change line 95 to `npm view gsd2 version` to match the actual published package name.

## Dependencies at Risk

**No runtime npm dependencies — all parsing bugs are local bugs:**

- The `package.json` has no `dependencies` key — only `devDependencies` (`c8`, `esbuild`). All functionality including YAML parsing, markdown normalization, and config loading is implemented in-house. This eliminates supply-chain risk but means every bug in the custom YAML parser (`frontmatter.cjs`) and markdown normalizer (`core.cjs`) has no upstream fix path.
- Risk area: `get-shit-done/bin/lib/frontmatter.cjs` — the custom YAML parser handles user-authored content and has documented CRLF/corruption edge cases (line 15 comment). This is the highest-risk area for silent data loss.

## Test Coverage Gaps

**`extractCurrentMilestone` and `replaceInCurrentMilestone` have no dedicated tests:**

- Files: `get-shit-done/bin/lib/core.cjs` lines 485-568
- What's untested: The positive milestone lookup path, the three-level fallback cascade (STATE.md missing → 🚧 marker → `stripShippedMilestones`), and the write-protection guarantee of `replaceInCurrentMilestone` against archived milestone content.
- Priority: High — these functions guard against modifying archived milestone content during phase completion writes.

**Hook behavior is entirely untested:**

- Files: `hooks/gsd-context-monitor.js`, `hooks/gsd-statusline.js`, `hooks/gsd-workflow-guard.js`, `hooks/gsd-check-update.js`
- What's untested: Debounce logic and stale-metrics detection in `gsd-context-monitor.js`, the `GEMINI_API_KEY` branch for hook event name selection, the stdin timeout guard on all four hooks, and the stale-hooks detection in `gsd-check-update.js`.
- Priority: Medium — hooks run on every Claude Code tool use and exit silently on errors, making regressions completely invisible without tests.

**`cmdWebsearch` network path has no tests:**

- Files: `get-shit-done/bin/lib/commands.cjs` lines 328-388
- What's untested: Brave API response parsing, non-200 error handling, and the `freshness` parameter path. Only the "key not set" early return is implicitly covered by sessions that do not set `BRAVE_API_KEY`.
- Priority: Low — degrades gracefully to a no-op when the key is absent.

**`cmdTodoMatchPhase` scoring has no edge-case tests:**

- Files: `get-shit-done/bin/lib/commands.cjs` lines 463-579
- What's untested: Score capping at 0.6 for keyword matches, the file-overlap scoring path (requires a phase with an existing PLAN.md containing `files_modified`), and the case where `phaseInfo` is found but has no plan files.
- Priority: Low.
