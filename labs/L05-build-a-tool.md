# L05 · Build one tool

> "It's a brain without arms and legs. How do you give a large language model arms and legs? MCP."

The brain chooses the tool. Your code does the work. Only one of them can hallucinate.

**Proof:** `npm run check:lab -- L05`

## 1. Build it with the agent
In plain `cydeo` (not `--qa`), paste:
```
Build an MCP server in mcp/ledger/server.ts (TypeScript, @modelcontextprotocol/sdk, stdio transport) with ONE read-only tool
named find_orders. Input: { email: string }. It opens store/data/store.db with node:sqlite in read-only mode and returns that
customer's status and total_spent_cents plus their orders (id, status, amount_cents, stripe_payment_intent_id).
Every call appends one line to artifacts/L05/calls.log: ISO time, "find_orders", the email, the number of orders returned.
Do not write to the database.
```

## 2. Smoke check (no agent involved)
```bash
node scripts/mcp-smoke.mjs
```

## 3. Wire it, then approve it
Create `.qwen/settings.json`:
```json
{ "mcpServers": { "ledger": { "command": "npx", "args": ["tsx", "mcp/ledger/server.ts"] } } }
```
```bash
cydeo mcp list            # ledger: Pending approval
cydeo mcp approve ledger  # a repository cannot run code on your machine until YOU approve it
```

## 4. Use it
Start `cydeo --qa` and paste:
```
Use the ledger tool to look up e2e-<an email you used>. For each order, say whether its ledger status matches what the store page shows.
Write what you found to artifacts/L05/tool-call.md, including the order ids.
```
Then read `artifacts/L05/calls.log`. The server wrote that line, not the agent.

## 5. Proof
```bash
npm run check:lab -- L05
```
