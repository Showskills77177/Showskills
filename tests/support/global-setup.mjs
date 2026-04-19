import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
dotenv.config({ path: join(root, '.env.e2e') })

export default async function globalSetup() {
  const dbBase = join(root, 'db', 'e2e.sqlite')
  for (const f of [dbBase, `${dbBase}-wal`, `${dbBase}-shm`]) {
    try {
      if (existsSync(f)) unlinkSync(f)
    } catch {
      /* busy on some OS if server started early — tests still use fresh DB when possible */
    }
  }
  execSync('node db/schema.js', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SQLITE_PATH: 'db/e2e.sqlite' },
  })
  const fixturesDir = join(root, 'tests', 'fixtures')
  mkdirSync(fixturesDir, { recursive: true })
  writeFileSync(join(fixturesDir, 'tiny.mp4'), Buffer.alloc(2048))
}
