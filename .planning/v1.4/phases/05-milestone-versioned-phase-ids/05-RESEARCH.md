# Phase 5: Milestone-versioned phase IDs — Research

**Researched:** 2026-05-12
**Domain:** Tooling / CLI refactor (GSD framework dogfood)
**Confidence:** HIGH

## Summary

Phase 5 partitions `.planning/` by milestone. The phase tree moves from `.planning/phases/...` to `.planning/{milestone}/phases/...` and only the phase tree moves — every other root file (`PROJECT.md`, `ROADMAP.md`, `STATE.md`, `cross-phase-notes.md`, `todos/`, `quick/`) stays at the root.

The implementation surface is **almost entirely concentrated in `get-shit-done/bin/lib/`** — eight CLI library files reference the hardcoded `path.join(cwd, '.planning', 'phases')` literal in **~25 separate functions**, plus `core.cjs:277` exports `phases` via `planningPaths()` which a further three files consume. The single highest-leverage fix is to **introduce a milestone-aware `phasesDir(cwd)` helper in `core.cjs` and refactor all 25 sites to call it**, with `planningPaths(cwd).phases` becoming the function-derived value (not a constant). After that change, every callsite that calls `path.join(phasesDir, dir)` automatically resolves to the right partition.

The workflow/agent/command markdown layer is the **second** large touch point — ~60 markdown files contain literal `.planning/phases/` strings, but the vast majority are either (a) example output, (b) bash patterns that take the dir from `{phase_dir}` placeholder anyway (which gets fixed centrally by `init phase-op`), or (c) Glob patterns that work cross-partition with a `**/` glob. Only a small number need surgical edits — enumerated in §1 below.

The migration retrofit is the riskiest and most novel piece. There is **no prior `git mv`-with-ref-rewrite precedent in this codebase** — `cmdMilestoneComplete` already does `fs.renameSync` for archival (milestone.cjs:227, milestone.cjs:169) but does NOT rewrite refs, NOR does it use `git mv`. The new migration subcommand will need: manifest construction, dry-run output, `[y/N]` confirmation, `git mv` execution loop, regex-based ref-rewrite in 4 root files + glob sweep of `todos/**/*.md` and `quick/**/*.md`, then a single atomic commit.

**Primary recommendation:** Land Phase 5 as **three plans in two waves**:

- **Wave 1, Plan 05-01** — CLI: add `milestone_root` derivation helper, refactor all 25 `phasesDir` sites to call it, extend `init` JSON contracts with `milestone_root` and `partition_root` fields. No retrofit yet. (Targets §1 + §2 below.)
- **Wave 1, Plan 05-02** — Migration subcommand `gsd-tools migrate-to-milestone-partition [--dry-run]`, with manifest builder, `git mv` executor, regex ref-rewriter, single-commit transaction. Standalone — does not auto-run anywhere yet. (Targets §6.)
- **Wave 2, Plan 05-03** — Auto-detect-and-prompt wiring (one-time confirmation hook in some appropriate top-level command, likely a top-of-`gsd-tools` precheck or a hook in `init` calls), distillation writer in `cmdMilestoneComplete` (`MILESTONE-{version}-SUMMARY.md`), and `/gsd2:progress` default-context narrowing. Plus the retrofit of the current `v1.4` planning tree as the integration test. (Targets §3 + §4 + §5.)

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Scope: phase bundles partition + distillation as one unit.** [STRONG] Splitting creates a half-built state where IDs reset but next milestone still inherits the full prior tree.
- **Boundary — what this phase does NOT do:**
  - Does **not** close milestone v1.4 or trigger transition to v1.5. [STRONG]
  - Closing a milestone is a separate user decision after this capability lands.
- **Migration / backward compatibility:**
  - **Auto-retrofit on apply.** When this phase's code lands and GSD next runs in a project with old-layout planning artifacts, it detects "no milestone partition + phases at `.planning/phases/`" and migrates them under `.planning/{current_milestone}/phases/...`. [STRONG]
  - Backward compat is a **hard, non-negotiable requirement**: GSD updating in a project on old layout must DTRT, not break. [STRONG]
  - Retrofit also rewrites references in committed `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/cross-phase-notes.md`, `.planning/ROADMAP.md` to use the new IDs/paths. [STRONG]
- **Success metric is what gets loaded:** default context for `/gsd2:progress` and similar commands = active milestone's phases (current ± a small window) + high-level docs (PROJECT.md, ARCHITECTURE) + distilled prior milestones. Does NOT load all phases regardless of count. [STRONG] Planner picks the window bound [DISCRETION].
- **Distillation artifact must be graph-friendly:** typed tags + explicit links between phases, decisions, requirements, canonical refs — machine-parseable headers, not free-form prose. [STRONG]
- **Phase 6 (Graph) / Phase 7 (RAG) are deferred siblings.** [STRONG]
- **Resolved 2026-05-12:**
  - **ID shape: Path-only.** Filenames keep short IDs (`01`, `04-04`); milestone disambiguation lives entirely in the path (`.planning/v1.4/phases/...`). Commit prefix unchanged: `feat(04-04: ...)`. [STRONG]
  - **Distillation artifact `MILESTONE-{version}-SUMMARY.md`: rich.** Sections: `decisions[]` (typed, with `phase:` link), `requirements_validated[]`, `open_blockers[]`, `entry_points[]` (file:symbol), `public_api[]`. Machine-parseable typed tags. [STRONG]
  - **Migration trigger UX:** one-time confirmation prompt. Print plan (`N dirs to move, M ref-rewrites in K files`) and require `[y/N]` before mutating committed files. `--dry-run` mode prints the plan without prompting and exits. [STRONG]
  - **Reference rewrite scope:** root files (`STATE.md`, `PROJECT.md`, `ROADMAP.md`, `cross-phase-notes.md`) always rewritten. Sweep `todos/**/*.md` and `quick/**/*.md` for **path-shaped** refs only (regex match on `.planning/phases/...` and bare `phases/NN-`). Free prose untouched. Commit message history untouched. [STRONG]
  - **Active milestone source of truth:** STATE.md `milestone:` frontmatter (current value: `v1.4`). If missing/corrupt: refuse to migrate, exit with clear error. No path-based guessing, no default. [STRONG]
  - **Layout:** Only phase tree moves under `.planning/{milestone}/phases/`. PROJECT/ROADMAP/STATE/cross-phase-notes/todos/quick stay at `.planning/` root. ROADMAP resets when milestone transitions; closed milestones are summarized in `.planning/{milestone}/SUMMARY.md`. [STRONG]

### Claude's Discretion

- Exact window bound for `/gsd2:progress` "active ± N" (current implementation uses `anchor - 1` to `anchor + 2` — see init.cjs:996 — recommend keeping the same shape, just constrained to milestone partition).
- Specific typed-tag vocabulary for the distillation artifact (recommend adopting the existing `must_haves.truths[].verify[]` + `must_haves.key_links[]` shapes from `phase-prompt.md:584-625` — the codebase already uses these as machine-parseable typed-tag headers).
- Migration manifest internal format (recommend JSON written to `.planning/.migration-manifest.json` during the migration; deleted on success; left in place on failure for recovery — this matches the WAITING.json signal pattern from state.cjs:896-916).
- Hook location for the auto-detection prompt (recommend in `cmdInitPhaseOp` since every phase workflow already calls it — gives one chokepoint without per-workflow plumbing).

### Deferred Ideas (OUT OF SCOPE)

- Milestone v1.4 closure / transition to v1.5 — explicit user deferral.
- Phase 6: Graph-based linking — separate phase.
- Phase 7: RAG / semantic retrieval — separate phase.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | After this phase lands, `.planning/v1.4/phases/...` is canonical for v1.4; root-level files (PROJECT/ROADMAP/STATE/cross-phase-notes/todos/quick) remain at `.planning/` root | §2 enumeration of every `phasesDir` chokepoint shows the single helper that controls path resolution; §6 migration tool moves dirs without touching root files |
| SC-2 | Running GSD on an old-layout project prints a migration plan and prompts `[y/N]` before mutating; `--dry-run` mode prints plan and exits | §6 design space + state.cjs:896-916 (WAITING.json) shows existing signal-file pattern that can be reused for plan output |
| SC-3 | After user accepts: `git mv` preserves history; STATE.md, PROJECT.md, ROADMAP.md, cross-phase-notes.md + path-shaped refs in `todos/**/*.md` and `quick/**/*.md` are rewritten | §6 + §1 enumeration of every literal `.planning/phases/` and bare `phases/NN-` ref shows the rewrite scope |
| SC-4 | STATE.md `milestone:` frontmatter is single source of truth; missing/corrupt → clear refusal-and-prompt error | §2 core.cjs:485-552 (extractCurrentMilestone) already reads STATE.md `milestone:` — same logic gates migration |
| SC-5 | `/gsd2:complete-milestone` produces `.planning/{milestone}/SUMMARY.md` with typed-tag sections | §3 enumeration of cmdMilestoneComplete extension point + §4 existing typed-tag substrate in phase-prompt.md frontmatter |
| SC-6 | `/gsd2:progress` (and other context-loading commands) load active milestone phases + root docs + summaries of prior closed milestones — not the entire phase tree | §2 init.cjs:847-1150 (cmdInitProgress) already applies milestone scoping; needs the milestone_root path swap to find the right partition |
| SC-7 | Decimal-phase resolution continues to work; existing workflow placeholders continue to resolve via init.cjs | §2 phase.cjs:454 (decimal resolver) lives inside `phasesDir`-scoped logic — preserved automatically once `phasesDir` is partition-aware |
| SC-8 | Retrofit of current `.planning/` (v1.4) to new layout performed as integration test, committed as part of phase work | §5 test infrastructure shows we have `createTempProject()` fixtures plus the production v1.4 tree itself for dogfood |

