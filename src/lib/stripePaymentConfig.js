/** Stripe Payment Element + Appearance — shared config for ShowSkills checkout. */

export const stripeElementsAppearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#14b8a6',
    colorBackground: '#0c0a09',
    colorText: '#fafaf9',
    colorTextSecondary: '#d6d3d1',
    colorDanger: '#f87171',
    fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSizeBase: '16px',
    spacingUnit: '4px',
    borderRadius: '10px',
    focusBoxShadow: '0 0 0 2px rgba(20, 184, 166, 0.35)',
    focusOutline: 'none',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(255,255,255,0.14)',
      backgroundColor: 'rgba(0,0,0,0.4)',
      boxShadow: 'none',
      padding: '12px 14px',
      lineHeight: '1.4',
      color: '#fafaf9',
    },
    '.Input:focus': {
      border: '1px solid rgba(20, 184, 166, 0.65)',
      boxShadow: '0 0 0 2px rgba(20, 184, 166, 0.22)',
    },
    '.Label': {
      color: '#d6d3d1',
      fontWeight: '500',
      marginBottom: '6px',
    },
    '.Text': {
      color: '#e7e5e4',
    },
    '.Tab': {
      border: '1px solid rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(0,0,0,0.35)',
      color: '#e7e5e4',
    },
    '.Tab--selected': {
      border: '1px solid rgba(20, 184, 166, 0.55)',
      backgroundColor: 'rgba(13, 148, 136, 0.18)',
      color: '#fafaf9',
    },
    '.TabLabel': {
      color: '#e7e5e4',
    },
    '.TabLabel--selected': {
      color: '#fafaf9',
    },
    '.TabIcon': {
      color: '#d6d3d1',
    },
    '.TabIcon--selected': {
      color: '#fafaf9',
    },
    '.AccordionItem': {
      border: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(0,0,0,0.2)',
      color: '#e7e5e4',
    },
    '.TermsText': { display: 'none' },
    '.TermsLink': { display: 'none' },
    '.RedirectText': { display: 'none' },
    '.Text--redirect': { display: 'none' },
  },
}

/** @param {string} clientSecret */
export function buildStripeElementsOptions(clientSecret) {
  return {
    clientSecret,
    appearance: stripeElementsAppearance,
    loader: 'auto',
    locale: 'en-GB',
  }
}

/**
 * Name + email come from the entry form. Other billing fields are satisfied in
 * confirmPayment when billingDetails is `never` on the Payment Element.
 * @param {{ customerEmail?: string, customerFullName?: string }} recordPayload
 */
export function buildBillingDetailsFromEntry(recordPayload) {
  const email = (recordPayload?.customerEmail || '').trim()
  const name = (recordPayload?.customerFullName || '').trim()
  return {
    name,
    email,
    phone: '+440000000000',
    address: {
      line1: 'United Kingdom',
      line2: '',
      city: 'United Kingdom',
      state: '',
      postal_code: 'W1A 1AA',
      country: 'GB',
    },
  }
}

/**
 * Hide all billing fields in the Element (collected on the entry step).
 * Stripe requires the same data in confirmPayment — see buildBillingDetailsFromEntry.
 * @param {{ customerEmail?: string, customerFullName?: string }} recordPayload
 */
export function buildPaymentElementOptions(recordPayload) {
  const billing = buildBillingDetailsFromEntry(recordPayload)

  return {
    layout: 'tabs',
    paymentMethodOrder: ['apple_pay', 'google_pay', 'card'],
    wallets: {
      applePay: 'auto',
      googlePay: 'auto',
    },
    defaultValues: {
      billingDetails: {
        name: billing.name || undefined,
        email: billing.email || undefined,
      },
    },
    fields: {
      billingDetails: 'never',
    },
    business: { name: 'ShowSkills Rewards' },
  }
}

/** @param {{ customerEmail?: string, customerFullName?: string }} recordPayload */
export function buildConfirmParams(recordPayload) {
  const billing = buildBillingDetailsFromEntry(recordPayload)
  if (!billing.name) throw new Error('Enter your full name before paying.')
  if (!billing.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing.email)) {
    throw new Error('Enter a valid email before paying.')
  }
  return {
    receipt_email: billing.email,
    payment_method_data: {
      billing_details: billing,
    },
  }
}
