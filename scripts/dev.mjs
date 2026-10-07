#!/usr/bin/env node
/**
 * One command: npm run dev
 * 1. your Stripe sandbox (created on the first run, no signup)
 * 2. the webhook listener (Stripe → your laptop-free Codespace → /api/webhooks/stripe)
 * 3. the Zinc Store on port 3000
 * If Stripe cannot be reached, the store starts with the offline simulator so class never stops.
 * Ctrl+C stops everything.
 */
import { spawn, spawnSync } from 'node:child_process';
import { ensureSandbox, STRIPE_BIN } from './setup-stripe.mjs';
import { readEnv, upsertEnv } from './lib/env.mjs';

const PORT = process.env.PORT ?? '3000';
const children = [];
const quiet = process.argv.includes('--quiet');

function run(name, cmd, args, env = {}) {
  const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `[${name}]`;
  const pipe = (stream, out) => stream.on('data', (d) => {
    for (const line of String(d).split('\n')) if (line.trim()) out.write(`${prefix} ${line}\n`);
  });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix} stopped (exit ${code}).`);
    if (name === 'store') shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const storeUrl = process.env.CODESPACE_NAME
  ? `https://${process.env.CODESPACE_NAME}-${PORT}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? 'app.github.dev'}`
  : `http://localhost:${PORT}`;
const nodeArgs = ['--disable-warning=ExperimentalWarning', '--env-file-if-exists=.env', 'store/server.mjs'];

let mode = process.env.STORE_PAYMENTS === 'offline' ? 'offline' : 'stripe';
if (mode === 'stripe') {
  try {
    const { env } = await ensureSandbox({ quiet });
    // The signing secret stays the same for this sandbox, so ask for it once and keep it in .env.
    if (!env.STRIPE_WEBHOOK_SECRET) {
      const r = spawnSync(STRIPE_BIN, ['listen', '--print-secret', '--api-key', env.STRIPE_SECRET_KEY], { encoding: 'utf8', timeout: 60_000 });
      const secret = (r.stdout ?? '').match(/whsec_[A-Za-z0-9]+/)?.[0];
      if (!secret) throw new Error(`could not get the webhook signing secret: ${(r.stderr ?? '').trim().split('\n').pop()}`);
      upsertEnv({ STRIPE_WEBHOOK_SECRET: secret });
    }
    const key = readEnv().STRIPE_SECRET_KEY;
    run('stripe', STRIPE_BIN, ['listen', '--api-key', key, '--forward-to', `localhost:${PORT}/api/webhooks/stripe`,
      '--events', 'payment_intent.succeeded,payment_intent.payment_failed,charge.refunded']);
  } catch (err) {
    console.log(`\n[dev] Stripe is not reachable right now: ${err.message}`);
    console.log('[dev] Starting with the OFFLINE SIMULATOR instead (same statuses, same signed webhooks). Tell your instructor.\n');
    mode = 'offline';
  }
}

run('store', process.execPath, nodeArgs, { PORT, ...(mode === 'offline' ? { STORE_PAYMENTS: 'offline' } : {}) });

const env = readEnv();
console.log(`
  Zinc Store     ${storeUrl}
  Back office    ${storeUrl}/crm
  Payments       ${mode === 'offline' ? 'offline simulator' : `your Stripe sandbox ${env.STRIPE_ACCOUNT_ID ?? ''}`}${mode === 'stripe' && env.STRIPE_SANDBOX_EXPIRES ? `
  Sandbox        expires ${env.STRIPE_SANDBOX_EXPIRES}. Keep it (and get the Stripe dashboard): npm run claim` : ''}

  Leave this terminal running. Open a second terminal for the agent (cydeo --qa).
`);
