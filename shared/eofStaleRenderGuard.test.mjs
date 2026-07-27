/**
 * Stale-render watchdog guards: a poll must never fail a Short that already finished.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

describe('stale render fail guard', () => {
  let tmpDir
  let jobs
  let db
  const prevSqlite = process.env.SQLITE_PATH
  const prevDatabaseUrl = process.env.DATABASE_URL
  const prevPostgresUrl = process.env.POSTGRES_URL

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'eof-stale-guard-'))
    process.env.SQLITE_PATH = join(tmpDir, 'test.sqlite')
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
    jobs = await import('../backend/api/lib/eofProductionJobs.mjs')
    db = await import('../backend/api/lib/db.mjs')
    const { ensureEofProductionSchema } = await import(
      '../backend/api/lib/ensureEofProductionSchema.mjs'
    )
    await ensureEofProductionSchema()
  })

  after(() => {
    if (prevSqlite === undefined) delete process.env.SQLITE_PATH
    else process.env.SQLITE_PATH = prevSqlite
    if (prevDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prevDatabaseUrl
    if (prevPostgresUrl === undefined) delete process.env.POSTGRES_URL
    else process.env.POSTGRES_URL = prevPostgresUrl
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  async function seedJob(id, status) {
    await db.query(
      `INSERT INTO eof_production_jobs (id, topic, title, status, script_json, script_source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, 'Marc Cucurella', 'Cucurella', status, JSON.stringify({ scenes: [] }), 'anthropic', 'test'],
    )
  }

  it('keeps a Short that reached video_rendered while the poll was deciding', async () => {
    await seedJob('finished-job', 'video_rendered')
    const after = await jobs.markEofProductionJobFailed('finished-job', 'Render stuck / timed out', {
      onlyWhenRendering: true,
    })
    assert.equal(after.status, 'video_rendered', 'a built Short must survive a late stale poll')
    assert.equal(after.errorMessage, null)
  })

  it('still fails a job that is genuinely stuck in rendering_video', async () => {
    await seedJob('stuck-job', 'rendering_video')
    const after = await jobs.markEofProductionJobFailed('stuck-job', 'Render stuck / timed out', {
      onlyWhenRendering: true,
    })
    assert.equal(after.status, 'failed')
    assert.match(after.errorMessage, /Render stuck/)
  })

  it('failStaleEofProductionRenders skips jobs that finished mid-poll', async () => {
    await seedJob('late-finisher', 'video_rendered')
    const failed = await jobs.failStaleEofProductionRenders({
      maxAgeSec: 60,
      maxQuietSec: 30,
      now: Date.now() + 10 * 60 * 1000,
    })
    assert.ok(!failed.includes('late-finisher'))
  })
})
