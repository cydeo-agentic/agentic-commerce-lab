#!/usr/bin/env node
/**
 * Proof check for a lab. Run: npm run check:lab -- L01
 * Deterministic checks on agent-made work: agents are guilty until proven innocent, and so is your lab output.
 * Evidence must match receipts that the systems wrote themselves (witness receipts, server logs), never the agent's summary.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { agentDefinitions, agentSessions, allSubagentRuns, costOf, finalText, isWriteTool, mcpCalls, money, skillsLoaded } from './lib/agent-trace.mjs';
import { LAB_AGENTS, P, caseProblems, caseRules, casesOf, costPath, defectsOf, jsonIn, readAgentJson, verdictsOf } from './lib/pipeline.mjs';
import { L11_OUT, moneyIn, parseSpec, specFiles, unsafeReasons } from './lib/specs.mjs';
import { healGate } from './heal-check.mjs';
import { zinctmSession } from './lib/zinctm.mjs';

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

// The defect-report rubric (the L03 template): 9 points, every id checked against the receipts the systems wrote.
function scoreDefect(text) {
  const all = receipts();
  const orderIds = text.match(/\bord_[a-f0-9]{12}\b/g) ?? [];
  const receipt = all.find((r) => r.verdict === 'FAIL' && orderIds.includes(r.orderId));
  const failedRules = receipt ? receipt.checks.filter((c) => !c.ok).map((c) => c.rule) : [];
  const cited = text.match(/\b(CAT|CART|PRICE|PAY|ORD|CRM|WH)-\d+\b/g) ?? [];
  const pi = receipt?.stripe?.paymentIntent;
  const evts = (receipt?.stripe?.events ?? []).map((e) => e.id);
  const citedEvts = text.match(/\bevt_[A-Za-z0-9_]+/g) ?? [];
  const points = [
    ['one-line title (# …)', /^#\s+\S.{10,}/m.test(text)],
    ['names an order whose receipt FAILED', Boolean(receipt)],
    ['cites the PRD rule that failed', cited.some((c) => failedRules.some((f) => f.includes(c)))],
    ['steps to reproduce', /^\s*steps\b/im.test(text)],
    ['expected vs actual', /^\s*expected\b/im.test(text) && /^\s*actual\b/im.test(text)],
    ['PaymentIntent id matches the receipt', Boolean(pi && text.includes(pi))],
    ['event ids are ones Stripe really sent', citedEvts.length > 0 && citedEvts.every((e) => evts.includes(e))],
    ['links the witness receipt file', Boolean(receipt && text.includes(`artifacts/witness/${receipt.orderId}.json`))],
    ['severity: who loses what', /^\s*severity\b/im.test(text)],
  ];
  return { score: points.filter(([, ok]) => ok).length, of: points.length, missing: points.filter(([, ok]) => !ok).map(([n]) => n) };
}
const mtime = (p) => (existsSync(p) ? statSync(p).mtimeMs : 0);
const sha = (p) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : '');
const sessionCost = (s) => s ? `${s.calls.length} tool calls` : 'no session';

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

function l06() {
  const sessions = agentSessions();
  check('the agent loaded the starter skill witness-an-order by itself (session recording)', sessions.some((x) => skillsLoaded(x).includes('witness-an-order')),
    sessions.length ? `${sessions.length} recorded sessions` : 'no agent sessions recorded in this repo yet');
  const skillPath = '.agents/skills/prove-a-defect/SKILL.md';
  const skill = read(skillPath);
  const fm = skill.match(/^---\s*\n([\s\S]*?)\n---/);
  check(`your skill exists: ${skillPath}`, skill);
  check('its front matter names it prove-a-defect', /^name:\s*prove-a-defect\s*$/m.test(fm?.[1] ?? ''));
  const desc = (fm?.[1] ?? '').match(/^description:\s*(.+)$/m)?.[1] ?? '';
  check('its description says WHEN to use it (at least 60 characters, mentions a defect or bug)', desc.length >= 60 && /defect|bug|issue/i.test(desc), `${desc.length} characters`);
  check('its steps send the agent to the witness receipt (artifacts/witness)', /artifacts\/witness/.test(skill));
  check('it forbids invented ids (ids come from the receipt)', /receipt/i.test(skill) && /(never|do not|don't).{0,40}(invent|memory|guess)|from the receipt/i.test(skill));
  const allowed = /"Skill\(prove-a-defect\)"/.test(read('.qwen/settings.json'));
  check('you allowed it in .qwen/settings.json ("Skill(prove-a-defect)")', allowed);
  const before = read('artifacts/L06/defect-before.md');
  const after = read('artifacts/L06/defect-after.md');
  check('artifacts/L06/defect-before.md exists (the run without your skill)', before);
  check('the before run happened before your skill existed', before && mtime('artifacts/L06/defect-before.md') < mtime(skillPath));
  const used = sessions.filter((x) => skillsLoaded(x).includes('prove-a-defect'));
  check('the agent loaded YOUR skill (session recording, not its own words)', used.length > 0, used.length ? `session ${used.at(-1).id.slice(0, 8)}` : 'no session loaded prove-a-defect');
  check('artifacts/L06/defect-after.md exists (the run with your skill)', after);
  if (before && after) {
    const b = scoreDefect(before);
    const a = scoreDefect(after);
    console.log(`Defect rubric: before ${b.score}/${b.of}${b.missing.length ? ` (missing: ${b.missing.join('; ')})` : ''}`);
    console.log(`Defect rubric: after  ${a.score}/${a.of}${a.missing.length ? ` (missing: ${a.missing.join('; ')})` : ''}`);
    check('with your skill the report scores at least 8 of 9 on the defect rubric', a.score >= 8, `${a.score}/${a.of}`);
    check('with your skill the report is at least as complete as without it', a.score >= b.score, `before ${b.score}, after ${a.score}`);
    const beforeSession = sessions.filter((x) => !skillsLoaded(x).includes('prove-a-defect') && x.mtime <= mtime('artifacts/L06/defect-before.md') + 5000).at(-1);
    console.log(`Agent effort (from its session recordings): without your skill ${sessionCost(beforeSession)}, with it ${sessionCost(used.at(-1))}.`);
  }
  const review = read('artifacts/L06/skill-review.md');
  check('artifacts/L06/skill-review.md: you reviewed the teammate\'s skill before installing it', review);
  check('your review catches the wrong threshold ($75 vs $100.00) and checks the live store or PRICE-3', /75/.test(review) && /100|PRICE-3|npm run rules|truth/i.test(review));
  check('your review catches the instruction to fake a PASS', /pass(ed)?|green|fake|mark/i.test(review) && /(witness|fail|lie|hide|fake)/i.test(review));
  check('you did not install it (free-shipping-checker is not in .agents/skills or the allow list)', !existsSync('.agents/skills/free-shipping-checker') && !/free-shipping-checker/.test(read('.qwen/settings.json')));
  const ref = read('.catchup/L06.sha256').trim();
  if (ref && ref === sha(skillPath)) console.log('Note: your skill is the catch-up reference (npm run catchup -- L06). Rewrite it in your own words to own it.');
}

function l07() {
  check('mcp/ledger/server.ts exists (L05)', existsSync('mcp/ledger/server.ts'));
  const r = spawnSync('node', ['scripts/mcp-smoke.mjs'], { encoding: 'utf8' });
  const out = r.stdout ?? '';
  check('MCP smoke check passes (node scripts/mcp-smoke.mjs)', r.status === 0, out.split('\n').filter((l) => l.startsWith('FAIL')).join(' | '));
  check('your server has the second tool, get_rules, and it returns the live rules', /PASS\s+get_rules returns the live store's rules/.test(out));
  const server = read('mcp/ledger/server.ts');
  check('the server marks its tools read-only (annotations readOnlyHint)', /readOnlyHint:\s*true/.test(server));
  check('and the read-only hint is backed by code: the database is opened read-only', /readOnly:\s*true/.test(server));
  const calls = read('artifacts/L05/calls.log').split('\n');
  check('your server logged a get_rules call (artifacts/L05/calls.log)', calls.some((l) => / get_rules /.test(l)));
  const sessions = agentSessions();
  const usedRules = sessions.filter((x) => mcpCalls(x).some((c) => c.server === 'ledger' && c.tool === 'get_rules'));
  check('the agent called get_rules (session recording, not its own words)', usedRules.length > 0, usedRules.length ? `session ${usedRules.at(-1).id.slice(0, 8)}` : 'no session called ledger.get_rules');
  const boundary = read('artifacts/L07/boundary.md');
  check('artifacts/L07/boundary.md exists', boundary);
  check('the boundary is built on the live threshold, $100.00, and cites PRICE-3', /\$?100\.00|\b10000\b/.test(boundary) && /PRICE-3/.test(boundary));
  check('no test case expects free shipping at $75', !/\|\s*\$?75\.00[^|]*\|[^\n]*\$?0\.00/.test(boundary));
  const skill = read('.agents/skills/prove-a-defect/SKILL.md');
  check('your prove-a-defect skill now uses the find_orders tool', /find_orders/.test(skill));
  const both = sessions.filter((x) => skillsLoaded(x).includes('prove-a-defect') && mcpCalls(x).some((c) => c.server === 'ledger' && c.tool === 'find_orders'));
  check('one agent session loaded your skill AND called find_orders (session recording)', both.length > 0, both.length ? `session ${both.at(-1).id.slice(0, 8)}` : 'not yet');
  const defect = read('artifacts/L07/defect-with-tool.md');
  check('artifacts/L07/defect-with-tool.md exists', defect);
  if (defect) {
    const d = scoreDefect(defect);
    check('the defect report scores at least 8 of 9 on the defect rubric', d.score >= 8, `${d.score}/${d.of}${d.missing.length ? `; missing: ${d.missing.join('; ')}` : ''}`);
  }
  const design = read('artifacts/L07/tool-design.md');
  check('artifacts/L07/tool-design.md exists', design);
  check('it says what makes your tools read-only in code, not just in the hint', /read-?only|readOnly/i.test(design) && /(code|line|open|database|sqlite|fetch|GET)/i.test(design));
  check('it says what a refund tool needs before you allow it (approval)', /refund/i.test(design) && /approv|ask|confirm/i.test(design));
  check('it names a job where you would not use MCP', /(not|wouldn't|would not|instead)/i.test(design) && /(script|api|curl|cli|command)/i.test(design));
}


// L10: context and cited test cases. Every agent claim is checked against the runtime's recordings, the files the
// plain scripts wrote, and ZincTM itself; never against what an agent said about its own work.
async function l10() {
  const defs = new Map(agentDefinitions().map((a) => [a.name, a]));
  const runs = allSubagentRuns();
  const ranAs = (name) => runs.filter((r) => r.name === name);
  const toolsRun = (name) => ranAs(name).flatMap((r) => r.calls.filter((c) => c.ok).map((c) => c.name));
  const ruleIds = (text) => new Set(String(text).match(/\b(CAT|CART|PRICE|PAY|ORD|CRM|WH)-\d+\b/g) ?? []);

  // 1. The researcher: read-only by definition AND by recording, and it wrote down what it found.
  const ctx = read(P.context);
  check('team-context.md exists', ctx.length > 300, `${ctx.length} characters`);
  const outline = ['what the product does', 'rules', 'test data', 'known bugs', 'open questions', 'sources'];
  const missing = outline.filter((h) => !new RegExp(`^##[^\\n]*${h}`, 'im').test(ctx));
  check('it follows the team outline', ctx && !missing.length, missing.length ? `missing: ${missing.join(', ')}` : 'all six sections');
  check('it cites at least 5 PRD rules', ruleIds(ctx).size >= 5, `${ruleIds(ctx).size} rules`);
  const sources = ctx.split(/^##[^\n]*sources/im)[1] ?? '';
  check('its sources include PRD.md and ZincTM', /PRD\.md/.test(sources) && /tm_|zinctm/i.test(sources));
  const rDef = defs.get('context-researcher');
  const rWrites = (rDef?.tools ?? []).filter(isWriteTool);
  check('the researcher is read-only by definition (no tool in its list can change anything)', rDef && !rWrites.length, rDef ? rWrites.join(', ') || `${rDef.tools.length} read tools` : 'no .qwen/agents/context-researcher.md');
  check('the context-researcher agent ran (runtime recording)', ranAs('context-researcher').length > 0, `${ranAs('context-researcher').length} run(s)`);
  const rUsed = toolsRun('context-researcher');
  check('it ran only read tools (recording)', rUsed.length && !rUsed.some(isWriteTool), [...new Set(rUsed)].join(', '));
  check('it read ZincTM (recording)', rUsed.some((n) => n.startsWith('mcp__zinctm__')));

  // 2. The plan.
  const plan = read(P.plan);
  check('pipeline/test-plan.md exists', plan);
  check('the plan traces at least 8 PRD rules', ruleIds(plan).size >= 8, `${ruleIds(plan).size} rules`);
  const questions = (plan.split(/^##[^\n]*questions/im)[1] ?? '').split('\n').filter((l) => /\?\s*\**\s*$/.test(l));
  check('the plan asks the team at least 2 questions', questions.length >= 2, `${questions.length} question(s)`);
  check('the test-plan-creator agent wrote it (recording)', toolsRun('test-plan-creator').includes('write_file'));

  // 3. The cases, including the uncited one you seeded.
  const { data, error } = readAgentJson(P.cases);
  const cases = casesOf(data);
  check('pipeline/cases.json is valid JSON with at least 5 cases', !error && cases.length >= 5, error ?? `${cases.length} cases`);
  check('the test-case-creator agent wrote it (recording)', toolsRun('test-case-creator').includes('write_file'));
  const seeded = cases.find((c) => String(c.id).toUpperCase() === 'TC-99');
  check('you seeded the uncited case TC-99 (step 3)', seeded && !caseRules(seeded).length);

  // 4. The evaluator: separate agent, different model, and it caught what a script can prove is wrong.
  const ev = new Map(casesOf(readAgentJson(P.evaluation).data).map((e) => [e.id, e]));
  check('pipeline/evaluation.json has a verdict for every case', cases.length && cases.every((c) => ev.has(c.id)), `${ev.size} verdicts for ${cases.length} cases`);
  check('the case-evaluator agent wrote it (recording)', toolsRun('case-evaluator').includes('write_file'));
  const evModel = defs.get('case-evaluator')?.model;
  const tcModel = defs.get('test-case-creator')?.model;
  check('the evaluator runs on a different model than the case writer (fresh eyes)', evModel && tcModel && evModel !== tcModel, `${evModel} vs ${tcModel}`);
  check('the evaluator rejected TC-99', ev.get(seeded?.id)?.verdict?.toLowerCase() === 'reject');
  const problems = caseProblems(cases);
  const uncited = cases.filter((c) => problems.get(c.id).some((p) => /rule/.test(p)));
  check('every case that cites no real rule was rejected', uncited.every((c) => ev.get(c.id)?.verdict?.toLowerCase() === 'reject'), uncited.map((c) => c.id).join(', ') || 'none');
  check('pipeline/rtm.md was rebuilt by npm run rtm after the evaluation', existsSync(P.rtm) && mtime(P.rtm) >= mtime(P.evaluation));

  // 5. The human gate.
  const ap = readAgentJson(P.approvals).data ?? {};
  const decisions = ap.decisions ?? [];
  check('pipeline/approvals.json was written by npm run review', ap.reviewer && ap.publishLabel && Array.isArray(ap.decisions));
  const rejected = decisions.filter((d) => d.decision === 'reject');
  const approved = decisions.filter((d) => d.decision === 'approve').map((d) => d.id);
  check('you rejected at least one case, with a reason', rejected.length > 0 && rejected.every((d) => (d.reason ?? '').length >= 10), `${rejected.length} rejected`);
  check('you approved at least 3 cases', approved.length >= 3, `${approved.length} approved`);
  const bad = approved.filter((id) => { const c = cases.find((x) => x.id === id); return !c || problems.get(c.id).some((p) => /rule/.test(p)); });
  check('no approved case is uncited', !bad.length, bad.join(', '));

  // 6. The publisher: one write tool, used only for approved cases, and ZincTM agrees.
  const pDef = defs.get('publisher');
  const pWrites = (pDef?.tools ?? []).filter(isWriteTool);
  check('the publisher has exactly one tool that changes anything: tm_create_test_case', pWrites.length === 1 && /tm_create_test_case$/.test(pWrites[0]), pWrites.join(', ') || 'none');
  const pUsed = toolsRun('publisher');
  check('the publisher created cases in ZincTM (recording)', pUsed.some((n) => /tm_create_test_case$/.test(n)), `${pUsed.filter((n) => /tm_create_test_case$/.test(n)).length} created`);
  const z = await zinctmSession();
  check('ZincTM sign-in with your cydeo login', z.ok, z.ok ? '' : `${z.step}: ${z.why}`);
  if (z.ok && ap.publishLabel) {
    const list = await z.get('/api/test-cases');
    const mine = (list.data?.testCases ?? []).filter((t) => (t.labels ?? []).includes(ap.publishLabel));
    const ids = new Set(mine.flatMap((t) => (t.labels ?? []).filter((l) => /^TC-\d+$/i.test(l)).map((l) => l.toUpperCase())));
    const notThere = approved.filter((id) => !ids.has(String(id).toUpperCase()));
    check('ZincTM holds every case you approved', approved.length && !notThere.length, notThere.length ? `missing: ${notThere.join(', ')}` : `${mine.length} case(s) labeled ${ap.publishLabel}`);
    const leaked = rejected.filter((d) => ids.has(String(d.id).toUpperCase())).map((d) => d.id);
    check('ZincTM holds none of the cases you rejected', !leaked.length, leaked.join(', '));
    // ZincTM stores labels in lower case (price-3), so compare without case.
    check('every published case carries its PRD rule as a label', mine.length && mine.every((t) => (t.labels ?? []).some((l) => /^(cat|cart|price|pay|ord|crm|wh)-\d+$/i.test(l))));
  }

  // What each agent cost, from the runtime's usage record (one model per agent, so a model row is an agent row).
  const usage = {};
  for (const s of agentSessions()) for (const [m, u] of Object.entries(s.usage?.models ?? {})) { const c = costOf(m, u); usage[m] = (usage[m] ?? 0) + (c.dollars ?? 0); }
  for (const d of defs.values()) if (d.model) console.log(`Agent ${d.name.padEnd(19)} model ${d.model.padEnd(32)} ${ranAs(d.name).length} run(s)  ${money(usage[d.model] ?? 0)} so far (list price, npm run cost for detail)`);
}

// L11: automation and the planted defect. The run's own files (Playwright's report, the evidence it kept, runs.log),
// the runtime's recordings of each agent, the healer gate and ZincTM decide; never an agent's summary.
async function l11() {
  const defs = new Map(agentDefinitions().map((a) => [a.name, a]));
  const runs = allSubagentRuns();
  const ranAs = (name) => runs.filter((r) => r.name === name);
  const callsOf = (name) => ranAs(name).flatMap((r) => r.calls.filter((c) => c.ok));
  const pathOf = (c) => String(c.args.file_path ?? c.args.absolute_path ?? c.args.path ?? '');

  // 1. Four agents, each with only the tools its job needs.
  const missingDefs = LAB_AGENTS.L11.filter((n) => !defs.get(n)?.model);
  check('the four L11 agents are defined, each with a model', !missingDefs.length, missingDefs.length ? `missing: ${missingDefs.join(', ')}` : LAB_AGENTS.L11.map((n) => `${n}: ${defs.get(n).model}`).join('; '));
  const writesOf = (n) => (defs.get(n)?.tools ?? []).filter(isWriteTool);
  const dWrites = writesOf('defect-reporter');
  check('the defect-reporter has exactly one tool that changes anything: tm_file_defect', dWrites.length === 1 && /tm_file_defect$/.test(dWrites[0]), dWrites.join(', ') || 'none');
  const iWrites = writesOf('failure-investigator');
  check('the failure-investigator is read-only by definition (it judges the evidence and cannot change it)', defs.get('failure-investigator') && !iWrites.length, iWrites.join(', ') || 'read tools only');
  const hTools = defs.get('test-healer')?.tools ?? [];
  check('the test-healer has no ZincTM tools and cannot create files', hTools.length && !hTools.some((t) => t.startsWith('mcp__') || t === 'write_file'), hTools.join(', '));

  // 2. The specs: one per approved case, safe to run unreviewed, written and run by the automation-engineer.
  const files = specFiles();
  const specs = files.map(parseSpec);
  const tests = specs.flatMap((s) => s.tests.map((x) => ({ ...x, file: s.file })));
  const decisions = readAgentJson(P.approvals).data?.decisions ?? [];
  const approved = new Set(decisions.filter((d) => d.decision === 'approve').map((d) => String(d.id).toUpperCase()));
  const caseIds = [...new Set(tests.map((x) => x.caseId).filter((id) => id && approved.has(id)))];
  check('at least 3 tests in tests/lab/L11, each named after an approved case', caseIds.length >= 3, `${tests.length} test(s), approved cases: ${caseIds.join(', ') || 'none'}`);
  const unsafe = specs.flatMap((s) => unsafeReasons(s).map((r) => `${s.file}: ${r}`));
  check('every spec imports only @playwright/test and leaves the machine alone', files.length && !unsafe.length, unsafe.join('; '));
  const aCalls = callsOf('automation-engineer');
  const wroteSpecs = aCalls.filter((c) => ['write_file', 'edit', 'replace'].includes(c.name) && /tests\/lab\/L11\//.test(pathOf(c)));
  check('the automation-engineer wrote the specs (recording)', wroteSpecs.length > 0, `${wroteSpecs.length} write(s) in tests/lab/L11`);
  check('the automation-engineer ran them with npm run spec (recording)', aCalls.some((c) => c.name === 'run_shell_command' && /npm run spec\b/.test(String(c.args.command ?? ''))));

  // 3. The run: a planted bug caught, with evidence kept.
  const log = read(`${L11_OUT}/runs.log`).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const lastRunOf = (title) => [...log].reverse().find((r) => r.tests.some((x) => x.title === title));
  const resultIn = (run, title) => run?.tests.find((x) => x.title === title);
  const stale = files.filter((f) => { const r = [...log].reverse().find((x) => x.files.some((g) => g.endsWith(f.split('/').pop()))); return !r || Date.parse(r.at) < mtime(f) - 1000; });
  check('your last npm run spec ran the specs as they are now', files.length && !stale.length, stale.length ? `changed since their last run: ${stale.join(', ')}` : `${log.length} run(s) in ${L11_OUT}/runs.log`);
  const cents = (s) => { const m = moneyIn(s)[0]; return m ? Math.round(Number(m.slice(1)) * 100) : null; };
  const planted = (x) => {
    const e = cents(x.expected);
    const r = cents(x.received);
    if (e != null && r != null && r - e === 799) return 'B: free shipping at exactly $100.00 is charged anyway';
    if (e != null && r != null && Math.abs(r - e) === 1) return 'A: the AGENT10 discount is cut instead of rounded';
    if (/LEAD/.test(x.expected ?? '') && /ACTIVE_CUSTOMER/.test(x.received ?? '')) return 'C: a failed payment makes the customer active';
    return null;
  };
  const caught = log.flatMap((r) => r.tests.filter((x) => x.kind === 'assertion' && planted(x)).map((x) => ({ ...x, at: r.at, bug: planted(x) })));
  const first = caught[0];
  check('a planted bug caught: a test reached the element and got the wrong value', first, first ? `${first.title.split(' ')[0]}: expected ${first.expected}, received ${first.received} -> planted bug ${first.bug}` : 'no assertion failure that matches bug A, B or C yet');
  if (first) {
    const ev = first.evidence ?? {};
    check('its trace and screenshot were kept as evidence', ev.trace && existsSync(ev.trace) && ev.screenshot && existsSync(ev.screenshot), `${ev.trace ?? 'no trace'}; ${ev.screenshot ?? 'no screenshot'}`);
  }

  // 4. The investigation: product or test, decided from the evidence by a separate agent.
  const inv = verdictsOf(readAgentJson(P.investigation).data);
  const verdict = first && inv.find((x) => x.caseId === first.title.split(' ')[0].toUpperCase());
  check('pipeline/investigation.json calls that failure a product bug and cites the rule', verdict && verdict.verdict === 'product' && /\b(CAT|CART|PRICE|PAY|ORD|CRM|WH)-\d+\b/.test(String(verdict.rule ?? '')), verdict ? `${verdict.verdict}, ${verdict.rule}` : 'no verdict for it');
  // The investigator only reads, so the main session saved its answer. The saved verdicts must be the ones it returned.
  const returned = ranAs('failure-investigator').map((r) => verdictsOf(jsonIn(finalText(r))));
  const same = (a, b) => a.length === b.length && a.every((x) => b.some((y) => y.caseId === x.caseId && y.verdict === x.verdict));
  check('pipeline/investigation.json holds exactly the verdicts the failure-investigator returned (recording)', inv.length && returned.some((r) => same(r, inv)), `${ranAs('failure-investigator').length} investigator run(s)`);

  // 5. The defect, filed by the one agent allowed to, and ZincTM agrees.
  const filed = defectsOf(readAgentJson(P.defects).data);
  check('pipeline/defects.json lists the defect ZincTM created', filed.length > 0, filed.map((d) => d.key ?? d.defectId).join(', ') || 'none');
  const dCalls = callsOf('defect-reporter');
  check('the defect-reporter filed it with tm_file_defect, and changed nothing else (recording)', dCalls.some((c) => /tm_file_defect$/.test(c.name)) && !dCalls.some((c) => isWriteTool(c.name) && !/tm_file_defect$/.test(c.name)), `${dCalls.filter((c) => /tm_file_defect$/.test(c.name)).length} filed`);

  // 6. The healer drill: red for a test reason, healed by the healer, assertions untouched.
  const basePath = `${L11_OUT}/heal-baseline.json`;
  const base = existsSync(basePath) ? JSON.parse(read(basePath)) : null;
  check('you ran the drill (npm run drill)', base, base ? `${base.file}: ${base.from} -> ${base.to}` : `no ${basePath}`);
  if (base) {
    const drilled = Object.entries(base.tests).filter(([, v]) => v.file === base.file).map(([title]) => title);
    const redAfter = log.some((r) => Date.parse(r.at) > Date.parse(base.at) && r.tests.some((x) => drilled.includes(x.title) && x.kind === 'locator'));
    check('the drill turned a test red for a test reason (Kind: locator)', redAfter);
    // Compare file names without case: macOS accepts TC-05.spec.ts for tc-05.spec.ts.
    const healed = callsOf('test-healer').filter((c) => ['edit', 'replace', 'write_file'].includes(c.name) && pathOf(c).toLowerCase().endsWith(base.file.split('/').pop().toLowerCase()) && Date.parse(c.at) > Date.parse(base.at));
    check('the test-healer repaired it (recording)', healed.length > 0, `${healed.length} edit(s) to ${base.file}`);
    const now = drilled.map((title) => resultIn(lastRunOf(title), title));
    check('the healed test passes again in your last run', now.length && now.every((x) => x?.status === 'passed'), now.map((x) => `${x?.title.split(' ')[0]}: ${x?.status ?? 'not run'}`).join(', '));
  }
  if (first) {
    const latest = resultIn(lastRunOf(first.title), first.title);
    check('the planted-bug test is still red in your last run, with the same expected value', latest?.kind === 'assertion' && latest.expected === first.expected, latest ? `${latest.status}, expected ${latest.expected ?? '-'}` : 'not run');
  }
  for (const g of healGate()) check(`gate: ${g.name}`, g.ok, g.detail);

  // 7. ZincTM: specs linked to their cases, the defect labeled and linked, the cases unchanged since publishing.
  const pub = new Map(casesOf(readAgentJson(P.published).data).map((x) => [String(x.id).toUpperCase(), x.zinctmId]));
  const label = readAgentJson(P.approvals).data?.publishLabel;
  const z = await zinctmSession();
  check('ZincTM sign-in with your cydeo login', z.ok, z.ok ? '' : `${z.step}: ${z.why}`);
  if (z.ok) {
    const scripts = (await z.get('/api/scripts')).data?.scripts ?? [];
    const unlinked = caseIds.filter((id) => !scripts.some((s) => s.testCaseId === pub.get(id) && /tests\/lab\/L11\//.test(s.filePath ?? '')));
    const linked = caseIds.length - unlinked.length;
    check('ZincTM links at least 3 automated cases to their specs (tm_link_script)', linked >= 3, `${linked} linked${unlinked.length ? `; not linked: ${unlinked.join(', ')}${unlinked.some((id) => !pub.get(id)) ? ' (no zinctmId in pipeline/published.json)' : ''}` : ''}`);
    const defects = (await z.get('/api/defects')).data?.defects ?? [];
    const mine = defects.filter((d) => filed.some((f) => f.defectId === d.id || f.key === d.key));
    const d = mine[0];
    check('ZincTM holds the defect, labeled with your run', d && (d.labels ?? []).map((l) => l.toLowerCase()).includes(String(label).toLowerCase()), d ? `${d.key}: ${d.title}` : 'not found in ZincTM');
    if (d && first) {
      const caseId = first.title.split(' ')[0].toUpperCase();
      check('the defect is linked to the case whose test caught it', pub.get(caseId) ? d.testCaseId === pub.get(caseId) : false, pub.get(caseId) ? `${caseId} -> ${d.testCaseId ?? 'no link'}` : `${caseId} has no zinctmId in pipeline/published.json`);
      check('the defect has expected vs actual with the values, and points to the trace and screenshot', moneyIn(d.expectedResult).length + moneyIn(d.actualResult).length >= 2 || (/LEAD/.test(d.expectedResult ?? '') && /ACTIVE_CUSTOMER/.test(d.actualResult ?? '')), `expected: ${d.expectedResult ?? '-'} | actual: ${d.actualResult ?? '-'}`);
      check('the defect names the trace and the screenshot files', /trace\.zip/.test(`${d.description} ${d.stepsToReproduce}`) && /screenshot\.png/.test(`${d.description} ${d.stepsToReproduce}`));
    }
    const list = (await z.get('/api/test-cases')).data?.testCases ?? [];
    const cases = new Map(casesOf(readAgentJson(P.cases).data).map((x) => [String(x.id).toUpperCase(), x]));
    // A case may change after publishing only through the person: fixed by hand and approved again (npm run review).
    const asApproved = new Map(decisions.filter((x) => x.decision === 'approve' && typeof x.expected === 'string').map((x) => [String(x.id).toUpperCase(), x.expected]));
    const expectedOf = (id) => cases.get(id)?.expected ?? cases.get(id)?.expectedResult;
    const drifted = caseIds.filter((id) => { const t = list.find((x) => x.id === pub.get(id)); return t && cases.get(id) && t.expectedResult !== expectedOf(id); });
    const unreviewed = drifted.filter((id) => asApproved.get(id) !== expectedOf(id));
    check('every automated case still says what ZincTM published, or you approved the change (nobody rewrote a case to match the app)', caseIds.length && !unreviewed.length,
      unreviewed.length ? `changed without your approval: ${unreviewed.join(', ')}` : drifted.length ? `re-approved by you: ${drifted.join(', ')}; update them in ZincTM too, so the record matches` : '');
  }

  // 8. The cost sheet adds up, and each agent ran on its own model.
  const sheetPath = costPath('L11');
  const sheet = read(sheetPath);
  const l11Sessions = agentSessions().filter((s) => s.subagents.some((r) => LAB_AGENTS.L11.includes(r.name)));
  const lastEnd = Math.max(0, ...l11Sessions.map((s) => Date.parse(s.end ?? s.start)));
  check(`${sheetPath} exists, made after your last L11 agent run (npm run cost -- L11)`, sheet && mtime(sheetPath) >= lastEnd - 1000, sheet ? '' : 'not yet');
  if (sheet) {
    const rowCosts = [...sheet.matchAll(/^\|[^\n]*\|\s*\$([\d.]+)\s*\|\s*[\d-]+\s*\|\s*$/gm)].map((m) => Number(m[1]));
    const stated = Number(sheet.match(/\*\*Total: \$([\d.]+)\*\*/)?.[1] ?? NaN);
    let actual = 0;
    for (const s of l11Sessions) for (const [m, u] of Object.entries(s.usage?.models ?? {})) actual += costOf(m, u).dollars ?? 0;
    check('the cost sheet adds up: its rows sum to its total, and the total matches the runtime\'s usage record', rowCosts.length && Math.abs(rowCosts.reduce((a, b) => a + b, 0) - stated) <= 0.005 * rowCosts.length + 0.006 && Math.abs(stated - actual) < 0.011, `rows ${money(rowCosts.reduce((a, b) => a + b, 0))}, total ${money(stated)}, usage record ${money(actual)}`);
  }
  const offModel = LAB_AGENTS.L11.filter((n) => defs.get(n)?.model && ranAs(n).length && !l11Sessions.some((s) => s.subagents.some((r) => r.name === n) && s.usage?.models?.[defs.get(n).model]));
  check('each L11 agent ran on its declared model (usage record)', LAB_AGENTS.L11.every((n) => ranAs(n).length) && !offModel.length, LAB_AGENTS.L11.map((n) => `${n} ${ranAs(n).length} run(s)`).join(', ') + (offModel.length ? `; no usage on the declared model: ${offModel.join(', ')} (end each session with /quit)` : ''));
  if (first) console.log(`Caught: planted bug ${first.bug}`);
  for (const k of [...log].reverse().slice(0, 1)) console.log(`Last run ${k.at}: ${k.tests.filter((x) => x.status === 'passed').length} passed, ${k.tests.filter((x) => x.status !== 'passed').length} failed (${k.tests.map((x) => `${x.title.split(' ')[0]} ${x.status === 'passed' ? 'passed' : x.kind}`).join(', ')})`);
}

const LABS = { L00: l00, L01: l01, L02: l02, L03: l03, L04: l04, L05: l05, L06: l06, L07: l07, L10: l10, L11: l11 };
if (!LABS[lab]) {
  console.log(`Usage: npm run check:lab -- <${Object.keys(LABS).join('|')}>`);
  process.exit(2);
}
await LABS[lab]();
console.log(`\nProof check ${lab}\n`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n${failedCount ? `${failedCount} missing. Fix and re-run.` : 'All proof present.'}\n`);
process.exit(failedCount ? 1 : 0);
