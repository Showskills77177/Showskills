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
 * Payment Element — card, Apple Pay, Google Pay, PayPal (via Stripe), Link when enabled in Dashboard.
 * @param {{ customerEmail?: string, customerFullName?: string }} recordPayload
 */
export function buildPaymentElementOptions(recordPayload) {
  const email = (recordPayload?.customerEmail || '').trim()
  const name = (recordPayload?.customerFullName || '').trim()

  return {
    layout: 'tabs',
    paymentMethodOrder: ['apple_pay', 'google_pay', 'card'],
    wallets: {
      applePay: 'auto',
      googlePay: 'auto',
    },
    defaultValues: {
      billingDetails: {
        name: name || undefined,
        email: email || undefined,
      },
    },
    fields: {
      billingDetails: {
        name: 'never',
        email: 'never',
        phone: 'never',
        address: 'never',
      },
    },
    business: { name: 'ShowSkills Rewards' },
  }
}

/**
 * Confirm in-page (no return_url) — avoids full-page redirect to a blank modal backdrop.
 * PayPal uses the standalone PayPal button when configured alongside Stripe.
 */
export function buildConfirmParams(recordPayload) {
  const email = (recordPayload?.customerEmail || '').trim()
  const name = (recordPayload?.customerFullName || '').trim()
  if (!name) throw new Error('Enter your full name before paying.')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email before paying.')
  }
  return {
    receipt_email: email,
    payment_method_data: {
      billing_details: {
        name,
        email,
        address: { country: 'GB' },
      },
    },
  }
}
