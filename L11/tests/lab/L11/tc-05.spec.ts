import { test, expect } from '@playwright/test';

test('TC-05 Coupon agent10 (lowercase) applies a 10% discount, confirming case-insensitivity', async ({ page }) => {
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
  await expect(page.getByTestId('cart-subtotal')).toHaveText('$100.00');

  // Apply coupon 'agent10' (lowercase)
  await page.getByTestId('cart-coupon-input').fill('agent10');
  await page.getByTestId('cart-coupon-apply-button').click();

  // Verify expected values from TC-05:
  // 10% of $100.00 = $10.00 discount, displayed as −$10.00
  // post-discount subtotal = $90.00 (below $100.00 threshold, so shipping = $7.99)
  // tax = 6% of $90.00 = $5.40
  // total = $100.00 − $10.00 + $7.99 + $5.40 = $103.39
  await expect(page.getByTestId('cart-discount')).toHaveText('−$10.00');
  await expect(page.getByTestId('cart-shipping')).toHaveText('$7.99');
  await expect(page.getByTestId('cart-tax')).toHaveText('$5.40');
  await expect(page.getByTestId('cart-total')).toHaveText('$103.39');

  // PAY-1: Prove the total by paying (PRICE-2 case must confirm the amount charged)
  await page.getByTestId('cart-checkout-button').click();
  await page.getByTestId('checkout-name-input').fill('TC-05 Test');
  await page.getByTestId('checkout-email-input').fill(`e2e-tc05-${Date.now()}@example.com`);
  await page.getByTestId('checkout-card-visa').check();
  // Verify checkout totals match cart totals
  await expect(page.getByTestId('checkout-subtotal')).toHaveText('$100.00');
  await expect(page.getByTestId('checkout-discount')).toHaveText('−$10.00');
  await expect(page.getByTestId('checkout-shipping')).toHaveText('$7.99');
  await expect(page.getByTestId('checkout-tax')).toHaveText('$5.40');
  await expect(page.getByTestId('checkout-total')).toHaveText('$103.39');
  await expect(page.getByTestId('checkout-pay-button')).toHaveText('Pay $103.39');
  await page.getByTestId('checkout-pay-button').click();

  // Verify order confirmation shows the expected total
  await expect(page).toHaveURL(/\/orders\/ord_/);
  await expect(page.getByTestId('order-total')).toHaveText('$103.39', { timeout: 20_000 });
});
