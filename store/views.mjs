// Server-rendered pages. Every element a test touches carries a data-testid from .cydeo/contract.md
// (convention: {page}-{component}-{action|field}).
import { PRODUCTS, productArt } from './catalog.mjs';
import { CARDS, MODE } from './gateway.mjs';
import { money } from './pricing.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const LOGO = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" fill="#111827"/>' +
  '<path d="M8.5 9h7l-7 6h7" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function layout({ title, page, body }) {
  const modeLabel = MODE === 'offline' ? 'Offline simulator' : 'Stripe sandbox';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Zinc Store</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="/assets/app.css">
</head>
<body data-page="${page}">
<div class="ribbon">Sandbox store for CYDEO Agentic QA. Payments run in <strong>your own</strong> Stripe test account. No real money moves.</div>
<header class="top">
  <a class="brand" href="/" data-testid="header-shop-link">${LOGO}<span>Zinc Store</span></a>
  <nav>
    <span class="mode" data-testid="header-mode-badge">${modeLabel}</span>
    <a href="/crm" data-testid="header-crm-link">Back office</a>
    <a class="cart-pill" href="/cart" data-testid="header-cart-link">Cart <span data-testid="header-cart-count">0</span></a>
  </nav>
</header>
<main>${body}</main>
<footer class="foot">Zinc Store is a training system. Its bugs are on purpose. Find them, prove them, report them.</footer>
<script src="/assets/store.js" type="module"></script>
</body>
</html>`;
}

export function catalogPage() {
  const cards = PRODUCTS.map((p) => `
    <article class="card" data-testid="catalog-${p.sku}-card">
      <div class="art">${productArt(p)}</div>
      <h3 data-testid="catalog-${p.sku}-name">${esc(p.name)}</h3>
      <p class="muted">${esc(p.tagline)}</p>
      <div class="row">
        <span class="price" data-testid="catalog-${p.sku}-price">${money(p.priceCents)}</span>
        <button class="btn" data-add="${p.sku}" data-testid="catalog-${p.sku}-add-button">Add to cart</button>
      </div>
    </article>`).join('');
  return layout({
    title: 'Shop', page: 'catalog', body: `
    <section class="hero">
      <h1>Gear for people who ship.</h1>
      <p class="muted">Free shipping on orders of $100.00 or more. Use code <strong>AGENT10</strong> for 10% off.</p>
    </section>
    <section class="grid">${cards}</section>
    <div class="toast" role="status" data-testid="catalog-added-toast" hidden>Added to cart</div>`,
  });
}

const summary = (prefix) => `
  <dl class="totals">
    <div><dt>Subtotal</dt><dd data-testid="${prefix}-subtotal">$0.00</dd></div>
    <div><dt>Discount</dt><dd data-testid="${prefix}-discount">$0.00</dd></div>
    <div><dt>Shipping</dt><dd data-testid="${prefix}-shipping">$0.00</dd></div>
    <div><dt>Tax (6%)</dt><dd data-testid="${prefix}-tax">$0.00</dd></div>
    <div class="grand"><dt>Total</dt><dd data-testid="${prefix}-total">$0.00</dd></div>
  </dl>`;

export function cartPage() {
  return layout({
    title: 'Cart', page: 'cart', body: `
    <h1 class="page-title">Your cart</h1>
    <div class="two-col">
      <section class="panel">
        <p class="muted" data-testid="cart-empty-message" hidden>Your cart is empty. <a href="/">Keep shopping</a></p>
        <ul class="lines" id="cart-lines"></ul>
      </section>
      <aside class="panel">
        <label class="field">Coupon code
          <span class="inline">
            <input id="coupon" autocomplete="off" placeholder="AGENT10" data-testid="cart-coupon-input">
            <button class="btn ghost" id="apply-coupon" data-testid="cart-coupon-apply-button">Apply</button>
          </span>
        </label>
        <p class="hint" data-testid="cart-coupon-message"></p>
        ${summary('cart')}
        <a class="btn wide" href="/checkout" data-testid="cart-checkout-button">Checkout</a>
      </aside>
    </div>`,
  });
}

export function checkoutPage() {
  const cards = Object.entries(CARDS).map(([key, c], i) => `
    <label class="choice">
      <input type="radio" name="card" value="${key}" ${i === 0 ? 'checked' : ''} data-testid="checkout-card-${key}">
      <span><strong>${esc(c.label)}</strong><small>${esc(c.outcome)} · test card</small></span>
    </label>`).join('');
  return layout({
    title: 'Checkout', page: 'checkout', body: `
    <h1 class="page-title">Checkout</h1>
    <div class="two-col">
      <section class="panel">
        <label class="field">Full name <input id="name" autocomplete="name" data-testid="checkout-name-input"></label>
        <label class="field">Email <input id="email" type="email" autocomplete="email" data-testid="checkout-email-input"></label>
        <fieldset class="cards"><legend>Payment method (Stripe test cards)</legend>${cards}</fieldset>
        <div class="alert" role="alert" data-testid="checkout-error-alert" hidden></div>
      </section>
      <aside class="panel">
        ${summary('checkout')}
        <button class="btn wide" id="pay" data-testid="checkout-pay-button">Pay</button>
        <p class="hint">Charged by the server through your Stripe sandbox. The order is confirmed when Stripe's webhook arrives.</p>
      </aside>
    </div>`,
  });
}

export const STATUS_TEXT = {
  PENDING: 'Processing payment…',
  PAID: 'Payment received',
  PAYMENT_FAILED: 'Payment failed',
  REFUNDED: 'Refunded',
};

export function orderPage(order, lines, email) {
  const items = lines.map((l) => `<li><span>${esc(l.name)} × ${l.qty}</span><span>${money(l.unit_cents * l.qty)}</span></li>`).join('');
  return layout({
    title: `Order ${order.id}`, page: 'order', body: `
    <section class="panel narrow" data-order-id="${esc(order.id)}">
      <span class="status ${order.status.toLowerCase()}" data-testid="order-status">${STATUS_TEXT[order.status]}</span>
      <h1>Thank you.</h1>
      <p class="muted">Order <strong data-testid="order-number">${esc(order.id)}</strong> for <span data-testid="order-email">${esc(email)}</span></p>
      <ul class="receipt">${items}</ul>
      <div class="row total-row"><span>Total charged</span><strong data-testid="order-total">${money(order.amount_cents)}</strong></div>
      <a class="btn ghost" href="/" data-testid="order-continue-link">Continue shopping</a>
    </section>`,
  });
}

export function crmPage() {
  return layout({
    title: 'Back office', page: 'crm', body: `
    <h1 class="page-title">Back office <span class="muted small">CRM ledger · live</span></h1>
    <section class="panel">
      <h2>Customers</h2>
      <table data-testid="crm-customers-table"><thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Total spent</th></tr></thead><tbody id="crm-customers"></tbody></table>
    </section>
    <section class="panel">
      <h2>Orders</h2>
      <table data-testid="crm-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Amount</th><th>Shown at checkout</th><th>PaymentIntent</th><th></th></tr></thead><tbody id="crm-orders"></tbody></table>
    </section>
    <section class="panel">
      <h2>Webhook events</h2>
      <table data-testid="crm-events-table"><thead><tr><th>Received</th><th>Event</th><th>Type</th><th>Object</th><th>Signed</th></tr></thead><tbody id="crm-events"></tbody></table>
    </section>`,
  });
}

export function notFoundPage() {
  return layout({ title: 'Not found', page: 'missing', body: '<section class="panel narrow"><h1>Not found</h1><p class="muted"><a href="/">Back to the store</a></p></section>' });
}
