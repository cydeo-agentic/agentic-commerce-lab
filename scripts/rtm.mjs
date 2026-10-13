#!/usr/bin/env node
/**
 * Requirements traceability matrix, built by a plain script from the files the agents wrote. Run: npm run rtm
 * Every PRD rule, the cases that cite it, and what the evaluator decided. It also flags cases a script can catch
 * without any AI: no rule cited, a rule that does not exist, nothing exact to check, invented test ids, duplicates.
 * Writes pipeline/rtm.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { P, caseProblems, caseRules, casesOf, prdRules, readAgentJson } from './lib/pipeline.mjs';

const rules = prdRules();
const { data, error } = readAgentJson(P.cases);
if (error) {
  console.log(`${error}. Run the test-case-creator step first (labs/L10).`);
  process.exit(1);
}
const cases = casesOf(data);
const evaluation = new Map(casesOf(readAgentJson(P.evaluation).data).map((e) => [e.id, e]));
const problems = caseProblems(cases, rules);
const verdict = (id) => evaluation.get(id)?.verdict?.toLowerCase() ?? 'not evaluated';

const lines = ['# Requirements traceability matrix', '', `Built by \`npm run rtm\` from ${P.cases}${evaluation.size ? ` and ${P.evaluation}` : ''} on ${new Date().toISOString().slice(0, 16)}Z. No AI was used to build it.`, ''];
lines.push('| Rule | Requirement | Cases (evaluator verdict) |', '|---|---|---|');
let covered = 0;
for (const [id, text] of rules) {
  const citing = cases.filter((c) => caseRules(c).includes(id));
  const accepted = citing.filter((c) => verdict(c.id) === 'accept');
  if (accepted.length || (!evaluation.size && citing.length)) covered++;
  lines.push(`| ${id} | ${text.replace(/\|/g, '/').slice(0, 90)} | ${citing.length ? citing.map((c) => `${c.id} (${verdict(c.id)})`).join(', ') : '**none**'} |`);
}
const flagged = cases.filter((c) => problems.get(c.id)?.length);
lines.push('', `## Coverage`, '', `${covered} of ${rules.size} rules have ${evaluation.size ? 'an accepted' : 'a'} case.`, '');
lines.push('## Cases a script flags', '');
if (!flagged.length) lines.push('None.');
for (const c of flagged) lines.push(`- **${c.id}** ${c.title ?? ''}: ${problems.get(c.id).join('; ')}. Evaluator: ${verdict(c.id)}.`);
const missed = flagged.filter((c) => verdict(c.id) === 'accept');
if (missed.length) lines.push('', `**The evaluator accepted ${missed.length} case(s) the script flags:** ${missed.map((c) => c.id).join(', ')}. A person should look at these first.`);

mkdirSync('pipeline', { recursive: true });
writeFileSync(P.rtm, lines.join('\n') + '\n');
console.log(lines.slice(4).join('\n'));
console.log(`\nSaved ${P.rtm}`);
