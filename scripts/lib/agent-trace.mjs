// Reads the agent's own session recordings: what it really did, written by the agent runtime, not by the agent's words.
// `cydeo` runs Qwen Code with HOME=~/.cydeo/qwen-home, which records every session of a project as JSON lines in
// ~/.cydeo/qwen-home/.qwen/projects/<project path with / replaced by ->/chats/<session id>.jsonl
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const projectsDir = () => process.env.CYDEO_QWEN_PROJECTS ?? join(homedir(), '.cydeo', 'qwen-home', '.qwen', 'projects');
export const projectSlug = (cwd) => cwd.replace(/[\\/:]/g, '-');

// Every tool call in one parsed record (calls sit in message.parts[].functionCall).
function callsIn(record) {
  const found = [];
  const walk = (o) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (o.functionCall && typeof o.functionCall === 'object' && o.functionCall.name) found.push(o.functionCall);
    Object.values(o).forEach(walk);
  };
  walk(record.message);
  return found;
}

/** Sessions the agent ran in `cwd`, oldest first: { id, file, start, end, calls: [{ name, args, at }] }. */
export function agentSessions(cwd = process.cwd()) {
  const dir = join(projectsDir(), projectSlug(cwd), 'chats');
  if (!existsSync(dir)) return [];
  const sessions = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
    const file = join(dir, f);
    const calls = [];
    let start = null;
    let end = null;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let r;
      try { r = JSON.parse(line); } catch { continue; }
      if (r.cwd && r.cwd !== cwd) continue;
      if (r.timestamp) { start ??= r.timestamp; end = r.timestamp; }
      for (const c of callsIn(r)) calls.push({ name: c.name, args: c.args ?? {}, at: r.timestamp });
    }
    if (start) sessions.push({ id: f.replace(/\.jsonl$/, ''), file, start, end, calls, mtime: statSync(file).mtimeMs });
  }
  return sessions.sort((a, b) => a.start.localeCompare(b.start));
}

// The skills a session loaded (Qwen's `skill` tool) and the MCP tools it called (mcp__<server>__<tool>).
export const skillsLoaded = (s) => s.calls.filter((c) => c.name === 'skill').map((c) => c.args.skill ?? c.args.name ?? '?');
export const mcpCalls = (s) => s.calls.filter((c) => c.name.startsWith('mcp__')).map((c) => ({ ...c, server: c.name.split('__')[1], tool: c.name.split('__').slice(2).join('__') }));
