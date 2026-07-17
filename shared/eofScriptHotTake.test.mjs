import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { scoreDraftHotTake, mergeHotTakeIntoVerdict } from './eofScriptHotTake.mjs'

describe('eofScriptHotTake', () => {
  it('passes a Rio / Tuchel tactics hot take', () => {
    const draft = `Thomas Tuchel's defensive setup cost England — according to Rio Ferdinand, that shape handed Argentina the win. The midfield never pressed and the back line sat deep. That's not a soft take from Rio; it's a tactics row. Was Rio right about Tuchel, or is that unfair after one night? Comment.`
    const v = scoreDraftHotTake(draft, {
      format: 'debate',
      topic: 'Rio Ferdinand on Tuchel England Argentina',
    })
    assert.ok(v.pass, JSON.stringify(v))
    assert.ok(v.score >= 6.5)
    assert.ok(v.bite >= 6)
  })

  it('passes a Bellingham / Messi clarification take', () => {
    const draft = `Jude Bellingham clarified he never said anything bad to Messi after cameras caught their on-pitch exchange. Heat of the moment, not a beef — that's his claim now. The clip looked fiery; Jude says there was no disrespect and no dig at Messi. Fans still split on respect versus gamesmanship after that moment. Buy Bellingham's version, or still smell disrespect? Comment.`
    const v = scoreDraftHotTake(draft, {
      format: 'quote',
      topic: 'Bellingham Messi exchange',
    })
    assert.ok(v.pass, JSON.stringify(v))
  })

  it('fails canned template glue', () => {
    const draft = `Wayne Rooney transfer talk — that is the football story fans are arguing about right now. The result changes the table talk, the dressing-room pressure, and what comes next in the competition for every club involved. Ignore the noise and strip the tribal noise away from the debate. Who comes out of this looking stronger — and who is in trouble after all of this? Comment below.`
    const v = scoreDraftHotTake(draft, { format: 'news', topic: 'Wayne Rooney transfer talk' })
    assert.equal(v.pass, false)
    assert.ok(v.reasons.some((r) => /template|paste/i.test(r)), JSON.stringify(v.reasons))
  })

  it('merges hot-take fail into a soft model pass', () => {
    const hot = scoreDraftHotTake(
      `Wayne Rooney transfer talk — that is the football story fans are arguing about right now. Ignore the noise and strip the tribal noise. Who comes out of this looking stronger? Comment.`,
      { format: 'news', topic: 'Wayne Rooney' },
    )
    const merged = mergeHotTakeIntoVerdict(
      {
        pass: true,
        overall: 8,
        merit: 8,
        interest: 8,
        value: 8,
        reasons: [],
        rewriteHints: [],
        skipped: false,
        judgeProvider: 'openai',
        threshold: 6.5,
      },
      hot,
    )
    assert.equal(merged.pass, false)
    assert.ok(merged.hotTake < 6.5)
  })
})
