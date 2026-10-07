# L01 · Prediction vs truth

> "A large language model is a giant prediction machine. Prediction is not equal to truth."

**Proof:** `npm run check:lab -- L01`

## 1. The blind run (the agent guesses)
In terminal 2, run the agent in an empty folder so it cannot see this repository:
```bash
mkdir -p artifacts/L01 /tmp/blind
(cd /tmp/blind && cydeo -p "An online store runs at http://localhost:3000. Do not open a browser or any file. From experience only, predict the data-testid of: the checkout name input, the email input, the Pay button, the error message after a declined card, and the status text on the order confirmation page. Answer as a short markdown list with each id in backticks.") > artifacts/L01/prediction.md
cat artifacts/L01/prediction.md
```
**Predict first:** how many of its ids will be real? Then compare with `.cydeo/contract.md`.

## 2. The grounded run (the agent cites the contract)
Start the agent in QA mode. It loads `.cydeo/contract.md` and a real browser automatically:
```bash
cydeo --qa
```
Paste:
```
Read PRD.md and .cydeo/contract.md. Write artifacts/L01/test-ideas.md with 3 test ideas for checkout.
Each idea is a section "## Idea N: <title>" that names the PRD rule id and the exact test ids it would use, in backticks.
Then write and run a Playwright spec that buys one Dock 8-in-1 USB-C Hub with the Visa test card as e2e-<my name>@example.com.
```

## 3. Your first purchase, witnessed
The agent says it worked. That is a claim. Ask the three systems:
```bash
npm run witness -- latest
```
UI, Stripe and the ledger must agree: verdict **PASS**. Open the Back office in your store (`/crm`) and find the same order and its webhook event.

## 4. Proof
```bash
npm run check:lab -- L01
```
