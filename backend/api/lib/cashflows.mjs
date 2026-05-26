import crypto from 'node:crypto'

/** @returns {{ configured: boolean, configurationId: string, apiKey: string, isIntegration: boolean, apiBase: string }} */
export function getCashflowsConfig() {
  const configurationId = (process.env.CASHFLOWS_CONFIGURATION_ID || '').trim()
  const apiKey = (process.env.CASHFLOWS_API_KEY || '').trim()
  const isIntegration =
    process.env.CASHFLOWS_INTEGRATION === '1' || process.env.CASHFLOWS_INTEGRATION === 'true'
  const apiBase = isIntegration
    ? 'https://gateway-int.cashflows.com/api/gateway/'
    : 'https://gateway.cashflows.com/api/gateway/'
  return {
    configured: Boolean(configurationId && apiKey),
    configurationId,
    apiKey,
    isIntegration,
    apiBase,
  }
}

export function cashflowsRequestHash(apiKey, requestBodyString) {
  return crypto.createHash('sha512').update(apiKey + requestBodyString, 'utf8').digest('hex').toUpperCase()
}

function formatAmount(amountPence) {
  const pence = Math.max(0, Math.round(Number(amountPence) || 0))
  return (pence / 100).toFixed(2)
}

/**
 * @param {{ amountPence: number, currency?: string, locale?: string, orderNumber?: string }} opts
 */
export async function createCashflowsPaymentIntent({
  amountPence,
  currency = 'GBP',
  locale = 'en_GB',
  orderNumber,
}) {
  const cfg = getCashflowsConfig()
  if (!cfg.configured) {
    throw new Error('Cashflows is not configured on the server.')
  }

  const body = {
    configurationId: cfg.configurationId,
    amountToCollect: formatAmount(amountPence),
    currency: (currency || 'GBP').toUpperCase(),
    locale,
    paymentMethodsToUse: ['Card'],
    ...(orderNumber ? { order: { orderNumber: String(orderNumber).slice(0, 64) } } : {}),
  }

  const bodyString = JSON.stringify(body)
  const hash = cashflowsRequestHash(cfg.apiKey, bodyString)

  const res = await fetch(`${cfg.apiBase}payment-intents/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ConfigurationId: cfg.configurationId,
      Hash: hash,
    },
    body: bodyString,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const code = data?.errorReport?.errors?.[0]?.code
    const msg =
      data?.errorReport?.errors?.[0]?.message ||
      data?.message ||
      data?.error ||
      `Cashflows payment intent failed (HTTP ${res.status})`
    let detail = typeof msg === 'string' ? msg : 'Cashflows payment intent failed'
    if (code === 'RecordNotFound' && cfg.isIntegration) {
      detail +=
        ' Check CASHFLOWS_INTEGRATION: set to 0 for live gateway credentials, or 1 only for integration (sandbox) keys.'
    }
    throw new Error(detail)
  }

  const paymentJobReference = data?.data?.paymentJobReference
  const token = data?.data?.token
  if (!paymentJobReference || !token) {
    throw new Error('Cashflows did not return a payment job reference or token')
  }

  return {
    paymentJobReference: String(paymentJobReference),
    token: String(token),
    paymentStatus: data?.data?.paymentStatus,
    amountToCollect: body.amountToCollect,
    currency: body.currency,
  }
}

/** Fetch payment intent status (same endpoint as the JS client library). */
export async function retrieveCashflowsPaymentIntent(token) {
  const cfg = getCashflowsConfig()
  if (!cfg.configured) {
    throw new Error('Cashflows is not configured on the server.')
  }
  const trimmed = String(token || '').trim()
  if (!trimmed) throw new Error('Missing Cashflows intent token')

  const res = await fetch(`${cfg.apiBase}payment-intents/${encodeURIComponent(trimmed)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.errorReport?.errors?.[0]?.message ||
      data?.message ||
      `Could not retrieve Cashflows payment (HTTP ${res.status})`
    throw new Error(typeof msg === 'string' ? msg : 'Cashflows retrieve failed')
  }

  return data?.data ?? data
}

export function isCashflowsPaymentSuccessful(intentData) {
  if (!intentData || typeof intentData !== 'object') return false
  const status = intentData.paymentStatus
  const last = intentData.lastPaymentStatus
  return (
    status === 'Paid' ||
    status === 'Verified' ||
    (status === 'Pending' && last === 'Reserved')
  )
}

export function parseCashflowsAmountPence(amountToCollect) {
  const n = Number.parseFloat(String(amountToCollect ?? '').replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}
