// Reads the agent's own session recordings: what it really did, written by the agent runtime, not by the agent's words.
// `cydeo` runs Qwen Code with HOME=~/.cydeo/qwen-home, which records every session of a project as JSON lines in
//   ~/.cydeo/qwen-home/.qwen/projects/<project path with / replaced by ->/chats/<session id>.jsonl
// A subagent the session delegated to is recorded separately, next to it:
//   .../projects/<slug>/subagents/<parent session id>/agent-<name>-<id>.jsonl   (+ .meta.json)
// The models a session used, with tokens, are in one file for all projects:
//   ~/.cydeo/qwen-home/.qwen/usage_record.jsonl   (one line per session: models -> requests and tokens)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const qwenDir = () => process.env.CYDEO_QWEN_DIR ?? join(homedir(), '.cydeo', 'qwen-home', '.qwen');
export const projectsDir = () => process.env.CYDEO_QWEN_PROJECTS ?? join(qwenDir(), 'projects');
export const projectSlug = (cwd) => cwd.replace(/[\\/:]/g, '-');

const readLines = (file) => readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
const parse = (line) => { try { return JSON.parse(line); } catch { return null; } };

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

// The runtime's verdict on one call. Main sessions write toolCallResult.status; subagent recordings write the
// tool's response, which carries `error` when the call was denied or failed.
function resultOf(record) {
  const id = record.toolCallResult?.callId;
  if (!id) return null;
  if (record.toolCallResult.status) return { id, ok: record.toolCallResult.status === 'success' };
  const parts = record.message?.parts ?? [];
  const failed = parts.some((p) => p.functionResponse?.response && 'error' in p.functionResponse.response);
  return { id, ok: !failed };
}

function readRecording(file, cwd) {
  const calls = [];
  const status = new Map();
  let start = null;
  let end = null;
  for (const line of readLines(file)) {
    const r = parse(line);
    if (!r) continue;
    if (cwd && r.cwd && r.cwd !== cwd) continue;
    if (r.timestamp) { start ??= r.timestamp; end = r.timestamp; }
    const res = r.type === 'tool_result' ? resultOf(r) : null;
    if (res) status.set(res.id, res.ok);
    for (const c of callsIn(r)) calls.push({ id: c.id, name: c.name, args: c.args ?? {}, at: r.timestamp });
  }
  // A call counts only if the runtime ran it: an attempt that was denied (no approval) is recorded as an error.
  for (const c of calls) c.ok = status.get(c.id) === true;
  return { calls, start, end };
}

/** Subagent runs recorded for one parent session, oldest first: { name, agentId, file, start, end, calls }. */
export function subagentRuns(sessionId, cwd = process.cwd()) {
  const dir = join(projectsDir(), projectSlug(cwd), 'subagents', sessionId);
  if (!existsSync(dir)) return [];
  const runs = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
    const file = join(dir, f);
    const metaPath = file.replace(/\.jsonl$/, '.meta.json');
    const meta = existsSync(metaPath) ? (parse(readFileSync(metaPath, 'utf8')) ?? {}) : {};
    const first = parse(readLines(file)[0] ?? '') ?? {};
    const name = meta.subagentName ?? meta.agentType ?? first.agentName ?? f.replace(/^agent-|-call_.*$/g, '');
    const { calls, start, end } = readRecording(file, null);
    runs.push({ name, agentId: meta.agentId ?? first.agentId ?? f, file, status: meta.status ?? null, start: start ?? meta.createdAt ?? '', end, calls });
  }
  return runs.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

/** Sessions the agent ran in `cwd`, oldest first: { id, file, start, end, calls, subagents, usage }. */
export function agentSessions(cwd = process.cwd()) {
  const dir = join(projectsDir(), projectSlug(cwd), 'chats');
  if (!existsSync(dir)) return [];
  const usage = usageBySession();
  const sessions = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
    const file = join(dir, f);
    const id = f.replace(/\.jsonl$/, '');
    const { calls, start, end } = readRecording(file, cwd);
    if (start) sessions.push({ id, file, start, end, calls, subagents: subagentRuns(id, cwd), usage: usage.get(id) ?? null, mtime: statSync(file).mtimeMs });
  }
  return sessions.sort((a, b) => a.start.localeCompare(b.start));
}

