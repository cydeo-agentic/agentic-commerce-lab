// Server-side pricing: the amount that is actually charged. Integer cents only (PRD PRICE-1..PRICE-5).
import { bySku } from './catalog.mjs';

// The store's business rules. GET /api/rules serves this object: it is the live source of truth.
export const RULES = {
  currency: 'usd',
  couponCode: 'AGENT10',
  couponPercent: 10,
  freeShippingThresholdCents: 10000,
  shippingCents: 799,
  taxRatePercent: 6,
  maxQtyPerLine: 10,
};

// Percent of an integer amount, rounded half up, in integer math (no floating-point cents).
export const percentOf = (amountCents, percent) => Math.floor((amountCents * percent + 50) / 100);

export function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return 'Your cart is empty.';
  for (const line of lines) {
    if (!bySku.has(line?.sku)) return `Unknown product: ${line?.sku}`;
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > RULES.maxQtyPerLine) {
      return `Quantity for ${line.sku} must be 1 to ${RULES.maxQtyPerLine}.`;
    }
  }
  return null;
}

export function priceCart(lines, coupon) {
  const items = lines.map(({ sku, qty }) => {
    const p = bySku.get(sku);
    return { sku, name: p.name, unitCents: p.priceCents, qty, lineCents: p.priceCents * qty };
  });
  const subtotalCents = items.reduce((sum, i) => sum + i.lineCents, 0);
  const couponApplied = typeof coupon === 'string' && coupon.trim().toUpperCase() === RULES.couponCode;
  const discountCents = couponApplied ? percentOf(subtotalCents, RULES.couponPercent) : 0;
  const discountedCents = subtotalCents - discountCents;
  const shippingCents = discountedCents > RULES.freeShippingThresholdCents ? 0 : RULES.shippingCents;
  const taxCents = percentOf(discountedCents, RULES.taxRatePercent);
  const totalCents = discountedCents + shippingCents + taxCents;
  return { items, couponApplied, subtotalCents, discountCents, shippingCents, taxCents, totalCents };
}

export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
