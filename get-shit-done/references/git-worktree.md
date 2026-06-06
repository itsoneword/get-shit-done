Load this when you need to isolate work in a separate working tree before running a task — detect existing isolation first.

---

# Git Worktree Technique Reference

## Overview

Ensure work happens in an isolated workspace. Prefer the platform's native worktree tools. Fall back to manual git worktrees only when no native tool is available.

**Core principle:** Detect existing isolation first. Then use native tools. Then fall back to git. Never fight the harness.

---

## Step 0: Detect Existing Isolation (ALWAYS First)

Before creating anything, check if you are already in an isolated workspace.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
```

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git submodules. Before concluding "already in a worktree," verify you are not in a submodule:

```bash
# If this returns a path, you are in a submodule — treat as normal repo
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` (and not a submodule):** You are already in a linked worktree. Do NOT create another worktree. Skip directly to Step 3 (Project Setup).

**If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repo checkout. Proceed to Step 1.

---

## Step 1a: Native Tools First (Preferred)

If a native worktree tool exists — `EnterWorktree`, `WorktreeCreate`, a `/worktree` command, or a `--worktree` flag — use it instead of raw git. Native tools handle directory placement, branch creation, and cleanup automatically. Using `git worktree add` when a native tool exists creates phantom state the harness cannot see or manage.

Only proceed to Step 1b if no native worktree tool is available.

---

## Step 1b: Git Worktree Fallback

Use only when Step 1a does not apply. Select the directory with this priority order:

1. **Explicit user preference** — if the user has specified a directory, use it without asking.
2. **Existing `.worktrees/`** — check with `ls -d .worktrees 2>/dev/null`.
3. **Existing `worktrees/`** — check with `ls -d worktrees 2>/dev/null`.
4. **Existing global directory** — `~/.config/.../worktrees/$project` (backward compatibility with legacy global path).
5. **Default** — `.worktrees/` at the project root.

If both `.worktrees/` and `worktrees/` exist, `.worktrees/` wins.

---

## Safety: Ignore Check (Project-Local Directories)

Before creating a project-local worktree, verify the directory is ignored:

```bash
git check-ignore -q .worktrees 2>/dev/null
```

**If NOT ignored:** Add the directory to `.gitignore`, commit that change, then proceed.

This prevents accidentally committing worktree contents to the repository. Global directories (`~/.config/…`) need no verification.

---

## Sandbox Fallback

If `git worktree add` fails with a permission error (sandbox denial): work in place. Run project setup and baseline tests in the current directory instead. Tell the user the sandbox blocked worktree creation.

---

## Step 3: Project Setup

Auto-detect and run the appropriate setup for the project stack:

```bash
if [ -f package.json ]; then npm install; fi
if [ -f Cargo.toml ]; then cargo build; fi
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi
if [ -f go.mod ]; then go mod download; fi
```

---

## Step 4: Baseline Test Verification

Run the project test suite in the new workspace:

```bash
npm test / cargo test / pytest / go test ./...
```

**If tests fail:** Report failures and ask whether to proceed or investigate. Do not proceed with failing tests without explicit confirmation — you cannot distinguish new failures from pre-existing issues without a clean baseline.

**If tests pass:** Report ready.

---

## Red Flags

Never:
- Create a worktree when Step 0 detects existing isolation
- Use raw `git worktree add` when a native tool exists (`EnterWorktree`, `/worktree`, etc.) — this is the most common mistake
- Skip the ignore check for project-local directories
- Skip the baseline test verification
- Proceed with failing tests without asking

---

## Phase 7 Boundary Note

This reference documents the technique ONLY — the steps for detecting isolation, creating a worktree, and verifying a clean baseline.

The execute-phase add→wave→merge orchestration and the parallel-safety gate (ensuring parallel executor agents work in isolated worktrees) are Phase 7 scope (its scope item 1). Do NOT extend this reference with orchestration logic or a gsd-tools helper. That work belongs in Phase 7.
