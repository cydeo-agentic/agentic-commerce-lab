/**
 * ZincBank test fixtures. Every spec imports test and expect from here, never from @playwright/test.
 *
 * The lab app is shared by the whole class, so a test never uses someone else's data and never resets
 * anything. It makes its own customer instead:
 *   - customer      a brand-new customer (checking + savings, $0.00), already signed in on `page`
 *   - newCustomer   make another customer (not signed in), e.g. a P2P recipient or a login test user
 *   - signIn        sign `page` in as a customer (API sign-in; the browser shares the cookie)
 *   - fund          put money in a customer's checking (a P2P send from the funder login in zincbank/.env)
 *   - apiPost       call a ZincBank API as the signed-in page (for preconditions only, never for the check)
 *   - addPayee      add a payee as the signed-in page; returns the payee ({ id, name })
 *
 * Money: inputs take dollar strings ("25.00"); the API and these helpers take integer cents.
 */
import { test as base, expect, request, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export { expect };
export type { Locator, Page } from '@playwright/test';

export const BASE_URL = process.env.ZB_BASE_URL ?? 'https://zincbank-lab.vercel.app';
export const PASSWORD = 'Passw0rd!zb';

export interface Customer {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** What another customer sees in P2P: "First L." */
  displayName: string;
  checkingId: string;
  checkingNumber: string;
  savingsId: string;
  savingsNumber: string;
}

export interface CustomerOptions {
  firstName?: string;
  lastName?: string;
  password?: string;
}

const FIRST = ['Ava', 'Ben', 'Cleo', 'Dan', 'Eli', 'Faye', 'Gus', 'Hana', 'Ivo', 'Jade'];

/** A unique test email. Every test customer starts with zbtest- so they are easy to find later. */
export function uniqueEmail(tag = 'c'): string {
  return `zbtest-${tag}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}@zinc.test`;
}

/** Integer cents -> "$1,234.56" / "-$6.40", exactly as ZincBank shows money. */
export function usd(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.trunc(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}$${dollars}.${(abs % 100).toString().padStart(2, '0')}`;
}

/** Integer cents -> the dollar string an amount input takes: 2550 -> "25.50". */
export function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Read a money element ("$1,234.56", "-$6.40", "+$25.00") as integer cents. */
export async function readCents(el: Locator): Promise<number> {
  const t = (await el.innerText()).trim();
  return (t.startsWith('-') ? -1 : 1) * Number(t.replace(/[^0-9]/g, ''));
}

/** A UTC calendar date `days` from today, as YYYY-MM-DD (what date inputs take). */
export function isoDay(days = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD -> MM/DD/YYYY, the format ZincBank tables and messages show. */
export function usDate(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
}

async function envelope(res: Awaited<ReturnType<APIRequestContext['post']>>, what: string) {
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: any; error?: unknown }; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!res.ok() || !body.ok) throw new Error(`${what} failed: HTTP ${res.status()} ${JSON.stringify(body.error ?? body)}`);
  return body.data;
}

/** Create a customer through the public onboarding API (checking + savings, $0.00). */
export async function createCustomer(api: APIRequestContext, opts: CustomerOptions = {}): Promise<Customer> {
  const firstName = opts.firstName ?? FIRST[Math.floor(Math.random() * FIRST.length)];
  const lastName = opts.lastName ?? 'Zbtest';
  const email = uniqueEmail();
  const password = opts.password ?? PASSWORD;
  const data = await envelope(
    await api.post('/api/onboarding/submit', {
      data: {
        email, password, firstName, lastName,
        employmentStatus: 'employed', addressLine: '1 Test Street', city: 'Reston', state: 'VA', postalCode: '20191',
        openSavings: true,
      },
    }),
    'Creating a test customer',
  );
  const checking = data.accounts.find((a: { type: string }) => a.type === 'checking');
  const savings = data.accounts.find((a: { type: string }) => a.type === 'savings');
  return {
    email, password, firstName, lastName,
    displayName: `${firstName} ${lastName.charAt(0).toUpperCase()}.`,
    checkingId: checking.id, checkingNumber: checking.accountNumber,
    savingsId: savings.id, savingsNumber: savings.accountNumber,
  };
}

/** Sign the page's browser in as `c` (the API sets the session cookie the browser then uses). */
export async function signInAs(page: Page, c: Customer): Promise<void> {
  await envelope(await page.request.post('/api/auth/login', { data: { email: c.email, password: c.password } }), `Signing in ${c.email}`);
}

/** POST to a ZincBank API as the signed-in page. Money-moving routes get an Idempotency-Key. Returns `data`. */
export async function apiPost(page: Page, path: string, data: unknown = {}) {
  return envelope(await page.request.post(path, { data, headers: { 'Idempotency-Key': randomUUID() } }), `POST ${path}`);
}

/** Add a payee as the signed-in page. Returns the payee itself: `(await addPayee(page, 'Water Co', '555000111')).id`. */
export async function addPayee(page: Page, name: string, externalAccountNumber: string): Promise<{ id: string; name: string }> {
  return (await apiPost(page, '/api/payees', { name, externalAccountNumber })).payee;
}

// ── Funders: logins that put money into test customers. Each can send $5,000.00 a day by P2P. ──────────
// fund() starts with this worker's funder and moves on when one is out of allowance or money. After a test,
// the customer fixture sends whatever is left back to the funder, so funder (and student) balances stay whole.
type Funder = { email: string; password: string; api?: APIRequestContext; fromAccountId?: string; spent?: boolean };
let funders: Funder[] | null = null;
const fundedBy = new Map<string, string>(); // customer email -> funder email

/** Funder logins: ZB_FUNDERS="email:password,email:password" and/or ZB_FUNDER_EMAIL/ZB_FUNDER_PASSWORD. */
function funderList(): Funder[] {
  if (funders) return funders;
  const list: Funder[] = (process.env.ZB_FUNDERS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const i = s.indexOf(':');
    return { email: s.slice(0, i), password: s.slice(i + 1) };
  });
  if (process.env.ZB_FUNDER_EMAIL && process.env.ZB_FUNDER_PASSWORD) {
    list.push({ email: process.env.ZB_FUNDER_EMAIL, password: process.env.ZB_FUNDER_PASSWORD });
  }
  if (!list.length) throw new Error('fund() needs a funded ZincBank login: run npm run zb:setup (it writes zincbank/.env)');
  const start = Number(process.env.TEST_PARALLEL_INDEX ?? 0) % list.length;
  funders = [...list.slice(start), ...list.slice(0, start)];
  return funders;
}

async function ready(f: Funder): Promise<Funder> {
  if (f.api) return f;
  const api = await request.newContext({ baseURL: BASE_URL });
  await envelope(await api.post('/api/auth/login', { data: { email: f.email, password: f.password } }), 'Signing in a funder');
  const accounts = (await envelope(await api.get('/api/accounts'), 'Reading the funder accounts')).accounts as {
    id: string; type: string; balanceCents: number;
  }[];
  f.fromAccountId = accounts.filter((a) => a.type !== 'credit_card').sort((a, b) => b.balanceCents - a.balanceCents)[0].id;
  f.api = api;
  return f;
}

/** Put `cents` into c's checking (a P2P send from a funder). */
export async function fundCustomer(c: Customer, cents: number): Promise<void> {
  const problems: string[] = [];
  for (const f of funderList().filter((x) => !x.spent)) {
    await ready(f);
    const res = await f.api!.post('/api/p2p/transfers', {
      data: { fromAccountId: f.fromAccountId, recipientEmail: c.email, amountCents: cents, memo: 'zbtest funding' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { code?: string } };
    if (res.ok() && body.ok) {
      fundedBy.set(c.email, f.email);
      return;
    }
    const code = body.error?.code ?? `HTTP ${res.status()}`;
    problems.push(`${f.email}: ${code}`);
    if (code === 'P2P_LIMIT_EXCEEDED' || code === 'INSUFFICIENT_FUNDS') {
      f.spent = true;
      continue;
    }
    break;
  }
  throw new Error(`Funding ${c.email} with ${usd(cents)} failed (${problems.join('; ')})`);
}

/** Send what is left in a funded customer's deposit accounts back to its funder. Best effort, never fails a test. */
async function giveBack(page: Page, c: Customer): Promise<void> {
  const to = fundedBy.get(c.email);
  if (!to) return;
  try {
    const res = await page.request.get('/api/accounts');
    const accounts = ((await res.json()).data?.accounts ?? []) as { id: string; type: string; balanceCents: number }[];
    for (const a of accounts.filter((x) => x.type !== 'credit_card' && x.balanceCents > 0)) {
      await page.request.post('/api/p2p/transfers', {
        data: { fromAccountId: a.id, recipientEmail: to, amountCents: a.balanceCents, memo: 'zbtest give back' },
        headers: { 'Idempotency-Key': randomUUID() },
      });
    }
  } catch {
    // The test may have signed out or closed the page; the few dollars stay with the test customer.
  }
}

type Fixtures = {
  customer: Customer;
  newCustomer: (opts?: CustomerOptions) => Promise<Customer>;
  signIn: (c: Customer) => Promise<void>;
  fund: (c: Customer, cents: number) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  newCustomer: async ({ playwright }, use) => {
    const api = await playwright.request.newContext({ baseURL: BASE_URL });
    await use((opts) => createCustomer(api, opts));
    await api.dispose();
  },
  customer: async ({ page, newCustomer }, use) => {
    const c = await newCustomer();
    await signInAs(page, c);
    await use(c);
    await giveBack(page, c);
  },
  signIn: async ({ page }, use) => {
    await use((c) => signInAs(page, c));
  },
  // eslint-disable-next-line no-empty-pattern
  fund: async ({}, use) => {
    await use(fundCustomer);
  },
});