## Standard Stack

This is an internal tooling refactor — no external library additions. The existing stack is the constraint:

| Library / Module | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| `node:fs`, `node:path`, `node:child_process` | Node ≥18 builtins | filesystem, path manipulation, `git mv` invocation | Already used everywhere in `get-shit-done/bin/lib/*.cjs`; no new dependency surface |
| `node:test` | Node ≥18 builtin | test framework | Already used by all 29 test files in `tests/` — see `tests/helpers.cjs` |
| `git mv` via `execSync` | git ≥2.x | preserves history across renames | Existing pattern: `core.cjs:248-259` already wraps `git` via `execGit(cwd, args)` |

### Don't add

- **No new YAML parser** — frontmatter parsing already lives in `frontmatter.cjs` (`extractFrontmatter`, `reconstructFrontmatter`); reuse for `MILESTONE-{version}-SUMMARY.md` writing.
- **No new file-locking primitive** — `state.cjs:748-793` (`writeStateMd`) already implements O_EXCL spinlock; reuse for the migration manifest if needed.
- **No npm package for git-history preservation** — `git mv` is the standard tool. Verified Wave 1 of this phase will spawn `git mv` per directory.

## Architecture Patterns

### Recommended Code Structure (where edits land)

```
get-shit-done/bin/lib/
├── core.cjs                  # ADD: milestonePartitionRoot(cwd), phasesDirForMilestone(cwd, ver)
│                             # MODIFY: planningPaths() — make .phases a getter-derived value
├── init.cjs                  # MODIFY: cmdInitPhaseOp, cmdInitPlanPhase, cmdInitExecutePhase
│                             #         cmdInitProgress, cmdInitMilestoneOp, cmdInitNewMilestone,
│                             #         cmdInitDocument — all enriched with milestone_root,
│                             #         partition_root fields
├── phase.cjs                 # MODIFY: every phasesDir literal → milestone-aware helper
├── roadmap.cjs               # MODIFY: cmdRoadmapAnalyze phasesDir literal
├── milestone.cjs             # MODIFY: cmdMilestoneComplete writes MILESTONE-{ver}-SUMMARY.md;
│                             #         partition-aware ROADMAP archival path
├── state.cjs                 # MODIFY: buildStateFrontmatter (state.cjs:642-669) — phasesDir literal
├── commands.cjs              # MODIFY: progressRenderInternal, cmdStats, cmdScaffold — phasesDir literals
├── uat.cjs                   # MODIFY: auditUatInternal, cmdAuditUat — phasesDir literals
├── verify.cjs                # MODIFY: phasesDir literals at lines 642, 783
└── migration.cjs             # NEW: cmdMigrateToMilestonePartition (dry-run + execute paths,
                              #     manifest builder, ref-rewriter, git mv executor)
```

### Pattern 1: Single chokepoint for path partitioning

**What:** Replace every `path.join(cwd, '.planning', 'phases')` (25 callsites enumerated in §2) with a single helper `phasesDir(cwd)` defined in `core.cjs`. The helper reads STATE.md `milestone:` frontmatter and returns the correct partition path.

**When to use:** Always — never let `.planning/phases` appear as a literal string in lib code after Plan 05-01.

**Example:**
```js
// core.cjs (new)
function phasesDir(cwd) {
  const milestone = readMilestoneFromState(cwd); // reads STATE.md frontmatter
  if (milestone) {
    const partitioned = path.join(cwd, '.planning', milestone, 'phases');
    if (fs.existsSync(partitioned)) return partitioned;
  }
  // Legacy fallback for unmigrated trees
  return path.join(cwd, '.planning', 'phases');
}
```

**Why this works:** The detection ("partitioned exists" vs "fallback to legacy") is exactly the same signal the auto-retrofit prompt needs — partitioned path missing AND legacy path present = retrofit candidate.

### Pattern 2: Extend init JSON contract, never rename

**What:** The init command JSON is the workflow API surface. Add new fields (`milestone_root`, `partition_root`, `legacy_layout_detected`) — never rename `phase_dir`, `padded_phase`, `phase_number`, `phase_slug`.

**When to use:** Every change to `init.cjs` output schema.

**Example:** `cmdInitPhaseOp` already returns `phase_dir`. After Phase 5 it returns the partitioned path `.planning/v1.4/phases/04-verification-harness-and-context-efficiency` instead of `.planning/phases/04-verification-harness-and-context-efficiency`. Downstream workflows consuming `${phase_dir}` adapt automatically — no per-workflow edit needed.

### Pattern 3: Reuse existing `extractCurrentMilestone` for state-of-truth lookup

**What:** `core.cjs:485-552` already reads STATE.md frontmatter to derive current milestone version. The migration tool reuses this exact function for "what milestone is active?" — no parallel implementation.

**Anti-pattern:** Writing a separate `readActiveMilestone()` that diverges from `extractCurrentMilestone`'s STATE.md lookup. Single source of truth means single reader function.

### Anti-Patterns to Avoid

- **Per-workflow milestone awareness.** Do not edit 50 workflow `.md` files to know about `{milestone}` in the path. The init JSON contract carries `phase_dir` as the resolved path — workflows already use this placeholder. The change is in the CLI lib, not the workflow markdown.
- **Symlinks instead of moves.** Tempting (back-compat), but breaks `git mv` history preservation and confuses CI/external tooling. Move, don't symlink.
- **Two parsers for STATE.md `milestone:` field.** `core.cjs:485-499` and `state.cjs:613-619` already each read it. Don't add a third in `migration.cjs` — extract a shared helper if needed.
- **Free-form prose distillation.** The `MILESTONE-{version}-SUMMARY.md` MUST use typed-tag sections (decisions[], requirements_validated[], open_blockers[], entry_points[], public_api[]). Free-form prose breaks Phase 6 graph indexing — the substrate must be parseable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase path resolution | Custom `getMilestonePath()` per call site | Single `phasesDir(cwd)` helper in `core.cjs` | 25 callsites — drift inevitable if duplicated |
| Milestone version lookup | Parse STATE.md frontmatter ad-hoc | `extractCurrentMilestone` (core.cjs:485) or `getMilestoneInfo` (core.cjs:710) — existing functions | Two parsers already in tree; don't add a third |
| Frontmatter mutation for `MILESTONE-{ver}-SUMMARY.md` | Manual YAML string building | `reconstructFrontmatter` from `frontmatter.cjs` | Used by all existing summary/state writes; handles escape edge cases |
| Atomic file-lock during migration | Per-process mutex | `O_CREAT \| O_EXCL` spinlock pattern from state.cjs:755-793 | Working, tested, handles stale-lock recovery |
| Confirmation-prompt-and-wait | New stdin-reader | The `signal-waiting` / `signal-resume` pattern (state.cjs:896-935) — write `.planning/WAITING.json`, await user resume | Existing decision-point machinery; integrates with watchers |
| Phase number normalization | Per-file regex | `normalizePhaseName` (core.cjs:288) and `comparePhaseNum` (core.cjs:302) | Already handles `01`, `12A`, `12.1`, `12A.1.2` |
| Decimal-phase resolution after migration | Anything custom | `cmdPhaseNextDecimal` (phase.cjs:87) — works inside whatever dir `phasesDir(cwd)` returns | Resolver is partition-agnostic by construction |
| Reference rewrite regex | One mega-regex | Two anchored patterns: `\.planning/phases/(NN-...)` and `(?<![a-zA-Z])phases/(NN-...)` | False-positive analysis in §6.3 below |

**Key insight:** This phase is 90% refactor and 10% new code. The new code (migration tool, distillation writer) is bounded; the refactor blast radius is **wide but shallow** — same edit type repeated at 25 sites. Mechanical, not architectural.

## Common Pitfalls

### Pitfall 1: Mirror-edit leak from runtime to source

**What goes wrong:** Editor multi-cursor edits both `.claude/get-shit-done/bin/lib/phase.cjs` (runtime mirror, gitignored) AND `get-shit-done/bin/lib/phase.cjs` (source) — but resolves `~/.claude/...` placeholders in the runtime copy to absolute `/Users/.../...` and accidentally writes those back to source.

