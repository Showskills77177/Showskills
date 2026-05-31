#!/usr/bin/env node
/**
 * Code Guardian — independent project health checks.
 * Run: npm run guard | node code-guardian.js [--quick] [--e2e] [--no-server] [--no-lint]
 */
import { spawn, spawnSync } from 'node:child_process'
import { access, constants } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const args = new Set(process.argv.slice(2))
const quick = args.has('--quick')
const runE2e = args.has('--e2e')
const skipServer = args.has('--no-server')
const skipLint = args.has('--no-lint') || process.env.GUARDIAN_SKIP_LINT === '1'

const GUARDIAN_PORT = String(process.env.GUARDIAN_PORT || '3099')
const GUARDIAN_SQLITE = process.env.GUARDIAN_SQLITE || 'db/guardian-check.sqlite'

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

/** @type {{ name: string; ok: boolean; detail?: string; skipped?: boolean }[]} */
const results = []

function log(line = '') {
  console.log(line)
}

function section(title) {
  log(`\n${c.bold}${c.cyan}▸ ${title}${c.reset}`)
}

function pass(msg) {
  log(`  ${c.green}✓${c.reset} ${msg}`)
}

function fail(msg) {
  log(`  ${c.red}✗${c.reset} ${msg}`)
}

function warn(msg) {
  log(`  ${c.yellow}!${c.reset} ${msg}`)
}

function skip(msg) {
  log(`  ${c.dim}○ ${msg} (skipped)${c.reset}`)
}

function record(name, ok, detail = '', skipped = false) {
  results.push({ name, ok, detail, skipped })
  if (skipped) skip(name + (detail ? `: ${detail}` : ''))
  else if (ok) pass(name + (detail ? ` — ${detail}` : ''))
  else fail(name + (detail ? ` — ${detail}` : ''))
}

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...opts.env },
    timeout: opts.timeout ?? 600_000,
  })
  return {
    ok: r.status === 0,
    status: r.status ?? 1,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
    signal: r.signal,
  }
}

async function fileExists(relPath) {
  try {
    await access(join(root, relPath), constants.R_OK)
    return true
  } catch {
    return false
  }
}

async function checkSyntax() {
  section('Syntax (node --check)')
  const files = [
    'server.js',
    'lib/vercelApiDispatch.mjs',
    'db/schema.js',
    'db/setup.js',
    'backend/api/payment-config.js',
    'backend/api/complete-free-entry.js',
    'backend/api/create-cashflows-payment-intent.js',
    'backend/api/record-cashflows-payment.js',
    'backend/api/create-paypal-order.js',
    'backend/api/capture-paypal-order.js',
    'backend/api/create-cashflows-free-verification.js',
    'backend/api/confirm-cashflows-free-verification.js',
    'backend/api/admin/login.js',
    'backend/api/admin/stats.js',
    'backend/api/lib/db.mjs',
    'backend/api/lib/recordSale.mjs',
    'backend/api/lib/recordFreeOnlineEntry.mjs',
    'backend/api/lib/pendingCheckout.mjs',
    'shared/ticketBundles.mjs',
    'shared/competitionEntryMethods.mjs',
  ]

  let failed = 0
  for (const rel of files) {
    if (!(await fileExists(rel))) {
      record(`syntax: ${rel}`, false, 'file missing')
      failed++
      continue
    }
    const r = run('node', ['--check', rel])
    if (!r.ok) {
      const err = [r.stderr, r.stdout].filter(Boolean).join('\n').split('\n')[0] || 'parse error'
      record(`syntax: ${rel}`, false, err)
      failed++
    }
  }
  if (failed === 0) record('syntax (critical files)', true, `${files.length} files OK`)
  return failed === 0
}

async function checkViteBuild() {
  section('Frontend build (Vite)')
  if (quick) {
    record('vite build', true, '--quick', true)
    return true
  }
  const r = run('npm', ['run', 'build'], { timeout: 180_000 })
  if (!r.ok) {
    const tail = (r.stderr || r.stdout).split('\n').slice(-8).join(' ')
    record('vite build', false, tail || `exit ${r.status}`)
    return false
  }
  record('vite build', true, 'production bundle OK')
  return true
}

