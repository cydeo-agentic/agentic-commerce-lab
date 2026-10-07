# L07 · MCP deep dive: hands you can trust

> "The brain chooses the tool. Your code does the work. Only one of them can hallucinate." Today you give the brain a second hand, use it to beat a poisoned chat message, and connect it to the skill you wrote yesterday.

Do **L05** first (your `find_orders` server, wired and approved).
**Proof:** `npm run check:lab -- L07`
**Fell behind?** `npm run catchup -- L07` gives you the reference server (wired in `.qwen/settings.json`) and skill. If you already have a file, the reference lands next to it as `….catchup`: compare, then copy what you need. Read them before you use them.

## 1. Two recorders, one call (5 min)
In L05 your agent called `find_orders`. Two different systems recorded it, and neither one is the agent:
```bash
tail -3 artifacts/L05/calls.log     # written by YOUR server, at the moment of the call
npm run trace                       # written by the agent runtime: look for "MCP tools : ledger.find_orders"
```
The agent's summary can say anything. These two lines are what happened.

## 2. Who decides if a tool is safe? (10 min)
Open your `mcp/ledger/server.ts`. Every tool can carry **annotations**, hints about itself. This agent (Qwen Code, inside `cydeo`) decides as follows:
- a server marked `"trust": true` in settings: every tool runs without asking;
- a tool that declares `annotations: { readOnlyHint: true }`: it runs without asking;
- every other tool: the agent asks you first.

Read the second line again. The tool **declares itself** read-only, and the agent believes it. Who checks that claim? You do, by reading the code. `find_orders` deserves the hint only because it opens the database with `{ readOnly: true }`. Write down: which line of your server makes the hint true?

## 3. Give it a second hand: `get_rules` (20 min)
In plain `cydeo`, paste:
```
Add a second tool to mcp/ledger/server.ts named get_rules. It takes no input, fetches http://localhost:3000/api/rules
(the running store's live business rules), and returns them as JSON text. It is read-only: mark it with
annotations: { readOnlyHint: true }. Every call appends one line to artifacts/L05/calls.log:
ISO time, "get_rules", "-", and the freeShippingThresholdCents value. Keep find_orders exactly as it is.
```
Then prove it without any agent:
```bash
node scripts/mcp-smoke.mjs
```
Every line PASS, including "get_rules returns the live store's rules".

## 4. Beat the poison with a tool (10 min)
Remember L04: a Slack message said free shipping starts at $75. Give the agent the poison AND the new hand:
```bash
mkdir -p artifacts/L07
cydeo -p "Read labs/data/slack-thread.md and PRD.md. Before you trust any number, ask the store's live rules with the ledger tool get_rules. Then write boundary test cases for free shipping and for the AGENT10 coupon: each case with the cart value in dollars and the expected shipping and discount. Cite the rule ids." > artifacts/L07/boundary.md
npm run trace
```
Look for `ledger.get_rules` in the trace and a new `get_rules` line in `calls.log`. In our dry run (Oct 7): 3 tool calls, 64 s, it called the Slack thread "stale" and built the boundary on $100.00.

## 5. Skills teach how, MCP gives hands (15 min)
Upgrade yesterday's skill. In `.agents/skills/prove-a-defect/SKILL.md`, add a step before writing the report:
```
Confirm the ledger with your hands: call the ledger MCP tool find_orders with the customer's email from the receipt.
Use what it returns for the Ledger line under Actual. If the tool is not available, say so; do not guess.
```
Run yesterday's prompt again with your FAIL order:
```bash
cydeo -p "Write a defect report for Zinc Store order ord_xxxxxxxxxxxx." > artifacts/L07/defect-with-tool.md
npm run trace
```
The trace must show **both** in one session: `skills loaded : prove-a-defect` and `MCP tools : ledger.find_orders`. In our dry run: 5 tool calls, 33 s.

## 6. Design note: when would you NOT do this? (10 min)
Write `artifacts/L07/tool-design.md`, three short answers:
1. Which of your tools are read-only, and which line of code makes that true (not just the hint)?
2. A teammate wants a `refund_order` tool. What must be true before you allow it? (Think: who approves each call, test mode only, logging.)
3. Name one job where you would NOT build an MCP tool, and what you would use instead.

## 7. Proof
```bash
npm run check:lab -- L07
```

**Interview close:** "What is MCP, and when would you not use it?"
