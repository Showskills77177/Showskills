import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  scriptMakerFormatQuota,
  topicKey,
  isEofScriptMakerJobDeletable,
  getEofScriptRetentionDays,
  EOF_SCRIPT_RETENTION_DAYS_DEFAULT,
} from '../backend/api/lib/eofScriptMakerScheduler.mjs'
import { buildEofDraftShell } from '../backend/api/lib/eofScriptWriter.mjs'
import { routes } from '../lib/vercelApiDispatch.mjs'
import {
  isLondonLocalMidnightHour,
  londonCalendarDayKey,
  sameLondonCalendarDay,
} from './eofScriptMakerSchedule.mjs'
import { EOF_PRODUCTION_JOB_STATUS } from './eofProduction.mjs'

describe('eof Script Maker retention', () => {
  const now = Date.parse('2026-07-26T00:00:00.000Z')
  const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()

  it('defaults retention to 7 days and honours EOF_SCRIPT_RETENTION_DAYS', () => {
    assert.equal(EOF_SCRIPT_RETENTION_DAYS_DEFAULT, 7)
    assert.equal(getEofScriptRetentionDays({}), 7)
    assert.equal(getEofScriptRetentionDays({ EOF_SCRIPT_RETENTION_DAYS: '14' }), 14)
    assert.equal(getEofScriptRetentionDays({ EOF_SCRIPT_RETENTION_DAYS: '0' }), 7)
    assert.equal(getEofScriptRetentionDays({ EOF_SCRIPT_RETENTION_DAYS: '999' }), 90)
  })

  it('deletes old unused Script Maker drafts only', () => {
    const base = {
      createdBy: 'eof-script-maker',
      status: EOF_PRODUCTION_JOB_STATUS.DRAFT,
      createdAt: daysAgo(8),
      youtubeProjectId: null,
      script: {},
    }
    assert.equal(isEofScriptMakerJobDeletable(base, { now, retentionDays: 7 }), true)
    assert.equal(
      isEofScriptMakerJobDeletable(
        { ...base, createdBy: 'eof-script-maker:owner' },
        { now, retentionDays: 7 },
      ),
      true,
    )
    assert.equal(
      isEofScriptMakerJobDeletable({ ...base, createdAt: daysAgo(3) }, { now, retentionDays: 7 }),
      false,
    )
    assert.equal(
      isEofScriptMakerJobDeletable({ ...base, createdBy: 'eof-scheduler' }, { now, retentionDays: 7 }),
      false,
    )
  })

  it('never deletes published, rendering, built, or approved drafts', () => {
    const old = {
      createdBy: 'eof-script-maker',
      createdAt: daysAgo(30),
      youtubeProjectId: null,
      script: {},
    }
    assert.equal(
      isEofScriptMakerJobDeletable(
        { ...old, status: EOF_PRODUCTION_JOB_STATUS.PUBLISHED },
        { now, retentionDays: 7 },
      ),
      false,
    )
    assert.equal(
      isEofScriptMakerJobDeletable(
        { ...old, status: EOF_PRODUCTION_JOB_STATUS.RENDERING },
        { now, retentionDays: 7 },
      ),
      false,
    )
    assert.equal(
      isEofScriptMakerJobDeletable(
        { ...old, status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO },
        { now, retentionDays: 7 },
      ),
      false,
    )
    assert.equal(
      isEofScriptMakerJobDeletable(
        { ...old, status: EOF_PRODUCTION_JOB_STATUS.VIDEO_RENDERED },
        { now, retentionDays: 7 },
      ),
      false,
    )
    assert.equal(
      isEofScriptMakerJobDeletable(
        { ...old, status: EOF_PRODUCTION_JOB_STATUS.RENDERED },
        { now, retentionDays: 7 },
      ),
      false,
    )
    assert.equal(
      isEofScriptMakerJobDeletable(
        {
          ...old,
          status: EOF_PRODUCTION_JOB_STATUS.DRAFT,
          youtubeProjectId: 'yt-proj-1',
        },
        { now, retentionDays: 7 },
      ),
      false,
    )
    assert.equal(
      isEofScriptMakerJobDeletable(
        {
          ...old,
          status: EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT,
          script: { scriptMakerApproved: true },
        },
        { now, retentionDays: 7 },
      ),
      false,
    )
  })

  it('allows deleting failed / ready_script leftovers past retention', () => {
    assert.equal(
      isEofScriptMakerJobDeletable(
        {
          createdBy: 'eof-script-maker',
          status: EOF_PRODUCTION_JOB_STATUS.FAILED,
          createdAt: daysAgo(10),
        },
        { now, retentionDays: 7 },
      ),
      true,
    )
    assert.equal(
      isEofScriptMakerJobDeletable(
        {
          createdBy: 'eof-script-maker',
          status: EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT,
          createdAt: daysAgo(7),
        },
        { now, retentionDays: 7 },
      ),
      true,
    )
  })
})

