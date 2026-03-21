<purpose>
Check for GSD updates via npm, display changelog for versions between installed and latest, obtain user confirmation, and execute clean installation with cache clearing.
</purpose>

<process>

<step name="get_installed_version">
Derive `PREFERRED_RUNTIME` from the invoking prompt's `execution_context` path:
- `/.codex/` → `codex` | `/.gemini/` → `gemini` | `/.config/opencode/` or `/.opencode/` → `opencode` | otherwise → `claude`

```bash
# PREFERRED_RUNTIME must be set before this block (from execution_context).
# Fallback: infer from env vars.
if [ -z "$PREFERRED_RUNTIME" ]; then
  if [ -n "$CODEX_HOME" ]; then PREFERRED_RUNTIME="codex"
  elif [ -n "$GEMINI_CONFIG_DIR" ]; then PREFERRED_RUNTIME="gemini"
  elif [ -n "$OPENCODE_CONFIG_DIR" ] || [ -n "$OPENCODE_CONFIG" ]; then PREFERRED_RUNTIME="opencode"
  else PREFERRED_RUNTIME="claude"; fi
fi

# Runtime candidates: "<runtime>:<config-dir>" — array ensures correct iteration in bash and zsh (#1173).
RUNTIME_DIRS=( "claude:.claude" "opencode:.config/opencode" "opencode:.opencode" "gemini:.gemini" "codex:.codex" )

# Reorder: preferred runtime first.
ORDERED_RUNTIME_DIRS=()
for entry in "${RUNTIME_DIRS[@]}"; do
  [ "${entry%%:*}" = "$PREFERRED_RUNTIME" ] && ORDERED_RUNTIME_DIRS+=( "$entry" )
done
for entry in "${RUNTIME_DIRS[@]}"; do
  [ "${entry%%:*}" != "$PREFERRED_RUNTIME" ] && ORDERED_RUNTIME_DIRS+=( "$entry" )
done

LOCAL_VERSION_FILE="" LOCAL_MARKER_FILE="" LOCAL_DIR="" LOCAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"; dir="${entry#*:}"
  if [ -f "./$dir/get-shit-done/VERSION" ] || [ -f "./$dir/get-shit-done/workflows/update.md" ]; then
    LOCAL_RUNTIME="$runtime"; LOCAL_VERSION_FILE="./$dir/get-shit-done/VERSION"
    LOCAL_MARKER_FILE="./$dir/get-shit-done/workflows/update.md"
    LOCAL_DIR="$(cd "./$dir" 2>/dev/null && pwd)"; break
  fi
done

GLOBAL_VERSION_FILE="" GLOBAL_MARKER_FILE="" GLOBAL_DIR="" GLOBAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"; dir="${entry#*:}"
  if [ -f "$HOME/$dir/get-shit-done/VERSION" ] || [ -f "$HOME/$dir/get-shit-done/workflows/update.md" ]; then
    GLOBAL_RUNTIME="$runtime"; GLOBAL_VERSION_FILE="$HOME/$dir/get-shit-done/VERSION"
    GLOBAL_MARKER_FILE="$HOME/$dir/get-shit-done/workflows/update.md"
    GLOBAL_DIR="$(cd "$HOME/$dir" 2>/dev/null && pwd)"; break
  fi
done

# Treat as LOCAL only if resolved paths differ (prevents misdetection when CWD=$HOME).
IS_LOCAL=false
if [ -n "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$LOCAL_VERSION_FILE"; then
  [ -z "$GLOBAL_DIR" ] || [ "$LOCAL_DIR" != "$GLOBAL_DIR" ] && IS_LOCAL=true
fi

if [ "$IS_LOCAL" = true ]; then
  INSTALLED_VERSION="$(cat "$LOCAL_VERSION_FILE")"; INSTALL_SCOPE="LOCAL"; TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$GLOBAL_VERSION_FILE"; then
  INSTALLED_VERSION="$(cat "$GLOBAL_VERSION_FILE")"; INSTALL_SCOPE="GLOBAL"; TARGET_RUNTIME="$GLOBAL_RUNTIME"
elif [ -n "$LOCAL_RUNTIME" ] && [ -f "$LOCAL_MARKER_FILE" ]; then
  INSTALLED_VERSION="0.0.0"; INSTALL_SCOPE="LOCAL"; TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_RUNTIME" ] && [ -f "$GLOBAL_MARKER_FILE" ]; then
  INSTALLED_VERSION="0.0.0"; INSTALL_SCOPE="GLOBAL"; TARGET_RUNTIME="$GLOBAL_RUNTIME"
else
  INSTALLED_VERSION="0.0.0"; INSTALL_SCOPE="UNKNOWN"; TARGET_RUNTIME="claude"
fi

echo "$INSTALLED_VERSION"; echo "$INSTALL_SCOPE"; echo "$TARGET_RUNTIME"
```

