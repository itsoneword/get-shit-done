/**
 * install-transform — Pure, side-effect-free path-token transform
 *
 * Extracted from bin/install.js so both install.js and verify.cjs can apply
 * the same substitution without requiring the CLI entry-point (which has
 * top-level side effects: banner output, interactive prompts, process.exit).
 *
 * For a Claude local install the transform is:
 *   ~/.claude/    →  <installDir>/   (where installDir = <cwd>/.claude)
 *   $HOME/.claude/ → <installDir>/
 *   ./.claude/   →  ./.claude/       (no-op: dirName for Claude is '.claude')
 *
 * Only .md files are transformed; other file types (*.cjs, *.js, etc.) are
 * copied verbatim by install.js and therefore compared byte-for-byte by the
 * symmetry checker.  This matches copyWithPathReplacement (install.js L1842).
 */

'use strict';

const path = require('path');

/**
 * Apply the generic GSD path-token replacement to a string of .md content.
 * This is the SINGLE SOURCE OF TRUTH for the substitution that
 * install.js's copyWithPathReplacement performs for every non-copilot,
 * non-antigravity runtime (claude/gemini/codex/cursor/opencode), and that
 * verify.cjs's symmetry-check must reproduce.
 *
 * @param {string} content    Raw source file content
 * @param {string} pathPrefix Absolute (local) or '~/'-rooted (global) install
 *                            prefix, slash-normalised with a trailing '/'.
 * @param {string} dirName    Runtime config dir name (e.g. '.claude', '.gemini')
 * @returns {string} Content with tokens replaced
 */
function applyPathReplacement(content, pathPrefix, dirName) {
  let c = content;
  // Replace ~/.claude/ → <pathPrefix>
  c = c.replace(/~\/\.claude\//g, pathPrefix);
  // Replace $HOME/.claude/ → <pathPrefix>
  c = c.replace(/\$HOME\/\.claude\//g, pathPrefix);
  // Replace ./.claude/ → ./<dirName>/ (no-op when dirName === '.claude')
  c = c.replace(/\.\/\.claude\//g, `./${dirName}/`);
  return c;
}

/**
 * Apply the Claude local-install path-token transform to a string of .md content.
 *
 * @param {string} content   Raw source file content
 * @param {string} installDir Absolute path to the runtime install directory
 *                            (e.g. '/home/user/project/.claude')
 * @returns {string} Content with tokens replaced
 */
function applyClaudeLocalTransform(content, installDir) {
  // Normalise slashes and ensure trailing slash — mirrors install.js L2743
  const pathPrefix = installDir.replace(/\\/g, '/').replace(/\/?$/, '/');
  // dirName is '.claude' for a Claude install → ./.claude/ replacement is a no-op.
  return applyPathReplacement(content, pathPrefix, '.claude');
}

/**
 * Returns true if the given relative path (forward-slash form) should receive
 * path-token transformation.  Currently only .md files are transformed by
 * install.js; all other extensions are verbatim-copied.
 *
 * @param {string} relPathFwd  e.g. "bin/lib/verify.cjs", "workflows/health.md"
 * @returns {boolean}
 */
function isTransformableFile(relPathFwd) {
  return relPathFwd.endsWith('.md');
}

/**
 * Derive the installDir from a project cwd for a Claude local install.
 * Matches install.js: targetDir = path.join(process.cwd(), '.claude')
 *
 * @param {string} cwd  Absolute path to the project root
 * @returns {string}    Absolute path to the .claude install dir
 */
function claudeLocalInstallDir(cwd) {
  return path.resolve(path.join(cwd, '.claude'));
}

module.exports = {
  applyPathReplacement,
  applyClaudeLocalTransform,
  isTransformableFile,
  claudeLocalInstallDir,
};
