// Server-rendered pages. Every element a test touches carries a data-testid from .cydeo/contract.md
// (convention: {page}-{component}-{action|field}).
import { CATEGORIES, PRODUCTS, productArt } from './catalog.mjs';

// Product renders for pages that draw lines in the browser (bag, checkout summary). Inert <template>s, no test ids.
const artTemplates = () => PRODUCTS.map((p) => `<template id="art-${p.sku}">${productArt(p)}</template>`).join('');
import { CARDS, MODE } from './gateway.mjs';
import { money } from './pricing.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const LOGO = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" fill="currentColor"/>' +
  '<path d="M8.5 9h7l-7 6h7" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BAG = '<svg viewBox="0 0 17 20" width="15" height="18" aria-hidden="true"><path d="M13.6 5.5H11V5a2.5 2.5 0 0 0-5 0v.5H3.4A1.4 1.4 0 0 0 2 6.9v9.7A1.4 1.4 0 0 0 3.4 18h10.2a1.4 1.4 0 0 0 1.4-1.4V6.9a1.4 1.4 0 0 0-1.4-1.4ZM7 5a1.5 1.5 0 0 1 3 0v.5H7Zm7 11.6a.4.4 0 0 1-.4.4H3.4a.4.4 0 0 1-.4-.4V6.9a.4.4 0 0 1 .4-.4h10.2a.4.4 0 0 1 .4.4Z" fill="currentColor"/></svg>';

// Product-nav icons (the row under the store header).
const NAV_ICONS = {
  phones: '<rect x="18" y="4" width="20" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="24" y="7.5" width="8" height="2.5" rx="1.25" fill="currentColor"/>',
  accessories: '<circle cx="28" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="28" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  desk: '<rect x="6" y="18" width="44" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 25h4M20 25h4M28 25h4M36 25h4M16 30h24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  crm: '<rect x="8" y="8" width="40" height="32" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 18h40M20 18v22" stroke="currentColor" stroke-width="2.2"/>',
};
const navIcon = (key) => `<svg viewBox="0 0 56 48" width="56" height="48" aria-hidden="true">${NAV_ICONS[key]}</svg>`;

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
<header class="gnav">
  <nav class="gnav-inner" aria-label="Zinc Store">
    <a class="gnav-logo" href="/" data-testid="header-shop-link" aria-label="Zinc Store">${LOGO}<span>Zinc Store</span></a>
    <ul class="gnav-links">
      <li><a href="/#phones">Phones</a></li>
      <li><a href="/#accessories">Accessories</a></li>
      <li><a href="/#desk">Desk</a></li>
      <li><a href="/crm" data-testid="header-crm-link">Back office</a></li>
    </ul>
    <div class="gnav-end">
      <span class="mode" data-testid="header-mode-badge">${modeLabel}</span>
      <a class="gnav-bag" href="/cart" data-testid="header-cart-link" aria-label="Bag">${BAG}<span class="gnav-bag-count" data-testid="header-cart-count">0</span></a>
    </div>
  </nav>
</header>
<div class="ribbon"><p>Free delivery on orders of $100.00 or more. Use code <strong>AGENT10</strong> for 10% off. <span class="ribbon-note">Sandbox store: payments run in <strong>your own</strong> Stripe test account. No real money moves.</span></p></div>
<main>${body}</main>
<footer class="gfoot">
  <div class="gfoot-inner">
    <p class="gfoot-note">Zinc Store is a training system for CYDEO Agentic QA. Its bugs are on purpose. Find them, prove them, report them.</p>
    <p class="gfoot-note">Payments are confirmed on the server with Stripe test PaymentMethods. The order is recorded when Stripe's signed webhook arrives. Products, names and images are fictional.</p>
    <div class="gfoot-bottom"><span>Copyright © 2026 CYDEO. Practice use only.</span><span><a href="/">Store</a> · <a href="/cart">Bag</a> · <a href="/crm">Back office</a></span></div>
  </div>
