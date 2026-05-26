#!/usr/bin/env node
/**
 * Local dev against Cashflows integration (sandbox) when sandbox keys exist.
 * Loads .env.integration.local on top of .env.local.
 */
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { probeCashflowsGateway } from './probe-cashflows-gateway.mjs'

const root = process.cwd()
loadEnv({ path: resolve(root, '.env.local') })
loadEnv({ path: resolve(root, '.env') })

const integrationPath = resolve(root, '.env.integration.local')
if (existsSync(integrationPath)) {
  loadEnv({ path: integrationPath, override: true })
  console.log('[cashflows] Loaded .env.integration.local')
} else {
  console.warn('[cashflows] No .env.integration.local — copy .env.integration.local.example')
}

process.env.VITE_CASHFLOWS_ENABLED = process.env.VITE_CASHFLOWS_ENABLED || '1'

const configId = (process.env.CASHFLOWS_CONFIGURATION_ID || '').trim()
const apiKey = (process.env.CASHFLOWS_API_KEY || '').trim()
if (!configId || !apiKey) {
  console.error(
    '\n[cashflows] Missing CASHFLOWS_CONFIGURATION_ID or CASHFLOWS_API_KEY.\n' +
      '  Sandbox: https://secure-int.cashflows.com/ → Configuration → API Data → .env.integration.local\n' +
      '  Live (your current keys): already in .env.local → run: npm run dev:all\n',
  )
  process.exit(1)
}

const mode = await probeCashflowsGateway()

if (mode === 'live') {
  console.error(
    '\n[cashflows] These credentials work on the LIVE gateway only (gateway.cashflows.com).\n' +
      '  They are not sandbox keys — dev:integration cannot use them.\n\n' +
      '  For local checkout with your current keys, run:\n' +
      '    npm run dev:all\n' +
      '  Then open the Local URL Vite prints (e.g. http://localhost:5174).\n\n' +
      '  For sandbox test cards (4000…), you need separate keys from:\n' +
      '    https://secure-int.cashflows.com/\n' +
      '  Email implementations@cashflows.com if you do not have an integration account.\n',
  )
  process.exit(1)
}

if (mode === 'none') {
  console.error(
    '\n[cashflows] Credentials did not work on sandbox or live gateway.\n' +
      '  Check Configuration ID + API key in .env.integration.local or .env.local\n',
  )
  process.exit(1)
}

process.env.CASHFLOWS_INTEGRATION = '1'
process.env.SS_CASHFLOWS_USE_INTEGRATION = '1'

console.log('[cashflows] Sandbox credentials OK — starting dev:all (gateway-int.cashflows.com)\n')

const dev = spawn('npm', ['run', 'dev:all'], { stdio: 'inherit', env: process.env, cwd: root })
dev.on('close', (c) => process.exit(c ?? 0))