async function checkLint() {
  section('Linter (ESLint)')
  if (skipLint) {
    record('eslint', true, '--no-lint', true)
    return true
  }
  const r = run('npm', ['run', 'lint'], { timeout: 120_000 })
  if (!r.ok) {
    const lines = (r.stdout || r.stderr).split('\n').filter(Boolean)
    const summary = lines.slice(-5).join(' | ') || `exit ${r.status}`
    record('eslint', false, summary)
    return false
  }
  record('eslint', true)
  return true
}

async function checkCriticalFiles() {
  section('Critical files & API routes')

  const mustExist = [
    ['Payment — Cashflows intent', 'backend/api/create-cashflows-payment-intent.js'],
    ['Payment — record Cashflows', 'backend/api/record-cashflows-payment.js'],
    ['Payment — Cashflows webhook', 'backend/api/cashflows-webhook.js'],
    ['Payment — PayPal create', 'backend/api/create-paypal-order.js'],
    ['Payment — PayPal capture', 'backend/api/capture-paypal-order.js'],
    ['Payment — public config', 'backend/api/payment-config.js'],
    ['Free entry — verification', 'backend/api/create-cashflows-free-verification.js'],
    ['Free entry — confirm', 'backend/api/confirm-cashflows-free-verification.js'],
    ['Free entry — complete', 'backend/api/complete-free-entry.js'],
    ['Free entry — record', 'backend/api/lib/recordFreeOnlineEntry.mjs'],
    ['Admin — login', 'backend/api/admin/login.js'],
    ['Admin — competitions', 'backend/api/admin/competitions.js'],
    ['Admin — draw winner', 'backend/api/admin/draw-winner.js'],
    ['Database — client', 'backend/api/lib/db.mjs'],
    ['Database — schema SQL', 'backend/api/db/schema.sql'],
    ['Admin UI — layout', 'src/admin/AdminLayout.jsx'],
    ['Admin UI — require auth', 'src/admin/RequireAdmin.jsx'],
    ['Entry flow', 'src/entry/EntryFlowProvider.jsx'],
    ['Vercel route map', 'lib/vercelApiDispatch.mjs'],
  ]

  let ok = true
  for (const [label, rel] of mustExist) {
    const exists = await fileExists(rel)
    if (!exists) {
      record(label, false, `missing ${rel}`)
      ok = false
    }
  }
  if (!ok) return false

  try {
    const { routes } = await import(`file://${join(root, 'lib/vercelApiDispatch.mjs')}`)
    const missingHandlers = []
    for (const [path, handler] of Object.entries(routes)) {
      if (typeof handler !== 'function') {
        missingHandlers.push(`${path} (not a function)`)
      }
    }
    if (missingHandlers.length) {
      record('API route handlers', false, missingHandlers.join('; '))
      return false
    }
    record('API route map', true, `${Object.keys(routes).length} routes registered`)
  } catch (e) {
    record('API route map', false, e instanceof Error ? e.message : String(e))
    return false
  }

  record('critical files', true, `${mustExist.length} paths present`)
  return true
}

async function checkDatabase() {
  section('Database connection')
  const env = {
    ...process.env,
    SQLITE_PATH: GUARDIAN_SQLITE,
    DATABASE_URL: '',
  }
  const script = `
    import { query, isDbConfigured } from './backend/api/lib/db.mjs';
    if (!isDbConfigured()) throw new Error('DB not configured');
    const row = await query('SELECT 1 AS ok');
    if (!row?.rows?.[0]?.ok && row?.[0]?.ok !== 1) throw new Error('SELECT 1 failed');
    console.log('ok');
  `
  const r = run('node', ['--input-type=module', '-e', script], { env, timeout: 30_000 })
  if (!r.ok) {
    const err = (r.stderr || r.stdout).split('\n').slice(-3).join(' ') || `exit ${r.status}`
    record('database', false, err)
    return false
  }
  record('database', true, `SQLite (${GUARDIAN_SQLITE})`)
  return true
}

