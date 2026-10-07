// Test PaymentMethods: Stripe's frontend blocks automated testing, so the server confirms with these instead.
export const CARDS = {
  visa: { label: 'Visa ending 4242', outcome: 'Succeeds', pm: 'pm_card_visa' },
  declined: { label: 'Visa, generic decline', outcome: 'Declined', pm: 'pm_card_visa_chargeDeclined', decline: ['card_declined', 'generic_decline', 'Your card was declined.'] },
  insufficient: { label: 'Visa, insufficient funds', outcome: 'Declined', pm: 'pm_card_visa_chargeDeclinedInsufficientFunds', decline: ['card_declined', 'insufficient_funds', 'Your card has insufficient funds.'] },
  expired: { label: 'Expired card', outcome: 'Declined', pm: 'pm_card_chargeDeclinedExpiredCard', decline: ['expired_card', 'expired_card', 'Your card has expired.'] },
};
