#!/usr/bin/env node
/**
 * What did the agents cost? Run: npm run cost              (every session in this repo)
 *                                npm run cost -- L11       (only the sessions that ran one of that lab's agents)
 *                                npm run cost -- 2026-10-16  (sessions since that date)
 * Reads the runtime's usage record (models, requests, tokens, time) and prices it at list price. Each model is
 * matched to the agents in .qwen/agents that declare it, so with one model per agent you get cost per agent. Agent
 * minutes come from the runtime's recording of each subagent run.
 * Writes pipeline/cost.md (or pipeline/cost-L11.md for a lab).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PRICES, agentDefinitions, agentSessions, costOf, money } from './lib/agent-trace.mjs';
import { LAB_AGENTS, costPath } from './lib/pipeline.mjs';

const arg = (process.argv[2] ?? '').trim();
const lab = LAB_AGENTS[arg.toUpperCase()] ? arg.toUpperCase() : '';
const since = lab ? '' : arg;
const sessions = agentSessions().filter((s) => (!since || s.start >= since) && (!lab || s.subagents.some((r) => LAB_AGENTS[lab].includes(r.name))));
const defs = agentDefinitions();
const byModel = new Map();
let seconds = 0;
const runs = new Map();
const minutes = new Map();
const span = (r) => Math.max(0, (Date.parse(r.end ?? r.start) - Date.parse(r.start)) / 60000) || 0;
for (const s of sessions) {
  seconds += (s.usage?.durationMs ?? 0) / 1000;
  for (const [model, u] of Object.entries(s.usage?.models ?? {})) {
    const c = costOf(model, u);
    const t = byModel.get(model) ?? { requests: 0, input: 0, output: 0, dollars: 0, priced: c.priced };
    t.requests += c.requests; t.input += c.input; t.output += c.output; t.dollars += c.dollars ?? 0;
    byModel.set(model, t);
  }
  for (const r of s.subagents) { runs.set(r.name, (runs.get(r.name) ?? 0) + 1); minutes.set(r.name, (minutes.get(r.name) ?? 0) + span(r)); }
}
if (!byModel.size) {
  console.log(`No finished agent sessions with usage yet${lab ? ` that ran an ${lab} agent` : ''}. Run the agent, leave it with /quit, then npm run cost${arg ? ` -- ${arg}` : ''}.`);
  process.exit(0);
}
// Only agents that ran in these sessions; a model nobody's agent declares is the main session's own model.
const ranWith = (model) => defs.filter((d) => d.model === model && runs.get(d.name));
const usedBy = (model) => {
  const names = ranWith(model).map((d) => `${d.name} (${runs.get(d.name)} run${runs.get(d.name) === 1 ? '' : 's'})`);
  return names.length ? names.join(', ') : 'main session';
};
const agentMinutes = (model) => ranWith(model).reduce((t, d) => t + (minutes.get(d.name) ?? 0), 0);
const rows = [...byModel.entries()].sort((a, b) => b[1].dollars - a[1].dollars);
const total = rows.reduce((t, [, r]) => t + r.dollars, 0);
const scope = lab ? ` that ran an ${lab} agent` : since ? ` since ${since}` : '';
const lines = ['# Agent cost sheet', '', `${sessions.length} session(s)${scope}, ${Math.round(seconds / 60)} minutes of agent time. List prices per million tokens; cached input counted at full price, so this is an upper bound.`, '',
  '| Model | Used by | Agent minutes | Requests | Input tokens | Output tokens | Price in / out | Cost | Copilot credits |', '|---|---|---:|---:|---:|---:|---|---:|---:|'];
for (const [m, r] of rows) {
  const p = PRICES[m];
  const mins = agentMinutes(m);
  lines.push(`| ${m} | ${usedBy(m)} | ${ranWith(m).length ? mins.toFixed(1) : '-'} | ${r.requests} | ${r.input.toLocaleString('en-US')} | ${r.output.toLocaleString('en-US')} | ${p ? `$${p.input} / $${p.output}` : 'unknown'} | ${r.priced ? money(r.dollars) : 'no price'} | ${r.priced ? Math.ceil(r.dollars * 100) : '-'} |`);
}
lines.push('', `**Total: ${money(total)}** (${Math.ceil(total * 100)} Copilot credits at 1 credit per cent, for comparison).`);
const shared = [...byModel.keys()].filter((m) => ranWith(m).length > 1).map((m) => ranWith(m).map((d) => d.name).join(' + '));
if (shared.length) lines.push('', `Agents that share a model are combined in one row: ${shared.join('; ')}.`);
if (rows.some(([, r]) => !r.priced)) lines.push('', 'A model without a list price is left out of the total.');
mkdirSync('pipeline', { recursive: true });
writeFileSync(costPath(lab), lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\nSaved ${costPath(lab)}`);
