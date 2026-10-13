#!/usr/bin/env node
/**
 * Get this week's labs into the Codespace you already have. Run: npm run update
 * First time only (your Codespace is older than this script), paste this one line instead:
 *   git fetch -q https://github.com/cydeo-agentic/agentic-commerce-lab.git main && git show FETCH_HEAD:scripts/lab-update.mjs > /tmp/lab-update.mjs && node /tmp/lab-update.mjs
 *
 * Your Codespace was made from the template, so it has no `origin` to pull from. This script fetches the public lab
 * repository by URL and brings in only the lab's own files: labs/, scripts/ and .qwen/agents/.
 * Nothing you wrote is overwritten: if you changed one of those files, the new version is saved next to yours as
 * <file>.update. Your store, your tests, AGENTS.md and your .env are never touched.
 * In package.json it only adds the lab's npm scripts; in .qwen/settings.json it only adds the lab's rules.
 * Self-contained on purpose (no imports from this repo), so it can run from /tmp before the lab files exist.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const LAB_REPO = process.env.LAB_REPO ?? 'https://github.com/cydeo-agentic/agentic-commerce-lab.git';
const LAB_REF = process.env.LAB_REF ?? 'main';
const MANAGED = ['labs/', 'scripts/', '.qwen/agents/'];
const MANIFEST = '.lab-update.json';

const git = (...args) => spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sha = (text) => createHash('sha256').update(text).digest('hex');
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

if (git('rev-parse', '--is-inside-work-tree').stdout.trim() !== 'true') {
  console.log('Run this from the lab folder (the one with package.json and PRD.md).');
  process.exit(1);
}
const top = git('rev-parse', '--show-toplevel').stdout.trim();
process.chdir(top);

const fetched = git('fetch', '--quiet', LAB_REPO, LAB_REF);
if (fetched.status !== 0) {
  console.log(`Could not fetch the lab (${LAB_REF}). Post this in the support thread:\n${(fetched.stderr || '').trim()}`);
  process.exit(1);
}
const upstreamSha = git('rev-parse', 'FETCH_HEAD').stdout.trim();
const show = (rev, path) => { const r = git('show', `${rev}:${path}`); return r.status === 0 ? r.stdout : null; };
// The commit your Codespace started from: a file still equal to it there is one you never changed.
const roots = git('rev-list', '--max-parents=0', 'HEAD').stdout.trim().split('\n').filter(Boolean);
// Also untouched: a file identical to any version of it the lab ever shipped (the fetch brings that history).
const shipped = (path) => new Set(git('log', '--format=%H', 'FETCH_HEAD', '--', path).stdout.trim().split('\n').filter(Boolean)
  .map((c) => git('rev-parse', '--verify', '--quiet', `${c}:${path}`).stdout.trim()).filter(Boolean));
const manifest = readJson(MANIFEST) ?? { files: {} };

const report = { added: [], updated: [], kept: [], current: 0 };
const files = git('ls-tree', '-r', '--name-only', 'FETCH_HEAD', '--', ...MANAGED).stdout.trim().split('\n').filter(Boolean);
for (const path of files) {
  const next = show('FETCH_HEAD', path);
  if (next === null) continue;
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, next);
    manifest.files[path] = sha(next);
    report.added.push(path);
    continue;
  }
  const mine = readFileSync(path, 'utf8');
  if (mine === next) { manifest.files[path] = sha(next); report.current++; continue; }
  const pristine = manifest.files[path] === sha(mine) || roots.some((r) => show(r, path) === mine) || shipped(path).has(git('hash-object', path).stdout.trim());
  if (pristine) {
    writeFileSync(path, next);
    manifest.files[path] = sha(next);
    report.updated.push(path);
  } else {
    writeFileSync(`${path}.update`, next);
    report.kept.push(path);
  }
}

// package.json: add the lab's npm scripts you don't have; replace one only if you never changed it.
const pkgNext = JSON.parse(show('FETCH_HEAD', 'package.json') ?? '{}');
const pkg = readJson('package.json');
const pkgRoot = roots.map((r) => { try { return JSON.parse(show(r, 'package.json') ?? '{}'); } catch { return {}; } });
const scriptsChanged = [];
if (pkg && pkgNext.scripts) {
  pkg.scripts ??= {};
  for (const [name, cmd] of Object.entries(pkgNext.scripts)) {
    if (pkg.scripts[name] === cmd) continue;
    const untouched = pkg.scripts[name] === undefined || pkgRoot.some((p) => p.scripts?.[name] === pkg.scripts[name]) || manifest.scripts?.[name] === pkg.scripts[name];
    if (untouched) { pkg.scripts[name] = cmd; scriptsChanged.push(name); }
  }
  manifest.scripts = { ...manifest.scripts, ...Object.fromEntries(scriptsChanged.map((n) => [n, pkg.scripts[n]])) };
  if (scriptsChanged.length) writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
}
const missingDeps = Object.keys({ ...pkgNext.dependencies, ...pkgNext.devDependencies })
  .filter((d) => !(pkg?.dependencies?.[d] || pkg?.devDependencies?.[d]));

// .qwen/settings.json: add the lab's allow and deny rules and its memory settings; never remove yours, never touch
// your MCP servers. Deny rules protect the files only a person may change (settings, agents, the human gate's file).
const setNext = JSON.parse(show('FETCH_HEAD', '.qwen/settings.json') ?? '{}');
const settings = readJson('.qwen/settings.json') ?? {};
const allowAdded = [];
settings.permissions ??= {};
for (const kind of ['allow', 'deny']) {
  settings.permissions[kind] ??= [];
  for (const rule of setNext.permissions?.[kind] ?? []) {
    if (!settings.permissions[kind].includes(rule)) { settings.permissions[kind].push(rule); allowAdded.push(`${kind}: ${rule}`); }
  }
  if (!settings.permissions[kind].length) delete settings.permissions[kind];
}
for (const [key, value] of Object.entries(setNext.memory ?? {})) {
  settings.memory ??= {};
  if (settings.memory[key] !== value) { settings.memory[key] = value; allowAdded.push(`memory.${key}: ${value}`); }
}
if (allowAdded.length) {
  mkdirSync('.qwen', { recursive: true });
  writeFileSync('.qwen/settings.json', JSON.stringify(settings, null, 2) + '\n');
}

manifest.updatedAt = new Date().toISOString();
manifest.from = `${LAB_REF}@${upstreamSha.slice(0, 7)}`;
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\nLab update from ${LAB_REF} (${upstreamSha.slice(0, 7)})\n`);
if (report.added.length) console.log(`Added (${report.added.length}):\n  ${report.added.join('\n  ')}`);
if (report.updated.length) console.log(`Updated (${report.updated.length}):\n  ${report.updated.join('\n  ')}`);
if (report.kept.length) console.log(`Kept yours; the new version is saved next to it as .update (${report.kept.length}):\n  ${report.kept.join('\n  ')}`);
console.log(`Already current: ${report.current} file(s)`);
if (scriptsChanged.length) console.log(`npm scripts added or refreshed: ${scriptsChanged.join(', ')}`);
if (allowAdded.length) console.log(`Added to .qwen/settings.json:\n  ${allowAdded.join('\n  ')}`);
if (missingDeps.length) console.log(`\nThe lab now needs packages you don't have. Run: npm install`);
console.log('\nNext: npm run connect\n');
