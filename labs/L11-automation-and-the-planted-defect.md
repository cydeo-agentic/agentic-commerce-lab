# L11 · Automation and the planted defect: four more agents

> Yesterday your agents wrote test cases and you approved them. Today four more agents turn three of those cases into Playwright specs and run them. They decide whether each red test is the product's fault or the test's, file the product bug in ZincTM with its evidence, and repair a broken locator without hiding the bug. A script, not an agent, checks that no test was made green by weakening it.

**Before class:** `npm run update`, then `npm run connect` (every line PASS or WARN). You need yesterday's output: `pipeline/approvals.json` and `pipeline/published.json`.
**Proof:** `npm run check:lab -- L11`
**Fell behind?** No L10 run yet: `npm run catchup -- L10`, then L10 steps 4 and 5 (review and publish, about 10 minutes), because today's defect links to your case in ZincTM. Stuck at a step today: `npm run catchup -- L11` gives the dry run's three specs. Rename each to one of your approved cases with the same rule, and copy the values from your case: `npm run heal:check` holds you to them.

Three terminals today:
- **Terminal 1:** `npm run dev` (leave it running).
- **Terminal 2:** the agent, `cydeo --qa --approval-mode auto-edit`.
- **Terminal 3:** you. The commands only a person runs: `npm run review`, `npm run drill`, `npm run heal:check`.

## 0. Meet four more agents (5 min)
Open `.qwen/agents/`. Four new files:

| Agent | Model | Tools that can change something | It produces |
|---|---|---|---|
| automation-engineer | anthropic/claude-haiku-4.5 | `write_file`, `edit`, `run_shell_command`, `tm_link_script` | specs in `tests/lab/L11/`, each linked to its case in ZincTM |
| failure-investigator | z-ai/glm-5.2 | **none** | its verdicts; the main session saves them as `pipeline/investigation.json` |
| defect-reporter | openai/gpt-oss-120b | `tm_file_defect`, nothing else | a defect in ZincTM |
| test-healer | qwen/qwen3-235b-a22b-2507 | `edit`, `run_shell_command` | a repaired locator |

Two design choices to notice:
- **The judge cannot touch the evidence.** The investigator's tools only read: it cannot edit a test, write a file or run anything. The runtime enforces this, not its instructions.
- **Agents may run a few lab scripts without asking** (`npm run spec`, `heal:check`, `trace`, `rtm`, `cost`, `check:lab`). Only `npm run spec` runs code an agent wrote, so it first refuses any spec that imports anything but `@playwright/test` or touches `process`, `require` or `eval`. Every other shell command still asks you. At work, a CI runner or a container does this job.
- **The allow list is per session, not per agent.** `tm_link_script` and `tm_file_defect` run without asking for any agent in the session, the main one included. The agent files say who should use them; `npm run check:lab -- L11` proves from the recordings who did.

## 1. Look before you automate (10 min)
Your cases were written yesterday without anyone looking at the screen. Open your store (the forwarded port of terminal 1). Put exactly $100.00 in the cart, then try AGENT10 on another cart. Write down exactly how the cart shows free shipping, a discount and the coupon message.

Then check your test data. For each pricing case, ask the store for a cart that makes its subtotal:
```bash
npm run catalog -- 100.00
```
It prints `4 × stand ($25.00) = $100.00`. Try your other amounts. Some cannot be made at all: no cart from this catalog adds up to $99.99 or $111.11. A case built on an amount nobody can buy cannot be tested as written. Change its amount to one the catalog can make, and recompute every value from the PRD.

Now read the expected results of your approved cases. A case that guesses a display format, such as `'$0.00'` where the store shows `Free`, will fail for the wrong reason.
- **A format the PRD does not define** (how "free" is written, a minus sign, a message the PRD never quotes): fix the case now in `pipeline/cases.json`, then run `npm run review` in terminal 3. It asks only about the cases you changed.
- **An amount the PRD defines:** never change it to match the screen. If the screen disagrees with the PRD, that is what today is for.

## 2. Automate three cases (25 min)
**Predict first:** which of your approved cases will go red, and why?
```
Use the automation-engineer agent now. Do not read or run anything yourself: it does. Let it pick three approved cases itself, write the specs and run them. Do not edit its files.
```
Its team rule PAY-1 (read it in its agent file): a pricing case is proven only when the shopper pays what they were shown. So every pricing spec ends with a payment, and checks that the order total equals the total the checkout page showed. `npm run heal:check` fails any pricing spec that skips it.

Then prove what it did, without trusting its words:
```bash
npm run trace
```
Find `subagent : automation-engineer`: `write_file` once per spec, `run_shell_command` with `npm run spec`, and `tm_link_script` once per case.

Open `artifacts/L11/failures.md`. Every failure has a **Kind**:
- **assertion:** the test found the element and the value was wrong.
- **locator:** the test never found the element it asked for.

The trace, screenshot and page snapshot of every failure are kept in `artifacts/L11/evidence/`, where the next run cannot overwrite them.
Dry run (Oct 14): three specs written and run in 95 s, $0.28. Two of the three went red for the wrong reason: the cases guessed how the store shows free shipping and a discount. That is why step 1 exists.

