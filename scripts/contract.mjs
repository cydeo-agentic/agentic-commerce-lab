#!/usr/bin/env node
// Writes .cydeo/contract.md: every data-testid the Zinc Store renders. `cydeo --qa` injects this file into the agent.
// Run after changing a page: npm run contract
import { mkdirSync, writeFileSync } from 'node:fs';
import { PRODUCTS } from '../store/catalog.mjs';
import { CARDS } from '../store/cards.mjs';

const skus = PRODUCTS.map((p) => p.sku);
const sections = [
  ['Header (every page)', 'Shop link, payment-mode badge, back-office link, cart link and item count.',
    ['header-shop-link', 'header-mode-badge', 'header-crm-link', 'header-cart-link', 'header-cart-count']],
  ['Catalog — /', `One card per product. SKUs: ${skus.join(', ')}.`,
    [...skus.flatMap((s) => [`catalog-${s}-card`, `catalog-${s}-name`, `catalog-${s}-price`, `catalog-${s}-add-button`]), 'catalog-added-toast']],
  ['Cart — /cart', 'Lines exist only for SKUs in the cart. Totals are what the shopper sees before paying.',
    ['cart-empty-message', ...skus.flatMap((s) => [`cart-${s}-line`, `cart-${s}-qty`, `cart-${s}-increase-button`, `cart-${s}-decrease-button`, `cart-${s}-remove-button`]),
      'cart-coupon-input', 'cart-coupon-apply-button', 'cart-coupon-message',
      'cart-subtotal', 'cart-discount', 'cart-shipping', 'cart-tax', 'cart-total', 'cart-checkout-button']],
  ['Checkout — /checkout', `Test cards are radio inputs: ${Object.keys(CARDS).join(', ')}. The pay button reads "Pay $<total>".`,
    ['checkout-name-input', 'checkout-email-input', ...Object.keys(CARDS).map((k) => `checkout-card-${k}`),
      'checkout-subtotal', 'checkout-discount', 'checkout-shipping', 'checkout-tax', 'checkout-total',
      'checkout-pay-button', 'checkout-error-alert']],
  ['Order confirmation — /orders/<order id>', 'Status text: "Processing payment…", "Payment received", "Payment failed", "Refunded".',
    ['order-status', 'order-number', 'order-email', 'order-total', 'order-continue-link']],
  ['Back office — /crm', 'Rows repeat: filter them by text, e.g. getByTestId("crm-order-row").filter({ hasText: orderId }).',
    ['crm-customers-table', 'crm-customer-row', 'crm-customer-email', 'crm-customer-status', 'crm-customer-spent',
      'crm-orders-table', 'crm-order-row', 'crm-order-id', 'crm-order-status', 'crm-order-amount', 'crm-order-refund-button',
      'crm-events-table', 'crm-event-row', 'crm-event-type']],
];

const body = sections.map(([title, note, ids]) => `## ${title}\n${note}\n\n${ids.map((id) => `- ${id}`).join('\n')}\n`).join('\n');
const md = `# Zinc Store — data-testid contract

The ONLY test ids that exist in the Zinc Store (base URL http://localhost:3000). Select with page.getByTestId('<id>').
If an element you need is not listed here, it has no test id: say so and stop. Never invent one.
API routes (for checks, not for UI tests): GET /api/rules, GET /api/products, GET /api/orders/<id>, GET /api/crm.

${body}`;
mkdirSync('.cydeo', { recursive: true });
writeFileSync('.cydeo/contract.md', md);
console.log(`Wrote .cydeo/contract.md (${sections.reduce((n, s) => n + s[2].length, 0)} test ids).`);
