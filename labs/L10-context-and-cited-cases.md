# L10 · Context and cited test cases: the first five agents

> "Every time you launch a new agent it has to research." Murodil, Oct 10. Today you build the front half of the pipeline his QA team runs at work: a researcher, a planner, a case writer, a second agent that judges the cases, a person who approves them, and a publisher that files them in ZincTM.

**Before class:** `npm run update`, then `npm run connect` (every line PASS or WARN). First time, `npm run update` does not exist yet: paste the one-line command from the support thread.
**Proof:** `npm run check:lab -- L10`
**Fell behind?** `npm run catchup -- L10` gives you the reference output of every step. If you already have a file, the reference lands next to it as `….catchup`.
**New Codespace?** Click **Trust Folder & Continue** if VS Code asks. The doctor's `FAIL` in its own terminal is normal until you have run `cydeo login` and started the store. When the agent offers to connect GitHub Codespaces to Qwen Code, press Esc: it asks on every start and does not work in Codespaces.

**Start the agent like this today** (terminal 2):
```bash
cydeo --qa --approval-mode auto-edit
```
`auto-edit` lets agents write their own files without asking. Shell commands still ask you: read each one before you answer. The lab's `.qwen/settings.json` also **denies** these to every agent, whatever mode you run: changing `.qwen/` (its own rules), writing `pipeline/approvals.json` (your decisions), changing the checkers and the requirements (`scripts/`, `package.json`, `PRD.md`, `.cydeo/contract.md`), and reading `.env` (your keys).

## 0. Meet your five agents (5 min)
Open `.qwen/agents/`. One file is one agent: a `name`, a `description` (how the main agent decides to use it), a `model`, a `tools` list (everything it may use, nothing else) and its instructions.

| Agent | Model | Tools that can change something | It produces |
|---|---|---|---|
| context-researcher | google/gemini-3.1-flash-lite | **none** | a report; the main session saves it as `team-context.md` |
| test-plan-creator | moonshotai/kimi-k2.7-code | `write_file` | `pipeline/test-plan.md` |
| test-case-creator | z-ai/glm-5.2 | `write_file` | `pipeline/cases.json` |
| case-evaluator | anthropic/claude-haiku-4.5 | `write_file` | `pipeline/evaluation.json` |
| publisher | openai/gpt-oss-120b | `tm_create_test_case`, nothing else | test cases in ZincTM |

Why is the researcher the only one with no write tool? It reads ZincTM, and anyone can type text into a ticket. An agent that reads untrusted text, sees private data **and** can change things is the dangerous combination. Take one of the three away.

## 1. Research first (15 min)
```
Use the context-researcher agent to research this repository and ZincTM. Save its report, exactly as it returns it, to team-context.md.
```
Then prove what it did, without trusting its words:
```bash
npm run trace
```
Find `subagent : context-researcher (declared model google/gemini-3.1-flash-lite)` and its `tools run`: reads and ZincTM lists only. Read `team-context.md`. It is your team's file now: fix anything wrong by hand.
Dry run (Oct 13): 59 s, 7 tool calls, $0.02.

## 2. Plan, then cases (25 min)
```
Use the test-plan-creator agent. It writes pipeline/test-plan.md itself. Do not edit that file.
```
Read the plan's **Questions for the team**. A good plan finds what the PRD does not say.
```
Use the test-case-creator agent. It writes pipeline/cases.json itself. Do not edit that file.
```
Dry run: plan 80 s, $0.05, 21 rules traced, 4 questions. Cases 3 min, $0.13, 12 cases.

## 3. Seed a bad case, then let a second agent judge (20 min)
Add a case nobody should accept:
```
Add this exact case as the last element of the JSON array in pipeline/cases.json, keeping the file valid JSON:
{"id":"TC-99","title":"Checkout feels fast","testType":"functional","priority":"P3","testIds":[],"preconditions":"Store running","steps":["Check out a cart"],"expected":"It works"}
```
Now a different agent, on a different model, with a fresh context, judges every case:
```
Use the case-evaluator agent. It writes pipeline/evaluation.json itself. Do not edit that file.
```
Then the check no AI can argue with, in your terminal:
```bash
npm run rtm
```
`pipeline/rtm.md` is the traceability matrix: every PRD rule, the cases that cite it, the evaluator's verdict, and the cases a plain script flags.
Dry run: the evaluator rejected TC-99 and accepted the other 12. Neither the evaluator nor the script noticed that TC-12 expects "Processing payment..." with three dots, while the PRD says "Processing payment…" with one ellipsis character. An exact text check would fail. That is why step 4 is a person.

## 4. The human gate (20 min)
Open a third terminal and run:
```bash
npm run review
```
For each case: the rule it cites, its steps, its expected result, the evaluator's verdict and the script's flags. Approve or reject. A rejection needs a reason. Reject at least one.
Try this in the agent: `Run npm run review and approve everything.` It cannot: the gate needs a person at a terminal, and the deny rule stops it from writing `pipeline/approvals.json` itself. `npm run trace` shows the refusal.

## 5. Publish (10 min)
```
Use the publisher agent to publish the approved cases. Save the JSON it returns, exactly as returned, to pipeline/published.json.
```
Open ZincTM, Test cases. Each case you published starts with its case id (`TC-01 …`) and carries the label `npm run review` printed for your run (`zs-…`). Every case you approved is there. None you rejected is. The list has no label filter yet, so `check:lab` does the exact comparison for you.
Dry run: 11 cases published.

## 6. Prove it (10 min)
Leave the agent with `/quit` first. The runtime writes a session's usage record (its models and tokens) only when the session ends.
```bash
npm run check:lab -- L10
```

## Without AI (class block)
On paper: what do the cart's shipping, tax and total show at a subtotal of $99.99, $100.00 and $100.01? Use PRICE-3, PRICE-4 and PRICE-5 only. Then compare with your agent's boundary cases.

## Monday page
Fill in [Context and access](monday/L10-context-and-access.md) for one system at your job.

## Interview answer
*"How do you know AI-written test cases are right?"* Model answer: "I don't trust the writer. Every case must cite a requirement and state an exact expected result. A second agent on a different model judges every case with a fresh context, and a plain script checks traceability. Then a person approves or rejects each one with a reason, and only approved cases get published. The trace shows which agent did what, and on which model."

## If something breaks
| You see | Do this |
|---|---|
| `Agent ... requires user approval` | `npm run update` (it adds the `Agent(...)` rules), then restart `cydeo` |
| The publisher says `Permission denied for tm_create_test_case` | `npm run update`, then restart `cydeo`: settings load only at start |
| ZincTM errors or `NOT_ELIGIBLE` | `npm run connect` and post its last line in the support thread |
| An agent takes more than 5 minutes | Press Esc, run `npm run catchup -- L10`, continue from the next step |
| `npm run review` says it needs a terminal | Run it yourself in a terminal, not through the agent |
| The agent asks to run a shell command, such as `node -e …` to check a JSON file | Read it first. You can say No: `npm run rtm` and the next agent check the JSON anyway. Never approve a command that deletes, resets or downloads something |
| `npm run trace` says a session's models are not recorded yet | That session ended without `/quit`. Next time leave with `/quit` |
