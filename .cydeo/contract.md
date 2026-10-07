# Zinc Store — data-testid contract

The ONLY test ids that exist in the Zinc Store (base URL http://localhost:3000). Select with page.getByTestId('<id>').
If an element you need is not listed here, it has no test id: say so and stop. Never invent one.
API routes (for checks, not for UI tests): GET /api/rules, GET /api/products, GET /api/orders/<id>, GET /api/crm.

## Header (every page)
Shop link, payment-mode badge, back-office link, cart link and item count.

- header-shop-link
- header-mode-badge
- header-crm-link
- header-cart-link
- header-cart-count

## Catalog — /
One card per product. SKUs: phonepro, phoneair, phone, phonelite, case, charger, adapter, earbuds, wallet, glass, keyboard, headphones, hub, webcam, lightbar, stand, mat, cable.

- catalog-phonepro-card
- catalog-phonepro-name
- catalog-phonepro-price
- catalog-phonepro-add-button
- catalog-phoneair-card
- catalog-phoneair-name
- catalog-phoneair-price
- catalog-phoneair-add-button
- catalog-phone-card
- catalog-phone-name
- catalog-phone-price
- catalog-phone-add-button
- catalog-phonelite-card
- catalog-phonelite-name
- catalog-phonelite-price
- catalog-phonelite-add-button
- catalog-case-card
- catalog-case-name
- catalog-case-price
- catalog-case-add-button
- catalog-charger-card
- catalog-charger-name
- catalog-charger-price
- catalog-charger-add-button
- catalog-adapter-card
- catalog-adapter-name
- catalog-adapter-price
- catalog-adapter-add-button
- catalog-earbuds-card
- catalog-earbuds-name
- catalog-earbuds-price
- catalog-earbuds-add-button
- catalog-wallet-card
- catalog-wallet-name
- catalog-wallet-price
- catalog-wallet-add-button
- catalog-glass-card
- catalog-glass-name
- catalog-glass-price
- catalog-glass-add-button
- catalog-keyboard-card
- catalog-keyboard-name
- catalog-keyboard-price
- catalog-keyboard-add-button
- catalog-headphones-card
- catalog-headphones-name
- catalog-headphones-price
- catalog-headphones-add-button
- catalog-hub-card
- catalog-hub-name
- catalog-hub-price
- catalog-hub-add-button
- catalog-webcam-card
- catalog-webcam-name
- catalog-webcam-price
- catalog-webcam-add-button
- catalog-lightbar-card
- catalog-lightbar-name
- catalog-lightbar-price
- catalog-lightbar-add-button
- catalog-stand-card
- catalog-stand-name
- catalog-stand-price
- catalog-stand-add-button
- catalog-mat-card
- catalog-mat-name
- catalog-mat-price
- catalog-mat-add-button
- catalog-cable-card
- catalog-cable-name
- catalog-cable-price
- catalog-cable-add-button
- catalog-added-toast

## Cart — /cart
Lines exist only for SKUs in the cart. Totals are what the shopper sees before paying.

- cart-empty-message
- cart-phonepro-line
- cart-phonepro-qty
- cart-phonepro-increase-button
- cart-phonepro-decrease-button
- cart-phonepro-remove-button
- cart-phoneair-line
- cart-phoneair-qty
- cart-phoneair-increase-button
- cart-phoneair-decrease-button
- cart-phoneair-remove-button
- cart-phone-line
- cart-phone-qty
- cart-phone-increase-button
- cart-phone-decrease-button
- cart-phone-remove-button
- cart-phonelite-line
- cart-phonelite-qty
- cart-phonelite-increase-button
- cart-phonelite-decrease-button
- cart-phonelite-remove-button
- cart-case-line
- cart-case-qty
- cart-case-increase-button
- cart-case-decrease-button
- cart-case-remove-button
- cart-charger-line
- cart-charger-qty
- cart-charger-increase-button
- cart-charger-decrease-button
- cart-charger-remove-button
- cart-adapter-line
- cart-adapter-qty
- cart-adapter-increase-button
- cart-adapter-decrease-button
- cart-adapter-remove-button
- cart-earbuds-line
- cart-earbuds-qty
- cart-earbuds-increase-button
- cart-earbuds-decrease-button
- cart-earbuds-remove-button
- cart-wallet-line
- cart-wallet-qty
- cart-wallet-increase-button
- cart-wallet-decrease-button
- cart-wallet-remove-button
- cart-glass-line
- cart-glass-qty
- cart-glass-increase-button
- cart-glass-decrease-button
- cart-glass-remove-button
- cart-keyboard-line
- cart-keyboard-qty
- cart-keyboard-increase-button
- cart-keyboard-decrease-button
- cart-keyboard-remove-button
- cart-headphones-line
- cart-headphones-qty
- cart-headphones-increase-button
- cart-headphones-decrease-button
- cart-headphones-remove-button
- cart-hub-line
- cart-hub-qty
- cart-hub-increase-button
- cart-hub-decrease-button
- cart-hub-remove-button
- cart-webcam-line
- cart-webcam-qty
- cart-webcam-increase-button
- cart-webcam-decrease-button
- cart-webcam-remove-button
- cart-lightbar-line
- cart-lightbar-qty
- cart-lightbar-increase-button
- cart-lightbar-decrease-button
- cart-lightbar-remove-button
- cart-stand-line
- cart-stand-qty
- cart-stand-increase-button
- cart-stand-decrease-button
- cart-stand-remove-button
- cart-mat-line
- cart-mat-qty
- cart-mat-increase-button
- cart-mat-decrease-button
- cart-mat-remove-button
- cart-cable-line
- cart-cable-qty
- cart-cable-increase-button
- cart-cable-decrease-button
- cart-cable-remove-button
- cart-coupon-input
- cart-coupon-apply-button
- cart-coupon-message
- cart-subtotal
- cart-discount
- cart-shipping
- cart-tax
- cart-total
- cart-checkout-button

## Checkout — /checkout
Test cards are radio inputs: visa, declined, insufficient, expired. The pay button reads "Pay $<total>".

- checkout-name-input
- checkout-email-input
- checkout-card-visa
- checkout-card-declined
- checkout-card-insufficient
- checkout-card-expired
- checkout-subtotal
- checkout-discount
- checkout-shipping
- checkout-tax
- checkout-total
- checkout-pay-button
- checkout-error-alert

## Order confirmation — /orders/<order id>
Status text: "Processing payment…", "Payment received", "Payment failed", "Refunded".

- order-status
- order-number
- order-email
- order-total
- order-continue-link

## Back office — /crm
Rows repeat: filter them by text, e.g. getByTestId("crm-order-row").filter({ hasText: orderId }).

- crm-customers-table
- crm-customer-row
- crm-customer-email
- crm-customer-status
- crm-customer-spent
- crm-orders-table
- crm-order-row
- crm-order-id
- crm-order-status
- crm-order-amount
- crm-order-refund-button
- crm-events-table
- crm-event-row
- crm-event-type
