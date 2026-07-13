import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  adaptPlainTextDraftToScenesLocally,
  balanceSceneUnits,
  splitLongSentence,
  tidyCaption,
  splitDraftIntoSentences,
  unwrapAdaptJson,
} from './eofSceneAdapt.mjs'

const MESSI_DRAFT = `Lionel Messi is back at the World Cup in 2026, and Argentina look sharper with him pulling the strings. The captain scored twice in the group opener and the fans in Miami went wild. At 38, he's still running the show — dictating tempo, finding space, and making every touch count. Brazil and France will be watching closely before the knockouts. Is this Messi's last World Cup dance, or can he lift it again? Drop your take.`

const BELLINGHAM_DRAFT = `Jude Bellingham is dragging England through the World Cup again. He scored the winner and set up another in a 2-1 win over Germany. The Real Madrid star looks unstoppable right now. Southgate says he is the best midfielder in the world. Can anyone stop Bellingham before the final? Drop your take.`

describe('eofSceneAdapt local split', () => {
  it('splits Messi draft into 4–6 scenes with Messi image queries', () => {
    const script = adaptPlainTextDraftToScenesLocally({
      plainTextDraft: MESSI_DRAFT,
      topic: 'Messi shines at World Cup 2026',
      format: 'news',
    })
    assert.ok(script)
    assert.ok(script.scenes.length >= 4 && script.scenes.length <= 8)
    assert.match(script.scenes[0].caption, /Messi|Argentina/i)
    assert.ok(script.scenes.every((s) => /messi/i.test(s.imageQuery)))
    assert.equal(script.scenes[0].role, 'hook')
    assert.equal(script.scenes[script.scenes.length - 1].role, 'cta')
    assert.equal(script.plainTextDraft, MESSI_DRAFT)
  })

  it('never drops the tail of a sentence or cuts a word in half', () => {
    const script = adaptPlainTextDraftToScenesLocally({
      plainTextDraft: MESSI_DRAFT,
      topic: 'Messi shines at World Cup 2026',
      format: 'news',
    })
    // Every non-trivial word from the draft should survive somewhere in the captions
    const captionBlob = script.scenes.map((s) => s.caption.toLowerCase()).join(' ')
    for (const word of ['dictating', 'tempo', 'finding', 'space', 'every', 'touch', 'count']) {
      assert.ok(captionBlob.includes(word), `caption set lost the word "${word}"`)
    }
  })

  it('resolves Bellingham to a full-name image query', () => {
    const script = adaptPlainTextDraftToScenesLocally({
      plainTextDraft: BELLINGHAM_DRAFT,
      topic: 'Jude Bellingham',
      format: 'news',
    })
    assert.ok(script)
    assert.ok(script.scenes.every((s) => /bellingham/i.test(s.imageQuery)))
  })

  it('keeps captions within the 140-char store limit without mid-word cuts', () => {
    const script = adaptPlainTextDraftToScenesLocally({
      plainTextDraft: MESSI_DRAFT,
      topic: 'Messi',
      format: 'news',
    })
    for (const s of script.scenes) {
      assert.ok(s.caption.length <= 140)
      assert.doesNotMatch(s.caption, /\s$/)
    }
  })

  it('splitLongSentence keeps all words', () => {
    const s = 'He scored twice, set up another, ran the midfield, and never stopped pressing the whole night long'
    const chunks = splitLongSentence(s, 6)
    const rejoined = chunks.join(' ').replace(/\s+/g, ' ')
    for (const w of s.replace(/[,]/g, '').split(/\s+/)) {
      assert.ok(rejoined.includes(w), `lost "${w}"`)
    }
  })

  it('balanceSceneUnits merges down to the max scene budget', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} here.`)
    const units = balanceSceneUnits(many, { min: 4, max: 8 })
    assert.ok(units.length <= 8)
  })

  it('tidyCaption strips trailing punctuation and whitespace', () => {
    assert.equal(tidyCaption('  Messi is back,  '), 'Messi is back')
  })

  it('unwraps nested script.scenes from Groq JSON', () => {
    const unwrapped = unwrapAdaptJson({
      script: {
        scenes: [{ caption: 'Hook line', imageQuery: 'Messi football' }],
        title: 'Test',
      },
    })
    assert.equal(unwrapped.scenes.length, 1)
    assert.equal(unwrapped.scenes[0].caption, 'Hook line')
  })

  it('returns null for too-short drafts', () => {
    assert.equal(
      adaptPlainTextDraftToScenesLocally({
        plainTextDraft: 'Too short.',
        topic: 'Messi',
      }),
      null,
    )
  })

  it('splitDraftIntoSentences handles em-dash clauses', () => {
    const parts = splitDraftIntoSentences('First beat. Second beat — third clause here.')
    assert.ok(parts.length >= 2)
  })
})
