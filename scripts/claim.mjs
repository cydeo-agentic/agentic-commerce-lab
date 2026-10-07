#!/usr/bin/env node
// Prints the link that turns your 7-day sandbox into a permanent Stripe test account (with the dashboard).
import { readEnv } from './lib/env.mjs';

const env = readEnv();
if (!env.STRIPE_CLAIM_URL) {
  console.log('No sandbox yet. Run: npm run dev');
  process.exit(1);
}
console.log(`\nYour sandbox ${env.STRIPE_ACCOUNT_ID} expires ${env.STRIPE_SANDBOX_EXPIRES}.`);
console.log('Open this link (2 minutes, free, test mode only) to keep it and see your payments in the Stripe dashboard:\n');
console.log(`  ${env.STRIPE_CLAIM_URL}\n`);
