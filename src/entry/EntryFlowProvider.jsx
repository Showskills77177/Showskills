import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  PAID_SKILL_QUESTIONS,
  validatePaidSkillAnswers,
  DEFAULT_TICKET_BUNDLE_ID,
  getTicketBundleById,
  getVisibleTicketBundles,
} from '../competitionData'
import { apiUrl } from '../lib/api'
import {
  clearPaidEntryContact,
  loadPaidEntryContact,
  savePaidEntryContact,
} from '../lib/paidEntryContact'
import { loadPaidQuizSession, savePaidQuizSession } from '../lib/paidQuizSession'
import { preloadStripe } from '../lib/stripeLoader'
import { EntryFlowContext } from './entryContext'
import { isCorrectShirtGiveawayAnswer } from '../../shared/shirtGiveaway.mjs'

function readInitialQuizSession() {
  if (typeof window === 'undefined') return null
  return loadPaidQuizSession()
}

export function EntryFlowProvider({ children }) {
  const initialQuizSession = readInitialQuizSession()
  const initialContact =
    typeof window !== 'undefined' ? loadPaidEntryContact() : null

  const [termsOpen, setTermsOpen] = useState(false)
  const [entryModalType, setEntryModalType] = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const [paidBundleId, setPaidBundleId] = useState(() => {
    const forced = (import.meta.env.VITE_DEFAULT_BUNDLE_ID ?? '').trim()
    if (forced && getTicketBundleById(forced)) return forced
    return DEFAULT_TICKET_BUNDLE_ID
  })
  /** 'tickets' = paid bundles; 'postal' = free postal (same draw), chosen inside Legacy modal */
  const [paidEntryRoute, setPaidEntryRoute] = useState('tickets')
  const [paidConsent, setPaidConsent] = useState(false)
  const [paidError, setPaidError] = useState('')
  const [paidLoading, setPaidLoading] = useState(false)
  const [paidPostCheckout, setPaidPostCheckout] = useState(
    () =>
      initialQuizSession?.status === 'pending' || initialQuizSession?.status === 'answered',
  )
  const [paidOrderRef, setPaidOrderRef] = useState(() => initialQuizSession?.orderRef || '')
  const [paidTicketNumbers, setPaidTicketNumbers] = useState(
    () => initialQuizSession?.ticketNumbers || [],
  )
  const [paidEmailConfirmationSent, setPaidEmailConfirmationSent] = useState(false)
  const [paidA1, setPaidA1] = useState('')
  const [paidA2, setPaidA2] = useState('')
  const [paidA3, setPaidA3] = useState('')
  const [paidQuizError, setPaidQuizError] = useState('')
  const [paidQuizResult, setPaidQuizResult] = useState(() => initialQuizSession?.quizResult || null)
  const [paidQuizSubmitted, setPaidQuizSubmitted] = useState(
    () => initialQuizSession?.status === 'answered',
  )
  const [paidQuizSubmitting, setPaidQuizSubmitting] = useState(false)
  const [paidFullName, setPaidFullName] = useState(
    () => initialQuizSession?.fullName || initialContact?.fullName || '',
  )
  const [paidEmail, setPaidEmail] = useState(
    () => initialQuizSession?.email || initialContact?.email || '',
  )

  const [kickFullName, setKickFullName] = useState('')
  const [kickAnswer, setKickAnswer] = useState('')
  const [kickEmail, setKickEmail] = useState('')
  const [kickConsent, setKickConsent] = useState(false)
  const [kickError, setKickError] = useState('')
  const [kickSuccess, setKickSuccess] = useState(false)
  /** null | 'confirming' | 'failed' — Stripe redirect return handling */
  const [stripeReturnStatus, setStripeReturnStatus] = useState(null)

  const stripePublishableKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim()
  const stripePaymentIntentApiOverride = (import.meta.env.VITE_STRIPE_PAYMENT_INTENT_API_URL ?? '').trim()
  const stripeCheckoutApiOverride = (import.meta.env.VITE_STRIPE_CHECKOUT_API_URL ?? '').trim()
  const stripePaymentLink = (import.meta.env.VITE_STRIPE_PAYMENT_LINK ?? '').trim()
  const baseUrl = import.meta.env.BASE_URL.replace(/\/?$/, '')
  const defaultPaymentIntentApi = stripePublishableKey ? `${baseUrl}/api/create-payment-intent` : ''
  const defaultCheckoutApi = stripePublishableKey ? `${baseUrl}/api/create-checkout-session` : ''
  const stripePaymentIntentApi = stripePaymentIntentApiOverride || defaultPaymentIntentApi
  const stripeCheckoutApi = stripeCheckoutApiOverride || defaultCheckoutApi
  /** In-modal PE is opt-in only — hosted Checkout is default (avoids iframe typing bugs). */
  const useStripePaymentElement =
    import.meta.env.VITE_STRIPE_USE_PAYMENT_ELEMENT === '1' ||
    import.meta.env.VITE_STRIPE_USE_PAYMENT_ELEMENT === 'true'
  const hasStripeElements =
    useStripePaymentElement && Boolean(stripePaymentIntentApi && stripePublishableKey)
  const hasStripeHostedCheckout =
    !useStripePaymentElement && Boolean(stripeCheckoutApi && stripePublishableKey)
  const hasStripeCheckout = hasStripeHostedCheckout || hasStripeElements || Boolean(stripePaymentLink)

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

  const visibleTicketBundles = useMemo(() => getVisibleTicketBundles(), [])

  const selectedTicketBundle = useMemo(() => {
    const fromVisible = visibleTicketBundles.find((b) => b.id === paidBundleId)
    if (fromVisible) return fromVisible
    return (
      getTicketBundleById(paidBundleId) ??
      visibleTicketBundles[0] ??
      getTicketBundleById(DEFAULT_TICKET_BUNDLE_ID)
    )
  }, [paidBundleId, visibleTicketBundles])

  const paidTicketQty = selectedTicketBundle.qty

  const applyPaidEntryContact = useCallback((contact) => {
    const stored = loadPaidEntryContact()
    const em = (contact?.email || stored?.email || '').trim()
    const fn = (contact?.fullName || stored?.fullName || '').trim()
    if (em) setPaidEmail(em)
    if (fn) setPaidFullName(fn)
    if (em || fn) clearPaidEntryContact()
  }, [])

  const persistPaidQuizSession = useCallback(
    (overrides = {}) => {
      const status =
        overrides.status ?? (paidQuizSubmitted ? 'answered' : paidPostCheckout ? 'pending' : null)
      if (status !== 'pending' && status !== 'answered') return
      savePaidQuizSession({
        status,
        orderRef: overrides.orderRef ?? paidOrderRef,
        ticketNumbers: overrides.ticketNumbers ?? paidTicketNumbers,
        email: (overrides.email ?? paidEmail).trim(),
        fullName: (overrides.fullName ?? paidFullName).trim(),
        quizResult: overrides.quizResult ?? paidQuizResult,
      })
    },
    [paidPostCheckout, paidQuizSubmitted, paidOrderRef, paidTicketNumbers, paidEmail, paidFullName, paidQuizResult],
  )

  const restorePaidQuizFromSession = useCallback(
    (session) => {
      if (!session) return
      setPaidPostCheckout(true)
      if (session.orderRef) setPaidOrderRef(session.orderRef)
      if (session.ticketNumbers?.length) setPaidTicketNumbers(session.ticketNumbers)
      if (session.email) setPaidEmail(session.email)
      if (session.fullName) setPaidFullName(session.fullName)
      if (session.status === 'answered') {
        setPaidQuizSubmitted(true)
        if (session.quizResult) setPaidQuizResult(session.quizResult)
      } else {
        setPaidQuizSubmitted(false)
        setPaidQuizResult(null)
      }
    },
    [],
  )

  const beginPaidQuizPending = useCallback((info = {}) => {
    const stored = loadPaidEntryContact()
    const em = (info.email ?? info.customerEmail ?? stored?.email ?? '').trim()
    const fn = (info.fullName ?? info.customerFullName ?? stored?.fullName ?? '').trim()
    const tickets = Array.isArray(info.ticketNumbers) ? info.ticketNumbers : []
    const orderRef = info.orderRef || ''

    setPaidPostCheckout(true)
    setPaidQuizSubmitted(false)
    setPaidQuizResult(null)
    setPaidQuizSubmitting(false)
    setPaidA1('')
    setPaidA2('')
    setPaidA3('')
    setPaidQuizError('')
    if (orderRef) setPaidOrderRef(orderRef)
    if (tickets.length) setPaidTicketNumbers(tickets)
    if (em) setPaidEmail(em)
    if (fn) setPaidFullName(fn)
    if (em || fn) clearPaidEntryContact()

    savePaidQuizSession({
      status: 'pending',
      orderRef,
      ticketNumbers: tickets,
      email: em,
      fullName: fn,
      quizResult: null,
    })
  }, [])

  const fetchResumePaidQuizByEmail = useCallback(async (email) => {
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return false
    try {
      const res = await fetch(apiUrl('/api/entries/resume-paid-quiz'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.pending) return false
      beginPaidQuizPending({
        orderRef: data.orderRef,
        ticketNumbers: data.ticketNumbers,
        customerEmail: data.customerEmail,
        customerFullName: data.customerFullName,
      })
      return true
    } catch {
      return false
    }
  }, [beginPaidQuizPending])

  const openResumePaidQuiz = useCallback(() => {
    const session = loadPaidQuizSession()
    if (session) restorePaidQuizFromSession(session)
    else if (paidPostCheckout) {
      /* state already hydrated */
    } else {
      const contact = loadPaidEntryContact()
      if (contact?.email) {
        void fetchResumePaidQuizByEmail(contact.email)
      }
    }
    setPaidError('')
    setEntryModalType('paid')
  }, [paidPostCheckout, restorePaidQuizFromSession, fetchResumePaidQuizByEmail])

  const paidQuizNavStatus = useMemo(() => {
    if (paidQuizSubmitted) return 'answered'
    if (paidPostCheckout) return 'pending'
    const session = loadPaidQuizSession()
    if (session?.status === 'answered') return 'answered'
    if (session?.status === 'pending') return 'pending'
    return 'none'
  }, [paidPostCheckout, paidQuizSubmitted])

  useEffect(() => {
    if (paidPostCheckout || paidQuizSubmitted) {
      persistPaidQuizSession()
    }
  }, [
    paidPostCheckout,
    paidQuizSubmitted,
    paidOrderRef,
    paidTicketNumbers,
    paidEmail,
    paidFullName,
    paidQuizResult,
    persistPaidQuizSession,
  ])

  /** Re-sync React state from sessionStorage after refresh / new tab restore. */
  useEffect(() => {
    const session = loadPaidQuizSession()
    if (session) restorePaidQuizFromSession(session)
  }, [restorePaidQuizFromSession])

  useEffect(() => {
    if (searchParams.get('complete-quiz') === '1') {
      openResumePaidQuiz()
      const next = new URLSearchParams(searchParams)
      next.delete('complete-quiz')
      setSearchParams(next, { replace: true })
      const email = paidEmail.trim() || loadPaidEntryContact()?.email || ''
      if (email && !paidOrderRef) {
        void fetchResumePaidQuizByEmail(email)
      }
      return
    }

    if (!import.meta.env.DEV) return
    const preview = searchParams.get('preview-quiz')
    if (preview !== 'pending' && preview !== 'answered') return

    if (preview === 'pending') {
      beginPaidQuizPending({
        orderRef: 'ORD-PREVIEW',
        ticketNumbers: ['SS-PREVIEW-001'],
        customerEmail: 'preview@showskills.test',
        customerFullName: 'Preview User',
      })
    } else {
      savePaidQuizSession({
        status: 'answered',
        orderRef: 'ORD-PREVIEW',
        ticketNumbers: ['SS-PREVIEW-001'],
        email: 'preview@showskills.test',
        fullName: 'Preview User',
        quizResult: 'qualified',
      })
      restorePaidQuizFromSession(loadPaidQuizSession())
    }

    const next = new URLSearchParams(searchParams)
    next.delete('preview-quiz')
    setSearchParams(next, { replace: true })
  }, [
    searchParams,
    setSearchParams,
    openResumePaidQuiz,
    beginPaidQuizPending,
    restorePaidQuizFromSession,
    paidEmail,
    paidOrderRef,
    fetchResumePaidQuizByEmail,
  ])

  useEffect(() => {
    if (hasStripeElements && stripePublishableKey) preloadStripe(stripePublishableKey)
  }, [hasStripeElements, stripePublishableKey])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isStripeReturn =
      params.get('stripe_return') === '1' ||
      (params.get('payment_intent')?.startsWith('pi_') && params.get('redirect_status'))

    if (isStripeReturn) {
      const redirectStatus = params.get('redirect_status')
      const paymentIntentId = params.get('payment_intent')?.trim() || ''
      const failMessage =
        redirectStatus === 'failed'
          ? 'Payment failed or was cancelled.'
          : 'Payment could not be confirmed. Please try again.'

      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)

      if (redirectStatus !== 'succeeded' || !paymentIntentId.startsWith('pi_')) {
        setStripeReturnStatus('failed')
        setPaidError(failMessage)
        setEntryModalType('paid')
        return
      }

      setStripeReturnStatus('confirming')
      setEntryModalType('paid')
      setPaidError('')

      fetch(apiUrl('/api/record-stripe-payment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentIntentId }),
      })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => {
          if (data.skipped) {
            throw new Error('Payment received but tickets could not be saved. Contact support with your email.')
          }
          if (!data.ok) {
            throw new Error(typeof data.error === 'string' ? data.error : 'Could not confirm payment')
          }
          if (data.emailSent) setPaidEmailConfirmationSent(true)
          beginPaidQuizPending({
            orderRef: data.orderRef,
            ticketNumbers: data.ticketNumbers,
            customerEmail: data.customerEmail,
            customerFullName: data.customerFullName,
          })
          setPaidError('')
          setStripeReturnStatus(null)
        })
        .catch((err) => {
          setStripeReturnStatus('failed')
          setPaidError(err instanceof Error ? err.message : 'Could not confirm payment')
          setPaidPostCheckout(false)
        })
      return
    }

    if (params.get('checkout') === 'cancelled') {
      setPaidError('Payment was cancelled. You can try again when ready.')
      setEntryModalType('paid')
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
      return
    }

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
          beginPaidQuizPending({
            orderRef: data.orderRef,
            ticketNumbers: data.ticketNumbers,
            customerEmail: data.customerEmail,
            customerFullName: data.customerFullName,
          })
          setEntryModalType('paid')
          window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
        })
        .catch(() => {
          applyPaidEntryContact()
          beginPaidQuizPending()
          setEntryModalType('paid')
          window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
        })
      return
    }
    applyPaidEntryContact()
    beginPaidQuizPending()
    setEntryModalType('paid')
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
  }, [applyPaidEntryContact, beginPaidQuizPending])

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
      const session = loadPaidQuizSession()
      if (session?.status === 'pending' || session?.status === 'answered') {
        restorePaidQuizFromSession(session)
      } else {
        setPaidBundleId(getInitialPaidBundleId(searchParams))
        setPaidEntryRoute('tickets')
        setPaidStripeClientSecret('')
        setPaidStripePaymentIntentId('')
      }
      preloadStripe(stripePublishableKey)
    }
  }, [stripePublishableKey, searchParams, restorePaidQuizFromSession])

  const closeStripePayment = useCallback(() => {
    setPaidStripeClientSecret('')
    setPaidStripePaymentIntentId('')
    setPaidStripePreparing(false)
    setPaidError('')
  }, [])

  const closeEntry = useCallback(() => {
    setEntryModalType(null)
    closeStripePayment()
  }, [closeStripePayment])

  const openTerms = useCallback(() => setTermsOpen(true), [])

  const markPaidCheckoutComplete = useCallback(
    (purchaseInfo) => {
      setPaidError('')
      setPaidStripeClientSecret('')
      setPaidStripePaymentIntentId('')
      if (purchaseInfo?.emailSent) setPaidEmailConfirmationSent(true)
      beginPaidQuizPending({
        orderRef: purchaseInfo?.orderRef,
        ticketNumbers: purchaseInfo?.ticketNumbers,
        customerEmail: purchaseInfo?.customerEmail,
        customerFullName: purchaseInfo?.customerFullName,
      })
    },
    [beginPaidQuizPending],
  )

  const paidFormReadyForPayment =
    paidConsent &&
    paidFullName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paidEmail.trim())

  const fetchPaymentIntent = useCallback(
    async ({ signal } = {}) => {
      const bundle = getTicketBundleById(paidBundleId) ?? getTicketBundleById(DEFAULT_TICKET_BUNDLE_ID)
      if (!bundle) throw new Error('Choose a ticket bundle.')
      const res = await fetch(apiUrl(stripePaymentIntentApi), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal,
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
      return secret
    },
    [paidBundleId, paidEmail, paidFullName, stripePaymentIntentApi],
  )

  /** Background warm-up once name, email, and consent are filled (Pay now opens faster). */
  useEffect(() => {
    if (!paidFormReadyForPayment || paidEntryRoute !== 'tickets' || !hasStripeElements) return
    if (paidStripeClientSecret) return
    const ac = new AbortController()
    const t = setTimeout(() => {
      fetchPaymentIntent({ signal: ac.signal }).catch(() => {})
    }, 600)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [
    paidFormReadyForPayment,
    paidEntryRoute,
    hasStripeElements,
    paidStripeClientSecret,
    paidBundleId,
    paidEmail,
    paidFullName,
    fetchPaymentIntent,
  ])

  const startHostedCheckout = useCallback(async () => {
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

    const origin = window.location.origin
    const pathname = window.location.pathname || `${baseUrl}/competitions`
    const successUrl = `${origin}${pathname}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}${pathname}?checkout=cancelled`

    setPaidLoading(true)
    try {
      const res = await fetch(apiUrl(stripeCheckoutApi), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bundleId: bundle.id,
          customerEmail: paidEmail.trim(),
          customerFullName: paidFullName.trim(),
          successUrl,
          cancelUrl,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not start checkout')
      }
      const url = typeof data.url === 'string' ? data.url : ''
      if (!url) throw new Error('Stripe did not return a checkout URL')
      savePaidEntryContact({
        email: paidEmail.trim(),
        fullName: paidFullName.trim(),
      })
      window.location.assign(url)
    } catch (e) {
      setPaidError(e instanceof Error ? e.message : 'Could not start checkout')
      setPaidLoading(false)
    }
  }, [
    paidFormReadyForPayment,
    paidBundleId,
    paidEmail,
    paidFullName,
    stripeCheckoutApi,
    baseUrl,
  ])

  const prepareStripePayment = useCallback(async () => {
    setPaidError('')
    if (!paidFormReadyForPayment) {
      setPaidError('Enter your full name, email, and agree to the terms before paying.')
      return false
    }
    if (paidStripeClientSecret) return true
    setPaidStripePreparing(true)
    const controller = new AbortController()
    let prepareTimeout
    try {
      prepareTimeout = setTimeout(() => controller.abort(), 20_000)
      const secret = await fetchPaymentIntent({ signal: controller.signal })
      return Boolean(secret)
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      setPaidError(
        aborted
          ? 'Payment setup timed out. Check your connection and try again.'
          : e instanceof Error
            ? e.message
            : 'Could not start card payment',
      )
      return false
    } finally {
      clearTimeout(prepareTimeout)
      setPaidStripePreparing(false)
    }
  }, [paidFormReadyForPayment, paidStripeClientSecret, fetchPaymentIntent])

  useEffect(() => {
    setPaidStripeClientSecret('')
    setPaidStripePaymentIntentId('')
  }, [paidBundleId, paidEmail, paidFullName, paidEntryRoute])

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
      setPaidQuizSubmitting(true)
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
        if (!res.ok) {
          setPaidQuizError(
            typeof data.error === 'string' ? data.error : 'Could not save your entry. Please try again.',
          )
          return
        }
        const result = allCorrect ? 'qualified' : 'not_qualified'
        setPaidQuizResult(result)
        if (data.quizEmailSent) setPaidEmailConfirmationSent(true)
        setPaidQuizSubmitted(true)
        savePaidQuizSession({
          status: 'answered',
          orderRef: paidOrderRef,
          ticketNumbers: paidTicketNumbers,
          email: em,
          fullName: fn,
          quizResult: result,
        })
      } catch {
        setPaidQuizError('Could not save your entry. Check your connection and try again.')
      } finally {
        setPaidQuizSubmitting(false)
      }
    },
    [paidA1, paidA2, paidA3, paidEmail, paidFullName, paidOrderRef, paidTicketNumbers],
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
      paidQuizSubmitted,
      paidQuizSubmitting,
      visibleTicketBundles,
      paidFullName,
      setPaidFullName,
      paidEmail,
      setPaidEmail,
      handlePaidEntry,
      handlePaidQuizSubmit,
      markPaidCheckoutComplete,
      hasStripeCheckout,
      hasStripeHostedCheckout,
      useStripePaymentElement,
      startHostedCheckout,
      hasStripeElements,
      stripePublishableKey,
      paidStripeClientSecret,
      paidStripePaymentIntentId,
      paidStripePreparing,
      prepareStripePayment,
      closeStripePayment,
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
      stripeReturnStatus,
      paidQuizNavStatus,
      openResumePaidQuiz,
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
      paidQuizSubmitted,
      paidQuizSubmitting,
      visibleTicketBundles,
      paidFullName,
      paidEmail,
      handlePaidEntry,
      handlePaidQuizSubmit,
      markPaidCheckoutComplete,
      hasStripeCheckout,
      hasStripeHostedCheckout,
      useStripePaymentElement,
      startHostedCheckout,
      hasStripeElements,
      stripePublishableKey,
      paidStripeClientSecret,
      paidStripePaymentIntentId,
      paidStripePreparing,
      prepareStripePayment,
      closeStripePayment,
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
      stripeReturnStatus,
      paidQuizNavStatus,
      openResumePaidQuiz,
    ],
  )

  return <EntryFlowContext.Provider value={value}>{children}</EntryFlowContext.Provider>
}
