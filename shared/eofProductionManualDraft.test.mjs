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

  it('adapts a manual/own script to scenes even when it would trip the AI topic-drift gate', async () => {
    const { createEofProductionJob, adaptEofProductionDraftToScenes } = await import(
      '../backend/api/lib/eofProductionJobs.mjs'
    )
    // Deliberately contrasts Antonio's story against David Moyes — a legitimate editorial
    // contrast in a user-written script, which the AI topic-drift gate would otherwise flag
    // as "narrative shifts to David Moyes instead of the ordered topic".
    const pasted =
      'Michail Antonio was refused compassionate leave for his own father\'s burial by his club. ' +
      'Contrast that with David Moyes, who has always let players go home for family funerals no questions asked. ' +
      'Antonio deserved better than this from the people who are supposed to have his back. ' +
      'This is about how a football club should treat its players in the worst moments of their lives.'

    const job = await createEofProductionJob({
      topic: 'Michail Antonio',
      createdBy: 'tester',
      manualDraft: pasted,
    })
    assert.equal(job.scriptSource, 'manual')

    // Would throw "Cannot adapt this draft — Topic drift..." for an AI-written script;
    // must succeed here because the writer owns the content and topic themselves.
    const adapted = await adaptEofProductionDraftToScenes(job.id, { plainTextDraft: pasted })
    assert.ok(adapted.script.scenes.length >= 1)
    assert.equal(adapted.script.plainTextDraft, pasted)
  })

  it('adapts a very short manual/own script into a single scene without any AI credits or a generic template', async () => {
    const { createEofProductionJob, adaptEofProductionDraftToScenes } = await import(
      '../backend/api/lib/eofProductionJobs.mjs'
    )
    // Too short to reach the normal 3-scene floor (one short sentence, no LLM keys
    // configured in this test env) — must never fall back to a paid AI adapt call
    // or discard the writer's words for buildFactsShortScript's generic template.
    const pasted = 'Marcus Rashford is back to his best for Manchester United this season.'

    const job = await createEofProductionJob({
      topic: 'Marcus Rashford',
      createdBy: 'tester',
      manualDraft: pasted,
    })
    assert.equal(job.scriptSource, 'manual')

    const adapted = await adaptEofProductionDraftToScenes(job.id, { plainTextDraft: pasted })
    assert.equal(adapted.scriptSource, 'local-split-minimal')
    assert.ok(adapted.script.scenes.length >= 1)
    assert.equal(adapted.script.plainTextDraft, pasted)
    // Not the generic template — keeps the writer's actual sentence in the scenes.
    assert.ok(adapted.script.scenes.some((s) => /Rashford/i.test(s.caption)))
  })
})
