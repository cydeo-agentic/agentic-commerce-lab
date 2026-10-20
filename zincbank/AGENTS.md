# ZincBank automation: every agent working in zincbank/ reads this first

These rules replace the Zinc Store rules in the repository root for everything inside `zincbank/`.

- **System under test:** the ZincBank lab build at https://zincbank-lab.vercel.app (yellow banner "BUILD 101"). It is shared by the whole class. It is NOT the Zinc Store and it does NOT run in this Codespace.
- **What you automate:** the approved manual cases in `cases/<area>.json`. One Playwright test per case.
- **Selectors:** `.cydeo/contract.md` is the only list of test ids. If a case needs an element that is not in it, say so and stop.
- **Fixtures:** `fixtures.ts`. Import `test`, `expect` and helpers from `'../fixtures'` only.

## Iron rules
1. **Never delete.** Never run `rm`, `git clean`, `git reset --hard` or `git checkout .`, and never delete a file, including files you made.
2. **Write only `tests/<area>.spec.ts`** (and `defects/<area>.md` for defects). Never edit cases, the contract, fixtures, configs or scripts.
3. **One test per case.** The test title starts with the case id, then the case title: `test('ZB-XFER-01 $2.50 checking to savings …', …)`.
4. **Never change an expected value.** Copy every `expected[].value` from the case exactly (em dashes —, `$`, trailing periods). The gate refuses a spec whose expected values differ from the case.
5. **Select by test id only:** `page.getByTestId('<id>')` with the id written as a literal. For repeated rows: `page.getByTestId('<container>').locator('[data-testid^="<prefix>-"]').filter({ hasText: '…' })`. No CSS, XPath, getByRole or getByText.
6. **Web-first assertions:** `await expect(locator).toHaveText(...)`. Never `page.waitForTimeout`.
7. **Beware the stale page.** If the expected state looks the same as the page BEFORE your action (for example "1 row" before and after a filter), an assertion can pass on the old page. Move the page to a different state first (for example an empty date range), then do the real action.
8. **Each test makes its own customer.** Use the `customer` fixture (new, signed in, $0.00 checking + savings). Use `newCustomer(...)` for a second person and `fund(customer, cents)` only when the case says money is in the account. Never sign in as anyone else. Never call `/api/admin/*`.
9. **Money:** inputs take dollar strings (`'2.50'`); `fund` and the API take integer cents (`250`). Pages show `$1,234.56`.
10. **Prove it:** run exactly `npm run zb:spec -- <area>` (no pipes, no `cd`, no extra flags). Done means the gate passed and you saw the results.
11. **Red is not always your fault.** When a test fails because the page showed a different value or state than the case expects, and your steps match the case, that is a **product defect**: leave the test as it is and add it to `defects/<area>.md` (case id, expected, actual, one line each). Fix only test problems: a wrong step, a missing wait, a wrong locator.
12. **Do every step of the case, in order.** Do not skip a step (for example a Continue click) because a later check seems to cover it.
13. **`newCustomer` registers its email.** For sign-up cases that type an email into the application form, use the helper `uniqueEmail('apply')` instead.
14. **Stop after 3 runs** of `npm run zb:spec -- <area>`. Then write what is still red and why.
