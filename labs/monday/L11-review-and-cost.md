# Monday page 2 · Review and cost

One page for your manager. Copy this file, replace the examples with your team's, and keep it under a page. Write nothing secret.

## A. Our review checklist for AI-written tests
What a person checks before an AI-written test case or spec is trusted. Each line names who or what catches it, because a checklist nobody owns is a wish.

| Check | Why | Caught today by |
|---|---|---|
| Every case cites a requirement, and the requirement says what the case expects | A case can encode an assumption. In our dry run a case expected shipping "$0.00"; the PRD says "free" and the store shows "Free" | The investigator flagged it; a person fixed the case |
| Every expected value is exact (an amount, a message, a status) | "It works" cannot fail, so it cannot catch anything | `npm run rtm`, the evaluator |
| Every expected value comes from the requirement, never from the app | A test that copies the app's answer agrees with the bug | `npm run heal:check` |
| The spec asserts every value the case expects | A spec that skips the failing check passes and hides the bug | `npm run heal:check` |
| Nothing hides a failure: no skip, fixme, only, retries or fixed waits | These make red go away without fixing anything | `npm run heal:check`, ESLint in CI |
| A red test gets a verdict: product bug or test bug, with evidence | Someone has to own the fix | The investigator, then a person |
| A defect has steps, expected vs actual, the rule, who loses what, and the trace | A developer can fix what they can reproduce | The defect reporter, read by a person |
| The test proves what matters to the customer, not only what is on screen | Our cart showed $106.00 correctly; the charge was $113.99 | Team rule PAY-1 in the automation agent |

## B. What each step costs
Measured, not guessed: the cost per run comes from our Oct 13–14 dry runs (`npm run cost -- L10` and `npm run cost -- L11`, list prices, an upper bound). Replace them with yours, and the runs per month with your team's. The example team writes 40 stories a month.

| Step | Model | Cost per run | Runs per month | Per month | Copilot credits |
|---|---|---:|---:|---:|---:|
| Research (context) | gemini-3.1-flash-lite | $0.02 | 40 stories | $0.80 | 80 |
| Test plan | kimi-k2.7-code | $0.05 | 40 | $2.00 | 200 |
| Test cases | glm-5.2 | $0.13 | 40 | $5.20 | 520 |
| Case review (second agent) | claude-haiku-4.5 | $0.07 | 40 | $2.80 | 280 |
| Automation (3 specs) | claude-haiku-4.5 | $0.28 | 40 | $11.20 | 1,120 |
| Failure investigation | glm-5.2 | $0.03 | 20 | $0.60 | 60 |
| Defect filing | gpt-oss-120b | $0.03 | 10 | $0.30 | 30 |
| Healing | qwen3-235b | $0.01 | 10 | $0.10 | 10 |
| **Total** | | | | **$23.00** | **2,300** |

How to compare: Copilot Business includes 1,900 credits per seat per month (about $19, so we count 1 credit per cent). A team of five has 9,500. Your manager's question is not "is it cheap?" but "what did a person stop doing, and what did it catch?" Put the defect from today next to its cost.

## C. The same idea in the tool your company gives you
| What you built today | Copilot | Claude Code |
|---|---|---|
| An agent that writes and runs specs | A custom agent in `.github/agents/*.agent.md` with a `tools:` list; the Copilot coding agent runs tests inside a GitHub Actions sandbox | A subagent in `.claude/agents/`; allow one command with a permission rule such as `Bash(npm run spec:*)` |
| A runner agents may call without asking | The coding agent's sandbox and your CI | Permission rules plus a sandboxed runner |
| A healer that may only fix locators | Playwright's own agents (`npx playwright init-agents --loop=vscode`). Their healer may **skip** a test it believes is broken, so add your own gate | The same Playwright agents (`--loop=claude`), with the same gate |
| A defect filed with one write tool | Atlassian's official MCP server, with its create-issue tool as the only write tool in the agent's `tools:` | The same server, with that one tool allowed for one subagent |
| `npm run heal:check` in front of a merge | A required status check in your pull request | The same check, run in CI |

Playwright's documented healer outcome is "a passing test, or a skipped test if the healer believes that functionality is broken" (playwright.dev/docs/test-agents, checked Oct 14, 2026). Today's rule is stricter: a broken product leaves the test red, and a person decides.