**Why it happens:** GSD has source vs runtime mirror split (see CHANGELOG.md [1.4.5] "Fixed" entry — this exact regression caused 21 file leaks in Plan 04-04).

**How to avoid:**
- Edit source only. Run `npm run dev` (if it exists) or `node bin/install.js --claude --global` to refresh `.claude/` runtime.
- Add a pre-commit guard or rely on `tests/path-replacement.test.cjs` (already exists; catches absolute-path leaks).

**Warning signs:** Grep for `/Users/` in any committed `get-shit-done/**/*.md` file — should always be zero.

### Pitfall 2: Decimal phases break after partition

**What goes wrong:** Phase resolver at `phase.cjs:454` (`cmdPhaseNextDecimal`) and `phase.cjs:107-122` (decimal pattern matching inside `findPhaseInternal`) operate on `phasesDir` literal. If the literal isn't updated, decimals work in the legacy partition but not the new one.

**Why it happens:** The decimal logic is correct; the path lookup it depends on is what changes.

**How to avoid:** Plan 05-01's refactor catches this automatically — once `phasesDir(cwd)` returns the partition path, the decimal resolver scans the right directory. Just verify with a unit test that puts `06.2-foo/` inside `.planning/v1.4/phases/` and asserts that `phase next-decimal 06` returns `06.3`.

**Warning signs:** Any test that constructs phase dirs at `.planning/phases/` instead of `.planning/{milestone}/phases/` after refactor.

### Pitfall 3: `git mv` exits non-zero on already-tracked files

**What goes wrong:** During retrofit, if user has uncommitted changes to a phase file, `git mv` may complain that the source path has both tracked and untracked content. The migration aborts mid-flight, leaving the tree in a partial state.

**Why it happens:** `git mv` is strict about index consistency.

**How to avoid:**
- Pre-flight check: `git status --porcelain .planning/` — if any modified `.planning/phases/*` files exist, refuse migration with a message asking the user to commit or stash first.
- All-or-nothing: collect every `git mv` into a single shell pipeline; if any fail, restore via `git checkout .planning/` and exit.

**Warning signs:** Migration completed with phases in both old and new locations.

### Pitfall 4: Ref rewrite false positives in free-form text

**What goes wrong:** User wrote "see phases 1-3 for context" in a `todos/` markdown file. A naive `phases/[0-9]` regex would mangle it into `phases/01-3` or similar nonsense.

**Why it happens:** Bare `phases/NN-` pattern is ambiguous between path and prose mention.

**How to avoid:**
- Anchor the regex to require a trailing slug or terminator: `phases/(\d+[A-Z]?(?:\.\d+)*-[a-z0-9-]+)` — requires `phases/01-foo` shape, not just `phases/01`.
- Only sweep `todos/**/*.md` and `quick/**/*.md` (CONTEXT.md decision §4) — leave commit history, PROJECT.md prose, and free conversation in CONTEXT.md untouched.
- Print every proposed substitution in the dry-run output for human review.

**Warning signs:** Diff of rewritten `todos/` shows changes to non-path strings.

### Pitfall 5: STATE.md `milestone:` field missing/corrupt

**What goes wrong:** Old projects updated GSD before STATE.md frontmatter existed (added v1.3.x). `milestone:` field absent → migration can't determine partition name → silent default to `v1.0` corrupts the tree.

**Why it happens:** STATE.md frontmatter is relatively new (CHANGELOG.md shows it stabilized in v1.4.x via `buildStateFrontmatter` at state.cjs:615-719).

**How to avoid:** CONTEXT.md decision §5 — refuse to migrate, prompt user to set the field explicitly. Verify by checking `extractCurrentMilestone()` returns non-null AND `getMilestoneInfo()` returns a `version` that matches.

**Warning signs:** Migration ran successfully on a project with no `milestone:` field in STATE.md frontmatter.

### Pitfall 6: Glob patterns in workflows over-match after partition

**What goes wrong:** `commands/gsd2/audit-uat.md:22` does `Glob: .planning/phases/*/*-UAT.md`. After partition this glob misses everything because actual files live at `.planning/v1.4/phases/*/*-UAT.md`.

**Why it happens:** Static glob path with no milestone segment.

**How to avoid:**
- Two strategies, prefer (b):
  - (a) Update glob to `.planning/**/phases/*/*-UAT.md` — works but expensive on huge trees.
  - (b) Replace the glob with a CLI call: `gsd-tools audit-uat` returns the file list as JSON. The CLI already uses `phasesDir(cwd)`, so partition-aware automatically.
- For commands/agents that genuinely need a one-off glob, use `**` to span the partition: `.planning/**/phases/*/*.md`.

**Warning signs:** Any workflow that ran fine before partition returns "no UAT files" after.

## Code Examples

Verified patterns from the existing codebase (use as templates for Phase 5 implementation):

### Phase resolution chokepoint — current shape

```js
// Source: get-shit-done/bin/lib/core.cjs:385-420 (findPhaseInternal)
function findPhaseInternal(cwd, phase) {
  if (!phase) return null;
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phase);
  const current = searchPhaseInDir(phasesDir, '.planning/phases', normalized);
  if (current) return current;
  // ... archived milestone fallback
}
```

After Phase 5, this becomes:

```js
function findPhaseInternal(cwd, phase) {
  if (!phase) return null;
  const dir = phasesDir(cwd);              // NEW: partition-aware
  const relBase = relPhasesPath(cwd);      // NEW: matches dir
  const normalized = normalizePhaseName(phase);
  const current = searchPhaseInDir(dir, relBase, normalized);
  if (current) return current;
  // ... archived milestone fallback (unchanged)
}
```

### Existing milestone-aware filter (already partial substrate)

```js
// Source: get-shit-done/bin/lib/core.cjs:752-785 (getMilestonePhaseFilter)
function getMilestonePhaseFilter(cwd) {
  const milestonePhaseNums = new Set();
  // reads ROADMAP.md headings, builds set of "1, 2, 3, ..." for current milestone
  // returns predicate isDirInMilestone(dirName)
}
```

This filter is **already used in 6 places** (init.cjs:901, init.cjs:1040, phase.cjs:847, state.cjs:309, state.cjs:646, milestone.cjs:108, uat.cjs:23, commands.cjs:696). After partition, it becomes redundant for filtering — every directory inside `phasesDir(cwd)` is already in the current milestone by construction. Leave the function in place (back-compat for legacy layouts) but downgrade callers to only use it during the legacy fallback path.

### Existing typed-tag substrate (graph-ready)

```yaml
# Source: get-shit-done/templates/phase-prompt.md:584-625 (must_haves schema)
must_haves:
  truths:
    - statement: "User can log in via OAuth"
      verify:
        - cmd: "curl -s http://localhost:3000/auth/google | grep 302"
          expect: "/regex/"
          type: "http"
  key_links:
    - from: "src/auth/login.ts"
      to: "src/auth/oauth-provider.ts"
      via: "calls validateToken()"
      pattern: "validateToken\\("
```

This is the canonical typed-tag shape in the codebase. The Phase 5 `MILESTONE-{ver}-SUMMARY.md` should adopt the same conventions for its `decisions[]`, `requirements_validated[]`, `open_blockers[]`, `entry_points[]`, `public_api[]` sections — each item is an object with named fields, and cross-references use string keys (phase IDs, file:symbol, REQ-IDs).

### Existing signal-file pattern (reuse for migration manifest)

```js
// Source: get-shit-done/bin/lib/state.cjs:896-935 (cmdSignalWaiting / cmdSignalResume)
function cmdSignalWaiting(cwd, type, question, options, phase, raw) {
  const gsdDir = fs.existsSync(path.join(cwd, '.gsd')) ? path.join(cwd, '.gsd') : path.join(cwd, '.planning');
  const waitingPath = path.join(gsdDir, 'WAITING.json');
  const signal = { status: 'waiting', type, question, options, since: new Date().toISOString(), phase };
  fs.mkdirSync(gsdDir, { recursive: true });
  fs.writeFileSync(waitingPath, JSON.stringify(signal, null, 2), 'utf-8');
}
```

Migration manifest follows the same pattern: write `.planning/.migration-manifest.json` (gitignored or pre-cleanup) containing the planned moves and rewrites; user confirms; tool executes; manifest deleted on success.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `.planning/phases/` tree, milestone status tracked only in ROADMAP.md frontmatter | Partition by milestone version (`.planning/{ver}/phases/`); STATE.md frontmatter is the authoritative current-milestone source | Phase 5 (this) | Each milestone's phase tree is self-contained; loading a phase no longer requires understanding global numbering |
| `getMilestonePhaseFilter()` predicate filters dirs in the flat tree by reading ROADMAP headings | After partition, filter becomes optional — directory membership implies milestone scope | Phase 5 (this) | Defensive — keep the filter for legacy layouts during the auto-retrofit transition window |
| Milestone closure does `cmdMilestoneComplete` (milestone.cjs:88) — archives ROADMAP, REQUIREMENTS, optionally moves phase dirs to `milestones/v[X.Y]-phases/` | Plus produces `MILESTONE-{ver}-SUMMARY.md` typed-tag distillation artifact at `.planning/{ver}/SUMMARY.md`; ROADMAP.md resets (single milestone visible) | Phase 5 (this) | Next milestone reads only the distilled artifact, not the full prior phase tree |
| `/gsd2:progress` already applies `--scoped` flag (init.cjs:990-1002) → current ± 1 / next ± 1 window | Same window, just constrained to active milestone partition (no cross-milestone load) | Phase 5 (this) | Token cost on huge multi-milestone projects no longer grows linearly with total milestones |

