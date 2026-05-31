/**
 * Verifies consolation shirt entries + writes email preview.
 * Usage: npm run test:consolation-shirt
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import {
  awardConsolationShirtEntries,
  hasConsolationBeenAwarded,
} from '../backend/api/lib/awardConsolationShirtEntries.mjs'
import { query, isDbConfigured } from '../backend/api/lib/db.mjs'
import { buildQuizResultHtml, buildQuizResultText } from '../shared/quizResultEmail.mjs'
import { PURCHASE_EMAIL_SAMPLE } from '../shared/purchaseConfirmationEmail.mjs'
import { CONSOLATION_SHIRT_ENTRY_COUNT } from '../shared/consolationShirtGiveaway.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env.local') })
config({ path: join(root, '.env') })

const outDir = join(root, 'tmp')
mkdirSync(outDir, { recursive: true })

if (!isDbConfigured()) {
  console.error('No database. Run: npm run db:setup && npm run db:schema')
  process.exit(1)
}

const testEmail = `consolation-test+${Date.now()}@example.com`
const testName = 'Consolation Test User'
const competitionEntryId = randomUUID()

const mockReq = { headers: { 'x-forwarded-for': '127.0.0.1' } }

console.log('Awarding consolation entries…')
const first = await awardConsolationShirtEntries({
  req: mockReq,
  fullName: testName,
  email: testEmail,
  competitionEntryId,
  source: 'paid',
  amountPence: 1000,
  orderRef: 'ORD-TEST-CONSOLATION',
})

if (!first.awarded || first.entryCount !== CONSOLATION_SHIRT_ENTRY_COUNT) {
  console.error('Expected consolation award failed:', first)
  process.exit(1)
}

if (!first.entryNumbers?.length || first.entryNumbers.length !== CONSOLATION_SHIRT_ENTRY_COUNT) {
  console.error('Expected shirt entry numbers:', first)
  process.exit(1)
}

console.log('Entry numbers:', first.entryNumbers.join(', '))

const second = await awardConsolationShirtEntries({
  req: mockReq,
  fullName: testName,
  email: testEmail,
  competitionEntryId,
  source: 'paid',
  amountPence: 1000,
})

if (second.awarded || second.reason !== 'already_awarded') {
  console.error('Expected idempotent second award to be skipped:', second)
  process.exit(1)
}

const already = await hasConsolationBeenAwarded(competitionEntryId)
if (!already) {
  console.error('hasConsolationBeenAwarded should be true')
  process.exit(1)
}

const rows = await query(
  `SELECT id, full_name, email, video_ref, video_filename, admin_notes, entry_number
   FROM kickup_submissions
   WHERE email = $1 AND video_ref = 'consolation:ronaldo-shirt-giveaway'
   ORDER BY created_at DESC
   LIMIT 5`,
  [testEmail.toLowerCase()],
)

if (rows.rows.length < CONSOLATION_SHIRT_ENTRY_COUNT) {
  console.error('Expected kickup_submissions rows for shirt giveaway:', rows.rows)
  process.exit(1)
}

console.log(`✓ Created ${rows.rows.length} shirt giveaway submission row(s):`)
for (const row of rows.rows) {
  console.log(`  - ${row.entry_number} · ${row.video_filename}`)
}

const html = buildQuizResultHtml({
  customerFullName: testName,
  allCorrect: false,
  siteUrl: 'https://showskills.co.uk',
  orderRef: 'ORD-TEST-CONSOLATION',
  bundleTitle: PURCHASE_EMAIL_SAMPLE.bundleTitle,
  quantity: PURCHASE_EMAIL_SAMPLE.quantity,
  amountPence: 1000,
  ticketNumbers: PURCHASE_EMAIL_SAMPLE.ticketNumbers.slice(0, 3),
  consolationShirtEntries: CONSOLATION_SHIRT_ENTRY_COUNT,
  consolationShirtEntryNumbers: first.entryNumbers,
})

const text = buildQuizResultText({
  customerFullName: testName,
  allCorrect: false,
  siteUrl: 'https://showskills.co.uk',
  orderRef: 'ORD-TEST-CONSOLATION',
  bundleTitle: PURCHASE_EMAIL_SAMPLE.bundleTitle,
  quantity: PURCHASE_EMAIL_SAMPLE.quantity,
  amountPence: 1000,
  ticketNumbers: PURCHASE_EMAIL_SAMPLE.ticketNumbers.slice(0, 3),
  consolationShirtEntries: CONSOLATION_SHIRT_ENTRY_COUNT,
  consolationShirtEntryNumbers: first.entryNumbers,
})

const noConsolationHtml = buildQuizResultHtml({
  customerFullName: testName,
  allCorrect: false,
  siteUrl: 'https://showskills.co.uk',
  orderRef: 'ORD-TEST-UNDER10',
  bundleTitle: 'Single ticket',
  quantity: 1,
  amountPence: 750,
  ticketNumbers: ['SS-UNDER10AB'],
  consolationShirtEntries: 0,
})

const htmlPath = join(outDir, 'consolation-email-preview.html')
const textPath = join(outDir, 'consolation-email-preview.txt')
const under10Path = join(outDir, 'not-qualified-under10-preview.html')
writeFileSync(htmlPath, html, 'utf8')
writeFileSync(textPath, text, 'utf8')
writeFileSync(under10Path, noConsolationHtml, 'utf8')

console.log(`\n✓ Email preview written:`)
console.log(`  ${htmlPath}`)
console.log(`  ${textPath}`)
console.log(`  ${under10Path}`)
console.log('\nOpen the HTML files in a browser, or use Admin → Test email templates.')
console.log('\nNote: Consolation adds 2 rows to Shirt giveaway (admin → Shirt giveaway), not Legacy ticket numbers.')
