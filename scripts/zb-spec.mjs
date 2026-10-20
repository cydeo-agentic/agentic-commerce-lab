#!/usr/bin/env node
/**
 * Gate + run ONE ZincBank area. Run: npm run zb:spec -- transfers
 * Agents may run this command without asking, so it checks the spec before it runs anything:
 *   1. Safety   the spec imports only from '../fixtures' and never reaches for the machine.
 *   2. Contract every getByTestId / data-testid prefix is listed in zincbank/.cydeo/contract.md.
 *   3. Locators no CSS, XPath, getByRole/Text/Label; no waitForTimeout, test.only or blanket skips.
 *   4. Cases    every case in zincbank/cases/<area>.json has exactly one test whose title starts with its id,
 *               and every expected value of the case appears, unchanged, inside that test.
 * Then Playwright runs the spec against the ZincBank lab and this script writes
 *   artifacts/zb/status/<area>.json   gate result + one line per test (pass/fail + first error line)
 * Exit: 0 = gate passed and every test passed; 1 = gate failed (nothing ran); 2 = gate passed, some tests failed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const ZB = join(ROOT, 'zincbank');
const OUT = join(ROOT, 'artifacts', 'zb');
const area = process.argv[2] ?? '';

if (!/^[a-z0-9]+$/.test(area) || !existsSync(join(ZB, 'cases', `${area}.json`))) {
  const areas = existsSync(join(ZB, 'cases')) ? readdirSync(join(ZB, 'cases')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];
  console.log(`npm run zb:spec takes one area name. Areas: ${areas.join(', ')}`);
  process.exit(1);
}

const cases = JSON.parse(readFileSync(join(ZB, 'cases', `${area}.json`), 'utf8'));
const specPath = join(ZB, 'tests', `${area}.spec.ts`);
const status = { area, ranAt: new Date().toISOString(), gate: 'fail', problems: [], tests: [], cases: cases.length };
mkdirSync(join(OUT, 'status'), { recursive: true });
const save = () => writeFileSync(join(OUT, 'status', `${area}.json`), JSON.stringify(status, null, 2));

if (!existsSync(specPath)) {
  status.problems.push(`zincbank/tests/${area}.spec.ts does not exist yet`);
  save();
  console.log(`GATE FAIL: write zincbank/tests/${area}.spec.ts first.`);
  process.exit(1);
}
const src = readFileSync(specPath, 'utf8');
const problems = status.problems;

// ── 1. Safety ────────────────────────────────────────────────────────────────
for (const m of src.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)) {
  if (m[1] !== '../fixtures') problems.push(`imports "${m[1]}": a spec may import only from '../fixtures'`);
}
for (const [re, why] of [
  [/\brequire\s*\(/, 'require('], [/\bprocess\./, 'process.'], [/\beval\s*\(/, 'eval('], [/\bimport\s*\(/, 'dynamic import('],
  [/child_process|node:fs|\bexecSync\b|\bspawn\b/, 'shell or file access'],
]) if (re.test(src)) problems.push(`uses ${why}: a spec needs only page, the fixtures and expect`);

// ── 2. Contract ──────────────────────────────────────────────────────────────
const contract = readFileSync(join(ZB, '.cydeo', 'contract.md'), 'utf8');
const staticIds = new Set([...contract.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)*)`/g)].map((m) => m[1]));
const prefixes = new Set([...contract.matchAll(/`([a-z0-9-]+)-\{[a-zA-Z]+\}`/g)].map((m) => m[1]));
for (const m of src.matchAll(/getByTestId\(\s*(['"`])([^'"`]*?)\1?\s*\)/g)) {
  const raw = m[2];
  if (raw.includes('${')) {
    const prefix = raw.split('${')[0].replace(/-$/, '');
    if (!prefixes.has(prefix)) problems.push(`getByTestId(\`${raw}\`): "${prefix}-{…}" is not a templated id in the contract`);
  } else if (!staticIds.has(raw) && ![...prefixes].some((p) => raw.startsWith(`${p}-`))) problems.push(`getByTestId('${raw}'): not in the contract`);
}
if (/getByTestId\(\s*[^'"`\s]/.test(src)) problems.push('getByTestId(<variable>): write the id as a literal so it can be checked against the contract');
for (const m of src.matchAll(/data-testid\^=\\?["']([a-z0-9-]+?)-?\\?["']/g)) {
  if (!prefixes.has(m[1])) problems.push(`[data-testid^="${m[1]}-"]: not a templated id in the contract`);
}

// ── 3. Locators and waits ────────────────────────────────────────────────────
for (const m of src.matchAll(/\.locator\(\s*(['"`])(.*?)\1/g)) {
  if (!/^\[data-testid\^=/.test(m[2])) problems.push(`.locator('${m[2]}'): only [data-testid^="prefix-"] row locators are allowed`);
}
for (const [re, why] of [
  [/getBy(Role|Text|Label|Placeholder|AltText|Title)\(/, 'getByRole/Text/Label…: select by test id only'],
  [/xpath=|css=|page\.\$\$?\(/, 'CSS or XPath selector'],
  [/waitForTimeout\s*\(/, 'waitForTimeout: wait with an expect assertion instead'],
  [/networkidle/, 'networkidle'],
  [/\btest\.only\b|\bdescribe\.only\b/, 'test.only'],
  [/\btest\.skip\(\s*['"`]/, 'a blanket test.skip'],
]) if (re.test(src)) problems.push(`uses ${why}`);

// ── 4. Cases: one test per case, expected values unchanged ──────────────────
const titles = [...src.matchAll(/\btest\(\s*(['"`])(ZB-[A-Z0-9]+-\d+)\b/g)].map((m) => ({ id: m[2], at: m.index }));
for (const c of cases) {
  const hits = titles.filter((t) => t.id === c.id);
  if (hits.length !== 1) {
    problems.push(`${c.id}: expected exactly one test whose title starts with "${c.id}", found ${hits.length}`);
    continue;
  }
  const start = hits[0].at;
  const next = titles.filter((t) => t.at > start).map((t) => t.at).sort((a, b) => a - b)[0] ?? src.length;
  const block = src.slice(start, next);
  for (const e of c.expected ?? []) {
    if (e.value === null || e.value === undefined) continue;
    // Literal values only: URL, regex, timing and HTTP checks are written as patterns, not literals.
    if (!['toHaveText', 'toContainText', 'toHaveValue', 'toHaveCount', 'toContain'].includes(e.assert)) continue;
    const v = String(e.value);
    const variants = [v, v.replace(/'/g, "\\'"), v.replace(/"/g, '\\"'), typeof e.value === 'number' ? e.value.toLocaleString('en-US').replace(/,/g, '_') : v];
    if (!variants.some((x) => block.includes(x))) problems.push(`${c.id}: the expected value ${JSON.stringify(v)} from the case is not in the test (never change an expected value)`);
  }
}
for (const t of titles) if (!cases.some((c) => c.id === t.id)) problems.push(`${t.id}: no such case in cases/${area}.json`);

if (problems.length) {
  save();
  console.log(`GATE FAIL for ${area} (nothing ran):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
status.gate = 'pass';

// ── Run ──────────────────────────────────────────────────────────────────────
// cydeo runs agents with HOME=~/.cydeo/qwen-home, where Playwright finds no browsers. Point it at the real ones.
const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: join(OUT, 'results', `${area}.json`) };
const realHome = (process.env.HOME ?? '').replace(/[\\/]\.cydeo[\\/]qwen-home[\\/]?$/, '');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && realHome && realHome !== process.env.HOME) {
  const cache = process.platform === 'darwin' ? join(realHome, 'Library', 'Caches', 'ms-playwright') : join(realHome, '.cache', 'ms-playwright');
  if (existsSync(cache)) env.PLAYWRIGHT_BROWSERS_PATH = cache;
}
mkdirSync(join(OUT, 'results'), { recursive: true });
const r = spawnSync('npx', ['playwright', 'test', '-c', 'zincbank/playwright.config.ts', `zincbank/tests/${area}.spec.ts`, '--reporter=line,json', `--output=artifacts/zb/test-results/${area}`],
  { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

let report = null;
try { report = JSON.parse(readFileSync(join(OUT, 'results', `${area}.json`), 'utf8')); } catch { /* reported below */ }
const walk = (suite) => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(walk)];
for (const spec of report ? report.suites.flatMap(walk) : []) {
  const res = spec.tests?.[0]?.results?.at(-1);
  const id = spec.title.match(/ZB-[A-Z0-9]+-\d+/)?.[0] ?? spec.title;
  // eslint-disable-next-line no-control-regex
  const err = (res?.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '');
  status.tests.push({
    id, title: spec.title, status: res?.status === 'passed' ? 'passed' : 'failed',
    error: err ? err.split('\n').filter((l) => /Expected|Received|Error|Timeout|waiting for/.test(l)).slice(0, 4).join(' | ') : undefined,
  });
}
save();
const passed = status.tests.filter((t) => t.status === 'passed').length;
console.log(`\n${area}: ${passed}/${status.tests.length} passed (cases: ${cases.length})`);
for (const t of status.tests.filter((x) => x.status !== 'passed')) console.log(`  FAILED ${t.id}: ${t.error ?? 'see the report'}`);
if (!report) console.log((r.stdout ?? '').slice(-3000) + (r.stderr ?? '').slice(-2000));
process.exit(passed === cases.length && status.tests.length === cases.length ? 0 : 2);
