#!/usr/bin/env node
/**
 * The broken-locator drill. Run: npm run drill
 * Takes one of your passing L11 specs and swaps one test id for the name that element had in an older build, the way a
 * stale branch or a renamed element breaks a locator in real life. Before it touches anything it saves every test's
 * assertions to artifacts/L11/heal-baseline.json, so npm run heal:check can prove the healer changed locators only.
 * It prints the file and both ids, so you can always undo it by hand.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { contractIds } from './lib/pipeline.mjs';
import { L11_OUT, assertionMap, parseSpec, reportTests, specFiles } from './lib/specs.mjs';

const basePath = `${L11_OUT}/heal-baseline.json`;
if (existsSync(basePath) && process.argv[2] !== 'again') {
  const b = JSON.parse(readFileSync(basePath, 'utf8'));
  const healed = existsSync(b.file) && !readFileSync(b.file, 'utf8').includes(b.to);
  console.log(`The drill already ran (${b.at}): ${b.file} uses ${b.to} instead of ${b.from}. Healed: ${healed ? 'yes' : 'not yet'}.`);
  console.log(healed ? 'Run it once more with: npm run drill -- again' : 'Next: npm run spec, then ask the failure-investigator, then the test-healer.');
  process.exit(0);
}

const passed = new Set(reportTests().filter((t) => t.status === 'passed').map((t) => t.title));
const files = specFiles();
// Older names for elements the specs use most. None of them is in the contract, which is the point.
const OLD = {
  'cart-total': 'cart-grand-total', 'checkout-pay-button': 'checkout-submit-button', 'cart-checkout-button': 'cart-proceed-button',
  'header-cart-link': 'header-basket-link', 'checkout-total': 'checkout-grand-total', 'cart-subtotal': 'cart-items-total',
  'cart-shipping': 'cart-delivery', 'cart-tax': 'cart-vat', 'checkout-error-alert': 'checkout-error-banner',
};
const ids = contractIds();
let pick = null;
for (const f of files) {
  const spec = parseSpec(f);
  if (!spec.tests.length || !spec.tests.every((t) => passed.has(t.title))) continue;
  const used = [...new Set(spec.testIds)];
  const from = used.find((id) => OLD[id]) ?? used[0];
  if (from) { pick = { file: f, from, to: OLD[from] ?? `${from}-old` }; break; }
}
if (!pick) {
  console.log('The drill needs one spec whose tests all passed in your last run. Run npm run spec first.');
  process.exit(1);
}
if (ids.has(pick.to)) { console.log(`Refusing: ${pick.to} is a real test id.`); process.exit(1); }

writeFileSync(basePath, JSON.stringify({ at: new Date().toISOString(), ...pick, tests: assertionMap(files) }, null, 2) + '\n');
const src = readFileSync(pick.file, 'utf8');
const quoted = new RegExp(`(getByTestId\\(\\s*)(['"\`])${pick.from.replace(/[-]/g, '\\-')}\\2`, 'g');
const next = src.replace(quoted, `$1$2${pick.to}$2`);
writeFileSync(pick.file, next);
console.log(`Drill: ${pick.file} now looks for ${pick.to} instead of ${pick.from} (${(src.match(quoted) ?? []).length} place(s)).`);
console.log(`Saved every test's assertions to ${basePath}.`);
console.log('\nNext: npm run spec. Predict first: which test goes red, and will its error say "expected" and "received"?');