**Deprecated/outdated patterns to retire:**

- The `getArchivedPhaseDirs()` (core.cjs:422-455) function scans `.planning/milestones/v*-phases/` for legacy archived phases. Keep it for back-compat — pre-Phase-5 archived milestones still live there. New flows (post Phase 5) use the partitioned layout directly.
- The `cmdMilestoneComplete --archive-phases` flag (milestone.cjs:217-232) physically moves phase dirs to `milestones/v[X.Y]-phases/`. Under the new model, phases stay in their `{milestone}` partition without needing the move — ROADMAP archival creates `.planning/{ver}/SUMMARY.md` instead. Phase 5 design: keep `--archive-phases` working for legacy, but mark it deprecated in workflow markdown (no behavior change needed in CLI; old layouts can still archive).

## Touch-Point Enumeration (the bulk of the planning work)

This section is exhaustive — incomplete enumeration here translates directly to revision loops in plan-checker. Grouped by category.

### §1 — Markdown placeholders (`{padded_phase}`, `{phase_dir}`, `{phase_number}`, `{phase_slug}`, hardcoded `.planning/phases/`)

These are the workflow / agent / command files. Most placeholders flow through `init` JSON output and need NO edit (the `phase_dir` value just changes). Hardcoded `.planning/phases/` literals DO need edits.

**Category A — Workflow markdown** (`get-shit-done/workflows/*.md`):

| File | Line(s) | Type | Edit needed? |
|------|---------|------|--------------|
| `autonomous.md` | 207 | `find .planning/phases -name "*-CONTEXT.md"` (literal) | YES → use `**` glob or CLI |
| `autonomous.md` | 283, 352 | `${phase_dir}/${padded_phase}-...` (placeholder) | NO (init carries new path) |
| `diagnose-issues.md` | 52, 105 | mix: placeholder + literal | YES (line 105 has literal `.planning/phases/XX-name/`) |
| `remove-phase.md` | 69, 119 | doc text mentioning `.planning/phases/{target}-{slug}/` | YES (update doc; the function itself reads via lib) |
| `research-phase.md` | 29, 61 | `ls .planning/phases/${PHASE}-*/RESEARCH.md` and Write path | YES → use init `phase_dir` placeholder |
| `complete-milestone.md` | 126, 146, 209, 243 | `cat .planning/phases/*-*/*-SUMMARY.md` (3x) + `.planning/phases/{phase-dir}` (1x) | YES — change to CLI subcommand `gsd-tools summary-extract` looped, or `**` glob |
| `document.md` | 130, 275 | doc text describing `.planning/phases/...` semantics | YES (text update) |
| `pause-work.md` | 16, 39, 88, 146, 154 | literal `.planning/phases/...` | YES (5 spots, all path-shaped) |
| `progress.md` | 97-106 | `.planning/phases/[current-phase-dir]/*-PLAN.md` | YES → CLI subcommand `phase-plan-index` |
| `resume-project.md` | 46, 48, 127 | literal `.planning/phases/...` | YES (3 spots) |
| `audit-milestone.md` | 82 | `.planning/phases/*-*/*-SUMMARY.md` glob | YES → `**` glob |
| `help.md` | 97, 103, 213, 428, 431 | doc text | YES (text update — examples shown) |
| `new-milestone.md` | 117, 120 | `find .planning/phases -mindepth 1 -maxdepth 1 -type d -exec mv ...` | YES (already inside reset-phase logic; needs milestone-aware target) |
| `execute-phase.md` | 161, 297, 337, 529, 540 | hardcoded `.planning/phases/04-verification-harness-...` ref + `find .planning/phases/` | YES (4 reference, 1 find) |
| `execute-phase.md` | 125, 190, 211, 244, 245, 309, 591, 592, 616, 621, 653, 678, 690, 718 | placeholder `{phase_dir}` etc. | NO (placeholders flow correctly) |
| `plan-phase.md` | 45, 155, 205, 239, 258, 449, 574, 616, 665, 844 | mix: `mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"` + placeholders | YES (line 45 needs partition-aware path; rest are placeholders) |
| `discuss-phase.md` | 94, 125, 342, 345, 456, 503, 542, 546, 554 | mix: literal find on line 125 + `mkdir -p` literal on 342 + placeholders | YES (line 125 and 342) |
| `execute-plan.md` | 27, 28, 55, 109, 304, 311, 377, 400, 401 | literal `.planning/phases/XX-name/...` (template strings) | YES (these are intentional template placeholders showing user the path; update to show partitioned path) |
| `verify-work.md` | 32, 114, 269, 323, 327, 365, 369, 402, 406 | mix: literal `find .planning/phases -name "*-UAT.md"` + placeholders | YES (line 32 literal find; rest placeholders) |
| `transition.md` | 40, 41, 58, 121, 151, 238 | literal `.planning/phases/XX-current/...` | YES (all 6 doc/template strings) |
| `plan-milestone-gaps.md` | 104 | literal `mkdir -p ".planning/phases/{NN}-{name}"` | YES |
| `add-phase.md` | 55, 79 | doc text | YES (doc update) |
| `cleanup.md` | 11, 55, 58, 61, 113, 125, 137 | literal `.planning/phases/` + the mv pattern | YES — cleanup is a primary candidate for partition-aware refactor |
| `insert-phase.md` | 59, 83 | doc text | YES (doc update) |
| `discovery-phase.md` | 57, 72, 101 | literal `.planning/phases/XX-name/DISCOVERY.md` (template) | YES (doc/template paths) |
| `ui-review.md` | 71, 84, 85, 144 | placeholders only | NO |
| `pause-work.md` | 55, 56, 57, 78 | placeholders only | NO |
| `test-phase.md` | 82, 96, 102, 103, 151 | placeholders only | NO |
| `verify-phase.md` | 39, 40, 68 | placeholders only | NO |
| `agent-spec-phase.md` | 92, 106, 121, 122, 177, 182, 273 | placeholders only | NO |
| `ui-phase.md` | 74, 87, 93, 94, 129, 134, 214 | placeholders only | NO |
| `ship.md` | 68, 105 | placeholders only | NO |
| `review.md` | 112, 153, 168 | placeholders only | NO |
| `add-tests.md` | 27-29, 33, 192, 198-203 | placeholders only | NO |

**Category B — Command markdown** (`commands/gsd2/*.md`):

| File | Line(s) | Type | Edit needed? |
|------|---------|------|--------------|
| `research-phase.md` | 51, 59, 98, 133, 158, 163 | literal `.planning/phases/${PHASE}-*/RESEARCH.md` + placeholders | YES (line 59 literal `ls`; line 133, 163 paths) |
| `cleanup.md` | 8 | doc text | YES (text update) |
| `audit-milestone.md` | 29, 30 | `Glob: .planning/phases/*/*-SUMMARY.md` and `-VERIFICATION.md` | YES — replace with `**` glob or CLI |
| `audit-uat.md` | 22, 23 | `Glob: .planning/phases/*/*-UAT.md` etc. | YES — replace with `**` glob or CLI |
| `review-backlog.md` | 19 | `ls -d .planning/phases/999*` | YES (backlog convention — partition-aware path) |
| `add-backlog.md` | 33, 34, 54, 62 | `mkdir -p ".planning/phases/${NEXT}-${SLUG}"` (literal mkdir) | YES (target must be partition-aware) |
| `progress.md` | (none direct — delegates to workflow) | — | (no-op) |
| `complete-milestone.md` | (delegates to workflow) | — | (no-op) |
| `new-milestone.md` | (delegates to workflow) | — | (no-op) |

**Category C — Agent markdown** (`agents/*.md`):

