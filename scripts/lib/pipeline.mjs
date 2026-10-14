// Shared reading and checking for the pipeline files the agents write (pipeline/*.json) and the rules they cite.
// Plain code, no AI: the same checks run in `npm run rtm`, `npm run review` and `npm run check:lab`.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export const RULE_RE = /\b(CAT|CART|PRICE|PAY|ORD|CRM|WH)-\d+\b/g;
export const P = {
  context: 'team-context.md',
  plan: 'pipeline/test-plan.md',
  cases: 'pipeline/cases.json',
  evaluation: 'pipeline/evaluation.json',
  rtm: 'pipeline/rtm.md',
  approvals: 'pipeline/approvals.json',
  published: 'pipeline/published.json',
  cost: 'pipeline/cost.md',
  investigation: 'pipeline/investigation.json',
  defects: 'pipeline/defects.json',
};

/** The agents each lab adds. `npm run cost -- L11` prices only the sessions that ran one of them. */
export const LAB_AGENTS = {
  L10: ['context-researcher', 'test-plan-creator', 'test-case-creator', 'case-evaluator', 'publisher'],
  L11: ['automation-engineer', 'failure-investigator', 'defect-reporter', 'test-healer'],
};
export const costPath = (lab) => (lab ? `pipeline/cost-${lab}.md` : P.cost);

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

/** PRD rules as a Map id -> text, read from lines like "- **PRICE-3** Shipping is free when ...". */
export function prdRules(path = 'PRD.md') {
  const rules = new Map();
  for (const m of read(path).matchAll(/^- \*\*((?:CAT|CART|PRICE|PAY|ORD|CRM|WH)-\d+)\*\*\s+(.+)$/gm)) rules.set(m[1], m[2].trim());
  return rules;
}

/** Test ids the store really has, from .cydeo/contract.md. */
export const contractIds = () => new Set((read('.cydeo/contract.md').match(/^- ([a-z0-9-]+)$/gm) ?? []).map((l) => l.slice(2)));

/** Parse a JSON file the agent wrote. Returns { data, error }. Tolerates a ```json fence around it. */
export function readAgentJson(path) {
  const text = read(path);
  if (!text) return { data: null, error: `${path} not found` };
  const body = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  try { return { data: JSON.parse(body), error: null }; } catch (err) { return { data: null, error: `${path} is not valid JSON (${err.message})` }; }
}

export const casesOf = (data) => (Array.isArray(data) ? data : Array.isArray(data?.cases) ? data.cases : []);

/** The JSON inside an agent's answer: the whole text, a fenced block, or a [...] / {...} that follows its prose. */
export function jsonIn(text) {
  const s = String(text ?? '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  for (const candidate of [s, fenced]) { if (!candidate) continue; try { return JSON.parse(candidate); } catch { /* keep looking */ } }
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '[' && s[i] !== '{') continue;
    const close = s.lastIndexOf(s[i] === '[' ? ']' : '}');
    if (close <= i) continue;
    try { return JSON.parse(s.slice(i, close + 1)); } catch { /* next opening bracket */ }
  }
  return null;
}

/** The defects the reporter filed, whatever shape the model chose: [{ caseId, key, defectId }]. */
export function defectsOf(data) {
  const list = Array.isArray(data) ? data : Object.values(data ?? {}).find((v) => Array.isArray(v) && v.some((x) => x && typeof x === 'object')) ?? [];
  return list.filter((d) => d && typeof d === 'object').map((d) => ({ ...d, caseId: String(d.caseId ?? d.case ?? String(d.title ?? '').match(/\bTC-\d+\b/i)?.[0] ?? '').toUpperCase(), key: d.key ?? d.defectKey ?? null, defectId: d.defectId ?? d.id ?? null }))
    .filter((d) => d.key || d.defectId);
}

/** The investigator's verdicts, whatever shape the model chose: [{ caseId: 'TC-04', verdict: 'product' | 'test', ... }]. */
export function verdictsOf(data) {
  const list = Array.isArray(data) ? data : [data?.verdicts, data?.failures, data?.results, data?.cases].find(Array.isArray) ?? [];
  return list.filter((v) => v && typeof v === 'object').map((v) => {
    const id = v.caseId ?? v.case ?? String(v.test ?? '').match(/\bTC-\d+\b/i)?.[0] ?? String(v.spec ?? v.file ?? '').match(/\btc-\d+/i)?.[0] ?? '';
    const said = String(v.verdict ?? '');
    return { ...v, caseId: String(id).toUpperCase(), verdict: /product/i.test(said) ? 'product' : /test/i.test(said) ? 'test' : said };
  });
}
export const caseRules = (c) => [...new Set(String(Array.isArray(c.rule) ? c.rule.join(' ') : c.rule ?? c.rules ?? '').match(RULE_RE) ?? [])];

// An expected result you can check: an exact amount, a quoted message, a status the ledger uses, an HTTP code or a test id.
const CHECKABLE = [/\$\d[\d,]*\.\d{2}/, /\b\d+\s*cents\b/i, /["'“‘][^"'”’]{1,}["'”’]/, /\b(PENDING|PAID|PAYMENT_FAILED|REFUNDED|LEAD|ACTIVE_CUSTOMER)\b/, /\bHTTP\s*\d{3}\b|\b(200|400|401|404)\b/, /`[a-z0-9]+(-[a-z0-9]+)+`/];
export const isCheckable = (text) => CHECKABLE.some((re) => re.test(String(text ?? '')));

/** Problems a plain script can find in each case. Returns Map case id -> [problem, ...]. */
export function caseProblems(cases, rules = prdRules(), ids = contractIds()) {
  const out = new Map();
  const seen = new Map();
  for (const c of cases) {
    const p = [];
    const cited = caseRules(c);
    if (!cited.length) p.push('cites no PRD rule');
    const unknown = cited.filter((r) => !rules.has(r));
    if (unknown.length) p.push(`cites a rule the PRD does not have: ${unknown.join(', ')}`);
    if (!c.title) p.push('no title');
    if (!Array.isArray(c.steps) || !c.steps.length) p.push('no steps');
    if (!c.expected && !c.expectedResult) p.push('no expected result');
    else if (!isCheckable(c.expected ?? c.expectedResult)) p.push('expected result has nothing exact to check (an amount, a message, a status)');
    const badIds = (c.testIds ?? []).filter((t) => !ids.has(t));
    if (badIds.length) p.push(`uses test ids not in the contract: ${badIds.join(', ')}`);
    const key = String(c.title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (key && seen.has(key)) p.push(`duplicate of ${seen.get(key)}`);
    else if (key) seen.set(key, c.id);
    out.set(c.id, p);
  }
  return out;
}

/** The label that marks this student's published cases in ZincTM (stable per repo and person). */
export function publishLabel() {
  const who = spawnSync('git', ['config', 'user.name'], { encoding: 'utf8' }).stdout.trim() || process.env.GITHUB_USER || 'student';
  return `zs-${createHash('sha256').update(`${process.cwd()}|${who}`).digest('hex').slice(0, 6)}`;
}
