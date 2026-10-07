import { test, expect } from '@playwright/test';

// Smoke: the store, its checkout and the webhook round trip work end to end. Uses only contract test ids.
test('a shopper buys one hub with the Visa test card and sees the payment received', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('catalog-hub-add-button').click();
  await expect(page.getByTestId('header-cart-count')).toHaveText('1');

  await page.getByTestId('header-cart-link').click();
  await expect(page.getByTestId('cart-hub-line')).toBeVisible();
  await expect(page.getByTestId('cart-total')).toHaveText('$59.93');
  await page.getByTestId('cart-checkout-button').click();

  await page.getByTestId('checkout-name-input').fill('Smoke Test');
  await page.getByTestId('checkout-email-input').fill(`e2e-smoke-${Date.now()}@example.com`);
  await page.getByTestId('checkout-card-visa').check();
  await expect(page.getByTestId('checkout-pay-button')).toHaveText('Pay $59.93');
  await page.getByTestId('checkout-pay-button').click();

  await expect(page).toHaveURL(/\/orders\/ord_/);
  await expect(page.getByTestId('order-status')).toHaveText('Payment received', { timeout: 20_000 });
  await expect(page.getByTestId('order-total')).toHaveText('$59.93');
});

test('a declined card shows the reason and keeps the cart', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('catalog-cable-add-button').click();
  await page.goto('/checkout');
  await page.getByTestId('checkout-name-input').fill('Smoke Decline');
  await page.getByTestId('checkout-email-input').fill(`e2e-decline-${Date.now()}@example.com`);
  await page.getByTestId('checkout-card-insufficient').check();
  await page.getByTestId('checkout-pay-button').click();
  await expect(page.getByTestId('checkout-error-alert')).toHaveText('Your card has insufficient funds.');
  await expect(page.getByTestId('header-cart-count')).toHaveText('1');
});
