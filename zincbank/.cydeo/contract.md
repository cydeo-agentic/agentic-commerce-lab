# ZincBank UI Testability Contract

Ground truth for Playwright specs and QA agents. Built from source at `origin/main` 36a5b5f (the code that runs on production). Every ID below was taken from `src/` with a TypeScript AST scan, not typed from memory.

---

## 0. Iron Invariants

- **System under test in this lab:** the ZincBank **lab build** at `https://zincbank-lab.vercel.app` (`zincbank/playwright.config.ts`, override with `ZB_BASE_URL`). Every page carries a yellow banner, `lab-banner` ("ZINCBANK LAB · TEST ENVIRONMENT · BUILD 101"). It is shared by everyone, so tests never call `/api/admin/*` and never depend on another person's data: each test makes its own customer with the fixtures in `zincbank/fixtures.ts`.
- **Locator strategy:** `page.getByTestId('<id>')`. The attribute is the default `data-testid`; do not change `testIdAttribute`.
- **Iron Invariant:**
  > *"These are the ONLY valid test IDs that exist in the ZincBank application. If an element or button you need is not listed in this contract, IT DOES NOT EXIST. You are strictly forbidden from inventing test IDs, guessing attributes, or scraping fragile CSS classes / XPaths. If a test ID is missing from this contract, report it as an untestable UI defect."*
- **Sync rule:** `tests/catalog/testids.ts` + `tests/testid-audit.spec.ts` (vitest) keep the repo catalog equal to `src/`. If this contract and source ever disagree, source wins and this file is regenerated.
- **Isolation:** every test signs in as its own new customer (`zincbank/fixtures.ts`), so specs may run in parallel.
- **Money:** the database and API use integer cents. The UI shows `formatUSD(cents)`: `$1,234.56`, `-$6.40`, `$0.00`. Amount inputs take **dollar strings** (`"25"`, `"25.5"`, `"25.50"`), at most 2 decimals. Anything else fails with `INVALID_AMOUNT`.
- **Result banners show raw error codes.** On failure, the `*-result` banners on Move money show the server code itself, e.g. `INSUFFICIENT_FUNDS`, `SAME_ACCOUNT_TRANSFER`, `RECIPIENT_NOT_FOUND`. Assert on the code, not on prose.

### State reset and seed endpoints (FORBIDDEN in this lab — listed only so you recognise them)

| Method + path | Header | Effect |
|---|---|---|
| `POST /api/admin/seed` | `x-seed-token: <ZINC_SEED_TOKEN>` (or `?token=`) | Truncates ALL business tables (`zinc_truncate_business`), then rebuilds the 7 pinned users, accounts, history and Grace's card. Same auth users and ids on every run. |
| `POST /api/admin/reset` | same | Identical to seed (same handler). |
| `POST /api/admin/run-scheduled` | same; optional `?asOf=YYYY-MM-DD` or body `{ "asOf": "YYYY-MM-DD" }` | Runs every scheduled payment due as of `asOf`. Reproducible when `asOf` is given. |
| `GET /api/health` | none | Health probe (public). |

No token or a wrong token → `401 UNAUTHENTICATED`. The token lives in `.env.local` (gitignored).

> **HAZARD:** the local `.env.local`, production (`zincbank.cydeo.io`) and the lab (`zincbank-lab.vercel.app`) all point at the **same** Supabase project (`rjjnqfkldqarppskdwwl`). A seed/reset wipes every non-seed customer's data, including the 300 student logins. Run seed/reset only against a database you own, and only with the owner's yes.

**Seed users** (`supabase/seed/seed.ts`; password for all: `Passw0rd!`):

| Email | Name | Checking | Savings | Card |
|---|---|---|---|---|
| `casey@zinc.test` | Casey Quinn | $5,000.00 (…0001) | $25,000.00 (…0002) | none |
| `bob@zinc.test` | Bob Sutton | $2,500.50 (…0011) | $10,000.00 (…0012) | none |
| `carol@zinc.test` | Carol Nguyen | $1,200.00 (…0021) | $3,000.00 (…0022) | none |
| `dave@zinc.test` | Dave Miller | $300.00 (…0031) | $150.00 (…0032) | none |
| `erin@zinc.test` | Erin Davis | $50.00 (…0041) | $0.00 (…0042) | none |
| `frank@zinc.test` | Frank Garcia | $0.00 (…0051) | $0.00 (…0052) | none |
| `grace@zinc.test` | Grace Lee | $8,000.00 (…0061) | $40,000.00 (…0062) | Tier 2, limit $5,000.00, APR 21.99% (…0063) |