</footer>
<script src="/assets/store.js" type="module"></script>
</body>
</html>`;
}

function productCard(p) {
  // Every card keeps the eyebrow and swatch rows (empty when unused) so names and prices line up across a shelf.
  const swatches = `<ul class="swatches" aria-hidden="true">${(p.colors ?? []).map((c) => `<li style="background:${c}"></li>`).join('')}</ul>`;
  return `
      <article class="pcard${p.category === 'phones' ? ' pcard-lg' : ''}" data-testid="catalog-${p.sku}-card">
        <div class="pcard-art">${productArt(p)}</div>
        <div class="pcard-body">
          <p class="eyebrow">${p.isNew ? 'New' : ''}</p>
          ${swatches}
          <h3 class="pcard-name" data-testid="catalog-${p.sku}-name">${esc(p.name)}</h3>
          <p class="pcard-tag">${esc(p.tagline)}</p>
          <div class="pcard-foot">
            <span class="pcard-price" data-testid="catalog-${p.sku}-price">${money(p.priceCents)}</span>
            <button class="btn btn-sm" data-add="${p.sku}" data-testid="catalog-${p.sku}-add-button">Add to Bag</button>
          </div>
        </div>
      </article>`;
}

const shelf = ({ id, title, lead }, cards) => `
  <section class="shelf" id="${id}" aria-labelledby="${id}-title">
    <div class="shelf-head">
      <h2 class="shelf-title" id="${id}-title">${esc(title)} <span>${esc(lead)}</span></h2>
      <div class="paddles" aria-hidden="true"><button class="paddle" data-scroll="${id}" data-dir="-1" tabindex="-1">‹</button><button class="paddle" data-scroll="${id}" data-dir="1" tabindex="-1">›</button></div>
    </div>
    <div class="scroller" data-scroller="${id}"><div class="scroller-track">${cards}</div></div>
  </section>`;

const PROMISES = [
  ['Free delivery', 'On every order of $100.00 or more after discount.'],
  ['10% off with AGENT10', 'Enter the code in your bag. One code per order.'],
  ['Your own Stripe sandbox', 'Every payment is real Stripe test traffic in your account.'],
  ['Three witnesses', 'The page, Stripe and the ledger must agree. Check with npm run witness.'],
];

export function catalogPage() {
  const shelves = CATEGORIES.map((c) => shelf(c, PRODUCTS.filter((p) => p.category === c.id).map(productCard).join(''))).join('');
  const promises = PROMISES.map(([t, d]) => `<article class="icard"><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('');
  return layout({
    title: 'Store', page: 'catalog', body: `
    <section class="store-head">
      <h1>Store</h1>
      <div class="store-sub">
        <p class="store-lead">The best way to buy the gear you test.</p>
        <p class="store-help">Need help? <a href="/crm">Open the back office</a> to see every order and webhook.</p>
      </div>
    </section>
    <nav class="pnav" aria-label="Shop by category">
      <a href="#phones">${navIcon('phones')}<span>Phones</span></a>
      <a href="#accessories">${navIcon('accessories')}<span>Accessories</span></a>
      <a href="#desk">${navIcon('desk')}<span>Desk</span></a>
      <a href="/crm">${navIcon('crm')}<span>Back office</span></a>
    </nav>
    ${shelves}
    <section class="shelf">
      <div class="shelf-head"><h2 class="shelf-title">The Zinc Store difference. <span>Even more reasons to test with us.</span></h2></div>
      <div class="icards">${promises}</div>
    </section>
    <div class="toast" role="status" data-testid="catalog-added-toast" hidden>Added to Bag</div>`,
  });
}

const summary = (prefix) => `
  <dl class="totals">
    <div><dt>Subtotal</dt><dd data-testid="${prefix}-subtotal">$0.00</dd></div>
    <div><dt>Discount</dt><dd data-testid="${prefix}-discount">$0.00</dd></div>
    <div><dt>Shipping</dt><dd data-testid="${prefix}-shipping">$0.00</dd></div>
    <div><dt>Estimated tax (6%)</dt><dd data-testid="${prefix}-tax">$0.00</dd></div>
    <div class="grand"><dt>Total</dt><dd data-testid="${prefix}-total">$0.00</dd></div>
  </dl>`;

export function cartPage() {
  return layout({
    title: 'Bag', page: 'cart', body: `
    <section class="bag">
      <header class="bag-head">
        <h1 id="bag-headline">Review your bag.</h1>
        <p class="bag-sub">Free delivery on $100.00 or more. Payments run in your Stripe sandbox.</p>
      </header>
      <p class="bag-empty" data-testid="cart-empty-message" hidden>Your bag is empty. <a href="/">Continue shopping</a></p>
      <ul class="bag-lines" id="cart-lines"></ul>
      <div class="bag-summary">
        <div class="promo">
          <label class="promo-label" for="coupon">Do you have a promo code?</label>
          <span class="inline">
            <input id="coupon" autocomplete="off" placeholder="Enter code" data-testid="cart-coupon-input">
            <button class="btn btn-ghost" id="apply-coupon" data-testid="cart-coupon-apply-button">Apply</button>
          </span>
          <p class="hint" data-testid="cart-coupon-message"></p>
        </div>
        <div class="bag-totals">
          ${summary('cart')}
          <a class="btn btn-lg" href="/checkout" data-testid="cart-checkout-button">Check Out</a>
        </div>
      </div>
    </section>${artTemplates()}`,
  });
}

