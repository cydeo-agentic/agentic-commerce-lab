# Team context: Zinc Store
_Written by the context-researcher agent on October 13, 2026. Sources are listed at the end._

## What the product does
- Shoppers browse the catalog, fill a cart, and proceed to checkout to provide payment details.
- Payments are processed via **Stripe**.
- Upon success, the store's backend receives a **webhook** from Stripe.
- The **CRM ledger** updates the order status to `PAID` and promotes the customer from `LEAD` to `ACTIVE_CUSTOMER` only after this webhook validation.
- Confirmation is only displayed when the CRM ledger reflects the `PAID` status.

## Rules that matter most
- **PRICE-1** Subtotal = sum of unit price × quantity.
- **PRICE-2** `AGENT10` coupon provides 10% discount (rounded half up). Case-insensitive.
- **PRICE-3** Shipping is free if subtotal (post-discount) $\ge$ $100.00; otherwise $7.99.
- **PRICE-4** Tax is 6% of subtotal (post-discount), not on shipping (rounded half up).
- **PAY-1** Charged amount must match the UI total; otherwise store rejects with "Your total changed."
- **ORD-2** Order status must transition from `PENDING` to `PAID` upon `payment_intent.succeeded`.
- **WH-1** Stripe webhooks must have valid signatures; all others are rejected with HTTP 400.
- **WH-2** Idempotency: Events applied at most once.

## Test data and test ids
- **Test Emails:** Must start with `e2e-` (e.g., `e2e-buyer-20261013@example.com`).
- **Checkout Options:** Use defined Stripe test PaymentMethods for automated browser flows as outlined in `PRD.md`.
- **Test Selectors:** All interactions must use `data-testid` values listed in `.cydeo/contract.md`.

## Known bugs and risks
- **Defect ZTM-5:** Stripe webhooks are currently failing to deliver to the store automatically, leaving orders stuck in `PENDING` despite successful Stripe payment. Manual replaying of events fixes this, suggesting a pipeline delivery issue, not a handler logic issue.
- **Riskiest Rules to Test:**
    1. **WH-1/WH-2 (Webhooks):** Critical for synchronization. The current pipeline failure makes this the highest risk area.
    2. **PRICE-2/3/4 (Pricing Math):** High risk due to rounding and conditional logic (free shipping threshold).
    3. **PAY-1 (Total Mismatch):** Crucial security/integrity check between UI-calculated total and server-side verification.

## What ZincTM already holds
- **Test Cases:** Numerous cases exist, but the vast majority relate to "ZincBank." Only one test case is currently tagged for the Zinc Store (`webhook endpoint rejects unsigned Stripe events`).
- **Defects:** One active defect (ZTM-5) identified for the Zinc Store.

## Open questions
- "Orders never confirm automatically in the running system: Stripe reports payment_intent.succeeded but the CRM ledger order stays PENDING indefinitely" (ZTM-5). This confirms that automatic end-to-end flow testing is currently blocked by pipeline issues.

## Sources
- `PRD.md`
- `AGENTS.md`
- `.cydeo/contract.md`
- ZincTM: `tm_whoami`
- ZincTM: `tm_list_test_cases`
- ZincTM: `tm_list_defects`