The seeded history nets to $0 per account, so these balances hold right after a seed.

### Customer API (for preconditions; all need a signed-in session cookie, else `401` envelope)

`GET/POST /api/accounts` · `GET /api/accounts/{id}` · `GET /api/dashboard` · `POST /api/transfers`* · `POST /api/bill-pay`* · `GET/POST /api/payees` · `DELETE /api/payees/{id}` · `GET/POST /api/scheduled-payments` · `DELETE /api/scheduled-payments/{id}` · `GET /api/transactions?accountId=&limit=&offset=&from=&to=` · `POST /api/transactions/{transactionId}/reverse`* · `GET /api/statements/{accountId}/periods` · `GET /api/statements/{accountId}?year=&month=` (PDF) · `GET /api/p2p/limits` · `POST /api/p2p/recipients/lookup` · `POST /api/p2p/transfers`* · `GET /api/credit/card` · `POST /api/credit/apply` · `POST /api/credit/pay` · `POST /api/credit/charge` · `GET /api/credit/statements/{accountId}?year=&month=` (PDF) · `GET/PATCH /api/profile` · `POST /api/auth/change-password`.

Public: `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/register` · `POST /api/onboarding/submit`.

\* Needs an `Idempotency-Key` header (a UUID). Reusing a key with a different body → `409 IDEMPOTENCY_KEY_REUSED`.

### Route map (what actually exists)

| Route | Auth | Section |
|---|---|---|
| `/` | public | §10 Marketing home |
| `/login` | public | §1 |
| `/apply` | public | §1 (registration = the onboarding wizard) |
| `/dashboard` | signed in | §2 |
| `/accounts`, `/accounts/{id}` | signed in | §3 |
| `/move-money` | signed in | §4 transfers + bill pay, §5 P2P, §8 scheduled, payees |
| `/transactions` | signed in | §3 ledger + §7 statements |
| `/cards` | signed in | §6 |
| `/profile` | signed in | §9 |
| `/kit` | public | §11 design-system fixture page |

Any other path while signed out redirects to `/login` (API paths get a `401` JSON envelope instead). `/practice` is on the middleware's public list but has no page.

**These routes do NOT exist:** `/register`, `/p2p`, `/statements`, `/scheduled`, `/transfers`. Use the routes above.

---

## 1. Authentication — `/login`, `/apply`, sign out

**Behavior**
- `/login` checks the email format and that the password is not empty before calling Supabase. A client-side failure shows `login-error` = `Enter your email and password.` Wrong credentials show `Invalid email or password.` Success → `/dashboard`.
- There is no "session expired" screen. A missing or expired session on a protected page redirects to `/login` with no message.
- `/apply` is a 7-panel wizard. `apply-step-{n}` is the current panel (n = 0..6). The `apply-progress` text reads `Step {n+1} of 6 · {title}` for n = 0..5. Titles: 0 Choose your accounts · 1 About you · 2 Identity (simulated) · 3 Your address · 4 Security · 5 Review & confirm · 6 Approved.
- `apply-next` on an invalid step does not advance. Field errors show as `role="alert"` text under each field, with **no test ID** (see Gap Analysis). Onboarding always approves. Password: at least 8 characters.

**Form inputs**
- `login-email-input` · `login-password-input`
- `apply-account-savings-toggle` (checkbox, step 0)
- `apply-firstname-input` · `apply-lastname-input` · `apply-email-input` · `apply-phone-input` (masked `(555) 123-4567`) · `apply-dob-input` (date) — step 1
- `apply-ssn-input` (masked `123-45-6789`) · `apply-employment-select` (native select) — step 2
- `apply-addressline-input` · `apply-city-input` · `apply-state-select` (native select) · `apply-zip-input` — step 3
- `apply-password-input` · `apply-confirm-input` — step 4
- `apply-terms-checkbox` — step 5

