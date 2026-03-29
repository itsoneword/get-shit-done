# Changelog — GSD2

Experimental fork of [get-shit-done](https://github.com/gsd-build/get-shit-done). Forked from v1.26.0.

## [1.3.2] - 2026-03-29

### Changed
- **`/gsd2:progress` command** — now always displays a full phase table with status icons and descriptions

### Added
- **`/gsd2:fix` command** — post-execution issue fixing with dependency awareness. After executing a phase, list what's wrong and the fixer classifies each issue (current-phase / regression / not-yet-built), maps dependencies before changing code, and fixes without cascading breakage
- **`gsd-fixer` agent** — example-driven agent design based on research best practices. Four concrete naive-vs-smart examples guide behavior instead of prescriptive rules

### Removed
- **`/gsd2:fast` command** — trivial inline task execution (no longer needed; just ask directly)
- **`/gsd2:quick` command** — ad-hoc task execution with planning (replaced by phase workflow + `/gsd2:fix`)
- **`quick_branch_template` config** — removed with quick command
- Quick task tests (`quick-branching.test.cjs`, `quick-research.test.cjs`)

### Changed
- **Workflow guard hook** — now suggests `/gsd2:fix` instead of fast/quick
- **`/gsd2:do` router** — routes fix/broken/issue inputs to `/gsd2:fix`
- **Help reference** — replaced Quick Mode section with Fixing Issues section
- **CLAUDE.md template** — references `/gsd2:fix` instead of `/gsd2:quick`
- Updated all docs (COMMANDS, AGENTS, ARCHITECTURE, FEATURES, USER-GUIDE, CLI-TOOLS, CONFIGURATION)

## [1.2.1] - 2026-03-21

### Fixed
- **Update checker false positive in dev mode** — skip npm version check when running from GSD source repo
- **Stale hooks false positive** — added missing version header to workflow-guard hook
- **Build version stamping** — `build-hooks.js` now replaces `{{GSD_VERSION}}` placeholder in dist hooks

## [1.0.0] - 2026-03-20

### Changed
- **Conversation-first discuss-phase** — replaced rigid menu-driven interview (3-4 gray areas × 4 AskUserQuestion) with genuine back-and-forth conversation following questioning.md philosophy
- **Codebase-driven questions** — scout_codebase now classifies ESTABLISHED vs NEW patterns; only NEW areas get discussed
- **Adaptive depth** — no fixed question count; complex phases get deep discussion, simple phases get quick confirmation

### Added
- **Signal strength** — every decision in CONTEXT.md carries `[STRONG]`, `[WEAK]`, or `[DISCRETION]` based on user's emphasis and engagement
- **`<established>` section** in CONTEXT.md — tells planner what's already decided by existing codebase
- **Cross-phase note pollination** — insights from one phase discussion automatically saved for related phases via `.planning/cross-phase-notes.md`
- **Discussion focus hints** — roadmapper generates `**Discussion focus**:` per phase in ROADMAP.md to guide conversation priorities
- **Architecture visualizations** — `gsd-architecture.html` (pipeline analysis) and `gsd-orchestration.html` (agent spawning map)

### Removed
- Pre-generated gray area categories
- Fixed 4-question-per-area structure
- Generic AskUserQuestion as primary interaction mode