async function checkModuleImports() {
  section('Critical module imports')
  const modules = [
    './backend/api/lib/recordSale.mjs',
    './backend/api/lib/pendingCheckout.mjs',
    './backend/api/lib/freeEntryAbuse.mjs',
    './backend/api/lib/competitionCatalog.mjs',
    './backend/api/lib/checkoutBundle.mjs',
    './backend/api/payment-config.js',
    './backend/api/complete-free-entry.js',
  ]
  const env = { ...process.env, SQLITE_PATH: GUARDIAN_SQLITE, DATABASE_URL: '' }
  let ok = true
  for (const mod of modules) {
    const r = run(
      'node',
      ['--input-type=module', '-e', `import('${mod}').then(() => console.log('ok'))`],
      { env, timeout: 45_000 },
    )
    if (!r.ok) {
      const err = (r.stderr || '').split('\n').find((l) => l.includes('Error')) || r.stderr?.slice(0, 120)
      record(`import ${mod}`, false, err || 'failed')
      ok = false
    }
  }
  if (ok) record('critical imports', true, `${modules.length} modules load`)
  return ok
}

function waitForOutput(child, pattern, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    let buf = ''
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for: ${pattern}`))
    }, timeoutMs)
    const onData = (chunk) => {
      buf += chunk.toString()
      if (pattern.test(buf)) {
        clearTimeout(timer)
        resolvePromise(buf)
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('error', reject)
    child.on('exit', (code) => {
      if (!pattern.test(buf)) {
        clearTimeout(timer)
        reject(new Error(`Process exited ${code} before ready.\n${buf.slice(-500)}`))
      }
    })
  })
}

async function checkDevServer() {
  section('Development API server smoke test')
  if (skipServer) {
    record('API server smoke', true, '--no-server', true)
    return true
  }

  run('node', ['scripts/kill-port.mjs', GUARDIAN_PORT], { timeout: 10_000 })

  const logPath = join(root, 'tmp', 'guardian-server.log')
  const logStream = createWriteStream(logPath, { flags: 'w' })

  const child = spawn('node', ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: GUARDIAN_PORT,
      SQLITE_PATH: GUARDIAN_SQLITE,
      DATABASE_URL: '',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout?.pipe(logStream)
  child.stderr?.pipe(logStream)

  const kill = () => {
    try {
      child.kill('SIGTERM')
    } catch {
      /* already dead */
    }
    run('node', ['scripts/kill-port.mjs', GUARDIAN_PORT], { timeout: 5_000 })
  }

  try {
    await waitForOutput(child, /Server running on port/, 45_000)

    const endpoints = [
      ['/api/payment-config', 'payment-config'],
      ['/api/competitions', 'competitions'],
      ['/api/admin/setup-status', 'admin setup-status'],
    ]

    let allOk = true
    for (const [path] of endpoints) {
      const r = run('curl', ['-sf', '-o', '/dev/null', '-w', '%{http_code}', `http://127.0.0.1:${GUARDIAN_PORT}${path}`], {
        timeout: 15_000,
      })
      const code = r.stdout?.trim()
      const httpOk = code === '200' || code === '204'
      if (!httpOk) {
        record(`GET ${path}`, false, `HTTP ${code || 'unreachable'}`)
        allOk = false
      }
    }

    if (allOk) {
      record('API server smoke', true, `port ${GUARDIAN_PORT}, ${endpoints.length} endpoints`)
    }
    return allOk
  } catch (e) {
    record('API server smoke', false, e instanceof Error ? e.message : String(e))
    warn(`Server log: ${logPath}`)
    return false
  } finally {
    kill()
  }
}

