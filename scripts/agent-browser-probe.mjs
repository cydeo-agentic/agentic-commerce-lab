#!/usr/bin/env node
// Starts the agent's browser tool (Playwright MCP) exactly as `cydeo --qa` does and opens the store.
// Run: node scripts/agent-browser-probe.mjs   (doctor runs it for you). Exit 0 = the agent can see your store.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const url = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const transport = new StdioClientTransport({ command: 'npx', args: ['-y', '@playwright/mcp@latest'], env: { ...process.env }, stderr: 'pipe' });
const client = new Client({ name: 'agent-browser-probe', version: '1.0.0' });
const timer = setTimeout(() => { console.log('FAIL agent browser did not answer in 90 s'); process.exit(1); }, 90_000);
try {
  await client.connect(transport);
  await client.callTool({ name: 'browser_navigate', arguments: { url } });
  const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
  const text = (snap.content ?? []).map((c) => c.text ?? '').join('\n');
  const ok = /Gear for people who ship/.test(text);
  console.log(ok ? `PASS agent browser opened ${url}` : `FAIL agent browser opened ${url} but did not see the store`);
  await client.callTool({ name: 'browser_close', arguments: {} }).catch(() => {});
  await client.close();
  clearTimeout(timer);
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.log(`FAIL agent browser: ${String(err.message).split('\n')[0]}`);
  process.exit(1);
}
