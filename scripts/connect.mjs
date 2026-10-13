#!/usr/bin/env node
/**
 * Before class: is everything connected? Run: npm run connect
 * Checks every login, key and agent connection the pipeline labs use, and prints PASS, WARN or FAIL with the fix.
 * It prints names and status codes only. No key, token or password is ever printed or saved.
 * Writes artifacts/connect.json. Post its last line in the support thread if anything fails.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentDefinitions, projectSlug, projectsDir, qwenDir } from './lib/agent-trace.mjs';
import { readEnv } from './lib/env.mjs';
import { cydeoConfig, zinctmSession } from './lib/zinctm.mjs';

const STORE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const results = [];
const record = (name, status, detail, fix) => results.push({ name, status, detail, fix: status === 'PASS' ? undefined : fix });
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }); } catch { return ''; } };

// 1. Node and the lab files this week's labs need
const nodeMajor = Number(process.versions.node.split('.')[0]);
record('Node.js 24+', nodeMajor >= 24 ? 'PASS' : 'FAIL', `v${process.versions.node}`, 'Open the lab in its Codespace (Node 24 is preinstalled).');
const agents = agentDefinitions();
record('Pipeline agents in .qwen/agents', agents.length >= 5 ? 'PASS' : 'FAIL', agents.length ? agents.map((a) => a.name).join(', ') : 'none',
  'Run: npm run update   (first time: paste the one-line update command from the support thread)');

// 2. CYDEO CLI and the AI Lab login
const cliVersion = (run('npm', ['ls', '-g', '@cydeo/cli', '--depth=0', '--json']).match(/"version":\s*"([^"]+)"/) ?? [])[1];
const atLeast = (v, min) => { const a = v.split('.').map(Number); const b = min.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i]; } return true; };
record('CYDEO CLI 0.1.6+', cliVersion && atLeast(cliVersion, '0.1.6') ? 'PASS' : 'FAIL', cliVersion ?? 'not installed', 'Run: npm install -g @cydeo/cli@latest');
const cfg = cydeoConfig();
if (!cfg.token) {
  record('AI Lab login', 'FAIL', 'not logged in', 'Run: cydeo login   (approve the device in your browser, wait for "Logged in.")');
} else {
  let status = 0;
  let count = 0;
  try {
    const res = await fetch(`${cfg.proxyBaseUrl ?? 'https://ai.cydeo.com/api/v1'}/models`, { headers: { Authorization: `Bearer ${cfg.token}` }, signal: AbortSignal.timeout(15_000) });
    status = res.status;
    count = (await res.json()).data?.length ?? 0;
  } catch { /* reported below */ }
  record('AI Lab login', status === 200 ? 'PASS' : 'FAIL', status === 200 ? `token valid, ${count} models` : `HTTP ${status}`,
    status === 401 || status === 403 ? 'Run: cydeo login. Still failing? Post in the support thread.' : 'AI Lab unreachable. Post in the support thread.');
}

// 3. ZincTM, signed in with that same login (what the agent's ZincTM tools will use)
if (cfg.token) {
  const z = await zinctmSession();
  if (!z.ok) {
    const notEligible = /NOT_ELIGIBLE/.test(String(z.why));
    record('ZincTM with your login', 'FAIL', `${z.step}: ${z.why}`,
      notEligible ? 'Your account is not enabled for ZincTM. Post your name in the support thread.' : 'Run: cydeo login   then npm run connect. Still failing? Post this line in the support thread.');
  } else {
    const me = await z.get('/api/me');
    const cases = await z.get('/api/test-cases');
    record('ZincTM with your login', me.status === 200 && cases.status === 200 ? 'PASS' : 'FAIL',
      me.status === 200 ? `signed in (${me.data?.member?.role ?? 'member'}), test cases readable` : `HTTP ${me.status}`, 'Post this line in the support thread.');
  }
}

