// Browser side of the Zinc Store: cart, checkout, order status, back office.
const page = document.body.dataset.page;
const $ = (sel) => document.querySelector(sel);
const tid = (id) => document.querySelector(`[data-testid="${id}"]`);
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- cart storage ----------
const CART_KEY = 'zinc-cart';
const readCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) ?? { lines: [], coupon: '' }; } catch { return { lines: [], coupon: '' }; }
};
const writeCart = (cart) => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); renderCount(cart); };
const renderCount = (cart = readCart()) => { tid('header-cart-count').textContent = cart.lines.reduce((n, l) => n + l.qty, 0); };
renderCount();

let rules;
let products;
async function loadStore() {
  [rules, products] = await Promise.all([fetch('/api/rules').then((r) => r.json()), fetch('/api/products').then((r) => r.json())]);
  products = Object.fromEntries(products.map((p) => [p.sku, p]));
}

// The price the shopper sees before paying.
function priceCart(cart) {
  const subtotal = cart.lines.reduce((sum, l) => sum + products[l.sku].priceCents * l.qty, 0);
  const couponOk = Boolean(cart.coupon) && cart.coupon.toUpperCase() === rules.couponCode;
  const discount = couponOk ? Math.floor((subtotal * rules.couponPercent) / 100) : 0;
  const discounted = subtotal - discount;
  const shipping = discounted >= rules.freeShippingThresholdCents ? 0 : rules.shippingCents;
  const tax = Math.floor((discounted * rules.taxRatePercent + 50) / 100);
  return { subtotal, discount, shipping, tax, total: discounted + shipping + tax };
}

function renderTotals(prefix, cart) {
  const t = priceCart(cart);
  tid(`${prefix}-subtotal`).textContent = money(t.subtotal);
  tid(`${prefix}-discount`).textContent = t.discount ? `−${money(t.discount)}` : money(0);
  tid(`${prefix}-shipping`).textContent = t.shipping ? money(t.shipping) : 'Free';
  tid(`${prefix}-tax`).textContent = money(t.tax);
  tid(`${prefix}-total`).textContent = money(t.total);
  return t;
}

// ---------- catalog ----------
if (page === 'catalog') {
  document.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
    const cart = readCart();
    const line = cart.lines.find((l) => l.sku === btn.dataset.add);
    if (line) line.qty = Math.min(line.qty + 1, 10);
    else cart.lines.push({ sku: btn.dataset.add, qty: 1 });
    writeCart(cart);
    const toast = tid('catalog-added-toast');
    toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.hidden = true; }, 1600);
  }));
}

// ---------- cart ----------
if (page === 'cart') {
  await loadStore();
  const render = () => {
    const cart = readCart();
    tid('cart-empty-message').hidden = cart.lines.length > 0;
    tid('cart-checkout-button').classList.toggle('disabled', cart.lines.length === 0);
    $('#coupon').value = cart.coupon ?? '';
    $('#cart-lines').innerHTML = cart.lines.map((l) => {
      const p = products[l.sku];
      return `<li data-testid="cart-${l.sku}-line">
        <div><strong>${esc(p.name)}</strong><span class="muted">${money(p.priceCents)} each</span></div>
        <div class="qty">
          <button class="icon" data-dec="${l.sku}" aria-label="Decrease" data-testid="cart-${l.sku}-decrease-button">−</button>
          <span data-testid="cart-${l.sku}-qty">${l.qty}</span>
          <button class="icon" data-inc="${l.sku}" aria-label="Increase" data-testid="cart-${l.sku}-increase-button">+</button>
        </div>
        <span class="line-total">${money(p.priceCents * l.qty)}</span>
        <button class="link" data-rm="${l.sku}" data-testid="cart-${l.sku}-remove-button">Remove</button>
      </li>`;
    }).join('');
    renderTotals('cart', cart);
  };
  $('#cart-lines').addEventListener('click', (e) => {
    const cart = readCart();
    const { inc, dec, rm } = e.target.dataset;
    const line = cart.lines.find((l) => l.sku === (inc ?? dec ?? rm));
    if (!line) return;
    if (inc) line.qty = Math.min(line.qty + 1, rules.maxQtyPerLine);
    if (dec) line.qty = Math.max(line.qty - 1, 1);
    if (rm) cart.lines = cart.lines.filter((l) => l !== line);
    writeCart(cart);
    render();
  });
  $('#apply-coupon').addEventListener('click', () => {
    const cart = readCart();
    const code = $('#coupon').value.trim();
    const ok = code.toUpperCase() === rules.couponCode;
    cart.coupon = ok ? code.toUpperCase() : '';
    writeCart(cart);
    tid('cart-coupon-message').textContent = ok ? `${rules.couponCode} applied: ${rules.couponPercent}% off.` : "That code isn't valid.";
    render();
  });
  render();
}

