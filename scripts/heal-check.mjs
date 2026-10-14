#!/usr/bin/env node
/**
 * The healer gate. Run: npm run heal:check
 * Heal the locator, never the assertion. A red test may be fixed only by changing how it finds an element. This script,
 * not an agent, checks every spec in tests/lab/L11:
 *   1. nothing hides a failure: no test.skip, fixme, only or fail, no retries, no fixed waits
 *   2. every test is named after an approved case (TC-xx ...) and every test id is in .cydeo/contract.md
 *   3. every amount or status a test asserts comes from its approved case (or the catalog's prices), never from the app
 *   4. every amount in the case's expected result is asserted, and every pricing test pays and checks order-total (PAY-1)
 *   5. after npm run drill: no test removed, and every assertion exactly as it was before the healer touched it
 * Exit code 1 if any check fails, so a CI job or a person can stop the merge.
 */
import { existsSync, readFileSync } from 'node:fs';
import { P, casesOf, contractIds, readAgentJson } from './lib/pipeline.mjs';
import { L11_DIR, L11_OUT, STATUS_RE, caseText, catalogPrices, moneyIn, parseSpec, signature, specFiles } from './lib/specs.mjs';

export function healGate() {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
  const files = specFiles();
  check(`specs exist in ${L11_DIR}/`, files.length, files.length ? `${files.length} file(s)` : 'none');
  if (!files.length) return results;
  const specs = files.map(parseSpec);
  const tests = specs.flatMap((s) => s.tests.map((t) => ({ ...t, file: s.file })));
  const cases = new Map(casesOf(readAgentJson(P.cases).data).map((c) => [String(c.id).toUpperCase(), c]));
  const decisions = (readAgentJson(P.approvals).data?.decisions ?? []).filter((d) => d.decision === 'approve');
  const approved = new Set(decisions.map((d) => String(d.id).toUpperCase()));
  // npm run review keeps each approved case's expected result as the person saw it. That copy, in a file agents may not
  // write, is the truth; pipeline/cases.json is only the fallback for approvals made before it kept one.
  const asApproved = new Map(decisions.filter((d) => typeof d.expected === 'string' && d.expected).map((d) => [String(d.id).toUpperCase(), d.expected]));
  const ids = contractIds();
  const prices = catalogPrices();

  const hiders = specs.flatMap((s) => s.hiders.map((h) => `${s.file}:${h.line} ${h.call}`));
  check('no test is skipped, focused, marked as failing or retried', !hiders.length, hiders.join('; '));
  const waits = specs.flatMap((s) => s.waits.map((w) => `${s.file}:${w.line} ${w.call}`));
  check('no fixed waits (waitForTimeout, setTimeout)', !waits.length, waits.join('; '));
  const unnamed = tests.filter((t) => !t.caseId || !approved.has(t.caseId)).map((t) => t.title);
  check('every test is named after an approved case (TC-xx ...)', tests.length && !unnamed.length, unnamed.length ? `not approved or no case id: ${unnamed.join('; ')}` : `${tests.length} test(s)`);
  const unknown = [...new Set(specs.flatMap((s) => s.testIds).filter((id) => !ids.has(id)))];
  check('every test id is in .cydeo/contract.md', !unknown.length, unknown.length ? `not in the contract: ${unknown.join(', ')}` : '');

  const edited = [...asApproved].filter(([id, exp]) => cases.has(id) && (cases.get(id).expected ?? cases.get(id).expectedResult) !== exp).map(([id]) => id);
  check('no approved case was changed after you approved it (pipeline/cases.json vs your review)', !edited.length, edited.length ? `changed: ${edited.join(', ')}` : asApproved.size ? `${asApproved.size} approved expected results kept by npm run review` : 'approved before npm run review kept copies; compared with pipeline/cases.json');

  const invented = [];
  const missing = [];
  for (const t of tests) {
    const found = cases.get(t.caseId);
    if (!found) continue;
    const c = { ...found, expected: asApproved.get(t.caseId) ?? found.expected ?? found.expectedResult };
    const source = caseText(c);
    const allowed = new Set([...moneyIn(source), ...prices]);
    const statuses = new Set(source.match(STATUS_RE) ?? []);
    for (const a of t.assertions) for (const v of a.values) {
      for (const m of moneyIn(v)) if (!allowed.has(m)) invented.push(`${t.caseId} asserts ${m}`);
      for (const s of String(v).match(STATUS_RE) ?? []) if (!statuses.has(s) && !a.negated) invented.push(`${t.caseId} asserts ${s}`);
    }
    const asserted = new Set(t.assertions.flatMap((a) => a.values.flatMap(moneyIn)));
    for (const m of new Set(moneyIn(c.expected))) if (!asserted.has(m)) missing.push(`${t.caseId} never asserts ${m}`);
  }
  check('every asserted amount and status comes from the approved case, not from the app', !invented.length, invented.join('; '));
  // Team rule PAY-1: a pricing case is proven only when the shopper pays what they were shown.
  const unpaid = tests.filter((t) => cases.has(t.caseId) && /\bPRICE-\d/.test(JSON.stringify(cases.get(t.caseId).rule ?? cases.get(t.caseId).rules ?? ''))
    && !(t.testIds.includes('checkout-pay-button') && t.testIds.includes('order-total') && t.assertions.some((a) => a.values.some((v) => moneyIn(v).length) && /order-total|total/i.test(a.subject)))).map((t) => t.caseId);
  check('team rule PAY-1: every pricing test pays and checks order-total', !unpaid.length, unpaid.length ? `does not pay or never checks order-total: ${unpaid.join(', ')}` : '');
  check('every amount in the case\'s expected result is asserted', !missing.length, missing.join('; '));

  const basePath = `${L11_OUT}/heal-baseline.json`;
  if (existsSync(basePath)) {
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    const now = new Map(tests.map((t) => [t.title, t.assertions.map(signature)]));
    const removed = Object.keys(base.tests).filter((title) => !now.has(title));
    check('after the drill: no test was removed or renamed', !removed.length, removed.join('; '));
    const changed = [];
    for (const [title, before] of Object.entries(base.tests)) {
      const after = [...(now.get(title) ?? [])];
      for (const sig of before.signatures) {
        const i = after.indexOf(sig);
        if (i === -1) changed.push(`${title.split(' ')[0]}: ${sig} is gone`);
        else after.splice(i, 1);
      }
    }
    check('after the drill: every assertion is exactly as it was (only locators changed)', !changed.length, changed.join('; '));
    const still = readFileSync(base.file, 'utf8').includes(base.to);
    check(`the drill's stale test id is gone from ${base.file}`, !still, still ? `still uses ${base.to}` : `${base.to} -> ${base.from}`);
  }
  return results;
}

if (process.argv[1]?.endsWith('heal-check.mjs')) {
  const results = healGate();
  console.log('\nHealer gate: heal the locator, never the assertion\n');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed ? `${failed} failed. A red test that hides a bug is worse than a red test.` : 'Gate passed.'}\n`);
  process.exit(failed ? 1 : 0);
}
