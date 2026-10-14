// Reads Playwright spec files the way a reviewer does: which tests exist, what each one asserts, which test ids it
// uses, and every call that hides a failure. It uses the TypeScript parser, so formatting and comments cannot fool it.
// Plain code, no AI: `npm run spec`, `npm run heal:check`, `npm run drill` and `npm run check:lab -- L11` share it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export const L11_DIR = 'tests/lab/L11';
export const L11_OUT = 'artifacts/L11';
export const MONEY_RE = /\$\d[\d,]*\.\d{2}/g;
export const CASE_ID_RE = /\bTC-\d+\b/i;
export const STATUS_RE = /\b(PENDING|PAID|PAYMENT_FAILED|REFUNDED|LEAD|ACTIVE_CUSTOMER)\b/g;

/** Spec files in a folder, sorted: tests/lab/L11/tc-04.spec.ts, ... */
export const specFiles = (dir = L11_DIR) => (existsSync(dir) ? readdirSync(dir).filter((f) => /\.(spec|test)\.[cm]?[jt]s$/.test(f)).sort().map((f) => join(dir, f)) : []);

/** Money values in a piece of text, normalized ($1,000.00 -> $1000.00). Regex sources (\$106\.00) count too. */
export const moneyIn = (text) => [...String(text ?? '').replace(/\\/g, '').matchAll(MONEY_RE)].map((m) => m[0].replace(/,/g, ''));

// Calls that make a red test stop being red without fixing anything.
const HIDERS = new Set(['skip', 'fixme', 'only', 'fail']);
// What a spec may never touch: the machine it runs on. Agents run `npm run spec` without asking, so a spec is code
// that runs unreviewed. A Playwright spec needs a page and expect, nothing else.
const MACHINE = new Set(['process', 'require', 'globalThis', 'eval', 'Function', '__dirname', '__filename', 'Deno', 'Bun']);

function calleeChain(expr) {
  const parts = [];
  let e = expr;
  while (ts.isPropertyAccessExpression(e)) { parts.unshift(e.name.text); e = e.expression; }
  if (!ts.isIdentifier(e)) return null;
  parts.unshift(e.text);
  return parts;
}

// Values an assertion compares against. A const holding a literal counts as that literal; anything computed while the
// test runs is marked <runtime>, so a before/after comparison still sees it change. Options objects ({ timeout }) are
// not part of the claim.
function literalsOf(node, sf, consts = new Map()) {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isNumericLiteral(node)) return [node.text];
  if (ts.isRegularExpressionLiteral(node)) return [node.text];
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return [node.getText(sf)];
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((e) => literalsOf(e, sf, consts));
  if (ts.isObjectLiteralExpression(node)) return [];
  if (ts.isIdentifier(node) && consts.has(node.text)) return consts.get(node.text);
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return literalsOf(node.expression, sf, consts);
  return [`<runtime: ${node.getText(sf).slice(0, 60)}>`];
}

// const NAME = <literal> anywhere in the file, so toHaveText(NAME) reads as the literal it holds.
function constLiterals(sf) {
  const consts = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.Const)) {
      for (const d of node.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const v = literalsOf(d.initializer, sf, consts);
        if (v.length && !v.some((x) => x.startsWith('<runtime'))) consts.set(d.name.text, v);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return consts;
}

// expect(x).not.toHaveText('...') -> { matcher: 'toHaveText', negated: true, kind: 'expect', subject: 'x', values: ['...'] }
function assertionOf(call, sf, consts) {
  if (!ts.isPropertyAccessExpression(call.expression)) return null;
  const matcher = call.expression.name.text;
  let e = call.expression.expression;
  let negated = false;
  while (ts.isPropertyAccessExpression(e)) { if (e.name.text === 'not') negated = true; e = e.expression; }
  if (!ts.isCallExpression(e)) return null;
  const chain = calleeChain(e.expression);
  if (!chain || chain[0] !== 'expect') return null;
  const values = call.arguments.flatMap((a) => literalsOf(a, sf, consts));
  return { matcher, negated, kind: chain.slice(1).join('.') || 'expect', subject: e.arguments[0]?.getText(sf) ?? '', values };
}

/** One assertion as a stable string: what it claims, not how it finds the element. */
export const signature = (a) => `${a.kind === 'expect' ? '' : `${a.kind}:`}${a.negated ? 'not.' : ''}${a.matcher}(${a.values.join(' | ')})`;

/**
 * Parse one spec file. Returns { file, tests, hiders, waits, testIds, imports, machine }:
 *   tests:   [{ title, caseId, line, assertions: [{ matcher, negated, kind, subject, values }], testIds }]
 *   hiders:  test.skip / fixme / only / fail and describe variants, and retries, with their line
 *   waits:   waitForTimeout and setTimeout calls, with their line
 *   imports: every module the file imports or requires
 *   machine: every use of process, require, eval and the like, with its line
 */
export function parseSpec(file) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const out = { file, tests: [], hiders: [], waits: [], testIds: [], imports: [], machine: [] };
  const stack = [];
  const consts = constLiterals(sf);

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) out.imports.push(node.moduleSpecifier.text);
    if (ts.isImportEqualsDeclaration(node)) out.imports.push(node.moduleReference.getText(sf));
    if (ts.isIdentifier(node) && MACHINE.has(node.text)) {
      const p = node.parent;
      const isProperty = p && ts.isPropertyAccessExpression(p) && p.name === node;
      const isKey = p && (ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) && p.name === node;
      if (!isProperty && !isKey) out.machine.push({ name: node.text, line: lineOf(node) });
    }
    if (node.kind === ts.SyntaxKind.ImportKeyword && node.parent && ts.isCallExpression(node.parent)) out.machine.push({ name: 'import()', line: lineOf(node) });
    if (ts.isMetaProperty(node)) out.machine.push({ name: 'import.meta', line: lineOf(node) });

    let opened = null;
    if (ts.isCallExpression(node)) {
      const chain = calleeChain(node.expression);
      const last = chain?.at(-1);
      if (chain && chain[0] === 'test') {
        if (chain.length >= 2 && HIDERS.has(last)) out.hiders.push({ call: chain.join('.'), line: lineOf(node) });
        if (chain.join('.') === 'test.describe.configure' && /retries/.test(node.arguments[0]?.getText(sf) ?? '')) out.hiders.push({ call: 'test.describe.configure({ retries })', line: lineOf(node) });
        if (chain.length === 1 && node.arguments.length >= 2) {
          const title = literalsOf(node.arguments[0], sf, consts)[0] ?? node.arguments[0].getText(sf);
          opened = { title, caseId: title.match(CASE_ID_RE)?.[0]?.toUpperCase() ?? null, line: lineOf(node), assertions: [], testIds: [] };
          out.tests.push(opened);
          stack.push(opened);
        }
      }
      if (last === 'waitForTimeout' || (chain?.length === 1 && last === 'setTimeout')) out.waits.push({ call: last, line: lineOf(node) });
      if (last === 'getByTestId') {
        const id = literalsOf(node.arguments[0], sf, consts)[0];
        if (id) { out.testIds.push(id); stack.at(-1)?.testIds.push(id); }
      }
      const a = assertionOf(node, sf, consts);
      if (a && stack.length) stack.at(-1).assertions.push(a);
    }
    ts.forEachChild(node, visit);
    if (opened) stack.pop();
  };
  visit(sf);
  return out;
}

