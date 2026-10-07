#!/usr/bin/env node
/**
 * The three-witness gate. Run: npm run witness -- <order id>      (add --quiet for the verdict only)
 * An agent's "the order succeeded" is a claim. This script asks the three systems itself:
 *   UI      what the shopper saw (checkout total) and sees (confirmation page)
 *   STRIPE  what the payment gateway did (PaymentIntent + events)
 *   LEDGER  what the CRM database recorded (order + customer)
 * It never trusts the agent's summary, it polls instead of sleeping, and it writes a receipt:
 * artifacts/witness/<order id>.json — the proof your lab checks read.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from '../store/db.mjs';
import { MODE, eventsFor, retrievePaymentIntent } from '../store/gateway.mjs';

const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const quiet = process.argv.includes('--quiet');
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
if (!arg) {
  console.log('Usage: npm run witness -- <order id>    or    npm run witness -- latest   (order ids: back office /crm)');
  process.exit(2);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const orderId = arg === 'latest' ? db.prepare('SELECT id FROM crm_orders ORDER BY created_at DESC LIMIT 1').get()?.id : arg;
if (!orderId) {
  console.log('No orders yet. Buy something in the store first.');
  process.exit(2);
}
const money = (c) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`);
const UI_TEXT = { PENDING: 'Processing payment…', PAID: 'Payment received', PAYMENT_FAILED: 'Payment failed', REFUNDED: 'Refunded' };

// Settle window: webhooks arrive after checkout answers. Poll up to 15 s for a final status; never a fixed sleep.
async function settledOrder() {
  const deadline = Date.now() + 15_000;
  let order;
  do {
    order = db.prepare('SELECT * FROM crm_orders WHERE id = ?').get(orderId);
    if (!order || order.status !== 'PENDING') return order;
    await new Promise((r) => setTimeout(r, 500));
  } while (Date.now() < deadline);
  return order;
}

const order = await settledOrder();
if (!order) {
  console.log(`No order ${orderId} in the ledger (${DB_PATH}).`);
  process.exit(2);
}
const customer = db.prepare('SELECT * FROM crm_customers WHERE id = ?').get(order.customer_id);
const countOrders = (status) => db.prepare('SELECT COUNT(*) AS n FROM crm_orders WHERE customer_id = ? AND status = ?').get(order.customer_id, status).n;
const paidOrders = countOrders('PAID');

// STRIPE witness
let pi = null;
let events = [];
let gatewayError = null;
try {
  if (order.stripe_payment_intent_id) {
    pi = await retrievePaymentIntent(order.stripe_payment_intent_id);
    events = await eventsFor(order.stripe_payment_intent_id);
  }
} catch (err) {
  gatewayError = err.message;
}
const refunded = Boolean(pi?.latest_charge?.refunded);
const gatewayStatus = !pi ? 'none' : refunded ? 'refunded' : pi.status;
const expectedLedger = { succeeded: 'PAID', requires_payment_method: 'PAYMENT_FAILED', refunded: 'REFUNDED' }[gatewayStatus];

// UI witness — a real browser reads the confirmation page the way a shopper would.
let ui = { status: null, total: null, error: null };
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${BASE}/orders/${orderId}`, { timeout: 20_000 });
  const status = page.getByTestId('order-status');
  // The page polls the ledger itself; wait for it to leave "Processing payment…" (bounded, not a fixed sleep).
  // eslint-disable-next-line no-undef -- this callback runs inside the browser page
  await page.waitForFunction((pending) => document.querySelector('[data-testid="order-status"]')?.textContent !== pending,
    UI_TEXT.PENDING, { timeout: 10_000 }).catch(() => {});
  ui = { status: (await status.textContent())?.trim(), total: (await page.getByTestId('order-total').textContent())?.trim(), error: null };
} catch (err) {
  ui.error = String(err.message).split('\n')[0];
} finally {
  await browser.close();
}

// Duplicate processing: the same Stripe event applied more than once.
const dupes = db.prepare(`SELECT event_id, COUNT(*) AS n FROM webhook_events WHERE object_id = ? OR event_id IN (${events.map(() => '?').join(',') || "''"})
  GROUP BY event_id HAVING n > 1`).all(order.stripe_payment_intent_id ?? '', ...events.map((e) => e.id));
const unsigned = db.prepare('SELECT COUNT(*) AS n FROM webhook_events WHERE object_id = ? AND signature_verified = 0').get(order.stripe_payment_intent_id ?? '').n;

const checks = [];
const check = (rule, name, ok, detail) => checks.push({ rule, name, ok: Boolean(ok), detail });
check('ORD-2..4', 'Ledger status matches what Stripe did', expectedLedger && order.status === expectedLedger,
  `Stripe: ${gatewayStatus} → expected ${expectedLedger ?? '?'} · ledger: ${order.status}`);
check('PAY-1', 'Amount charged equals the total shown at checkout', order.displayed_total_cents == null || pi?.amount === order.displayed_total_cents,
  `shown ${money(order.displayed_total_cents)} · charged ${money(pi?.amount)}`);
check('PRICE-5', 'Ledger amount equals the Stripe amount', pi && order.amount_cents === pi.amount,
  `ledger ${money(order.amount_cents)} · Stripe ${money(pi?.amount)}`);
check('ORD-5', 'Confirmation page shows the ledger status', ui.status === UI_TEXT[order.status], ui.error ?? `page: "${ui.status}" · ledger: ${order.status}`);
check('ORD-5', 'Confirmation page total equals the ledger amount', ui.total === money(order.amount_cents), ui.error ?? `page ${ui.total} · ledger ${money(order.amount_cents)}`);
const expectedCustomer = paidOrders > 0 ? 'ACTIVE_CUSTOMER' : countOrders('REFUNDED') > 0 ? 'REFUNDED' : 'LEAD';
check('CRM-2', 'Customer status follows the payments', customer.status === expectedCustomer,
  `${customer.email}: ${customer.status} (expected ${expectedCustomer}; ${paidOrders} paid order${paidOrders === 1 ? '' : 's'})`);
check('WH-2', 'Every Stripe event was applied once', dupes.length === 0, dupes.length ? dupes.map((d) => `${d.event_id} ×${d.n}`).join(', ') : `${events.length} event(s), no repeats`);
check('WH-1', 'Every event for this payment was signed', unsigned === 0, unsigned ? `${unsigned} unsigned event(s) changed this order` : 'all signed');

const verdict = checks.every((c) => c.ok) ? 'PASS' : 'FAIL';
const receipt = {
  verdict, orderId, checkedAt: new Date().toISOString(), payments: MODE, gatewayError,
  ui: { shownAtCheckoutCents: order.displayed_total_cents, confirmationStatus: ui.status, confirmationTotal: ui.total },
  stripe: pi ? { paymentIntent: pi.id, status: pi.status, amount: pi.amount, amountReceived: pi.amount_received, refunded,
    declineCode: pi.last_payment_error?.decline_code ?? pi.last_payment_error?.code ?? null, events } : null,
  ledger: { order: { status: order.status, amountCents: order.amount_cents, paymentIntent: order.stripe_payment_intent_id, updatedAt: order.updated_at },
    customer: { email: customer.email, status: customer.status, totalSpentCents: customer.total_spent_cents } },
  checks,
};
mkdirSync('artifacts/witness', { recursive: true });
writeFileSync(`artifacts/witness/${orderId}.json`, JSON.stringify(receipt, null, 2) + '\n');

if (!quiet) {
  console.log(`\nThree witnesses for ${orderId}   (payments: ${MODE === 'offline' ? 'offline simulator' : 'your Stripe sandbox'})\n`);
  console.log(`  UI      shown at checkout ${money(order.displayed_total_cents)} · confirmation "${ui.status ?? ui.error}" ${ui.total ?? ''}`);
  console.log(`  STRIPE  ${pi ? `${pi.id} ${gatewayStatus} ${money(pi.amount)}${receipt.stripe.declineCode ? ` (${receipt.stripe.declineCode})` : ''}` : gatewayError ?? 'no PaymentIntent'}`);
  for (const e of events) console.log(`          ${e.id} ${e.type}`);
  console.log(`  LEDGER  order ${order.status} ${money(order.amount_cents)} · customer ${customer.status} spent ${money(customer.total_spent_cents)}\n`);
  for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  [${c.rule}] ${c.name}\n        ${c.detail}`);
}
console.log(`\nVerdict: ${verdict}   receipt: artifacts/witness/${orderId}.json\n`);
process.exit(verdict === 'PASS' ? 0 : 1);
