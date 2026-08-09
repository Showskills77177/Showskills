import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

describe('post-your-own-script (skip the AI writer) — createEofProductionJob', () => {
  let tmpDir
  const prevSqlite = process.env.SQLITE_PATH
  const prevDatabaseUrl = process.env.DATABASE_URL
  const prevPostgresUrl = process.env.POSTGRES_URL

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'eof-manual-draft-'))
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

  it('uses the pasted script as-is and never calls the AI writer', async () => {
    const { createEofProductionJob } = await import('../backend/api/lib/eofProductionJobs.mjs')
    const pasted =
      'Marc Cucurella joined Chelsea in a big-money move from Brighton. ' +
      'He became known for his tenacious tackling and distinctive style. What do you make of his impact? Comment.'

    const job = await createEofProductionJob({
      topic: 'Marc Cucurella',
      createdBy: 'tester',
      manualDraft: pasted,
    })

    assert.equal(job.scriptSource, 'manual')
    assert.equal(job.script.plainTextDraft, pasted)
    assert.equal(job.script.draftSource, 'manual')
    // Draft-only status — still needs "Adapt to scenes", same as the AI-written path.
    assert.equal(job.status, 'draft')
    assert.equal(job.script.scenes.length, 0)
  })

  it('falls through to the normal AI-writer path when no manual draft is provided', async () => {
    const { createEofProductionJob } = await import('../backend/api/lib/eofProductionJobs.mjs')
    // No LLM keys configured in this test env, so the AI writer itself throws —
    // proving the manual-draft branch was correctly skipped (it never throws).
    await assert.rejects(
      createEofProductionJob({ topic: 'Marc Cucurella', createdBy: 'tester' }),
      /No AI script provider is configured/,
    )
  })

  it('treats a whitespace-only manual draft as "not provided" (falls through to the AI writer)', async () => {
    const { createEofProductionJob } = await import('../backend/api/lib/eofProductionJobs.mjs')
    await assert.rejects(
      createEofProductionJob({ topic: 'Marc Cucurella', createdBy: 'tester', manualDraft: '   ' }),
      /No AI script provider is configured/,
    )
  })
})
