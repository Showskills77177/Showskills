import { test, expect } from '@playwright/test'
import { openE2eDb } from '../support/db.mjs'

test.describe('E) Database integrity (E2E SQLite)', () => {
  test('no users with empty email; kickup rows have core fields when present', async () => {
    const db = openE2eDb()
    const badUsers = db.prepare(`SELECT id FROM users WHERE email IS NULL OR trim(email) = ''`).all()
    expect(badUsers).toEqual([])

    const kickups = db.prepare(`SELECT * FROM kickup_submissions`).all()
    for (const row of kickups) {
      expect(row.full_name, `kickup ${row.id}`).toBeTruthy()
      expect(row.email, `kickup ${row.id}`).toMatch(/@/)
      expect(['pending', 'approved', 'rejected']).toContain(row.review_status)
    }
    db.close()
  })
})
