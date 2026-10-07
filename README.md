# CYDEO Agentic QA · Zinc Store lab

A real distributed checkout that **you own**: a storefront, **your own Stripe sandbox**, and a CRM ledger, all running in your Codespace. You will make AI agents test it, and you will prove what they claim.

Nothing to install on your laptop. Everything runs in the browser.

## Start (10 minutes, once)
1. Open this repository in a Codespace: **Code → Codespaces → Create codespace on main** (or the link in the LMS).
2. Wait for **Setup finished** in the terminal (about 3 minutes the first time).
3. Terminal 1: `npm run dev` → your store and your Stripe sandbox start. Leave it running.
4. Terminal 2: `cydeo login` → approve in your browser.
5. Terminal 2: `npm run doctor` → every line PASS.

Then open [labs/README.md](labs/README.md).

## The system under test

```
 Storefront (UI) ──checkout──▶ API ──PaymentIntent──▶ Stripe sandbox (yours)
                                                         │
 Back office /crm ◀──ledger── SQLite ◀──webhook (signed)─┘
```

| You need | Where |
|---|---|
| Requirements, with rule ids | [PRD.md](PRD.md) |
| Every test id the store has | [.cydeo/contract.md](.cydeo/contract.md) |
| Rules every agent follows here | [AGENTS.md](AGENTS.md) |
| The truth about one order | `npm run witness -- <order id>` (or `latest`) |
| The store's live business rules | `npm run rules` |
| Keep your Stripe sandbox + dashboard | `npm run claim` |
| A fresh, empty ledger | `npm run reset` (nothing is deleted; the old one is archived) |

The Zinc Store has bugs **on purpose**. Your job is not to make the agent say "it works". Your job is to find out what is true, prove it, and report it.

No real money moves: the store only accepts sandbox (test) keys and refuses live keys.
