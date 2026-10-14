# L11 · Automation and the planted defect: four more agents

> Yesterday your agents wrote test cases and you approved them. Today four more agents turn three of those cases into Playwright specs and run them. They decide whether each red test is the product's fault or the test's, file the product bug in ZincTM with its evidence, and repair a broken locator without hiding the bug. A script, not an agent, checks that no test was made green by weakening it.

**Before class:** `npm run update`, then `npm run connect` (every line PASS or WARN). You need yesterday's output: `pipeline/approvals.json` and `pipeline/published.json`.
**Proof:** `npm run check:lab -- L11`
**Fell behind?** No L10 run yet: `npm run catchup -- L10`, then L10 steps 4 and 5 (review and publish, about 10 minutes), because today's defect links to your case in ZincTM. Stuck at a step today: `npm run catchup -- L11` puts reference specs next to yours.

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
| defect-reporter | google/gemini-3.1-flash-lite | `tm_file_defect`, nothing else | a defect in ZincTM |
| test-healer | qwen/qwen3-235b-a22b-2507 | `edit`, `run_shell_command` | a repaired locator |

Two design choices to notice:
- **The judge cannot touch the evidence.** The investigator's tools only read: it cannot edit a test, write a file or run anything. The runtime enforces this, not its instructions.
- **Agents may run a few lab scripts without asking** (`npm run spec`, `heal:check`, `trace`, `rtm`, `cost`, `check:lab`). Only `npm run spec` runs code an agent wrote, so it first refuses any spec that imports anything but `@playwright/test` or touches `process`, `require` or `eval`. Every other shell command still asks you. At work, a CI runner or a container does this job.
- **The allow list is per session, not per agent.** `tm_link_script` and `tm_file_defect` run without asking for any agent in the session, the main one included. The agent files say who should use them; `npm run check:lab -- L11` proves from the recordings who did.

## 1. Automate three cases (25 min)
**Predict first:** which of your approved cases will go red, and why?
```
Use the automation-engineer agent now, without reading anything first: it reads what it needs. Let it pick three approved cases itself, write the specs and run them. Do not edit its files.
```
Its team rule PAY-1 (read it in its agent file): a pricing case is proven only when the shopper pays what they were shown, so pricing specs end with a payment and check the order total.

Then prove what it did, without trusting its words:
```bash
npm run trace
```
Find `subagent : automation-engineer`: `write_file` once per spec, `run_shell_command` with `npm run spec`, and `tm_link_script` once per case.

Open `artifacts/L11/failures.md`. Every failure has a **Kind**:
- **assertion:** the test found the element and the value was wrong.
- **locator:** the test never found the element it asked for.

The trace, screenshot and page snapshot of every failure are kept in `artifacts/L11/evidence/`, where the next run cannot overwrite them.

## 2. Product bug or test bug? (15 min)
```
Use the failure-investigator agent. Save the JSON it returns, exactly as returned, to pipeline/investigation.json.
```
Read each verdict and its reason. Who fixes what:
- **A wrong locator:** the test-healer, in step 4.
- **A wrong case:** you. In our dry run, TC-04 expected shipping `'$0.00'`. The store shows `Free`, and the PRD says shipping is free without promising `$0.00`. The case held an assumption, so the test was wrong, not the store.
  1. Fix the case's `expected` in `pipeline/cases.json` yourself.
  2. Run `npm run review` in terminal 3. It asks only about cases that changed since you approved them.
  3. Then ask the agent:
```
Use the automation-engineer agent to bring the spec of each case I changed in line with the case as I approved it, and run the specs.
```
The agent may change an expected value only after you change the case and approve it again. That is the human gate, working for a second time.
- **A product bug:** the value is wrong and the case is right by the PRD. Go to step 3.

In our dry run, the fixed TC-04 went red further down. The cart showed `$106.00`, but the order page said `$113.99`. That is a planted bug.

## 3. File the defect (10 min)
```
Use the defect-reporter agent to file the product bugs. Save the JSON it returns, exactly as returned, to pipeline/defects.json.
```
Open ZincTM, then Defects. Read your defect as the developer who must fix it. Check that it has:
- steps;
- expected vs actual, with the amounts;
- the rule it breaks;
- who loses what;
- the trace and screenshot paths.

Open the case in ZincTM: its automation now points at your spec.

## 4. Heal the locator, never the assertion (20 min)
A locator breaks when a test id changes. Simulate one in terminal 3:
```bash
npm run drill
npm run spec
```
**Predict first:** which test goes red, and will its error show an expected and a received value? Then, in terminal 2:
```
Use the failure-investigator agent again. Save the JSON it returns, exactly as returned, to pipeline/investigation.json.
```
```
Use the test-healer agent to heal the tests that fail for a test reason.
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

**Stretch:** commit first (`git add tests/lab/L11 && git commit -qm "L11 specs"`). Then ask `Use the test-healer agent to make every test green.` Watch what it does, then run `npm run heal:check` and `git diff`. Whatever the agent did, the gate decides. Restore with `git checkout -- tests/lab/L11`.

## 5. Price it, prove it (10 min)
Leave the agent with `/quit` first: a session's usage is recorded only when it ends.
```bash
npm run cost -- L11
npm run check:lab -- L11
```
`npm run cost -- L11` prices only the sessions that ran an L11 agent. It shows agent minutes and the same cost in Copilot credits. You need both numbers for the Monday page.

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
| The agent asks to run `npx playwright test ...` | Say No. Tell it: "Run only npm run spec" |
| Every test passes | Check that your pricing specs pay and check `order-total` (team rule PAY-1). Ask the automation-engineer to follow its rule |
| A test times out at the order page | The store must be running in terminal 1 (`npm run dev`) |
| `heal:check` fails on a value you changed in a case | Approve the change first: `npm run review` |
| `npm run cost -- L11` says no sessions | Leave the agent with `/quit`, then run it again |
