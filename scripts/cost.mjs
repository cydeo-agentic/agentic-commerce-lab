#!/usr/bin/env node
/**
 * What did the agents cost? Run: npm run cost              (every session in this repo)
 *                                npm run cost -- 2026-10-16  (sessions since that date)
 * Reads the runtime's usage record (models, requests, tokens, time) and prices it at list price. Each model is
 * matched to the agents in .qwen/agents that declare it, so with one model per agent you get cost per agent.
 * Writes pipeline/cost.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PRICES, agentDefinitions, agentSessions, costOf, money } from './lib/agent-trace.mjs';
import { P } from './lib/pipeline.mjs';

const since = process.argv[2] ?? '';
const sessions = agentSessions().filter((s) => !since || s.start >= since);
const defs = agentDefinitions();
const byModel = new Map();
let seconds = 0;
const runs = new Map();
for (const s of sessions) {
  seconds += (s.usage?.durationMs ?? 0) / 1000;
  for (const [model, u] of Object.entries(s.usage?.models ?? {})) {
    const c = costOf(model, u);
    const t = byModel.get(model) ?? { requests: 0, input: 0, output: 0, dollars: 0, priced: c.priced };
    t.requests += c.requests; t.input += c.input; t.output += c.output; t.dollars += c.dollars ?? 0;
    byModel.set(model, t);
  }
  for (const r of s.subagents) runs.set(r.name, (runs.get(r.name) ?? 0) + 1);
}
if (!byModel.size) {
  console.log('No finished agent sessions with usage yet. Run the agent, end the session (/quit), then npm run cost.');
  process.exit(0);
}
const usedBy = (model) => {
  const names = defs.filter((d) => d.model === model).map((d) => `${d.name} (${runs.get(d.name) ?? 0} run${runs.get(d.name) === 1 ? '' : 's'})`);
  return names.length ? names.join(', ') : 'main session';
};
const rows = [...byModel.entries()].sort((a, b) => b[1].dollars - a[1].dollars);
const total = rows.reduce((t, [, r]) => t + r.dollars, 0);
const lines = ['# Agent cost sheet', '', `${sessions.length} session(s)${since ? ` since ${since}` : ''}, ${Math.round(seconds / 60)} minutes of agent time. List prices per million tokens; cached input counted at full price, so this is an upper bound.`, '',
  '| Model | Used by | Requests | Input tokens | Output tokens | Price in / out | Cost |', '|---|---|---:|---:|---:|---|---:|'];
for (const [m, r] of rows) {
  const p = PRICES[m];
  lines.push(`| ${m} | ${usedBy(m)} | ${r.requests} | ${r.input.toLocaleString()} | ${r.output.toLocaleString()} | ${p ? `$${p.input} / $${p.output}` : 'unknown'} | ${r.priced ? money(r.dollars) : 'no price'} |`);
}
lines.push('', `**Total: ${money(total)}** (${Math.round(total * 100)} Copilot credits at 1 credit per cent, for comparison).`);
const shared = defs.filter((d, i) => d.model && defs.findIndex((e) => e.model === d.model) !== i).map((d) => d.name);
if (shared.length) lines.push('', `Two or more agents share a model (${shared.join(', ')}), so their costs are combined in one row.`);
mkdirSync('pipeline', { recursive: true });
writeFileSync(P.cost, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\nSaved ${P.cost}`);
