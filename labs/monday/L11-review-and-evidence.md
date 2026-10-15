# Monday page 2 · Review and evidence

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

## B. What each step did, and how long it took
Measured, not guessed: read each agent's session time in `npm run trace`. The L11 times below are from our Oct 14 dry run; replace them with yours.

| Step | Agent | Time per run | What a person still does |
|---|---|---:|---|
| Research (context) | context-researcher | your number | Fixes anything wrong in `team-context.md` |
| Test plan | test-plan-creator | your number | Answers its questions for the team |
| Test cases | test-case-creator | your number | Nothing yet: the next two steps judge them |
| Case review (second agent) | case-evaluator | your number | Approves or rejects every case (`npm run review`) |
| Automation (3 specs) | automation-engineer | 95 s | Fixes a case that guessed a format, then approves it again |
| Failure investigation | failure-investigator | 43–55 s | Decides who fixes what |
| Defect filing | defect-reporter | 84 s | Reads the defect as the developer who must fix it |
| Healing | test-healer | 46 s | Runs `npm run heal:check` before trusting a green test |

Your manager's question is not "how fast is it?" but "what did a person stop doing, and what did it catch?" Put the defect from today next to the minutes it took.

## C. The same idea in the tool your company gives you
| What you built today | Copilot | Claude Code |
|---|---|---|
| An agent that writes and runs specs | A custom agent in `.github/agents/*.agent.md` with a `tools:` list; the Copilot coding agent runs tests inside a GitHub Actions sandbox | A subagent in `.claude/agents/`; allow one command with a permission rule such as `Bash(npm run spec:*)` |
| A runner agents may call without asking | The coding agent's sandbox and your CI | Permission rules plus a sandboxed runner |
| A healer that may only fix locators | Playwright's own agents (`npx playwright init-agents --loop=vscode`). Their healer may **skip** a test it believes is broken, so add your own gate | The same Playwright agents (`--loop=claude`), with the same gate |
| A defect filed with one write tool | Atlassian's official MCP server, with its create-issue tool as the only write tool in the agent's `tools:` | The same server, with that one tool allowed for one subagent |
| `npm run heal:check` in front of a merge | A required status check in your pull request | The same check, run in CI |

Playwright's documented healer outcome is "a passing test, or a skipped test if the healer believes that functionality is broken" (playwright.dev/docs/test-agents, checked Oct 14, 2026). Today's rule is stricter: a broken product leaves the test red, and a person decides.
