#!/usr/bin/env node
/**
 * Integration: Script Maker draft → open-to-production lands a Production job with full script.
 * Also proves the auto-publish UTC hour gate skips the shared 23:00 Hobby cron fire.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'eof-script-maker-'))
process.env.SQLITE_PATH = join(dir, 'test.sqlite')

const SAMPLE_SCRIPT =
  'Salah is being talked up again — and the timing is no accident. ' +
  'Liverpool need a statement, rivals smell blood, and the desk take is simple: ' +
  'this is pressure dressed as rumour. Watch what happens next.'

async function main() {
  const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
  const { query } = await import('../backend/api/lib/db.mjs')
  const { getEofProductionJob, deleteEofProductionJob } = await import(
    '../backend/api/lib/eofProductionJobs.mjs'
  )
  const { openScriptMakerDraftToProduction, listEofScriptMakerDrafts } = await import(
    '../backend/api/lib/eofScriptMakerScheduler.mjs'
  )
  const { buildEofDraftShell } = await import('../backend/api/lib/eofScriptWriter.mjs')
  const { runEofDailyShortPipeline } = await import('../backend/api/lib/eofDailyScheduler.mjs')
  const { updateEofSchedulerSettings } = await import('../backend/api/lib/eofSchedulerSettings.mjs')
  const { EOF_PRODUCTION_JOB_STATUS } = await import('../shared/eofProduction.mjs')

  await ensureEofProductionSchema()

  const id = randomUUID()
  const shell = buildEofDraftShell({
    topic: 'Salah transfer pressure',
    format: 'debate',
    plainTextDraft: SAMPLE_SCRIPT,
    title: 'Salah transfer pressure',
    source: 'test',
    judge: { score: 8.5, verdict: 'strong', skipped: false },
  })

  await query(
    `INSERT INTO eof_production_jobs
     (id, topic, title, status, script_json, script_source, music_volume, voice_preset, caption_style, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      'Salah transfer pressure',
      shell.title,
      EOF_PRODUCTION_JOB_STATUS.DRAFT,
      JSON.stringify(shell),
      'test',
      0.22,
      'british',
      'pop',
      'eof-script-maker',
    ],
  )

  const drafts = await listEofScriptMakerDrafts(5)
  assert.ok(
    drafts.some((d) => d.id === id && String(d.plainTextDraft).includes('Salah')),
    'draft must appear in Script Maker list with full script',
  )

  const opened = await openScriptMakerDraftToProduction(id, { approvedBy: 'owner' })
  assert.equal(opened.ok, true)
  assert.equal(opened.jobId, id)
  assert.equal(opened.alreadyProduction, true)
  assert.ok(String(opened.plainTextDraft).includes('pressure dressed as rumour'))

  const refreshed = await getEofProductionJob(id)
  assert.ok(refreshed, 'production job must still exist')
  assert.equal(refreshed.script?.scriptMakerApproved, true)
  assert.ok(String(refreshed.script?.plainTextDraft).length >= 40)
  assert.equal(refreshed.status, EOF_PRODUCTION_JOB_STATUS.DRAFT)

  // Hour gate: enabled + 09:00 UTC → 23:00 "now" must skip (shared Hobby cron path).
  await updateEofSchedulerSettings({ enabled: true, hourUtc: 9, minuteUtc: 0 })
  const RealDate = Date
  const fakeNow = new Date('2026-07-17T23:05:00.000Z')
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(fakeNow)
      return new RealDate(...args)
    }
    static now() {
      return fakeNow.getTime()
    }
  }
  try {
    const skipped = await runEofDailyShortPipeline({ force: false, createdBy: 'test-hour-gate' })
    assert.equal(skipped.skipped, true)
    assert.match(String(skipped.reason || ''), /Not the auto-publish hour/i)
  } finally {
    globalThis.Date = RealDate
  }

  await deleteEofProductionJob(id)
  console.log('ok: Script Maker open-to-production + scheduler hour gate')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })
