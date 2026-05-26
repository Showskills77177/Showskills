/**
 * Quick check: do current CASHFLOWS_* creds work on live vs integration gateway?
 *
 *   node scripts/test-cashflows-gateway.mjs
 *   CASHFLOWS_INTEGRATION=1 node scripts/test-cashflows-gateway.mjs
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { createCashflowsPaymentIntent, getCashflowsConfig } from '../backend/api/lib/cashflows.mjs'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const cfg = getCashflowsConfig()
if (!cfg.configured) {
  console.error('Missing CASHFLOWS_CONFIGURATION_ID or CASHFLOWS_API_KEY in .env.local')
  process.exit(1)
}

console.log(`Gateway: ${cfg.isIntegration ? 'INTEGRATION (sandbox)' : 'LIVE (production)'}`)
console.log(`API base: ${cfg.apiBase}`)
console.log(`Configuration ID: ${cfg.configurationId.slice(0, 6)}…`)

try {
  const intent = await createCashflowsPaymentIntent({
    amountPence: 75,
    currency: 'GBP',
    orderNumber: `SS-test-${Date.now()}`,
  })
  console.log('OK — payment intent created')
  console.log(`  paymentJobReference: ${intent.paymentJobReference}`)
  console.log(`  token: ${intent.token.slice(0, 12)}…`)
  console.log('\nEmbedded checkout: set CASHFLOWS_INTEGRATION to match this gateway, restart npm run dev:all')
  if (cfg.isIntegration) {
    console.log('Test card (Visa): 4000000000000002, CVC 123, any future expiry, name Luke Skywalker = success')
    console.log('Portal: https://secure-int.cashflows.com/')
  }
} catch (e) {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  if (!cfg.isIntegration) {
    console.error('\nFor sandbox, set CASHFLOWS_INTEGRATION=1 and use integration API keys from Cashflows Portal.')
  } else {
    console.error('\nIntegration keys are separate from live — email implementations@cashflows.com if needed.')
  }
  process.exit(1)
}
