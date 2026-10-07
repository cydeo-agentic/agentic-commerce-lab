#!/usr/bin/env node
/**
 * Proof check for a lab. Run: npm run check:lab -- L01
 * Deterministic checks on agent-made work: agents are guilty until proven innocent, and so is your lab output.
 * Evidence must match receipts that the systems wrote themselves (witness receipts, server logs), never the agent's summary.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const lab = (process.argv[2] ?? '').toUpperCase();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const contractIds = new Set((read('.cydeo/contract.md').match(/^- ([a-z0-9-]+)$/gm) ?? []).map((l) => l.slice(2)));
const prdIds = new Set(read('PRD.md').match(/\b(CAT|CART|PRICE|PAY|ORD|CRM|WH)-\d+\b/g) ?? []);
const isTestId = (s) => /^[a-z0-9]+(-[a-z0-9]+)+$/.test(s) && !/^(e2e|data-testid)/.test(s);
const ticks = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const ledger = () => new DatabaseSync(process.env.STORE_DB ?? 'store/data/store.db', { readOnly: true });
const receipts = () => (existsSync('artifacts/witness') ? readdirSync('artifacts/witness').filter((f) => f.endsWith('.json')) : [])
  .map((f) => { try { return JSON.parse(read(`artifacts/witness/${f}`)); } catch { return null; } }).filter(Boolean);

function specCheck(dir, label) {
  const specs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.spec.ts')) : [];
  check(`a spec exists in ${dir}/`, specs.length > 0, specs.join(', '));
  if (!specs.length) return '';
  const src = specs.map((f) => read(`${dir}/${f}`)).join('\n');
  const r = spawnSync('npx', ['playwright', 'test', dir, '--reporter=line'], { encoding: 'utf8' });
  check(`the ${label} spec passes`, r.status === 0, (r.stdout ?? '').trim().split('\n').slice(-1)[0]);
  check('spec selects only by test id (no CSS/XPath locators)', !/page\.locator\(\s*['"`](?!\[data-testid)/.test(src) && !/xpath=|\/\/[a-z]+\[/.test(src));
  const used = [...src.matchAll(/getByTestId\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  const unknown = used.filter((id) => !contractIds.has(id));
  check('every test id in the spec exists in .cydeo/contract.md', used.length > 0 && unknown.length === 0, unknown.length ? `not in contract: ${unknown.join(', ')}` : `${used.length} ids used`);
  return src;
}

function l00() {
  const doc = read('artifacts/doctor.json');
  check('artifacts/doctor.json exists', doc);
  if (!doc) return;
  const d = JSON.parse(doc);
  check('doctor verdict is PASS', d.verdict === 'PASS', `${d.fails} fail, ${d.warns} warn, ${d.where}`);
}

function l01() {
  const pred = read('artifacts/L01/prediction.md');
  check('artifacts/L01/prediction.md exists (the blind run)', pred);
  if (pred) {
    const predicted = [...new Set(ticks(pred).filter(isTestId))];
    const invented = predicted.filter((id) => !contractIds.has(id));
    console.log(`Blind run: the agent predicted ${predicted.length} test ids; ${invented.length} do not exist${invented.length ? ` (${invented.join(', ')})` : ''}.`);
  }
  const ideas = read('artifacts/L01/test-ideas.md');
  check('artifacts/L01/test-ideas.md exists', ideas);
  const blocks = ideas.split(/^## /m).slice(1);
  check('at least 3 test ideas (## Idea ...)', blocks.length >= 3, `${blocks.length} found`);
  blocks.forEach((b, i) => {
    const ids = ticks(b).filter(isTestId);
    const unknown = ids.filter((id) => !contractIds.has(id));
    check(`idea ${i + 1} cites only real test ids (contract)`, ids.length > 0 && unknown.length === 0, unknown.length ? `invented: ${unknown.join(', ')}` : `${ids.length} ids`);
    const rules = b.match(/\b(CAT|CART|PRICE|PAY|ORD|CRM|WH)-\d+\b/g) ?? [];
    check(`idea ${i + 1} cites a real PRD rule`, rules.length > 0 && rules.every((r) => prdIds.has(r)), rules.join(', ') || 'none');
  });
  const passed = receipts().filter((r) => r.verdict === 'PASS');
  check('one purchase verified by three witnesses (a PASS receipt in artifacts/witness/)', passed.length > 0, passed.map((r) => r.orderId).join(', '));
}

function l02() {
  specCheck('tests/lab/L02', 'L02');
  const src = existsSync('tests/lab/L02') ? readdirSync('tests/lab/L02').map((f) => read(`tests/lab/L02/${f}`)).join('\n') : '';
  check('the final spec has no fixed waits', src && !/waitForTimeout|setTimeout\(/.test(src));
  const gate = read('artifacts/L02/gate-blocked.txt');
  check('artifacts/L02/gate-blocked.txt shows the gate blocking the wait', /no-wait-for-timeout/.test(gate));
  const mine = (read('AGENTS.md').split(/^## My rules/m)[1] ?? '').replace(/^\(.*\)$/m, '');
  check('AGENTS.md "My rules" has at least one rule you added', /^\s*[-*\d]+[.)]?\s+\S/m.test(mine));
}

function l03() {
  const all = receipts();
  check('at least 3 orders witnessed', all.length >= 3, `${all.length} receipts`);
  const failed = all.filter((r) => r.verdict === 'FAIL');
  check('at least one witness disagreement found (a FAIL receipt)', failed.length > 0, failed.map((r) => `${r.orderId}: ${r.checks.filter((c) => !c.ok).map((c) => c.rule).join('+')}`).join(' | '));
  const defect = read('artifacts/L03/defect.md');
  check('artifacts/L03/defect.md exists', defect);
  if (!defect) return;
  const orderIds = defect.match(/\bord_[a-f0-9]{12}\b/g) ?? [];
  const receipt = failed.find((r) => orderIds.includes(r.orderId));
  check('the defect names an order whose witness receipt FAILED', receipt, orderIds.join(', ') || 'no ord_ id in defect.md');
  if (!receipt) return;
  const failedRules = receipt.checks.filter((c) => !c.ok).flatMap((c) => c.rule.split(/[^A-Z0-9-]+/)).filter(Boolean);
  const cited = defect.match(/\b(CAT|CART|PRICE|PAY|ORD|CRM|WH)-\d+\b/g) ?? [];
  check('the defect cites the PRD rule the witnesses say was broken', cited.some((c) => failedRules.includes(c) || receipt.checks.some((k) => !k.ok && k.rule.includes(c))), `cited ${cited.join(', ') || 'none'}; failed ${failedRules.join(', ')}`);
  const pi = receipt.stripe?.paymentIntent;
  check('the PaymentIntent id in the defect matches the receipt (not invented)', pi && defect.includes(pi), pi ?? 'no PaymentIntent in receipt');
  const evts = (receipt.stripe?.events ?? []).map((e) => e.id);
  const citedEvts = defect.match(/\bevt_[A-Za-z0-9_]+/g) ?? [];
  check('the event id in the defect is one Stripe really sent for this payment', citedEvts.length > 0 && citedEvts.every((e) => evts.includes(e)), citedEvts.join(', ') || 'no evt_ id in defect.md');
  check('the defect has expected vs actual', /expected/i.test(defect) && /actual/i.test(defect));
}

function l04() {
  const poisoned = read('artifacts/L04/run-poisoned.md');
  const grounded = read('artifacts/L04/run-grounded.md');
  const truth = read('artifacts/L04/truth.json') ? JSON.parse(read('artifacts/L04/truth.json')) : {};
  check('artifacts/L04/run-poisoned.md exists', poisoned);
  check('artifacts/L04/run-grounded.md exists', grounded);
  check('truth.json came from the live store (npm run rules, HTTP 200)', truth.http === 200, truth.freeShippingThresholdCents ? `free shipping at ${truth.freeShippingThresholdCents} cents` : '');
  check('grounded run builds the shipping boundary on $100.00', /\$?100\.00|\b10000\b/.test(grounded));
  check('grounded run cites PRICE-3', /PRICE-3/.test(grounded));
  check('grounded run never uses the poisoned $75 threshold', !/\$75|\b7500\b|75\.00/.test(grounded));
  if (poisoned) console.log(`Poisoned run (no harness) used the $75 threshold: ${/\$75|\b7500\b|75\.00/.test(poisoned) ? 'yes' : 'no'}`);
  const harness = read('artifacts/L04/run-harness.md');
  check('artifacts/L04/run-harness.md exists (same prompt, inside the harness)', harness);
  if (harness) console.log(`Harness run used the $75 threshold: ${/\$75\.00\b|\b7500\b/.test(harness) && !/\$100\.00/.test(harness) ? 'yes' : 'no (it flagged or ignored the chat)'}`);
  const diag = read('artifacts/L04/diagnosis.md');
  check('artifacts/L04/diagnosis.md names the poisoned source', /slack|thread|chat|product owner|\bPO\b/i.test(diag));
  // The shipping bug's fingerprint: charged exactly one shipping fee ($7.99) more than the shopper was shown.
  const boundary = receipts().find((r) => r.checks?.some((c) => c.rule === 'PAY-1' && !c.ok)
    && r.ui?.shownAtCheckoutCents != null && r.stripe?.amount - r.ui.shownAtCheckoutCents === truth.shippingCents);
  check('you ran the $100.00 boundary and the witnesses caught the shipping bug (charged $7.99 more than shown)', boundary, boundary?.orderId ?? 'no such receipt yet');
}

function l05() {
  check('mcp/ledger/server.ts exists', existsSync('mcp/ledger/server.ts'));
  const r = spawnSync('node', ['scripts/mcp-smoke.mjs'], { encoding: 'utf8' });
  check('MCP smoke check passes (node scripts/mcp-smoke.mjs)', r.status === 0, (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('FAIL')).join(' | '));
  const settings = read('.qwen/settings.json');
  check('.qwen/settings.json wires the ledger server', /"ledger"/.test(settings) && /mcp\/ledger\/server\.ts/.test(settings));
  const calls = read('artifacts/L05/calls.log').split('\n').filter((l) => /find_orders/.test(l));
  const found = read('artifacts/L05/tool-call.md');
  // The agent's lookup must appear in the server's own log: same email, written by the server, not by the agent.
  const emails = [...new Set(found.match(/\be2e-[^\s`|@]+@[^\s`|]+/g) ?? [])];
  const logged = emails.filter((e) => calls.some((l) => l.includes(` ${e} `)));
  check('the server itself logged the agent\'s lookup (artifacts/L05/calls.log): the agent really used the tool', logged.length > 0,
    emails.length ? `${logged.length} of ${emails.length} email(s) in tool-call.md found in the server log` : 'no e2e- email in tool-call.md');
  const orderIds = [...new Set(found.match(/\bord_[a-f0-9]{12}\b/g) ?? [])];
  const real = orderIds.filter((id) => ledger().prepare('SELECT 1 FROM crm_orders WHERE id = ?').get(id));
  check('tool-call.md reports order ids that exist in the ledger (none invented)', orderIds.length > 0 && real.length === orderIds.length,
    orderIds.length ? `${real.length} of ${orderIds.length} real` : 'no ord_ id in tool-call.md');
}

const LABS = { L00: l00, L01: l01, L02: l02, L03: l03, L04: l04, L05: l05 };
if (!LABS[lab]) {
  console.log(`Usage: npm run check:lab -- <${Object.keys(LABS).join('|')}>`);
  process.exit(2);
}
LABS[lab]();
console.log(`\nProof check ${lab}\n`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n${failedCount ? `${failedCount} missing. Fix and re-run.` : 'All proof present.'}\n`);
process.exit(failedCount ? 1 : 0);
