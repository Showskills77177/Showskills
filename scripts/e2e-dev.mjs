#!/usr/bin/env node
/** Start Vite + API for Playwright E2E (free ports, fresh db/e2e.sqlite, then dev servers). */
import { execSync, spawn } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function killPort(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    if (!out) return
    for (const pid of out.split(/\s+/)) {
      const n = Number(pid)
      if (n > 0) {
        try {
          process.kill(n, 'SIGKILL')
        } catch {
          /* already exited */
        }
      }
    }
  } catch {
    /* port free */
  }
}

function resetE2eDb() {
  const dbBase = join(root, 'db', 'e2e.sqlite')
  for (const f of [dbBase, `${dbBase}-wal`, `${dbBase}-shm`]) {
    if (existsSync(f)) unlinkSync(f)
  }
  execSync('node db/schema.js', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SQLITE_PATH: 'db/e2e.sqlite' },
  })
}

killPort(3001)
killPort(5173)
resetE2eDb()

const child = spawn('npm', ['run', 'dev:e2e'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig))
}