| File | Line(s) | Type | Edit needed? |
|------|---------|------|--------------|
| `gsd-fixer.md` | 148, 183 | `Phase {phase_number}` placeholder + literal ref `.planning/phases/04-verification-harness-...` | YES (line 183 literal ref) |
| `gsd-integration-checker.md` | 54 | literal `for summary in .planning/phases/*/*-SUMMARY.md` | YES |
| `gsd-document-mapper.md` | 29, 54, 79, 107 | doc text describing `.planning/phases/...` source citation format | YES (citation format must reflect partition; e.g. `(source: .planning/v1.4/phases/02-agent-spec/02-SUMMARY.md)`) |
| `gsd-document-updater.md` | 110 | doc text with example citation | YES (text update) |
| `gsd-executor.md` | 248, 324 | doc text and commit example with literal `.planning/phases/XX-name/` | YES |
| `gsd-phase-researcher.md` | 179, 445, 473 | template string + placeholders | YES (line 179 doc) |
| `gsd-planner.md` | 222, 383, 399 | doc strings + literal example | YES (line 399 commit example) |
| `gsd-verifier.md` | 263, 348, 417 | literal `.planning/phases/{phase_dir}/{phase_num}-VERIFICATION.md` + reference | YES (path templates) |
| `gsd-ui-checker.md` | 166, 191 | placeholders only | NO |
| `gsd-test-designer.md` | 221, 249, 264 | placeholders only | NO |
| `gsd-ui-researcher.md` | 184, 214 | placeholders only | NO |
| `gsd-ui-auditor.md` | 305 | placeholder only | NO |

**Category D — Test fixtures and templates**:

| File | Line(s) | Type | Edit needed? |
|------|---------|------|--------------|
| `tests/template.test.cjs` | 41, 65, 83, 90 | test asserts file at `.planning/phases/01-setup/01-01-PLAN.md` | YES — test must run against migrated layout (or test the legacy fallback) |
| `tests/verify.test.cjs` | 131, 146, 182, 219, 233, 279, 290, 397, 428, 445, 465, 482, 499, 519, 537, 570, 582, 598, 611, 620, 734, 746, 764, 782, 801, 832, 900, 917, 937, 954, 973, 1003 | dozens of fixture paths `.planning/phases/01-test/...` | YES — full sweep needed |
| `tests/init.test.cjs` | 51, 52 + many | fixtures + assertions | YES — assertions reflect new path shape |
| `tests/milestone.test.cjs` | 161, 164 | only references `milestones/v1.0-phases/` archive path | NO (legacy path) |
| `tests/phase.test.cjs` | (many in fixtures) | constructs `.planning/phases/...` in `tmpDir` | YES — sweep |
| `tests/roadmap.test.cjs` | (many in fixtures) | constructs phase dirs | YES — sweep |
| `tests/state.test.cjs` | (some) | uses phases in tmpDir | YES — sweep |
| `tests/core.test.cjs` | (some) | tests phase utilities | YES — sweep |
| `get-shit-done/templates/phase-prompt.md` | 245, 246, 388, 421, 422, 459 | doc strings showing example paths `.planning/phases/03-features/...` | YES (text update — examples) |
| `get-shit-done/references/decimal-phase-calculation.md` | 65 | doc string example | YES (text update) |

### §2 — CLI entry points and chokepoints (`get-shit-done/bin/lib/*.cjs`)

**Exhaustive list of every function that reads/writes phase paths. The single chokepoint candidate is `core.cjs`. The other 7 files have parallel literal occurrences that all need updating.**

#### `get-shit-done/bin/lib/init.cjs` — 13 functions, all consume phase paths

| Function | Lines | Reads phase path? | Writes path? | JSON contract fields emitted |
|----------|-------|---------|---|----|
| `cmdInitExecutePhase` | 31-163 | via `findPhaseInternal` | no | `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase` (via call to findPhaseInternal), `agent_spec_path`, `verify_loop.per_plan` |
| `cmdInitPlanPhase` | 165-248 | via `findPhaseInternal` | no | `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `context_path`, `research_path`, `verification_path`, `uat_path`, `agent_spec_path` |
| `cmdInitNewProject` | 250-316 | scans existence only | no | (no per-phase) |
| `cmdInitNewMilestone` | 318-363 | line 322: `path.join(cwd, '.planning', 'phases')` LITERAL — counts dirs | no | `current_milestone`, `phase_dir_count`, `phase_archive_path` |
| `cmdInitQuick` | 365-410 | no phase | no | `task_dir: '.planning/quick/...'` (NOT migrated — quick stays root per CONTEXT §4) |
| `cmdInitResume` | 412-442 | no phase | no | (no per-phase) |
| `cmdInitVerifyWork` | 444-471 | via `findPhaseInternal` | no | `phase_dir`, `phase_number`, `phase_name` |
| `cmdInitPhaseOp` | 473-575 | via `findPhaseInternal` | no | `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `context_path`, `research_path`, `verification_path`, `uat_path` |
| `cmdInitTodos` | 577-634 | no phase | no | (no per-phase) |
| `cmdInitMilestoneOp` | 636-695 | line 643: `path.join(cwd, '.planning', 'phases')` LITERAL — counts phases | no | `phase_count`, `completed_phases`, `archived_milestones`, `archive_count` |
| `cmdInitMapCodebase` | 697-729 | no phase | no | (no per-phase) |
| `cmdInitDocument` | 731-845 | line 766: `path.join(cwd, '.planning', 'phases')` LITERAL — walks for SUMMARY.md | no | `new_summaries[]` (emits paths) |
| `cmdInitProgress` | 847-1150 | line 853: `path.join(cwd, '.planning', 'phases')` LITERAL; line 939: emits `directory: '.planning/phases/' + dir`; line 1039: another literal; line 1059: emits relPath literal | no | `phases[].directory`, `recent_summaries[].path` |

**Single-chokepoint candidacy**: NO. `init.cjs` has 5 separate literal `path.join(cwd, '.planning', 'phases')` sites (lines 322, 643, 766, 853, 1039) — each in a different function. All 5 need refactoring to call the new helper. Plus 2 sites that emit literal `.planning/phases/...` strings as JSON output (lines 939 and 1059).

#### `get-shit-done/bin/lib/phase.cjs` — 8 functions, all are path-bound

| Function | Lines | Phase path access | JSON / output |
|---|----|----|---|
| `cmdPhasesList` | 11-85 | line 12 LITERAL | emits `directories[]`, `phase_dir` |
| `cmdPhaseNextDecimal` | 87-150 | line 88 LITERAL — decimal resolver lives here | emits `next`, `existing[]` |
| `cmdFindPhase` | 152-194 | line 157 LITERAL; line 183: emits `directory: toPosixPath(path.join('.planning', 'phases', match))` | emits `directory`, `phase_number`, `phase_name` |
| `cmdPhasePlanIndex` | 201-309 | line 206 LITERAL | emits `plans[]`, `waves{}`, `incomplete[]` |
| `cmdPhaseAdd` | 311-380 | line 349: `path.join(cwd, '.planning', 'phases', dirName)` LITERAL — creates new phase dir | emits `directory: '.planning/phases/${dirName}'` |
| `cmdPhaseInsert` | 382-462 | line 406 LITERAL; line 423 creates dir | emits `directory: '.planning/phases/${dirName}'` |
| `cmdPhaseRemove` | 464-715 | line 470 LITERAL; renames many dirs; updates ROADMAP and STATE | emits `directory_deleted`, `renamed_directories[]`, `renamed_files[]` |
| `cmdPhaseComplete` | 717-974 | line 724 LITERAL; reads phases dir for "next phase" lookup | emits `completed_phase`, `next_phase`, `is_last_phase` |

**8 literal occurrences in this file alone.** Decimal-phase resolver (cmdPhaseNextDecimal) is the user-mentioned "decimal-phase resolver at ~:454" — actually it's at line 88, and the decimal pattern matching inside `findPhaseInternal` (core.cjs:107-122 + `searchPhaseInDir` core.cjs:331-383) — same logic.

#### `get-shit-done/bin/lib/roadmap.cjs` — 3 functions, 1 path-bound

| Function | Lines | Phase path access |
|---|---|---|
| `cmdRoadmapGetPhase` | 9-91 | reads ROADMAP only — NO phase path |
| `cmdRoadmapAnalyze` | 93-241 | line 104: `planningPaths(cwd).phases` (which resolves to literal via `core.cjs:277`); line 137: readdirSync; line 142: readdirSync | reads phase dirs for disk-status correlation |
| `cmdRoadmapUpdatePlanProgress` | 243-338 | via `findPhaseInternal` | indirect |

**1 literal site, but it goes through `planningPaths()`** — refactor `planningPaths` and this file changes nothing locally.

#### `get-shit-done/bin/lib/core.cjs` — the single chokepoint

| Function | Lines | Note |
|---|---|---|
| `planningPaths(cwd)` | 269-280 | line 277: `phases: path.join(base, 'phases')` — CHOKEPOINT 1 |
| `searchPhaseInDir(baseDir, ...)` | 331-383 | accepts baseDir param — already partition-agnostic |
| `findPhaseInternal(cwd, phase)` | 385-420 | line 388: `path.join(cwd, '.planning', 'phases')` — CHOKEPOINT 2 |
| `getArchivedPhaseDirs(cwd)` | 422-455 | accesses `.planning/milestones/v*-phases/` (legacy archive) — leave for back-compat |
| `extractCurrentMilestone(content, cwd)` | 485-552 | reads STATE.md `milestone:` field — REUSE for migration |
| `getMilestoneInfo(cwd)` | 710-745 | reads ROADMAP.md — fallback when STATE.md missing |
| `getMilestonePhaseFilter(cwd)` | 752-785 | reads ROADMAP, returns predicate — keep for legacy back-compat |

