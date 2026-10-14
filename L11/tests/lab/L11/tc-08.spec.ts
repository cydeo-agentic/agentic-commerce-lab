import { test, expect } from '@playwright/test';

test('TC-08 Declined card shows Your card was declined. on checkout', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  
  // Add a product to the cart
  await page.getByTestId('catalog-case-add-button').click();
  await expect(page.getByTestId('header-cart-count')).toHaveText('1');

  await page.getByTestId('header-cart-link').click();
  await expect(page.getByTestId('cart-case-line')).toBeVisible();
  
  await page.getByTestId('cart-checkout-button').click();

  // Fill in checkout details
  await page.getByTestId('checkout-name-input').fill('Test Declined');
  await page.getByTestId('checkout-email-input').fill(`e2e-decline-${Date.now()}@example.com`);
  
  // Select the declined card test method
  await page.getByTestId('checkout-card-declined').check();
  
  await page.getByTestId('checkout-pay-button').click();

  // Verify the error message matches exactly as specified in TC-08
  await expect(page.getByTestId('checkout-error-alert')).toHaveText('Your card was declined.');
});
