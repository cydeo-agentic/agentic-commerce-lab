# Zinc Store — Product Requirements (v1.0)

Zinc Store sells desk gear online. A shopper fills a cart, pays by card through **Stripe**, and the **CRM ledger** records customers and orders when Stripe's webhook confirms what happened. Three systems must always agree: what the shopper **sees**, what **Stripe** did, and what the **ledger** recorded.

Every rule has an id. Test cases and bug reports cite these ids.

## Catalog and cart
- **CAT-1** The catalog lists every product with its name and price.
- **CART-1** A cart line holds a quantity from 1 to 10.
- **CART-2** After a failed payment the cart keeps its contents.

## Pricing (all money is integer cents)
- **PRICE-1** Subtotal = the sum of unit price × quantity.
- **PRICE-2** Coupon `AGENT10` takes 10% off the subtotal, rounded half up to the cent. Codes are case-insensitive. Any other code is rejected.
- **PRICE-3** Shipping is free when the subtotal after discount is **$100.00 or more**. Otherwise shipping is $7.99.
- **PRICE-4** Tax is 6% of the subtotal after discount (shipping is not taxed), rounded half up to the cent.
- **PRICE-5** Total = subtotal − discount + shipping + tax.

## Payment
- **PAY-1** The amount charged equals the total shown on the checkout page. If the server's total differs, the store must not charge and must show "Your total changed."
- **PAY-2** A declined card shows the reason: "Your card was declined." / "Your card has insufficient funds." / "Your card has expired."
- **PAY-3** Pressing Pay more than once creates one order and one charge.

## Orders
- **ORD-1** Checkout creates the order as `PENDING`.
- **ORD-2** An order becomes `PAID` only when Stripe reports `payment_intent.succeeded`.
- **ORD-3** An order becomes `PAYMENT_FAILED` when Stripe reports `payment_intent.payment_failed`.
- **ORD-4** An order becomes `REFUNDED` when Stripe reports `charge.refunded`. A refunded order never returns to `PAID`.
- **ORD-5** The confirmation page shows "Payment received" only when the ledger says `PAID`; until then it shows "Processing payment…". Its total is the amount charged.

## CRM ledger
- **CRM-1** A new email creates a customer with status `LEAD`.
- **CRM-2** A customer becomes `ACTIVE_CUSTOMER` with their first `PAID` order. A failed payment never changes a customer's status.
- **CRM-3** A customer's total spent = the sum of their `PAID` orders. A refund subtracts the refunded amount.
- **CRM-4** A customer whose every paid order has been refunded becomes `REFUNDED`.

## Webhooks
- **WH-1** Every webhook must carry a valid Stripe signature. Anything else is rejected with HTTP 400 and changes nothing.
- **WH-2** Each Stripe event is applied at most once, even when Stripe sends it again.

## Test cards (Stripe test PaymentMethods, confirmed by the server)
| Checkout option | Stripe PaymentMethod | Expected outcome |
|---|---|---|
| Visa ending 4242 | `pm_card_visa` | succeeds |
| Visa, generic decline | `pm_card_visa_chargeDeclined` | declined, "Your card was declined." |
| Visa, insufficient funds | `pm_card_visa_chargeDeclinedInsufficientFunds` | declined, "Your card has insufficient funds." |
| Expired card | `pm_card_chargeDeclinedExpiredCard` | declined, "Your card has expired." |

Why not type `4242 4242 4242 4242` into Stripe's own payment form? Stripe's hosted payment pages have security measures that block automated browsers, and Stripe recommends test PaymentMethods in code. Professional teams test their own UI and confirm the payment on the server, exactly as this store does.
