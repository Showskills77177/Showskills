import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { EntryFlowContext } from './entryContext'
import { isCorrectShirtGiveawayAnswer } from '../../shared/shirtGiveaway.mjs'
import { FREE_ENTRY_ERRORS } from '../../shared/freeEntryLimits.mjs'
import { validateContactPhone } from '../../shared/contactPhone.mjs'
import { isCashflowsFrontendEnabled } from '../../shared/paymentFrontendConfig.mjs'

function readInitialQuizSession() {
  if (typeof window === 'undefined') return null
  return loadPaidQuizSession()
}

function getInitialPaidBundleId(searchParams) {
  const fromQuery = (searchParams?.get?.('bundle') || '').trim()
  if (fromQuery && getTicketBundleById(fromQuery)) return fromQuery
  const forced = (import.meta.env.VITE_DEFAULT_BUNDLE_ID ?? '').trim()
  if (forced && getTicketBundleById(forced)) return forced
  return DEFAULT_TICKET_BUNDLE_ID
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
  const [paidPhone, setPaidPhone] = useState(() => initialContact?.phone || '')

  const [freeAddressLine1, setFreeAddressLine1] = useState('')
  const [freeAddressLine2, setFreeAddressLine2] = useState('')
  const [freeCity, setFreeCity] = useState('')
  const [freePostcode, setFreePostcode] = useState('')
  const [freePreparing, setFreePreparing] = useState(false)
  const [freeCardVerified, setFreeCardVerified] = useState(false)
  const [freeVerificationJobRef, setFreeVerificationJobRef] = useState('')
  const [freeQuizSubmitting, setFreeQuizSubmitting] = useState(false)

  const [kickFullName, setKickFullName] = useState('')
  const [kickAnswer, setKickAnswer] = useState('')
  const [kickEmail, setKickEmail] = useState('')
  const [kickPhone, setKickPhone] = useState('')
  const [kickConsent, setKickConsent] = useState(false)
  const [kickError, setKickError] = useState('')
  const [kickSuccess, setKickSuccess] = useState(false)
  const [kickVpnBlocked, setKickVpnBlocked] = useState(false)
  const [kickCheckingVpn, setKickCheckingVpn] = useState(false)

  /** Avoid sending the unanswered ticket email more than once per checkout. */
  const unansweredTicketEmailRequestedRef = useRef(false)

  const baseUrl = import.meta.env.BASE_URL.replace(/\/?$/, '')
  const [paidCardPreparing, setPaidCardPreparing] = useState(false)

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

  const cashflowsFrontendOn = isCashflowsFrontendEnabled()
  const cashflowsCreateOverride = (import.meta.env.VITE_CASHFLOWS_CREATE_INTENT_URL ?? '').trim()
  const cashflowsCreateApi = cashflowsFrontendOn
    ? cashflowsCreateOverride || `${baseUrl}/api/create-cashflows-payment-intent`
    : ''
  const [serverPaymentConfig, setServerPaymentConfig] = useState(null)

  useEffect(() => {
    if (!cashflowsFrontendOn) return
    void fetch(apiUrl('/api/payment-config'), { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return
        if (typeof data === 'object' && data !== null) setServerPaymentConfig(data)
      })
      .catch(() => {})
  }, [cashflowsFrontendOn])

  const hasCashflowsEmbedded = Boolean(
    cashflowsCreateApi && (serverPaymentConfig === null || serverPaymentConfig.cashflows === true),
  )
  const googlePayMerchantId =
    (typeof serverPaymentConfig?.googlePayMerchantId === 'string'
      ? serverPaymentConfig.googlePayMerchantId.trim()
      : '') || (import.meta.env.VITE_CASHFLOWS_GOOGLE_MERCHANT_ID ?? '').trim()
  const googlePayEnabled =
    hasCashflowsEmbedded && (serverPaymentConfig === null || serverPaymentConfig.googlePay !== false)
  const hasCashflowsFreeVerify = hasCashflowsEmbedded
  const hasEmbeddedCardCheckout = hasCashflowsEmbedded
  const hasCardCheckout = hasCashflowsEmbedded

  const [paidCashflowsToken, setPaidCashflowsToken] = useState('')
  const [paidCashflowsJobRef, setPaidCashflowsJobRef] = useState('')
  const [paidCashflowsIntegration, setPaidCashflowsIntegration] = useState(true)

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
    const ph = (contact?.phone || stored?.phone || '').trim()
    if (em) setPaidEmail(em)
    if (fn) setPaidFullName(fn)
    if (ph) setPaidPhone(ph)
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
    unansweredTicketEmailRequestedRef.current = false
  }, [])

  const applyResumeFromApi = useCallback(
    (data) => {
      if (!data?.ok) return false
      if (data.pending) {
        beginPaidQuizPending({
          orderRef: data.orderRef,
          ticketNumbers: data.ticketNumbers,
          customerEmail: data.customerEmail,
          customerFullName: data.customerFullName,
        })
        return true
      }
      if (data.alreadyAnswered) {
        const result =
          data.quizResult === 'qualified' || data.quizResult === 'not_qualified'
            ? data.quizResult
            : 'not_qualified'
        savePaidQuizSession({
          status: 'answered',
          orderRef: data.orderRef || '',
          ticketNumbers: Array.isArray(data.ticketNumbers) ? data.ticketNumbers : [],
          email: (data.customerEmail || '').trim(),
          fullName: (data.customerFullName || '').trim(),
          quizResult: result,
        })
        restorePaidQuizFromSession(loadPaidQuizSession())
        setPaidQuizSubmitted(true)
        setPaidQuizResult(result)
        setPaidPostCheckout(true)
        return true
      }
      return false
    },
    [beginPaidQuizPending, restorePaidQuizFromSession],
  )

  const fetchResumePaidQuizByToken = useCallback(
    async (resumeToken) => {
      const token = resumeToken.trim()
      if (token.length < 20) return false
      try {
        const res = await fetch(apiUrl('/api/entries/resume-paid-quiz'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeToken: token }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setPaidError(typeof data.error === 'string' ? data.error : 'Could not open your entry link.')
          return false
        }
        return applyResumeFromApi(data)
      } catch {
        setPaidError('Could not open your entry link. Check your connection and try again.')
        return false
      }
    },
    [applyResumeFromApi],
  )

  const fetchResumePaidQuizByEmail = useCallback(
    async (email) => {
      const em = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return false
      try {
        const res = await fetch(apiUrl('/api/entries/resume-paid-quiz'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: em }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return false
        return applyResumeFromApi(data)
      } catch {
        return false
      }
    },
    [applyResumeFromApi],
  )

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
    if (searchParams.get('complete-quiz') !== '1') return

    const resumeToken = (searchParams.get('resume') || '').trim()
    const next = new URLSearchParams(searchParams)
    next.delete('complete-quiz')
    next.delete('resume')
    setSearchParams(next, { replace: true })
    setEntryModalType('paid')
    setPaidError('')

    void (async () => {
      if (resumeToken.length >= 20) {
        const ok = await fetchResumePaidQuizByToken(resumeToken)
        if (!ok && !loadPaidQuizSession()) {
          setPaidError((prev) => prev || 'This link is invalid or your answers were already submitted.')
        }
        return
      }
      openResumePaidQuiz()
      const email = paidEmail.trim() || loadPaidEntryContact()?.email || ''
      if (email && !paidOrderRef) {
        await fetchResumePaidQuizByEmail(email)
      }
    })()

  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- email link landing once

  useEffect(() => {
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
    beginPaidQuizPending,
    restorePaidQuizFromSession,
  ])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'cancelled') {
      setPaidError('Payment was cancelled. You can try again when ready.')
      setEntryModalType('paid')
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
    }
  }, [])

  const openEntry = useCallback((type) => {
    setEntryModalType(type)
    if (type === 'kickups') {
      setKickError('')
      setKickSuccess(false)
      setKickVpnBlocked(false)
      setKickFullName('')
      setKickAnswer('')
      setKickEmail('')
      setKickCheckingVpn(true)
      void fetch(apiUrl('/api/vpn-check'), { credentials: 'include' })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}))
          if (!res.ok && data.code === 'vpn_not_allowed') {
            setKickVpnBlocked(true)
            setKickError(
              typeof data.error === 'string' ? data.error : FREE_ENTRY_ERRORS.vpnNotAllowed,
            )
          }
        })
        .catch(() => {
          /* allow submit; server enforces VPN on POST */
        })
        .finally(() => setKickCheckingVpn(false))
    }
    if (type === 'paid') {
      setPaidError('')
      const session = loadPaidQuizSession()
      if (session?.status === 'pending' || session?.status === 'answered') {
        restorePaidQuizFromSession(session)
      } else {
        setPaidBundleId(getInitialPaidBundleId(searchParams))
        setPaidEntryRoute('tickets')
      }
      setPaidCashflowsToken('')
      setPaidCashflowsJobRef('')
    }
  }, [searchParams, restorePaidQuizFromSession])

  const closeCardPayment = useCallback(() => {
    setPaidCashflowsToken('')
    setPaidCashflowsJobRef('')
    setPaidCardPreparing(false)
    setPaidError('')
  }, [])

  const notifyUnansweredQuizTicketEmail = useCallback(() => {
    if (unansweredTicketEmailRequestedRef.current) return
    if (!paidPostCheckout || paidQuizSubmitted) return
    const em = paidEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return
    unansweredTicketEmailRequestedRef.current = true
    void fetch(apiUrl('/api/entries/send-unanswered-quiz-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: em,
        orderRef: paidOrderRef.trim() || undefined,
      }),
    }).catch(() => {
      unansweredTicketEmailRequestedRef.current = false
    })
  }, [paidPostCheckout, paidQuizSubmitted, paidEmail, paidOrderRef])

  const closeEntry = useCallback(() => {
    notifyUnansweredQuizTicketEmail()
    setEntryModalType(null)
    closeCardPayment()
  }, [closeCardPayment, notifyUnansweredQuizTicketEmail])

  useEffect(() => {
    if (!paidPostCheckout || paidQuizSubmitted) return
    const onPageHide = () => notifyUnansweredQuizTicketEmail()
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [paidPostCheckout, paidQuizSubmitted, notifyUnansweredQuizTicketEmail])

  const openTerms = useCallback(() => setTermsOpen(true), [])

  const markPaidCheckoutComplete = useCallback(
    (purchaseInfo) => {
      setPaidError('')
      setPaidCashflowsToken('')
      setPaidCashflowsJobRef('')
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
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paidEmail.trim()) &&
    validateContactPhone(paidPhone).ok

  const fetchCashflowsIntent = useCallback(
    async ({ signal } = {}) => {
      const bundle = getTicketBundleById(paidBundleId) ?? getTicketBundleById(DEFAULT_TICKET_BUNDLE_ID)
      if (!bundle) throw new Error('Choose a ticket bundle.')
      const res = await fetch(apiUrl(cashflowsCreateApi), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal,
        body: JSON.stringify({
          bundleId: bundle.id,
          customerEmail: paidEmail.trim(),
          customerFullName: paidFullName.trim(),
          customerPhone: paidPhone.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not start card payment')
      }
      savePaidEntryContact({
        email: paidEmail.trim(),
        fullName: paidFullName.trim(),
        phone: paidPhone.trim(),
      })
      const token = typeof data.token === 'string' ? data.token : ''
      const jobRef = typeof data.paymentJobReference === 'string' ? data.paymentJobReference : ''
      if (!token || !jobRef) throw new Error('Invalid Cashflows payment response')
      setPaidCashflowsToken(token)
      setPaidCashflowsJobRef(jobRef)
      setPaidCashflowsIntegration(Boolean(data.isIntegration))
      if (typeof data.orderRef === 'string' && data.orderRef) setPaidOrderRef(data.orderRef)
      if (Array.isArray(data.ticketNumbers) && data.ticketNumbers.length) {
        setPaidTicketNumbers(data.ticketNumbers)
      }
      return token
    },
    [paidBundleId, paidEmail, paidFullName, paidPhone, cashflowsCreateApi],
  )

  /** Background warm-up once name, email, and consent are filled (Pay now opens faster). */
  useEffect(() => {
    if (!paidFormReadyForPayment || paidEntryRoute !== 'tickets' || !hasCashflowsEmbedded) return
    if (paidCashflowsToken) return
    const ac = new AbortController()
    const t = setTimeout(() => {
      fetchCashflowsIntent({ signal: ac.signal }).catch((e) => {
        if (e instanceof Error && e.name === 'AbortError') return
        const msg = e instanceof Error ? e.message : ''
        if (msg) setPaidError(msg)
      })
    }, 600)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [
    paidFormReadyForPayment,
    paidEntryRoute,
    hasCashflowsEmbedded,
    paidCashflowsToken,
    paidBundleId,
    paidEmail,
    paidFullName,
    fetchCashflowsIntent,
  ])

  const prepareCashflowsPayment = useCallback(async () => {
    setPaidError('')
    if (!paidFormReadyForPayment) {
      setPaidError('Enter your full name, email, phone number, and agree to the terms before paying.')
      return false
    }
    if (paidCashflowsToken) return true
    setPaidCardPreparing(true)
    const controller = new AbortController()
    let prepareTimeout
    try {
      prepareTimeout = setTimeout(() => controller.abort(), 20_000)
      const token = await fetchCashflowsIntent({ signal: controller.signal })
      return Boolean(token)
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
      setPaidCardPreparing(false)
    }
  }, [paidFormReadyForPayment, paidCashflowsToken, fetchCashflowsIntent])

  const prepareEmbeddedCardPayment = useCallback(async () => {
    if (hasCashflowsEmbedded) return prepareCashflowsPayment()
    return false
  }, [hasCashflowsEmbedded, prepareCashflowsPayment])

  useEffect(() => {
    setPaidCashflowsToken('')
    setPaidCashflowsJobRef('')
    if (paidEntryRoute !== 'free_online') {
      setFreeCardVerified(false)
      setFreeVerificationJobRef('')
    }
  }, [paidBundleId, paidEmail, paidFullName, paidEntryRoute, freeAddressLine1, freeCity, freePostcode])

  const freeVerifyPayload = useMemo(
    () => ({
      fullName: paidFullName.trim(),
      email: paidEmail.trim(),
      phone: paidPhone.trim(),
      customerPhone: paidPhone.trim(),
      addressLine1: freeAddressLine1.trim(),
      addressLine2: freeAddressLine2.trim(),
      city: freeCity.trim(),
      postcode: freePostcode.trim(),
    }),
    [paidFullName, paidEmail, paidPhone, freeAddressLine1, freeAddressLine2, freeCity, freePostcode],
  )

  const handleStartFreeVerification = useCallback(async () => {
    setPaidError('')
    setFreeCardVerified(false)
    setFreeVerificationJobRef('')
    setPaidQuizSubmitted(false)
    setPaidQuizResult(null)
    if (!paidConsent) {
      setPaidError('Please agree to the Terms & Conditions and Privacy Policy.')
      return
    }
    if (!paidFullName.trim()) {
      setPaidError('Please enter your full name.')
      return
    }
    if (!paidEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paidEmail.trim())) {
      setPaidError('Please enter a valid email address.')
      return
    }
    const phoneCheck = validateContactPhone(paidPhone)
    if (!phoneCheck.ok) {
      setPaidError(phoneCheck.error)
      return
    }
    if (!freeAddressLine1.trim() || !freeCity.trim() || freePostcode.trim().length < 4) {
      setPaidError('Please enter your full postal address (line 1, town/city, and postcode).')
      return
    }
    if (!hasCashflowsFreeVerify) {
      setPaidError('Card verification is not configured. Please try again later.')
      return
    }
    setFreePreparing(true)
    setPaidCashflowsToken('')
    setPaidCashflowsJobRef('')
    try {
      const res = await fetch(apiUrl('/api/create-cashflows-free-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(freeVerifyPayload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPaidError(typeof data.error === 'string' ? data.error : 'Could not start card verification.')
        return
      }
      const token = typeof data.token === 'string' ? data.token : ''
      const jobRef = typeof data.paymentJobReference === 'string' ? data.paymentJobReference : ''
      if (!token || !jobRef) {
        setPaidError('Invalid verification response from payment provider.')
        return
      }
      setPaidCashflowsToken(token)
      setPaidCashflowsJobRef(jobRef)
      setPaidCashflowsIntegration(Boolean(data.isIntegration))
    } catch {
      setPaidError('Network error. Check your connection and try again.')
    } finally {
      setFreePreparing(false)
    }
  }, [paidConsent, paidFullName, paidEmail, paidPhone, freeAddressLine1, freeCity, freePostcode, hasCashflowsFreeVerify, freeVerifyPayload])

  const handleFreeCardVerified = useCallback((data) => {
    setPaidCashflowsToken('')
    setPaidCashflowsJobRef('')
    setFreeCardVerified(true)
    if (typeof data.paymentJobReference === 'string' && data.paymentJobReference) {
      setFreeVerificationJobRef(data.paymentJobReference)
    }
    setPaidError('')
  }, [])

  const handleFreeQuizSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setPaidError('')
      if (!paidConsent) {
        setPaidError('Please agree to the Terms & Conditions and Privacy Policy.')
        return
      }
      if (!freeCardVerified || !freeVerificationJobRef) {
        setPaidError('Please verify your card first, then answer the skill questions.')
        return
      }
      if (!paidA1.trim() || !paidA2.trim() || !paidA3.trim()) {
        setPaidError('Please answer all three skill questions.')
        return
      }
      setFreeQuizSubmitting(true)
      try {
        const res = await fetch(apiUrl('/api/complete-free-entry'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...freeVerifyPayload,
            paymentJobReference: freeVerificationJobRef,
            answers: { q1: paidA1.trim(), q2: paidA2.trim(), q3: paidA3.trim() },
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setPaidError(typeof data.error === 'string' ? data.error : 'Could not submit your free entry.')
          return
        }
        setPaidOrderRef(data.orderRef || '')
        setPaidTicketNumbers(Array.isArray(data.ticketNumbers) ? data.ticketNumbers : [])
        setPaidPostCheckout(true)
        setPaidQuizSubmitted(true)
        setPaidQuizResult(data.allCorrect ? 'qualified' : 'not_qualified')
        if (data.quizEmailSent) setPaidEmailConfirmationSent(true)
      } catch {
        setPaidError('Network error. Check your connection and try again.')
      } finally {
        setFreeQuizSubmitting(false)
      }
    },
    [
      paidConsent,
      freeCardVerified,
      freeVerificationJobRef,
      freeVerifyPayload,
      paidA1,
      paidA2,
      paidA3,
    ],
  )

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
          const res = await fetch(apiUrl('/api/e2e/mock-paid-completion'), {
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

      setPaidError(
        hasPayPal
          ? 'Card payment is not configured. Use PayPal below or add Cashflows keys (see .env.example).'
          : 'Add Cashflows (CASHFLOWS_* + VITE_CASHFLOWS_ENABLED) or PayPal.',
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
        unansweredTicketEmailRequestedRef.current = true
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
      if (kickVpnBlocked) {
        setKickError(FREE_ENTRY_ERRORS.vpnNotAllowed)
        return
      }
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
      const kickPhoneCheck = validateContactPhone(kickPhone)
      if (!kickPhoneCheck.ok) {
        setKickError(kickPhoneCheck.error)
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
            phone: kickPhone.trim(),
            customerPhone: kickPhone.trim(),
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
    [kickAnswer, kickConsent, kickEmail, kickFullName, kickPhone, kickVpnBlocked],
  )

  const entriesClosedMessage =
    serverPaymentConfig?.entriesOpen === false && typeof serverPaymentConfig.entriesClosedMessage === 'string'
      ? serverPaymentConfig.entriesClosedMessage
      : ''

  const paymentNotConfiguredMessage = useMemo(() => {
    if (entriesClosedMessage) return entriesClosedMessage
    if (hasPayPal || hasCardCheckout) return ''
    if (serverPaymentConfig?.cashflows === false) {
      return 'Card payments are not set up on the server. In Vercel → Environment Variables, add CASHFLOWS_CONFIGURATION_ID, CASHFLOWS_API_KEY, and CASHFLOWS_INTEGRATION=0 for Production, then redeploy.'
    }
    if (import.meta.env.PROD) {
      return 'Payments are loading or not configured. If this stays, check Cashflows env vars in Vercel and redeploy.'
    }
    return 'Payments are not configured locally. Add CASHFLOWS_CONFIGURATION_ID, CASHFLOWS_API_KEY, and VITE_CASHFLOWS_ENABLED=1 to .env.local, then run npm run dev:all (not npm run dev alone) and refresh.'
  }, [hasPayPal, hasCardCheckout, serverPaymentConfig, entriesClosedMessage])

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
      paidPhone,
      setPaidPhone,
      handlePaidEntry,
      handlePaidQuizSubmit,
      markPaidCheckoutComplete,
      hasCardCheckout,
      paymentNotConfiguredMessage,
      hasCashflowsEmbedded,
      googlePayEnabled,
      googlePayMerchantId,
      hasEmbeddedCardCheckout,
      paidCashflowsToken,
      paidCashflowsJobRef,
      paidCashflowsIntegration,
      paidCardPreparing,
      prepareCashflowsPayment,
      prepareEmbeddedCardPayment,
      closeCardPayment,
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
      kickPhone,
      setKickPhone,
      kickConsent,
      setKickConsent,
      kickError,
      setKickError,
      kickSuccess,
      kickVpnBlocked,
      kickCheckingVpn,
      handleKickupsGiveawaySubmit,
      PAID_SKILL_QUESTIONS,
      paidQuizNavStatus,
      openResumePaidQuiz,
      freeAddressLine1,
      setFreeAddressLine1,
      freeAddressLine2,
      setFreeAddressLine2,
      freeCity,
      setFreeCity,
      freePostcode,
      setFreePostcode,
      freePreparing,
      freeCardVerified,
      freeVerificationJobRef,
      freeQuizSubmitting,
      hasCashflowsFreeVerify,
      freeVerifyPayload,
      handleStartFreeVerification,
      handleFreeCardVerified,
      handleFreeQuizSubmit,
    }),
    [
      serverPaymentConfig,
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
      paidPhone,
      handlePaidEntry,
      handlePaidQuizSubmit,
      markPaidCheckoutComplete,
      hasCardCheckout,
      paymentNotConfiguredMessage,
      hasCashflowsEmbedded,
      googlePayEnabled,
      googlePayMerchantId,
      hasEmbeddedCardCheckout,
      paidCashflowsToken,
      paidCashflowsJobRef,
      paidCashflowsIntegration,
      paidCardPreparing,
      prepareCashflowsPayment,
      prepareEmbeddedCardPayment,
      closeCardPayment,
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
      kickVpnBlocked,
      kickCheckingVpn,
      handleKickupsGiveawaySubmit,
      paidQuizNavStatus,
      openResumePaidQuiz,
      freeAddressLine1,
      freeAddressLine2,
      freeCity,
      freePostcode,
      freePreparing,
      freeCardVerified,
      freeVerificationJobRef,
      freeQuizSubmitting,
      hasCashflowsFreeVerify,
      freeVerifyPayload,
      handleStartFreeVerification,
      handleFreeCardVerified,
      handleFreeQuizSubmit,
    ],
  )

  return <EntryFlowContext.Provider value={value}>{children}</EntryFlowContext.Provider>
}