**Action buttons**
- `login-submit` · `login-apply-link` (→ `/apply`)
- `apply-back` (steps 1–5) · `apply-next` (steps 0–4) · `apply-submit` (step 5) · `apply-decision-continue` (step 6, signs in → `/dashboard`)
- `nav-signout` (app header, every signed-in page) → `/login`

**Displays**
- `login-page` (page root) · `apply-page` (page root) · `apply-progress` · `apply-review-summary` (step 5 `<dl>`; SSN shown as `•••-••-1234`)
- `apply-decision-approved` (step 6 panel; **same ID as the credit-card decision marker on `/cards`**, scope by page)

**Alerts**
- `login-error` · `apply-error` (server error banner)

**Repeated / templated**
- `apply-step-{n}` — `apply-step-0` … `apply-step-6`

---

## 2. Dashboard — `/dashboard`

**Behavior:** rendered on the server for the signed-in user. The card tile shows only when the user has a card (seed: Grace only). Recent activity lists the 10 latest transactions.

**Action buttons**
- `dashboard-quick-transfer` (link → `/move-money`)
- `dashboard-account-card-{accountId}` (each card is a link → `/accounts/{accountId}`)

**Money displays**
- `dashboard-total-deposit` — formatted USD, checking + savings (excludes the card)
- `dashboard-card-summary` — card tile container. Its inner values (available, limit, APR) have **no IDs**; read them inside the container by label text.

**Text**
- `dashboard-welcome` — `Welcome, {firstName}`
- `dashboard-recent-activity` (section) · `dashboard-recent-empty` (`No activity yet.`)

**Repeated rows**
- `dashboard-account-card-{accountId}` — contains the type label, `••{last4}` and the balance
- `txn-row-{transactionId}` — inside `dashboard-recent-activity`; **transaction** id here (on `/transactions` the row id is the ledger-entry id)

```ts
const recent = page.getByTestId('dashboard-recent-activity')
await expect(recent.locator('[data-testid^="txn-row-"]').filter({ hasText: 'Transfer' }).first()).toBeVisible()
```

---

## 3. Accounts and Ledger — `/accounts`, `/accounts/{id}`, `/transactions`

**Behavior**
- `/accounts` lists deposit accounts. `accounts-open-savings` opens one more savings account (`POST /api/accounts`).
- `/accounts/{id}` shows the full account and routing numbers. Someone else's id → 404 page. It has no ledger; history lives on `/transactions`.
- `/transactions`: pick an account (deposit or card), optional from/to date filter, 25 rows per page. The table columns are Date (`MM/DD/YYYY`), Description, Type, Amount (signed, `+$x` for credits), Balance (running), Action. **There is no text search box.**
- Reverse: shown only when the server says the row can be reversed. On success the page reloads the rows and `transactions-reverse-result` reads `Reversed {amount} — original marked reversed.` The reversed row then shows `txn-reversed-{transactionId}`.

**Form inputs**
- `transactions-account` (native select; option text `Checking ••0001 ($5,000.00)`)
- `transactions-from` · `transactions-to` (type=date, `YYYY-MM-DD`)

**Action buttons**
- `accounts-open-savings` · `account-detail-back` (→ `/accounts`)
- `transactions-apply` · `transactions-prev` · `transactions-next` (disabled at the first/last page)
- `txn-reverse-{transactionId}`

**Money displays**
- `account-detail-balance` (formatted USD) · `transactions-balance` (formatted USD, current balance of the selected account)
- `account-detail-number` · `account-detail-routing` (plain text, full numbers)
- `transactions-summary` (balance label, `Current Balance` or `Balance Owed`, plus masked number and type)
- `transactions-total` — `{n} total`

**Alerts**
- `accounts-open-savings-error` · `transactions-error` (shows the error code) · `transactions-reverse-result` · `transactions-empty` (`No transactions for this account and range.`)

**Containers**
- `accounts-list` · `transactions-view` · `transactions-table`

