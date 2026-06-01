import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
dotenv.config({ path: join(root, '.env.e2e') })

/** DB reset runs in scripts/e2e-dev.mjs before the API starts (avoids stale file handles). */
export default async function globalSetup() {
  const fixturesDir = join(root, 'tests', 'fixtures')
  mkdirSync(fixturesDir, { recursive: true })
  writeFileSync(join(fixturesDir, 'tiny.mp4'), Buffer.alloc(2048))
}
