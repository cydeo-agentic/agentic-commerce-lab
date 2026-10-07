#!/usr/bin/env node
/**
 * Fell behind? Get the reference solution for one lab step and keep going.
 * Run: npm run catchup -- L06      (the prove-a-defect skill)
 *      npm run catchup -- L07      (the get_rules tool and the upgraded skill)
 * References live on the repository's `catchup` branch, not in your working tree, so your agent never reads them
 * while you build your own. Nothing you wrote is overwritten: if a file exists, the reference goes next to it.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const STEPS = {
  L06: [{ ref: 'L06/prove-a-defect/SKILL.md', to: '.agents/skills/prove-a-defect/SKILL.md', allow: 'Skill(prove-a-defect)' }],
  L07: [
    { ref: 'L07/server.ts', to: 'mcp/ledger/server.ts', wire: true },
    { ref: 'L07/prove-a-defect/SKILL.md', to: '.agents/skills/prove-a-defect/SKILL.md', allow: 'Skill(prove-a-defect)' },
  ],
};

const lab = (process.argv[2] ?? '').toUpperCase();
if (!STEPS[lab]) {
  console.log(`Usage: npm run catchup -- <${Object.keys(STEPS).join('|')}>`);
  process.exit(2);
}
const git = (...args) => spawnSync('git', args, { encoding: 'utf8' });
const fetched = git('fetch', '--quiet', 'origin', 'catchup');
if (fetched.status !== 0) {
  console.log('Could not fetch the catch-up branch. Post this in the support thread:\n' + (fetched.stderr || '').trim());
  process.exit(1);
}
for (const step of STEPS[lab]) {
  const shown = git('show', `FETCH_HEAD:${step.ref}`);
  if (shown.status !== 0) { console.log(`Missing on the catch-up branch: ${step.ref}`); process.exit(1); }
  const target = existsSync(step.to) ? `${step.to}.catchup` : step.to;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, shown.stdout);
  console.log(`${target === step.to ? 'Wrote' : 'Yours is kept. Reference saved next to it:'} ${target}`);
  if (step.allow) {
    const path = '.qwen/settings.json';
    const settings = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    settings.permissions ??= {};
    settings.permissions.allow ??= [];
    if (!settings.permissions.allow.includes(step.allow)) {
      settings.permissions.allow.push(step.allow);
      writeFileSync(path, JSON.stringify(settings, null, 2) + '\n');
      console.log(`Allowed in ${path}: ${step.allow}`);
    }
  }
  if (step.wire) {
    const path = '.qwen/settings.json';
    const settings = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    if (!settings.mcpServers?.ledger) {
      settings.mcpServers = { ...settings.mcpServers, ledger: { command: 'npx', args: ['tsx', 'mcp/ledger/server.ts'] } };
      writeFileSync(path, JSON.stringify(settings, null, 2) + '\n');
      console.log(`Wired the ledger server in ${path}. Now run: cydeo mcp list   and   cydeo mcp approve ledger`);
    }
  }
  if (target === step.to && step.to.endsWith('SKILL.md')) {
    mkdirSync('.catchup', { recursive: true });
    writeFileSync(`.catchup/${lab}.sha256`, createHash('sha256').update(shown.stdout).digest('hex') + '\n');
  }
}
console.log('\nYou are caught up. Read what you got before you use it: it is now an instruction to your agent.');
