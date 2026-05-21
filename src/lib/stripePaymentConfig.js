/** Stripe Payment Element + Appearance — shared config for ShowSkills checkout. */

export const stripeElementsAppearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#14b8a6',
    colorBackground: '#0c0a09',
    colorText: '#e7e5e4',
    colorTextSecondary: '#a8a29e',
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
    },
    '.Input:focus': {
      border: '1px solid rgba(20, 184, 166, 0.65)',
      boxShadow: '0 0 0 2px rgba(20, 184, 166, 0.22)',
    },
    '.Label': {
      color: '#a8a29e',
      fontWeight: '500',
      marginBottom: '6px',
    },
    '.Tab': {
      border: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    '.Tab--selected': {
      border: '1px solid rgba(20, 184, 166, 0.45)',
      backgroundColor: 'rgba(13, 148, 136, 0.12)',
    },
    '.AccordionItem': {
      border: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(0,0,0,0.2)',
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
 * Billing details collected on the entry form — must match Payment Element `fields: never`
 * and confirmPayment billing_details (Stripe requires both when using `never`).
 * @param {{ customerEmail?: string, customerFullName?: string }} recordPayload
 */
export function buildBillingDetailsFromEntry(recordPayload) {
  const email = (recordPayload?.customerEmail || '').trim()
  const name = (recordPayload?.customerFullName || '').trim()
  return {
    name,
    email,
    address: { country: 'GB' },
  }
}

/**
 * Only `name`, `email`, and `country` are hidden in the Element (collected above).
 * Do not set `phone: 'never'` (or other fields) unless you also pass them in confirmPayment.
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
      billingDetails: {
        name: 'never',
        email: 'never',
        address: {
          country: 'never',
        },
      },
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
