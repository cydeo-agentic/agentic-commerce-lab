# Monday page 1 · Context and access

One page for your team, about one system you use at work. Copy this file, replace the example, and keep it under a page. Write nothing secret: no keys, no customer data, no internal URLs you would not post in a team channel.

## A. Our team context file
What every agent must know before it touches our product. In your repo this lives in `AGENTS.md` (read by Copilot, Cursor, Codex and Qwen Code) or `CLAUDE.md` (Claude Code reads that first).

| Section | Example (a web banking team using Jira + Xray) |
|---|---|
| What the product does | Customers sign in, see accounts, move money between their own accounts, download statements |
| Rules that matter most | TRF-4: a transfer over the daily limit is refused with "Daily limit reached". STM-2: a statement total equals the sum of its transactions |
| Test data | Test users and accounts in the QA environment; never production data |
| Known bugs and risks | Open Xray defects in the "Payments" component; month-end statement totals |
| Open questions | Does the daily limit reset at midnight local time or UTC? |
| Sources | Confluence space QA, Jira project BANK, the API spec |

## B. Read-only access request
What an agent may read in one system, written for the person who approves it.

| Question | Example: Jira and Confluence through Atlassian's official MCP server |
|---|---|
| System and server | Atlassian Rovo MCP Server (official, Cloud) |
| Tools the agent gets | Search issues, read an issue, read comments, read a Confluence page. **No** create, update or delete |
| Data it touches | Issues and pages in project BANK and space QA only |
| Credential | Each engineer's own OAuth sign-in. No shared token, nothing stored in the repo |
| Where calls are logged | Atlassian's audit log, plus the agent tool's own session recordings |
| Who approves | Jira admin (scopes) and security (the MCP server on the allowlist) |
| Never allowed | Writing to Jira, reading HR or finance spaces, any production database |

## C. The same idea in the tool your company gives you
| What you built today | Copilot (VS Code, Copilot CLI) | Claude Code |
|---|---|---|
| An agent file: `.qwen/agents/context-researcher.md` | `.github/agents/context-researcher.agent.md` | `.claude/agents/context-researcher.md` |
| Its own tool list: `tools:` | `tools:` | `tools:` (and `disallowedTools:`) |
| Its own model: `model:` | `model:` (a subagent cannot cost more than the main model) | `model:` |
| Team context: `AGENTS.md` | `AGENTS.md` or `.github/copilot-instructions.md` | `CLAUDE.md` (`AGENTS.md` only when there is no `CLAUDE.md`) |
| Allow and deny rules: `.qwen/settings.json` | Your organization's MCP policy and allowlist | `permissions` in `.claude/settings.json`, plus managed settings |

Cursor and Codex let an agent pick its model, but not a tool list: Cursor has a `readonly` switch, Codex a read-only sandbox. Checked against vendor docs on Oct 13, 2026.
