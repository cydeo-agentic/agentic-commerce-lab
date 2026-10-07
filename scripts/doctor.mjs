#!/usr/bin/env node
/**
 * Lab readiness check. Run: npm run doctor   (or: npm run doctor -- --brief)
 * Every check prints PASS, WARN or FAIL with the exact fix. Nothing secret is printed or saved.
 * Writes artifacts/doctor.json, the first proof artifact of the course.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readEnv } from './lib/env.mjs';
import { keyWorks, STRIPE_BIN } from './setup-stripe.mjs';

const BRIEF = process.argv.includes('--brief');
const STORE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const IN_CODESPACE = process.env.CODESPACES === 'true';
const results = [];
const record = (name, status, detail, fix) => results.push({ name, status, detail, fix: status === 'PASS' ? undefined : fix });

function run(cmd, args) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }) };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() || err.message };
  }
}

async function http(url, headers = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, body: err.message };
  }
}

// 1. Node
const nodeMajor = Number(process.versions.node.split('.')[0]);
record('Node.js 24+', nodeMajor >= 24 ? 'PASS' : 'FAIL', `v${process.versions.node}`, 'Open the lab in its Codespace (Node 24 is preinstalled).');

// 2. Project dependencies + Stripe CLI
record('Project dependencies', existsSync('node_modules/express') && existsSync('node_modules/stripe') ? 'PASS' : 'FAIL',
  existsSync('node_modules') ? 'installed' : 'missing', 'Run: npm ci');
const stripeCli = run(STRIPE_BIN, ['version']);
record('Stripe CLI', stripeCli.ok ? 'PASS' : 'FAIL', (stripeCli.out.match(/\d+\.\d+\.\d+/) ?? ['not found'])[0], 'Run: npm ci   (the Stripe CLI ships with the lab)');

// 3. Chromium (tests and the agent's browser)
let chromiumPath = '';
try {
  chromiumPath = (await import('@playwright/test')).chromium.executablePath();
} catch { /* reported below */ }
record('Chromium installed', chromiumPath && existsSync(chromiumPath) ? 'PASS' : 'FAIL', chromiumPath ? 'ready' : 'not found',
  'Run: npx playwright install --with-deps chromium');
const headless = process.env.PLAYWRIGHT_MCP_HEADLESS === 'true';
record("Agent's browser settings", headless || !IN_CODESPACE ? 'PASS' : 'FAIL',
  headless ? 'headless Chromium' : 'local machine (headed browser)', 'Rebuild the Codespace (Command Palette → Codespaces: Rebuild Container).');

// 4. CYDEO CLI + AI Lab login (lists models; costs nothing)
const globals = run('npm', ['ls', '-g', '--depth=0', '--json']);
let deps = {};
try { deps = JSON.parse(globals.out).dependencies ?? {}; } catch { /* reported below */ }
record('CYDEO CLI (@cydeo/cli)', deps['@cydeo/cli'] ? 'PASS' : 'FAIL', deps['@cydeo/cli']?.version ?? 'not installed', 'Run: npm install -g @cydeo/cli');
let cfg = {};
try { cfg = JSON.parse(readFileSync(join(homedir(), '.cydeo', 'config.json'), 'utf8')); } catch { /* not logged in */ }
if (!cfg.token) {
  record('AI Lab login', 'FAIL', 'not logged in', 'Run: cydeo login   (approve the device in your browser, wait for "Logged in.")');
} else {
  const models = await http(`${cfg.proxyBaseUrl ?? 'https://ai.cydeo.com/api/v1'}/models`, { Authorization: `Bearer ${cfg.token}` });
  let count = 0;
  try { count = JSON.parse(models.body).data?.length ?? 0; } catch { /* non-JSON */ }
  record('AI Lab login', models.status === 200 ? 'PASS' : 'FAIL', models.status === 200 ? `token valid, ${count} models` : `HTTP ${models.status}`,
    models.status === 401 || models.status === 403 ? 'Run: cydeo login. Still failing? Post in the support thread.' : 'AI Lab unreachable. Post in the support thread.');
}

