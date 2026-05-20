/** Stripe Payment Element appearance — matches ShowSkills dark / teal entry modal. */
export const stripeElementsAppearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#0d9488',
    colorBackground: '#0c0a09',
    colorText: '#e7e5e4',
    colorDanger: '#f87171',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    borderRadius: '8px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(0,0,0,0.35)',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid rgba(13,148,136,0.55)',
      boxShadow: '0 0 0 2px rgba(13,148,136,0.2)',
    },
    '.Label': {
      color: '#a8a29e',
      fontWeight: '500',
    },
    '.TermsText': {
      display: 'none',
    },
    '.TermsLink': {
      display: 'none',
    },
    '.RedirectText': {
      display: 'none',
    },
    '.Text--redirect': {
      display: 'none',
    },
    '.SecondaryLink': {
      display: 'none',
    },
  },
}
