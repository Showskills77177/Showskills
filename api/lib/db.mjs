import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import Database from 'better-sqlite3'
import pg from 'pg'

const { Pool } = pg

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

loadEnv({ path: join(root, '.env.local') })
loadEnv({ path: join(root, '.env') })

let pool
let sqliteDb

/** True when we should use node-pg (e.g. Vercel). SQLite wins if SQLITE_PATH is set. */
export function usePostgres() {
  if (process.env.SQLITE_PATH?.trim()) return false
  const u = process.env.DATABASE_URL?.trim()
  return Boolean(u && (u.startsWith('postgres://') || u.startsWith('postgresql://')))
}

export function getSqlitePath() {
  const rel = (process.env.SQLITE_PATH || 'db/db.sqlite').trim()
  return join(root, rel)
}

function getPool() {
  const url = process.env.DATABASE_URL
  if (!url) return null
  if (!pool) {
    const ssl =
      url.includes('neon.tech') || url.includes('supabase') || process.env.DATABASE_SSL === 'require'
        ? { rejectUnauthorized: false }
        : undefined
    pool = new Pool({ connectionString: url, max: 5, ssl })
  }
  return pool
}

function openSqlite() {
  if (!sqliteDb) {
    const p = getSqlitePath()
    mkdirSync(dirname(p), { recursive: true })
    sqliteDb = new Database(p)
    sqliteDb.pragma('journal_mode = WAL')
  }
  return sqliteDb
}

/** Postgres unique violation, or SQLite UNIQUE constraint */
export function isUniqueViolation(err) {
  if (!err) return false
  if (err.code === '23505') return true
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return true
  if (typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')) return true
  return false
}

function dollarToQuestion(sql, params = []) {
  const chunks = []
  const nextParams = []
  let last = 0
  const re = /\$(\d+)/g
  let m
  while ((m = re.exec(sql)) !== null) {
    chunks.push(sql.slice(last, m.index))
    chunks.push('?')
    nextParams.push(params[parseInt(m[1], 10) - 1])
    last = m.index + m[0].length
  }
  chunks.push(sql.slice(last))
  return { sql: chunks.join(''), params: nextParams }
}

function adaptSqlForSqlite(sql) {
  let s = sql
  s = s.replace(/::jsonb/gi, '')
  s = s.replace(/::int\b/gi, '')
  s = s.replace(/::bigint\b/gi, '')
  s = s.replace(/\sILIKE\s/gi, ' LIKE ')
  s = s.replace(/\bnow\s*\(\s*\)/gi, `datetime('now')`)
  s = s.replace(/COUNT\s*\(\s*\*\s*\)\s*::\s*int/gi, 'CAST(COUNT(*) AS INTEGER)')
  s = s.replace(/COUNT\s*\(\s*\*\s*\)\s*::\s*bigint/gi, 'CAST(COUNT(*) AS INTEGER)')
  s = s.replace(
    /COALESCE\s*\(\s*SUM\s*\(\s*quantity\s*\)\s*,\s*0\s*\)\s*::\s*int/gi,
    'CAST(COALESCE(SUM(quantity), 0) AS INTEGER)',
  )
  s = s.replace(
    /COALESCE\s*\(\s*SUM\s*\(\s*amount_pence\s*\)\s*,\s*0\s*\)\s*::\s*bigint/gi,
    'CAST(COALESCE(SUM(amount_pence), 0) AS INTEGER)',
  )
  return s
}

const JSONISH = new Set(['answers_json', 'raw_metadata'])

function normalizeSqliteRow(row) {
  if (!row || typeof row !== 'object') return row
  const out = { ...row }
  for (const k of Object.keys(out)) {
    if (JSONISH.has(k) && typeof out[k] === 'string' && out[k].length) {
      try {
        out[k] = JSON.parse(out[k])
      } catch {
        /* keep string */
      }
    }
  }
  return out
}

function runSqliteQuery(text, params) {
  const adapted = adaptSqlForSqlite(text)
  const { sql, params: p } = dollarToQuestion(adapted, params)
  const db = openSqlite()
  const trimmed = sql.trim()
  const upper = trimmed.toUpperCase()

  if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
    const rows = db.prepare(sql).all(...p)
    return { rows: rows.map(normalizeSqliteRow) }
  }

  if (/RETURNING/i.test(sql)) {
    const row = db.prepare(sql).get(...p)
    return { rows: row ? [normalizeSqliteRow(row)] : [], rowCount: row ? 1 : 0 }
  }

  const info = db.prepare(sql).run(...p)
  return { rows: [], rowCount: info.changes }
}

export function isDbConfigured() {
  if (usePostgres()) return Boolean(process.env.DATABASE_URL?.trim())
  try {
    openSqlite()
    return true
  } catch {
    return false
  }
}

export async function query(text, params = []) {
  if (usePostgres()) {
    const p = getPool()
    if (!p) {
      const err = new Error('DATABASE_URL is not configured')
      err.code = 'NO_DATABASE'
      throw err
    }
    const result = await p.query(text, params)
    return { rows: result.rows, rowCount: result.rowCount }
  }

  try {
    return runSqliteQuery(text, params)
  } catch (e) {
    return Promise.reject(e)
  }
}
