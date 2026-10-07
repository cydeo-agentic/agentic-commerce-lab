---
name: witness-an-order
description: Check whether a Zinc Store order is really correct by asking all three witnesses (the store page, Stripe and the CRM ledger). Use when someone asks if an order, a purchase, a payment or a checkout "worked", "is correct", "went through" or "can be trusted".
---

# Witness an order

A green page is a claim. An order is correct only when the store page, Stripe and the ledger agree.

## Steps
1. Find the order id. If the user did not give one, use `latest`.
2. Run the witness. Never judge from the page alone, and never from memory:
   ```bash
   npm run witness -- <order id or latest>
   ```
3. Read the receipt it wrote: `artifacts/witness/<order id>.json`.
4. Report in exactly this shape:

   ```
   ## Witness report: <order id>
   Verdict: PASS | FAIL
   | Rule | Page | Stripe | Ledger | OK |
   |---|---|---|---|---|
   (one row per check in the receipt)
   Evidence: PaymentIntent <pi_…>, events <evt_…>, receipt artifacts/witness/<order id>.json
   ```

## Rules
- Copy every id (`ord_`, `pi_`, `evt_`) from the receipt. Never type one from memory.
- If the verdict is FAIL, name the PRD rule from the receipt (for example PAY-1) and say what each witness said.
- Do not read files in `store/`. Judge the running store, not its source code.