**Repeated rows**
- `accounts-card-{accountId}` (link → detail page; on `/accounts`)
- `txn-row-{ledgerEntryId}` (on `/transactions`) — **the row ID is the ledger-entry id; the Reverse button inside it uses the transaction id**
- `txn-reverse-{transactionId}` · `txn-reversed-{transactionId}`

```ts
const row = page.getByTestId('transactions-table').locator('[data-testid^="txn-row-"]').filter({ hasText: 'Bill Pay' }).first()
await row.locator('[data-testid^="txn-reverse-"]').click()
await expect(page.getByTestId('transactions-reverse-result')).toContainText('Reversed')
```

---

## 4. Internal Transfers and Bill Pay — `/move-money`

**Behavior**
- There is **no confirm modal and no success screen** for a transfer or a bill payment. Submitting posts at once (with a fresh `Idempotency-Key`). The result shows in an inline banner: success `Transferred — new balance $X.` / `Paid — new balance $X.`; failure = the error code.
- Source/destination are **native `<select>`** elements whose values are account ids. Option text is `{Type} ••{last4} ({balance})`.
- There are no external (ACH/wire) transfers. "External" money leaves only through bill pay to a saved payee.
- Bill pay with no payees shows `billpay-no-payees` instead of the form.

**Form inputs**
- `transfer-from` · `transfer-to` · `transfer-amount` (dollars) · `transfer-memo`
- `billpay-from` · `billpay-payee` (option text `{name} ••{last4}`) · `billpay-amount`
- `payee-add-name` · `payee-add-account`

**Action buttons**
- `transfer-submit` · `billpay-submit` · `payee-add-submit` · `payee-delete-{payeeId}` (deletes at once, no confirm)

**Alerts**
- `transfer-result` · `billpay-result` · `billpay-no-payees` · `payee-add-error`

**Containers**
- `transfer-form` · `billpay-form` · `payee-manager`

**Repeated rows**
- `payee-row-{payeeId}` (name + `••{last4}`)

```ts
await page.getByTestId('payee-manager').locator('[data-testid^="payee-row-"]').filter({ hasText: 'Electric Co' })
```

---

## 5. P2P (Send to someone) — panel on `/move-money`

**Behavior**
- Two steps: **enter → review → send**. Lookup is **by email only** (no phone, no handle). Changing the email clears the found recipient, so you must press Find again.
- `p2p-review` stays disabled until a lookup succeeds. A bad amount → `p2p-result` = `INVALID_AMOUNT`, and you stay on the enter step.
- Daily limit $5,000.00. `p2p-remaining` reads `Remaining today: $X of $5,000.00` (before the limits call returns: `Daily limit: $5,000.00`).
- The Idempotency-Key is made once per review. A double-click on `p2p-confirm` sends once. On a network error you stay on review with the same key, and the banner says `Network error — press Send again to retry safely`.
- Success: `Sent $X to {Name} — new balance $Y.` and back to the enter step. A P2P send cannot be reversed.
- Error codes you can see: `RECIPIENT_NOT_FOUND`, `RECIPIENT_IS_SELF`, `P2P_LIMIT_EXCEEDED`, `INSUFFICIENT_FUNDS`, `INVALID_AMOUNT`.

**Form inputs**
- `p2p-from` (native select) · `p2p-recipient-email` · `p2p-amount` · `p2p-memo`

**Action buttons**
- `p2p-lookup` (Find) · `p2p-review` · `p2p-confirm` (Send) · `p2p-edit`

**Displays**
- `p2p-remaining` · `p2p-recipient-name` (`Sending to {displayName}` / `Find a recipient by their email first.`)
- `p2p-review-recipient` · `p2p-review-email` · `p2p-review-amount` (formatted USD)

**Alerts / containers**
- `p2p-result` · `p2p-panel` · `p2p-form` (enter step) · `p2p-review-panel` (review step; acts as the confirmation dialog, inline, not a modal)

---

## 6. Credit Card — `/cards`