async function checkUnitTests() {
  section('Unit tests (node --test)')
  if (quick) {
    const r = run('npm', ['run', 'test:quiz'], { timeout: 60_000 })
    if (!r.ok) {
      record('test:quiz', false, (r.stderr || r.stdout).split('\n').slice(-4).join(' '))
      return false
    }
    record('test:quiz', true)
    return true
  }

  const scripts = [
    ['test:quiz', 'npm', ['run', 'test:quiz']],
    ['test:email-templates', 'npm', ['run', 'test:email-templates']],
    ['test:competition-catalog', 'npm', ['run', 'test:competition-catalog']],
  ]

  let ok = true
  for (const [name, cmd, cmdArgs] of scripts) {
    const r = run(cmd, cmdArgs, { timeout: 120_000 })
    if (!r.ok) {
      record(name, false, (r.stderr || r.stdout).split('\n').slice(-3).join(' ') || `exit ${r.status}`)
      ok = false
    } else {
      record(name, true)
    }
  }
  return ok
}

async function checkE2e() {
  section('End-to-end tests (Playwright)')
  if (!runE2e && !process.env.GUARDIAN_E2E) {
    record('playwright e2e', true, 'pass --e2e or GUARDIAN_E2E=1 to run', true)
    return true
  }

  for (const port of ['3001', '5173']) {
    run('node', ['scripts/kill-port.mjs', port], { timeout: 10_000 })
  }

  const specs = [
    'tests/e2e/homepage.spec.js',
    'tests/e2e/payment-mocked.spec.js',
    'tests/e2e/admin.spec.js',
    'tests/e2e/db-integrity.spec.js',
  ]

  const r = run('npx', ['playwright', 'test', ...specs], {
    timeout: 600_000,
    env: {
      ...process.env,
      CI: process.env.CI || '1',
    },
  })

  if (!r.ok) {
    record('playwright e2e', false, (r.stdout || r.stderr).split('\n').slice(-6).join(' '))
    return false
  }
  record('playwright e2e', true, specs.length + ' specs')
  return true
}

function printSummary() {
  section('Summary')
  const ran = results.filter((r) => !r.skipped)
  const passed = ran.filter((r) => r.ok).length
  const failed = ran.filter((r) => !r.ok)

  log(`  Checks run: ${ran.length}  |  Passed: ${passed}  |  Failed: ${failed.length}`)

  if (failed.length) {
    log(`\n${c.red}${c.bold}Failed checks:${c.reset}`)
    for (const f of failed) {
      log(`  • ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
    }
  }

  const skipped = results.filter((r) => r.skipped)
  if (skipped.length) {
    log(`\n${c.dim}Skipped: ${skipped.map((s) => s.name).join(', ')}${c.reset}`)
  }
}

async function main() {
  log(`${c.bold}Code Guardian${c.reset} ${c.dim}— ${root}${c.reset}`)
  log(
    `${c.dim}Flags: ${[quick && '--quick', runE2e && '--e2e', skipServer && '--no-server', skipLint && '--no-lint'].filter(Boolean).join(' ') || '(none)'}${c.reset}`,
  )

  const checks = [
    checkSyntax,
    checkCriticalFiles,
    checkModuleImports,
    checkDatabase,
    checkLint,
    checkViteBuild,
    checkDevServer,
    checkUnitTests,
    checkE2e,
  ]

  let allOk = true
  for (const fn of checks) {
    try {
      const ok = await fn()
      if (!ok) allOk = false
    } catch (e) {
      allOk = false
      record(fn.name || 'check', false, e instanceof Error ? e.message : String(e))
    }
  }

  printSummary()

  if (allOk) {
    log(`\n${c.green}${c.bold}Code Guardian: all checks passed.${c.reset}\n`)
    process.exit(0)
  }
  log(`\n${c.red}${c.bold}Code Guardian: failures detected.${c.reset}`)
  log(`${c.dim}Tips: npm run guard:quick  |  full e2e: npm run guard:e2e${c.reset}\n`)
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
