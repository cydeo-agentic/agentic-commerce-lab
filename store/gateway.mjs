// The payment gateway. Default: YOUR Stripe sandbox (test keys only).
// Fallback: STORE_PAYMENTS=offline runs a local simulator with the same objects, statuses and signed webhooks,
// so a class never stops because Stripe is unreachable.
import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';
import { db } from './db.mjs';

import { CARDS } from './cards.mjs';

export { CARDS };
export const MODE = process.env.STORE_PAYMENTS === 'offline' ? 'offline' : 'stripe';
export const OFFLINE_WEBHOOK_SECRET = 'whsec_offline_simulator_not_a_real_secret';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (/_live_/.test(key)) {
  console.error('Refusing to start: STRIPE_SECRET_KEY is a LIVE key. This lab only ever uses sandbox (test) keys.');
  process.exit(1);
}

// Webhook utilities (signature checks) work without network access, so the simulator uses them too.
export const stripe = new Stripe(MODE === 'stripe' && key ? key : 'sk_test_offline_simulator', { maxNetworkRetries: 2 });
export const webhookSecret = () => (MODE === 'offline' ? OFFLINE_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET ?? '');
export const configured = () => MODE === 'offline' || /^(sk|rk|rkcs)_test_/.test(key);

// ---------- Stripe sandbox ----------
async function stripeEnsureCustomer(customer) {
  if (customer.stripe_customer_id) return customer.stripe_customer_id;
  const created = await stripe.customers.create({ email: customer.email, name: customer.name, metadata: { crm_customer_id: customer.id } });
  return created.id;
}

async function stripeCharge({ order, stripeCustomerId, card }) {
  return stripe.paymentIntents.create({
    amount: order.amount_cents,
    currency: order.currency,
    customer: stripeCustomerId,
    payment_method: CARDS[card].pm,
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    description: `Zinc Store order ${order.id}`,
    metadata: { order_id: order.id, crm_customer_id: order.customer_id },
  });
}

// ---------- Offline simulator ----------
db.exec(`CREATE TABLE IF NOT EXISTS sim_payment_intents (id TEXT PRIMARY KEY, amount INTEGER, currency TEXT, status TEXT,
  last_error TEXT, metadata TEXT, refunded INTEGER DEFAULT 0, created TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
  CREATE TABLE IF NOT EXISTS sim_events (id TEXT PRIMARY KEY, type TEXT, object TEXT, created TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));`);
const simId = (p) => `${p}_sim_${randomBytes(8).toString('hex')}`;

function simEmit(type, object) {
  const event = { id: simId('evt'), object: 'event', type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object } };
  db.prepare('INSERT INTO sim_events (id, type, object) VALUES (?, ?, ?)').run(event.id, type, JSON.stringify(object));
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: OFFLINE_WEBHOOK_SECRET });
  // Webhooks arrive after the API answers, as they do from Stripe.
  setTimeout(() => {
    fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/webhooks/stripe`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': header }, body: payload,
    }).catch((err) => console.error(`[simulator] webhook delivery failed: ${err.message}`));
  }, 400 + Math.floor(Math.random() * 600));
  return event;
}

function simPi(row) {
  return { id: row.id, object: 'payment_intent', amount: row.amount, amount_received: row.status === 'succeeded' ? row.amount : 0,
    currency: row.currency, status: row.status, metadata: JSON.parse(row.metadata), last_payment_error: row.last_error ? JSON.parse(row.last_error) : null };
}

async function simCharge({ order, card }) {
  const c = CARDS[card];
  const pi = { id: simId('pi'), amount: order.amount_cents, currency: order.currency, status: c.decline ? 'requires_payment_method' : 'succeeded',
    metadata: JSON.stringify({ order_id: order.id, crm_customer_id: order.customer_id }),
    last_error: c.decline ? JSON.stringify({ code: c.decline[0], decline_code: c.decline[1], message: c.decline[2] }) : null };
  db.prepare('INSERT INTO sim_payment_intents (id, amount, currency, status, last_error, metadata) VALUES (?, ?, ?, ?, ?, ?)')
    .run(pi.id, pi.amount, pi.currency, pi.status, pi.last_error, pi.metadata);
  const obj = simPi(db.prepare('SELECT * FROM sim_payment_intents WHERE id = ?').get(pi.id));
  if (c.decline) {
    simEmit('payment_intent.payment_failed', obj);
    const err = new Error(c.decline[2]);
    Object.assign(err, { type: 'StripeCardError', rawType: 'card_error', code: c.decline[0], decline_code: c.decline[1], payment_intent: obj });
    throw err;
  }
  simEmit('payment_intent.succeeded', obj);
  return obj;
}

// ---------- One interface for the store and the witness ----------
export async function ensureCustomer(customer) {
  return MODE === 'offline' ? null : stripeEnsureCustomer(customer);
}

export async function charge({ order, stripeCustomerId, card }) {
  return MODE === 'offline' ? simCharge({ order, card }) : stripeCharge({ order, stripeCustomerId, card });
}

export async function refund(paymentIntentId) {
  if (MODE === 'stripe') return stripe.refunds.create({ payment_intent: paymentIntentId });
  const row = db.prepare('SELECT * FROM sim_payment_intents WHERE id = ?').get(paymentIntentId);
  if (!row || row.status !== 'succeeded') throw new Error('Only a succeeded payment can be refunded.');
  db.prepare('UPDATE sim_payment_intents SET refunded = 1 WHERE id = ?').run(paymentIntentId);
  simEmit('charge.refunded', { id: simId('ch'), object: 'charge', payment_intent: paymentIntentId, amount: row.amount, amount_refunded: row.amount, refunded: true });
  return { id: simId('re'), status: 'succeeded' };
}

export async function retrievePaymentIntent(paymentIntentId) {
  if (MODE === 'stripe') return stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  const row = db.prepare('SELECT * FROM sim_payment_intents WHERE id = ?').get(paymentIntentId);
  if (!row) return null;
  return { ...simPi(row), latest_charge: { refunded: Boolean(row.refunded), amount_refunded: row.refunded ? row.amount : 0 } };
}

// Events the gateway sent about one payment (newest first).
export async function eventsFor(paymentIntentId) {
  if (MODE === 'offline') {
    return db.prepare('SELECT id, type, object FROM sim_events ORDER BY created DESC').all()
      .filter((e) => { const o = JSON.parse(e.object); return o.id === paymentIntentId || o.payment_intent === paymentIntentId; })
      .map((e) => ({ id: e.id, type: e.type }));
  }
  const out = [];
  let scanned = 0;
  for await (const e of stripe.events.list({ limit: 100, types: ['payment_intent.succeeded', 'payment_intent.payment_failed', 'charge.refunded'] })) {
    const o = e.data.object;
    if (o.id === paymentIntentId || o.payment_intent === paymentIntentId) out.push({ id: e.id, type: e.type });
    if (out.length >= 10 || ++scanned >= 300) break;
  }
  return out;
}
