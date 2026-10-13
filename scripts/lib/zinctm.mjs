// ZincTM from the lab's own scripts, signed in with the student's `cydeo login`: no password typed, and no token
// printed or saved. The same two steps `cydeo --qa` runs at launch for the ZincTM server:
//   1. the AI Lab token becomes a short-lived ZincTM token   (POST <proxyBaseUrl>/zinctm-token)
//   2. the ZincTM token becomes this student's own session   (POST https://zinctm.cydeo.io/api/auth/exchange)
// ZincTM's row-level security then shows only this student's own work.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const ZINCTM = process.env.ZINCTM_URL ?? 'https://zinctm.cydeo.io';

export function cydeoConfig() {
  try { return JSON.parse(readFileSync(join(homedir(), '.cydeo', 'config.json'), 'utf8')); } catch { return {}; }
}

async function call(url, { method = 'GET', headers = {}, body } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json, setCookies: res.headers.getSetCookie?.() ?? [] };
  } catch (err) {
    return { status: 0, json: null, setCookies: [], error: err.message };
  }
}

/**
 * Open a ZincTM session. Returns { ok, step, status, why } on failure, or { ok: true, get, post } on success.
 * `get`/`post` return { status, data, error } with ZincTM's envelope unwrapped ({ ok, data } / { ok:false, error }).
 */
export async function zinctmSession() {
  const cfg = cydeoConfig();
  if (!cfg.token) return { ok: false, step: 'cydeo login', status: 0, why: 'not logged in' };
  const base = cfg.proxyBaseUrl ?? 'https://ai.cydeo.com/api/v1';
  const mint = await call(`${base}/zinctm-token`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` } });
  const token = typeof mint.json?.token === 'string' ? mint.json.token : '';
  if (mint.status !== 200 || !token) return { ok: false, step: 'ZincTM token from your AI Lab login', status: mint.status, why: mint.error ?? `HTTP ${mint.status}` };
  const ex = await call(`${ZINCTM}/api/auth/exchange`, { method: 'POST', body: { token } });
  if (ex.status !== 200) return { ok: false, step: 'ZincTM sign-in', status: ex.status, why: ex.json?.error?.code ?? ex.error ?? `HTTP ${ex.status}` };
  const jar = ex.setCookies.map((c) => c.split(';')[0]).filter((c) => !/=$/.test(c)).join('; ');
  const unwrap = (r) => ({ status: r.status, data: r.json?.ok ? r.json.data : null, error: r.json?.ok === false ? r.json.error : r.error ?? null });
  return {
    ok: true,
    get: async (path) => unwrap(await call(`${ZINCTM}${path}`, { headers: { cookie: jar } })),
    post: async (path, body) => unwrap(await call(`${ZINCTM}${path}`, { method: 'POST', headers: { cookie: jar }, body })),
  };
}
