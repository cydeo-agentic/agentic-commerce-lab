// Tiny .env helpers: read values, upsert keys, never print secrets.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const ENV_PATH = '.env';

export function readEnv(path = ENV_PATH) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

export function upsertEnv(values, path = ENV_PATH) {
  let text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v ?? ''}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  }
  writeFileSync(path, text, { mode: 0o600 });
}

export const mask = (secret) => (secret ? `${secret.slice(0, 10)}…${secret.slice(-4)}` : '(none)');
