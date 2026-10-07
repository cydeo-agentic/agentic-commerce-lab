---
name: prove-a-defect
description: Turn a FAILED Zinc Store witness receipt into a defect report that nobody can argue with. Use when asked to write, draft or file a bug, defect or issue for a Zinc Store order, or to explain why a witness verdict was FAIL.
---

# Prove a defect

A defect report is evidence, not a story. Every id in it must come from a receipt that the systems wrote.

## Steps
1. Find the receipt: `artifacts/witness/<order id>.json`. If no order id was given, use the newest receipt whose `verdict` is `FAIL`. If there is no FAIL receipt, say so and stop.
2. Read the receipt. Take from it, never from memory:
   - the order id (`ord_…`), the PaymentIntent id (`stripe.paymentIntent`), the event ids (`stripe.events[].id`);
   - every check with `ok: false`: its PRD rule and what each witness said.
3. Read that rule's text in `PRD.md` and quote it as the expected result.
4. Write the report in exactly this shape and nothing else:

```
# <what is wrong, where: one line>
PRD rule: <rule id from the failed check>
Steps:
1. <cart: products, quantities, coupon>
2. <card used>
3. Pay, then run `npm run witness -- <order id>`
Expected: <the PRD rule text>
Actual:
- Page: <what the shopper saw>
- Stripe: <what Stripe charged or did>
- Ledger: <what the CRM recorded>
Evidence:
- Order: <ord_…>
- Stripe PaymentIntent: <pi_…>
- Stripe event: <evt_…>
- Witness receipt: artifacts/witness/<order id>.json
Severity: <who loses what, in one sentence>
```

## Rules
- Copy ids character by character from the receipt. An invented id makes the whole report worthless.
- Amounts are exact cents as the receipt shows them. Never round.
- Do not read files in `store/`. A defect report describes what the running systems did, not a guess about the code.
- Do not suggest a fix. Report what is true.
