---
name: witness-an-order
description: Check whether a Zinc Store order is really correct by asking all three witnesses (the store page, Stripe and the CRM ledger). Use when someone asks if an order, a purchase, a payment or a checkout "worked", "is correct", "went through" or "can be trusted".
---

# Witness an order

A green page is a claim. An order is correct only when the store page, Stripe and the ledger agree.

## Steps
1. Find the order id the user asked about. If they gave none, ask which order; do not guess "latest".
2. Find its witness receipt: `artifacts/witness/<order id>.json`. The witness writes it:
   ```bash
   npm run witness -- <order id>
   ```
   If there is no receipt for that order and you cannot run that command yourself, stop and ask the user to run it. Never judge from the page alone, from an older receipt, or from memory.
3. Read the receipt by its exact path with your file-read tool. `artifacts/` is git-ignored, so directory listings and file searches hide it: an empty listing does NOT mean there is no receipt.
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
