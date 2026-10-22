#!/usr/bin/env node
/**
 * Automate the ZincBank cases with AI agents, several areas at once, and show the board.
 * Run: npm run zb:auto                                  (all areas, 4 agents at a time)
 *      npm run zb:auto -- --areas login,p2p             (some areas)
 *      npm run zb:auto -- --concurrency 6 --model anthropic/claude-haiku-4.5
 * Each agent is one `cydeo` session in zincbank/ that reads AGENTS.md, its cases file and the contract,
 * writes tests/<area>.spec.ts and proves it with `npm run zb:spec -- <area>` (gate + run, at most 3 runs).
 * Agent logs: artifacts/zb/agents/<area>.log   Board: artifacts/zb/board.json   Per area: artifacts/zb/status/<area>.json
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const ZB = join(ROOT, 'zincbank');
const OUT = join(ROOT, 'artifacts', 'zb');
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const allAreas = readdirSync(join(ZB, 'cases')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
// Biggest areas first, so the long ones are not left for the end.
const caseCount = (a) => JSON.parse(readFileSync(join(ZB, 'cases', `${a}.json`), 'utf8')).length;
const areas = (flag('areas', '') ? flag('areas', '').split(',') : allAreas).filter((a) => allAreas.includes(a)).sort((a, b) => caseCount(b) - caseCount(a));
const concurrency = Number(flag('concurrency', process.env.ZB_CONCURRENCY ?? 4));
const model = flag('model', process.env.ZB_MODEL ?? 'anthropic/claude-haiku-4.5');
const timeoutMin = Number(flag('timeout-min', 20));
const cydeo = (process.env.ZB_CYDEO ?? 'cydeo').split(' ');

if (!areas.length) {
  console.log(`No such area. Areas: ${allAreas.join(', ')}`);
  process.exit(1);
}
mkdirSync(join(OUT, 'agents'), { recursive: true });

const prompt = (area) => [
  `You are the automation engineer for the ZincBank area "${area}". Work only inside this folder (zincbank/).`,
  `1. Read AGENTS.md (the rules), then cases/${area}.json (the approved cases), contract.md (the only test ids) and fixtures.ts (the fixtures and helpers).`,
  `2. Write tests/${area}.spec.ts: one test per case, title starting with the case id, every expected value copied exactly.`,
  `3. Run exactly: npm run zb:spec -- ${area}`,
  `4. If the gate fails, fix what it lists and run again. If a test fails, decide: a test problem (fix the spec) or a product defect (the page shows a different value than the case expects while your steps match the case: keep the test and write it to defects/${area}.md). At most 3 runs in total.`,
  `5. Finish with one line: DONE ${area} <passed>/<total>.`,
  'Do not read or change any other file. Never delete anything.',
].join('\n');

const state = Object.fromEntries(areas.map((a) => [a, { area: a, cases: caseCount(a), phase: 'queued', started: 0, ended: 0, code: null }]));
const t0 = Date.now();

function readStatus(area) {
  try {
    return JSON.parse(readFileSync(join(OUT, 'status', `${area}.json`), 'utf8'));
  } catch {
    return null;
  }
}
function writtenTests(area) {
  const f = join(ZB, 'tests', `${area}.spec.ts`);
  return existsSync(f) ? [...readFileSync(f, 'utf8').matchAll(/\btest\(\s*['"`]ZB-[A-Z0-9]+-\d+/g)].length : 0;
}
const mmss = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

function snapshot() {
  return areas.map((a) => {
    const s = state[a];
    const st = s.started && existsSync(join(OUT, 'status', `${a}.json`)) ? readStatus(a) : null;
    const fresh = st && Date.parse(st.ranAt) >= s.started;
    const passed = fresh ? st.tests.filter((t) => t.status === 'passed').length : 0;
    const failed = fresh ? st.tests.filter((t) => t.status !== 'passed').length : 0;
    const review = fresh ? (st.review ?? []).length : 0;
    return {
      ...s, written: s.started ? writtenTests(a) : 0, passed, failed, review,
      gate: fresh ? st.gate : '', elapsed: s.started ? (s.ended || Date.now()) - s.started : 0,
    };
  });
}

function draw() {
  const rows = snapshot();
  const tot = (k) => rows.reduce((n, r) => n + r[k], 0);
  const lines = [
    `ZincBank — ${tot('cases')} cases, ${areas.length} areas, ${concurrency} agents at a time (${model})      ${mmss(Date.now() - t0)}`,
    '',
    `  ${'area'.padEnd(14)}${'state'.padEnd(11)}${'cases'.padStart(6)}${'written'.padStart(9)}${'pass'.padStart(7)}${'red'.padStart(6)}${'review'.padStart(8)}  gate   time`,
    `  ${'─'.repeat(70)}`,
    ...rows.map((r) => `  ${r.area.padEnd(14)}${r.phase.padEnd(11)}${String(r.cases).padStart(6)}${String(r.written).padStart(9)}${String(r.passed).padStart(7)}${String(r.failed).padStart(6)}${String(r.review).padStart(8)}  ${(r.gate || '·').padEnd(6)} ${r.started ? mmss(r.elapsed) : ''}`),
    `  ${'─'.repeat(70)}`,
    `  ${'TOTAL'.padEnd(25)}${String(tot('cases')).padStart(6)}${String(tot('written')).padStart(9)}${String(tot('passed')).padStart(7)}${String(tot('failed')).padStart(6)}${String(tot('review')).padStart(8)}`,
    '',
    '  Agent logs: artifacts/zb/agents/<area>.log    Defects the agents found: zincbank/defects/',
  ];
  if (process.stdout.isTTY) process.stdout.write('\x1b[H\x1b[2J' + lines.join('\n') + '\n');
  writeFileSync(join(OUT, 'board.json'), JSON.stringify({ model, concurrency, startedAt: new Date(t0).toISOString(), elapsedMs: Date.now() - t0, rows }, null, 2));
  return lines;
}

function run(area) {
  return new Promise((resolve) => {
    const s = state[area];
    s.phase = 'running';
    s.started = Date.now();
    const log = createWriteStream(join(OUT, 'agents', `${area}.log`), { flags: 'a' });
    log.write(`\n===== ${new Date().toISOString()} ${area} (${model}) =====\n`);
    const child = spawn(cydeo[0], [...cydeo.slice(1), '-p', prompt(area), '--approval-mode', 'yolo', '-m', model], {
      cwd: ZB, env: { ...process.env, CYDEO_MODE: '' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const timer = setTimeout(() => {
      s.phase = 'timeout';
      child.kill('SIGTERM');
    }, timeoutMin * 60_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      s.ended = Date.now();
      s.code = code;
      if (s.phase !== 'timeout') {
        const st = readStatus(area);
        s.phase = st && Date.parse(st.ranAt) >= s.started ? (st.gate === 'pass' ? 'done' : 'gate-red') : 'no-run';
      }
      log.end();
      resolve();
    });
  });
}

const queue = [...areas];
const board = setInterval(draw, 2000);
draw();
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
  while (queue.length) await run(queue.shift());
}));
clearInterval(board);
const lines = draw();
if (!process.stdout.isTTY) console.log(lines.join('\n'));

const reds = areas.flatMap((a) => (readStatus(a)?.tests ?? []).filter((t) => t.status !== 'passed').map((t) => `  ${t.id}  ${t.error ?? ''}`.slice(0, 200)));
console.log(`\nRed tests (${reds.length}):\n${reds.join('\n') || '  none'}`);
const reviews = areas.flatMap((a) => (readStatus(a)?.tests ?? []).filter((t) => t.review).map((t) => `  ${t.id}  ${t.review}`.slice(0, 220)));
console.log(`\nGreen but NEEDS REVIEW (${reviews.length}) — the agent changed a test that was red on a value:\n${reviews.join('\n') || '  none'}`);
console.log('\nOpen the HTML report of one area: npx playwright show-report artifacts/zb/report --host 0.0.0.0');
