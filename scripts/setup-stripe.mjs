#!/usr/bin/env node
/**
 * Connects the lab to YOUR Stripe sandbox and saves its test keys to .env. npm run dev runs this for you.
 *   1. a working key already in .env or in the Stripe CLI profile → use it
 *   2. stripe sandbox create → a 7-day sandbox, no account, no browser
 *   3. if Stripe asks for a human → one browser click: create (or sign in to) a free Stripe account
 * Run: npm run setup:stripe   (--force makes a new sandbox even if a working key exists)
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readEnv, upsertEnv, mask } from './lib/env.mjs';

// The Stripe CLI is a dev dependency of this repo, so its version is pinned with the lab.
export const STRIPE_BIN = process.env.STRIPE_BIN ?? (existsSync('node_modules/.bin/stripe') ? 'node_modules/.bin/stripe' : 'stripe');
const TEST_KEY = /^(sk|rk|rkcs)_test_[A-Za-z0-9]+$/;

function sandboxEmail() {
  if (process.env.STRIPE_SANDBOX_EMAIL) return process.env.STRIPE_SANDBOX_EMAIL;
  try {
    const git = execFileSync('git', ['config', 'user.email'], { encoding: 'utf8' }).trim();
    if (git) return git;
  } catch { /* no git identity */ }
  if (process.env.GITHUB_USER) return `${process.env.GITHUB_USER}@users.noreply.github.com`;
  return `student-${Date.now()}@example.com`;
}

// Is this key alive? (An unclaimed sandbox expires after 7 days.)
export async function keyWorks(key) {
  if (!key || !TEST_KEY.test(key)) return false;
  try {
    const res = await fetch('https://api.stripe.com/v1/payment_intents?limit=1', {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

// The test key the Stripe CLI saved for its default profile (after sandbox create or stripe login).
function cliProfile() {
  const path = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'stripe', 'config.toml');
  if (!existsSync(path)) return {};
  const section = readFileSync(path, 'utf8').split(/^\[default\]\s*$/m)[1]?.split(/^\[/m)[0] ?? '';
  const get = (k) => section.match(new RegExp(`^${k}\\s*=\\s*['"]([^'"]*)['"]`, 'm'))?.[1];
  return { key: get('test_mode_api_key'), publishable: get('test_mode_pub_key'), account: get('account_id'),
    claimUrl: get('sandbox_claim_url'), expires: get('sandbox_expires_at') };
}

function saveKeys({ key, publishable, account, claimUrl, expires }) {
  if (!TEST_KEY.test(key ?? '')) throw new Error('Stripe gave a key that is not a sandbox test key; refusing to use it.');
  upsertEnv({ STRIPE_SECRET_KEY: key, STRIPE_PUBLISHABLE_KEY: publishable ?? '', STRIPE_ACCOUNT_ID: account ?? '',
    STRIPE_CLAIM_URL: claimUrl ?? '', STRIPE_SANDBOX_EXPIRES: expires ?? '', STRIPE_WEBHOOK_SECRET: '' });
}

function waitForBrowserApproval(nextStep) {
  const args = (nextStep ?? 'stripe login --complete-device').split(/\s+/).slice(1);
  return new Promise((resolve) => {
    const child = spawn(STRIPE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill('SIGTERM'); resolve(false); }, 10 * 60_000);
    child.on('exit', (code) => { clearTimeout(timer); resolve(code === 0); });
  });
}

export async function ensureSandbox({ force = false, quiet = false } = {}) {
  const env = readEnv();
  if (/_live_/.test(env.STRIPE_SECRET_KEY ?? '')) {
    throw new Error('.env holds a LIVE Stripe key. Remove that line yourself; this lab only uses sandbox (test) keys.');
  }
  if (!force && await keyWorks(env.STRIPE_SECRET_KEY)) {
    if (!quiet) console.log(`[stripe] Using your sandbox ${env.STRIPE_ACCOUNT_ID ?? ''} (key ${mask(env.STRIPE_SECRET_KEY)}).`);
    return { created: false, env };
  }
  const profile = cliProfile();
  if (!force && await keyWorks(profile.key)) {
    saveKeys(profile);
    console.log(`[stripe] Using the Stripe account the CLI is signed in to (${profile.account ?? 'sandbox'}).`);
    return { created: false, env: readEnv() };
  }

  const email = sandboxEmail();
  console.log(`[stripe] Creating your Stripe sandbox (no account needed) for ${email} …`);
  const r = spawnSync(STRIPE_BIN, ['sandbox', 'create', '--email', email, '--non-interactive'], { encoding: 'utf8', timeout: 120_000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const created = out.match(/\{[^{}]*"secret_key"[^{}]*\}/);
  if (created) {
    const s = JSON.parse(created[0]);
    saveKeys({ key: s.secret_key, publishable: s.publishable_key, account: s.account_id, claimUrl: s.claim_url, expires: s.expires_at });
    console.log(`[stripe] Sandbox ${s.account_id} ready (key ${mask(s.secret_key)}). Expires ${s.expires_at} unless you claim it.`);
    return { created: true, env: readEnv() };
  }

  // Stripe sometimes wants a human for the sandbox (for example when many are created from one network).
  const device = out.match(/\{[^{}]*"browser_url"[^{}]*\}/);
  if (device) {
    const d = JSON.parse(device[0]);
    console.log(`
[stripe] ONE CLICK NEEDED. Stripe wants you to create (or sign in to) a free Stripe account:
[stripe]   1. Open:  ${d.browser_url}
[stripe]   2. Check the code says ${d.verification_code}, then approve.
[stripe] Waiting up to 10 minutes …`);
    if (await waitForBrowserApproval(d.next_step)) {
      const p = cliProfile();
      if (await keyWorks(p.key)) {
        saveKeys(p);
        console.log(`[stripe] Connected to your Stripe account ${p.account ?? ''} (sandbox keys only).`);
        return { created: true, env: readEnv() };
      }
    }
    throw new Error('the browser approval did not finish. Run npm run dev again, or ask your instructor for offline mode.');
  }
  throw new Error(`stripe sandbox create failed: ${out.split('\n').filter(Boolean).slice(-2).join(' | ') || r.error?.message}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSandbox({ force: process.argv.includes('--force') })
    .then(() => process.exit(0))
    .catch((err) => { console.error(`[stripe] ${err.message}`); process.exit(1); });
}
