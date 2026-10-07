# Labs

Every lab ends with a proof check: `npm run check:lab -- <lab>`. The check reads what the systems wrote (witness receipts, server logs), never the agent's summary.

| Lab | Session | What you prove |
|---|---|---|
| [L00 Readiness](L00-readiness.md) | before Thu Oct 8 | your Codespace, your store, your Stripe sandbox, your agent: `doctor` PASS |
| [L01 Prediction vs truth](L01-prediction-vs-truth.md) | Thu Oct 8 · Loop 1 | the agent guesses test ids; the contract is the truth; your first purchase passes three witnesses |
| [L02 Harness and gates](L02-harness-and-gates.md) | Thu Oct 8 · Loop 2 | the rule didn't stop the agent; the gate did |
| [L03 Three witnesses](L03-three-witnesses.md) | Thu Oct 8 · Loop 3 | you find a bug where the UI, Stripe and the ledger disagree, and prove it |
| [L04 Context poisoning](L04-context.md) | Fri Oct 9 · Loop 1 | a chat message poisons the agent; the live system grounds it; the grounded agent finds a real bug |
| [L05 Build one tool](L05-build-a-tool.md) | Fri Oct 9 · Loop 3 | you give the agent a new hand (an MCP tool) and prove it really used it |
| [L06 Skills](L06-skills.md) | Thu Oct 8 · second half | the agent picks a skill by its description; your own skill makes its defect reports complete, cheaper and consistent; you review a stranger's skill before installing it |
| [L07 MCP deep dive](L07-mcp-deep-dive.md) | Fri Oct 9 · second half | a second read-only tool beats a poisoned chat message; your skill and your tool work in one session; you know when not to use MCP |

Two proofs you can always run: `npm run trace` shows what the agent really did (skills loaded, MCP tools called), read from the agent runtime's own recordings. `npm run catchup -- L06` or `L07` gives you the reference solution if you fall behind.

Two terminals all class: **terminal 1** runs `npm run dev` (leave it running). **Terminal 2** is for the agent and the checks.