const CARD_ICON = '<svg viewBox="0 0 38 24" width="38" height="24" aria-hidden="true"><rect width="38" height="24" rx="4" fill="#1a1f71"/><text x="19" y="16" text-anchor="middle" font-family="Helvetica,Arial" font-size="10" font-style="italic" font-weight="800" fill="#fff">VISA</text></svg>';
const EXPIRED_ICON = '<svg viewBox="0 0 38 24" width="38" height="24" aria-hidden="true"><rect width="38" height="24" rx="4" fill="#6e6e73"/><rect x="5" y="7" width="9" height="7" rx="1.5" fill="#e3c06a"/><path d="M5 18h28" stroke="#fff" stroke-width="1.6" opacity=".6"/></svg>';

export function checkoutPage() {
  const cards = Object.entries(CARDS).map(([key, c], i) => `
        <label class="ptile">
          <input type="radio" name="card" value="${key}" ${i === 0 ? 'checked' : ''} data-testid="checkout-card-${key}">
          <span class="ptile-icon">${key === 'expired' ? EXPIRED_ICON : CARD_ICON}</span>
          <span class="ptile-text"><strong>${esc(c.label)}</strong><small>${esc(c.outcome)} · Stripe test card</small></span>
        </label>`).join('');
  return layout({
    title: 'Checkout', page: 'checkout', body: `
    <section class="co">
      <header class="co-head">
        <h1>Checkout</h1>
        <p class="co-bagtotal">Bag total <strong id="co-bag-total">$0.00</strong></p>
      </header>
      <div class="co-grid">
        <div class="co-main">
          <section class="co-step">
            <h2>Who is this order for?</h2>
            <label class="float"><input id="name" autocomplete="name" placeholder=" " data-testid="checkout-name-input"><span>Full name</span></label>
            <label class="float"><input id="email" type="email" autocomplete="email" placeholder=" " data-testid="checkout-email-input"><span>Email address</span></label>
            <p class="hint">We email the receipt here. Use an address that starts with e2e- for test data.</p>
          </section>
          <section class="co-step">
            <h2>How would you like to pay?</h2>
            <fieldset class="ptiles"><legend class="sr">Payment method (Stripe test cards)</legend>${cards}</fieldset>
            <div class="alert" role="alert" data-testid="checkout-error-alert" hidden></div>
            <button class="btn btn-lg btn-block" id="pay" data-testid="checkout-pay-button">Pay</button>
            <p class="hint center">Charged by the server through your Stripe sandbox. The order is confirmed when Stripe's webhook arrives.</p>
          </section>
        </div>
        <aside class="co-side">
          <h2>Order summary</h2>
          <ul class="co-items" id="co-items"></ul>
          ${summary('checkout')}
        </aside>
      </div>
    </section>${artTemplates()}`,
  });
}

export const STATUS_TEXT = {
  PENDING: 'Processing payment…',
  PAID: 'Payment received',
  PAYMENT_FAILED: 'Payment failed',
  REFUNDED: 'Refunded',
};

export function orderPage(order, lines, email) {
  const items = lines.map((l) => `<li><span>${esc(l.name)} <span class="muted">× ${l.qty}</span></span><span>${money(l.unit_cents * l.qty)}</span></li>`).join('');
  return layout({
    title: `Order ${order.id}`, page: 'order', body: `
    <section class="confirm" data-order-id="${esc(order.id)}">
      <span class="status ${order.status.toLowerCase()}" data-testid="order-status">${STATUS_TEXT[order.status]}</span>
      <h1>Thank you.</h1>
      <p class="confirm-sub">Order <strong data-testid="order-number">${esc(order.id)}</strong> for <span data-testid="order-email">${esc(email)}</span></p>
      <ul class="receipt">${items}</ul>
      <div class="total-row"><span>Total charged</span><strong data-testid="order-total">${money(order.amount_cents)}</strong></div>
      <a class="btn btn-ghost" href="/" data-testid="order-continue-link">Continue shopping</a>
    </section>`,
  });
}

export function crmPage() {
  return layout({
    title: 'Back office', page: 'crm', body: `
    <section class="crm">
      <h1 class="crm-title">Back office <span>CRM ledger · live</span></h1>
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
      </section>
    </section>`,
  });
}

export function notFoundPage() {
  return layout({ title: 'Not found', page: 'missing', body: '<section class="confirm"><h1>Not found</h1><p class="confirm-sub"><a href="/">Back to the store</a></p></section>' });
}
