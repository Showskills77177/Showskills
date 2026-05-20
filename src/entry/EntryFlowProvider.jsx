import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PAID_SKILL_QUESTIONS,
  validatePaidSkillAnswers,
  DEFAULT_TICKET_BUNDLE_ID,
  getTicketBundleById,
} from '../competitionData'
import { apiUrl } from '../lib/api'
import { EntryFlowContext } from './entryContext'
import { isCorrectShirtGiveawayAnswer } from '../../shared/shirtGiveaway.mjs'

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
  const [paidOrderRef, setPaidOrderRef] = useState('')
  const [paidTicketNumbers, setPaidTicketNumbers] = useState([])
  const [paidEmailConfirmationSent, setPaidEmailConfirmationSent] = useState(false)
  const [paidA1, setPaidA1] = useState('')
  const [paidA2, setPaidA2] = useState('')
  const [paidA3, setPaidA3] = useState('')
  const [paidQuizError, setPaidQuizError] = useState('')
  const [paidQuizResult, setPaidQuizResult] = useState(null)
  const [paidFullName, setPaidFullName] = useState('')
  const [paidEmail, setPaidEmail] = useState('')

  const [kickFullName, setKickFullName] = useState('')
  const [kickAnswer, setKickAnswer] = useState('')
  const [kickEmail, setKickEmail] = useState('')
  const [kickConsent, setKickConsent] = useState(false)
  const [kickError, setKickError] = useState('')
  const [kickSuccess, setKickSuccess] = useState(false)

  const stripePublishableKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim()
  const stripePaymentIntentApiOverride = (import.meta.env.VITE_STRIPE_PAYMENT_INTENT_API_URL ?? '').trim()
  const stripePaymentLink = (import.meta.env.VITE_STRIPE_PAYMENT_LINK ?? '').trim()
  const baseUrl = import.meta.env.BASE_URL.replace(/\/?$/, '')
  const defaultPaymentIntentApi = stripePublishableKey ? `${baseUrl}/api/create-payment-intent` : ''
  const stripePaymentIntentApi = stripePaymentIntentApiOverride || defaultPaymentIntentApi
  const hasStripeElements = Boolean(stripePaymentIntentApi && stripePublishableKey)
  const hasStripeCheckout = hasStripeElements || Boolean(stripePaymentLink)

  const [paidStripeClientSecret, setPaidStripeClientSecret] = useState('')
  const [paidStripePaymentIntentId, setPaidStripePaymentIntentId] = useState('')
  const [paidStripePreparing, setPaidStripePreparing] = useState(false)

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
      })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => {
          if (Array.isArray(data.ticketNumbers) && data.ticketNumbers.length) {
            setPaidTicketNumbers(data.ticketNumbers)
          }
          if (typeof data.orderRef === 'string' && data.orderRef) {
            setPaidOrderRef(data.orderRef)
          }
          if (data.emailSent) setPaidEmailConfirmationSent(true)
        })
        .catch(() => {})
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
      setKickAnswer('')
    }
    if (type === 'paid') {
      setPaidError('')
      setPaidBundleId(DEFAULT_TICKET_BUNDLE_ID)
      setPaidEntryRoute('tickets')
      setPaidStripeClientSecret('')
      setPaidStripePaymentIntentId('')
    }
  }, [])

  const closeEntry = useCallback(() => {
    setEntryModalType(null)
  }, [])

  const openTerms = useCallback(() => setTermsOpen(true), [])

  const markPaidCheckoutComplete = useCallback((purchaseInfo) => {
    setPaidPostCheckout(true)
    setPaidQuizResult(null)
    setPaidA1('')
    setPaidA2('')
    setPaidA3('')
    setPaidQuizError('')
    setPaidStripeClientSecret('')
    setPaidStripePaymentIntentId('')
    if (purchaseInfo?.orderRef) setPaidOrderRef(purchaseInfo.orderRef)
    if (Array.isArray(purchaseInfo?.ticketNumbers)) setPaidTicketNumbers(purchaseInfo.ticketNumbers)
    if (purchaseInfo?.emailSent) setPaidEmailConfirmationSent(true)
  }, [])

  const paidFormReadyForPayment =
    paidConsent &&
    paidFullName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paidEmail.trim())

  const prepareStripePayment = useCallback(async () => {
    setPaidError('')
    if (!paidFormReadyForPayment) {
      setPaidError('Enter your full name, email, and agree to the terms before paying.')
      return
    }
    const bundle = getTicketBundleById(paidBundleId) ?? getTicketBundleById(DEFAULT_TICKET_BUNDLE_ID)
    if (!bundle) {
      setPaidError('Choose a ticket bundle.')
      return
    }
    setPaidStripePreparing(true)
    setPaidStripeClientSecret('')
    setPaidStripePaymentIntentId('')
    try {
      const res = await fetch(apiUrl(stripePaymentIntentApi), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bundleId: bundle.id,
          customerEmail: paidEmail.trim(),
          customerFullName: paidFullName.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not start card payment')
      }
      const secret = typeof data.clientSecret === 'string' ? data.clientSecret : ''
      if (!secret) throw new Error('Invalid payment response')
      setPaidStripeClientSecret(secret)
      setPaidStripePaymentIntentId(
        typeof data.paymentIntentId === 'string' ? data.paymentIntentId : '',
      )
      if (typeof data.orderRef === 'string' && data.orderRef) setPaidOrderRef(data.orderRef)
      if (Array.isArray(data.ticketNumbers) && data.ticketNumbers.length) {
        setPaidTicketNumbers(data.ticketNumbers)
      }
    } catch (e) {
      setPaidError(e instanceof Error ? e.message : 'Could not start card payment')
    } finally {
      setPaidStripePreparing(false)
    }
  }, [
    paidFormReadyForPayment,
    paidBundleId,
    paidEmail,
    paidFullName,
    stripePaymentIntentApi,
  ])

  useEffect(() => {
    setPaidStripeClientSecret('')
    setPaidStripePaymentIntentId('')
  }, [paidBundleId, paidEmail, paidFullName])

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
        const e2eSecret = (import.meta.env.VITE_E2E_SECRET ?? '').trim()
        if (e2eSecret) {
          const res = await fetch(apiUrl('/api/e2e/mock-stripe-completion'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-e2e-secret': e2eSecret },
            body: JSON.stringify({
              customerEmail: em,
              customerFullName: fn,
              bundleId: bundle.id,
              quantity: bundle.qty,
              amountPence: bundle.totalPence,
            }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(typeof data.error === 'string' ? data.error : 'E2E mock checkout failed')
          }
          markPaidCheckoutComplete({
            orderRef: data.ticketPublicId,
            ticketNumbers: Array.isArray(data.ticketNumbers) ? data.ticketNumbers : [],
            emailSent: Boolean(data.emailSent),
          })
        } else {
          markPaidCheckoutComplete()
        }
        setPaidLoading(false)
        return
      }

      if (stripePaymentLink) {
        window.location.href = stripePaymentLink
        return
      }

      setPaidError(
        hasPayPal
          ? 'Card payment is not configured. Use PayPal below or add Stripe keys (see .env.example).'
          : 'Add Stripe (VITE_STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY) or PayPal.',
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
        const res = await fetch(apiUrl('/api/entries/paid-quiz'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fn,
            email: em,
            competition: 'ronaldo_legacy_bundle',
            entryType: 'paid',
            answers: { q1: paidA1, q2: paidA2, q3: paidA3 },
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (data.quizEmailSent) setPaidEmailConfirmationSent(true)
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
      if (!kickFullName.trim()) {
        setKickError('Please enter your full name.')
        return
      }
      if (!kickEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kickEmail.trim())) {
        setKickError('Please enter a valid email address.')
        return
      }
      const answer = kickAnswer.trim()
      if (!answer) {
        setKickError('Please answer the qualification question.')
        return
      }
      if (!isCorrectShirtGiveawayAnswer(answer)) {
        setKickError('That answer is not correct. Check the Ronaldo shirt question and try again.')
        return
      }
      try {
        const res = await fetch(apiUrl('/api/submissions/kickups'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fullName: kickFullName.trim(),
            email: kickEmail.trim(),
            qualificationAnswer: answer,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Could not submit')
        }
        setKickSuccess(true)
      } catch (err) {
        setKickError(err instanceof Error ? err.message : 'Submission failed')
      }
    },
    [kickAnswer, kickConsent, kickEmail, kickFullName],
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
      paidOrderRef,
      paidTicketNumbers,
      paidEmailConfirmationSent,
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
      hasStripeElements,
      stripePublishableKey,
      paidStripeClientSecret,
      paidStripePaymentIntentId,
      paidStripePreparing,
      prepareStripePayment,
      paidFormReadyForPayment,
      hasPayPal,
      payPalClientId,
      payPalCurrency,
      paypalCreateOrderApi,
      paypalCaptureOrderApi,
      kickFullName,
      setKickFullName,
      kickAnswer,
      setKickAnswer,
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
      paidOrderRef,
      paidTicketNumbers,
      paidEmailConfirmationSent,
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
      hasStripeElements,
      stripePublishableKey,
      paidStripeClientSecret,
      paidStripePaymentIntentId,
      paidStripePreparing,
      prepareStripePayment,
      paidFormReadyForPayment,
      hasPayPal,
      payPalClientId,
      payPalCurrency,
      paypalCreateOrderApi,
      paypalCaptureOrderApi,
      kickFullName,
      kickAnswer,
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
