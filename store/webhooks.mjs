// POST /api/webhooks/stripe — Stripe tells the store what happened to a payment. The ledger changes only here
// (PRD ORD-2..ORD-4, CRM-2..CRM-4, WH-1, WH-2).
import { stripe, webhookSecret } from './gateway.mjs';
import {
  addCustomerSpend, getOrder, orderByPaymentIntent, paidOrderCount, recordEvent, setCustomerStatus, setOrderStatus,
} from './db.mjs';

function findOrder(object) {
  const paymentIntentId = object.object === 'payment_intent' ? object.id : object.payment_intent;
  // The webhook can arrive before checkout saved the PaymentIntent id, so fall back to the order id in metadata.
  return orderByPaymentIntent(paymentIntentId) ?? (object.metadata?.order_id ? getOrder(object.metadata.order_id) : undefined);
}

// Shared by every payment event: the customer just paid us, so they are an active customer now.
function afterPaymentEvent(order) {
  setCustomerStatus(order.customer_id, 'ACTIVE_CUSTOMER');
}

const handlers = {
  'payment_intent.succeeded'(pi) {
    const order = findOrder(pi);
    if (!order) return 'no matching order';
    setOrderStatus(order.id, 'PAID');
    addCustomerSpend(order.customer_id, pi.amount_received ?? pi.amount);
    afterPaymentEvent(order);
    return `order ${order.id} PAID`;
  },
  'payment_intent.payment_failed'(pi) {
    const order = findOrder(pi);
    if (!order) return 'no matching order';
    setOrderStatus(order.id, 'PAYMENT_FAILED', pi.last_payment_error?.decline_code ?? pi.last_payment_error?.code ?? null);
    afterPaymentEvent(order);
    return `order ${order.id} PAYMENT_FAILED`;
  },
  'charge.refunded'(charge) {
    const order = findOrder(charge);
    if (!order) return 'no matching order';
    setOrderStatus(order.id, 'REFUNDED');
    if (paidOrderCount(order.customer_id) === 0) setCustomerStatus(order.customer_id, 'REFUNDED');
    return `order ${order.id} REFUNDED`;
  },
};

export function stripeWebhook(req, res) {
  const signature = req.headers['stripe-signature'];
  let event;
  let verified = false;
  if (signature) {
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret());
      verified = true;
    } catch (err) {
      console.warn(`[webhook] rejected: ${err.message}`);
      return res.status(400).json({ error: 'Invalid Stripe signature.' });
    }
  } else {
    // Internal tools (and old integrations) post events without a signature header.
    try {
      event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body));
    } catch {
      return res.status(400).json({ error: 'Body is not JSON.' });
    }
  }

  recordEvent(event, verified);
  const handler = handlers[event.type];
  const result = handler ? handler(event.data?.object ?? {}) : 'ignored';
  console.log(`[webhook] ${event.type} ${event.id} → ${result}${verified ? '' : ' (unsigned)'}`);
  res.json({ received: true });
}