// The skills a session really loaded (Qwen's `skill` tool) and the MCP tools it really ran (mcp__<server>__<tool>).
// Only calls the runtime executed count; denied attempts are listed separately by `deniedCalls`.
export const skillsLoaded = (s) => s.calls.filter((c) => c.name === 'skill' && c.ok).map((c) => c.args.skill ?? c.args.name ?? '?');
export const mcpCalls = (s) => s.calls.filter((c) => c.name.startsWith('mcp__') && c.ok).map((c) => ({ ...c, server: c.name.split('__')[1], tool: c.name.split('__').slice(2).join('__') }));
export const deniedCalls = (s) => s.calls.filter((c) => !c.ok);

/** The last thing a subagent said: its answer to the main session, as the runtime recorded it. */
export function finalText(run) {
  let text = '';
  for (const line of readLines(run.file)) {
    const r = parse(line);
    if (r?.type !== 'assistant') continue;
    const parts = (r.message?.parts ?? []).filter((p) => typeof p.text === 'string' && !p.thought);
    if (parts.length) text = parts.map((p) => p.text).join('');
  }
  return text;
}

/** Every subagent run in this repository, oldest first, each with its parent session id. */
export const allSubagentRuns = (cwd = process.cwd()) => agentSessions(cwd).flatMap((s) => s.subagents.map((r) => ({ ...r, sessionId: s.id })));

// ---- Models, tokens and cost ----------------------------------------------------------------------------------

/** usage_record.jsonl, keyed by session id. One line per session, written by the runtime when the session ends. */
export function usageBySession() {
  const file = join(qwenDir(), 'usage_record.jsonl');
  const map = new Map();
  if (!existsSync(file)) return map;
  for (const line of readLines(file)) {
    const r = parse(line);
    if (r?.sessionId) map.set(r.sessionId, r);
  }
  return map;
}

// List prices in US dollars per million tokens (OpenRouter, the same model ids the AI Lab serves), checked 2026-10-13.
// Cached input is counted at the full input price and reasoning tokens as output, so these are upper bounds.
export const PRICES = {
  'deepseek/deepseek-v4-flash-0731': { input: 0.016, output: 0.64 },
  'z-ai/glm-5.2': { input: 0.06, output: 7.0 },
  'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'moonshotai/kimi-k2.7-code': { input: 0.671, output: 3.35 },
  'qwen/qwen3-235b-a22b-2507': { input: 0.09, output: 0.55 },
  'openai/gpt-oss-120b': { input: 0.15, output: 0.6 },
  'google/gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
};

/** Tokens and dollars for one model's usage entry: { requests, input, output, dollars, priced }. */
export function costOf(model, u) {
  const input = u.inputTokens ?? 0;
  const output = (u.outputTokens ?? 0) + (u.thoughtsTokens ?? 0);
  const p = PRICES[model];
  return { requests: u.requests ?? 0, input, output, dollars: p ? (input * p.input + output * p.output) / 1e6 : null, priced: Boolean(p) };
}

export const money = (d) => (d == null ? 'no price' : d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`);

// ---- Agent definitions in this repository ---------------------------------------------------------------------

/** The subagents defined in .qwen/agents/*.md: { name, model, tools, file }. Read from their front matter. */
export function agentDefinitions(cwd = process.cwd()) {
  const dir = join(cwd, '.qwen', 'agents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const text = readFileSync(join(dir, f), 'utf8');
    const fm = text.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '';
    const field = (k) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
    const tools = [];
    const block = fm.match(/^tools:\s*\n((?:\s+-\s+.+\n?)+)/m)?.[1];
    if (block) for (const l of block.split('\n')) { const m = l.match(/^\s+-\s+(.+?)\s*$/); if (m) tools.push(m[1].replace(/^['"]|['"]$/g, '')); }
    else { const inline = field('tools'); if (inline) tools.push(...inline.replace(/^\[|\]$/g, '').split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)); }
    return { name: field('name') ?? f.replace(/\.md$/, ''), model: field('model'), tools, file: join('.qwen', 'agents', f) };
  });
}

// Tools that can change something. A read-only agent must list none of them.
export const WRITE_TOOLS = new Set(['write_file', 'edit', 'replace', 'run_shell_command', 'todo_write', 'save_memory']);
export const isWriteTool = (t) => WRITE_TOOLS.has(t) || /^mcp__.+__(tm_)?(create|update|delete|file|add|link|record|finish|transition|review)/.test(t);
