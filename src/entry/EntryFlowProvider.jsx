import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PAID_SKILL_QUESTIONS,
  validatePaidSkillAnswers,
  DEFAULT_TICKET_BUNDLE_ID,
  getTicketBundleById,
} from '../competitionData'
import { apiUrl } from '../lib/api'
import { EntryFlowContext } from './entryContext'

export function EntryFlowProvider({ children }) {
  const [termsOpen, setTermsOpen] = useState(false)
  const [entryModalType, setEntryModalType] = useState(null)

  const [paidBundleId, setPaidBundleId] = useState(DEFAULT_TICKET_BUNDLE_ID)
  /** 'tickets' = paid bundles; 'postal' = free postal (same draw), chosen inside Legacy modal */
  const [paidEntryRoute, setPaidEntryRoute] = useState('tickets')
  const [paidConsent, setPaidConsent] = useState(false)
  const [paidError, setPaidError] = useState('')
  const [paidLoading, setPaidLoading] = useState(false)
  const [paidPostCheckout, setPaidPostCheckout] = useState(false)
  const [paidA1, setPaidA1] = useState('')
  const [paidA2, setPaidA2] = useState('')
  const [paidA3, setPaidA3] = useState('')
  const [paidQuizError, setPaidQuizError] = useState('')
  const [paidQuizResult, setPaidQuizResult] = useState(null)
  const [paidFullName, setPaidFullName] = useState('')
  const [paidEmail, setPaidEmail] = useState('')

  const [kickFullName, setKickFullName] = useState('')
  const [kickVideoUrl, setKickVideoUrl] = useState('')
  const [kickVideoFile, setKickVideoFile] = useState(null)
  const [kickEmail, setKickEmail] = useState('')
  const [kickConsent, setKickConsent] = useState(false)
  const [kickError, setKickError] = useState('')
  const [kickSuccess, setKickSuccess] = useState(false)

  const stripePublishableKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim()
  const stripeCheckoutApiOverride = (import.meta.env.VITE_STRIPE_CHECKOUT_API_URL ?? '').trim()
  const stripePaymentLink = (import.meta.env.VITE_STRIPE_PAYMENT_LINK ?? '').trim()
  const baseUrl = import.meta.env.BASE_URL.replace(/\/?$/, '')
  const defaultCheckoutApi = stripePublishableKey ? `${baseUrl}/api/create-checkout-session` : ''
  const stripeCheckoutApi = stripeCheckoutApiOverride || defaultCheckoutApi
  const hasStripeCheckout =
    Boolean(stripeCheckoutApi && stripePublishableKey) || Boolean(stripePaymentLink)

  const payPalClientId = (import.meta.env.VITE_PAYPAL_CLIENT_ID ?? '').trim()
  const paypalCreateOverride = (import.meta.env.VITE_PAYPAL_CREATE_ORDER_URL ?? '').trim()
  const paypalCaptureOverride = (import.meta.env.VITE_PAYPAL_CAPTURE_ORDER_URL ?? '').trim()
  const paypalCreateOrderApi = payPalClientId
    ? paypalCreateOverride || `${baseUrl}/api/create-paypal-order`
    : ''
  const paypalCaptureOrderApi = payPalClientId
    ? paypalCaptureOverride || `${baseUrl}/api/capture-paypal-order`
    : ''
  const hasPayPal = Boolean(payPalClientId)
  const payPalCurrency = (import.meta.env.VITE_PAYPAL_CURRENCY ?? 'GBP').trim().toUpperCase()

  const selectedTicketBundle = useMemo(() => {
    return getTicketBundleById(paidBundleId) ?? getTicketBundleById(DEFAULT_TICKET_BUNDLE_ID)
  }, [paidBundleId])

  const paidTicketQty = selectedTicketBundle.qty

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'success') return
    const sessionId = params.get('session_id')
    if (sessionId) {
      fetch(apiUrl('/api/records/stripe-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      }).catch(() => {})
    }
    setPaidPostCheckout(true)
    setPaidQuizResult(null)
    setPaidA1('')
    setPaidA2('')
    setPaidA3('')
    setPaidQuizError('')
    setEntryModalType('paid')
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
  }, [])

  const openEntry = useCallback((type) => {
    setEntryModalType(type)
    if (type === 'kickups') {
      setKickError('')
      setKickSuccess(false)
      setKickFullName('')
      setKickVideoUrl('')
      setKickVideoFile(null)
    }
    if (type === 'paid') {
      setPaidError('')
      setPaidBundleId(DEFAULT_TICKET_BUNDLE_ID)
      setPaidEntryRoute('tickets')
    }
  }, [])

  const closeEntry = useCallback(() => {
    setEntryModalType(null)
  }, [])

  const openTerms = useCallback(() => setTermsOpen(true), [])

  const markPaidCheckoutComplete = useCallback(() => {
    setPaidPostCheckout(true)
    setPaidQuizResult(null)
    setPaidA1('')
    setPaidA2('')
    setPaidA3('')
    setPaidQuizError('')
  }, [])

  const handlePaidEntry = useCallback(async () => {
    setPaidError('')
    if (!paidConsent) {
      setPaidError('Please confirm you agree to the Terms & Conditions and Privacy Policy.')
      return
    }
    const bundle = getTicketBundleById(paidBundleId) ?? getTicketBundleById(DEFAULT_TICKET_BUNDLE_ID)
    if (!bundle) {
      setPaidError('Choose a ticket bundle.')
      return
    }

    setPaidLoading(true)
    try {
      const e2eSimulateCheckout =
        import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === 'true' ||
        import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === '1'
      if (e2eSimulateCheckout) {
        const em = paidEmail.trim()
        const fn = paidFullName.trim()
        if (!fn || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          setPaidError('Enter your full name and email before paying (used for your entry record).')
          setPaidLoading(false)
          return
        }
        setPaidLoading(false)
        markPaidCheckoutComplete()
        return
      }

      const path = window.location.pathname
      const successUrl = `${window.location.origin}${path}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
      const cancelUrl = `${window.location.origin}${path}?checkout=cancel`

      if (stripeCheckoutApi && stripePublishableKey) {
        const em = paidEmail.trim()
        const fn = paidFullName.trim()
        if (!fn || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          setPaidError('Enter your full name and email before paying (used for your entry record).')
          setPaidLoading(false)
          return
        }
        const res = await fetch(stripeCheckoutApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bundleId: bundle.id,
            successUrl,
            cancelUrl,
            customerEmail: em,
            customerFullName: fn,
          }),
        })
        if (!res.ok) {
          const msg = await res.text()
          throw new Error(msg || 'Could not start checkout')
        }
        const data = await res.json()
        const sessionId = data.sessionId ?? data.id
        if (!sessionId) throw new Error('Invalid checkout response: missing sessionId')
        const checkoutUrl = typeof data.url === 'string' ? data.url.trim() : ''
        if (!checkoutUrl) throw new Error('Invalid checkout response: missing session URL')
        window.location.assign(checkoutUrl)
        return
      }

      if (stripePaymentLink) {
        window.location.href = stripePaymentLink
        return
      }

      setPaidError(
        hasPayPal
          ? 'Card checkout is not configured. Use PayPal below or add Stripe (payment link or Checkout Session API).'
          : 'Add Stripe (VITE_STRIPE_PAYMENT_LINK or Checkout Session) or PayPal (VITE_PAYPAL_CLIENT_ID + server credentials).',
      )
    } catch (e) {
      setPaidError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPaidLoading(false)
    }
  }, [
    paidConsent,
    paidBundleId,
    paidEmail,
    paidFullName,
    markPaidCheckoutComplete,
    stripeCheckoutApi,
    stripePublishableKey,
    stripePaymentLink,
    hasPayPal,
  ])

  const handlePaidQuizSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setPaidQuizError('')
      const { allCorrect } = validatePaidSkillAnswers(paidA1, paidA2, paidA3)
      if (!paidA1.trim() || !paidA2.trim() || !paidA3.trim()) {
        setPaidQuizError('Please answer all three questions.')
        return
      }
      const em = paidEmail.trim()
      const fn = paidFullName.trim()
      if (!fn || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setPaidQuizError('Full name and email are required to save your entry.')
        return
      }
      setPaidQuizResult(allCorrect ? 'qualified' : 'not_qualified')
      try {
        await fetch(apiUrl('/api/entries/paid-quiz'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fn,
            email: em,
            competition: 'ronaldo_legacy_bundle',
            entryType: 'paid',
            allCorrect,
            answers: { q1: paidA1, q2: paidA2, q3: paidA3 },
          }),
        })
      } catch {
        /* non-blocking */
      }
    },
    [paidA1, paidA2, paidA3, paidEmail, paidFullName],
  )

  const handleKickupsGiveawaySubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setKickError('')
      setKickSuccess(false)
      if (!kickConsent) {
        setKickError('Please agree to the Terms & Conditions and Privacy Policy.')
        return
      }
      const url = kickVideoUrl.trim()
      const file = kickVideoFile
      if (!file && !url.startsWith('https://')) {
        setKickError('Upload a video file or paste an https link (e.g. unlisted YouTube or cloud share).')
        return
      }
      if (!kickFullName.trim()) {
        setKickError('Please enter your full name.')
        return
      }
      if (!kickEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kickEmail.trim())) {
        setKickError('Please enter a valid email address.')
        return
      }
      try {
        let res
        if (file) {
          const fd = new FormData()
          fd.append('fullName', kickFullName.trim())
          fd.append('email', kickEmail.trim())
          fd.append('video', file, file.name || 'video.mp4')
          res = await fetch(apiUrl('/api/submissions/kickups/upload'), {
            method: 'POST',
            credentials: 'include',
            body: fd,
          })
        } else {
          res = await fetch(apiUrl('/api/submissions/kickups'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              fullName: kickFullName.trim(),
              email: kickEmail.trim(),
              videoUrl: url,
            }),
          })
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Could not submit')
        }
        setKickSuccess(true)
      } catch (err) {
        setKickError(err instanceof Error ? err.message : 'Submission failed')
      }
    },
    [kickConsent, kickEmail, kickFullName, kickVideoUrl, kickVideoFile],
  )

  const value = useMemo(
    () => ({
      termsOpen,
      setTermsOpen,
      openTerms,
      entryModalType,
      openEntry,
      closeEntry,
      paidBundleId,
      setPaidBundleId,
      paidEntryRoute,
      setPaidEntryRoute,
      paidTicketQty,
      selectedTicketBundle,
      paidConsent,
      setPaidConsent,
      paidError,
      setPaidError,
      paidLoading,
      paidPostCheckout,
      paidA1,
      setPaidA1,
      paidA2,
      setPaidA2,
      paidA3,
      setPaidA3,
      paidQuizError,
      paidQuizResult,
      paidFullName,
      setPaidFullName,
      paidEmail,
      setPaidEmail,
      handlePaidEntry,
      handlePaidQuizSubmit,
      markPaidCheckoutComplete,
      hasStripeCheckout,
      hasPayPal,
      payPalClientId,
      payPalCurrency,
      paypalCreateOrderApi,
      paypalCaptureOrderApi,
      kickFullName,
      setKickFullName,
      kickVideoUrl,
      setKickVideoUrl,
      kickVideoFile,
      setKickVideoFile,
      kickEmail,
      setKickEmail,
      kickConsent,
      setKickConsent,
      kickError,
      setKickError,
      kickSuccess,
      handleKickupsGiveawaySubmit,
      PAID_SKILL_QUESTIONS,
    }),
    [
      termsOpen,
      openTerms,
      entryModalType,
      openEntry,
      closeEntry,
      paidBundleId,
      paidEntryRoute,
      paidTicketQty,
      selectedTicketBundle,
      paidConsent,
      paidError,
      paidLoading,
      paidPostCheckout,
      paidA1,
      paidA2,
      paidA3,
      paidQuizError,
      paidQuizResult,
      paidFullName,
      paidEmail,
      handlePaidEntry,
      handlePaidQuizSubmit,
      markPaidCheckoutComplete,
      hasStripeCheckout,
      hasPayPal,
      payPalClientId,
      payPalCurrency,
      paypalCreateOrderApi,
      paypalCaptureOrderApi,
      kickFullName,
      kickVideoUrl,
      kickVideoFile,
      kickEmail,
      kickConsent,
      kickError,
      setKickError,
      kickSuccess,
      handleKickupsGiveawaySubmit,
    ],
  )

  return <EntryFlowContext.Provider value={value}>{children}</EntryFlowContext.Provider>
}
