#!/usr/bin/env node
/**
 * One-time setup for the ZincBank suite. Run: npm run zb:setup
 * Tests make their own customers; tests that move money first receive a few dollars by P2P from YOUR
 * ZincBank login (the one you got by email: zinc.<name>.<code>@zinc.test). This saves that login in
 * zincbank/.env (never committed, never printed) after checking it signs in on the ZincBank lab.
 */
import { createInterface } from 'node:readline';
import { writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.ZB_BASE_URL ?? 'https://zincbank-lab.vercel.app';
const ENV = join(import.meta.dirname, '..', 'zincbank', '.env');

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '');
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const email = await ask('Your ZincBank login email (zinc.<name>.<code>@zinc.test): ');
const password = await ask('Your ZincBank password (hidden): ', true);

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  console.log(`That login did not sign in on ${BASE} (HTTP ${login.status}). Check the email you received and run npm run zb:setup again.`);
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const accounts = (await (await fetch(`${BASE}/api/accounts`, { headers: { cookie } })).json()).data?.accounts ?? [];
const best = accounts.filter((a) => a.type !== 'credit_card').sort((a, b) => b.balanceCents - a.balanceCents)[0];
if (!best || best.balanceCents < 50_000) {
  console.log('Signed in, but no deposit account has $500.00 or more. Ask your instructor for a funded login.');
  process.exit(1);
}
writeFileSync(ENV, `ZB_FUNDER_EMAIL=${email}\nZB_FUNDER_PASSWORD=${password}\n`, { mode: 0o600 });
chmodSync(ENV, 0o600);
console.log(`Saved. Tests that need money will take a few dollars from your ${best.type} (balance ${best.balance}).`);
console.log('Next: npm run zb:auto   (or one area: npm run zb:auto -- --areas login)');