**Two literals in core.cjs.** Fixing these two PLUS turning `planningPaths().phases` into a getter cascades correctly through ~half the downstream sites.

#### `get-shit-done/bin/lib/state.cjs` — 2 literal sites

| Function | Lines |
|---|---|
| `cmdStateUpdateProgress` | 304: `planningPaths(cwd).phases` (chokepoint-derived) |
| `buildStateFrontmatter` | 644-669: `planningPaths(cwd).phases` (chokepoint-derived) |

Both go through `planningPaths()` — auto-fixed by chokepoint refactor.

#### `get-shit-done/bin/lib/milestone.cjs` — 2 literal sites

| Function | Lines | Action |
|---|---|---|
| `cmdMilestoneComplete` | 98: `planningPaths(cwd).phases`; 222: same; 227: `fs.renameSync(path.join(phasesDir, dir), path.join(phaseArchiveDir, dir))` | Auto-fixed by chokepoint. Plus EXTENSION POINT for `MILESTONE-{ver}-SUMMARY.md` writer. |
| `cmdRequirementsMarkComplete` | (no phase paths) | no change |

#### `get-shit-done/bin/lib/commands.cjs` — 4 sites

| Function | Lines |
|---|---|
| `progressRenderInternal` | 105: `planningPaths(cwd).phases`; 118-125: readdirSync of `phasesDir` |
| `cmdStats` | 691: `planningPaths(cwd).phases`; 719-730: readdir |
| `cmdScaffold` | 404: `planningPaths(cwd).phases`; 412-419: readdir |

All via chokepoint — auto-fixed.

#### `get-shit-done/bin/lib/uat.cjs` — 2 literal sites

| Function | Lines |
|---|---|
| `auditUatInternal` | 14: `path.join(cwd, '.planning', 'phases')` — LITERAL |
| `cmdAuditUat` | 98: `path.join(cwd, '.planning', 'phases')` — LITERAL |

**Direct literals — need refactor.**

#### `get-shit-done/bin/lib/verify.cjs` — 2 literal sites

| Function | Lines |
|---|---|
| (unknown name) | 642: `path.join(cwd, '.planning', 'phases')` — LITERAL |
| (unknown name) | 783: `path.join(planningDir, 'phases')` — LITERAL |

Direct literals — need refactor.

**Total literal `.planning/phases` occurrences in lib code:** ~25 (5 in init.cjs + 8 in phase.cjs + 1 in roadmap.cjs via planningPaths + 2 in core.cjs + 2 in state.cjs via planningPaths + 3 in milestone.cjs via planningPaths + 4 in commands.cjs via planningPaths + 2 in uat.cjs direct + 2 in verify.cjs direct). The 13 that go through `planningPaths()` are auto-fixed by the chokepoint refactor; the other 12 are direct literals that need per-site edits.

**Recommendation:** Refactor `planningPaths().phases` to a getter that calls a new `phasesDir(cwd)` helper. Then convert the 12 direct-literal sites to call the helper. Net change: 13 sites get refactored, but 12 of them are mechanical 2-line edits.

### §3 — Existing milestone-boundary logic (extension points)

#### `commands/gsd2/complete-milestone.md` (commands wrapper)

- Currently calls `gsd-tools milestone complete v[X.Y] --name "..."` (line 105 in workflow).
- **What it already mutates:** archives ROADMAP, REQUIREMENTS, audit file; creates MILESTONES.md entry; updates STATE.md; optionally moves phase dirs (with `--archive-phases`).
- **What Phase 5 adds:** writes `.planning/{ver}/SUMMARY.md` (the rich typed-tag distillation) as a new mutation. Sections: `decisions[]`, `requirements_validated[]`, `open_blockers[]`, `entry_points[]`, `public_api[]`.
- **Where to hook:** Add a new step in `cmdMilestoneComplete` after archive_milestone and before STATE update. Or — cleaner — add a sub-step `write_distillation` in the workflow that calls a new `gsd-tools milestone distill v[X.Y]` subcommand (single-purpose, testable in isolation).

#### `get-shit-done/workflows/new-milestone.md` (creates next milestone)

- Currently supports `--reset-phase-numbers` (line 17): archives old phases via `find .planning/phases -mindepth 1 -maxdepth 1 -type d -exec mv {} "${phase_archive_path}/"` (line 117).
- **What Phase 5 adds:** When the prior milestone has been partitioned (post-Phase-5), the reset is automatic — new milestone starts with empty `.planning/{new-ver}/phases/` directory. The `--reset-phase-numbers` flag becomes a no-op in the partitioned world (still useful for legacy → partition transition).
- **Where to hook:** Update workflow step 7.5 ("Reset-phase safety") to detect partitioned vs legacy mode and short-circuit when partitioned.

#### `commands/gsd2/cleanup.md` (existing archive logic — CONFLICTS WITH RETROFIT)

- Currently identifies "phase directories from completed milestones still in `.planning/phases/`" and moves them to `.planning/milestones/v[X.Y]-phases/`.
- **CONFLICT:** After Phase 5, completed milestone phases live at `.planning/{ver}/phases/` — already correctly partitioned, NOTHING to clean up. The cleanup workflow becomes obsolete.
- **Resolution:** Keep `cleanup.md` working for legacy (pre-Phase-5) trees that haven't been migrated yet. Once a tree is migrated, cleanup correctly reports "nothing to clean up" (because the loop "find phases in `.planning/phases/`" returns empty). No behavior change needed.
- **Risk:** Documentation drift — both `cleanup.md` and migration tool describe similar-looking actions. Plan should add a doc note to `cleanup.md` saying "for trees not yet migrated to milestone-partition layout (pre-v1.4.5)".

#### `commands/gsd2/audit-milestone.md` (future consumer of distillation)

- Currently reads `Glob: .planning/phases/*/*-SUMMARY.md` and `*-VERIFICATION.md` (lines 29-30).
- **What Phase 5 adds:** post-migration, this glob misses files (need `**` to span partition); plus, the distillation artifact at `.planning/{ver}/SUMMARY.md` becomes a richer input for audit-milestone.
- **Where to hook:** Update glob to `**` OR replace with `gsd-tools audit-uat` (partition-aware via lib).
- For Phase 5's MVP: just fix the glob. Future enhancement = audit-milestone reads the typed-tag distillation directly (Phase 6 territory).

### §4 — Existing tag/link infrastructure (Phase 6 substrate)

**Typed-tag conventions already in use:**

1. **`must_haves.truths[].verify[]`** (phase-prompt.md:584-625) — `{statement, verify: [{cmd, expect, type}], evidence}`. Used by gsd-verifier.
2. **`must_haves.key_links[]`** (phase-prompt.md:599-625) — `{from, to, via, pattern}`. Cross-file connection tags.
3. **`<verify>` inline task tags** (phase-prompt.md:75, 88, 364, 372, 430, 438) — XML wrapping a shell command in tasks.
4. **`verify_after="true"` task attribute** (phase-prompt.md:316-319) — boolean tag enabling the auto-verify loop.
5. **`requirements-completed: []` frontmatter** (summary.md:41) — REQ-ID linkage from SUMMARY to REQUIREMENTS.
6. **`requires: / provides: / affects:` frontmatter** (summary.md:17-22) — phase dependency graph already.
7. **`key-decisions: / patterns-established:` frontmatter** (summary.md:33-39) — typed decision tags.

**STATE.md decisions log schema** (concrete examples from `.planning/STATE.md` lines 41-74):
```
- [Phase 04-03] gsd-debugger needed no source change — find_root_cause_only mode + symptoms_prefilled flag pre-existed; verified by grep, no commit
- [Phase 04-verification-harness-and-context-efficiency]: [Phase 04-02] File-level granularity (no line numbers) for the dependency graph — keeps it readable and stable across edits
```

Format: `[Phase XX-name]: [decision text] — [rationale optional]`. Free-form prose, NOT typed-tag. Phase 5 distillation should preserve the rationale → fact mapping but normalize into typed-tag YAML form for the `MILESTONE-{ver}-SUMMARY.md` artifact.

**Recommended distillation artifact schema** (graph-ready, Phase 6 indexable):

```yaml
---
milestone: v1.4
shipped: 2026-XX-XX
phases: [01, 02, 03, 04, 05]
---

# Milestone v1.4 — [Name] Summary

## decisions[]
- id: dec-1
  text: "Classify, don't ask: Router infers domain from phase description"
  phase: "01"             # link to phase 01
  type: "design"          # typed tag: design | architectural | tradeoff | technical-debt
  rationale: "Avoid yes/no gate that fires even on non-UI work"
- id: dec-2
  text: "Test contracts in AGENT-SPEC mirror TEST-SPEC.md exactly"
  phase: "02"
  type: "interop"
  rationale: "SPEC-04 structural reuse"

## requirements_validated[]
- id: REQ-DRTR-01
  phase: "01"
  evidence: ".planning/v1.4/phases/01-domain-router/01-VERIFICATION.md"

## open_blockers[]
- id: blocker-1
  text: "parseMustHavesBlock 4-space-indent regex bug"
  phase: "04-03"
  severity: "low"
  carries_to: "v1.5"     # which next milestone inherits this

## entry_points[]
- file: "get-shit-done/bin/lib/init.cjs"
  symbol: "cmdInitPhaseOp"
  purpose: "generic phase operation context"

## public_api[]
- subcommand: "gsd-tools verify commands {plan}"
  phase: "04-03"
  introduced: "v1.4.5"
```

