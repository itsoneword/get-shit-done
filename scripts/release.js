#!/usr/bin/env node
// scripts/release.js — atomic GSD version bump (dev-repo only; not shipped to installs).
//
// Keeps the four version sites in lockstep, the chain that desynced at 1.4.6:
//   1. package.json          (source of truth)
//   2. hooks/dist/*.js       (// gsd-hook-version: X — stamped by build:hooks)
//   3. .claude/.../VERSION   (runtime — written by install --local)
//   4. CHANGELOG.md          (release notes)
//
// Usage:
//   node scripts/release.js <x.y.z> [notes...]     # or: npm run release -- <x.y.z> [notes...]
//
// Does NOT commit or tag — it mutates + verifies, then prints the exact git
// commands so CHANGELOG notes can be reviewed first (matches the manual 1.4.7 chain).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG = path.join(ROOT, 'package.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');

function die(msg) {
  console.error('\x1b[31m✗\x1b[0m ' + msg);
  process.exit(1);
}

// --- parse args -------------------------------------------------------------
const argv = process.argv.slice(2);
const version = argv[0];
const notes = argv.slice(1).join(' ').trim();

if (!version || version === '-h' || version === '--help') {
  console.log('Usage: node scripts/release.js <x.y.z> [changelog notes...]');
  process.exit(version ? 0 : 1);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  die(`Version must be semver x.y.z — got "${version}"`);
}

// --- guard: dev repo only ---------------------------------------------------
if (!fs.existsSync(path.join(ROOT, 'scripts', 'build-hooks.js'))) {
  die('No scripts/build-hooks.js — release.js only runs in the GSD dev repo.');
}

// --- 1. package.json --------------------------------------------------------
const pkgRaw = fs.readFileSync(PKG, 'utf8');
const pkg = JSON.parse(pkgRaw);
const prev = pkg.version;
if (prev === version) {
  console.log(`\x1b[33m›\x1b[0m package.json already at ${version} — re-stamping dist/runtime anyway.`);
}
// Rewrite only the version line to preserve formatting and field order.
const pkgNext = pkgRaw.replace(
  /("version"\s*:\s*")[^"]+(")/,
  `$1${version}$2`
);
if (pkgNext === pkgRaw && prev !== version) {
  die('Could not locate the "version" field in package.json.');
}
fs.writeFileSync(PKG, pkgNext);
console.log(`\x1b[32m✓\x1b[0m package.json: ${prev} → ${version}`);

// --- 2 + 3. build dist headers, install runtime ----------------------------
console.log('\x1b[36m›\x1b[0m npm run build:hooks');
execSync('npm run build:hooks', { cwd: ROOT, stdio: 'inherit' });
console.log('\x1b[36m›\x1b[0m node bin/install.js --local');
execSync('node bin/install.js --local', { cwd: ROOT, stdio: 'inherit' });

// --- 4. CHANGELOG -----------------------------------------------------------
const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const body = notes || '_TODO: describe this release._';
const entry = `## [${version}] - ${date}\n\n${body}\n\n`;
const clRaw = fs.readFileSync(CHANGELOG, 'utf8');
const firstEntry = clRaw.search(/^## \[/m);
if (firstEntry === -1) {
  die('Could not find an existing "## [" entry in CHANGELOG.md to anchor the new one.');
}
const clNext = clRaw.slice(0, firstEntry) + entry + clRaw.slice(firstEntry);
fs.writeFileSync(CHANGELOG, clNext);
console.log(`\x1b[32m✓\x1b[0m CHANGELOG.md: prepended [${version}] - ${date}`);

// --- verify lockstep --------------------------------------------------------
const problems = [];
const distDir = path.join(ROOT, 'hooks', 'dist');
for (const f of fs.readdirSync(distDir).filter((n) => n.endsWith('.js'))) {
  const head = fs.readFileSync(path.join(distDir, f), 'utf8').split('\n').slice(0, 3).join('\n');
  const m = head.match(/gsd-hook-version:\s*(\S+)/);
  if (!m) problems.push(`${f}: missing gsd-hook-version header`);
  else if (m[1] !== version) problems.push(`${f}: header ${m[1]} ≠ ${version}`);
}
const runtimeVersion = path.join(ROOT, '.claude', 'get-shit-done', 'VERSION');
if (fs.existsSync(runtimeVersion)) {
  const rv = fs.readFileSync(runtimeVersion, 'utf8').trim();
  if (rv !== version) problems.push(`runtime VERSION ${rv} ≠ ${version}`);
}
if (problems.length) {
  console.error('\x1b[31m✗ lockstep check failed:\x1b[0m');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`\x1b[32m✓\x1b[0m lockstep: package.json, ${'dist headers'}, runtime VERSION, CHANGELOG all at ${version}`);

// --- next steps -------------------------------------------------------------
console.log('\nReview CHANGELOG.md, then commit + tag:');
console.log(`  git add package.json hooks/dist CHANGELOG.md`);
console.log(`  git commit -m "chore(release): bump version to ${version}"`);
console.log(`  git tag -a v${version} -m "v${version}"`);