// ---------- checkout ----------
if (page === 'checkout') {
  await loadStore();
  const cart = readCart();
  if (cart.lines.length === 0) location.href = '/cart';
  const totals = renderTotals('checkout', cart);
  const pay = tid('checkout-pay-button');
  pay.textContent = `Pay ${money(totals.total)}`;
  const checkoutToken = crypto.randomUUID();
  const alertBox = tid('checkout-error-alert');
  pay.addEventListener('click', async () => {
    alertBox.hidden = true;
    const body = {
      name: $('#name').value, email: $('#email').value,
      card: document.querySelector('input[name="card"]:checked')?.value,
      coupon: cart.coupon, lines: cart.lines, displayedTotalCents: totals.total, checkoutToken,
    };
    const res = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      localStorage.removeItem(CART_KEY);
      location.href = `/orders/${data.orderId}`;
      return;
    }
    alertBox.textContent = data.error ?? 'Something went wrong. Try again.';
    alertBox.hidden = false;
  });
}

// ---------- order confirmation ----------
if (page === 'order') {
  const STATUS_TEXT = { PENDING: 'Processing payment…', PAID: 'Payment received', PAYMENT_FAILED: 'Payment failed', REFUNDED: 'Refunded' };
  const id = document.querySelector('[data-order-id]').dataset.orderId;
  const pill = tid('order-status');
  for (let i = 0; i < 30; i++) {
    const order = await fetch(`/api/orders/${id}`).then((r) => r.json());
    pill.textContent = STATUS_TEXT[order.status];
    pill.className = `status ${order.status.toLowerCase()}`;
    if (order.status !== 'PENDING') break;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// ---------- back office ----------
if (page === 'crm') {
  const pill = (s) => `<span class="status ${s.toLowerCase()}">${s}</span>`;
  const render = async () => {
    const { customers, orders, events } = await fetch('/api/crm').then((r) => r.json());
    $('#crm-customers').innerHTML = customers.map((c) => `<tr data-testid="crm-customer-row">
      <td data-testid="crm-customer-email">${esc(c.email)}</td><td>${esc(c.name)}</td>
      <td data-testid="crm-customer-status">${pill(c.status)}</td><td data-testid="crm-customer-spent">${money(c.total_spent_cents)}</td></tr>`).join('');
    $('#crm-orders').innerHTML = orders.map((o) => `<tr data-testid="crm-order-row">
      <td data-testid="crm-order-id"><a href="/orders/${esc(o.id)}">${esc(o.id)}</a></td><td>${esc(o.customer_email)}</td>
      <td data-testid="crm-order-status">${pill(o.status)}</td><td data-testid="crm-order-amount">${money(o.amount_cents)}</td>
      <td>${o.displayed_total_cents == null ? '—' : money(o.displayed_total_cents)}</td><td class="mono">${esc(o.stripe_payment_intent_id ?? '—')}</td>
      <td>${o.status === 'PAID' ? `<button class="link" data-refund="${esc(o.id)}" data-testid="crm-order-refund-button">Refund</button>` : ''}</td></tr>`).join('');
    $('#crm-events').innerHTML = events.map((e) => `<tr data-testid="crm-event-row">
      <td>${esc(e.received_at.slice(11, 19))}</td><td class="mono">${esc(e.event_id)}</td><td data-testid="crm-event-type">${esc(e.type)}</td>
      <td class="mono">${esc(e.object_id)}</td><td>${e.signature_verified ? 'yes' : '<strong class="warn">no</strong>'}</td></tr>`).join('');
  };
  $('#crm-orders').addEventListener('click', async (e) => {
    const orderId = e.target.dataset.refund;
    if (!orderId) return;
    e.target.disabled = true;
    e.target.textContent = 'Refunding…';
    await fetch(`/api/orders/${orderId}/refund`, { method: 'POST' });
  });
  await render();
  setInterval(render, 2000);
}