This shape lets Phase 6's graph indexer build edges: decision→phase, requirement→evidence, blocker→carries_to, entry_point→symbol, public_api→phase. The schema mirrors `must_haves` conventions already in use.

### §5 — Test infrastructure

**Test framework:** `node:test` (built-in, no Jest/Mocha) — `tests/helpers.cjs:5` imports `{ test, describe, beforeEach, afterEach } = require('node:test')`.

**Test directory layout:** 29 test files in `tests/`, each named `{module}.test.cjs`. Coverage gate is `c8 --check-coverage --lines 70 --include 'get-shit-done/bin/lib/*.cjs'` (package.json:50). Tests live colocated by lib module — `phase.test.cjs`, `milestone.test.cjs`, etc.

**Test runner:** `npm test` → `node scripts/run-tests.cjs`. Single-process. Subprocess execution per `runGsdTools()` call.

**CLI subcommand testing pattern:**
```js
// tests/helpers.cjs:18-42
function runGsdTools(args, cwd) {
  // Spawns `node get-shit-done/bin/gsd-tools.cjs ${args}` in cwd
  // Returns { success, output, error }
}
```

Every test does: `createTempProject()` → writes fixture files → `runGsdTools('command sub', tmpDir)` → asserts on `result.success` and `JSON.parse(result.output)`.

**Fixture project shape:**
```js
// tests/helpers.cjs:45-49
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}
```

This creates `<tmp>/.planning/phases/` — the **legacy** layout. Phase 5 tests need a sibling `createPartitionedTempProject()` that creates `<tmp>/.planning/<milestone>/phases/` plus a STATE.md with `milestone: vX.Y` frontmatter.

**Workflow-level testing:** Workflows are markdown, NOT independently tested. They are smoke-tested transitively via the CLI subcommands they call. No harness simulates a project planning tree end-to-end. This is a real gap — Phase 4's `verifier-loop end-to-end dogfood` deferral (CHANGELOG.md 1.4.5) is the precedent. Same risk applies to Phase 5: the migration retrofit will only be properly tested by **dogfooding on the v1.4 tree itself** (which is exactly what CONTEXT.md success criterion 8 calls for).

**Precedent for "simulate old-layout" fixture:** NO direct precedent exists. The closest is `tests/milestone.test.cjs:138-172` (archives-phases test) and `tests/init.test.cjs:403-415` (archive directory scanning) — both construct `.planning/milestones/v1.0-phases/` archive directories as legacy fixtures. These can be lifted into a new `createLegacyFixture()` helper.

**For Phase 5, add to tests/helpers.cjs:**
- `createLegacyLayoutFixture(milestone)` — produces `<tmp>/.planning/phases/<NN-name>/...` (current state).
- `createPartitionedFixture(milestone)` — produces `<tmp>/.planning/<milestone>/phases/<NN-name>/...` (post-migration state).
- `createMidMigrationFixture()` — produces both layouts simultaneously (manifest written, but moves incomplete). For testing crash recovery.

### §6 — Migration approach options (design space)

#### §6.1 — `git mv` vs filesystem move + git add

**Recommendation: `git mv` (preferred), with filesystem move + git add as fallback.**

- `git mv` preserves file rename detection in `git log --follow` output — critical for blame and history archaeology.
- `git mv` fails if (a) source has uncommitted changes not staged for the move, or (b) destination already exists (won't overwrite).
- Filesystem move + `git add -A` works but git's rename detection is heuristic (>50% content similarity by default) — partial-edit phases may show as delete+create rather than rename.
- **In practice:** Phase 5 retrofit moves whole directories of mostly-unchanged content; rename detection will work either way. But `git mv` makes intent explicit and bypasses the heuristic.

**Atomicity:** Wrap all `git mv` calls in a single shell pipeline, then a single `git commit -m "chore: migrate to milestone-partition layout"`. If any `git mv` fails, run `git reset --hard HEAD` and exit. NO partial state.

#### §6.2 — Atomic migration / interruption-safe design

**Recommendation: manifest-driven, single-commit transaction.**

Process:
1. Build manifest (`.planning/.migration-manifest.json`) — list of all moves (old_path → new_path) and rewrites (file → list of pattern→replacement).
2. Display dry-run summary: `N dirs to move, M ref-rewrites in K files`.
3. If `--dry-run`: print manifest and exit.
4. Otherwise: prompt `[y/N]`.
5. On `y`: execute all `git mv` ops in sequence, then run all rewrite ops in sequence.
6. Commit everything: `git commit -m "chore: migrate to milestone-partition layout (v{ver})"` — one commit captures the entire transition.
7. Delete `.migration-manifest.json` on success.

**Interruption recovery:** If the manifest exists at startup (left over from a crashed previous run), refuse to do anything else and report "Previous migration incomplete. Run `gsd-tools migrate-recover` or manually `git reset --hard` to discard." Don't auto-recover — let user inspect.

#### §6.3 — Reference rewrite regex design

**Two patterns, in order of strictness:**

```js
// Pattern 1: full ".planning/phases/NN-..." paths
const PATTERN_FULL_PATH = /(\.planning\/)phases\/((?:\d+[A-Z]?(?:\.\d+)*)-[a-z0-9-]+)/g;
// Replace match[0] with `.planning/${milestone}/phases/${match[2]}`

// Pattern 2: bare "phases/NN-..." (less strict, only in todos/ and quick/)
const PATTERN_BARE = /(?<![a-zA-Z./_])phases\/((?:\d+[A-Z]?(?:\.\d+)*)-[a-z0-9-]+)/g;
// Replace match[0] with `${milestone}/phases/${match[1]}`
```

**False-positive risk analysis:**

- Pattern 1 anchors on `.planning/` prefix — basically zero false positives (no other context says "`.planning/phases/`" by accident).
- Pattern 2 is the risky one. Anchored with `(?<![a-zA-Z./_])` negative lookbehind — rules out `subdomain.planning/phases/` and `path/phases/` (different folder) and `_phases/` (word boundary). Requires `-` slug suffix — rules out plain `phases/1` (ambiguous prose).
- **Additional safety:** show every proposed replacement in dry-run. User sees: `todos/foo.md:42  phases/03-bar  →  v1.4/phases/03-bar`. They can abort if anything looks wrong.

**Files that contain literal `phases/` strings BUT are NOT phase refs** (must not be rewritten):

- Git commit message history — explicitly out of scope per CONTEXT §4.
- Output of `git log` shown inside `.planning/STATE.md` Decisions section — *might* contain `phases/...` literally. Mitigation: pattern 1's `.planning/` prefix anchor protects this (a git log line saying "`phases/04-foo`" without the `.planning/` prefix won't match pattern 1).
- Free prose mentioning phase numbers ("see phases 1-3 for context") — never matches either pattern (no `/` after `phases`).

#### §6.4 — Dry-run output format

**Recommendation:** mirror the format used by `cmdValidateHealth --repair` (verify.cjs) — group by category, show counts, show per-item detail.

```
GSD MIGRATION PLAN: Legacy → Milestone-partitioned layout

Active milestone (from STATE.md): v1.4

PHASE DIRECTORIES TO MOVE (5):
  .planning/phases/01-domain-router/                                  →  .planning/v1.4/phases/01-domain-router/
  .planning/phases/02-agent-spec/                                     →  .planning/v1.4/phases/02-agent-spec/
  .planning/phases/03-documentation-agent/                            →  .planning/v1.4/phases/03-documentation-agent/
  .planning/phases/04-verification-harness-and-context-efficiency/    →  .planning/v1.4/phases/04-verification-harness-and-context-efficiency/
  .planning/phases/05-milestone-versioned-phase-ids/                  →  .planning/v1.4/phases/05-milestone-versioned-phase-ids/

REFERENCE REWRITES (root files: ALWAYS):
  .planning/STATE.md           — 12 path-shaped occurrences
  .planning/PROJECT.md         — 3 path-shaped occurrences
  .planning/ROADMAP.md         — 6 path-shaped occurrences
  .planning/cross-phase-notes.md — 2 path-shaped occurrences

REFERENCE REWRITES (todos/, quick/ — path-shaped only):
  .planning/todos/pending/abc.md  — 1 path-shaped occurrence
  .planning/quick/260507-u0a-.../260507-u0a-PLAN.md  — 4 path-shaped occurrences

NOT MIGRATED (stays at root): PROJECT.md, ROADMAP.md, STATE.md, cross-phase-notes.md, todos/, quick/

TOTAL: 5 directories, 28 reference rewrites in 6 files, 1 commit

Proceed? [y/N]
```

