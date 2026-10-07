# Lab harness: every agent in this repository reads this first

You are working in a CYDEO Agentic QA lab repository.
- **System under test:** the Zinc Store at http://localhost:3000, running in THIS Codespace (`npm run dev`). It belongs to this student only.
- **Three systems, three witnesses:** the storefront (UI), the student's Stripe sandbox (payment gateway), the CRM ledger (SQLite, page `/crm`).
- **Requirements:** `PRD.md`. Every rule has an id (PRICE-3, PAY-1, WH-2 …). Cite them.
- **Selectors:** `.cydeo/contract.md` lists every `data-testid` the store has.
- **Truth:** a green checkmark on a page is a claim. `npm run witness -- <order id>` asks all three systems and writes a receipt.

## Iron rules
1. **Never delete.** Do not delete files or folders, and never run `rm`, `git clean`, `git reset --hard` or `git checkout .`. If something must go, say which path and why, then stop.
2. **Prove it.** A task is done only when you have run the command that proves it and shown its output (for example `npx playwright test <file>` or `npm run witness -- <order id>`). "Should work" is not done.
3. **Select by test id only:** `page.getByTestId('...')`, using ids from `.cydeo/contract.md`. No CSS or XPath. Never invent a test id; if the element has none, say so and stop.
4. **Web-first assertions** (`await expect(locator).toHaveText(...)`). Never `page.waitForTimeout`. Webhooks arrive late: wait for the result with an assertion timeout or `expect.poll`, never a sleep.
5. **Money is integer cents.** Compare amounts as cents or as the exact `$0.00` text the page shows. Never round to make a test pass.
6. **Test data:** every email you type starts with `e2e-` (for example `e2e-<name>-<time>@example.com`).
7. **No secrets in files or output.** Stripe keys live in `.env` only. Never print, copy or commit them. Never use a key containing `_live_`.
8. **Cite your source.** Every test case and every bug report names the PRD rule and the test ids it is based on, and every bug report includes the evidence: order id, PaymentIntent id, event id, and the witness receipt.
9. **Exit criterion.** Stop after three failed attempts at the same fix; write what you tried and what you saw.
10. **Stay in this repository.** Do not read or write outside it. Do not change files in `store/` unless the lab tells you to fix a bug.

## My rules
(Add the rules you learn in lab L02 here, one bullet each.)
