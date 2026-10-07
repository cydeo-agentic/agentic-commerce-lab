#!/usr/bin/env node
// Starts the ledger fresh. Nothing is deleted: the old database moves to store/data/archive/.
import { existsSync, mkdirSync, renameSync } from 'node:fs';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync('store/data/archive', { recursive: true });
let moved = 0;
for (const f of ['store.db', 'store.db-wal', 'store.db-shm']) {
  if (existsSync(`store/data/${f}`)) { renameSync(`store/data/${f}`, `store/data/archive/${stamp}-${f}`); moved++; }
}
console.log(moved ? `Ledger archived to store/data/archive/${stamp}-store.db. Restart npm run dev for a fresh store.` : 'No ledger yet; nothing to reset.');
