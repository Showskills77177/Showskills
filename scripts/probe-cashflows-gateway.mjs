/**
 * Returns which Cashflows gateway accepts the current CASHFLOWS_* env vars.
 * @returns {Promise<'integration'|'live'|'none'>}
 */
import { createCashflowsPaymentIntent, getCashflowsConfig } from '../backend/api/lib/cashflows.mjs'

async function tryIntegration(integration) {
  const prev = process.env.CASHFLOWS_INTEGRATION
  process.env.CASHFLOWS_INTEGRATION = integration ? '1' : '0'
  const cfg = getCashflowsConfig()
  if (!cfg.configured) {
    process.env.CASHFLOWS_INTEGRATION = prev
    return false
  }
  try {
    await createCashflowsPaymentIntent({
      amountPence: 75,
      orderNumber: `SS-probe-${Date.now()}`,
    })
    process.env.CASHFLOWS_INTEGRATION = prev
    return true
  } catch {
    process.env.CASHFLOWS_INTEGRATION = prev
    return false
  }
}

export async function probeCashflowsGateway() {
  if (await tryIntegration(true)) return 'integration'
  if (await tryIntegration(false)) return 'live'
  return 'none'
}

const isMain = process.argv[1]?.endsWith('probe-cashflows-gateway.mjs')
if (isMain) {
  const { config } = await import('dotenv')
  const { resolve } = await import('node:path')
  const { existsSync } = await import('node:fs')
  const root = process.cwd()
  config({ path: resolve(root, '.env.local') })
  config({ path: resolve(root, '.env') })
  const ip = resolve(root, '.env.integration.local')
  if (existsSync(ip)) config({ path: ip, override: true })
  const mode = await probeCashflowsGateway()
  console.log(`Gateway probe: ${mode}`)
  process.exit(mode === 'none' ? 1 : 0)
}
