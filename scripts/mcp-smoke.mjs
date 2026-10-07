#!/usr/bin/env node
/**
 * Lab L05/L07 check: start your MCP server the way an agent would (stdio), list its tools, call them.
 * L05 builds find_orders. L07 adds get_rules (the store's live rules, the system of record).
 * Run: node scripts/mcp-smoke.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const STORE = process.env.STORE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const db = new DatabaseSync(process.env.STORE_DB ?? 'store/data/store.db', { readOnly: true });
const customer = db.prepare('SELECT * FROM crm_customers ORDER BY created_at DESC LIMIT 1').get();
const orders = customer ? db.prepare('SELECT id FROM crm_orders WHERE customer_id = ?').all(customer.id).map((o) => o.id) : [];
const logLines = () => (existsSync('artifacts/L05/calls.log') ? readFileSync('artifacts/L05/calls.log', 'utf8').split('\n').filter(Boolean).length : 0);

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'mcp/ledger/server.ts'], stderr: 'ignore' });
const client = new Client({ name: 'lab-l05-check', version: '1.0.0' });
let failed = 0;
const say = (ok, msg) => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };
const textOf = (res) => (res.content ?? []).map((c) => c.text ?? '').join('\n');

try {
  if (!customer) throw new Error('the ledger has no customers yet: buy something in the store first');
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  const extra = names.filter((n) => !['find_orders', 'get_rules'].includes(n));
  say(names.includes('find_orders') && extra.length === 0, `server lists find_orders${names.includes('get_rules') ? ' and get_rules' : ''} and nothing else (${names.join(', ')})`);
  const before = logLines();
  const res = textOf(await client.callTool({ name: 'find_orders', arguments: { email: customer.email } }));
  say(orders.every((id) => res.includes(id)), `find_orders(${customer.email}) returns all ${orders.length} of their orders`);
  say(res.includes(customer.status), `it returns the customer status (${customer.status})`);
  say(logLines() > before, 'the server appended a line to artifacts/L05/calls.log');
  const none = textOf(await client.callTool({ name: 'find_orders', arguments: { email: 'e2e-nobody-here@example.com' } }));
  say(!/ord_[a-f0-9]{12}/.test(none), 'an unknown email returns no orders (nothing invented)');
  if (names.includes('get_rules')) {
    const live = await fetch(`${STORE}/api/rules`).then((r) => r.json());
    const before2 = logLines();
    const rules = textOf(await client.callTool({ name: 'get_rules', arguments: {} }));
    say(rules.includes(String(live.freeShippingThresholdCents)) && rules.includes(String(live.couponPercent)),
      `get_rules returns the live store's rules (free shipping at ${live.freeShippingThresholdCents} cents, coupon ${live.couponPercent}%)`);
    say(logLines() > before2, 'get_rules appended a line to artifacts/L05/calls.log');
  }
} catch (err) {
  say(false, `could not start or call the server: ${err.message}`);
} finally {
  await client.close().catch(() => {});
}
process.exit(failed ? 1 : 0);
