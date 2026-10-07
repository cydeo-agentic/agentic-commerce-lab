// Zinc Store: storefront + checkout API + Stripe webhook + CRM ledger, in one small Express app.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS } from './catalog.mjs';
import { CARDS, MODE, charge, configured, ensureCustomer, refund, webhookSecret } from './gateway.mjs';
import {
  DB_PATH, createOrder, crmSnapshot, getCustomer, getOrder, getOrderLines, setOrderPaymentIntent, setStripeCustomer, upsertCustomer,
} from './db.mjs';
import { RULES, priceCart, validateLines } from './pricing.mjs';
import { cartPage, catalogPage, checkoutPage, crmPage, notFoundPage, orderPage } from './views.mjs';
import { stripeWebhook } from './webhooks.mjs';

const app = express();
app.disable('x-powered-by');

// The webhook needs the exact raw bytes Stripe signed, so it is mounted before the JSON parser.
app.post('/api/webhooks/stripe', express.raw({ type: '*/*', limit: '1mb' }), stripeWebhook);
app.use(express.json({ limit: '100kb' }));
app.use('/assets', express.static(join(dirname(fileURLToPath(import.meta.url)), 'public'), { maxAge: 0 }));

// ---------- pages ----------
const html = (res, markup, status = 200) => res.status(status).type('html').send(markup);
app.get('/', (_req, res) => html(res, catalogPage()));
app.get('/cart', (_req, res) => html(res, cartPage()));
app.get('/checkout', (_req, res) => html(res, checkoutPage()));
app.get('/crm', (_req, res) => html(res, crmPage()));
app.get('/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return html(res, notFoundPage(), 404);
  html(res, orderPage(order, getOrderLines(order.id), getCustomer(order.customer_id)?.email));
});

// ---------- API ----------
app.get('/api/health', (_req, res) => res.json({
  ok: true, mode: MODE, paymentsConfigured: configured(), webhookSecretSet: Boolean(webhookSecret()), db: DB_PATH,
}));
app.get('/api/rules', (_req, res) => res.json(RULES));
app.get('/api/products', (_req, res) => res.json(PRODUCTS.map(({ sku, name, priceCents }) => ({ sku, name, priceCents }))));

function declineMessage(err) {
  if (err.decline_code === 'insufficient_funds') return 'Your card has insufficient funds.';
  if (err.code === 'expired_card') return 'Your card has expired.';
  return 'Your card was declined.';
}

app.post('/api/checkout', async (req, res) => {
  const { name, email, card, coupon, lines, displayedTotalCents } = req.body ?? {};
  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'Enter your full name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim())) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!CARDS[card]) return res.status(400).json({ error: 'Choose a test card.' });
  const lineError = validateLines(lines);
  if (lineError) return res.status(400).json({ error: lineError });
  if (!configured()) return res.status(503).json({ error: 'Payments are not set up. Run: npm run dev' });

  const price = priceCart(lines, coupon);
  const customer = upsertCustomer({ name: String(name).trim(), email: String(email).trim().toLowerCase() });
  const order = createOrder({ customerId: customer.id, price, coupon, card, displayedTotalCents });
  try {
    const stripeCustomerId = await ensureCustomer(customer);
    if (stripeCustomerId && !customer.stripe_customer_id) setStripeCustomer(customer.id, stripeCustomerId);
    const paymentIntent = await charge({ order, stripeCustomerId, card });
    setOrderPaymentIntent(order.id, paymentIntent.id);
    console.log(`[checkout] ${order.id} ${paymentIntent.id} ${paymentIntent.status} ${order.amount_cents}c`);
    res.json({ orderId: order.id, paymentStatus: paymentIntent.status });
  } catch (err) {
    if (err.type === 'StripeCardError' || err.rawType === 'card_error') {
      if (err.payment_intent?.id) setOrderPaymentIntent(order.id, err.payment_intent.id);
      console.log(`[checkout] ${order.id} ${err.payment_intent?.id ?? ''} declined ${err.decline_code ?? err.code}`);
      return res.status(402).json({ orderId: order.id, error: declineMessage(err), code: err.code, declineCode: err.decline_code ?? null });
    }
    console.error(`[checkout] ${order.id} gateway error: ${err.message}`);
    res.status(502).json({ orderId: order.id, error: 'The payment service did not answer. Try again in a minute.' });
  }
});

app.get('/api/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'No such order.' });
  res.json({ ...order, customer_email: getCustomer(order.customer_id)?.email, lines: getOrderLines(order.id) });
});

app.post('/api/orders/:id/refund', async (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'No such order.' });
  if (order.status !== 'PAID') return res.status(409).json({ error: `Only a PAID order can be refunded (this one is ${order.status}).` });
  try {
    const r = await refund(order.stripe_payment_intent_id);
    res.status(202).json({ refund: r.id, status: r.status, note: 'The ledger changes when Stripe sends charge.refunded.' });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/crm', (_req, res) => res.json(crmSnapshot()));
app.use((_req, res) => html(res, notFoundPage(), 404));

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
app.listen(port, host, () => {
  console.log(`[store] Zinc Store on http://localhost:${port}  (payments: ${MODE === 'offline' ? 'offline simulator' : 'your Stripe sandbox'})`);
  if (!configured()) console.log('[store] No Stripe test key yet. Run: npm run dev   (it creates your sandbox)');
});
