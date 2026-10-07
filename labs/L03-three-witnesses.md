# L03 · Three witnesses

> "AI-generated work is guilty until proven innocent."

A checkout touches three systems: the **UI** (what the shopper saw), **Stripe** (what the gateway did), the **ledger** (what the CRM recorded). When they disagree, somebody loses money or trust. The Zinc Store has bugs on purpose. Find one, prove it, report it.

**Proof:** `npm run check:lab -- L03`

## 1. Hunt
Read the Pricing, Payment and CRM rules in `PRD.md`. Plan at least 3 purchases most likely to make the three systems disagree. Hints:
- money rules have edges (rounding, a threshold);
- a failed payment has side effects (look at the customer, not only the order).

Buy through the store in your browser, or ask the agent in `cydeo --qa` to run a purchase you describe.

## 2. Witness every purchase
```bash
npm run witness -- latest        # or: npm run witness -- ord_xxxxxxxxxxxx
```
PASS means all three agree. FAIL names the PRD rule that broke and shows what each system said. Every run writes a receipt to `artifacts/witness/`.

## 3. Report the defect
Write `artifacts/L03/defect.md`. The agent may draft it, but every id must come from the receipt (the check verifies them against what Stripe really sent):
```
# <one-line title: what is wrong, where>
PRD rule: <e.g. PAY-1>
Steps: 1. … 2. … 3. …
Expected: <what the rule says>
Actual: <what each witness said>
Evidence:
- Order: ord_…
- Stripe PaymentIntent: pi_…
- Stripe event: evt_…
- Witness receipt: artifacts/witness/ord_….json
Severity: <who loses what>
```

## 4. Proof
```bash
npm run check:lab -- L03
```
**Interview close:** "How do you test a payment flow?" Answer with *this* defect.
