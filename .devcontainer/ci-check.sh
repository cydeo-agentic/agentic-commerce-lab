#!/usr/bin/env bash
# CI only: proves the Codespace container works end to end. (No AI Lab login in CI, so that one doctor line fails there.)
set -uo pipefail
export PLAYWRIGHT_MCP_EXECUTABLE_PATH="$(node -e "import('@playwright/test').then(m=>console.log(m.chromium.executablePath()))")"
fail=0
step() { echo; echo "================ $1"; }

step "versions"
node -v; npx stripe version | head -1; npm ls -g --depth=0 @cydeo/cli | tail -2
env | grep '^PLAYWRIGHT_MCP_' | sed 's/=.*/=set/'

step "Stripe sandbox from a cloud IP (informational: does no-signup creation work from Azure?)"
STRIPE_SANDBOX_EMAIL="aq-ci-$(date +%s)@example.com" timeout 150 node scripts/setup-stripe.mjs </dev/null
echo "sandbox create exit: $?"

step "start the store (Stripe sandbox if it worked, otherwise offline simulator)"
nohup node scripts/dev.mjs > /tmp/dev.log 2>&1 &
for i in $(seq 1 90); do curl -sf localhost:3000/api/health >/dev/null && break; sleep 1; done
curl -s localhost:3000/api/health; echo

step "browser smoke tests"
npx playwright test tests/smoke --reporter=line || fail=1

step "witness gate on the Visa order (expect PASS)"
VISA=$(curl -s localhost:3000/api/crm | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s).orders.find(o=>o.card==='visa');console.log(o?o.id:'')})")
npm run --silent witness -- "$VISA" || fail=1

step "agent browser (Playwright MCP, headless) opens the store"
node scripts/agent-browser-probe.mjs || fail=1

step "cydeo login waits for approval instead of crashing (no xdg-open in a Codespace)"
timeout 15 cydeo login </dev/null > /tmp/login.log 2>&1; rc=$?
grep -E 'device|code' /tmp/login.log | head -3
if [ "$rc" -eq 124 ]; then echo "PASS cydeo login is waiting for approval"; else echo "FAIL cydeo login exited $rc"; tail -5 /tmp/login.log; fail=1; fi

step "npm run watch serves Playwright UI mode on port 8080"
(timeout 90 npm run --silent watch > /tmp/watch.log 2>&1 &)
code=000; for i in $(seq 1 60); do code=$(curl -s -o /dev/null -w '%{http_code}' localhost:8080); [ "$code" != "000" ] && break; sleep 1; done
if [ "$code" = "200" ] || [ "$code" = "302" ]; then echo "PASS Playwright UI answered HTTP $code"; else echo "FAIL Playwright UI did not answer (HTTP $code)"; tail -5 /tmp/watch.log; fail=1; fi

step "doctor"
npm run --silent doctor || true

step "store log"
grep -v -E 'whsec_|_test_' /tmp/dev.log | tail -25
exit $fail
