import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

describe('Short vs Full Video toggle — createEofProductionJob / adaptEofProductionDraftToScenes', () => {
  let tmpDir
  const prevSqlite = process.env.SQLITE_PATH
  const prevDatabaseUrl = process.env.DATABASE_URL
  const prevPostgresUrl = process.env.POSTGRES_URL

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'eof-full-video-'))
    process.env.SQLITE_PATH = join(tmpDir, 'test.sqlite')
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
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

  it('defaults new jobs to videoLength "short"', async () => {
    const { createEofProductionJob } = await import('../backend/api/lib/eofProductionJobs.mjs')
    const job = await createEofProductionJob({
      topic: 'Marc Cucurella',
      createdBy: 'tester',
      manualDraft: 'Marc Cucurella joined Chelsea in a big-money move from Brighton last summer.',
    })
    assert.equal(job.videoLength, 'short')
    assert.equal(job.videoFootageMode, 'off')
  })

  it('rejects AI-generated drafts for Full Video (requires a pasted/own script)', async () => {
    const { createEofProductionJob } = await import('../backend/api/lib/eofProductionJobs.mjs')
    await assert.rejects(
      createEofProductionJob({ topic: 'Marc Cucurella', createdBy: 'tester', videoLength: 'full' }),
      /Full Video needs a pasted script/,
    )
  })

  it('persists videoLength "full", auto-enables scraped footage, and scales scene count for a long pasted draft', async () => {
    const { createEofProductionJob, adaptEofProductionDraftToScenes } = await import(
      '../backend/api/lib/eofProductionJobs.mjs'
    )
    // ~360 words — long enough to exercise the full-video scene-count scaling (~1 scene / 18 words).
    const sentence =
      'Arsenal dominated possession in the first half but could not find the breakthrough they needed. '
    const pasted = sentence.repeat(24).trim()

    const job = await createEofProductionJob({
      topic: 'Arsenal analysis',
      createdBy: 'tester',
      manualDraft: pasted,
      videoLength: 'full',
    })
    assert.equal(job.videoLength, 'full')
    // Full Video defaults to scraped footage preferred over stills when caller didn't set it explicitly.
    assert.equal(job.videoFootageMode, 'auto')

    const adapted = await adaptEofProductionDraftToScenes(job.id, { plainTextDraft: pasted })
    assert.ok(
      adapted.script.scenes.length > 8,
      `expected more than the Shorts 8-scene cap, got ${adapted.script.scenes.length}`,
    )
    assert.equal(adapted.videoLength, 'full')
    // No forced #Shorts tagging on Full Video output.
    assert.ok(!adapted.script.tags.includes('shortsfeed'))
  })

  it('always prefers scraped footage for Full Video, even if the caller passed videoFootageMode "off"', async () => {
    const { createEofProductionJob } = await import('../backend/api/lib/eofProductionJobs.mjs')
    const job = await createEofProductionJob({
      topic: 'Arsenal analysis',
      createdBy: 'tester',
      manualDraft: 'Arsenal dominated possession in the first half but could not find the breakthrough.',
      videoLength: 'full',
      videoFootageMode: 'off',
    })
    assert.equal(job.videoLength, 'full')
    assert.equal(job.videoFootageMode, 'auto')
  })
})