**Behavior**
- Loads `GET /api/credit/card`. No card → application form; a card → summary + pay form + statement link. Wait for one of them; nothing renders before the first load finishes.
- Decision engine: approve/reject. The markers `apply-decision-approved` / `apply-decision-rejected` stay on screen after the decision. Reject reasons show in `cards-apply-result`: employment status / annual income below the minimum / debt-to-income ratio above the maximum / overall application score.
- **These do NOT exist:** virtual cards, card visual art, unmask number/CVV, freeze/unfreeze toggle, credit-limit progress bar. The card number shows only as `•••• •••• •••• {last4}` with no ID.

**Form inputs**
- `cards-apply-income-input` (annual, dollars) · `cards-apply-employment-select` (native; `employed|self_employed|retired|student|unemployed`) · `cards-apply-housing-input` (monthly) · `cards-apply-debt-input` (monthly)
- `cards-pay-from-select` · `cards-pay-amount-input`

**Action buttons**
- `cards-apply-submit` · `cards-pay-submit` (disabled with no deposit accounts) · `cards-statement-download` (link to the current UTC month's card statement PDF)

**Money displays** (formatted USD)
- `cards-card-balance` (balance owed) · `cards-card-limit` · `cards-card-available` · `cards-card-apr` (`21.99%`)

**Alerts / markers**
- `cards-apply-result` · `cards-pay-result` (`Payment posted to your card.`) · `apply-decision-approved` · `apply-decision-rejected`

**Containers**
- `cards-view` · `cards-apply-form` · `cards-card-summary` · `cards-pay-form`

---

## 7. Statements and PDF Exports — on `/transactions` (deposit + card) and `/cards`

**Behavior:** the period picker is filled from `GET /api/statements/{accountId}/periods`. The first (latest) period is chosen by default. With no periods, the picker is disabled (`No statements yet`) and the link has `aria-disabled="true"` and `href="#"`. The link goes to `/api/statements/{id}?year=&month=` for deposit accounts and `/api/credit/statements/{id}?year=&month=` for the card. **There is no reconciliation preview and no separate year selector.**

- `transactions-period` (native select; value `YYYY-M`, e.g. `2026-9`)
- `transactions-statement` (anchor; download)
- `cards-statement-download` (anchor; card, current month)

```ts
const [download] = await Promise.all([
  page.waitForEvent('download').catch(() => null),
  page.getByTestId('transactions-statement').click(),
])
// Or assert the link without downloading:
await expect(page.getByTestId('transactions-statement')).toHaveAttribute('href', /\/api\/statements\/.+\?year=\d{4}&month=\d{1,2}$/)
```

---

## 8. Scheduled Payments — panel on `/move-money`

**Behavior**
- **One-time, future-dated only.** There is no frequency picker and no recurring schedule. Type is `transfer` or `bill_pay`. The To / Payee field swaps with the type.
- Date: today up to 365 days ahead. A past or too-far date → `INVALID_SCHEDULED_DATE`. Success: `Scheduled for MM/DD/YYYY.`
- A payment runs only when `POST /api/admin/run-scheduled` is called (no background clock in tests).
- `schedule-cancel-{id}` shows only while the status is `scheduled`. Cancel → `Scheduled payment cancelled.`
- Status text: `scheduled` / `executed` / `cancelled` / `failed · {CODE}`.

**Form inputs**
- `schedule-type` (native; `transfer` | `bill_pay`) · `schedule-from` · `schedule-to` (when transfer) · `schedule-payee` (when bill_pay; disabled with no payees) · `schedule-amount` · `schedule-date` (type=date, `YYYY-MM-DD`) · `schedule-memo`

**Action buttons**
- `schedule-submit` · `schedule-cancel-{scheduledPaymentId}`

**Alerts / containers**
- `schedule-result` · `schedule-empty` (`Nothing scheduled yet.`) · `schedule-panel` · `schedule-form` · `schedule-list` (table)

**Repeated rows**
- `schedule-row-{scheduledPaymentId}` · `schedule-status-{scheduledPaymentId}`

```ts
const row = page.getByTestId('schedule-list').locator('[data-testid^="schedule-row-"]').filter({ hasText: '$25.00' })
await expect(row.locator('[data-testid^="schedule-status-"]')).toHaveText('scheduled')
```

---

## 9. Global Navigation, Profile and Notifications

**Behavior:** the app has a **top header nav**, not a sidebar. On narrow screens the nav labels hide and only icons show; the test IDs stay the same. **There are no notification badges, no badge counters and no profile menu in the header.** Toasts exist only on `/kit` (no app page fires a toast).

**Header (every signed-in page)**
- `nav-dashboard` · `nav-accounts` · `nav-move-money` · `nav-transactions` · `nav-cards` · `nav-profile` · `nav-signout` · `theme-toggle`

**Profile — `/profile`**
- Inputs: `profile-firstname-input` · `profile-lastname-input` · `profile-phone-input` · `profile-addressline-input` · `profile-email-input` (disabled, read-only)
- Password: `profile-currentpassword-input` · `profile-newpassword-input` (at least 8)
- Buttons: `profile-save` · `profile-changepassword-submit`
- Status (`role="status"`): `profile-form-status` (`Profile saved` or the first validation reason) · `profile-password-status` (`Password changed` or an error)
- Containers: `profile-view` · `profile-form` (renders only after `GET /api/profile` returns) · `profile-password-form`

**Toasts (only on `/kit`)**
- `toast-{n}` — `n` is a counter that goes up for each toast in the page session (1, 2, …). Auto-dismissed after 4 s. The dismiss button has no ID.

---

## 10. Marketing Home — `/`

- `home-nav-login` · `home-nav-apply` · `home-theme-toggle`
- `home-hero-cta-apply` · `home-hero-cta-login`
- `home-feature-checking` · `home-feature-move` · `home-feature-card` · `home-feature-statements`
- `home-footer-disclaimer`
- `txn-row` — the static sample rows in the hero picture (three rows with the same ID; not real data)

---

## 11. Design-System Fixture — `/kit` (public)

- Buttons: `kit-button-primary` · `kit-button-secondary` · `kit-button-ghost` · `kit-button-outline` · `kit-button-destructive`
- Money: `kit-money-zero` (`$0.00`) · `kit-money-positive` (`$1,234.56`) · `kit-money-negative` (`-$6.40`) · `kit-money-large` (`$1,000,000.00`)
- Inputs: `kit-input-text` · `kit-masked-ssn` · `kit-masked-phone` · `kit-select` · `kit-checkbox` · `kit-radio-checking` · `kit-radio-savings`
- Badges/banner: `kit-badge-success` · `kit-badge-warning` · `kit-badge-error` · `kit-badge-neutral` · `kit-banner-disclaimer`
- Overlays: `kit-toast-trigger` · `kit-modal-trigger` · `kit-modal` (role=dialog, Escape closes) · `kit-modal-close` · `kit-tooltip-trigger`
- Misc: `kit-skeleton` · `kit-theme-toggle` · `kit-account-card`
- Rows: `txn-row-demo-1` · `txn-row-demo-2` · `txn-row-demo-3` (fixed sample ids of the `txn-row-{transactionId}` pattern)

---

## 12. Template Registry (all parameterized IDs)

| Pattern | Route | `{…}` is |
|---|---|---|
| `apply-step-{n}` | `/apply` | step index 0–6 |
| `dashboard-account-card-{accountId}` | `/dashboard` | account UUID |
| `accounts-card-{accountId}` | `/accounts` | account UUID |
| `txn-row-{transactionId}` | `/dashboard`, `/kit` | transaction UUID (kit: `demo-1..3`) |
| `txn-row-{ledgerEntryId}` | `/transactions` | ledger-entry UUID |
| `txn-reverse-{transactionId}` | `/transactions` | transaction UUID |
| `txn-reversed-{transactionId}` | `/transactions` | transaction UUID |
| `payee-row-{payeeId}` | `/move-money` | payee UUID |
| `payee-delete-{payeeId}` | `/move-money` | payee UUID |
| `schedule-row-{scheduledPaymentId}` | `/move-money` | scheduled-payment UUID |
| `schedule-status-{scheduledPaymentId}` | `/move-money` | scheduled-payment UUID |
| `schedule-cancel-{scheduledPaymentId}` | `/move-money` | scheduled-payment UUID |
| `toast-{n}` | `/kit` | counter |
| `{modalTestId}-close` | wherever `<Modal data-testid>` is used (only `kit-modal` today) | parent modal id |

Ids are UUIDs and change on every seed. Find rows with a prefix locator plus `.filter({ hasText })`, never with a hard-coded UUID.

---

## 13. Playwright Helper Reference

```ts
import { test, expect, type Page, type Locator } from '@playwright/test'

// ── Sign in (UI) ────────────────────────────────────────────────────────────
export async function signIn(page: Page, email = 'casey@zinc.test', password = 'Passw0rd!') {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(email)
  await page.getByTestId('login-password-input').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// ── Money: inputs take DOLLAR strings; the API/DB use integer cents ────────
export const centsToInput = (cents: number) => (cents / 100).toFixed(2)          // 2550 -> "25.50"
export const formatUSD = (cents: number) => {                                     // mirrors src/lib/money.ts
  const neg = cents < 0, abs = Math.abs(Math.trunc(cents))
  const dollars = Math.trunc(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}$${dollars}.${(abs % 100).toString().padStart(2, '0')}`
}
export async function fillAmount(input: Locator, cents: number) {
  await input.fill(centsToInput(cents))   // never type "$", commas, or 3 decimals
}