Output: line 1 = installed version (`0.0.0` = unknown), line 2 = scope (`LOCAL`/`GLOBAL`/`UNKNOWN`), line 3 = target runtime.

- If scope is `UNKNOWN`: proceed to install using `--claude --global` fallback.
- If multiple runtime installs detected and invoking runtime cannot be determined from `execution_context`: ask user which runtime to update before continuing.
- If VERSION file missing/corrupt: show "Installed version: Unknown — running fresh install" and treat as `0.0.0`.
</step>

<step name="check_latest_version">
```bash
curl -sfL https://raw.githubusercontent.com/itsoneword/get-shit-done/main/package.json | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).version))"
```

If version check fails, show:
```
Couldn't check for updates (offline or GitHub unavailable).
To update manually: `npx github:itsoneword/get-shit-done --global`
```
Then exit.
</step>

<step name="compare_versions">
- **installed == latest:** Clear update cache (same as post-install cache clear), then show "You're already on the latest version (X.Y.Z). No update needed." Exit.
- **installed > latest:** Clear update cache, then show "You're ahead of the latest release (development version?)." Exit.
- **installed < latest:** Continue to next step.
</step>

<step name="show_changes_and_confirm">
Fetch changelog from GitHub raw URL. Extract entries between installed and latest versions. Display:

```
## GSD Update Available

**Installed:** 1.5.10
**Latest:** 1.5.15

### What's New
────────────────────────────────────────────────────────────

## [1.5.15] - 2026-01-20
### Added
- Feature X

## [1.5.14] - 2026-01-18
### Fixed
- Bug fix Y

────────────────────────────────────────────────────────────

⚠️  **Note:** The installer performs a clean install of GSD folders:
- `commands/gsd/` will be wiped and replaced
- `get-shit-done/` will be wiped and replaced
- `agents/gsd-*` files will be replaced

(Paths relative to detected runtime install location:
global: `~/.claude/`, `~/.config/opencode/`, `~/.opencode/`, `~/.gemini/`, or `~/.codex/`
local: `./.claude/`, `./.config/opencode/`, `./.opencode/`, `./.gemini/`, or `./.codex/`)

Your custom files in other locations are preserved:
- Custom commands not in `commands/gsd/` ✓
- Custom agents not prefixed with `gsd-` ✓
- Custom hooks ✓
- Your CLAUDE.md files ✓

If you've modified any GSD files directly, they'll be automatically backed up to `gsd-local-patches/` and can be reapplied with `/gsd2:reapply-patches` after the update.
```

Use AskUserQuestion — "Proceed with update?" — Options: "Yes, update now" / "No, cancel".

If user cancels: exit.
</step>

<step name="run_update">
```bash
RUNTIME_FLAG="--$TARGET_RUNTIME"
# LOCAL
npx -y github:itsoneword/get-shit-done "$RUNTIME_FLAG" --local   # if INSTALL_SCOPE=LOCAL
# GLOBAL
npx -y github:itsoneword/get-shit-done "$RUNTIME_FLAG" --global  # if INSTALL_SCOPE=GLOBAL
# UNKNOWN fallback
npx -y github:itsoneword/get-shit-done --claude --global          # if INSTALL_SCOPE=UNKNOWN
```

If install fails: show error and exit.

Clear update cache so statusline indicator disappears (SessionStart hook writes to detected runtime's cache dir — all paths cleared to prevent stale indicators):
```bash
for dir in .claude .config/opencode .opencode .gemini .codex; do
  rm -f "./$dir/cache/gsd-update-check.json"
  rm -f "$HOME/$dir/cache/gsd-update-check.json"
done
```
</step>

<step name="display_result">
```
╔═══════════════════════════════════════════════════════════╗
║  GSD Updated: v1.5.10 → v1.5.15                           ║
╚═══════════════════════════════════════════════════════════╝

⚠️  Restart your runtime to pick up the new commands.

[View full changelog](https://github.com/itsoneword/get-shit-done/blob/main/CHANGELOG.md)
```
</step>

<step name="check_local_patches">
Check for `gsd-local-patches/backup-meta.json` in the config directory.

- **Patches found:** Show "Local patches were backed up. Run `/gsd2:reapply-patches` to merge your modifications into the new version."
- **No patches:** Continue normally.
</step>

</process>

<success_criteria>
- [ ] Installed version and scope read correctly; runtime flag derived
- [ ] Update skipped if already current or ahead
- [ ] Changelog fetched and displayed BEFORE update; user confirmation obtained
- [ ] Clean install executed; update cache cleared across all runtime dirs
- [ ] Restart reminder shown; local patches flagged if present
</success_criteria>
