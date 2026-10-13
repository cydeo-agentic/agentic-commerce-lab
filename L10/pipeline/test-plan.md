# Test plan: Zinc Store

## Scope

In scope:
- End-to-end storefront flows: catalog → cart → checkout → confirmation.
- Cart quantity limits (CART-1) and cart persistence after declined payment (CART-2).
- Pricing, coupon, shipping, tax, and total calculations (PRICE-1 through PRICE-5).
- Checkout payment behavior: amount match, declines, duplicate Pay clicks (PAY-1 through PAY-3).
- Order lifecycle and CRM customer lifecycle (ORD-1 through ORD-5, CRM-1 through CRM-4).
- Webhook acceptance rules: signature validation and idempotency (WH-1, WH-2).

Out of scope:
- Performance, load, visual regression, accessibility, and mobile-specific layouts.
- Stripe SDK internals or third-party payment-element UI automation.
- CI pipeline setup, deployment, or non-Store subsystems (e.g., ZincBank).

## Approach

- **Boundary values** for amounts and thresholds: cart quantity edges (1, 10, 0, 11) and free-shipping threshold just below/at/above $100.00.
- **Decision tables / equivalence classes** for coupons (valid AGENT10 variants, invalid codes, no code) and shipping (free vs. $7.99).
- **State-transition testing** for orders (PENDING → PAID / PAYMENT_FAILED / REFUNDED) and customers (LEAD → ACTIVE_CUSTOMER → REFUNDED).
- **Negative tests** for declined cards and reasons, signature-less or invalid webhooks, duplicate events, and total-mismatch rejection.
- Use only `data-testid` selectors from `.cydeo/contract.md`; wait for webhook-driven CRM updates with web-first assertions / `expect.poll` rather than sleeps.

## Traceability

| Rule | What we will check | Planned cases |
|---|---|---|
| CART-1 | Quantity allowed values are 1 through 10 | 4 cases: qty 1, 10, attempt 0, attempt 11 |
| CART-2 | Cart contents survive a declined payment | 1 case: add items, decline, return to cart |
| PRICE-1 | Subtotal equals Σ unit price × quantity | 3 cases: single qty, multi-qty, multiple SKUs |
| PRICE-2 | `AGENT10` gives 10% off, case-insensitive; invalid codes rejected | 5 cases: lowercase, uppercase, mixed, no code, bad code |
| PRICE-3 | Free shipping when discounted subtotal ≥ $100.00, else $7.99 | 3 cases: $99.99, $100.00, $0 |
| PRICE-4 | Tax is 6% of discounted subtotal only, rounded half-up | 3 cases: below threshold, at threshold, fractional cent |
| PRICE-5 | Total = subtotal − discount + shipping + tax | 2 cases: standard cart, discounted cart |
| PAY-1 | Charge rejected when server total differs from UI total | 2 cases: unchanged total, tampered total |
| PAY-2 | Declined cards show the matching decline reason | 3 cases: generic decline, insufficient funds, expired |
| PAY-3 | Repeated Pay click creates exactly one order and one charge | 2 cases: double-click, refresh/resubmit |
| ORD-1 | Checkout creates order in PENDING status | 1 case: create order and verify via CRM/API |
| ORD-2 | PENDING becomes PAID on `payment_intent.succeeded` | 2 cases: success flow, witness ledger update |
| ORD-3 | PENDING becomes PAYMENT_FAILED on `payment_intent.payment_failed` | 1 case: decline flow |
| ORD-4 | PAID becomes REFUNDED on `charge.refunded`; never returns to PAID | 2 cases: refund via CRM, retry PAID webhook |
| ORD-5 | Confirmation page shows ledger status and charged total | 3 cases: PENDING, PAID, PAYMENT_FAILED |
| CRM-1 | New email creates a customer with status LEAD | 1 case: first checkout with unique e2e email |
| CRM-2 | First PAID order promotes LEAD to ACTIVE_CUSTOMER; failed payment does not | 2 cases: success, decline |
| CRM-3 | Total spent = sum of PAID orders minus refunds | 2 cases: two paid orders, one refunded order |
| CRM-4 | Customer becomes REFUNDED when all paid orders are refunded | 1 case: refund sole paid order |
| WH-1 | Endpoint rejects unsigned/invalid Stripe signatures with HTTP 400 | 2 cases: missing signature, wrong signature |
| WH-2 | Same Stripe event is applied at most once | 1 case: replay same event twice, assert one update |

## Risks

1. **Webhook delivery pipeline (ZTM-5):** Stripe events are not reaching the store automatically, so end-to-end ORD-2/CRM-2 tests may stay blocked unless events are replayed manually.
2. **Rounding and threshold math (PRICE-2 / PRICE-3 / PRICE-4):** Half-up rounding on discounts/tax and the exact $100.00 free-shipping boundary are prone to one-cent errors.
3. **Payment total integrity (PAY-1):** Any mismatch between UI-computed total and server verification can cause false declines or allow incorrect charges.

## Questions for the team

- For the PRICE-3 free-shipping threshold, does the comparison use the displayed discounted subtotal rounded half-up, or the exact unrounded value before rounding?
- Can a customer in REFUNDED status become ACTIVE_CUSTOMER again after a later successful order, or is REFUNDED terminal?
- If a `charge.refunded` event is followed by a delayed `payment_intent.succeeded` for the same order, should the order remain REFUNDED or transition according to the latest event?
- What is the expected confirmation-page timeout behavior when the ledger stays PENDING because a webhook did not arrive?
