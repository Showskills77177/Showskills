#!/usr/bin/env node
/**
 * Local dev against Cashflows integration (sandbox) gateway.
 * Loads .env.local, then overrides with .env.integration.local when present.
 */
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = process.cwd()
loadEnv({ path: resolve(root, '.env.local') })
loadEnv({ path: resolve(root, '.env') })

const integrationPath = resolve(root, '.env.integration.local')
if (existsSync(integrationPath)) {
  loadEnv({ path: integrationPath, override: true })
  console.log('[cashflows] Using .env.integration.local (sandbox credentials)')
} else {
  process.env.CASHFLOWS_INTEGRATION = '1'
  console.warn(
    '[cashflows] No .env.integration.local — forcing CASHFLOWS_INTEGRATION=1 with keys from .env.local.',
  )
  console.warn(
    '[cashflows] Sandbox usually needs separate API keys. Copy .env.integration.local.example → .env.integration.local',
  )
}

process.env.VITE_CASHFLOWS_ENABLED = process.env.VITE_CASHFLOWS_ENABLED || '1'
process.env.CASHFLOWS_INTEGRATION = '1'

const test = spawn('node', ['scripts/test-cashflows-gateway.mjs'], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
})

test.on('close', (code) => {
  if (code !== 0) {
    console.error('\n[cashflows] Fix sandbox credentials before starting dev (see docs/CASHFLOWS-TESTING.md)')
    process.exit(code ?? 1)
  }
  console.log('\n[cashflows] Starting dev:all — checkout uses gateway-int.cashflows.com\n')
  const dev = spawn('npm', ['run', 'dev:all'], { stdio: 'inherit', env: process.env, cwd: root })
  dev.on('close', (c) => process.exit(c ?? 0))
})