## 3. Product bug or test bug? (15 min)
```
Use the failure-investigator agent now. Do not read or run anything yourself. Save the JSON it returns, exactly as returned, to pipeline/investigation.json.
```
Read each verdict and its reason. Who fixes what:
- **A wrong locator:** the test-healer, in step 5.
- **A wrong case:** you. In our dry run, TC-04 expected shipping `'$0.00'`. The store shows `Free`, and the PRD says shipping is free without promising `$0.00`. The case held an assumption, so the test was wrong, not the store.
  1. Fix the case's `expected` in `pipeline/cases.json` yourself.
  2. Run `npm run review` in terminal 3. It asks only about cases that changed since you approved them.
  3. Then ask the agent:
```
Use the automation-engineer agent now to bring the spec of each case I changed in line with the case as I approved it, and run the specs. Do not read or run anything yourself.
```
The agent may change an expected value only after you change the case and approve it again. That is the human gate, working for a second time.
- **A product bug:** the value is wrong and the case is right by the PRD. Go to step 4.

In our dry run, the fixed TC-04 went red further down. The cart showed `$106.00`, but the order page said `$113.99`. That is a planted bug.
Dry run: each investigation took 43–55 s and cost $0.03. Each re-sync of the automation agent after a case fix cost $0.72–1.23, so fix formats in step 1.

## 4. File the defect (10 min)
```
Use the defect-reporter agent now to file the product bugs. Do not read or run anything yourself. Save the JSON it returns, exactly as returned, to pipeline/defects.json.
```
Open ZincTM, then Defects. Read your defect as the developer who must fix it. Check that it has:
- steps;
- expected vs actual, with the amounts;
- the rule it breaks;
- who loses what;
- the trace and screenshot paths.

Open the case in ZincTM: its automation now points at your spec.
Dry run: one defect filed in 84 s, $0.03.

## 5. Heal the locator, never the assertion (20 min)
A locator breaks when a test id changes. Simulate one in terminal 3:
```bash
npm run drill
npm run spec
```
**Predict first:** which test goes red, and will its error show an expected and a received value? Then, in terminal 2:
```
Use the failure-investigator agent again. Do not read or run anything yourself. Save the JSON it returns, exactly as returned, to pipeline/investigation.json.
```
```
Use the test-healer agent now to heal the tests that fail for a test reason. Do not read or run anything yourself.
```
Then the gate, in terminal 3:
```bash
npm run heal:check
```
It passes only when all of these hold:
- nothing is skipped, focused, retried or waiting a fixed time;
- every amount a test asserts comes from its approved case;
- every assertion is exactly as it was before the drill.

Your planted-bug test is still red. That is correct: a red test that tells the truth beats a green one that lies.
Dry run: the healer fixed the locator in 46 s for less than one cent, and `heal:check` passed.

**Stretch:** commit first (`git add tests/lab/L11 && git commit -qm "L11 specs"`). Then ask `Use the test-healer agent to make every test green.` Watch what it does, then run `npm run heal:check` and `git diff`. Whatever the agent did, the gate decides. Restore with `git checkout -- tests/lab/L11`.

## 6. Price it, prove it (10 min)
Leave the agent with `/quit` first: a session's usage is recorded only when it ends.
```bash
npm run cost -- L11
npm run check:lab -- L11
```
`npm run cost -- L11` prices only the sessions that ran an L11 agent. It shows agent minutes and the same cost in Copilot credits. You need both numbers for the Monday page.
Dry run, whole lab: $2.40 at list price. $1.96 of it was two re-syncs after case fixes; without them it was $0.44.

## Without AI (class block)
Run `npm run report`, open the red test, then **Trace**. Use the trace alone: the actions, the page before and after each one, and the network calls. Decide whether it is a product bug or a test bug, and say which network response proves it. Hint: compare the total the checkout page sent with the amount on the order.

## Monday page
Fill in [Review and cost](monday/L11-review-and-cost.md) for your team.

## Interview answer
*"Tell me about a defect you found, and what finding it cost."* Model answer (STAR):
- **Situation:** "Our store promises free shipping at $100.00."
- **Task:** "I had to automate the boundary case and prove it end to end."
- **Action:** "An agent wrote the spec from the approved case. I added a team rule: a pricing case isn't proven until the customer pays. The first red was our case's fault, because it expected '$0.00' where the store shows 'Free'. I fixed the case, re-approved it, and the spec went red again at the order total."
- **Result:** "The cart showed $106.00 and the customer was charged $113.99. A second agent confirmed it against the rule, a third filed it in our test-management tool with the trace and the screenshot, and a gate proved no test was weakened. The agents cost about [your number] at list price."

## If something breaks
| You see | Do this |
|---|---|
| `Agent ... requires user approval` or `Permission denied for tm_link_script` | `npm run update`, then restart `cydeo`: settings load only at start |
| `npm run spec` says "Refused to run" | A spec imports something or touches the machine. Ask the automation-engineer to remove those lines |
| The agent asks to run `npx playwright test ...`, `ls` or another command | Say No. Saying No ends the agent's turn, so ask again with the same prompt. It ends in "Do not read or run anything yourself" for this reason |
| Every test passes | Check that your pricing specs pay and check `order-total` (team rule PAY-1). Ask the automation-engineer to follow its rule |
| A test times out at the order page | The store must be running in terminal 1 (`npm run dev`) |
| `heal:check` fails on a value you changed in a case | Approve the change first: `npm run review` |
| `npm run cost -- L11` says no sessions | Leave the agent with `/quit`, then run it again |
