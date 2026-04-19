import dotenv from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
dotenv.config({ path: join(root, '.env.e2e') })

export const e2eSecret = (process.env.E2E_SECRET || 'e2e-dev-only-secret').trim()
export const adminUser = (process.env.E2E_ADMIN_USER || process.env.ADMIN_USER || 'e2e-admin').trim()
export const adminPass = (process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'e2e-admin-test-pass').trim()
export const e2eSqlitePath = join(root, 'db', 'e2e.sqlite')
