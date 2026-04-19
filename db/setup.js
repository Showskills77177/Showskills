/**
 * Ensure SQLite database file exists (creates parent dirs + empty DB if missing).
 * Usage: npm run db:setup
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import Database from 'better-sqlite3'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env.local') })
config({ path: join(root, '.env') })

const rel = (process.env.SQLITE_PATH || 'db/db.sqlite').trim()
const filePath = join(root, rel)

mkdirSync(dirname(filePath), { recursive: true })

const db = new Database(filePath)
db.close()

console.log('SQLite database ready at', filePath)
