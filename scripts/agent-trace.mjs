#!/usr/bin/env node
/**
 * What did the agent REALLY do? Reads the agent runtime's own session recordings for this repository and lists,
 * per session: the models it used (requests and tokens), the subagents it delegated to and the tools each
 * of them ran, the skills it loaded and the MCP tools it called. The agent can say anything; this is what it did.
 * Run: npm run trace            (last 5 sessions)
 *      npm run trace -- 20      (last 20 sessions)
 */
import { agentDefinitions, agentSessions, costOf, deniedCalls, mcpCalls, projectsDir, skillsLoaded } from './lib/agent-trace.mjs';

const n = Number(process.argv[2] ?? 5);
const sessions = agentSessions().slice(-n);
if (!sessions.length) {
  console.log(`No agent sessions recorded for ${process.cwd()} yet.\nRun the agent here first (cydeo or cydeo --qa). Recordings live under ${projectsDir()}.`);
  process.exit(0);
}
const declared = new Map(agentDefinitions().map((a) => [a.name, a]));
const tally = (names) => Object.entries(names.reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ×${v}`).join(', ');

for (const s of sessions) {
  const skills = skillsLoaded(s);
  const mcp = mcpCalls(s).map((c) => `${c.server}.${c.tool}`);
  const other = s.calls.filter((c) => c.ok && c.name !== 'skill' && !c.name.startsWith('mcp__')).map((c) => c.name);
  console.log(`\nSession ${s.id.slice(0, 8)}  ${s.start.replace('T', ' ').slice(0, 19)} UTC  (${s.calls.length} tool calls)`);
  if (s.usage?.models) {
    const rows = Object.entries(s.usage.models).map(([m, u]) => ({ m, ...costOf(m, u) }));
    console.log(`  models used   : ${rows.map((r) => `${r.m} (${r.requests} requests, ${r.input.toLocaleString()} in / ${r.output.toLocaleString()} out)`).join('; ')}`);
    console.log(`  session time  : ${Math.round((s.usage.durationMs ?? 0) / 1000)} s`);
  } else {
    console.log('  models used   : not recorded yet (the runtime writes this when the session ends)');
  }
  console.log(`  skills loaded : ${skills.length ? [...new Set(skills)].join(', ') : 'none'}`);
  console.log(`  MCP tools     : ${mcp.length ? tally(mcp) : 'none'}`);
  console.log(`  other tools   : ${other.length ? tally(other) : 'none'}`);
  const denied = deniedCalls(s);
  if (denied.length) console.log(`  not run       : ${tally(denied.map((c) => c.name))}  (denied or failed: the agent asked, the runtime did not run it)`);
  for (const r of s.subagents) {
    const def = declared.get(r.name);
    const ran = r.calls.filter((c) => c.ok).map((c) => c.name);
    const refused = r.calls.filter((c) => !c.ok).map((c) => c.name);
    console.log(`  subagent      : ${r.name}${def?.model ? ` (declared model ${def.model})` : ''}`);
    console.log(`      tools run : ${ran.length ? tally(ran) : 'none'}`);
    if (refused.length) console.log(`      not run   : ${tally(refused)}`);
  }
}
console.log('\nThis list comes from the agent runtime\'s session recordings, not from anything the agent wrote.');
console.log('Models and tokens come from the runtime\'s usage record, so a session shows them only after it has ended.');
