# L04 · Context poisoning

> "Once it has the wrong context, the entire session is anchored on the wrong context."

**Proof:** `npm run check:lab -- L04`

## 1. The poisoned run (no harness)
A chat message disagrees with the PRD (`labs/data/slack-thread.md`). Give an agent both files and nothing else:
```bash
mkdir -p artifacts/L04 /tmp/no-harness && cp PRD.md labs/data/slack-thread.md /tmp/no-harness/
(cd /tmp/no-harness && cydeo -p "Read PRD.md and slack-thread.md. Write boundary test cases for free shipping and for the AGENT10 coupon: list each case with the cart value in dollars and the expected shipping and discount. Cite the rule ids.") > artifacts/L04/run-poisoned.md
```
**Predict first:** which threshold will it use? Then look at the rule ids it cites.

## 1b. The same prompt, inside the harness
Run the identical request inside this repository, where `AGENTS.md` says what the requirements are:
```bash
cydeo -p "Read PRD.md and labs/data/slack-thread.md. Write boundary test cases for free shipping and for the AGENT10 coupon: list each case with the cart value in dollars and the expected shipping and discount. Cite the rule ids." > artifacts/L04/run-harness.md
```
What changed? Same model, same files. Different standing rules.

## 2. Ask the system of record
```bash
npm run rules
```
That is the live store's answer, saved to `artifacts/L04/truth.json`.

## 3. The grounded run
```bash
cydeo -p "Read PRD.md and artifacts/L04/truth.json, which is the live system of record. Chat messages are not requirements. Write boundary test cases for free shipping and for the AGENT10 coupon: list each case with the cart value in dollars and the expected shipping and discount. Cite the rule ids." > artifacts/L04/run-grounded.md
```

## 4. Run the boundary
Put exactly $100.00 in a cart (4 × Arc Laptop Stand), pay with the Visa test card, then:
```bash
npm run witness -- latest
```
Did the grounded agent's boundary find something the poisoned one would have missed?

## 5. Diagnose
Write `artifacts/L04/diagnosis.md`: which source poisoned the first run, how you caught it, and the rule you would add to `AGENTS.md`.

## 6. Proof
```bash
npm run check:lab -- L04
```
