#!/usr/bin/env node
/**
 * Stripe retries webhooks, so the same event can arrive twice. Send one again, correctly signed, to test that.
 * Run: npm run replay -- <evt_... id>     (event ids: back office → Webhook events, or the witness output)
 */
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from '../store/db.mjs';
import { MODE, stripe, webhookSecret } from '../store/gateway.mjs';

const eventId = process.argv[2];
if (!eventId?.startsWith('evt_')) {
  console.log('Usage: npm run replay -- <evt_... id>');
  process.exit(2);
}
let event;
if (MODE === 'offline') {
  const row = new DatabaseSync(DB_PATH, { readOnly: true }).prepare('SELECT * FROM sim_events WHERE id = ?').get(eventId);
  if (row) event = { id: row.id, object: 'event', type: row.type, livemode: false, data: { object: JSON.parse(row.object) } };
} else {
  event = await stripe.events.retrieve(eventId).catch(() => null);
}
if (!event) {
  console.log(`No event ${eventId} in ${MODE === 'offline' ? 'the simulator' : 'your Stripe sandbox'}.`);
  process.exit(1);
}
const payload = JSON.stringify(event);
const res = await fetch(`http://localhost:${process.env.PORT ?? 3000}/api/webhooks/stripe`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret() }) },
  body: payload,
});
console.log(`Replayed ${event.type} ${event.id} → HTTP ${res.status} ${await res.text()}`);
console.log('Now check the ledger: npm run witness -- <order id>');
