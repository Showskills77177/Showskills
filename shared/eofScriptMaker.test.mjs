import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  scriptMakerFormatQuota,
  topicKey,
} from '../backend/api/lib/eofScriptMakerScheduler.mjs'
import { buildEofDraftShell } from '../backend/api/lib/eofScriptWriter.mjs'
import { routes } from '../lib/vercelApiDispatch.mjs'
import {
  isLondonLocalMidnightHour,
  londonCalendarDayKey,
  sameLondonCalendarDay,
} from './eofScriptMakerSchedule.mjs'

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
