import { test, expect } from '@playwright/test';

// Smoke: the phones and accessories shelves sell through the same checkout. Uses only contract test ids.
test('every product in the API has exactly one catalog card', async ({ page, request }) => {
  const products: { sku: string; priceCents: number }[] = await (await request.get('/api/products')).json();
  expect(products.length).toBeGreaterThanOrEqual(18);
  await page.goto('/');
  for (const { sku, priceCents } of products) {
    await expect(page.getByTestId(`catalog-${sku}-card`)).toHaveCount(1);
    await expect(page.getByTestId(`catalog-${sku}-price`)).toHaveText(`$${(priceCents / 100).toFixed(2)}`);
  }
});

test('a shopper buys a phone and a charger and sees the payment received', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('catalog-phone-add-button').click();
  await page.getByTestId('catalog-charger-add-button').click();
  await expect(page.getByTestId('header-cart-count')).toHaveText('2');

  await page.getByTestId('header-cart-link').click();
  await expect(page.getByTestId('cart-phone-line')).toBeVisible();
  await expect(page.getByTestId('cart-charger-line')).toBeVisible();
  // $799.00 + $39.00 = $838.00, free shipping, 6% tax $50.28
  await expect(page.getByTestId('cart-subtotal')).toHaveText('$838.00');
  await expect(page.getByTestId('cart-shipping')).toHaveText('Free');
  await expect(page.getByTestId('cart-total')).toHaveText('$888.28');
  await page.getByTestId('cart-checkout-button').click();

  await page.getByTestId('checkout-name-input').fill('Smoke Phone');
  await page.getByTestId('checkout-email-input').fill(`e2e-phone-${Date.now()}@example.com`);
  await page.getByTestId('checkout-card-visa').check();
  await expect(page.getByTestId('checkout-pay-button')).toHaveText('Pay $888.28');
  await page.getByTestId('checkout-pay-button').click();

  await expect(page).toHaveURL(/\/orders\/ord_/);
  await expect(page.getByTestId('order-status')).toHaveText('Payment received', { timeout: 20_000 });
  await expect(page.getByTestId('order-total')).toHaveText('$888.28');
});

test('the last card on a scrolling shelf can be added, and the back office link works on a phone-size screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTestId('catalog-glass-add-button').click();
  await expect(page.getByTestId('header-cart-count')).toHaveText('1');
  await page.getByTestId('header-crm-link').click();
  await expect(page.getByTestId('crm-orders-table')).toBeVisible();
});
