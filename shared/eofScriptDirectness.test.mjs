import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  scoreDraftDirectness,
  mergeDirectnessIntoVerdict,
} from './eofScriptDirectness.mjs'

describe('eofScriptDirectness', () => {
  it('passes a direct Bellingham vs Tuchel quote Short', () => {
    const draft = `Jude Bellingham hit back at Thomas Tuchel after Tuchel questioned his display in the heat. Bellingham said Tuchel doesn't know what it's like to play through that. That's the row between England's star midfielder and the manager. Fans are split on respect versus honesty. Agree with Bellingham or with Tuchel? Comment.`
    const v = scoreDraftDirectness(draft, {
      format: 'quote',
      topic: 'Bellingham responds to Tuchel',
    })
    assert.ok(v.pass, `expected pass, got ${JSON.stringify(v)}`)
    assert.ok(v.score >= 6.5, `score ${v.score}`)
  })

  it('fails vague career waffle', () => {
    const draft = `In today's footballing landscape, the journey of a global superstar reminds us that legacy is a narrative woven into the fabric of the game. Throughout his career, the story raises questions about mindset and energy. It is important to note that unforgettable nights speak volumes. What do you think about this chapter?`
    const v = scoreDraftDirectness(draft, { format: 'news', topic: 'Football legacy' })
    assert.equal(v.pass, false)
    assert.ok(v.score < 6.5)
  })

  it('merges local fail into a soft model pass', () => {
    const direct = scoreDraftDirectness(
      `In today's footballing landscape, the journey of a global superstar reminds us that legacy is a narrative. Throughout his career the story raises questions. It is important to note unforgettable nights. Agree?`,
      { format: 'quote', topic: 'Rooney' },
    )
    const merged = mergeDirectnessIntoVerdict(
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
      direct,
    )
    assert.equal(merged.pass, false)
    assert.ok(merged.reasons.length)
  })
})
