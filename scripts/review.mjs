#!/usr/bin/env node
/**
 * The human gate. Run: npm run review      (yourself, in a terminal: an agent cannot run it for you)
 * Shows every case with the rule it cites, the evaluator's verdict and anything the script flags, and asks you
 * to approve or reject it. A rejection needs a reason. Writes pipeline/approvals.json, which is the only thing
 * the publisher agent is allowed to publish from. It keeps each approved case's expected result as you saw it.
 * Run it again after you fix a case: it asks only about cases that are new or changed since you approved them
 * (npm run review -- all asks about every case again).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { P, caseProblems, caseRules, casesOf, prdRules, publishLabel, readAgentJson } from './lib/pipeline.mjs';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.log('The human gate needs a person at a terminal. Run `npm run review` yourself, not through the agent.');
  process.exit(2);
}
const rules = prdRules();
const { data, error } = readAgentJson(P.cases);
if (error) { console.log(`${error}. Run the earlier steps of labs/L10 first.`); process.exit(1); }
const cases = casesOf(data);
const previous = readAgentJson(P.approvals).data;
const kept = [];
let toReview = cases;
if (previous?.decisions?.length && process.argv[2] !== 'all') {
  const before = new Map(previous.decisions.map((d) => [d.id, d]));
  const changed = (c) => { const d = before.get(c.id); return !d || (d.decision === 'approve' && typeof d.expected === 'string' && d.expected !== (c.expected ?? c.expectedResult ?? '')); };
  toReview = cases.filter(changed);
  kept.push(...previous.decisions.filter((d) => cases.some((c) => c.id === d.id && !changed(c))));
  if (!toReview.length) { console.log('Nothing new or changed since your last review. To review every case again: npm run review -- all'); process.exit(0); }
  console.log(`\nRe-review: ${toReview.length} case(s) new or changed since your last review (${toReview.map((c) => c.id).join(', ')}). Your other ${kept.length} decision(s) stay.`);
}
const evaluation = new Map(casesOf(readAgentJson(P.evaluation).data).map((e) => [e.id, e]));
const problems = caseProblems(cases, rules);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const decisions = [];
// Ctrl+D or Ctrl+C ends the review early: what you decided so far is still saved.
const ask = async (q) => { try { return await rl.question(q); } catch { return null; } };

console.log(`\nHuman gate: ${toReview.length} cases. For each one: a = approve, r = reject (with a reason), s = skip for now, q = stop.\n`);
for (const [i, c] of toReview.entries()) {
  const cited = caseRules(c);
  const ev = evaluation.get(c.id);
  console.log(`──── ${i + 1}/${toReview.length}  ${c.id}  ${c.title ?? '(no title)'}`);
  for (const r of cited) console.log(`  rule      ${r}: ${rules.get(r) ?? 'NOT IN THE PRD'}`);
  if (!cited.length) console.log('  rule      none cited');
  if (c.preconditions) console.log(`  given     ${c.preconditions}`);
  (c.steps ?? []).forEach((s, n) => console.log(`  step ${n + 1}    ${s}`));
  console.log(`  expected  ${c.expected ?? c.expectedResult ?? '(none)'}`);
  console.log(`  evaluator ${ev ? `${ev.verdict}: ${ev.reason ?? ''}` : 'not evaluated'}`);
  const flags = problems.get(c.id) ?? [];
  if (flags.length) console.log(`  script    ${flags.join('; ')}`);
  let answer = '';
  while (!['a', 'r', 's', 'q'].includes(answer)) {
    const line = await ask('  approve / reject / skip / quit [a/r/s/q]: ');
    answer = line === null ? 'q' : line.trim().toLowerCase().slice(0, 1);
  }
  if (answer === 'q') break;
  if (answer === 's') continue;
  if (answer === 'a') { decisions.push({ id: c.id, decision: 'approve', reason: '', expected: c.expected ?? c.expectedResult ?? '' }); continue; }
  let reason = '';
  while (reason !== null && reason.length < 10) { const line = await ask('  why is it wrong? (at least 10 characters): '); reason = line === null ? null : line.trim(); }
  if (reason === null) break;
  decisions.push({ id: c.id, decision: 'reject', reason });
}
rl.close();

const reviewer = spawnSync('git', ['config', 'user.name'], { encoding: 'utf8' }).stdout.trim() || process.env.GITHUB_USER || 'unknown';
decisions.unshift(...kept);
const approved = decisions.filter((d) => d.decision === 'approve').length;
const rejected = decisions.length - approved;
mkdirSync('pipeline', { recursive: true });
writeFileSync(P.approvals, JSON.stringify({ reviewer, reviewedAt: new Date().toISOString(), publishLabel: previous?.publishLabel ?? publishLabel(), decisions }, null, 2) + '\n');
console.log(`\nSaved ${P.approvals}: ${approved} approved, ${rejected} rejected, ${cases.length - decisions.length} not decided.`);
if (!rejected) console.log('Note: the lab asks you to reject at least one case, with the reason. A gate that approves everything is not checking.');
console.log(previous?.decisions?.length && process.argv[2] !== 'all'
  ? 'Next: ask the automation-engineer to bring the spec of each changed case in line with the case (labs/L11).\n'
  : 'Next: ask the agent to use the publisher agent (labs/L10, step 5).\n');
