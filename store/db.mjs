// The CRM ledger: one SQLite file per student (store/data/store.db). Node's built-in SQLite, no native installs.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DB_PATH = process.env.STORE_DB ?? resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'store.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS crm_customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  total_spent_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'LEAD' CHECK (status IN ('LEAD', 'ACTIVE_CUSTOMER', 'CHURNED', 'REFUNDED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS crm_orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES crm_customers(id),
  stripe_payment_intent_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  displayed_total_cents INTEGER,
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  coupon TEXT,
  card TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'PAYMENT_FAILED', 'REFUNDED')),
  failure_code TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS crm_order_lines (
  order_id TEXT NOT NULL REFERENCES crm_orders(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  object_id TEXT,
  signature_verified INTEGER NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`;

mkdirSync(dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
db.exec(SCHEMA);

const id = (prefix) => `${prefix}_${randomBytes(6).toString('hex')}`;
const now = () => new Date().toISOString();

export function upsertCustomer({ name, email }) {
  const existing = db.prepare('SELECT * FROM crm_customers WHERE email = ?').get(email);
  if (existing) return existing;
  const row = { id: id('cus'), name, email };
  db.prepare('INSERT INTO crm_customers (id, name, email) VALUES (?, ?, ?)').run(row.id, row.name, row.email);
  return db.prepare('SELECT * FROM crm_customers WHERE id = ?').get(row.id);
}

export function setStripeCustomer(customerId, stripeCustomerId) {
  db.prepare('UPDATE crm_customers SET stripe_customer_id = ? WHERE id = ?').run(stripeCustomerId, customerId);
}

export function createOrder({ customerId, price, coupon, card, displayedTotalCents }) {
  const orderId = id('ord');
  db.prepare(`INSERT INTO crm_orders (id, customer_id, amount_cents, displayed_total_cents, subtotal_cents, discount_cents,
      shipping_cents, tax_cents, coupon, card) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(orderId, customerId, price.totalCents, Number.isInteger(displayedTotalCents) ? displayedTotalCents : null,
      price.subtotalCents, price.discountCents, price.shippingCents, price.taxCents, price.couponApplied ? coupon.trim().toUpperCase() : null, card);
  const line = db.prepare('INSERT INTO crm_order_lines (order_id, sku, name, unit_cents, qty) VALUES (?, ?, ?, ?, ?)');
  for (const i of price.items) line.run(orderId, i.sku, i.name, i.unitCents, i.qty);
  return getOrder(orderId);
}

export const getOrder = (orderId) => db.prepare('SELECT * FROM crm_orders WHERE id = ?').get(orderId);
export const getOrderLines = (orderId) => db.prepare('SELECT sku, name, unit_cents, qty FROM crm_order_lines WHERE order_id = ?').all(orderId);
export const orderByPaymentIntent = (pi) => db.prepare('SELECT * FROM crm_orders WHERE stripe_payment_intent_id = ?').get(pi);
export const getCustomer = (customerId) => db.prepare('SELECT * FROM crm_customers WHERE id = ?').get(customerId);

export function setOrderPaymentIntent(orderId, paymentIntentId) {
  db.prepare('UPDATE crm_orders SET stripe_payment_intent_id = ?, updated_at = ? WHERE id = ?').run(paymentIntentId, now(), orderId);
}

export function setOrderStatus(orderId, status, failureCode = null) {
  db.prepare('UPDATE crm_orders SET status = ?, failure_code = COALESCE(?, failure_code), updated_at = ? WHERE id = ?')
    .run(status, failureCode, now(), orderId);
}

export function addCustomerSpend(customerId, cents) {
  db.prepare('UPDATE crm_customers SET total_spent_cents = total_spent_cents + ? WHERE id = ?').run(cents, customerId);
}

export function setCustomerStatus(customerId, status) {
  db.prepare('UPDATE crm_customers SET status = ? WHERE id = ?').run(status, customerId);
}

export const paidOrderCount = (customerId) =>
  db.prepare("SELECT COUNT(*) AS n FROM crm_orders WHERE customer_id = ? AND status = 'PAID'").get(customerId).n;

export function recordEvent(event, signatureVerified) {
  db.prepare('INSERT INTO webhook_events (event_id, type, object_id, signature_verified) VALUES (?, ?, ?, ?)')
    .run(String(event.id ?? ''), String(event.type ?? ''), String(event.data?.object?.id ?? ''), signatureVerified ? 1 : 0);
}

export function crmSnapshot() {
  return {
    customers: db.prepare('SELECT * FROM crm_customers ORDER BY created_at DESC').all(),
    orders: db.prepare(`SELECT o.*, c.email AS customer_email FROM crm_orders o JOIN crm_customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC`).all(),
    events: db.prepare('SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 200').all(),
  };
}