// 4. The store (needed when agents run tests; not needed to design them)
let health = 0;
let mode = '';
try {
  const res = await fetch(`${STORE}/api/health`, { signal: AbortSignal.timeout(5_000) });
  health = res.status;
  mode = (await res.json()).mode ?? '';
} catch { /* not running */ }
record('Zinc Store running', health === 200 ? 'PASS' : 'WARN', health === 200 ? `${STORE} (payments: ${mode})` : 'not running', 'Run: npm run dev   in its own terminal and leave it running.');
const env = { ...readEnv(), ...process.env };
const key = env.STRIPE_SECRET_KEY ?? '';
record('Stripe key in .env', /_live_/.test(key) ? 'FAIL' : key || env.STORE_PAYMENTS === 'offline' ? 'PASS' : 'WARN',
  /_live_/.test(key) ? 'LIVE key found' : key ? 'STRIPE_SECRET_KEY is set' : env.STORE_PAYMENTS === 'offline' ? 'offline payment simulator' : 'not set',
  /_live_/.test(key) ? 'Remove it from .env. This lab only uses sandbox (test) keys.' : 'Run: npm run dev   (it creates your sandbox). Keys go in .env, never .env.example.');

// 5. The agent may delegate to each pipeline agent, and project MCP servers are approved
const settings = readJson('.qwen/settings.json') ?? {};
const allow = settings.permissions?.allow ?? [];
const notAllowed = agents.map((a) => a.name).filter((n) => !allow.includes(`Agent(${n})`));
record('Agents allowed in .qwen/settings.json', agents.length && !notAllowed.length ? 'PASS' : 'FAIL',
  notAllowed.length ? `not allowed: ${notAllowed.join(', ')}` : `${agents.length} allowed`, 'Run: npm run update   (it adds the Agent(...) rules)');
const servers = Object.keys(settings.mcpServers ?? {});
if (servers.length) {
  const approvals = readJson(join(qwenDir(), 'mcpApprovals.json'))?.[process.cwd()] ?? {};
  const pending = servers.filter((s) => approvals[s]?.status !== 'approved');
  record('Your project MCP servers approved', pending.length ? 'WARN' : 'PASS', pending.length ? `pending: ${pending.join(', ')}` : servers.join(', '),
    `Run: cydeo mcp approve ${pending[0] ?? '<name>'}   (only servers you wrote or reviewed)`);
}

// 6. The runtime's recordings (what npm run trace and check:lab read)
const recorded = existsSync(join(projectsDir(), projectSlug(process.cwd()), 'chats'));
record('Agent recordings for this repo', recorded ? 'PASS' : 'WARN', recorded ? 'found' : 'none yet', 'Run cydeo --qa here once and ask it anything. Then npm run connect.');
record('Usage record (models and tokens)', existsSync(join(qwenDir(), 'usage_record.jsonl')) ? 'PASS' : 'WARN', existsSync(join(qwenDir(), 'usage_record.jsonl')) ? 'found' : 'none yet',
  'It appears after your first finished cydeo session.');

// 7. Your own GitHub repo (needed for the CI lab on Oct 22)
const remote = run('git', ['remote']).trim();
record('Repo published to your GitHub', remote ? 'PASS' : 'WARN', remote ? `remote: ${remote.split('\n')[0]}` : 'not published yet',
  'Before Oct 22: Source Control panel → Publish Branch → public repository. Your .env stays private.');

const fails = results.filter((r) => r.status === 'FAIL').length;
const warns = results.filter((r) => r.status === 'WARN').length;
const verdict = fails ? 'FAIL' : 'PASS';
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/connect.json', JSON.stringify({
  verdict, fails, warns, checkedAt: new Date().toISOString(), where: process.env.CODESPACES === 'true' ? `codespace ${process.env.CODESPACE_NAME ?? ''}`.trim() : 'local machine',
  results: results.map(({ name, status, detail }) => ({ name, status, detail })),
}, null, 2) + '\n');

console.log('\nCYDEO Agentic QA · pipeline labs · connect\n');
for (const r of results) {
  console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(38)} ${r.detail}`);
  if (r.fix) console.log(`      → ${r.fix}`);
}
console.log(`\nconnect: ${verdict} (${results.length - fails - warns} pass, ${warns} warn, ${fails} fail) ${new Date().toISOString().slice(0, 16)}Z\n`);
process.exit(fails ? 1 : 0);