// ── Native <select> dropdowns (every ZincBank dropdown is a native <select>) ─
await page.getByTestId('transfer-from').selectOption({ label: /^Checking ••0001/ })   // by visible text
await page.getByTestId('schedule-type').selectOption('bill_pay')                      // by value
// Values are account UUIDs; pick by label, or read the value from the option:
const savingsId = await page.getByTestId('transfer-to').locator('option', { hasText: 'Savings' }).first().getAttribute('value')

// ── Read and verify money ────────────────────────────────────────────────────
const USD = /^-?\$\d{1,3}(,\d{3})*\.\d{2}$/
export async function readCents(el: Locator): Promise<number> {
  const t = (await el.innerText()).trim()             // "$1,234.56" / "-$6.40" / "+$25.00"
  const neg = t.startsWith('-')
  return (neg ? -1 : 1) * Number(t.replace(/[^0-9]/g, ''))
}
await expect(page.getByTestId('dashboard-total-deposit')).toHaveText(USD)
await expect(page.getByTestId('dashboard-total-deposit')).toHaveText(formatUSD(3_000_000))   // casey: $30,000.00
await expect(page.getByTestId('transfer-result')).toHaveText(/new balance \$[\d,]+\.\d{2}\./)

// A transfer: compare before/after in cents (exact integer math)
const before = await readCents(page.getByTestId('dashboard-total-deposit'))