describe('eof Script Maker quotas', () => {
  it('splits mixed batches hot-take heavy (≈half quotes)', () => {
    const q = scriptMakerFormatQuota(5, 'mixed')
    assert.equal(q.n, 5)
    assert.equal(q.wantQuotes, 3)
    assert.equal(q.wantNews, 2)
  })

  it('honours news-only and quote-only mixes', () => {
    assert.deepEqual(scriptMakerFormatQuota(5, 'news'), {
      n: 5,
      formatMix: 'news',
      wantQuotes: 0,
      wantNews: 5,
    })
    assert.deepEqual(scriptMakerFormatQuota(4, 'quote'), {
      n: 4,
      formatMix: 'quote',
      wantQuotes: 4,
      wantNews: 0,
    })
  })

  it('clamps count to 1–12 and normalises unknown mix', () => {
    assert.equal(scriptMakerFormatQuota(99, 'mixed').n, 12)
    assert.equal(scriptMakerFormatQuota(0, 'mixed').n, 5) // falsy → default 5
    assert.equal(scriptMakerFormatQuota(1, 'mixed').n, 1)
    assert.equal(scriptMakerFormatQuota(5, 'weird').formatMix, 'mixed')
  })
})

describe('eof Script Maker topicKey', () => {
  it('normalises punctuation and case for duplicate detection', () => {
    assert.equal(topicKey('Salah: transfer talks!!'), topicKey('salah transfer talks'))
    assert.ok(topicKey('A'.repeat(200)).length <= 80)
  })
})

describe('eof Script Maker UK midnight schedule', () => {
  it('treats 00:00 UTC as UK midnight in winter (GMT)', () => {
    // 2026-01-15 00:00 UTC = 00:00 London
    const winterMidnight = new Date('2026-01-15T00:00:00.000Z')
    assert.equal(isLondonLocalMidnightHour(winterMidnight), true)
    assert.equal(londonCalendarDayKey(winterMidnight), '2026-01-15')
    // Off-window: 23:00 UTC in winter is 23:00 London
    assert.equal(isLondonLocalMidnightHour(new Date('2026-01-15T23:00:00.000Z')), false)
  })

  it('treats 23:00 UTC as UK midnight in summer (BST)', () => {
    // 2026-07-15 23:00 UTC = 00:00 BST next calendar day in London
    const summerMidnight = new Date('2026-07-15T23:00:00.000Z')
    assert.equal(isLondonLocalMidnightHour(summerMidnight), true)
    assert.equal(londonCalendarDayKey(summerMidnight), '2026-07-16')
    // Off-window: 00:00 UTC in summer is 01:00 BST
    assert.equal(isLondonLocalMidnightHour(new Date('2026-07-16T00:00:00.000Z')), false)
  })

  it('dedupes runs by UK calendar day across the UTC boundary', () => {
    // BST: run at 23:00 UTC Jul 15 (= London Jul 16 00:00) and check same day at 08:00 UTC Jul 16
    const runAt = new Date('2026-07-15T23:05:00.000Z')
    const morning = new Date('2026-07-16T08:00:00.000Z')
    assert.equal(sameLondonCalendarDay(runAt, morning), true)
    assert.equal(sameLondonCalendarDay(runAt, new Date('2026-07-17T08:00:00.000Z')), false)
  })

  it('vercel Hobby uses ≤2 once-daily crons; Script Maker merges into eof-daily-cron', () => {
    const root = dirname(fileURLToPath(import.meta.url))
    const vercel = JSON.parse(readFileSync(join(root, '..', 'vercel.json'), 'utf8'))
    const crons = vercel.crons || []
    assert.ok(crons.length <= 2, `Hobby allows ≤2 crons, found ${crons.length}`)
    assert.ok(
      crons.every((c) => !String(c.schedule).includes(',')),
      'Hobby rejects expressions that fire more than once per day',
    )
    const daily = crons.filter((c) => c.path === '/api/eof-daily-cron')
    assert.equal(daily.length, 2, 'daily Short + UK-midnight Script Maker share eof-daily-cron')
    const schedules = new Set(daily.map((c) => c.schedule))
    assert.deepEqual(schedules, new Set(['0 9 * * *', '0 23 * * *']))
    assert.equal(
      crons.filter((c) => c.path === '/api/eof-script-maker-cron').length,
      0,
      'Script Maker must not consume a third Hobby cron slot',
    )
  })
})

describe('eof draft shell judge persist', () => {
  it('keeps judge on draft shells and drops skipped judges', () => {
    const withJudge = buildEofDraftShell({
      topic: 'Test topic',
      format: 'news',
      plainTextDraft: 'Claim. Response.',
      title: 'Test',
      source: 'auto',
      judge: { score: 8.2, verdict: 'strong', skipped: false },
    })
    assert.equal(withJudge.judge.score, 8.2)
    assert.equal(withJudge.judge.verdict, 'strong')

    const skipped = buildEofDraftShell({
      topic: 'Test topic',
      format: 'news',
      plainTextDraft: 'Claim. Response.',
      judge: { skipped: true, score: 1 },
    })
    assert.equal(skipped.judge, null)
  })
})

describe('eof Script Maker routes', () => {
  it('registers admin + cron handlers beside daily scheduler', () => {
    assert.equal(typeof routes['/api/admin/eof-scheduler'], 'function')
    assert.equal(typeof routes['/api/eof-daily-cron'], 'function')
    assert.equal(typeof routes['/api/admin/eof-script-maker'], 'function')
    assert.equal(typeof routes['/api/eof-script-maker-cron'], 'function')
  })
})

describe('eof Script Maker open-to-production export', () => {
  it('exports openScriptMakerDraftToProduction for Approve / Send to Production', async () => {
    const mod = await import('../backend/api/lib/eofScriptMakerScheduler.mjs')
    assert.equal(typeof mod.openScriptMakerDraftToProduction, 'function')
  })
})
