#!/usr/bin/env node
/**
 * The live catalog: every product's test-id name and price, asked from the running store.
 * Run: npm run catalog              (the price list)
 *      npm run catalog -- 100.00    (a cart that adds up to exactly $100.00, or the nearest ones if none can)
 * Agents may run it without asking. It is how a test gets its data from the running system, never from the store's
 * source code. A case whose amount no cart can make cannot be tested as written: a person fixes the case.
 */
const base = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`;
const res = await fetch(`${base}/api/products`).catch(() => null);
if (!res?.ok) {
  console.log(`The store did not answer at ${base}. Start it in terminal 1: npm run dev`);
  process.exit(1);
}
const products = await res.json();
const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;
const arg = process.argv[2];

if (!arg) {
  console.log(`Live catalog from ${base}/api/products (${products.length} products). Prices in dollars and cents.\n`);
  console.log('sku          price      name');
  for (const p of products) console.log(`${p.sku.padEnd(12)} ${dollars(p.priceCents).padStart(9)}  ${p.name}`);
  console.log('\nTest ids follow the sku: catalog-<sku>-add-button, cart-<sku>-qty, cart-<sku>-increase-button (see .cydeo/contract.md).');
  console.log('Need an exact subtotal? npm run catalog -- 100.00');
  process.exit(0);
}

const target = Math.round(Number(String(arg).replace(/[$,]/g, '')) * 100);
if (!Number.isFinite(target) || target <= 0) {
  console.log(`Give an amount in dollars, like: npm run catalog -- 100.00   (got "${arg}")`);
  process.exit(2);
}
// Every subtotal a cart can reach (CART-1: up to 10 of each product), keeping the cart with the fewest items.
const MAX_QTY = 10;
let reach = new Map([[0, []]]);
for (const p of products) {
  const next = new Map(reach);
  for (const [total, cart] of reach) {
    for (let q = 1; q <= MAX_QTY; q++) {
      const t = total + q * p.priceCents;
      if (t > target + 5000) break;
      const candidate = [...cart, [p.sku, q, p.priceCents]];
      const items = (c) => c.reduce((n, [, k]) => n + k, 0);
      if (!next.has(t) || items(candidate) < items(next.get(t))) next.set(t, candidate);
    }
  }
  reach = next;
}
const show = (cart) => cart.map(([sku, q, cents]) => `${q} × ${sku} (${dollars(cents)})`).join(' + ');
if (reach.has(target)) {
  console.log(`${show(reach.get(target))} = ${dollars(target)}`);
  process.exit(0);
}
const near = [...reach.keys()].filter((t) => t > 0).sort((a, b) => Math.abs(a - target) - Math.abs(b - target)).slice(0, 3);
console.log(`No cart makes exactly ${dollars(target)} from this catalog (up to ${MAX_QTY} of each product).`);
console.log('A case that needs this amount cannot be tested as written. A person fixes the case; nobody tests a different cart against its expected values.');
console.log(`Nearest: ${near.map((t) => `${dollars(t)} = ${show(reach.get(t))}`).join('  |  ')}`);
process.exit(1);
