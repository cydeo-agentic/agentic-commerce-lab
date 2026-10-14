import { test, expect } from '@playwright/test';

test('TC-04 Shipping is free when post-discount subtotal is exactly $100.00 (at free-shipping threshold)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  // Add 4 stands to reach exactly $100.00 subtotal (4 × $25.00 = $100.00)
  await page.getByTestId('catalog-stand-add-button').click();
  await page.getByTestId('catalog-stand-add-button').click();
  await page.getByTestId('catalog-stand-add-button').click();
  await page.getByTestId('catalog-stand-add-button').click();
  
  // Wait for header cart count to show 4 items
  await expect(page.getByTestId('header-cart-count')).toHaveText('4');

  await page.getByTestId('header-cart-link').click();
  await expect(page.getByTestId('cart-stand-qty')).toHaveText('4');

  // Verify cart totals match expected values from TC-04
  // post-discount subtotal = $100.00, shipping = Free, tax = 6% of $100.00 = $6.00, total = $106.00
  await expect(page.getByTestId('cart-subtotal')).toHaveText('$100.00');
  await expect(page.getByTestId('cart-shipping')).toHaveText('Free');
  await expect(page.getByTestId('cart-tax')).toHaveText('$6.00');
  await expect(page.getByTestId('cart-total')).toHaveText('$106.00');

  // PAY-1: Prove the total by paying (PRICE-3 case must confirm the amount charged)
  await page.getByTestId('cart-checkout-button').click();
  await page.getByTestId('checkout-name-input').fill('TC-04 Test');
  await page.getByTestId('checkout-email-input').fill(`e2e-tc04-${Date.now()}@example.com`);
  await page.getByTestId('checkout-card-visa').check();
  // Verify checkout totals match cart totals
  await expect(page.getByTestId('checkout-subtotal')).toHaveText('$100.00');
  await expect(page.getByTestId('checkout-shipping')).toHaveText('Free');
  await expect(page.getByTestId('checkout-tax')).toHaveText('$6.00');
  await expect(page.getByTestId('checkout-total')).toHaveText('$106.00');
  await expect(page.getByTestId('checkout-pay-button')).toHaveText('Pay $106.00');
  await page.getByTestId('checkout-pay-button').click();

  // Verify order confirmation shows the expected total
  await expect(page).toHaveURL(/\/orders\/ord_/);
  await expect(page.getByTestId('order-total')).toHaveText('$106.00', { timeout: 20_000 });
});
