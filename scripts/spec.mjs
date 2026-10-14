#!/usr/bin/env node
/**
 * Run the L11 specs, the safe way. Run: npm run spec             (every spec in tests/lab/L11)
 *                                       npm run spec -- tc-04     (the specs whose file name contains tc-04)
 * Agents may run this one command without asking, so it first refuses any spec that imports anything but
 * @playwright/test or reaches for the machine (process, require, eval). Then Playwright runs with a trace and a
 * screenshot on every failure, and this script keeps what a reviewer needs:
 *   artifacts/L11/results.json         Playwright's own JSON report of the last run
 *   artifacts/L11/failures.md          each failure: kind, expected vs received, and the evidence files
 *   artifacts/L11/evidence/<run>/      the trace, screenshot and page snapshot of every failure, never overwritten
 *   artifacts/L11/runs.log             one line per run
 * Open a trace in the HTML report: npm run report (then click the failed test, then Trace).
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { L11_DIR, L11_OUT, failureKind, parseSpec, reportTests, specFiles, unsafeReasons } from './lib/specs.mjs';

const args = process.argv.slice(2);
const bad = args.filter((a) => !/^[\w.-]+$/.test(a) || a.startsWith('-'));
if (bad.length) {
  console.log(`npm run spec takes only part of a spec's file name, like tc-04. Refused: ${bad.join(' ')}`);
  process.exit(2);
}
const all = specFiles();
if (!all.length) {
  console.log(`No specs yet in ${L11_DIR}/. The automation-engineer agent writes them there.`);
  process.exit(1);
}
const targets = args.length ? all.filter((f) => args.some((a) => basename(f).includes(a))) : all;
if (!targets.length) {
  console.log(`No spec in ${L11_DIR}/ matches ${args.join(' ')}. There are: ${all.map((f) => basename(f)).join(', ')}`);
  process.exit(2);
}

// Every spec in the folder is checked, not only the ones asked for: Playwright loads helpers they import.
const unsafe = all.map((f) => [f, unsafeReasons(parseSpec(f))]).filter(([, r]) => r.length);
if (unsafe.length) {
  console.log('Refused to run. A spec is code that runs on your machine, and agents run this command without asking:');
  for (const [f, reasons] of unsafe) for (const r of reasons) console.log(`  ${f}: ${r}`);
  console.log('Remove those lines (a spec needs only page, request and expect from @playwright/test), then run npm run spec again.');
  process.exit(1);
}

// cydeo runs the agent with HOME=~/.cydeo/qwen-home, so Playwright would look for its browsers there and find none.
// Point it at the browsers installed for the real user (the Codespace installs them at creation).
const browsers = {};
const realHome = (process.env.HOME ?? '').replace(/[\\/]\.cydeo[\\/]qwen-home[\\/]?$/, '');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && realHome && realHome !== process.env.HOME) {
  const cache = process.platform === 'darwin' ? join(realHome, 'Library', 'Caches', 'ms-playwright') : join(realHome, '.cache', 'ms-playwright');
  if (existsSync(cache)) browsers.PLAYWRIGHT_BROWSERS_PATH = cache;
}

const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
mkdirSync(L11_OUT, { recursive: true });
const r = spawnSync('npx', ['playwright', 'test', ...targets, '--reporter=list,json,html', `--output=${L11_OUT}/test-results`], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: {
    ...process.env,
    ...browsers,
    PLAYWRIGHT_JSON_OUTPUT_NAME: `${L11_OUT}/results.json`,
    PLAYWRIGHT_HTML_OPEN: 'never',
    PW_TEST_HTML_REPORT_OPEN: 'never',
    // If the store is not running, Playwright starts it; the offline simulator needs no Stripe keys.
    STORE_PAYMENTS: process.env.STORE_PAYMENTS ?? 'offline',
  },
});

const tests = reportTests();
const failed = tests.filter((t) => !['passed', 'skipped'].includes(t.status));
const lines = [`# L11 run ${runId}`, '', `${tests.length} test(s): ${tests.length - failed.length} passed, ${failed.length} failed. Files: ${targets.map((f) => basename(f)).join(', ')}`, ''];
const logTests = [];
for (const t of tests) {
  const k = t.status === 'passed' ? { kind: 'passed' } : failureKind(t.error);
  const entry = { title: t.title, file: relative(process.cwd(), join(L11_DIR, basename(t.file))), status: t.status, kind: k.kind, expected: k.expected ?? null, received: k.received ?? null, evidence: {} };
  if (t.status !== 'passed' && t.status !== 'skipped') {
    // Keep the evidence of this failure where the next run cannot clean it away.
    const slug = t.title.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').slice(0, 60).replace(/^-|-$/g, '');
    const dir = join(L11_OUT, 'evidence', runId, slug);
    mkdirSync(dir, { recursive: true });
    for (const a of t.attachments) {
      if (!existsSync(a.path)) continue;
      const name = a.name === 'trace' ? 'trace.zip' : a.name === 'screenshot' ? 'screenshot.png' : a.name === 'error-context' ? 'error-context.md' : basename(a.path);
      copyFileSync(a.path, join(dir, name));
      entry.evidence[a.name === 'error-context' ? 'page' : a.name] = join(dir, name);
    }
    lines.push(`## ${t.title}`, '',
      `- File: ${entry.file}:${t.line}`,
      `- Status: ${t.status} after ${(t.durationMs / 1000).toFixed(1)} s`,
      `- Kind: **${k.kind}**${k.kind === 'assertion' ? ' (the test found the element; the value was wrong)' : k.kind === 'locator' ? ' (the test never found the element it asked for)' : ''}`,
      ...(k.expected || k.received ? [`- Expected: ${k.expected ?? '(none)'}`, `- Received: ${k.received ?? '(none)'}`] : []),
      `- Trace: ${entry.evidence.trace ?? '(none)'}   (npm run report, then the test, then Trace)`,
      `- Screenshot: ${entry.evidence.screenshot ?? '(none)'}`,
      `- Page at failure: ${entry.evidence.page ?? '(none)'}`,
      '', '```', t.error.split('\n').slice(0, 14).join('\n'), '```', '');
  }
  logTests.push(entry);
}
if (!failed.length) lines.push('Every test passed.', '');
writeFileSync(`${L11_OUT}/failures.md`, lines.join('\n'));
appendFileSync(`${L11_OUT}/runs.log`, JSON.stringify({ at: new Date().toISOString(), runId, exit: r.status, files: targets, tests: logTests }) + '\n');
console.log(`\nSummary for reviewers and agents: ${L11_OUT}/failures.md`);
process.exit(r.status ?? 1);
