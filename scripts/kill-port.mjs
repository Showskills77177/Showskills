/**
 * Free a TCP port before starting the local API (macOS/Linux).
 * Usage: node scripts/kill-port.mjs 3000
 */
import { execSync } from 'node:child_process'

const port = String(process.argv[2] || '3000').trim()
if (!/^\d+$/.test(port)) {
  console.error('Usage: node scripts/kill-port.mjs <port>')
  process.exit(1)
}

try {
  execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' })
  console.log(`Freed port ${port}`)
} catch {
  /* nothing listening */
}