/** Why a spec may not run unreviewed: imports other than @playwright/test, or any reach for the machine. */
export function unsafeReasons(parsed) {
  const reasons = [];
  for (const m of parsed.imports) if (m !== '@playwright/test') reasons.push(`imports "${m}" (a spec may import only @playwright/test)`);
  for (const m of parsed.machine) reasons.push(`uses ${m.name} on line ${m.line} (a spec may not touch the machine it runs on)`);
  return reasons;
}

/** Signatures of every test's assertions, keyed by test title. Used for the healer's before/after comparison. */
export function assertionMap(files = specFiles()) {
  const map = {};
  for (const f of files) for (const t of parseSpec(f).tests) map[t.title] = { file: f, signatures: t.assertions.map(signature) };
  return map;
}

/** A case's own words, the only source an asserted value may come from. */
export const caseText = (c) => [c.title, c.preconditions, ...(Array.isArray(c.steps) ? c.steps : [c.steps]), c.expected ?? c.expectedResult].filter(Boolean).join('\n');

/** Unit prices from the store catalog (store/catalog.mjs), as $x.yy, so a spec may check a price the catalog shows. */
export function catalogPrices(path = 'store/catalog.mjs') {
  if (!existsSync(path)) return new Set();
  const cents = [...readFileSync(path, 'utf8').matchAll(/\b(?:priceCents|price_cents|cents)\s*:\s*(\d+)/g)].map((m) => Number(m[1]));
  return new Set(cents.map((c) => `$${(c / 100).toFixed(2)}`));
}

/** Read Playwright's JSON report into a flat list: { title, file, line, status, durationMs, error, attachments }. */
export function reportTests(path = `${L11_OUT}/results.json`) {
  if (!existsSync(path)) return [];
  let report;
  try { report = JSON.parse(readFileSync(path, 'utf8')); } catch { return []; }
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) {
      const r = (t.results ?? []).at(-1) ?? {};
      // A timeout's own message is short; the call log that names the missing element is in the other errors.
      const error = stripAnsi((r.errors?.length ? r.errors.map((e) => e.message ?? '') : [r.error?.message ?? '']).join('\n\n'));
      out.push({ title: spec.title, file: spec.file, line: spec.line, status: r.status ?? t.status ?? 'unknown', durationMs: r.duration ?? 0, error, attachments: (r.attachments ?? []).filter((a) => a.path).map((a) => ({ name: a.name, path: a.path, contentType: a.contentType })) });
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of report.suites ?? []) walk(s);
  return out;
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
export const stripAnsi = (s) => String(s ?? '').replace(ANSI, '');

/**
 * What kind of failure an error message is:
 *   assertion: the test found the element and the value was wrong (expected and received both present)
 *   locator:   the test never found the element it asked for
 *   timeout / other
 */
export function failureKind(error) {
  const e = stripAnsi(error);
  const expected = e.match(/^\s*Expected(?: [a-z ]+)?:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const received = e.match(/^\s*Received(?: [a-z ]+)?:\s*(.+)$/m)?.[1]?.trim() ?? null;
  if (/element\(s\) not found|<element\(s\) not found>/.test(e) || (/waiting for getByTestId/.test(e) && !received)) return { kind: 'locator', expected, received };
  if (expected && received && received !== expected) return { kind: 'assertion', expected, received };
  if (/Timeout|timed out|exceeded/i.test(e)) return { kind: 'timeout', expected, received };
  return { kind: 'other', expected, received };
}
