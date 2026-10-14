#!/usr/bin/env node
/**
 * The live catalog: every product's test-id name and price, asked from the running store. Run: npm run catalog
 * Agents may run it without asking. It is how a test gets its data (which products make exactly $100.00) from the
 * running system, never from the store's source code.
 */
const base = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`;
const res = await fetch(`${base}/api/products`).catch(() => null);
if (!res?.ok) {
  console.log(`The store did not answer at ${base}. Start it in terminal 1: npm run dev`);
  process.exit(1);
}
const products = await res.json();
console.log(`Live catalog from ${base}/api/products (${products.length} products). Prices in dollars and cents.\n`);
console.log('sku          price      name');
for (const p of products) console.log(`${p.sku.padEnd(12)} ${`$${(p.priceCents / 100).toFixed(2)}`.padStart(9)}  ${p.name}`);
console.log('\nTest ids follow the sku: catalog-<sku>-add-button, cart-<sku>-qty, cart-<sku>-increase-button (see .cydeo/contract.md).');