// ── Rows: prefix locator + filter by text, never a hard-coded UUID ──────────
const rows = page.getByTestId('transactions-table').locator('[data-testid^="txn-row-"]')
const memoRow = rows.filter({ hasText: 'rent split' })
await expect(memoRow).toHaveCount(1)
await expect(memoRow).toContainText('-$25.00')

// ── P2P happy path ─────────────────────────────────────────────────────────
await page.getByTestId('p2p-recipient-email').fill('bob@zinc.test')
await page.getByTestId('p2p-lookup').click()
await expect(page.getByTestId('p2p-recipient-name')).toHaveText('Sending to Bob Sutton')
await fillAmount(page.getByTestId('p2p-amount'), 2500)
await page.getByTestId('p2p-review').click()
await expect(page.getByTestId('p2p-review-amount')).toHaveText('$25.00')
await page.getByTestId('p2p-confirm').click()
await expect(page.getByTestId('p2p-result')).toContainText('Sent $25.00 to Bob Sutton')

// ── Seed in a beforeAll (only against a database you own) ───────────────────
test.beforeAll(async ({ request }) => {
  const res = await request.post('/api/admin/reset', { headers: { 'x-seed-token': process.env.ZINC_SEED_TOKEN! } })
  expect(res.ok()).toBeTruthy()
})
```

---

## 14. Untestable-UI Gap Register

These elements are on screen but have **no test ID**. Per the Iron Invariant, report them as defects. Do not work around them with CSS or XPath.

| # | Element | Where | Impact |
|---|---|---|---|
| G1 | Field-level validation messages (`role="alert"` under each input) | `src/components/ui/FormField.tsx:40` (all `/apply` steps) | Cannot assert which field failed. Fallback: `getByRole('alert')` inside the step panel. |
| G2 | Terms-not-accepted message | `src/components/apply/ApplyWizard.tsx:504` | Same as G1. |
| G3 | "Checking (always included)" and "Joint account (coming soon)" checkboxes | `ApplyWizard.tsx:255`, `:274` | Cannot assert the fixed or disabled state. |
| G4 | Header logo link (→ `/dashboard`) | `src/app/(app)/layout.tsx:34` | Use `nav-dashboard` instead. |
| G5 | Logo/home links on `/login`, `/apply`, `/` | `login/page.tsx:14`, `ApplyWizard.tsx:222`, `TopNav.tsx:22` | Nav to `/` cannot be tested by ID. |
| G6 | Marketing top-nav section links and footer links | `TopNav.tsx:35`, `SiteFooter.tsx:41` | Anchor nav cannot be tested by ID. |
| G7 | Toast dismiss button | `src/components/ui/Toast.tsx:64` | Only `/kit`. |
| G8 | `/kit` unlabeled buttons (sm buttons, loading, disabled, modal Cancel/Confirm) and the invalid email input | `src/app/kit/page.tsx:59,60,113,114,133,217,220` | Fixture page only. |
| G9 | Dashboard card tile values (available credit, limit, APR) | `src/components/banking/CardSummary.tsx` | Only the container `dashboard-card-summary` has an ID. |
| G10 | Account status pill on account detail | `src/app/(app)/accounts/[id]/page.tsx` | Cannot assert active/frozen/closed by ID. |
| G11 | Balance and `••last4` inside account cards | `src/components/ui/AccountCard.tsx` | Read them inside `dashboard-account-card-*` / `accounts-card-*` by text. |
| G12 | Transaction table cells (date, description, type, amount, running balance) | `TransactionsView.tsx` | Assert with row `hasText`; no per-cell IDs. |
| G13 | Scheduled row amount and "To" cells | `ScheduledPayments.tsx` | Same as G12. |
| G14 | P2P review "From" value | `P2PPanel.tsx` | Cannot assert the source account on review. |
| G15 | Masked card number `•••• •••• •••• 1234` | `CardsView.tsx` | Cannot assert by ID. |
| G16 | Payee empty state `No payees yet.` | `PayeeManager.tsx` | Cannot assert the empty list by ID. |
| G17 | Apply step-6 welcome heading (`Welcome to ZincBank, {name}`) | `ApplyWizard.tsx` | Assert inside `apply-decision-approved`. |
| G18 | Page `<h1>` headings on Accounts, Move money, Transactions, Cards, Profile | page files | Use `nav-*` / page containers instead. |

**Other contract defects found**
- **D1 — duplicate ID:** `apply-decision-approved` means the onboarding success panel on `/apply` AND the credit-approval marker on `/cards`. Always scope it by route.
- **D2 — same pattern, different id type:** `txn-row-{id}` holds a transaction id on `/dashboard` but a ledger-entry id on `/transactions`.
- **D3 — non-unique ID:** the marketing hero renders three rows all with `txn-row` (no id).
- **D4 — repo catalog drift:** `tests/catalog/testids.ts` leaves out two IDs that do render: `theme-toggle` (the default value in `src/components/theme-toggle.tsx`, on every signed-in page) and the static `txn-row` (hero). The repo's audit regex misses default-parameter and ternary forms.
- **D5 — dead code:** `src/components/marketing/ComingSoon.tsx` takes a `testid` prop but no page renders it. `/practice` is public in the middleware but has no page.

**Asked-for features that do not exist on main** (do not write specs for them): `/register` page, session-expired screen, ledger text search, transfer confirm modal and success screen, external ACH/wire transfers, P2P lookup by phone, virtual cards, card art, unmask number/CVV, freeze toggle, credit-limit bar, reconciliation preview, recurring/frequency schedules, sidebar, header profile menu, notification badges/counters, toasts in the app.
