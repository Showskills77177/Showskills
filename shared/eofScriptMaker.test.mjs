import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  scriptMakerFormatQuota,
  topicKey,
} from '../backend/api/lib/eofScriptMakerScheduler.mjs'
import { buildEofDraftShell } from '../backend/api/lib/eofScriptWriter.mjs'
import { routes } from '../lib/vercelApiDispatch.mjs'

describe('eof Script Maker quotas', () => {
  it('splits mixed batches toward news + at least one quote', () => {
    const q = scriptMakerFormatQuota(5, 'mixed')
    assert.equal(q.n, 5)
    assert.equal(q.wantQuotes, 2)
    assert.equal(q.wantNews, 3)
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
