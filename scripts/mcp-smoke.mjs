#!/usr/bin/env node
/**
 * Lab L05 check: start your MCP server the way an agent would (stdio), list its tools, call find_orders.
 * Run: node scripts/mcp-smoke.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const db = new DatabaseSync('store/data/store.db', { readOnly: true });
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
  say(tools.length === 1 && tools[0].name === 'find_orders', `server lists exactly one tool, find_orders (${tools.map((t) => t.name).join(', ')})`);
  const before = logLines();
  const res = textOf(await client.callTool({ name: 'find_orders', arguments: { email: customer.email } }));
  say(orders.every((id) => res.includes(id)), `find_orders(${customer.email}) returns all ${orders.length} of their orders`);
  say(res.includes(customer.status), `it returns the customer status (${customer.status})`);
  say(logLines() > before, 'the server appended a line to artifacts/L05/calls.log');
  const none = textOf(await client.callTool({ name: 'find_orders', arguments: { email: 'e2e-nobody-here@example.com' } }));
  say(!/ord_[a-f0-9]{12}/.test(none), 'an unknown email returns no orders (nothing invented)');
} catch (err) {
  say(false, `could not start or call the server: ${err.message}`);
} finally {
  await client.close().catch(() => {});
}
process.exit(failed ? 1 : 0);
