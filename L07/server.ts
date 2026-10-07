import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DB_PATH = process.env.STORE_DB ?? resolve(ROOT, 'store', 'data', 'store.db');
const CALLS_LOG = resolve(ROOT, 'artifacts', 'L05', 'calls.log');

interface CustomerRow {
  id: string;
  status: string;
  total_spent_cents: number;
}

interface OrderRow {
  id: string;
  status: string;
  amount_cents: number;
  stripe_payment_intent_id: string | null;
}

const STORE_URL = process.env.STORE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

function appendCall(email: string, orders: number): void {
  mkdirSync(dirname(CALLS_LOG), { recursive: true });
  appendFileSync(CALLS_LOG, `${new Date().toISOString()} find_orders ${email} ${orders}\n`);
}

function appendRulesCall(freeShippingThresholdCents: unknown): void {
  mkdirSync(dirname(CALLS_LOG), { recursive: true });
  appendFileSync(CALLS_LOG, `${new Date().toISOString()} get_rules - ${freeShippingThresholdCents}\n`);
}

const server = new McpServer({ name: 'zinc-ledger', version: '1.0.0' });

server.registerTool(
  'find_orders',
  {
    title: 'Find a customer and their orders',
    description:
      'Look up a customer by email in the CRM ledger. Returns their status, total spent in cents, and their orders (id, status, amount in cents, Stripe PaymentIntent id). Read-only.',
    inputSchema: { email: z.string().describe('The customer email address') },
    // A hint the agent trusts to skip asking you. It is honest here only because the database is opened read-only below.
    annotations: { readOnlyHint: true },
  },
  async ({ email }) => {
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    let text: string;
    try {
      const customer = db
        .prepare('SELECT id, status, total_spent_cents FROM crm_customers WHERE email = ?')
        .get(email) as CustomerRow | undefined;
      const orders = customer
        ? (db
            .prepare(
              'SELECT id, status, amount_cents, stripe_payment_intent_id FROM crm_orders WHERE customer_id = ? ORDER BY created_at DESC',
            )
            .all(customer.id) as unknown as OrderRow[])
        : [];
      text = customer
        ? [
            `Customer: ${email}`,
            `Status: ${customer.status}`,
            `Total spent (cents): ${customer.total_spent_cents}`,
            '',
            `Orders (${orders.length}):`,
            ...orders.map((o) => `- ${o.id} | ${o.status} | ${o.amount_cents} cents | ${o.stripe_payment_intent_id ?? 'null'}`),
          ].join('\n')
        : `No customer found for ${email}. Orders: 0.`;
      appendCall(email, orders.length);
    } finally {
      db.close();
    }
    return { content: [{ type: 'text', text }] };
  },
);

server.registerTool(
  'get_rules',
  {
    title: "The store's live business rules",
    description:
      "Ask the running Zinc Store for its live business rules (coupon code and percent, free-shipping threshold, shipping fee, tax rate), all money in integer cents. This is the system of record: use it before trusting a number from a chat message, a document or a skill. Read-only.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const res = await fetch(`${STORE_URL}/api/rules`);
    if (!res.ok) return { content: [{ type: 'text', text: `The store did not answer (HTTP ${res.status}). Is npm run dev running?` }], isError: true };
    const rules = (await res.json()) as Record<string, unknown>;
    appendRulesCall(rules.freeShippingThresholdCents);
    return { content: [{ type: 'text', text: JSON.stringify({ source: `${STORE_URL}/api/rules`, ...rules }, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
