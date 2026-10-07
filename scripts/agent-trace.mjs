#!/usr/bin/env node
/**
 * What did the agent REALLY do? Reads the agent runtime's own session recordings for this repository and lists,
 * per session, the skills it loaded and the MCP tools it called. The agent can say anything; this is what it did.
 * Run: npm run trace            (last 5 sessions)
 *      npm run trace -- 20      (last 20 sessions)
 */
import { agentSessions, deniedCalls, mcpCalls, projectsDir, skillsLoaded } from './lib/agent-trace.mjs';

const n = Number(process.argv[2] ?? 5);
const sessions = agentSessions().slice(-n);
if (!sessions.length) {
  console.log(`No agent sessions recorded for ${process.cwd()} yet.\nRun the agent here first (cydeo or cydeo --qa). Recordings live under ${projectsDir()}.`);
  process.exit(0);
}
for (const s of sessions) {
  const counts = {};
  for (const c of s.calls) counts[c.name] = (counts[c.name] ?? 0) + 1;
  const skills = skillsLoaded(s);
  const mcp = mcpCalls(s).map((c) => `${c.server}.${c.tool}`);
  console.log(`\nSession ${s.id.slice(0, 8)}  ${s.start.replace('T', ' ').slice(0, 19)} UTC  (${s.calls.length} tool calls)`);
  console.log(`  skills loaded : ${skills.length ? [...new Set(skills)].join(', ') : 'none'}`);
  console.log(`  MCP tools     : ${mcp.length ? Object.entries(mcp.reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ×${v}`).join(', ') : 'none'}`);
  console.log(`  other tools   : ${Object.entries(counts).filter(([k]) => k !== 'skill' && !k.startsWith('mcp__')).map(([k, v]) => `${k} ×${v}`).join(', ') || 'none'}`);
  const denied = deniedCalls(s);
  if (denied.length) console.log(`  not run       : ${Object.entries(denied.reduce((m, c) => ({ ...m, [c.name]: (m[c.name] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ×${v}`).join(', ')}  (denied or failed: the agent asked, the runtime did not run it)`);
}
console.log('\nThis list comes from the agent runtime\'s session recordings, not from anything the agent wrote.');
