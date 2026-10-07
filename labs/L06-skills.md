# L06 · Skills: teach your agent a job

> A skill is a recipe card. The harness (`AGENTS.md`) is the rule poster every agent reads every time. A skill sits in a drawer, and the agent pulls it out only when the job matches the card's description.

**Proof:** `npm run check:lab -- L06`
**Fell behind?** `npm run catchup -- L06` gives you the reference skill. Read it before you use it.

## 0. You need one FAIL receipt
Buy **1 × Felt Desk Mat** with coupon **AGENT10** and the Visa test card, then:
```bash
npm run witness -- latest
```
You should see `FAIL [PAY-1]`. Keep that order id (`ord_…`). Already have a FAIL receipt from L03? Use that one.

## 1. Meet a skill (10 min)
Open `.agents/skills/witness-an-order/SKILL.md`. It has two parts:
- **Front matter** (between the `---` lines): `name`, and a `description` that says **when** to use it. The agent reads only these lines until a task matches.
- **Body**: the steps, the rules, and the exact shape of the answer.

Now open `.qwen/settings.json`. The line `"Skill(witness-an-order)"` is you allowing that skill. A skill is someone's instructions running inside your agent, so you allow each one by name.

**Predict first:** you will NOT mention the skill. Will the agent find it on its own? Use your FAIL order id from step 0 (its receipt already exists):
```bash
cydeo -p "Did my Zinc Store order ord_xxxxxxxxxxxx really go through correctly? Check it and tell me."
npm run trace
```
`npm run trace` reads the agent runtime's own session recording. Look for `skills loaded : witness-an-order`. The agent picked the card by reading its description. Look at its answer: same table shape as the skill says.

Also look for a `not run` line in the trace. In `cydeo -p` (one-shot) mode the agent cannot ask you for permission, so anything not on the allow list is refused: the agent asked, the runtime said no. That is why you run `npm run witness` yourself and the agent reads the receipt.

## 2. The run without your skill (5 min)
Use your FAIL order id:
```bash
mkdir -p artifacts/L06
cydeo -p "Write a defect report for Zinc Store order ord_xxxxxxxxxxxx." > artifacts/L06/defect-before.md
npm run trace
```
Write down from the trace: how many tool calls did it make? Read the report. Would your lead accept it as is?

## 3. Write your own skill (25 min)
Create `.agents/skills/prove-a-defect/SKILL.md`. Write it with the agent, but **you** are the editor: this file becomes an instruction to every agent that works in this repo after you. In `cydeo --qa`, paste:
```
Help me write a skill file at .agents/skills/prove-a-defect/SKILL.md for this repo. Show it to me before you write it.
Front matter: name prove-a-defect, and a description that says WHEN to use it (writing or filing a defect for a Zinc Store order, or explaining a FAIL witness verdict).
Body:
- Steps: find the FAIL receipt in artifacts/witness/; take the order id, PaymentIntent id and event ids from the receipt, never from memory;
  quote the failed rule's text from PRD.md as Expected; write Actual as what the page, Stripe and the ledger each said.
- Output: exactly the defect template from labs/L03-three-witnesses.md (title, PRD rule, Steps, Expected, Actual, Evidence, Severity).
- Rules: copy ids character by character from the receipt; exact cents, never round; do not read files in store/; do not suggest a fix.
```
Read every line before you accept it. Then allow it: add `"Skill(prove-a-defect)"` to the `allow` list in `.qwen/settings.json`.

## 4. The run with your skill (5 min)
Same prompt, same order:
```bash
cydeo -p "Write a defect report for Zinc Store order ord_xxxxxxxxxxxx." > artifacts/L06/defect-after.md
npm run trace
```
Look for `skills loaded : prove-a-defect`. Compare the two reports and the two tool-call counts. What we saw on Oct 7: without the skill the report came out in the agent's own shape (5 of 9 rubric points); with the skill it scored 9 of 9 in both runs. Effort varied: one run with the skill took 4 tool calls and 38 s, another took 9 tool calls and 79 s. Same prompt, same skill, different path. That is why one run proves nothing: run it again and see whether your numbers hold.

## 5. A skill from a stranger (10 min)
A teammate posted a skill in Slack: `labs/data/shared-skills/free-shipping-checker/SKILL.md`. **Do not install it yet.** Review it like code. Check its numbers against the system of record:
```bash
npm run rules
```
Write `artifacts/L06/skill-review.md`: what is wrong in it, how you checked, and your decision. Installing a skill means letting a stranger write your agent's instructions.

## 6. Did your agent write itself a skill? (optional, 5 min)
Qwen Code can save "auto-skills" after a session that went well: look in `.qwen/skills/` for folders named `auto-skill-…`. Open one. Would you share it with the class? In our dry run, one auto-skill held the location of every planted bug, because that agent had read the store's source code. That is why `AGENTS.md` rule 11 now says: judge the running system, not its source.

## 7. Proof
```bash
npm run check:lab -- L06
```

**Interview close:** "What's an agent skill, and how do you know it helps?" Answer with your before/after numbers.
