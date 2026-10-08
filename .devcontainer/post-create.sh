#!/usr/bin/env bash
# Runs once when the Codespace is created. Students never install anything by hand.
set -euo pipefail

echo "==> Project dependencies (store, tests, Stripe CLI)"
npm ci

echo "==> Chromium for tests and for the agent's browser"
npx playwright install --with-deps chromium

echo "==> CYDEO CLI (the agent; signs in with your CYDEO account)"
npm install -g @cydeo/cli@0.1.6
# `cydeo login` opens the browser with xdg-open, which a Codespace lacks; without this it crashes before "Logged in."
sudo install -m 755 .devcontainer/xdg-open /usr/local/bin/xdg-open

echo "==> Pre-download the agent's browser tool (and the Chromium build it expects) so class never waits on it"
npx -y @playwright/mcp@latest --help >/dev/null 2>&1 || true
MCP_PW="$(npm view @playwright/mcp@latest dependencies.playwright 2>/dev/null || true)"
[ -n "$MCP_PW" ] && npx -y "playwright@$MCP_PW" install chromium >/dev/null 2>&1 || true

# The agent's browser uses the same Chromium as the tests (pinned with @playwright/test), never a surprise download.
CHROMIUM="$(node -e "import('@playwright/test').then(m=>console.log(m.chromium.executablePath()))")"
grep -q PLAYWRIGHT_MCP_EXECUTABLE_PATH ~/.bashrc 2>/dev/null || echo "export PLAYWRIGHT_MCP_EXECUTABLE_PATH=\"$CHROMIUM\"" >> ~/.bashrc

echo "==> The ledger's contract of test ids"
node scripts/contract.mjs

echo
echo "Setup finished. In this terminal:"
echo "  1. npm run dev        (starts your store + your own Stripe sandbox; leave it running)"
echo "  2. open a 2nd terminal: cydeo login   (approve in the browser, wait for 'Logged in.')"
echo "  3. npm run doctor     (every line must say PASS)"