This format is human-scannable, dry-run prints it and exits, real run prints it then prompts.

## Validation Architecture

**Test framework:** `node:test` (built-in), runner via `npm test` → `node scripts/run-tests.cjs`. Coverage gate enforced at 70% lines via `c8` on `get-shit-done/bin/lib/*.cjs`.

| Property | Value |
|---|---|
| Framework | `node:test` (Node ≥18 builtin) |
| Config file | none (uses defaults) |
| Quick run command | `npm test` |
| Full suite command | `npm test` (~30s) |
| Test fixture helper | `tests/helpers.cjs` — `createTempProject()`, `runGsdTools()` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| SC-1 | After Phase 5, `.planning/v1.4/phases/...` is canonical for v1.4 | unit (CLI subcommand) | `node --test tests/init.test.cjs` (extend with partitioned fixture) | ❌ Wave 0 (extend) |
| SC-2 | Migration prints plan and prompts `[y/N]`; `--dry-run` exits without changes | unit + property | `node --test tests/migration.test.cjs` (new file) | ❌ Wave 0 (new) |
| SC-3 | `git mv` preserves history; ref-rewrites work in STATE/PROJECT/ROADMAP/cross-phase-notes/todos/quick | integration | `node --test tests/migration.test.cjs` (with `createTempGitProject` from helpers.cjs:52-69) | ❌ Wave 0 (new) |
| SC-4 | Missing/corrupt STATE.md `milestone:` → clear refusal error | unit | `node --test tests/migration.test.cjs::missing-milestone-field` | ❌ Wave 0 (new) |
| SC-5 | `MILESTONE-{ver}-SUMMARY.md` produced with typed-tag sections | unit | `node --test tests/milestone.test.cjs` (extend) | ❌ Wave 0 (extend) |
| SC-6 | `/gsd2:progress` (via `cmdInitProgress`) loads only active milestone + summaries of prior | unit | `node --test tests/init.test.cjs::cmdInitProgress` (extend) | ❌ Wave 0 (extend) |
| SC-7 | Decimal-phase resolution works inside partition; placeholders resolve | unit + property | `node --test tests/phase.test.cjs::phase-next-decimal` (extend with partitioned fixture) | ❌ Wave 0 (extend) |
| SC-8 | Retrofit of current v1.4 tree as integration test, committed | E2E / dogfood | manual: run `gsd-tools migrate-to-milestone-partition` against this repo and commit the result | ❌ N/A — dogfood proves it |

### Wave 0 Gaps

- [ ] `tests/migration.test.cjs` — new file covering SC-2, SC-3, SC-4. Likely 15–25 tests:
  - dry-run prints plan and does not mutate
  - `[y/N]` confirmation gate
  - `git mv` preserves history (use `git log --follow` assertion)
  - reference rewrite in STATE.md, PROJECT.md, ROADMAP.md, cross-phase-notes.md
  - reference rewrite in `todos/**/*.md` and `quick/**/*.md` (path-shaped only)
  - free-prose mention of "phases" is NOT rewritten (false-positive guard)
  - missing STATE.md `milestone:` → exit 1 with clear error
  - corrupt STATE.md frontmatter → exit 1 with clear error
  - manifest left in place on crash; refuses to re-run cleanly
  - same migration is idempotent if manifest is fresh (no double-mv)
- [ ] `tests/helpers.cjs` — extend with:
  - `createLegacyLayoutFixture(milestone = 'v1.0')` — old layout
  - `createPartitionedFixture(milestone = 'v1.4')` — new layout
  - `withStateMilestone(tmpDir, version)` — write STATE.md frontmatter
- [ ] `tests/init.test.cjs` — extend `cmdInitProgress` tests with a partitioned-layout fixture asserting only milestone phases are emitted in `phases[]`.
- [ ] `tests/phase.test.cjs` — extend `phase-next-decimal` tests with a partitioned-layout fixture.
- [ ] `tests/milestone.test.cjs` — extend `cmdMilestoneComplete` tests with a `MILESTONE-{ver}-SUMMARY.md` assertion (typed-tag schema validation).
- [ ] No framework install needed — `node:test` is already wired.

## Sources

### Primary (HIGH confidence — verified by direct file read)

- `get-shit-done/bin/lib/init.cjs` (1167 lines) — every init command and JSON contract
- `get-shit-done/bin/lib/phase.cjs` (986 lines) — every phase CRUD + decimal resolver
- `get-shit-done/bin/lib/core.cjs` (818 lines) — chokepoint helpers, milestone scoping
- `get-shit-done/bin/lib/state.cjs` (959 lines) — STATE.md frontmatter sync, signal pattern
- `get-shit-done/bin/lib/milestone.cjs` (259 lines) — milestone closure logic
- `get-shit-done/bin/lib/roadmap.cjs` (345 lines) — roadmap parsing
- `get-shit-done/bin/lib/uat.cjs` (203 lines) — phasesDir literals
- `get-shit-done/bin/gsd-tools.cjs` (756 lines) — subcommand dispatcher
- `tests/helpers.cjs`, `tests/milestone.test.cjs`, partial `tests/phase.test.cjs`, `tests/roadmap.test.cjs`, `tests/init.test.cjs`
- `get-shit-done/workflows/complete-milestone.md`, `new-milestone.md`, `cleanup.md`, `progress.md`, plus the full grep enumeration of placeholder occurrences
- `commands/gsd2/complete-milestone.md`, `new-milestone.md`, `cleanup.md`, `audit-milestone.md`, `audit-uat.md`
- `get-shit-done/templates/phase-prompt.md` (typed-tag substrate)
- `get-shit-done/templates/milestone-archive.md`, `summary.md` (existing distillation precedents)
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/cross-phase-notes.md`, `CHANGELOG.md`
- `.planning/phases/05-milestone-versioned-phase-ids/05-CONTEXT.md`

### Secondary (MEDIUM confidence)

- Project conventions inferred from CHANGELOG.md (commit prefix patterns, source vs runtime split, conventional commit style)
- `package.json` test script and coverage gate

### Tertiary (LOW confidence)

- None — all findings traced to direct file inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external libs to verify; all builtin
- Touch-point enumeration (§1, §2): HIGH — grep-verified, line numbers cited
- Architecture patterns (§3, §4): HIGH — direct reads of extension points + tag substrate
- Migration design (§6): MEDIUM — design space mapped, but no in-tree precedent for `git mv`-with-ref-rewrite; first-of-its-kind for this codebase
- Test infrastructure (§5): HIGH — direct read of `helpers.cjs` and existing test files
- Common pitfalls: HIGH — Pitfall 1 is documented in CHANGELOG; pitfalls 2–6 derive from direct reading of the CLI code paths

**Open questions:**

1. **Should `MILESTONE-{ver}-SUMMARY.md` live at `.planning/{ver}/SUMMARY.md` (CONTEXT.md location §4) or `.planning/milestones/MILESTONE-{ver}-SUMMARY.md` (ROADMAP entry §5 calls it `MILESTONE-{version}-SUMMARY.md`)?**
   - CONTEXT.md is more recent (2026-05-12 resolved items) and explicit: `.planning/{ver}/SUMMARY.md`.
   - ROADMAP.md uses the longer name `MILESTONE-{version}-SUMMARY.md` (was older wording).
   - **Recommendation:** Use CONTEXT.md decision: `.planning/{ver}/SUMMARY.md`. Update ROADMAP.md success criterion 5 wording during Plan 05-03 to match.

2. **Where should the auto-detect-and-prompt hook fire?**
   - Options: (a) at top of every `gsd-tools` subcommand (most aggressive), (b) only when `cmdInitPhaseOp` runs (most user flows go through here), (c) only on first `/gsd2:progress` after Phase 5 lands (lazy detect).
   - **Recommendation:** (b). It's the single chokepoint that every phase workflow uses. Once you run `discuss-phase`, `plan-phase`, `execute-phase`, etc., you go through `cmdInitPhaseOp`. Detection adds <10ms. Other commands (`new-project`, `quick`, etc.) don't need it.
   - **Caveat:** `/gsd2:progress` does NOT call `init phase-op` — it calls `init progress`. So we need detection in `cmdInitProgress` too. Add to both.

3. **How does the migration handle `.gitignore`'d `.planning/` (some users gitignore the entire `.planning/` directory)?**
   - If `.planning/` is gitignored, `git mv` won't preserve history because there is no history to preserve. The migration should detect this via `git check-ignore .planning/` and skip `git mv` in favor of plain `fs.renameSync` + a note in the output.
   - **Recommendation:** Plan 05-02 includes this branch. Already pattern-precedent in `isGitIgnored(cwd, targetPath)` at core.cjs:128.

**Research date:** 2026-05-12
**Valid until:** ~2026-06-12 (stable; CLI tree changes infrequently)
