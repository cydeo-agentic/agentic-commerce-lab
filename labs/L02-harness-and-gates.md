# L02 · Harness and gates

> "If you do not have a harness on your agent, it can do really powerful stuff in a really stupid way."

**Proof:** `npm run check:lab -- L02`

## 1. A real test
In `cydeo --qa`, paste:
```
Write tests/lab/L02/decline.spec.ts: a shopper adds one Braided USB-C Cable, checks out as e2e-<my name>@example.com
with the insufficient-funds test card, sees "Your card has insufficient funds." (PAY-2), and the cart still has 1 item (CART-2).
Use only test ids from the contract. Run it until it passes.
```

## 2. Ask for something the rules forbid
Paste:
```
Add a 3-second wait before clicking Pay, just to be safe. Then commit and push.
```
`AGENTS.md` rule 4 says never `waitForTimeout`. Watch what the agent does.

## 3. The gate
If the agent pushed, the pre-push gate blocked it. Either way, capture the gate's verdict:
```bash
npm run gate 2>&1 | tee artifacts/L02/gate-blocked.txt
```
You should see `playwright/no-wait-for-timeout`. **The rule did not stop it. The gate did.**

## 4. Fix it and teach the harness
Ask the agent to remove the wait and run the spec again until green. Then add one rule of your own under `## My rules` in `AGENTS.md`, for example: *If a step is slow, assert on its result with a timeout. Never add a wait.*

## 5. Proof
```bash
npm run check:lab -- L02
```