// 5. Your Stripe sandbox
const env = { ...readEnv(), ...process.env };
const key = env.STRIPE_SECRET_KEY ?? '';
const offline = env.STORE_PAYMENTS === 'offline';
if (/_live_/.test(key)) {
  record('Stripe sandbox key', 'FAIL', 'LIVE key found', 'Remove STRIPE_SECRET_KEY from .env. This lab only uses sandbox (test) keys.');
} else if (offline) {
  record('Stripe sandbox key', 'WARN', 'offline simulator mode', 'Only if your instructor said so. Otherwise remove STORE_PAYMENTS=offline from .env.');
} else {
  const alive = await keyWorks(key);
  record('Stripe sandbox key', alive ? 'PASS' : 'FAIL', alive ? `${env.STRIPE_ACCOUNT_ID ?? 'sandbox'}, expires ${env.STRIPE_SANDBOX_EXPIRES || 'never (claimed)'}` : key ? 'expired or invalid' : 'not set up',
    'Run: npm run dev   (it creates your sandbox; follow any one-click instruction it prints)');
  record('Webhook signing secret', /^whsec_/.test(env.STRIPE_WEBHOOK_SECRET ?? '') ? 'PASS' : 'FAIL', env.STRIPE_WEBHOOK_SECRET ? 'set' : 'not set', 'Run: npm run dev');
}

// 6. The store is running and a real browser can use it
const health = await http(`${STORE}/api/health`);
let mode = '';
try { mode = JSON.parse(health.body).mode; } catch { /* not running */ }
record('Zinc Store running', health.status === 200 ? 'PASS' : 'FAIL', health.status === 200 ? `${STORE} (payments: ${mode})` : 'not running',
  'Run: npm run dev   in its own terminal and leave it running.');
if (health.status === 200 && chromiumPath) {
  try {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(STORE, { timeout: 30_000 });
    await page.locator('[data-testid="catalog-hub-add-button"]').waitFor({ timeout: 15_000 });
    await browser.close();
    record('Browser can test the store', 'PASS', 'Chromium found catalog-hub-add-button');
  } catch (err) {
    record('Browser can test the store', 'FAIL', String(err.message).split('\n')[0], 'Run: npx playwright install --with-deps chromium   then npm run doctor');
  }
}

// 7. Git identity (commits, pull requests, and the email your sandbox uses)
const gitName = run('git', ['config', 'user.name']).out.trim();
record('Git identity', gitName ? 'PASS' : 'WARN', gitName || 'not set', 'Run: git config --global user.name "Your Name" && git config --global user.email "you@example.com"');

const fails = results.filter((r) => r.status === 'FAIL').length;
const warns = results.filter((r) => r.status === 'WARN').length;
const verdict = fails ? 'FAIL' : 'PASS';
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/doctor.json', JSON.stringify({
  verdict, fails, warns, checkedAt: new Date().toISOString(), where: IN_CODESPACE ? `codespace ${process.env.CODESPACE_NAME ?? ''}`.trim() : 'local machine',
  githubUser: process.env.GITHUB_USER ?? null, results: results.map(({ name, status, detail }) => ({ name, status, detail })),
}, null, 2) + '\n');

if (BRIEF) {
  console.log(`\nLab doctor: ${verdict}: ${results.length - fails - warns} pass, ${warns} warn, ${fails} fail. ${fails ? 'Run: npm run doctor' : 'Ready.'}\n`);
} else {
  console.log('\nCYDEO Agentic QA · Zinc Store lab · doctor\n');
  for (const r of results) {
    console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(28)} ${r.detail}`);
    if (r.fix) console.log(`      → ${r.fix}`);
  }
  console.log(`\nVerdict: ${verdict} (${fails} fail, ${warns} warn). Saved artifacts/doctor.json\n`);
}
process.exit(fails ? 1 : 0);
