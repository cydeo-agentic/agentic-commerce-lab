#!/usr/bin/env node
// Lab L04: ask the running store for its business rules — the live source of truth — and save the answer.
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const res = await fetch(`${base}/api/rules`).catch((err) => ({ status: 0, json: async () => ({ error: err.message }) }));
const rules = await res.json();
const truth = { source: `${base}/api/rules`, http: res.status, fetchedAt: new Date().toISOString(), ...rules };
mkdirSync('artifacts/L04', { recursive: true });
writeFileSync('artifacts/L04/truth.json', JSON.stringify(truth, null, 2) + '\n');
console.log(JSON.stringify(truth, null, 2));
console.log(res.status === 200 ? '\nSaved artifacts/L04/truth.json' : '\nThe store did not answer. Is npm run dev running?');
process.exit(res.status === 200 ? 0 : 1);
